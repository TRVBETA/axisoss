// AXIS Daily — daily telemetry AND reminders (consolidated to stay under
// the 12-function Vercel Hobby limit).
//
// Daily telemetry: GET (load row), POST with no `ns` (upsert row), POST with
//   `ns: 'daily'` + `action` (apply named action).
//
// Reminders: GET ?ns=reminders&action=pending   list pending
//            GET ?ns=reminders&action=wait&timeout=S  long-poll
//            POST {ns: 'reminders', action: 'create', title, body, fire_at}
//            POST {ns: 'reminders', action: 'ack', reminder_id}
//
// Transport for the desktop reminder app: long-polling. One open HTTP request
// per client, held by the server up to 5 minutes, returns the first reminder
// that becomes due. Much cheaper than 30s polling, almost as fast as SSE for
// this workload.

import { createClient } from '@supabase/supabase-js';
import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { applyDailyAction, getDailyTelemetry, upsertDailyTelemetry } from '../lib/dailyServer.js';
import { currentAxisDayKey } from '../lib/coreDataServer.js';
import { supabaseRequest } from '../lib/supabaseServer.js';
import {
  REMINDERS_MAX_WAIT_MS,
  REMINDERS_POLL_TICK_MS,
  sanitizeReminderCreate,
  findDueReminders,
  buildRescheduledReminder,
  sweepKindsDue,
  buildSweepReminder,
  telegramChannelEnabled,
  buildTelegramSendPayload,
  sleep as remindersSleep
} from '../lib/remindersServer.js';

// ----- Supabase -----

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY
           || process.env.SUPABASE_SERVICE_ROLE_KEY
           || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ----- Reminders helpers -----

async function fetchDueReminders(supabase, userId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, body, fire_at, status, created_at, delivered_at, payload_kind, repeat_interval')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('fire_at', new Date().toISOString())
    .order('fire_at', { ascending: true })
    .limit(50);
  if (error) return [];
  return data || [];
}

async function markRemindersDelivered(supabase, userId, ids) {
  if (!ids.length) return;
  await supabase
    .from('reminders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', ids);
}

// After delivery, re-insert recurring copies so "every afternoon" and
// "before sleep" actually repeat. One INSERT per recurring reminder.
// Failures are swallowed: a lost re-fire is a one-day gap, not a crash,
// and the original reminder row is already marked delivered.
async function rearmRecurringReminders(supabase, userId, reminders) {
  const now = Date.now();
  const inserts = (reminders || [])
    .map(rem => buildRescheduledReminder(rem.fire_at, rem, now))
    .filter(Boolean);
  if (!inserts.length) return;
  try {
    await supabase.from('reminders').insert(inserts);
  } catch (e) {
    console.warn('[reminders] rearm failed:', String(e.message || e).slice(0, 200));
  }
}

// ---- Sweep: generate the afternoon / bedtime reminders for today ----
// Cron-gated (only runs when the sweep flag is set AND the secret matches).
// Idempotent via dedupe_key. The sweep does NOT read core_todos or
// nutrition_logs — it only plants a reminder with payload_kind='tasks'.
// The long-poll handler rewrites the body at delivery time so the user
// always sees fresh data.

function sweepAuthorized(req) {
  const expected = process.env.SWEEP_SECRET;
  if (!expected) return false;
  const got = String(req.headers['x-axis-secret'] || req.headers['authorization'] || '').trim();
  const bearer = got.startsWith('Bearer ') ? got.slice(7).trim() : got;
  return got === expected || bearer === expected;
}

async function sweepConfig(supabase) {
  // afternoon/bedtime hours live on commander_profile; env vars override.
  const afternoonHour = getEnvInt(process.env.AXIS_AFTERNOON_HOUR, 14);
  const bedtimeHour = getEnvInt(process.env.AXIS_BEDTIME_HOUR, 22);
  return { afternoonHour, bedtimeHour, enabled: true };
}

function getEnvInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : fallback;
}

async function runReminderSweep(supabase, nowMs = Date.now()) {
  const config = await sweepConfig(supabase);
  const kinds = sweepKindsDue(nowMs, config);
  if (!kinds.length) return { ok: true, generated: 0, kinds: [] };

  const axisDayKey = currentAxisDayKey();
  const now = new Date(nowMs);
  // Fire at the top of the current hour (UTC) so the reminder is "now".
  now.setUTCMinutes(0, 0, 0);
  const firedAt = now.toISOString();

  const payloads = kinds.map(({ kind }) =>
    buildSweepReminder(kind, axisDayKey, firedAt, config)
  );
  // Prefer: resolution=merge-duplicates turns a duplicate dedupe_key into
  // a no-op instead of an error.
  try {
    await supabase.from('reminders').insert(payloads, {
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
    });
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 200), generated: 0, kinds: [] };
  }
  return { ok: true, generated: payloads.length, kinds: kinds.map(k => k.kind), axisDayKey, firedAt };
}

