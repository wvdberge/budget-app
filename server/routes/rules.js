const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/rules?profileId=
router.get('/', (req, res) => {
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  res.json(db.prepare(`
    SELECT r.*,
           c.name as category_name,
           a.name as transfer_account_name
    FROM category_rules r
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN accounts   a ON a.id = r.transfer_account_id
    WHERE r.profile_id = ?
    ORDER BY r.keyword COLLATE NOCASE
  `).all(profileId));
});

// POST /api/rules
// Body: { profileId, keyword, categoryId? | transferAccountId? } — exactly one target.
router.post('/', (req, res) => {
  const { profileId, keyword, categoryId, transferAccountId } = req.body;
  if (!profileId || !keyword) {
    return res.status(400).json({ error: 'profileId and keyword required' });
  }
  if ((!categoryId && !transferAccountId) || (categoryId && transferAccountId)) {
    return res.status(400).json({ error: 'exactly one of categoryId or transferAccountId required' });
  }
  const trimmed = keyword.trim();
  db.prepare(`
    INSERT INTO category_rules (profile_id, keyword, category_id, transfer_account_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(profile_id, keyword) DO UPDATE SET
      category_id         = excluded.category_id,
      transfer_account_id = excluded.transfer_account_id
  `).run(profileId, trimmed, categoryId ?? null, transferAccountId ?? null);

  res.status(201).json(db.prepare(`
    SELECT r.*, c.name as category_name, a.name as transfer_account_name
    FROM category_rules r
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN accounts   a ON a.id = r.transfer_account_id
    WHERE r.profile_id = ? AND r.keyword = ?
  `).get(profileId, trimmed));
});

// DELETE /api/rules/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM category_rules WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
