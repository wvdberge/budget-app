const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/rules?profileId=
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  res.json(db.prepare(`
    SELECT r.*, c.name as category_name
    FROM category_rules r
    LEFT JOIN categories c ON c.id = r.category_id
    WHERE r.profile_id = ?
    ORDER BY r.keyword COLLATE NOCASE
  `).all(profileId));
});

// POST /api/rules
router.post('/', (req, res) => {
  const { profileId, keyword, categoryId } = req.body;
  if (!profileId || !keyword || !categoryId) {
    return res.status(400).json({ error: 'profileId, keyword and categoryId required' });
  }
  const info = db.prepare(`
    INSERT INTO category_rules (profile_id, keyword, category_id)
    VALUES (?, ?, ?)
    ON CONFLICT(profile_id, keyword) DO UPDATE SET category_id = excluded.category_id
  `).run(profileId, keyword.trim(), categoryId);
  res.status(201).json(db.prepare('SELECT r.*, c.name as category_name FROM category_rules r LEFT JOIN categories c ON c.id = r.category_id WHERE r.id = ?').get(info.lastInsertRowid));
});

// DELETE /api/rules/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM category_rules WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
