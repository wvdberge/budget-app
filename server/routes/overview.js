const express = require('express');
const { db, earliestMonth } = require('../db');
const router = express.Router();

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/overview?profileId=&from=YYYY-MM&to=YYYY-MM
// Net amounts per category per month over a range of whole months.
// Expense categories report spending (positive = money out, refunds lower it);
// income categories report net money in. Transfers and adjustments are excluded,
// matching computeBudget. `from` defaults to the profile's earliest month, `to` to the current month.
// `from` is clamped to the earliest month so empty months before the data starts don't dilute averages;
// the response carries the range actually used.
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });

  const firstMonth = earliestMonth(Number(profileId));
  let from = req.query.from || firstMonth || currentMonth();
  const to = req.query.to   || currentMonth();
  if (!MONTH_RE.test(from) || !MONTH_RE.test(to)) return res.status(400).json({ error: 'from and to must be YYYY-MM' });
  if (firstMonth && from < firstMonth && firstMonth <= to) from = firstMonth;
  if (from > to) return res.status(400).json({ error: 'from must not be after to' });

  const groups = db.prepare(
    'SELECT id, name, sort_order FROM category_groups WHERE profile_id = ? ORDER BY sort_order, name'
  ).all(profileId);
  const categories = db.prepare(
    'SELECT id, group_id, name, is_income FROM categories WHERE profile_id = ? ORDER BY sort_order, name'
  ).all(profileId);

  const rows = db.prepare(`
    SELECT category_id, substr(date,1,7) AS month, SUM(amount) AS total, COUNT(*) AS n
    FROM transactions
    WHERE profile_id = ? AND substr(date,1,7) BETWEEN ? AND ? AND is_transfer = 0 AND is_adjustment = 0
    GROUP BY category_id, month
  `).all(profileId, from, to);

  const byCategory = {};
  const uncategorized = { months: {}, count: 0 };
  for (const r of rows) {
    if (r.category_id === null) {
      uncategorized.months[r.month] = -r.total;
      uncategorized.count += r.n;
    } else {
      (byCategory[r.category_id] ??= {})[r.month] = r.total;
    }
  }

  const income = {};
  const groupMap = {};
  for (const g of groups) groupMap[g.id] = { ...g, categories: [] };

  for (const c of categories) {
    const months = byCategory[c.id] ?? {};
    if (c.is_income) {
      for (const [m, total] of Object.entries(months)) income[m] = (income[m] ?? 0) + total;
      continue;
    }
    const spent = {};
    for (const [m, total] of Object.entries(months)) spent[m] = -total;
    groupMap[c.group_id]?.categories.push({ id: c.id, name: c.name, months: spent });
  }

  res.json({
    from,
    to,
    firstMonth,
    groups: groups.map(g => groupMap[g.id]),
    income,
    uncategorized,
  });
});

module.exports = router;
