// API test script — run with: node test/test.js
// Requires server to be running on PORT (default 3000)

const BASE = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0;
let failed = 0;

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function assert(label, condition, actual) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — got: ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function run() {
  console.log(`\nBudget API tests — ${BASE}\n`);

  // ── Profiles ──────────────────────────────────────────────────────────────
  console.log('Profiles');

  let r = await req('GET', '/api/profiles');
  assert('GET /api/profiles returns array', Array.isArray(r.data), r.data);

  r = await req('POST', '/api/profiles', { name: '__test_profile__' });
  assert('POST /api/profiles creates profile', r.status === 201 && r.data.id, r.data);
  const profileId = r.data.id;

  r = await req('POST', '/api/profiles', { name: '__test_profile__' });
  assert('POST /api/profiles duplicate returns 409', r.status === 409, r.data);

  r = await req('PUT', `/api/profiles/${profileId}`, { name: '__test_profile_renamed__' });
  assert('PUT /api/profiles/:id renames', r.status === 200 && r.data.name === '__test_profile_renamed__', r.data);

  // ── Accounts ──────────────────────────────────────────────────────────────
  console.log('\nAccounts');

  r = await req('GET', `/api/accounts?profileId=${profileId}`);
  assert('GET /api/accounts returns array', Array.isArray(r.data), r.data);

  r = await req('POST', '/api/accounts', { profileId, name: 'Test Rekening' });
  assert('POST /api/accounts creates account', r.status === 201 && r.data.id, r.data);
  const accountId = r.data.id;

  r = await req('PUT', `/api/accounts/${accountId}`, { name: 'Test Rekening 2' });
  assert('PUT /api/accounts/:id renames', r.status === 200, r.data);

  // ── Groups ────────────────────────────────────────────────────────────────
  console.log('\nCategory groups');

  r = await req('POST', '/api/groups', { profileId, name: 'Vaste Lasten' });
  assert('POST /api/groups creates group', r.status === 201 && r.data.id, r.data);
  const groupId = r.data.id;

  r = await req('GET', `/api/groups?profileId=${profileId}`);
  assert('GET /api/groups returns array', Array.isArray(r.data) && r.data.length > 0, r.data);

  r = await req('PUT', `/api/groups/${groupId}`, { name: 'Vaste Lasten 2' });
  assert('PUT /api/groups/:id renames', r.status === 200, r.data);

  // ── Categories ────────────────────────────────────────────────────────────
  console.log('\nCategories');

  r = await req('POST', '/api/categories', { profileId, groupId, name: 'Huur', monthly_target: 800 });
  assert('POST /api/categories creates category', r.status === 201 && r.data.id, r.data);
  const categoryId = r.data.id;

  r = await req('GET', `/api/categories?profileId=${profileId}`);
  assert('GET /api/categories returns array', Array.isArray(r.data) && r.data.length > 0, r.data);

  r = await req('PUT', `/api/categories/${categoryId}`, { name: 'Huur', monthly_target: 900 });
  assert('PUT /api/categories/:id updates', r.status === 200 && r.data.monthly_target === 900, r.data);

  // ── Budget ────────────────────────────────────────────────────────────────
  console.log('\nBudget');
  const month = '2026-01';

  r = await req('GET', `/api/budget/${profileId}/${month}`);
  assert('GET /api/budget returns groups', r.status === 200 && Array.isArray(r.data.groups), r.data);

  r = await req('PUT', `/api/budget/${profileId}/${month}/${categoryId}`, { target: 750 });
  assert('PUT /api/budget sets target', r.status === 200 && r.data.target === 750, r.data);

  // Verify rollover: add a transaction and check next month
  r = await req('POST', '/api/transactions', {
    profileId, accountId, categoryId,
    date: '2026-01-15', amount: -200, description: 'Test uitgave',
  });
  assert('POST /api/transactions creates transaction', r.status === 201, r.data);
  const txId = r.data.id;

  r = await req('GET', `/api/budget/${profileId}/2026-02`);
  assert('Rollover carries forward to next month', r.status === 200, r.data);
  const cat = r.data.groups.flatMap(g => g.categories).find(c => c.id === categoryId);
  // Available jan = 750 - 200 = 550 → rollover in feb
  assert('Rollover value is correct (550)', cat && Math.abs(cat.rollover - 550) < 0.01, cat);

  // ── Transactions ──────────────────────────────────────────────────────────
  console.log('\nTransactions');

  r = await req('GET', `/api/transactions?profileId=${profileId}&month=2026-01`);
  assert('GET /api/transactions returns array', Array.isArray(r.data) && r.data.length > 0, r.data);

  r = await req('PUT', `/api/transactions/${txId}`, {
    accountId, categoryId, date: '2026-01-16', amount: -250, description: 'Bijgewerkt',
  });
  assert('PUT /api/transactions/:id updates', r.status === 200 && r.data.amount === -250, r.data);

  // ── Copy targets ──────────────────────────────────────────────────────────
  console.log('\nBudget helpers');

  r = await req('POST', `/api/budget/${profileId}/2026-02/copy-targets`);
  assert('copy-targets copies from previous month', r.status === 200 && r.data.copied >= 0, r.data);

  // ── Recurring ─────────────────────────────────────────────────────────────
  r = await req('POST', '/api/transactions', {
    profileId, accountId, categoryId,
    date: '2026-01-01', amount: -50, description: 'Netflix', is_recurring: true,
  });
  assert('Create recurring transaction', r.status === 201 && r.data.is_recurring === 1, r.data);

  r = await req('POST', `/api/budget/${profileId}/2026-02/apply-recurring`);
  assert('apply-recurring copies recurring transactions', r.status === 200 && r.data.created >= 1, r.data);

  // Idempotent — running again should create 0 more
  r = await req('POST', `/api/budget/${profileId}/2026-02/apply-recurring`);
  assert('apply-recurring is idempotent (0 on second call)', r.status === 200 && r.data.created === 0, r.data);

  // ── Error cases ───────────────────────────────────────────────────────────
  console.log('\nError cases');

  r = await req('GET', '/api/budget/99999/2026-01');
  assert('Budget for unknown profile returns empty groups', r.status === 200, r.data);

  r = await req('DELETE', `/api/transactions/${txId}`);
  assert('DELETE /api/transactions/:id', r.status === 204, r.status);

  r = await req('DELETE', `/api/transactions/${txId}`);
  assert('DELETE non-existent transaction returns 404', r.status === 404, r.data);

  r = await req('GET', `/api/budget/${profileId}/2026-99`);
  assert('Invalid month returns 400', r.status === 400, r.data);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('\nCleanup');

  r = await req('DELETE', `/api/profiles/${profileId}`);
  assert('DELETE /api/profiles/:id (cascades)', r.status === 204, r.status);

  r = await req('GET', `/api/accounts?profileId=${profileId}`);
  assert('Accounts gone after profile delete', Array.isArray(r.data) && r.data.length === 0, r.data);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
