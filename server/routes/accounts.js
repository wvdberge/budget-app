const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/accounts?profileId=
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  const rows = db.prepare('SELECT * FROM accounts WHERE profile_id = ? ORDER BY name').all(profileId);
  res.json(rows);
});

// POST /api/accounts
router.post('/', (req, res) => {
  const { profileId, name } = req.body;
  if (!profileId || !name?.trim()) return res.status(400).json({ error: 'profileId and name required' });
  const info = db.prepare('INSERT INTO accounts (profile_id, name) VALUES (?, ?)').run(profileId, name.trim());
  res.status(201).json({ id: info.lastInsertRowid, profile_id: Number(profileId), name: name.trim() });
});

// PUT /api/accounts/:id
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const info = db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ id: Number(req.params.id), name: name.trim() });
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
