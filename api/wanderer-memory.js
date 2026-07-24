// The Wanderer — memory reader
// Returns the user's recent visit history so the frontend can apply the
// time-since-last-visit modifier per SPEC.md:
//   - < 24h: world looks the same, figure posture slightly more settled
//   - > 1 week: one object has moved, sky is different time of day, planet rotated
//   - 5+ visits: figure posture shifts on entry, one new object appears
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

const HOUR = 3600 * 1000;
const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'NOT AUTHENTICATED' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      memory: emptyMemory(),
      reason: 'SUPABASE_NOT_CONFIGURED'
    });
  }

  try {
    // Get recent visits — last 30 days is enough to drive the modifiers.
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data: visits, error: vErr } = await supabase
      .from('wanderer_visits')
      .select('id, state, zone, line, was_fallback, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (vErr) {
      return res.status(200).json({
        ok: true,
        memory: emptyMemory(),
        reason: 'QUERY_FAILED',
        detail: String(vErr.message || vErr)
      });
    }

    const list = visits || [];
    const lastVisit = list[0] || null;
    const lastVisitAt = lastVisit ? new Date(lastVisit.created_at).getTime() : null;
    const hoursSinceLast = lastVisitAt
      ? (Date.now() - lastVisitAt) / HOUR
      : null;

    // Per-zone visit counts (lifetime, derived from this 30-day window).
    const zoneCounts = { Road: 0, Room: 0, Field: 0 };
    for (const v of list) {
      if (zoneCounts[v.zone] !== undefined) zoneCounts[v.zone]++;
    }
    const favoriteZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Per-state counts.
    const stateCounts = { static: 0, restless: 0, grey: 0, hollow: 0, clear: 0 };
    for (const v of list) {
      if (stateCounts[v.state] !== undefined) stateCounts[v.state]++;
    }
    const favoriteState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Total visits (lifetime-ish from this window).
    const totalVisits = list.length;

    // Time-since-last bucket per SPEC.
    let timeBucket = 'first';
    if (hoursSinceLast === null) {
      timeBucket = 'first';
    } else if (hoursSinceLast < 24) {
      timeBucket = 'recent';
    } else if (hoursSinceLast < 24 * 7) {
      timeBucket = 'days';
    } else {
      timeBucket = 'long';
    }

    // 5+ visits triggers: figure posture shift, new object.
    const isVeteran = totalVisits >= 5;

    // Last line from the most recent visit.
    const lastLine = lastVisit?.line || null;

    // Object touches — fetch the most-recent touched object per zone.
    const { data: touches, error: tErr } = await supabase
      .from('wanderer_object_touches')
      .select('visit_id, zone, object_key, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    const lastTouchPerZone = {};
    if (!tErr && touches) {
      for (const t of touches) {
        if (!lastTouchPerZone[t.zone]) {
          lastTouchPerZone[t.zone] = { object_key: t.object_key, created_at: t.created_at };
        }
      }
    }

    return res.status(200).json({
      ok: true,
      memory: {
        total_visits: totalVisits,
        hours_since_last: hoursSinceLast,
        time_bucket: timeBucket,
        favorite_zone: favoriteZone,
        favorite_state: favoriteState,
        zone_counts: zoneCounts,
        state_counts: stateCounts,
        last_zone: lastVisit?.zone || null,
        last_state: lastVisit?.state || null,
        last_line: lastLine,
        is_veteran: isVeteran,
        last_touch_per_zone: lastTouchPerZone
      }
    });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      memory: emptyMemory(),
      reason: 'EXCEPTION',
      detail: String(err?.message || err).slice(0, 200)
    });
  }
}

function emptyMemory() {
  return {
    total_visits: 0,
    hours_since_last: null,
    time_bucket: 'first',
    favorite_zone: null,
    favorite_state: null,
    zone_counts: { Road: 0, Room: 0, Field: 0 },
    state_counts: { static: 0, restless: 0, grey: 0, hollow: 0, clear: 0 },
    last_zone: null,
    last_state: null,
    last_line: null,
    is_veteran: false,
    last_touch_per_zone: {}
  };
}
