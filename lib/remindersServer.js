// Reminders — pure logic. No HTTP, no Supabase, no env. Testable.
// The api/daily.js handler is a thin wrapper that calls these functions
// against a real Supabase client.

export const REMINDERS_MAX_WAIT_MS  = 300 * 1000;
export const REMINDERS_POLL_TICK_MS = 2 * 1000;
export const REMINDERS_MAX_TITLE    = 120;
export const REMINDERS_MAX_BODY     = 500;

// Recurrence intervals supported by the re-fire engine.
// Stored in `repeat_interval`, consumed only by rescheduleDueReminder.
export const REPEAT_DAILY   = 'daily';
export const REPEAT_HOURLY  = 'hourly';
export const REPEAT_WEEKLY  = 'weekly';
export const REPEAT_INTERVALS = [REPEAT_DAILY, REPEAT_HOURLY, REPEAT_WEEKLY];

export function sanitizeReminderCreate(body) {
  if (!body || typeof body !== 'object') return { error: 'BAD REQUEST' };
  const title = String(body.title || '').trim();
  if (!title) return { error: 'TITLE REQUIRED' };
  if (title.length > REMINDERS_MAX_TITLE) return { error: 'TITLE TOO LONG' };
  const text = String(body.body || '').trim().slice(0, REMINDERS_MAX_BODY);
  const fireAtRaw = String(body.fire_at || '').trim();
  if (!fireAtRaw) return { error: 'FIRE_AT REQUIRED (ISO timestamp)' };
  const fireAt = new Date(fireAtRaw);
  if (isNaN(fireAt.getTime())) return { error: 'FIRE_AT INVALID' };
  if (fireAt.getTime() < Date.now() - 60 * 1000) {
    return { error: 'FIRE_AT IN THE PAST' };
  }
  return { title, body: text, fire_at: fireAt.toISOString() };
}

// `findDueReminders` is given a list of pending reminders for the user and
// returns the ones whose fire_at is in the past, optionally filtered by `since`.
export function findDueReminders(reminders, sinceIso) {
  const now = Date.now();
  const since = sinceIso ? new Date(sinceIso).getTime() : null;
  return reminders.filter(r => {
    const fireAt = new Date(r.fire_at).getTime();
    if (fireAt > now) return false;
    if (since !== null && fireAt <= since) return false;
    return r.status === 'pending';
  });
}

// Normalize a user-supplied repeat string into one of REPEAT_INTERVALS or ''.
export function normalizeRepeatInterval(value) {
  const clean = String(value || '').trim().toLowerCase();
  return REPEAT_INTERVALS.includes(clean) ? clean : '';
}

// Milliseconds per interval unit. `daily` is anchored to the calendar day
// (see rescheduleDueReminder) rather than a flat 24h, so a daily reminder
// that fires at 14:00 always lands at 14:00 the next day.
const REPEAT_MS = {
  [REPEAT_HOURLY]:  60 * 60 * 1000,
  [REPEAT_WEEKLY]: 7 * 24 * 60 * 60 * 1000
};

