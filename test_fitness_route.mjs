// AXIS // /api/fitness route tests
// Covers the webpage path: GET feed (what fitness.js consumes), POST log
// (write session), and the empty-payload guard. Supabase is mocked at the
// fetch layer; every write call is recorded for assertions.
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const calls = [];

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  let body = [];
  if (method === 'POST' && /fitness_sessions(\?|$)/.test(u)) {
    let posted = {};
    try { posted = JSON.parse(options.body); } catch {}
    body = [{ id: 'sess-mock-1', split_name: posted.split_name || 'Tracked Session', logged_at: posted.logged_at || new Date().toISOString() }];
  } else if (method === 'POST' && /fitness_sets(\?|$)/.test(u)) {
    let posted = [];
    try { posted = JSON.parse(options.body); } catch {}
    const arr = Array.isArray(posted) ? posted : [posted];
    body = arr.map((row, i) => ({ id: `set-mock-${i}`, ...row }));
  } else if (method === 'POST' || method === 'PATCH') {
    body = [{}];
  }
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null }
  };
};

const { default: handler } = await import('./api/fitness.js');
const { createSessionToken } = await import('./lib/axisAuth.js');
const session = createSessionToken();

function authed(method, body = null) {
  return {
    method,
    query: {},
    headers: { cookie: `axis_session=${encodeURIComponent(session)}` },
    body
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
await handler({ method: 'GET', query: {}, headers: {} }, res);
assert.equal(res.statusCode, 401);

// 2. GET feed: shape the webpage consumes
res = createRes();
await handler(authed('GET'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
assert.ok(Array.isArray(res.payload.recentArchives), 'recentArchives must be an array');
assert.ok(Array.isArray(res.payload.exerciseMemory), 'exerciseMemory must be an array');

// 3. POST log: writes session + sets, returns counts
calls.length = 0;
res = createRes();
await handler(authed('POST', {
  splitName: '',
  exercises: [
    { exercise: 'Incline Barbell Bench Press', sets: [{ weight: 80, reps: 8 }, { weight: 75, reps: 9 }] },
    { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 90, reps: 10 }] }
  ]
}), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
assert.equal(res.payload.exerciseCount, 2);
assert.equal(res.payload.setCount, 3);
assert.ok(res.payload.splitName, 'splitName must be returned');
assert.ok(calls.some(c => c.method === 'POST' && /fitness_sessions(\?|$)/.test(c.url)), 'session insert never happened');
const setsInsert = calls.find(c => c.method === 'POST' && /fitness_sets(\?|$)/.test(c.url));
assert.ok(setsInsert, 'sets insert never happened');
assert.equal(JSON.parse(setsInsert.options.body).length, 3, 'all three sets must be written');
assert.ok(calls.some(c => c.url.includes('daily_debrief_logs')), 'daily telemetry was not updated');

// 4. Empty payload guard → 400, no writes
calls.length = 0;
res = createRes();
await handler(authed('POST', { exercises: [] }), res);
assert.equal(res.statusCode, 400);
assert.equal(res.payload.ok, false);
assert.ok(!calls.some(c => c.method === 'POST'), 'no writes allowed on empty payload');

console.log('fitness-route-tests-ok');