// ---- Delivery-time body enrichment ----
// payload_kind='tasks' reminders get their body rewritten with today's
// unfinished tasks. payload_kind='mfp' gets the MFP sync status. This runs
// inside the long-poll loop so the data is fresh at the moment of delivery.
async function enrichReminderBody(reminder) {
  const kind = String(reminder.payload_kind || '').toLowerCase();
  if (kind !== 'tasks' && kind !== 'mfp') return reminder;

  if (kind === 'tasks') {
    try {
      const core = await supabaseRequest('core_todos?select=id,title,is_done,is_daily,points,task_kind,tag&is_done=eq.false&order=created_at.desc&limit=100');
      const open = (core || []).filter(t => !t.is_done);
      if (!open.length) {
        return { ...reminder, body: 'Nothing left to do today.' };
      }
      const lines = open.slice(0, 8).map(t => `• ${t.title}`).join('\n');
      const extra = open.length > 8 ? `\n… and ${open.length - 8} more` : '';
      return { ...reminder, body: `${open.length} task(s) left:\n${lines}${extra}` };
    } catch {
      return reminder;
    }
  }

  // mfp: has a nutrition_logs row been written for today yet?
  try {
    const axisToday = currentAxisDayKey();
    const rows = await supabaseRequest(`nutrition_logs?select=id,source,logged_at&logged_at=gte.${encodeURIComponent(axisToday + 'T00:00:00+02:00')}&order=logged_at.desc&limit=1`);
    const hasRow = Array.isArray(rows) && rows.length > 0;
    const source = hasRow ? rows[0].source : null;
    if (hasRow && source === 'myfitnesspal') {
      return { ...reminder, body: 'MFP synced today.' };
    }
    return { ...reminder, body: 'MFP not synced today. Tap Sync from MFP in Nutrition.' };
  } catch {
    return reminder;
  }
}

async function enrichDueReminders(reminders) {
  const out = [];
  for (const r of reminders || []) {
    try {
      out.push(await enrichReminderBody(r));
    } catch {
      out.push(r);
    }
  }
  return out;
}

// ---- Telegram delivery ----
// Sends pending reminders whose `channels` include 'telegram' and that have
// not been sent yet (telegram_sent_at is null). Idempotent: the column is
// stamped on success, so a re-run skips them. This is a separate path from
// the long-poll, which stamps delivered_at for the toast channel — the two
// surfaces do not race each other.
async function sendRemindersViaTelegram(supabase) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = String(process.env.AXIS_MASTER_CHAT_ID || '').trim();
  if (!botToken || !chatId) {
    return { ok: false, error: 'TELEGRAM NOT CONFIGURED (TELEGRAM_BOT_TOKEN / AXIS_MASTER_CHAT_ID)' };
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, body, fire_at, payload_kind')
    .eq('user_id', 'axis')
    .eq('status', 'pending')
    .is('telegram_sent_at', null)
    .order('fire_at', { ascending: true })
    .limit(20);
  if (error) return { ok: false, error: String(error.message || 'READ_FAILED').slice(0, 200) };
  const pending = (data || []).filter(r => telegramChannelEnabled(r.channels));
  if (!pending.length) return { ok: true, sent: 0, reason: 'no pending telegram reminders' };

  // Enrich tasks/mfp bodies with fresh data at send time.
  const enriched = await enrichDueReminders(pending);

  let sent = 0;
  const errors = [];
  for (const rem of enriched) {
    try {
      const payload = buildTelegramSendPayload(rem, chatId);
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        errors.push(`${rem.id}: ${String(data?.error_description || data?.description || data?.error || 'SEND_FAILED').slice(0, 120)}`);
        continue;
      }
      await supabase
        .from('reminders')
        .update({ telegram_sent_at: new Date().toISOString() })
        .eq('user_id', 'axis')
        .eq('id', rem.id);
      sent += 1;
    } catch (e) {
      errors.push(`${rem.id}: ${String(e.message || 'SEND_FAILED').slice(0, 120)}`);
    }
  }
  return { ok: true, sent, total: enriched.length, errors: errors.slice(0, 5) };
}

// ----- Reminders actions -----

async function remindersCreate(req, res, supabase) {
  const clean = sanitizeReminderCreate(req.body);
  if (!clean) return res.status(400).json({ ok: false, error: 'BAD REQUEST' });
  if (clean.error) return res.status(400).json({ ok: false, error: clean.error });
  const repeat = String(req.body?.repeat_interval || '').trim().toLowerCase();
  const allowed = ['daily', 'hourly', 'weekly', ''];
  const repeatInterval = allowed.includes(repeat) ? repeat : '';
  const { data, error } = await supabase
    .from('reminders')
    .insert({ user_id: 'axis', title: clean.title, body: clean.body, fire_at: clean.fire_at, repeat_interval: repeatInterval })
    .select('id, title, body, fire_at, status, repeat_interval, created_at')
    .single();
  if (error) {
    return res.status(500).json({ ok: false, error: 'INSERT_FAILED', detail: String(error.message || error) });
  }
  return res.status(200).json({ ok: true, reminder: data });
}

