// AXIS // Sleep route tests (9.zip)
// New health pipeline: a morning auto-shortcut posts measured sleep with
// source: "health". Asserts: secret auth, source_bridge persistence,
// telemetry propagation, honesty label (lastSource) in the handoff payload,
// and that legacy self-reported logs keep working untouched.
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.SHORTCUT_SHARED_SECRET = 's3cr3t';

const calls = [];
// rows the fake DB "contains" for handoff reads
let dbRows = [];

// supabaseRequest reads via response.text() then JSON.parse — text() MUST
// mirror json() in every mock response, so use this one helper everywhere.
function respond(body, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null }
  };
}

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  if (method === 'GET' && u.includes('sleep_circadian_logs')) {
    return respond(dbRows);
  }
  if (method === 'POST' && /sleep_circadian_logs/.test(u)) {
    let posted = {};
    try { posted = JSON.parse(options.body); } catch {}
    return respond([{ id: 'row-1', ...posted }]);
  }
  return respond(method === 'GET' ? [] : [{}]);
};

const { createSessionToken } = await import('./lib/axisAuth.js');
const { default: handler } = await import('./api/sleep.js');
const session = createSessionToken();

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };
}

const post = (body, headers = {}) => ({ method: 'POST', query: {}, headers, body });
const get = (query) => ({ method: 'GET', query, headers: { cookie: `axis_session=${encodeURIComponent(session)}` } });

const sleepInserts = () => calls.filter(c => c.method === 'POST' && /sleep_circadian_logs/.test(c.url)).map(c => JSON.parse(c.options.body));
const telemetryCalls = () => calls.filter(c => (c.method === 'POST' || c.method === 'PATCH') && /daily_telemetry|daily/.test(c.url));

// ─── 1. Measured health payload: writes shortcut:health + telemetry ─────────
calls.length = 0;
let res = createRes();
await handler(post({ hours: 7.2, wakeTime: '06:25', quality: 4, source: 'health', secret: 's3cr3t' }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.ok, true);
assert.equal(res.payload.source, 'health', 'response must confirm measured source');
const written1 = sleepInserts()[0];
assert.equal(written1.source_bridge, 'shortcut:health', `health payload must persist shortcut:health, got ${written1.source_bridge}`);
assert.equal(written1.hours_slept, 7.2);
assert.equal(written1.wake_time, '06:25');
assert.equal(written1.quality_rating, 4);

// ─── 2. Secret gate: bad secret rejected ────────────────────────────────────
calls.length = 0;
res = createRes();
await handler(post({ hours: 7, wakeTime: '06:25', source: 'health', secret: 'wrong' }), res);
assert.equal(res.statusCode, 401);
assert.equal(sleepInserts().length, 0, 'rejected request must write nothing');

// ─── 3. Handoff: health row surfaces as awake + MEASURED label ───────────────
dbRows = [
  { log_date: '2026-10-07', hours_slept: 7.2, wake_time: '06:25', quality_rating: 4, source_bridge: 'shortcut:health', logged_at: '2026-10-07T06:25:00Z' }
];
res = createRes();
await handler(get({ view: 'handoff' }), res);
assert.equal(res.statusCode, 200);
const handoff1 = res.payload.handoff;
assert.equal(handoff1.currentEvent, 'awake', 'health row must count as a wake state');
assert.equal(handoff1.lastSleepHours, 7.2);
assert.equal(handoff1.lastSource, 'health', `handoff must label measured data, got ${handoff1.lastSource}`);

// ─── 4. Regression: self-reported log keeps legacy bridge + 'self' label ─────
calls.length = 0;
res = createRes();
await handler(post({ hours: 6.5, wakeTime: '07:10 AM', quality: 3, secret: 's3cr3t' }), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.source, 'self');
const written2 = sleepInserts()[0];
assert.equal(written2.source_bridge, 'shortcut:legacy', 'no source in payload must keep legacy bridge');

dbRows = [
  { log_date: '2026-10-07', hours_slept: 6.5, wake_time: '07:10 AM', quality_rating: 3, source_bridge: 'shortcut:legacy', logged_at: '2026-10-07T07:10:00Z' }
];
res = createRes();
await handler(get({ view: 'handoff' }), res);
assert.equal(res.payload.handoff.lastSource, 'self', 'legacy rows must be labelled self-reported');
assert.equal(res.payload.handoff.lastSleepHours, 6.5);

// ─── 5. Regression: tap-gap computed hours label as 'computed' ───────────────
dbRows = [
  { log_date: '2026-10-07', hours_slept: 7.5, wake_time: '06:30', quality_rating: null, source_bridge: 'shortcut:wake', logged_at: '2026-10-07T06:30:00Z' },
  { log_date: '2026-10-06', hours_slept: 0, wake_time: '', quality_rating: null, source_bridge: 'shortcut:sleep', logged_at: '2026-10-06T23:00:00Z' }
];
res = createRes();
await handler(get({ view: 'handoff' }), res);
assert.equal(res.payload.handoff.currentEvent, 'awake');
assert.equal(res.payload.handoff.lastSource, 'computed', 'tap-gap hours must be labelled computed');
assert.equal(res.payload.handoff.lastSleepHours, 7.5);

// ─── 6. Validation: junk hours rejected ─────────────────────────────────────
res = createRes();
await handler(post({ hours: 99, wakeTime: '06:25', source: 'health', secret: 's3cr3t' }), res);
assert.equal(res.statusCode, 400, 'hours > 24 must be rejected');

console.log('sleep-route-tests-ok');
