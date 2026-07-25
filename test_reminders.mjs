// test_reminders.mjs — pure-logic tests for lib/remindersServer.js +
// behavioural test of the long-poll loop in api/daily.js using an in-memory
// fake Supabase client.
//
// Run:  node test_reminders.mjs

import assert from 'assert/strict';
import {
  sanitizeReminderCreate,
  findDueReminders,
  REMINDERS_MAX_TITLE,
  REMINDERS_MAX_BODY
} from './lib/remindersServer.js';

let passed = 0, failed = 0;
function ok(label) { console.log('  PASS:', label); passed++; }
function fail(label, e) { console.log('  FAIL:', label, '-', e.message || e); failed++; console.log(e.stack); }

async function test(name, fn) {
  console.log('\n' + name);
  try { await fn(); ok(name); }
  catch (e) { fail(name, e); }
}

// ----- Pure logic: sanitizeReminderCreate -----

await test('rejects empty body object', async () => {
  const r = sanitizeReminderCreate({});
  assert.equal(r.error, 'TITLE REQUIRED');
});

await test('rejects null', async () => {
  const r = sanitizeReminderCreate(null);
  // null fails the typeof check first, so it returns BAD REQUEST
  assert.ok(r.error === 'BAD REQUEST' || r.error === 'TITLE REQUIRED');
});

