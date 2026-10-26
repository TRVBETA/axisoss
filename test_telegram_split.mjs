// AXIS // v64 Arnold rotation: bot asks the day once, then auto-advances
// after every logged session. State = commander_profile.split_day.
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.AXIS_MASTER_CHAT_ID = '111';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
delete process.env.GROQ_API_KEY;

const calls = [];
const sentMessages = [];
const editedMessages = [];
const profileRow = { id: 'axis_actual', split_day: null };

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  if (u.includes('/sendMessage')) {
    sentMessages.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => 'ok' };
  }
  if (u.includes('/editMessageText')) {
    editedMessages.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => 'ok' };
  }
  if (u.includes('api.telegram.org')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => 'ok' };
  }
  if (/commander_profile/.test(u)) {
    if (method === 'GET') {
      const body = [{ id: profileRow.id, split_day: profileRow.split_day }];
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
    }
    let posted = {};
    try { posted = JSON.parse(options.body); } catch {}
    if (posted.split_day !== undefined) profileRow.split_day = posted.split_day;
    const body = [{ ...profileRow }];
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
  }
  if (method === 'POST' && /fitness_sessions(\?|$)/.test(u)) {
    let posted = {};
    try { posted = JSON.parse(options.body); } catch {}
    const body = [{ id: 'sess-1', split_name: posted.split_name, logged_at: posted.logged_at || new Date().toISOString() }];
    return { ok: true, status: 201, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
  }
  if (method === 'POST' && /fitness_sets(\?|$)/.test(u)) {
    const arr = JSON.parse(options.body);
    const body = (Array.isArray(arr) ? arr : [arr]).map((r, i) => ({ id: `set-${i}`, ...r }));
    return { ok: true, status: 201, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
  }
  const body = [{}];
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
};

const { default: handler } = await import('./api/telegram.js');
const { ARNOLD_SPLIT_ORDER, nextArnoldSplit } = await import('./lib/fitnessServer.js');

function createRes() {
  return { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
}
const post = (body) => { const res = createRes(); return handler({ method: 'POST', body }, res).then(() => res); };

// rotation math
assert.deepEqual(ARNOLD_SPLIT_ORDER, ['Shoulders + Arms', 'Chest + Back', 'Legs']);
assert.equal(nextArnoldSplit('Shoulders + Arms'), 'Chest + Back');
assert.equal(nextArnoldSplit('Chest + Back'), 'Legs');
assert.equal(nextArnoldSplit('Legs'), 'Shoulders + Arms');
assert.equal(nextArnoldSplit('nonsense'), 'Shoulders + Arms');

// 1) first ever /log → asked which day, with the 3 picker buttons
let res = await post({ update_id: 700001, message: { chat: { id: 111 }, text: '/log' } });
assert.equal(res.payload.status, 'SPLIT_DAY_ASKED');
let msg = sentMessages.at(-1);
assert.ok(msg.text.includes('ARNOLD ROTATION'), 'ask message missing');
const picker = msg.reply_markup.inline_keyboard.flat().map(b => b.callback_data).filter(d => d.startsWith('splitday:set:'));
assert.equal(picker.length, 3, `expected 3 day buttons, got ${picker.length}`);

// 2) tap "Shoulders + Arms" → state written, locked message shown
res = await post({
  update_id: 700002,
  callback_query: { id: 'cb1', data: `splitday:set:${encodeURIComponent('Shoulders + Arms')}`, message: { chat: { id: 111 }, message_id: 9 } }
});
assert.equal(profileRow.split_day, 'Shoulders + Arms', 'state not persisted');
let edited = editedMessages.at(-1);
assert.ok(edited.text.includes('ROTATION LOCKED // TODAY: SHOULDERS + ARMS'), edited.text);
assert.ok(edited.text.includes('• Machine Shoulder Press'), 'locked message should list today exercises');

// 3) /log again → no ask; prompt carries TODAY'S SPLIT + exercise list
res = await post({ update_id: 700003, message: { chat: { id: 111 }, text: '/log' } });
assert.equal(res.payload.status, 'WORKOUT_PROMPT_SENT');
msg = sentMessages.at(-1);
assert.ok(msg.text.includes("TODAY'S SPLIT: SHOULDERS + ARMS"), msg.text);
assert.ok(msg.text.includes('• Overhead Cable Extensions'));

// 4) log the session → rotation advances to Chest + Back, confirmation shows it
res = await post({ update_id: 700004, message: { chat: { id: 111 }, text: 'Machine Shoulder Press 60x8 55x8\nHammer Curls 20x10' } });
assert.equal(res.payload.status, 'FITNESS_SYNCED');
assert.equal(res.payload.rotationNext, 'Chest + Back');
assert.equal(profileRow.split_day, 'Chest + Back', 'rotation did not auto-advance');
msg = sentMessages.at(-1);
assert.ok(msg.text.includes('NEXT SPLIT: CHEST + BACK'), msg.text);
assert.ok(msg.text.includes('• Incline Barbell Bench Press'), 'next-day exercises missing');

// 5) /split all shows the rotation header
res = await post({ update_id: 700005, message: { chat: { id: 111 }, text: '/split all' } });
assert.equal(res.payload.status, 'SPLIT_SENT');
assert.ok(sentMessages.at(-1).text.includes('ROTATION // TODAY: CHEST + BACK · NEXT: LEGS'));

// 6) menu:splitday callback re-opens the picker (change day anytime)
res = await post({ update_id: 700006, callback_query: { id: 'cb2', data: 'menu:splitday', message: { chat: { id: 111 }, message_id: 10 } } });
assert.equal(res.payload.status, 'CALLBACK_HANDLED');
assert.ok(editedMessages.at(-1).text.includes('ARNOLD ROTATION // SET TODAY'));

// 7) a workout that matches no Arnold split never touches rotation
profileRow.split_day = 'Legs';
res = await post({ update_id: 700007, message: { chat: { id: 111 }, text: 'Zebra Jumps 10x5' } });
assert.equal(res.payload.status, 'FITNESS_SYNCED');
assert.equal(res.payload.rotationNext, null);
assert.equal(profileRow.split_day, 'Legs', 'unknown split must not mutate rotation state');

console.log('telegram-split-tests-ok');