async function remindersAck(req, res, supabase) {
  const id = Number(req.body?.reminder_id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID REMINDER_ID' });
  }
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('user_id', 'axis')
    .eq('id', id)
    .in('status', ['pending', 'delivered']); // idempotent
  if (error) {
    return res.status(500).json({ ok: false, error: 'ACK_FAILED', detail: String(error.message || error) });
  }
  return res.status(200).json({ ok: true, acked: id });
}

async function remindersPending(req, res, supabase) {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, body, fire_at, status, created_at, delivered_at')
    .eq('user_id', 'axis')
    .eq('status', 'pending')
    .order('fire_at', { ascending: true })
    .limit(200);
  if (error) {
    return res.status(500).json({ ok: false, error: 'READ_FAILED', detail: String(error.message || error) });
  }
  return res.status(200).json({ ok: true, reminders: data || [] });
}

async function remindersWait(req, res, supabase) {
  let timeoutSec = parseInt(req.query?.timeout, 10);
  if (!Number.isFinite(timeoutSec)) timeoutSec = 290;
  timeoutSec = Math.max(5, Math.min(300, timeoutSec));
  const deadline = Date.now() + timeoutSec * 1000;

  // `since` filters out reminders fired before this timestamp, preventing
  // re-delivery if the client disconnects between fire and ack.
  const sinceRaw = req.query?.since;
  const since = sinceRaw ? new Date(String(sinceRaw)) : null;
  const sinceValid = since && !isNaN(since.getTime());

  let aborted = false;
  req.on('close', () => { aborted = true; });

  while (Date.now() < deadline && !aborted) {
    let due = await fetchDueReminders(supabase, 'axis');
    if (sinceValid) due = findDueReminders(due, since.toISOString());
    if (due.length > 0) {
      // Enrich tasks/mfp reminders with fresh data at the moment of delivery.
      due = await enrichDueReminders(due);
      const ids = due.map(r => r.id);
      await markRemindersDelivered(supabase, 'axis', ids);
      await rearmRecurringReminders(supabase, 'axis', due);
      return res.status(200).json({ ok: true, reminders: due, timed_out: false });
    }
    await remindersSleep(REMINDERS_POLL_TICK_MS);
  }
  if (aborted) return;
  return res.status(200).json({ ok: true, reminders: [], timed_out: true });
}

// ----- Main handler -----

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  // Reminders namespace
  const ns = String(req.query?.ns || req.body?.ns || '').toLowerCase();
  if (ns === 'reminders') {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ ok: false, error: 'SUPABASE NOT CONFIGURED' });
    }
    if (req.method === 'GET') {
      const action = String(req.query?.action || '').toLowerCase();
      // Cron sweep: POST {ns:'reminders',action:'sweep'} or
      // GET ?ns=reminders&sweep=1 with the shared secret.
      if (action === 'sweep') {
        if (!sweepAuthorized(req)) {
          return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
        }
        try {
          const result = await runReminderSweep(supabase);
          return res.status(200).json({ ok: true, sweep: result });
        } catch (e) {
          return res.status(500).json({ ok: false, error: String(e.message || 'SWEEP FAILED').slice(0, 200) });
        }
      }
      if (action === 'pending') return remindersPending(req, res, supabase);
      if (action === 'wait')    return remindersWait(req, res, supabase);
      return res.status(400).json({ ok: false, error: 'INVALID ACTION', allowed: ['pending', 'wait', 'sweep'] });
    }
    if (req.method === 'POST') {
      const action = String(req.body?.action || '').toLowerCase();
      if (action === 'create') return remindersCreate(req, res, supabase);
      if (action === 'ack')    return remindersAck(req, res, supabase);
      if (action === 'sweep') {
        if (!sweepAuthorized(req)) {
          return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
        }
        try {
          const result = await runReminderSweep(supabase);
          return res.status(200).json({ ok: true, sweep: result });
        } catch (e) {
          return res.status(500).json({ ok: false, error: String(e.message || 'SWEEP FAILED').slice(0, 200) });
        }
      }
      if (action === 'send-telegram') {
        // Cron-gated: only the Vercel cron (or a request with the shared
        // secret) may push reminders through Telegram.
        if (!sweepAuthorized(req)) {
          return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
        }
        try {
          const result = await sendRemindersViaTelegram(supabase);
          return res.status(200).json({ ok: true, telegram: result });
        } catch (e) {
          return res.status(500).json({ ok: false, error: String(e.message || 'TELEGRAM SEND FAILED').slice(0, 200) });
        }
      }
      return res.status(400).json({ ok: false, error: 'INVALID ACTION', allowed: ['create', 'ack', 'sweep', 'send-telegram'] });
    }
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  // ----- Original daily telemetry routes -----

  if (req.method === 'GET') {
    try {
      const row = await getDailyTelemetry();
      return res.status(200).json({ ok: true, row });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD DAILY TELEMETRY' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    let row;
    if (action) {
      row = await applyDailyAction(action, req.body || {});
    } else {
      row = await upsertDailyTelemetry(req.body || {});
    }
    return res.status(200).json({ ok: true, row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO UPDATE DAILY TELEMETRY' });
  }
}
