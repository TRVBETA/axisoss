// AXIS // Telegram forgiveness layer tests (6.zip)
// Covers the 4 weaknesses found in the 28-message adversarial bot audit:
//   1. unknown/junk exercise names -> Groq AI pass normalizes to canonical
//   2. two exercises fused on one line -> AI split trigger
//   3. "yesterday ..." -> session backdated instead of silently logged today
//   4. "80 x 8 reps x3" -> set-count suffix parsed locally (3 sets written)
// Plus local "and"-splitting and the new Groq trigger helpers.
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.AXIS_MASTER_CHAT_ID = '111';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.GROQ_API_KEY = 'test-groq-key'; // AI layer ON for this file

const calls = [];

// Queue of canned Groq responses; each groq call shifts the next one.
const groqQueue = [];

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  if (u.includes('api.groq.com')) {
    const content = groqQueue.length ? groqQueue.shift() : '{"exercises":[]}';
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => content
    };
  }
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
const { parseWorkoutText } = await import('./lib/fitnessServer.js');
const { shouldAttemptGroqFallback, hasUnknownExerciseNames, hasFusedExerciseLines } = await import('./lib/groqWorkoutParser.js');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };
}

function webhook(text, chatId = 111) {
  return { method: 'POST', query: {}, headers: {}, body: { message: { chat: { id: chatId }, text } } };
}

function lastTelegramReply() {
  const hit = [...calls].reverse().find(c => c.url.includes('sendMessage') && c.method === 'POST');
  if (!hit) return '';
  try { return String(JSON.parse(hit.options.body).text || ''); } catch { return ''; }
}

function postedSets() {
  const hit = calls.find(c => c.method === 'POST' && /fitness_sets(\?|$)/.test(c.url));
  return hit ? JSON.parse(hit.options.body) : null;
}

function postedSession() {
  const hit = calls.find(c => c.method === 'POST' && /fitness_sessions(\?|$)/.test(c.url));
  return hit ? JSON.parse(hit.options.body) : null;
}

const groqCalls = () => calls.filter(c => c.url.includes('api.groq.com')).length;

// ─── Unit: new trigger helpers ───────────────────────────────────────────────
assert.equal(hasUnknownExerciseNames([{ exercise: 'Incline Barbell Bench Press' }]), false, 'canonical name must not count as unknown');
assert.equal(hasUnknownExerciseNames([{ exercise: 'bnch prss' }]), true, 'junk name must count as unknown');
assert.equal(hasFusedExerciseLines('incline 100x8, fly 30x12'), true, 'fused second exercise must be detected');
assert.equal(hasFusedExerciseLines('bench 100x8 rows 80x10'), true, 'un-punctuated fusion must be detected');
assert.equal(hasFusedExerciseLines('incline 80x8 75x9'), false, 'normal line must not look fused');
assert.equal(hasFusedExerciseLines('incline 80 for 8'), false, '"80 for 8" must not look fused');
assert.equal(hasFusedExerciseLines('incline 100kg 5 reps'), false, '"100kg 5 reps" must not look fused');
assert.equal(hasFusedExerciseLines('incline 80 x 8 reps x3'), false, 'set-count suffix must not look fused');
assert.equal(shouldAttemptGroqFallback('incline 80x8', parseWorkoutText('incline 80x8')), false, 'clean canonical parse must skip Groq');
assert.equal(shouldAttemptGroqFallback('bnch prss 100x8', parseWorkoutText('bnch prss 100x8')), true, 'junk name must trigger Groq');
assert.equal(shouldAttemptGroqFallback('hello how are you', []), true, 'empty parse must trigger Groq');

// ─── Unit: local parser hardening ────────────────────────────────────────────
// weakness #4: "reps x3" suffix previously wrote only 1 of 3 sets
let triple = parseWorkoutText('incline 80 x 8 reps x3');
assert.equal(triple.length, 1, 'expected one exercise from "80 x 8 reps x3"');
assert.equal(triple[0].sets.length, 3, `"80 x 8 reps x3" should write 3 sets, got ${triple[0].sets.length}`);
assert.equal(triple[0].sets.filter(s => s.weight === 80 && s.reps === 8).length, 3, 'all 3 triple-suffix sets must be 80x8');

