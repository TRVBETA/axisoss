import assert from 'assert/strict';
import {
  sanitizeReminderCreate,
  findDueReminders,
  normalizeRepeatInterval,
  rescheduleDueReminder,
  buildRescheduledReminder,
  sweepKindsDue,
  buildSweepReminder,
  telegramChannelEnabled,
  buildTelegramSendPayload,
  buildTelegramReminderMessage
} from './lib/remindersServer.js';

let passed = 0, failed = 0;
function ok(label) { console.log('  PASS:', label); passed++; }
function fail(label, e) { console.log('  FAIL:', label, '-', e.message || e); failed++; }

async function test(name, fn) {
  console.log('\n' + name);
  try { await fn(); ok(name); }
  catch (e) { fail(name, e); }
}

// Recurrence
await test('normalizeRepeatInterval accepts daily/hourly/weekly', () => {
  assert.equal(normalizeRepeatInterval('DAILY'), 'daily');
  assert.equal(normalizeRepeatInterval('Hourly'), 'hourly');
  assert.equal(normalizeRepeatInterval('garbage'), '');
  assert.equal(normalizeRepeatInterval(''), '');
});

await test('daily re-fire lands next calendar day at same time-of-day', () => {
  const now = Date.now();
  // 14:00 UTC on some day
  const d = new Date(now);
  d.setUTCHours(14, 0, 0, 0);
  const fired = d.toISOString();
  const next = rescheduleDueReminder(fired, 'daily', now);
  const nd = new Date(next);
  assert.equal(nd.getUTCHours(), 14);
  assert.equal(nd.getUTCMinutes(), 0);
  assert.ok(nd.getTime() > now);
});

await test('hourly re-fire is +1h from previous fire', () => {
  const now = Date.now();
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  const fired = d.toISOString();
  const next = rescheduleDueReminder(fired, 'hourly', now);
  assert.equal(new Date(next).getTime() - new Date(fired).getTime(), 3600000);
});

await test('buildRescheduledReminder returns null for one-shot reminders', () => {
  assert.equal(buildRescheduledReminder(new Date().toISOString(), { repeat_interval: '' }), null);
  assert.equal(buildRescheduledReminder(new Date().toISOString(), {}), null);
});

await test('buildRescheduledReminder preserves title/body for daily', () => {
  const now = Date.now();
  const d = new Date(now);
  d.setUTCHours(14, 0, 0, 0);
  const r = buildRescheduledReminder(d.toISOString(), { title: 'X', body: 'Y', repeat_interval: 'daily' }, now);
  assert.ok(r);
  assert.equal(r.title, 'X');
  assert.equal(r.body, 'Y');
  assert.equal(r.repeat_interval, 'daily');
  assert.equal(r.status, 'pending');
});

// Sweep
// sweepKindsDue gates on AFRICA/CAIRO wall-clock, not UTC. To build a test
// input we scan UTC timestamps until the Cairo-local hour matches the target
// we want — that way the tests stay correct across DST changes instead of
// hardcoding a +2 or +3 offset.
function cairoMsForLocalHour(targetHour) {
  // Scan ±12h so ANY hour is reachable regardless of the current time —
  // with only ±6h some hours fall outside the window (e.g. hour 10 when
  // it is already 02:00 Cairo).
  const base = new Date();
  base.setUTCMinutes(0, 0, 0);
  for (let h = -12; h <= 12; h += 1) {
    const t = new Date(base.getTime() + h * 3600000);
    const ch = Number(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      hour12: false
    }).format(t));
    if (ch === targetHour) return t.getTime();
  }
  throw new Error('no UTC timestamp maps to Cairo hour ' + targetHour);
}

await test('sweepKindsDue fires afternoon at the configured Cairo hour', () => {
  const kinds = sweepKindsDue(cairoMsForLocalHour(14), { afternoonHour: 14, bedtimeHour: 22 });
  assert.deepEqual(kinds.map(k => k.kind), ['afternoon']);
});

await test('sweepKindsDue fires bedtime at the configured Cairo hour', () => {
  const kinds = sweepKindsDue(cairoMsForLocalHour(22), { afternoonHour: 14, bedtimeHour: 22 });
  assert.deepEqual(kinds.map(k => k.kind), ['bedtime']);
});

await test('sweepKindsDue fires nothing when neither hour matches', () => {
  const kinds = sweepKindsDue(cairoMsForLocalHour(10), { afternoonHour: 14, bedtimeHour: 22 });
  assert.equal(kinds.length, 0);
});

await test('sweepKindsDue honours enabled=false', () => {
  assert.equal(sweepKindsDue(cairoMsForLocalHour(14), { enabled: false }).length, 0);
});

