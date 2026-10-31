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
  buildTelegramSendPayload
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
await test('sweepKindsDue fires afternoon at 14:00-14:59 UTC', () => {
  const d = new Date();
  d.setUTCHours(14, 30, 0, 0);
  const kinds = sweepKindsDue(d.getTime(), { afternoonHour: 14, bedtimeHour: 22 });
  assert.deepEqual(kinds.map(k => k.kind), ['afternoon']);
});

await test('sweepKindsDue fires bedtime at 22:00-22:59 UTC', () => {
  const d = new Date();
  d.setUTCHours(22, 15, 0, 0);
  const kinds = sweepKindsDue(d.getTime(), { afternoonHour: 14, bedtimeHour: 22 });
  assert.deepEqual(kinds.map(k => k.kind), ['bedtime']);
});

await test('sweepKindsDue fires nothing at 10:00 UTC', () => {
  const d = new Date();
  d.setUTCHours(10, 0, 0, 0);
  assert.equal(sweepKindsDue(d.getTime(), { afternoonHour: 14, bedtimeHour: 22 }).length, 0);
});

await test('sweepKindsDue honours enabled=false', () => {
  const d = new Date();
  d.setUTCHours(14, 30, 0, 0);
  assert.equal(sweepKindsDue(d.getTime(), { enabled: false }).length, 0);
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

await test('buildTelegramSendPayload handles empty body', () => {
  const p = buildTelegramSendPayload({ title: 'X', body: '' }, '1');
  assert.ok(p.text.includes('X'));
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