const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/groups?profileId=
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  const rows = db.prepare(
    'SELECT * FROM category_groups WHERE profile_id = ? ORDER BY sort_order, name'
  ).all(profileId);
  res.json(rows);
});

// POST /api/groups
router.post('/', (req, res) => {
  const { profileId, name, sort_order } = req.body;
  if (!profileId || !name?.trim()) return res.status(400).json({ error: 'profileId and name required' });
  const info = db.prepare(
    'INSERT INTO category_groups (profile_id, name, sort_order) VALUES (?, ?, ?)'
  ).run(profileId, name.trim(), sort_order ?? 0);
  res.status(201).json({ id: info.lastInsertRowid, profile_id: Number(profileId), name: name.trim(), sort_order: sort_order ?? 0 });
});

// PUT /api/groups/:id
router.put('/:id', (req, res) => {
  const { name, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const info = db.prepare(
    'UPDATE category_groups SET name = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?'
  ).run(name.trim(), sort_order ?? null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ id: Number(req.params.id), name: name.trim() });
});

// DELETE /api/groups/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM category_groups WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