await test('buildSweepReminder has a dedupe_key and payload_kind', () => {
  const r = buildSweepReminder('afternoon', '2026-10-31', '2026-10-31T14:00:00.000Z', {});
  assert.equal(r.dedupe_key, 'sweep:afternoon:2026-10-31');
  assert.equal(r.payload_kind, 'tasks');
  assert.equal(r.repeat_interval, 'daily');
  assert.equal(r.status, 'pending');
});

await test('buildSweepReminder channels default to both', () => {
  const r = buildSweepReminder('bedtime', '2026-10-31', '2026-10-31T22:00:00.000Z', {});
  assert.equal(r.channels, 'both');
});

// Telegram
await test('telegramChannelEnabled treats toast-only as off', () => {
  assert.equal(telegramChannelEnabled('toast'), false);
  assert.equal(telegramChannelEnabled('telegram'), true);
  assert.equal(telegramChannelEnabled('both'), true);
  assert.equal(telegramChannelEnabled(undefined), false);
  assert.equal(telegramChannelEnabled('garbage'), false);
});

await test('buildTelegramSendPayload wraps title and body', () => {
  const p = buildTelegramSendPayload({ title: 'Afternoon check-in', body: '3 tasks left' }, '123');
  assert.equal(p.chat_id, '123');
  assert.ok(p.text.includes('Afternoon check-in'));
  assert.ok(p.text.includes('3 tasks left'));
});

await test('buildTelegramReminderMessage handles empty body', () => {
  const p = buildTelegramSendPayload({ title: 'X', body: '' }, '1');
  assert.ok(p.text.includes('X'));
});

// Telegram dashboard helpers (api/telegram.js)
await test('telegramTodoLabel shows tag + points + must-win', async () => {
  const { telegramTodoLabel } = await import('./api/telegram.js');
  const out = telegramTodoLabel({ title: 'write code', tag: 'mind', points: 5, must_win: true });
  assert.ok(out.includes('write code'));
  assert.ok(out.includes('MIND'));
  assert.ok(out.includes('5pts'));
  assert.ok(out.includes('⚡'));
});

await test('telegramTodoLabel escapes html in titles', async () => {
  const { telegramTodoLabel } = await import('./api/telegram.js');
  const out = telegramTodoLabel({ title: 'a <b> & "x"' });
  assert.ok(!out.includes('<b>'));
  assert.ok(out.includes('&lt;b&gt;'));
  assert.ok(out.includes('&amp;'));
});

await test('buildDashboardKeyboard returns main menu when no open tasks', async () => {
  const { buildDashboardKeyboard } = await import('./api/telegram.js');
  const kb = buildDashboardKeyboard([]);
  assert.ok(Array.isArray(kb.inline_keyboard));
  assert.ok(kb.inline_keyboard.length > 0);
});

await test('buildDashboardKeyboard maps open tasks to one-tap done buttons', async () => {
  const { buildDashboardKeyboard } = await import('./api/telegram.js');
  const todos = [
    { id: 'aaa', title: 'first task' },
    { id: 'bbb', title: 'second task' }
  ];
  const kb = buildDashboardKeyboard(todos);
  const flat = kb.inline_keyboard.flat();
  assert.ok(flat.some(b => b.callback_data === 'task:done:aaa'));
  assert.ok(flat.some(b => b.callback_data === 'task:done:bbb'));
  assert.ok(flat.some(b => b.callback_data === 'dashboard:refresh'));
});

await test('buildDashboardKeyboard caps at 8 open tasks', async () => {
  const { buildDashboardKeyboard } = await import('./api/telegram.js');
  const todos = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i, title: 'task ' + i }));
  const kb = buildDashboardKeyboard(todos);
  const doneButtons = kb.inline_keyboard.flat().filter(b => String(b.callback_data).startsWith('task:done:'));
  assert.equal(doneButtons.length, 8);
});

// Regression: existing behaviour unchanged
await test('sanitizeReminderCreate still rejects past fire_at', () => {
  const r = sanitizeReminderCreate({ title: 'x', fire_at: new Date(Date.now() - 600000).toISOString() });
  assert.equal(r.error, 'FIRE_AT IN THE PAST');
});

await test('findDueReminders still returns only pending+past', () => {
  const now = Date.now();
  const list = [
    { id: 1, status: 'pending', fire_at: new Date(now - 1000).toISOString() },
    { id: 2, status: 'pending', fire_at: new Date(now + 60000).toISOString() },
    { id: 3, status: 'delivered', fire_at: new Date(now - 1000).toISOString() }
  ];
  assert.deepEqual(findDueReminders(list).map(r => r.id), [1]);
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);