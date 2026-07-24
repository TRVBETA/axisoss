// The Wanderer — consolidated serverless endpoint
// All Wanderer API calls route through here with an 'action' discriminator:
//   action: 'line'  (POST)  — generate an AI line via Groq
//   action: 'touch' (POST)  — record an object touch
//   action: 'visit' (POST)  — record a completed visit, returns memory snapshot
//
// Vercel Hobby allows 12 serverless functions. This file consolidates what
// would otherwise be 4 files (line/visit/memory/touch) into one.
//
// Auth: reuses axis_session cookie (same secret as AXIS).
// Memory snapshot in the visit response removes the need for a separate
// GET endpoint — the client gets the freshest memory on each visit record.

import { createClient } from '@supabase/supabase-js';

// ----- Constants -----

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL_WANDERER || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT_TEMPLATE = `You are the voice of a personal world belonging to a young Arab creator.
He makes dark psychedelic music, writes poetry, and is building a philosophy
of conscious living and intellectual independence — a project that is entirely
his own, built from nothing, against the current.

He has entered his world in this state: [STATE].

Write exactly ONE line. 10-15 words. It is not advice. It is not motivation.
It is a true thing — the kind of line that makes someone feel seen, not fixed.

Archaic register is welcome. Do not mention any name. Do not explain anything.
Just the line.`;

const STATE_DESCRIPTORS = {
  static:   'static, frozen, unable to move',
  restless: 'restless, loud inside, cannot settle',
  grey:     'grey, flat, feeling nothing',
  hollow:   'functioning but hollow, performing without feeling',
  clear:    'clear, just checking in, no particular ache'
};

const STATE_IDS = new Set(Object.keys(STATE_DESCRIPTORS));
const ZONE_IDS  = new Set(['Room', 'Road', 'Field']);

// Curated fallback lines (archaic, no name, ~10-15 words)
const FALLBACKS = {
  static: [
    'the body waits, and the world is not yet asking anything of you',
    'stillness is also motion, the slowest kind',
    'a held breath is its own kind of weather',
    'the field does not require that you cross it',
    'frozen is a posture, not a verdict'
  ],
  restless: [
    'the noise is not the enemy, it is asking for a room',
    'four walls, then a chair, then the quiet underneath',
    'a loud inside is a small inside that wants air',
    'the room will hold what the open cannot',
    'rest is not the absence of motion, it is its container'
  ],
  grey: [
    'flat is not nothing, it is a held breath before a color',
    'one direction is enough for now, even if the light is far',
    'forward is a word that does not require a feeling',
    'the road asks nothing of you except your next step',
    'grey is a color too, even if you have forgotten its name'
  ],
  hollow: [
    'a body that performs deserves a room that does not ask',
    'the room will not require anything, that is its only gift',
    'stillness for those who have been still all day for others',
    'sit, the room remembers how to hold you',
    'functional is a posture, hollow is a tiredness, both pass'
  ],
  clear: [
    'a clear day is rare, do not perform it, just walk into it',
    'the world is open in the way you are open, in this moment',
    'to arrive without a question is also a kind of arrival',
    'the horizon will not move, but you can',
    'clarity is a place, you are already standing in it'
  ]
};

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

// ----- Supabase -----

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY
           || process.env.SUPABASE_SERVICE_ROLE_KEY
           || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ----- Helpers -----

function pickFallback(state) {
  const arr = FALLBACKS[state] || FALLBACKS.clear;
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeLine(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^["'`]+|["'`]+$/g, '');
  s = s.split('\n')[0].trim();
  s = s.replace(/[\s.]+$/, '');
  if (!s) return null;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 18) return null;
  return s;
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

// ----- Action handlers -----

async function actionLine(req, res) {
  const state = String(req.body?.state || '').trim();
  if (!STATE_IDS.has(state)) {
    return res.status(400).json({ ok: false, error: 'INVALID STATE' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      ok: true,
      line: pickFallback(state),
      fallback: true,
      reason: 'GROQ_API_KEY_NOT_SET'
    });
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('[STATE]', STATE_DESCRIPTORS[state]);

  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.9,
        max_tokens: 80,
        top_p: 0.9,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'enter.' }
        ]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return res.status(200).json({
        ok: true,
        line: pickFallback(state),
        fallback: true,
        reason: 'GROQ_ERROR',
        detail: errText.slice(0, 200)
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const line = sanitizeLine(content);

    if (!line) {
      return res.status(200).json({
        ok: true,
        line: pickFallback(state),
        fallback: true,
        reason: 'LINE_OUT_OF_BAND'
      });
    }

    return res.status(200).json({ ok: true, line, fallback: false });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      line: pickFallback(state),
      fallback: true,
      reason: 'EXCEPTION',
      detail: String(err?.message || err).slice(0, 200)
    });
  }
}

