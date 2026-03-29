const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/accounts?profileId=
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  const rows = db.prepare(`
    SELECT a.*,
           a.initial_balance + COALESCE(SUM(t.amount), 0) AS current_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.profile_id = ?
    GROUP BY a.id
    ORDER BY a.name
  `).all(profileId);
  res.json(rows);
});

// POST /api/accounts
router.post('/', (req, res) => {
  const { profileId, name, initial_balance } = req.body;
  if (!profileId || !name?.trim()) return res.status(400).json({ error: 'profileId and name required' });
  const balance = parseFloat(initial_balance) || 0;
  const info = db.prepare('INSERT INTO accounts (profile_id, name, initial_balance) VALUES (?, ?, ?)').run(profileId, name.trim(), balance);
  res.status(201).json({ id: info.lastInsertRowid, profile_id: Number(profileId), name: name.trim(), initial_balance: balance, current_balance: balance });
});

// PUT /api/accounts/:id
router.put('/:id', (req, res) => {
  const { name, initial_balance } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const balance = initial_balance !== undefined ? (parseFloat(initial_balance) || 0) : undefined;

  if (balance !== undefined) {
    const info = db.prepare('UPDATE accounts SET name = ?, initial_balance = ? WHERE id = ?').run(name.trim(), balance, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  } else {
    const info = db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  }

  const updated = db.prepare(`
    SELECT a.*, a.initial_balance + COALESCE(SUM(t.amount), 0) AS current_balance
    FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.id = ? GROUP BY a.id
  `).get(req.params.id);
  res.json(updated);
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
