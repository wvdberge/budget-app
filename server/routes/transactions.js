const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/transactions?profileId=&month=YYYY-MM&accountId=
// accountId takes precedence over month; when accountId is set, all months are returned.
router.get('/', (req, res) => {
  const { profileId, month, accountId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });

  let q = `
    SELECT t.*, a.name as account_name, c.name as category_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.profile_id = ?
  `;
  const params = [profileId];

  if (accountId) {
    q += ' AND t.account_id = ?';
    params.push(accountId);
  } else if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    q += ' AND substr(t.date,1,7) = ?';
    params.push(month);
  }

  q += ' ORDER BY t.date DESC, t.id DESC';
  res.json(db.prepare(q).all(...params));
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { profileId, accountId, categoryId, date, amount, description, is_recurring, recurring_frequency } = req.body;
  if (!profileId || !accountId || !date || amount === undefined) {
    return res.status(400).json({ error: 'profileId, accountId, date and amount required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const info = db.prepare(`
    INSERT INTO transactions (profile_id, account_id, category_id, date, amount, description, is_recurring, recurring_frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(profileId, accountId, categoryId ?? null, date, amount, description ?? '', is_recurring ? 1 : 0, recurring_frequency ?? 'monthly');

  res.status(201).json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  const { accountId, categoryId, date, amount, description, is_recurring, recurring_frequency } = req.body;
  if (!accountId || !date || amount === undefined) {
    return res.status(400).json({ error: 'accountId, date and amount required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const info = db.prepare(`
    UPDATE transactions
    SET account_id = ?, category_id = ?, date = ?, amount = ?, description = ?, is_recurring = ?, recurring_frequency = ?
    WHERE id = ?
  `).run(accountId, categoryId ?? null, date, amount, description ?? '', is_recurring ? 1 : 0, recurring_frequency ?? 'monthly', req.params.id);

  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT is_transfer, transfer_peer_id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'not found' });
  if (tx.is_transfer && tx.transfer_peer_id) {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.transfer_peer_id);
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
