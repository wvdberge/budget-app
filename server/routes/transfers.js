const express = require('express');
const { db } = require('../db');
const router = express.Router();

// POST /api/transfers — create both legs atomically
router.post('/', (req, res) => {
  const { profileId, fromAccountId, toAccountId, amount, date, description } = req.body;
  if (!profileId || !fromAccountId || !toAccountId || !amount || !date) {
    return res.status(400).json({ error: 'profileId, fromAccountId, toAccountId, amount and date required' });
  }
  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Van en naar rekening mogen niet hetzelfde zijn' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const numeric = parseFloat(amount);
  if (isNaN(numeric) || numeric <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

  const fromName = db.prepare('SELECT name FROM accounts WHERE id = ?').get(fromAccountId)?.name ?? '';
  const toName   = db.prepare('SELECT name FROM accounts WHERE id = ?').get(toAccountId)?.name ?? '';
  const desc = description?.trim() || null;

  const createBothLegs = db.transaction(() => {
    const fromDesc = desc ?? `Overboeking naar ${toName}`;
    const toDesc   = desc ?? `Overboeking van ${fromName}`;

    const fromId = db.prepare(`
      INSERT INTO transactions (profile_id, account_id, date, amount, description, is_transfer)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(profileId, fromAccountId, date, -numeric, fromDesc).lastInsertRowid;

    const toId = db.prepare(`
      INSERT INTO transactions (profile_id, account_id, date, amount, description, is_transfer)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(profileId, toAccountId, date, numeric, toDesc).lastInsertRowid;

    db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?').run(toId, fromId);
    db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?').run(fromId, toId);

    return { fromId, toId };
  });

  const { fromId, toId } = createBothLegs();
  res.status(201).json({ fromId, toId });
});

module.exports = router;
