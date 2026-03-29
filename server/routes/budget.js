const express = require('express');
const { db, computeBudget } = require('../db');
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

  const groupMap = {};
  for (const g of groups) groupMap[g.id] = { ...g, categories: [] };

  for (const c of categories) {
    const b = budgetMap.get(c.id) ?? { target: 0, spent: 0, rollover: 0, available: 0 };
    const entry = { ...c, ...b };
    if (groupMap[c.group_id]) groupMap[c.group_id].categories.push(entry);
  }

  res.json({
    month,
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
// Copy recurring transactions from the previous month into this month (skip if already copied)
router.post('/:profileId/:month/apply-recurring', (req, res) => {
  const { profileId, month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  // Compute the previous month
  let [y, m] = month.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y--; }
  const prevMonth = `${y}-${String(m).padStart(2, '0')}`;

  // Find recurring transactions from the previous month
  const recurring = db.prepare(`
    SELECT * FROM transactions
    WHERE profile_id = ? AND substr(date,1,7) = ? AND is_recurring = 1
  `).all(profileId, prevMonth);

  if (!recurring.length) return res.json({ created: 0 });

  // Build the target date: same day-of-month, in the new month (clamped to end of month)
  const insert = db.prepare(`
    INSERT INTO transactions (profile_id, account_id, category_id, date, amount, description, is_recurring, recurring_anchor_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  let created = 0;
  const insertMany = db.transaction(() => {
    for (const t of recurring) {
      const origDay = parseInt(t.date.slice(8, 10), 10);
      // Clamp to last day of the new month
      const daysInMonth = new Date(y, m, 0).getDate();
      const day = Math.min(origDay, daysInMonth);
      const newDate = `${month}-${String(day).padStart(2, '0')}`;

      const anchor = t.recurring_anchor_id ?? t.id;

      // Skip if a recurring transaction with this anchor already exists in the target month
      const exists = db.prepare(`
        SELECT 1 FROM transactions
        WHERE profile_id = ? AND substr(date,1,7) = ? AND recurring_anchor_id = ?
      `).get(profileId, month, anchor);
      if (exists) continue;

      insert.run(profileId, t.account_id, t.category_id, newDate, t.amount, t.description, anchor);
      created++;
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