async function actionTouch(req, res) {
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
    const insert = { zone, object_key: objectKey };
    if (visitId && Number.isFinite(visitId)) insert.visit_id = visitId;

    const { error } = await supabase.from('wanderer_object_touches').insert(insert);
    if (error) {
      return res.status(200).json({ ok: true, recorded: false, reason: 'INSERT_FAILED', detail: String(error.message || error) });
    }
    return res.status(200).json({ ok: true, recorded: true });
  } catch (err) {
    return res.status(200).json({ ok: true, recorded: false, reason: 'EXCEPTION', detail: String(err?.message || err).slice(0, 200) });
  }
}

async function actionVisit(req, res) {
  const state = String(req.body?.state || '').trim();
  const zone  = String(req.body?.zone  || '').trim();
  const line  = String(req.body?.line  || '').trim();
  const wasFallback = !!req.body?.was_fallback;

  if (!STATE_IDS.has(state) || !ZONE_IDS.has(zone)) {
    return res.status(400).json({ ok: false, error: 'INVALID STATE OR ZONE' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      recorded: false,
      reason: 'SUPABASE_NOT_CONFIGURED',
      memory: emptyMemory()
    });
  }

  try {
    // Insert the visit.
    const { data: visit, error: vErr } = await supabase
      .from('wanderer_visits')
      .insert({ state, zone, line: line || null, was_fallback: wasFallback })
      .select('id, created_at')
      .single();

    if (vErr) {
      return res.status(200).json({
        ok: true,
        recorded: false,
        reason: 'VISIT_INSERT_FAILED',
        detail: String(vErr.message || vErr),
        memory: await readMemorySnapshot(supabase)
      });
    }

    // Read the freshest memory snapshot in the same response.
    const memory = await readMemorySnapshot(supabase);
    return res.status(200).json({
      ok: true,
      recorded: true,
      visit_id: visit?.id || null,
      memory
    });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      recorded: false,
      reason: 'EXCEPTION',
      detail: String(err?.message || err).slice(0, 200),
      memory: emptyMemory()
    });
  }
}

async function readMemorySnapshot(supabase) {
  const HOUR = 3600 * 1000;
  const DAY  = 24 * HOUR;

  try {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data: visits, error: vErr } = await supabase
      .from('wanderer_visits')
      .select('id, state, zone, line, was_fallback, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (vErr) return emptyMemory();

    const list = visits || [];
    const lastVisit = list[0] || null;
    const lastVisitAt = lastVisit ? new Date(lastVisit.created_at).getTime() : null;
    const hoursSinceLast = lastVisitAt ? (Date.now() - lastVisitAt) / HOUR : null;

    const zoneCounts = { Road: 0, Room: 0, Field: 0 };
    for (const v of list) {
      if (zoneCounts[v.zone] !== undefined) zoneCounts[v.zone]++;
    }
    const favoriteZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const stateCounts = { static: 0, restless: 0, grey: 0, hollow: 0, clear: 0 };
    for (const v of list) {
      if (stateCounts[v.state] !== undefined) stateCounts[v.state]++;
    }
    const favoriteState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const totalVisits = list.length;

    let timeBucket = 'first';
    if (hoursSinceLast === null) timeBucket = 'first';
    else if (hoursSinceLast < 24) timeBucket = 'recent';
    else if (hoursSinceLast < 24 * 7) timeBucket = 'days';
    else timeBucket = 'long';

    const isVeteran = totalVisits >= 5;
    const lastLine = lastVisit?.line || null;

    const { data: touches } = await supabase
      .from('wanderer_object_touches')
      .select('zone, object_key, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    const lastTouchPerZone = {};
    if (touches) {
      for (const t of touches) {
        if (!lastTouchPerZone[t.zone]) {
          lastTouchPerZone[t.zone] = { object_key: t.object_key, created_at: t.created_at };
        }
      }
    }

    return {
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
    };
  } catch (_) {
    return emptyMemory();
  }
}

// ----- Action handlers -----

async function actionRead(req, res) {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      memory: emptyMemory(),
      reason: 'SUPABASE_NOT_CONFIGURED'
    });
  }
  const memory = await readMemorySnapshot(supabase);
  return res.status(200).json({ ok: true, memory });
}

// ----- Main handler -----

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'NOT AUTHENTICATED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();

  switch (action) {
    case 'line':  return actionLine(req, res);
    case 'touch': return actionTouch(req, res);
    case 'visit': return actionVisit(req, res);
    case 'read':  return actionRead(req, res);
    default:
      return res.status(400).json({ ok: false, error: 'INVALID ACTION', allowed: ['line', 'touch', 'visit', 'read'] });
  }
}
