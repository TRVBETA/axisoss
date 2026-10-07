// AXIS // sync-delta route tests
// Verifies the consolidated /api/coredata?action=sync-delta endpoint:
//  1. rejects unauthenticated requests
//  2. returns one combined payload with all module keys
//  3. degrades per-module on failure (partial payload, never a total 500)
//  4. leaves the legacy GET shape untouched
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

let failPatterns = [];

global.fetch = async (url, options = {}) => {
  const u = String(url);
  if (failPatterns.some((pat) => u.includes(pat))) {
    throw new Error(`mock network failure: ${u}`);
  }
  let body = [];
  if (u.includes('axis_ranks')) {
    body = [{ level: 1, name: 'RANK I', short_label: 'RANK I', min_count: 0, color: '#8c8a84', updated_at: new Date().toISOString() }];
  } else if (u.includes('core_balance')) {
    body = [{ id: 'bal-1', label: 'Main Balance', amount: 0, updated_at: new Date().toISOString() }];
  }
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null }
  };
};

const { default: handler } = await import('./api/coredata.js');
const { createSessionToken } = await import('./lib/axisAuth.js');

const session = createSessionToken();

function authedReq(extra = {}) {
  return {
    method: 'GET',
    query: {},
    headers: { cookie: `axis_session=${encodeURIComponent(session)}` },
    ...extra
  };
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };
}

// 1. Unauthenticated → 401
let res = createRes();
await handler({ method: 'GET', query: { action: 'sync-delta' }, headers: {} }, res);
assert.equal(res.statusCode, 401);
assert.equal(res.payload.ok, false);

// 2. Combined payload: every module key present
res = createRes();
await handler(authedReq({ method: 'GET', query: { action: 'sync-delta' }, headers: { cookie: `axis_session=${encodeURIComponent(session)}` } }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
for (const key of ['daily', 'core', 'clipboard', 'nutrition', 'fitness', 'sleep', 'library', 'journal']) {
  assert.ok(key in res.payload, `missing key: ${key}`);
}
assert.ok(res.payload.daily && 'row' in res.payload.daily);
assert.ok(Array.isArray(res.payload.clipboard.rows));
assert.ok(Array.isArray(res.payload.library.rows));
assert.ok(Array.isArray(res.payload.journal.rows));
assert.ok(Array.isArray(res.payload.core.todos));
assert.ok('ladder' in res.payload.core && 'milestones' in res.payload.core);
assert.ok('history' in res.payload.core && 'review' in res.payload.core);
assert.ok(res.payload.sleep && 'handoff' in res.payload.sleep);
assert.ok(!('errors' in res.payload), 'no module should fail on a healthy mock');

// 3. Partial failure isolation: clipboard dies → clipboard null, rest intact
failPatterns = ['clipboard_items'];
res = createRes();
await handler(authedReq({ method: 'GET', query: { action: 'sync-delta' }, headers: { cookie: `axis_session=${encodeURIComponent(session)}` } }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
assert.equal(res.payload.clipboard, null);
assert.ok(res.payload.errors && typeof res.payload.errors.clipboard === 'string');
assert.ok(res.payload.daily && 'row' in res.payload.daily);
assert.ok(Array.isArray(res.payload.core.todos));
failPatterns = [];

// 4. Legacy GET path unchanged
res = createRes();
await handler(authedReq({ method: 'GET', query: {}, headers: { cookie: `axis_session=${encodeURIComponent(session)}` } }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
assert.ok(Array.isArray(res.payload.todos));
assert.ok('history' in res.payload);

console.log('sync-delta-tests-ok');
