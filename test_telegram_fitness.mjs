// AXIS // Telegram → fitness webhook end-to-end tests
// A real workout text message hits the webhook handler; we assert the whole
// chain: parse → split inference → session + sets written to Supabase →
// confirmation sent back to Telegram. Supabase and Telegram are mocked at
// the fetch layer; every outbound call is recorded.
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.AXIS_MASTER_CHAT_ID = '111';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
delete process.env.GROQ_API_KEY; // deterministic: local parser only

const calls = [];

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  if (u.includes('api.telegram.org')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => 'ok' };
  }
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

const { default: handler } = await import('./api/telegram.js');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };
}

function webhook(text, chatId = 111) {
  return {
    method: 'POST',
    query: {},
    headers: {},
    body: { message: { chat: { id: chatId }, text } }
  };
}

// 1. Full workout log: parse → write → confirm
calls.length = 0;
let res = createRes();
await handler(webhook('Incline Bench 80x8 75x9\nWide Lat Pulldown 90x10 80x12'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'FITNESS_SYNCED');
const sessionInsert = calls.find(c => c.method === 'POST' && /fitness_sessions(\?|$)/.test(c.url));
assert.ok(sessionInsert, 'no fitness session was written');
const postedSession = JSON.parse(sessionInsert.options.body);
assert.ok(postedSession.split_name, 'session written without a split name');
const setsInsert = calls.find(c => c.method === 'POST' && /fitness_sets(\?|$)/.test(c.url));
assert.ok(setsInsert, 'no fitness sets were written');
const postedSets = JSON.parse(setsInsert.options.body);
assert.equal(postedSets.length, 4, `expected 4 sets written, got ${postedSets.length}`);
assert.equal(postedSets[0].session_id, 'sess-mock-1', 'sets must reference the created session');
const reply = calls.find(c => c.url.includes('sendMessage') && c.method === 'POST');
assert.ok(reply, 'no confirmation was sent back to Telegram');
const replyBody = JSON.parse(reply.options.body);
assert.ok(String(replyBody.text || '').length > 5, 'confirmation message was empty');
assert.ok(calls.some(c => c.url.includes('daily_debrief_logs')), 'daily telemetry (gym_logged) was not updated');

// 2. Stranger chat → denied, nothing written
calls.length = 0;
res = createRes();
await handler(webhook('Incline Bench 80x8 75x9', 999), res);
assert.equal(res.payload.status, 'UNAUTHORIZED');
assert.ok(!calls.some(c => /fitness_sessions|fitness_sets/.test(c.url)), 'stranger must not write fitness data');

// 3. Gibberish from owner → task-match fallback, NOT a workout write
calls.length = 0;
res = createRes();
await handler(webhook('hello how are you'), res);
assert.equal(res.statusCode, 200);
assert.ok(!calls.some(c => c.method === 'POST' && /fitness_sessions(\?|$)/.test(c.url)), 'gibberish must not create a workout session');

console.log('telegram-fitness-tests-ok');