// Compute the next fire_at for a recurring reminder that just fired.
// `daily` anchors to the original fire time-of-day on the next calendar day
// (UTC), so a 14:00 reminder stays 14:00 even across DST boundaries. `hourly`
// and `weekly` are fixed offsets from the previous fire_at.
//
// `now` is accepted so tests can freeze time; production passes Date.now().
export function rescheduleDueReminder(prevFireAt, interval, now = Date.now()) {
  const clean = normalizeRepeatInterval(interval);
  if (!clean) return null;
  const prev = new Date(prevFireAt);
  if (isNaN(prev.getTime())) return null;

  if (clean === REPEAT_DAILY) {
    const next = new Date(prev);
    next.setUTCDate(next.getUTCDate() + 1);
    // If the next calendar day's 14:00 is somehow still in the past
    // (shouldn't happen), advance until it is in the future.
    while (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }

  const offset = REPEAT_MS[clean];
  let next = new Date(prev.getTime() + offset);
  while (next.getTime() <= now) next = new Date(next.getTime() + offset);
  return next.toISOString();
}

// Build the insert payload for the re-fired copy of a reminder.
// `firedAt` is the ISO timestamp of the fire that just happened.
export function buildRescheduledReminder(firedAt, source = {}, now = Date.now()) {
  const interval = normalizeRepeatInterval(source.repeat_interval);
  if (!interval) return null;
  const nextFire = rescheduleDueReminder(firedAt, interval, now);
  if (!nextFire) return null;
  return {
    user_id: source.user_id || 'axis',
    title: String(source.title || '').slice(0, REMINDERS_MAX_TITLE),
    body: String(source.body || '').slice(0, REMINDERS_MAX_BODY),
    fire_at: nextFire,
    status: 'pending',
    repeat_interval: interval
  };
}

// Sleep helper exported so the handler can use it.
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- Telegram delivery (pure logic) ----
// The AXIS Telegram bot is the highest-leverage reminder channel: it reaches
// the user on their phone even when no Windows app is running. This module
// builds the message text and the send payload; api/daily.js does the HTTP.

export function telegramChannelEnabled(channels) {
  const c = String(channels || 'toast').toLowerCase();
  return c === 'telegram' || c === 'both';
}

// Build the Telegram message text for a reminder. Tasks/mfp reminders are
// already enriched by the time they reach here.
export function buildTelegramReminderMessage(reminder) {
  const title = String(reminder.title || 'AXIS Reminder').trim();
  const body = String(reminder.body || '').trim();
  if (body) return `🔔 ${title}\n\n${body}`;
  return `🔔 ${title}`;
}

// Build the Telegram sendMessage payload for one reminder.
export function buildTelegramSendPayload(reminder, chatId) {
  return {
    chat_id: chatId,
    text: buildTelegramReminderMessage(reminder),
    parse_mode: 'HTML'
  };
}

// ---- Sweep generator (pure logic) ----
// The Vercel cron hits /api/daily?ns=reminders&sweep=1 once per day.
// This function decides WHICH generated reminders need creating for the
// given calendar day, using the user's configured afternoon/bedtime hours.
//
// `payload_kind`:
//   'none'  — plain reminder, body is delivered as-is
//   'tasks' — body is rewritten at delivery time to list today's unfinished
//             tasks. The sweep body is a placeholder; the long-poll handler
//             replaces it with fresh data so the user never sees a snapshot.
//   'mfp'   — body is rewritten at delivery time with the MFP sync status
//
// `dedupe_key` makes the sweep idempotent: re-running it for the same day
// is a no-op because the unique index rejects the duplicate.
export const SWEEP_AFTERNOON = 'afternoon';
export const SWEEP_BEDTIME   = 'bedtime';
export const SWEEP_KINDS = [SWEEP_AFTERNOON, SWEEP_BEDTIME];

export function getEnvHour(envValue, fallback) {
  const n = parseInt(envValue, 10);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : fallback;
}

// Which sweep kinds are due for this calendar day, given the current
// Cairo-axis time. Returns an array of { kind, hour }.
//
// Hours are interpreted in AFRICA/CAIRO, not UTC. The app's day key is
// Cairo-based (currentAxisDayKey shifts -6h then formats in Africa/Cairo),
// so a "before sleep" reminder must be gated on Cairo wall-clock too —
// otherwise 22:00 UTC fires at 00:00 local, which is not before bed.
export function sweepKindsDue(nowMs, config = {}) {
  const afternoonHour = getEnvHour(config.afternoonHour, 14);
  const bedtimeHour = getEnvHour(config.bedtimeHour, 22);
  const enabled = config.enabled !== false;
  if (!enabled) return [];

  // Cairo wall-clock for nowMs. Intl is deterministic and dependency-free;
  // the alternative (a fixed +2/+3 offset) breaks across DST changes.
  const cairoHour = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    hour12: false
  }).format(new Date(nowMs)));
  const cairoMinute = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    minute: '2-digit'
  }).format(new Date(nowMs)));
  const currentMinutes = cairoHour * 60 + cairoMinute;

  const out = [];
  for (const kind of SWEEP_KINDS) {
    const hour = kind === SWEEP_AFTERNOON ? afternoonHour : bedtimeHour;
    const targetMinutes = hour * 60;
    // Fire within the hour AFTER the target (so a 14:00 sweep that runs at
    // 14:00:00 still fires; one that runs at 13:59 waits until 14:00).
    if (currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 60) {
      out.push({ kind, hour });
    }
  }
  return out;
}

// Build the reminder insert payload for one sweep kind on one calendar day.
// `axisDayKey` is the Cairo-axis date string (YYYY-MM-DD) the reminder
// belongs to; `firedAt` is the ISO timestamp the sweep computed for it.
// `channels` controls which surfaces receive it: 'toast' (Windows app),
// 'telegram', or 'both'.
export function buildSweepReminder(kind, axisDayKey, firedAt, config = {}) {
  const title = kind === SWEEP_AFTERNOON ? 'Afternoon check-in' : 'Before sleep';
  const body = kind === SWEEP_AFTERNOON
    ? 'What is left to do today?'
    : 'What is left before you sleep?';
  const payloadKind = 'tasks';
  const channels = String(config.channels || 'both').toLowerCase();
  const safeChannels = ['toast', 'telegram', 'both'].includes(channels) ? channels : 'both';
  return {
    user_id: config.userId || 'axis',
    title,
    body,
    fire_at: firedAt,
    status: 'pending',
    repeat_interval: 'daily',
    payload_kind: payloadKind,
    channels: safeChannels,
    dedupe_key: `sweep:${kind}:${axisDayKey}`
  };
}