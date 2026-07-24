// The Wanderer — AI line generator
// Server-side route. Calls Groq with the locked system prompt from SPEC.md.
// Returns one line, 10-15 words, archaic register, no name, no explanation.
//
// Matches the AXIS Vercel style: direct fetch to Groq OpenAI-compatible API,
// no SDK dependency. If GROQ_API_KEY is missing or Groq errors, falls back
// to a curated set of human-written lines so the world is never silent.

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

// ----- Auth (inline copy of lib/axisAuth.js to avoid cross-file coupling) -----
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

// ----- Fallback lines (curated, never mention names, archaic-where-fitting) -----
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

function pickFallback(state) {
  const arr = FALLBACKS[state] || FALLBACKS.clear;
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeLine(raw) {
  let s = String(raw || '').trim();
  // Strip leading/trailing quote marks.
  s = s.replace(/^["'`]+|["'`]+$/g, '');
  // Take only the first line.
  s = s.split('\n')[0].trim();
  // Remove trailing punctuation.
  s = s.replace(/[\s.]+$/, '');
  if (!s) return null;
  // Soft band: 8-18 words. Outside this we replace with a fallback.
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 18) {
    return null;
  }
  return s;
}

// ----- Main handler -----
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'NOT AUTHENTICATED' });
  }

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
