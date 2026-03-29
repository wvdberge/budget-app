const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/profiles
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM profiles ORDER BY name').all();
  res.json(rows);
});

// POST /api/profiles
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const info = db.prepare('INSERT INTO profiles (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'name taken' });
    throw e;
  }
});

// PUT /api/profiles/:id
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const info = db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'name taken' });
    throw e;
  }
});

// DELETE /api/profiles/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
