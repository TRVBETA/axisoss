// The Wanderer — visit recorder
// Records a completed visit to Supabase after the AI line has played.
// Called by the client ~22 seconds after zone entry (after the line fades).
// Auth: reuses axis_session cookie.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY
           || process.env.SUPABASE_SERVICE_ROLE_KEY
           || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ----- Auth (inline) -----
function isAuthorized(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const eq = p.indexOf('=');
        if (eq === -1) return [p, ''];
        return [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))];
      })
  );
  const token = cookies['axis_session'];
  if (!token || !token.includes('.')) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;
  try {
    const crypto = require('crypto');
    const secret = process.env.SESSION_SECRET || 'axis-dev-session-secret-change-me';
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    if (signature.length !== expected.length) return false;
    const validSig = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!validSig) return false;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!decoded.axis) return false;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

const STATE_IDS = new Set(['static', 'restless', 'grey', 'hollow', 'clear']);
const ZONE_IDS  = new Set(['Room', 'Road', 'Field']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'NOT AUTHENTICATED' });
  }

  const state = String(req.body?.state || '').trim();
  const zone  = String(req.body?.zone  || '').trim();
  const line  = String(req.body?.line  || '').trim();
  const wasFallback = !!req.body?.was_fallback;

  if (!STATE_IDS.has(state) || !ZONE_IDS.has(zone)) {
    return res.status(400).json({ ok: false, error: 'INVALID STATE OR ZONE' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ ok: true, recorded: false, reason: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    const { data, error } = await supabase
      .from('wanderer_visits')
      .insert({
        state,
        zone,
        line: line || null,
        was_fallback: wasFallback
      })
      .select('id')
      .single();

    if (error) {
      return res.status(200).json({ ok: true, recorded: false, reason: 'INSERT_FAILED', detail: String(error.message || error) });
    }

    return res.status(200).json({ ok: true, recorded: true, visit_id: data?.id });
  } catch (err) {
    return res.status(200).json({ ok: true, recorded: false, reason: 'EXCEPTION', detail: String(err?.message || err).slice(0, 200) });
  }
}