// weakness #2 (local half): "X and Y" on one line previously merged into one exercise
let andSplit = parseWorkoutText('incline 100x8 and seated row 80x10');
assert.equal(andSplit.length, 2, `"and"-joined line should split into 2 exercises, got ${andSplit.length}`);
assert.equal(andSplit[0].exercise, 'Incline Barbell Bench Press');
assert.equal(andSplit[1].exercise, 'Seated Wide-Grip Row');
assert.deepEqual(andSplit[0].sets.map(s => `${s.weight}x${s.reps}`), ['100x8']);
assert.deepEqual(andSplit[1].sets.map(s => `${s.weight}x${s.reps}`), ['80x10']);

// ─── Webhook: weakness #3 — "yesterday" backdates the session ────────────────
calls.length = 0;
let res = createRes();
await handler(webhook('yesterday incline 80x8'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'FITNESS_SYNCED');
assert.equal(res.payload.backdated, true, 'webhook must report the backdate');
const expectedDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const sess1 = postedSession();
assert.ok(sess1.logged_at.startsWith(expectedDate), `session must be logged on ${expectedDate}, got ${sess1.logged_at}`);
assert.ok(lastTelegramReply().includes('BACKDATED'), 'confirmation must flag the backdate');
assert.equal(groqCalls(), 0, 'clean canonical parse must not burn a Groq call');

// ─── Webhook: weakness #1 — junk name normalized by Groq ────────────────────
calls.length = 0;
groqQueue.length = 0;
groqQueue.push('{"exercises":[{"exercise":"Incline Barbell Bench Press","sets":[{"weight":100,"reps":8}]}]}');
res = createRes();
await handler(webhook('bnch prss 100x8'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'FITNESS_SYNCED');
assert.equal(groqCalls(), 1, 'junk name must spend exactly one Groq call');
const sets1 = postedSets();
assert.equal(sets1.length, 1);
assert.equal(sets1[0].exercise_name, 'Incline Barbell Bench Press', `junk name must be normalized, got "${sets1[0].exercise_name}"`);
assert.ok(lastTelegramReply().includes('PARSER: GROQ'), 'confirmation must show GROQ parser');

// ─── Webhook: weakness #2 (AI half) — fused line split by Groq ───────────────
calls.length = 0;
groqQueue.length = 0;
groqQueue.push('{"exercises":[{"exercise":"Incline Barbell Bench Press","sets":[{"weight":100,"reps":8}]},{"exercise":"Upper/Mid Cable Fly","sets":[{"weight":30,"reps":12}]}]}');
res = createRes();
await handler(webhook('incline 100x8, fly 30x12'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'FITNESS_SYNCED');
assert.equal(groqCalls(), 1, 'fused line must spend exactly one Groq call');
const sets2 = postedSets();
const names2 = [...new Set(sets2.map(s => s.exercise_name))];
assert.deepEqual(names2.sort(), ['Incline Barbell Bench Press', 'Upper/Mid Cable Fly'].sort(), `fused line must become two exercises, got ${names2}`);

// ─── Webhook: Groq down/429 -> local result still writes (no data loss) ──────
calls.length = 0;
groqQueue.length = 0;
const realFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url).includes('api.groq.com')) {
    return { ok: false, status: 429, text: async () => 'rate limited' };
  }
  return realFetch(url, options);
};
await import('./api/telegram.js'); // handler already imported; reuse
res = createRes();
await handler(webhook('bnch prss 100x8'), res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'FITNESS_SYNCED', 'Groq 429 must degrade gracefully to local parse');
const sets3 = postedSets();
assert.equal(sets3[0].exercise_name, 'bnch prss', 'without Groq the raw name is kept (pre-AI behavior)');
global.fetch = realFetch;

console.log('telegram-groq-layer: all tests passed');
