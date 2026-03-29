const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/categories?profileId=&groupId=
router.get('/', (req, res) => {
  const { profileId, groupId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  let q = 'SELECT * FROM categories WHERE profile_id = ?';
  const params = [profileId];
  if (groupId) { q += ' AND group_id = ?'; params.push(groupId); }
  q += ' ORDER BY sort_order, name';
  res.json(db.prepare(q).all(...params));
});

// POST /api/categories
router.post('/', (req, res) => {
  const { profileId, groupId, name, monthly_target, sort_order } = req.body;
  if (!profileId || !groupId || !name?.trim()) {
    return res.status(400).json({ error: 'profileId, groupId and name required' });
  }
  const info = db.prepare(
    'INSERT INTO categories (group_id, profile_id, name, monthly_target, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(groupId, profileId, name.trim(), monthly_target ?? 0, sort_order ?? 0);
  res.status(201).json({
    id: info.lastInsertRowid,
    group_id: Number(groupId),
    profile_id: Number(profileId),
    name: name.trim(),
    monthly_target: monthly_target ?? 0,
    sort_order: sort_order ?? 0,
  });
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const { name, monthly_target, group_id, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const info = db.prepare(`
    UPDATE categories
    SET name = ?, monthly_target = COALESCE(?, monthly_target),
        group_id = COALESCE(?, group_id), sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name.trim(), monthly_target ?? null, group_id ?? null, sort_order ?? null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