await test('rejects missing title', async () => {
  const r = sanitizeReminderCreate({ fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, 'TITLE REQUIRED');
});

await test('rejects whitespace-only title', async () => {
  const r = sanitizeReminderCreate({ title: '   ', fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, 'TITLE REQUIRED');
});

await test('rejects missing fire_at', async () => {
  const r = sanitizeReminderCreate({ title: 'x' });
  assert.equal(r.error, 'FIRE_AT REQUIRED (ISO timestamp)');
});

await test('rejects invalid fire_at', async () => {
  const r = sanitizeReminderCreate({ title: 'x', fire_at: 'tomorrow' });
  assert.equal(r.error, 'FIRE_AT INVALID');
});

await test('rejects fire_at in the past', async () => {
  const r = sanitizeReminderCreate({ title: 'x', fire_at: new Date(Date.now() - 600000).toISOString() });
  assert.equal(r.error, 'FIRE_AT IN THE PAST');
});

await test('accepts fire_at 1 minute in the past (clock skew)', async () => {
  const r = sanitizeReminderCreate({ title: 'x', fire_at: new Date(Date.now() - 30000).toISOString() });
  assert.equal(r.error, undefined);
  assert.ok(r.fire_at);
});

await test('rejects title over ' + REMINDERS_MAX_TITLE + ' chars', async () => {
  const r = sanitizeReminderCreate({ title: 'x'.repeat(REMINDERS_MAX_TITLE + 1), fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, 'TITLE TOO LONG');
});

await test('accepts title at exactly the limit', async () => {
  const r = sanitizeReminderCreate({ title: 'x'.repeat(REMINDERS_MAX_TITLE), fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, undefined);
});

await test('truncates body to ' + REMINDERS_MAX_BODY + ' chars', async () => {
  const r = sanitizeReminderCreate({ title: 't', body: 'y'.repeat(REMINDERS_MAX_BODY + 100), fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, undefined);
  assert.equal(r.body.length, REMINDERS_MAX_BODY);
});

await test('accepts no body', async () => {
  const r = sanitizeReminderCreate({ title: 't', fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, undefined);
  assert.equal(r.body, '');
});

await test('trims title whitespace', async () => {
  const r = sanitizeReminderCreate({ title: '  hello  ', fire_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(r.error, undefined);
  assert.equal(r.title, 'hello');
});

await test('returns ISO fire_at', async () => {
  const r = sanitizeReminderCreate({ title: 't', fire_at: '2030-01-01T00:00:00.000Z' });
  assert.equal(r.error, undefined);
  assert.equal(r.fire_at, '2030-01-01T00:00:00.000Z');
});

// ----- Pure logic: findDueReminders -----

await test('returns only pending reminders whose fire_at has passed', async () => {
  const now = Date.now();
  const list = [
    { id: 1, status: 'pending', fire_at: new Date(now - 10000).toISOString() },
    { id: 2, status: 'pending', fire_at: new Date(now + 60000).toISOString() },  // future
    { id: 3, status: 'delivered', fire_at: new Date(now - 10000).toISOString() }, // already delivered
    { id: 4, status: 'pending', fire_at: new Date(now - 1).toISOString() }
  ];
  const due = findDueReminders(list);
  assert.equal(due.length, 2);
  assert.deepEqual(due.map(r => r.id), [1, 4]);
});

await test('respects `since` filter', async () => {
  const now = Date.now();
  const since = new Date(now - 5000).toISOString();
  const list = [
    { id: 1, status: 'pending', fire_at: new Date(now - 10000).toISOString() },  // older than since
    { id: 2, status: 'pending', fire_at: new Date(now - 1000).toISOString() }   // newer than since
  ];
  const due = findDueReminders(list, since);
  assert.equal(due.length, 1);
  assert.equal(due[0].id, 2);
});

await test('returns empty when no reminders are due', async () => {
  const list = [
    { id: 1, status: 'pending', fire_at: new Date(Date.now() + 60000).toISOString() }
  ];
  assert.equal(findDueReminders(list).length, 0);
});

await test('handles empty list', async () => {
  assert.equal(findDueReminders([]).length, 0);
});

// ----- Behavioural test: long-poll loop with in-memory Supabase -----
// We can't easily mock @supabase/supabase-js in ESM context. Instead, we
// test the *contract* of the long-poll by directly exercising the helpers
// (findDueReminders) in the same shape the loop uses, then a single
// end-to-end test of the HTTP handler using a fake module replacement
// via a runtime loader hook.

await test('long-poll contract: tick -> check -> return when due', async () => {
  // Simulate the loop body
  const memDb = [];
  const startTime = Date.now();
  // Inject a "now due" reminder
  memDb.push({ id: 1, status: 'pending', fire_at: new Date(startTime - 100).toISOString() });

  let deadline = startTime + 3000; // 3s window
  let found = null;
  while (Date.now() < deadline && !found) {
    const due = findDueReminders(memDb);
    if (due.length) { found = due; break; }
    await new Promise(r => setTimeout(r, 50));
  }
  assert.ok(found, 'should have found the due reminder within 3s');
  assert.equal(found[0].id, 1);
});

await test('long-poll contract: times out when nothing is due', async () => {
  const memDb = [{ id: 1, status: 'pending', fire_at: new Date(Date.now() + 60000).toISOString() }];
  const startTime = Date.now();
  const deadline = startTime + 1000; // 1s window

  let found = null;
  while (Date.now() < deadline && !found) {
    const due = findDueReminders(memDb);
    if (due.length) { found = due; break; }
    await new Promise(r => setTimeout(r, 50));
  }
  assert.equal(found, null);
  // We should have waited close to 1s, not 0
  assert.ok(Date.now() - startTime >= 950, 'should have waited the full timeout');
});

// ----- End-to-end HTTP test using a real local server with a fake Supabase backend -----
// We spin up a tiny Node http server that intercepts calls that *would* go to
// Supabase and replaces them with an in-memory store. This is a real network
// round-trip; it verifies the request/response shape.

console.log('\n[end-to-end] starting local server with in-memory reminders store...');
import http from 'http';
import crypto from 'crypto';

const memReminders = [];
let nextId = 1000;
const PORT = 8767;

function makeCookie() {
  const encoded = Buffer.from(JSON.stringify({ axis: true, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'axis-dev-session-secret-change-me').update(encoded).digest('base64url');
  return `axis_session=${encoded}.${sig}`;
}

const supabaseServer = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let payload = null;
    try { payload = body ? JSON.parse(body) : null; } catch {}

    // PostgREST-style: /rest/v1/reminders
    if (url === '/rest/v1/reminders' && req.method === 'POST') {
      const id = nextId++;
      const row = { id, user_id: payload.user_id || 'axis', title: payload.title, body: payload.body, fire_at: payload.fire_at, status: payload.status || 'pending', created_at: new Date().toISOString(), delivered_at: payload.delivered_at || null };
      memReminders.push(row);
      // .single() in supabase-js sets Accept: application/vnd.pgrst.object+json.
      // PostgREST then returns a single object instead of an array.
      const accept = req.headers['accept'] || '';
      const wantSingle = accept.includes('vnd.pgrst.object');
      res.writeHead(201, { 'Content-Type': wantSingle ? 'application/vnd.pgrst.object+json' : 'application/json' });
      res.end(JSON.stringify(wantSingle ? row : [row]));
      return;
    }

    if (url.startsWith('/rest/v1/reminders') && req.method === 'GET') {
      // Apply simple query parsing
      const q = req.url.split('?')[1] || '';
      const params = new URLSearchParams(q);
      let rows = memReminders.slice();
      // user_id eq
      const userMatch = params.get('user_id')?.match(/^eq\.(.+)$/);
      if (userMatch) rows = rows.filter(r => r.user_id === userMatch[1]);
      // status eq
      const statusMatch = params.get('status')?.match(/^eq\.(.+)$/);
      if (statusMatch) rows = rows.filter(r => r.status === statusMatch[1]);
      // fire_at lte
      const fireAtLte = params.get('fire_at')?.match(/^lte\.(.+)$/);
      if (fireAtLte) {
        const t = new Date(fireAtLte[1]).getTime();
        rows = rows.filter(r => new Date(r.fire_at).getTime() <= t);
      }
      // order
      const order = params.get('order');
      if (order) {
        const [col, dir] = order.split('.');
        rows.sort((a, b) => {
          if (a[col] < b[col]) return dir === 'desc' ? 1 : -1;
          if (a[col] > b[col]) return dir === 'desc' ? -1 : 1;
          return 0;
        });
      }
      // limit
      const limit = params.get('limit')?.match(/^(\d+)$/);
      if (limit) rows = rows.slice(0, parseInt(limit[1]));
      // .single() in supabase-js sets Accept: application/vnd.pgrst.object+json.
      // PostgREST then returns a single object instead of an array.
      const accept = req.headers['accept'] || '';
      const wantSingle = accept.includes('vnd.pgrst.object');
      if (wantSingle && rows.length >= 1) {
        res.writeHead(200, { 'Content-Type': 'application/vnd.pgrst.object+json' });
        res.end(JSON.stringify(rows[0]));
      } else if (wantSingle) {
        // No rows — return null with the right content type
        res.writeHead(200, { 'Content-Type': 'application/vnd.pgrst.object+json' });
        res.end('null');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
      }
      return;
    }

    if (url.startsWith('/rest/v1/reminders') && req.method === 'PATCH') {
      // Filter rows, apply update
      const q = req.url.split('?')[1] || '';
      const params = new URLSearchParams(q);
      let rows = memReminders.slice();
      const userMatch = params.get('user_id')?.match(/^eq\.(.+)$/);
      if (userMatch) rows = rows.filter(r => r.user_id === userMatch[1]);
      const idMatch = params.get('id')?.match(/^eq\.(\d+)$/);
      if (idMatch) rows = rows.filter(r => r.id === parseInt(idMatch[1]));
      const inMatch = params.get('status')?.match(/^in\.\((.+)\)$/);
      if (inMatch) {
        const vals = inMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rows = rows.filter(r => vals.includes(r.status));
      }
      for (const r of rows) Object.assign(r, payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
});

await new Promise(r => supabaseServer.listen(PORT, r));
process.env.SUPABASE_URL = `http://localhost:${PORT}`;
process.env.SUPABASE_SECRET_KEY = 'mock-key';

// Now import the handler — its getSupabase() will hit our fake server
const path = await import('path');
const { pathToFileURL } = await import('url');
const { fileURLToPath } = await import('url');
const __filename = fileURLToPath(import.meta.url);
const dailyUrl = pathToFileURL(path.join(path.dirname(__filename), 'api', 'daily.js')).href;

// Provide a real WebSocket constructor via the `ws` package (Node 20 lacks
// native WebSocket, which makes @supabase/supabase-js's constructor throw).
import ws from 'ws';
globalThis.WebSocket = ws;

const { default: handler } = await import(dailyUrl);

function mockReq({ method, url, body, query }) {
  const u = new URL(url, 'http://localhost');
  const req = {
    method,
    url: u.pathname + u.search,
    query: query || Object.fromEntries(u.searchParams),
    body,
    headers: { cookie: makeCookie() },
    on() { return req; }  // No-op for the 'close' listener the long-poll uses
  };
  return req;
}
function mockRes() {
  const res = {
    statusCode: 200, headers: {}, body: null,
    status(c) { res.statusCode = c; return res; },
    json(b) { res.body = b; return res; },
    setHeader() { return res; },
    on() { return res; }
  };
  return res;
}

await test('[e2e] auth: rejects unauthenticated request', async () => {
  const req = mockReq({ method: 'GET', url: '/api/daily?ns=reminders&action=pending', query: { ns: 'reminders', action: 'pending' } });
  const res = mockRes();
  // Override headers to drop cookie
  req.headers = {};
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

await test('[e2e] create then list pending', async () => {
  // Clear DB
  while (memReminders.length) memReminders.pop();
  // Create one in the future
  const fireAt = new Date(Date.now() + 60000).toISOString();
  let req = mockReq({ method: 'POST', url: '/api/daily?ns=reminders', body: { ns: 'reminders', action: 'create', title: 'Test', body: 'body', fire_at: fireAt } });
  let res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.reminder.title, 'Test');
  const createdId = res.body.reminder.id;

  // List pending
  req = mockReq({ method: 'GET', url: '/api/daily?ns=reminders&action=pending', query: { ns: 'reminders', action: 'pending' } });
  res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.reminders.find(r => r.id === createdId));
});

await test('[e2e] long-poll returns due reminder quickly', async () => {
  // Clear and add a due reminder
  while (memReminders.length) memReminders.pop();
  memReminders.push({ id: 2000, user_id: 'axis', title: 'Due now', body: 'urgent', fire_at: new Date(Date.now() - 1000).toISOString(), status: 'pending', created_at: new Date().toISOString(), delivered_at: null });

  const t0 = Date.now();
  const req = mockReq({ method: 'GET', url: '/api/daily?ns=reminders&action=wait&timeout=10', query: { ns: 'reminders', action: 'wait', timeout: '10' } });
  const res = mockRes();
  await handler(req, res);
  const elapsed = Date.now() - t0;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.timed_out, false);
  assert.ok(res.body.reminders.length >= 1);
  assert.equal(res.body.reminders.find(r => r.id === 2000).id, 2000);
  assert.ok(elapsed < 2000, 'expected fast return, got ' + elapsed + 'ms');
  // And the reminder should be marked delivered
  const r = memReminders.find(x => x.id === 2000);
  assert.equal(r.status, 'delivered');
});

await test('[e2e] long-poll times out when nothing is due', async () => {
  while (memReminders.length) memReminders.pop();
  const t0 = Date.now();
  const req = mockReq({ method: 'GET', url: '/api/daily?ns=reminders&action=wait&timeout=4', query: { ns: 'reminders', action: 'wait', timeout: '4' } });
  const res = mockRes();
  await handler(req, res);
  const elapsed = Date.now() - t0;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.timed_out, true);
  assert.equal(res.body.reminders.length, 0);
  // 4s wait plus a one-time supabase REST cold-start budget (~1-2s for the
  // first call into a new client). Generous upper bound for the test env.
  assert.ok(elapsed >= 3500, 'expected at least 3.5s, got ' + elapsed + 'ms');
  assert.ok(elapsed < 8000, 'expected under 8s, got ' + elapsed + 'ms');
});

await test('[e2e] ack marks a reminder as delivered', async () => {
  memReminders.length = 0;
  memReminders.push({ id: 3000, user_id: 'axis', title: 'pending', body: '', fire_at: new Date(Date.now() + 60000).toISOString(), status: 'pending', created_at: new Date().toISOString(), delivered_at: null });
  const req = mockReq({ method: 'POST', url: '/api/daily?ns=reminders', body: { ns: 'reminders', action: 'ack', reminder_id: 3000 } });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  const r = memReminders.find(x => x.id === 3000);
  assert.equal(r.status, 'delivered');
});

await test('[e2e] long-poll `since` filter skips already-fired reminders', async () => {
  memReminders.length = 0;
  const tenSecAgo = new Date(Date.now() - 10000).toISOString();
  memReminders.push({ id: 4000, user_id: 'axis', title: 'old', body: '', fire_at: tenSecAgo, status: 'pending', created_at: tenSecAgo, delivered_at: null });

  const since = new Date(Date.now() - 5000).toISOString();
  const t0 = Date.now();
  const req = mockReq({ method: 'GET', url: `/api/daily?ns=reminders&action=wait&timeout=4&since=${encodeURIComponent(since)}`, query: { ns: 'reminders', action: 'wait', timeout: '4', since } });
  const res = mockRes();
  await handler(req, res);
  const elapsed = Date.now() - t0;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.timed_out, true, 'should have timed out, not returned the old reminder');
  assert.equal(res.body.reminders.length, 0);
  assert.ok(elapsed >= 3500);
});

supabaseServer.close();

// ----- Summary -----
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
