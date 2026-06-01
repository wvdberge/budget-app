const express = require('express');
const { db, computeBudget, computeIncome } = require('../db');
const router = express.Router();

// GET /api/budget/:profileId/:month
// Returns full budget for a month: groups with categories, each including target/spent/rollover/available
router.get('/:profileId/:month', (req, res) => {
  const { profileId, month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  const groups = db.prepare(
    'SELECT * FROM category_groups WHERE profile_id = ? ORDER BY sort_order, name'
  ).all(profileId);

  const categories = db.prepare(
    'SELECT * FROM categories WHERE profile_id = ? ORDER BY sort_order, name'
  ).all(profileId);

  const budgetMap = computeBudget(Number(profileId), month);
  const incomeCategories = computeIncome(Number(profileId), month);

  const groupMap = {};
  for (const g of groups) groupMap[g.id] = { ...g, categories: [] };

  for (const c of categories) {
    if (c.is_income) continue; // income categories shown separately
    const b = budgetMap.get(c.id) ?? { target: 0, spent: 0, rollover: 0, available: 0 };
    const entry = { ...c, ...b };
    if (groupMap[c.group_id]) groupMap[c.group_id].categories.push(entry);
  }

  res.json({
    month,
    incomeCategories,
    groups: groups.map(g => groupMap[g.id]),
  });
});

// PUT /api/budget/:profileId/:month/:categoryId
// Set the target for a specific category in a specific month
router.put('/:profileId/:month/:categoryId', (req, res) => {
  const { profileId, month, categoryId } = req.params;
  const { target } = req.body;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
  if (target === undefined || target === null) return res.status(400).json({ error: 'target required' });

  db.prepare(`
    INSERT INTO month_budgets (profile_id, category_id, month, target)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(profile_id, category_id, month) DO UPDATE SET target = excluded.target
  `).run(profileId, categoryId, month, target);

  res.json({ profileId: Number(profileId), categoryId: Number(categoryId), month, target: Number(target) });
});

// POST /api/budget/:profileId/:month/apply-recurring
// Apply recurring transactions into this month based on their frequency.
// Uses the original anchor transaction as the source of truth for all frequencies.
router.post('/:profileId/:month/apply-recurring', (req, res) => {
  const { profileId, month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  const [targetYear, targetMonthNum] = month.split('-').map(Number);

  // Find all anchor recurring transactions (the originals, not copies)
  const anchors = db.prepare(`
    SELECT * FROM transactions
    WHERE profile_id = ? AND is_recurring = 1 AND recurring_anchor_id IS NULL
  `).all(profileId);

  if (!anchors.length) return res.json({ created: 0 });

  const insert = db.prepare(`
    INSERT INTO transactions (profile_id, account_id, category_id, date, amount, description, is_recurring, recurring_frequency, recurring_anchor_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  function calcMonthDiff(anchorMonthStr, targetMonthStr) {
    const [ay, am] = anchorMonthStr.split('-').map(Number);
    const [ty, tm] = targetMonthStr.split('-').map(Number);
    return (ty - ay) * 12 + (tm - am);
  }

  function clampedDate(year, monthNum, day) {
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const d = Math.min(day, daysInMonth);
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  let created = 0;
  const insertMany = db.transaction(() => {
    for (const anchor of anchors) {
      const freq = anchor.recurring_frequency || 'monthly';
      const anchorMonthStr = anchor.date.slice(0, 7);
      const diff = calcMonthDiff(anchorMonthStr, month);

      // Skip months before the anchor's own month for every frequency.
      if (diff < 0) continue;

      if (freq === 'weekly') {
        // Fill matching weekdays in the target month. When diff === 0 (the anchor's own
        // month) the anchor itself already occupies its date — skip it in the loop.
        const anchorWeekday = new Date(anchor.date).getDay();
        const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(targetYear, targetMonthNum - 1, d).getDay() !== anchorWeekday) continue;
          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
          if (dateStr === anchor.date) continue;

          const exists = db.prepare(`
            SELECT 1 FROM transactions WHERE profile_id = ? AND date = ? AND recurring_anchor_id = ?
          `).get(profileId, dateStr, anchor.id);
          if (exists) continue;

          insert.run(profileId, anchor.account_id, anchor.category_id, dateStr, anchor.amount, anchor.description, freq, anchor.id);
          created++;
        }
      } else {
        // monthly: every month (period=1), quarterly: every 3, yearly: every 12.
        // The anchor row covers its own month, so skip diff === 0 here.
        if (diff === 0) continue;
        const period = freq === 'quarterly' ? 3 : freq === 'yearly' ? 12 : 1;
        if (diff % period !== 0) continue;

        const exists = db.prepare(`
          SELECT 1 FROM transactions
          WHERE profile_id = ? AND substr(date,1,7) = ? AND recurring_anchor_id = ?
        `).get(profileId, month, anchor.id);
        if (exists) continue;

        const origDay = parseInt(anchor.date.slice(8, 10), 10);
        const newDate = clampedDate(targetYear, targetMonthNum, origDay);

        insert.run(profileId, anchor.account_id, anchor.category_id, newDate, anchor.amount, anchor.description, freq, anchor.id);
        created++;
      }
    }
  });
  insertMany();

  res.json({ created });
});

// POST /api/budget/:profileId/:month/copy-targets
// Copy targets from the previous month into this month for all categories
router.post('/:profileId/:month/copy-targets', (req, res) => {
  const { profileId, month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  let [y, m] = month.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y--; }
  const prevMonth = `${y}-${String(m).padStart(2, '0')}`;

  // Use effective target from previous month: month-specific override if set, else category default
  const categoryDefaults = db.prepare(
    'SELECT id as category_id, monthly_target as target FROM categories WHERE profile_id = ?'
  ).all(profileId);

  const prevOverrides = db.prepare(
    'SELECT category_id, target FROM month_budgets WHERE profile_id = ? AND month = ?'
  ).all(profileId, prevMonth);

  const overrideMap = {};
  for (const r of prevOverrides) overrideMap[r.category_id] = r.target;

  const effectiveTargets = categoryDefaults.map(c => ({
    category_id: c.category_id,
    target: overrideMap[c.category_id] ?? c.target,
  }));

  const upsert = db.prepare(`
    INSERT INTO month_budgets (profile_id, category_id, month, target)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(profile_id, category_id, month) DO NOTHING
  `);

  const insertMany = db.transaction(() => {
    for (const r of effectiveTargets) upsert.run(profileId, r.category_id, month, r.target);
  });
  insertMany();

  res.json({ copied: effectiveTargets.length });
});

module.exports = router;
