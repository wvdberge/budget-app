const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseAmount(str) {
  // Dutch format: period as thousands separator, comma as decimal
  // e.g. "1.234,56" or "-100,00" or "100,00"
  if (!str) return NaN;
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

function parseABNAMRO(text) {
  // ABN AMRO TXT/TAB export: tab-separated, no header row
  // Columns: Rekeningnummer, Munteenheid, Transactiedatum (YYYYMMDD),
  //          Beginsaldo, Eindsaldo, Rentedatum, Bedrag, Omschrijving
  const transactions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 8) continue;

    const rawDate = cols[2].trim();
    if (!/^\d{8}$/.test(rawDate)) continue; // skip header or malformed

    const year  = rawDate.slice(0, 4);
    const month = rawDate.slice(4, 6);
    const day   = rawDate.slice(6, 8);
    const date  = `${year}-${month}-${day}`;

    const amount = parseAmount(cols[6]);
    if (isNaN(amount)) continue;

    // Description: strip SEPA boilerplate, keep meaningful part
    let description = cols[7]?.trim() ?? '';
    // ABN AMRO embeds info as /NAME/value/ — extract the most useful parts
    const nameMatch = description.match(/\/NAME\/([^/]+)/);
    const descMatch = description.match(/\/REMI\/([^/]+)/);
    if (nameMatch || descMatch) {
      description = [nameMatch?.[1], descMatch?.[1]].filter(Boolean).join(' — ');
    }
    description = description.slice(0, 200);

    transactions.push({ date, amount, description: description || 'Import ABN AMRO' });
  }

  return transactions;
}

function parseASNBank(text) {
  // ASN Bank CSV: semicolon-separated with header row, dates DD-MM-YYYY
  // Columns: Boekingsdatum;Opdrachtgeversrekening;Tegenrekeningnummer;
  //          Naam tegenrekening;...;Bedrag;...;Omschrijving;...
  const transactions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return transactions;

  // Detect and skip header row
  const firstLine = lines[0].replace(/"/g, '');
  const isHeader = firstLine.toLowerCase().includes('boekingsdatum');
  const dataLines = isHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    // Handle quoted fields
    const cols = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 18) continue;

    // Boekingsdatum: DD-MM-YYYY
    const rawDate = cols[0];
    const dateParts = rawDate.split('-');
    if (dateParts.length !== 3) continue;
    const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const amount = parseAmount(cols[10]);
    if (isNaN(amount)) continue;

    const counterparty = cols[3]?.trim();
    const rawDesc      = cols[17]?.trim();
    const description  = [counterparty, rawDesc].filter(Boolean).join(' — ').slice(0, 200);

    transactions.push({ date, amount, description: description || 'Import ASN Bank' });
  }

  return transactions;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/import/parse
// Parse a CSV/TAB file and return transactions (preview, not yet saved).
// When profileId+accountId are provided, flag rows that already exist on the
// target account (exact amount, ±1 day) so the UI can pre-deselect duplicates.
router.post('/parse', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const { bank, profileId, accountId } = req.body;
  if (!['abnamro', 'asn'].includes(bank)) return res.status(400).json({ error: 'bank must be abnamro or asn' });

  const text = req.file.buffer.toString('utf-8');
  const transactions = bank === 'abnamro' ? parseABNAMRO(text) : parseASNBank(text);

  if (profileId && accountId) {
    const findMatch = db.prepare(`
      SELECT id, is_transfer FROM transactions
      WHERE profile_id = ?
        AND account_id = ?
        AND amount     = ?
        AND date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
      LIMIT 1
    `);
    for (const t of transactions) {
      const match = findMatch.get(profileId, accountId, t.amount, t.date, t.date);
      if (match) t.existing = { id: match.id, isTransferLeg: !!match.is_transfer };
    }
  }

  res.json({ transactions, count: transactions.length });
});

// POST /api/import/save
// Save parsed transactions to the database.
// Rows with `categoryId` become regular transactions.
// Rows with `transferAccountId` create two linked transfer legs.
router.post('/save', (req, res) => {
  const { profileId, accountId, transactions } = req.body;
  if (!profileId || !accountId || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'profileId, accountId and transactions required' });
  }

  const account = db.prepare('SELECT id, name FROM accounts WHERE id = ? AND profile_id = ?').get(accountId, profileId);
  if (!account) return res.status(403).json({ error: 'account does not belong to profile' });

  const insertCategorized = db.prepare(`
    INSERT INTO transactions (profile_id, account_id, category_id, date, amount, description, is_recurring)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  const insertTransferLeg = db.prepare(`
    INSERT INTO transactions (profile_id, account_id, date, amount, description, is_transfer)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const linkPeer = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');

  const validAccount = db.prepare('SELECT name FROM accounts WHERE id = ? AND profile_id = ?');

  let saved = 0;
  const insertMany = db.transaction(() => {
    for (const t of transactions) {
      if (!t.date || t.amount === undefined) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;

      if (t.transferAccountId) {
        if (Number(t.transferAccountId) === Number(accountId)) continue;
        const peer = validAccount.get(t.transferAccountId, profileId);
        if (!peer) continue;

        const fromId = insertTransferLeg.run(
          profileId, accountId, t.date, t.amount, t.description ?? ''
        ).lastInsertRowid;
        const toId = insertTransferLeg.run(
          profileId, t.transferAccountId, t.date, -t.amount, `Overboeking van ${account.name}`
        ).lastInsertRowid;
        linkPeer.run(toId, fromId);
        linkPeer.run(fromId, toId);
        saved++;
      } else {
        insertCategorized.run(profileId, accountId, t.categoryId ?? null, t.date, t.amount, t.description ?? '');
        saved++;
      }
    }
  });
  insertMany();

  res.json({ saved });
});

module.exports = router;
