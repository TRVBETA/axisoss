// The Wanderer — object-touch recorder
// Records a tap on a world object to wanderer_object_touches table.
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

const ZONE_IDS  = new Set(['Room', 'Road', 'Field']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'NOT AUTHENTICATED' });
  }

  const zone = String(req.body?.zone || '').trim();
  const objectKey = String(req.body?.object_key || '').trim();
  const visitId = req.body?.visit_id != null ? Number(req.body.visit_id) : null;

  if (!ZONE_IDS.has(zone)) {
    return res.status(400).json({ ok: false, error: 'INVALID ZONE' });
  }
  if (!objectKey || objectKey.length > 64) {
    return res.status(400).json({ ok: false, error: 'INVALID OBJECT KEY' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ ok: true, recorded: false, reason: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    const insert = {
      zone,
      object_key: objectKey
    };
    if (visitId && Number.isFinite(visitId)) {
      insert.visit_id = visitId;
    }

    const { error } = await supabase
      .from('wanderer_object_touches')
      .insert(insert);

    if (error) {
      return res.status(200).json({ ok: true, recorded: false, reason: 'INSERT_FAILED', detail: String(error.message || error) });
    }
    return res.status(200).json({ ok: true, recorded: true });
  } catch (err) {
    return res.status(200).json({ ok: true, recorded: false, reason: 'EXCEPTION', detail: String(err?.message || err).slice(0, 200) });
  }
}
