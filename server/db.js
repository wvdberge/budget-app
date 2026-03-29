const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'budget.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations
try { db.exec(`ALTER TABLE accounts ADD COLUMN initial_balance REAL NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE transactions ADD COLUMN is_transfer INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE transactions ADD COLUMN transfer_peer_id INTEGER REFERENCES transactions(id)`); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS category_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS categories (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id       INTEGER NOT NULL REFERENCES category_groups(id) ON DELETE CASCADE,
    profile_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    monthly_target REAL NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS month_budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month       TEXT NOT NULL,
    target      REAL NOT NULL DEFAULT 0,
    UNIQUE(profile_id, category_id, month)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    category_id         INTEGER REFERENCES categories(id),
    date                TEXT NOT NULL,
    amount              REAL NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    is_recurring        INTEGER NOT NULL DEFAULT 0,
    recurring_anchor_id INTEGER REFERENCES transactions(id)
  );
`);

// ── Rollover helpers ─────────────────────────────────────────────────────────

function addMonths(month, n) {
  let [y, m] = month.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function monthsBetween(start, end) {
  const result = [];
  let cur = start;
  while (cur <= end) {
    result.push(cur);
    cur = addMonths(cur, 1);
  }
  return result;
}

// Returns the earliest month that has any transaction or budget row for a profile.
function earliestMonth(profileId) {
  const t = db.prepare(`
    SELECT MIN(substr(date,1,7)) as m FROM transactions WHERE profile_id = ?
  `).get(profileId);
  const b = db.prepare(`
    SELECT MIN(month) as m FROM month_budgets WHERE profile_id = ?
  `).get(profileId);
  const candidates = [t?.m, b?.m].filter(Boolean);
  return candidates.length ? candidates.reduce((a, b) => (a < b ? a : b)) : null;
}

// Computes available (rollover + target - spent) for every category for a given month.
// Returns a Map: categoryId -> { target, spent, rollover, available }
function computeBudget(profileId, month) {
  const first = earliestMonth(profileId);
  const categories = db.prepare(
    'SELECT id, monthly_target FROM categories WHERE profile_id = ?'
  ).all(profileId);

  if (!categories.length) return new Map();

  // Seed rollovers at zero
  const rollover = {};
  for (const c of categories) rollover[c.id] = 0;

  if (!first || first > month) {
    // No prior data — compute for just this month with zero rollover
    return computeForMonths(profileId, [month], rollover, categories);
  }

  const months = monthsBetween(first, month);
  return computeForMonths(profileId, months, rollover, categories);
}

function computeForMonths(profileId, months, rollover, categories) {
  const result = new Map();

  for (const m of months) {
    // Fetch all targets for this month in one query
    const budgetRows = db.prepare(`
      SELECT category_id, target FROM month_budgets
      WHERE profile_id = ? AND month = ?
    `).all(profileId, m);
    const targetMap = {};
    for (const r of budgetRows) targetMap[r.category_id] = r.target;

    // Fetch all spending for this month in one query
    const spentRows = db.prepare(`
      SELECT category_id, SUM(amount) as total
      FROM transactions
      WHERE profile_id = ? AND substr(date,1,7) = ? AND amount < 0 AND is_transfer = 0
      GROUP BY category_id
    `).all(profileId, m);
    const spentMap = {};
    for (const r of spentRows) spentMap[r.category_id] = Math.abs(r.total);

    for (const c of categories) {
      const target = targetMap[c.id] ?? c.monthly_target ?? 0;
      const spent  = spentMap[c.id]  ?? 0;
      const prev   = rollover[c.id]  ?? 0;
      const available = target + prev - spent;
      result.set(c.id, { target, spent, rollover: prev, available });
      rollover[c.id] = available;
    }
  }

  return result;
}

module.exports = { db, computeBudget, addMonths, monthsBetween, earliestMonth };
