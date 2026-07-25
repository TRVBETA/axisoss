// Reminders — pure logic. No HTTP, no Supabase, no env. Testable.
// The api/daily.js handler is a thin wrapper that calls these functions
// against a real Supabase client.

export const REMINDERS_MAX_WAIT_MS  = 300 * 1000;
export const REMINDERS_POLL_TICK_MS = 2 * 1000;
export const REMINDERS_MAX_TITLE    = 120;
export const REMINDERS_MAX_BODY     = 500;

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

// Sleep helper exported so the handler can use it.
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
