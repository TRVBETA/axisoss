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
import {
  REMINDERS_MAX_WAIT_MS,
  REMINDERS_POLL_TICK_MS,
  sanitizeReminderCreate,
  findDueReminders,
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
    .select('id, title, body, fire_at, status, created_at, delivered_at')
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

// ----- Reminders actions -----

async function remindersCreate(req, res, supabase) {
  const clean = sanitizeReminderCreate(req.body);
  if (!clean) return res.status(400).json({ ok: false, error: 'BAD REQUEST' });
  if (clean.error) return res.status(400).json({ ok: false, error: clean.error });
  const { data, error } = await supabase
    .from('reminders')
    .insert({ user_id: 'axis', title: clean.title, body: clean.body, fire_at: clean.fire_at })
    .select('id, title, body, fire_at, status, created_at')
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
      const ids = due.map(r => r.id);
      await markRemindersDelivered(supabase, 'axis', ids);
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
      if (action === 'pending') return remindersPending(req, res, supabase);
      if (action === 'wait')    return remindersWait(req, res, supabase);
      return res.status(400).json({ ok: false, error: 'INVALID ACTION', allowed: ['pending', 'wait'] });
    }
    if (req.method === 'POST') {
      const action = String(req.body?.action || '').toLowerCase();
      if (action === 'create') return remindersCreate(req, res, supabase);
      if (action === 'ack')    return remindersAck(req, res, supabase);
      return res.status(400).json({ ok: false, error: 'INVALID ACTION', allowed: ['create', 'ack'] });
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
