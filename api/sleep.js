import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { supabaseHeaders, supabaseRequest } from '../lib/supabaseServer.js';

function getShortcutSecret() {
  return process.env.SHORTCUT_SHARED_SECRET || process.env.SLEEP_SHORTCUT_SECRET || '';
}

function isShortcutAuthorized(req) {
  const expected = getShortcutSecret();
  if (!expected) return true;

  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers['x-axis-secret'] || req.headers['x-shortcut-secret'] || '';
  const bodySecret = req.body?.secret || req.body?.token || '';
  const querySecret = req.query?.secret || req.query?.token || '';

  return [bearer, headerSecret, bodySecret, querySecret].some(value => String(value || '').trim() === expected);
}

function normalizeDate(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!isAuthenticatedRequest(req)) {
      return res.status(200).json({ ok: true, message: 'AXIS SLEEP ENDPOINT READY' });
    }
    try {
      const rows = await supabaseRequest('sleep_circadian_logs?select=log_date,hours_slept,wake_time,quality_rating,logged_at&order=log_date.desc&limit=14');
      return res.status(200).json({ ok: true, rows: rows || [] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD SLEEP FEED' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const allow = isAuthenticatedRequest(req) || isShortcutAuthorized(req);
  if (!allow) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED REQUEST' });
  }

  const hours = parseFloat(req.body?.hours ?? req.body?.hoursSlept ?? req.body?.sleepHours);
  const wakeTime = String(req.body?.wakeTime || req.body?.wake_time || req.body?.wake || '').trim();
  const qualityRaw = req.body?.quality ?? req.body?.qualityRating ?? req.body?.quality_rating;
  const quality = qualityRaw === undefined || qualityRaw === null || qualityRaw === '' ? null : parseInt(qualityRaw, 10);
  const logDate = normalizeDate(req.body?.logDate || req.body?.date);

  if (!Number.isFinite(hours) || hours <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID HOURS VALUE' });
  }
  if (!wakeTime) {
    return res.status(400).json({ ok: false, error: 'WAKE TIME REQUIRED' });
  }
  if (quality !== null && (!Number.isFinite(quality) || quality < 1 || quality > 5)) {
    return res.status(400).json({ ok: false, error: 'QUALITY MUST BE 1 TO 5' });
  }

  const payload = {
    log_date: logDate,
    hours_slept: Number(hours.toFixed(1)),
    wake_time: wakeTime,
    quality_rating: quality,
    logged_at: new Date().toISOString()
  };

  try {
    const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
    const rows = await supabaseRequest('sleep_circadian_logs?on_conflict=log_date', { method: 'POST', headers, body: payload });
    return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO WRITE SLEEP LOG' });
  }
}