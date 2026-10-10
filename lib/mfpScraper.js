// AXIS V5 // MFP diary sync (mobile-app OAuth edition)
//
// HISTORY — read this before touching the auth flow:
//   v1 (broken, removed): POST www.myfitnesspal.com/api/v2/sessions.
//     That endpoint is GONE — MFP moved the whole website to NextAuth
//     in 2026 and the old JSON sessions endpoint now 404s.
//   Website login (NextAuth) was evaluated and REJECTED:
//     GET  /api/auth/csrf                 → 200 (works)
//     POST /api/auth/callback/credentials → {"url":"...?error=RecaptchaFailed"}
//     MFP's credentials provider requires a solved reCAPTCHA, which a
//     server cannot produce (verified live 2026-10-10).
//   v2 (this file): the same login MFP's own mobile app performs:
//     https://identity-api.myfitnesspal.com OAuth2 against the app's
//     embedded client credentials. No captcha on this path. Verified
//     live 2026-10-10: client_credentials grant OK, signing key OK,
//     HS512 credentials JWT accepted (bogus creds → access_denied
//     redirect, which is exactly the "wrong password" signal).
//
// FLOW (5 network steps):
//   1. POST /oauth/token        (client_credentials)          → client token
//   2. GET  /clientKeys         (Basic client_id:secret)      → HS512 signing key
//   3. POST /oauth/authorize    (JWT(username,password) HS512)→ 302 code | error
//   4. POST /oauth/token        (authorization_code)          → user tokens
//   5. GET  /users/{sub}        (identity-api, user token)    → MFP domainUserId
//   6. GET  api.myfitnesspal.com/v2/diary?entry_date=…        → meal totals
//   6b.GET  api.myfitnesspal.com/v2/diary/water?date=…        → water (best-effort)
//
// DATA READBACK — honest limitation:
//   The v2 diary endpoint returns MEAL-LEVEL totals (documented shape:
//   items[] of type diary_meal with nutritional_contents), not per-food
//   rows. We write one food-log item per non-empty meal
//   ("MFP · Breakfast") so calorie/macro DAY TOTALS are exact. If you
//   want per-food names in AXIS, keep logging via Telegram /eat or the
//   Nutrition tab free text (which is Groq-parsed per food).
//
// RISKS (documented honestly, user accepted this approach):
//   1. The embedded Android client_id/secret are MFP's own, shipped
//      publicly inside their app (and in open-source clients). MFP can
//      rotate/revoke them at any time → sync breaks until this file is
//      updated. If that happens we find out via step-1 errors.
//   2. identity-api.myfitnesspal.com / api.myfitnesspal.com are
//      undocumented private APIs. Shape can change without notice.
//      parseDiaryMeals() reads defensively (missing fields → skipped).
//   3. MFP was breached in 2018 (144M accounts). The MFP credentials
//      live in Vercel env vars. Use a UNIQUE MFP password.
//   4. Google-only MFP accounts have no password → step 3 returns
//      access_denied. The user must add a password at
//      myfitnesspal.com (log out → "Forgot password"). Both sign-in
//      methods coexist afterwards.
//
// The user explicitly chose this approach after the iOS Shortcut path
// failed and after the NextAuth/captcha path was ruled out. PROMPT
// comes from the chat on 2026-07-23, rebuilt 2026-10-10 after the
// website API 404 confirmed the old flow dead.

import crypto from 'node:crypto';

const IDENTITY_BASE = 'https://identity-api.myfitnesspal.com';
const API_BASE = 'https://api.myfitnesspal.com';

// MFP's own Android app client credentials (public, embedded in the
// published APK and in open-source clients such as seonixx/myfitnesspal).
// Not the user's credentials. Can be overridden via env if MFP rotates.
const MFP_CLIENT_ID = process.env.MFP_CLIENT_ID || '1c70aed5-15c7-40a2-b4f0-a55ed1a5c43c';
const MFP_CLIENT_SECRET = process.env.MFP_CLIENT_SECRET || '7xilqzoa2lqngjgi7vilqaqygq64cgbmc7pmsf4onvfelatb6vla';

const MOBILE_UA = 'MyFitnessPal/25.19.0 (mfp-mobile-android-google) (Android 11; Pixel 5) (preload=false;locale=en_US)';
const API_VERSION = '2.0.50';
const FETCH_TIMEOUT_MS = 8000;

function baseHeaders(extra = {}) {
  return {
    'user-agent': MOBILE_UA,
    'accept': 'application/json',
    'mfp-client-id': 'mfp-mobile-android-google',
    'api-version': API_VERSION,
    'accept-language': 'en-US',
    ...extra,
  };
}

// fetch wrapper: timeout + stage-tagged errors. `stage` appears in the
// thrown message so the result line tells you WHICH step failed.
async function mfpFetch(url, { stage, method = 'GET', headers = {}, body = null, redirect = 'manual' }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: baseHeaders(headers),
      body,
      redirect,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const why = e?.name === 'AbortError' ? `timeout after ${FETCH_TIMEOUT_MS}ms` : String(e?.message || e);
    throw new Error(`MFP ${stage}: network error — ${why}`);
  }
  clearTimeout(timer);
  return resp;
}

async function readJson(resp, stage) {
  const text = await resp.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`MFP ${stage}: unexpected non-JSON response (HTTP ${resp.status}) — ${text.slice(0, 120)}`);
  }
}

// ---- Step 1: client token (proves embedded client creds still valid) ----
async function getClientToken() {
  const resp = await mfpFetch(`${IDENTITY_BASE}/oauth/token`, {
    stage: 'AUTH 1/6 (client token)',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MFP_CLIENT_ID,
      client_secret: MFP_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const json = await readJson(resp, 'AUTH 1/6 (client token)');
  if (resp.status !== 200 || !json.access_token) {
    throw new Error(`MFP AUTH 1/6 (client token): HTTP ${resp.status} — MFP may have rotated its app credentials`);
  }
  return json.access_token;
}

// ---- Step 2: HS512 signing key for the credentials JWT ----
async function getSigningKey() {
  const basic = Buffer.from(`${MFP_CLIENT_ID}:${MFP_CLIENT_SECRET}`).toString('base64');
  const resp = await mfpFetch(`${IDENTITY_BASE}/clientKeys`, {
    stage: 'AUTH 2/6 (signing key)',
    headers: { authorization: `Basic ${basic}` },
  });
  const json = await readJson(resp, 'AUTH 2/6 (signing key)');
  const keys = json?._embedded?.clientKeys;
  const sig = Array.isArray(keys) ? keys.find((k) => k?.key?.use === 'sig' && k?.key?.k) : null;
  if (resp.status !== 200 || !sig) {
    throw new Error(`MFP AUTH 2/6 (signing key): HTTP ${resp.status} — no signing key returned`);
  }
  return { kid: sig.key.kid, key: Buffer.from(sig.key.k, 'base64url') };
}

// ---- Step 3: authorize with the credentials JWT (user login) ----
function makeCredentialsJwt(username, password, { kid, key }) {
  const b64u = (s) => Buffer.from(s).toString('base64url');
  const header = b64u(JSON.stringify({ alg: 'HS512', kid, typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ username, password }));
  const signature = crypto.createHmac('sha512', key).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function authorizeUser({ username, password, clientToken, signingKey }) {
  const credentials = makeCredentialsJwt(username, password, signingKey);
  const resp = await mfpFetch(`${IDENTITY_BASE}/oauth/authorize`, {
    stage: 'AUTH 3/6 (login)',
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Bearer ${clientToken}`,
    },
    body: new URLSearchParams({
      client_id: MFP_CLIENT_ID,
      credentials,
      nonce: `${Date.now()}${crypto.randomInt(0, 1e6)}`,
      redirect_uri: 'mfp://identity/callback',
      response_type: 'code',
      scope: 'openid',
    }),
  });
  const location = resp.headers.get('location') || '';
  if (resp.status !== 302 || !location) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MFP AUTH 3/6 (login): expected redirect, got HTTP ${resp.status} — ${text.slice(0, 120)}`);
  }
  let url;
  try { url = new URL(location); } catch {
    throw new Error('MFP AUTH 3/6 (login): malformed redirect from MFP');
  }
  const error = url.searchParams.get('error');
  if (error) {
    if (error === 'access_denied') {
      throw new Error(
        'MFP login rejected: wrong username or password. If this is a Google sign-in account it has NO '
        + 'MFP password yet — set one first (myfitnesspal.com → log out → "Forgot password"), then update '
        + 'MFP_USERNAME/MFP_PASSWORD in Vercel and redeploy.'
      );
    }
    throw new Error(`MFP AUTH 3/6 (login): ${error} — ${url.searchParams.get('error_description') || 'unknown'}`);
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error('MFP AUTH 3/6 (login): redirect contained no code');
  return code;
}

// ---- Step 4: exchange code for the user's access/refresh/id tokens ----
async function exchangeCode(code) {
  const resp = await mfpFetch(`${IDENTITY_BASE}/oauth/token`, {
    stage: 'AUTH 4/6 (token exchange)',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: MFP_CLIENT_ID,
      client_secret: MFP_CLIENT_SECRET,
      redirect_uri: 'mfp://identity/callback',
    }),
  });
  const json = await readJson(resp, 'AUTH 4/6 (token exchange)');
  if (resp.status !== 200 || !json.access_token) {
    throw new Error(`MFP AUTH 4/6 (token exchange): HTTP ${resp.status}`);
  }
  return json;
}

function userIdFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

// ---- Step 5: resolve the MFP domain user id (needed as mfp-user-id) ----
async function getMfpDomainUserId(tokens) {
  const accessToken = tokens?.access_token;
  const sub = userIdFromIdToken(tokens?.id_token);
  if (!sub) throw new Error('MFP AUTH 5/6 (user id): id_token missing sub');
  const resp = await mfpFetch(`${IDENTITY_BASE}/users/${encodeURIComponent(sub)}?fetch_profile=true&fetch_emails=true`, {
    stage: 'AUTH 5/6 (user id)',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = await readJson(resp, 'AUTH 5/6 (user id)');
  const links = Array.isArray(json?.accountLinks) ? json.accountLinks : [];
  const mfpLink = links.find((l) => l?.domain === 'MFP' && l?.domainUserId);
  if (resp.status !== 200 || !mfpLink) {
    throw new Error(`MFP AUTH 5/6 (user id): HTTP ${resp.status} — no MFP account link found`);
  }
  return String(mfpLink.domainUserId);
}

// ---- Step 6: read the diary (meal-level nutritional totals) ----
async function fetchDiary({ accessToken, mfpUserId, deviceId, date }) {
  const dateStr = formatMfpDate(date);
  const url = `${API_BASE}/v2/diary?entry_date=${encodeURIComponent(dateStr)}&types=diary_meal&fields%5B%5D=nutritional_contents`;
  const resp = await mfpFetch(url, {
    stage: 'DIARY 6/6 (read)',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'mfp-user-id': mfpUserId,
      'device_id': deviceId,
      'mfp-device-id': deviceId,
    },
  });
  const json = await readJson(resp, 'DIARY 6/6 (read)');
  if (resp.status !== 200) {
    throw new Error(`MFP DIARY 6/6 (read): HTTP ${resp.status} — ${JSON.stringify(json).slice(0, 120)}`);
  }
  return json;
}

// ---- Step 6b: read the day's WATER entry (best-effort, never fatal) ----
// Documented: GET /v2/diary/water?date=YYYY-MM-DD → { date, cups, milliliters }.
// Returns liters, or throws (caller swallows into waterError).
async function fetchDiaryWater({ accessToken, mfpUserId, deviceId, date }) {
  const dateStr = formatMfpDate(date);
  const url = `${API_BASE}/v2/diary/water?date=${encodeURIComponent(dateStr)}`;
  const resp = await mfpFetch(url, {
    stage: 'WATER (read)',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'mfp-user-id': mfpUserId,
      'device_id': deviceId,
      'mfp-device-id': deviceId,
    },
  });
  const json = await readJson(resp, 'WATER (read)');
  if (resp.status !== 200) {
    throw new Error(`MFP WATER (read): HTTP ${resp.status} — ${JSON.stringify(json).slice(0, 120)}`);
  }
  const ml = Number(json?.milliliters);
  if (Number.isFinite(ml)) return Math.round((ml / 1000) * 100) / 100;
  const cups = Number(json?.cups);
  if (Number.isFinite(cups)) return Math.round(cups * 0.24 * 100) / 100; // MFP cup = 240 ml
  return 0;
}

// Format a Date as YYYY-MM-DD (UTC) in MFP's expected format.
export function formatMfpDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Pure parser: v2 diary JSON → food-log items (one per non-empty meal).
// Exported for tests. Defensive: missing/odd fields → meal skipped.
export function parseDiaryMeals(diaryJson) {
  const rawItems = Array.isArray(diaryJson?.items) ? diaryJson.items : [];
  const items = [];
  for (const it of rawItems) {
    if (!it || it.type !== 'diary_meal') continue;
    const mealName = String(it.diary_meal || it.description || 'Meal').trim().slice(0, 60) || 'Meal';
    const nc = it.nutritional_contents;
    if (!nc || typeof nc !== 'object') continue;

    // Energy: convert to kcal when MFP reports kilojoules.
    const unit = String(nc.energy?.unit || 'calories').toLowerCase();
    let calories = Number(nc.energy?.value || 0);
    if (unit === 'kilojoules' || unit === 'kj' || unit === 'kilojoule') {
      calories = calories / 4.184;
    }
    calories = Math.round(calories);
    if (!Number.isFinite(calories) || calories <= 0) continue; // empty meal

    items.push({
      name: `MFP · ${mealName}`.slice(0, 80),
      quantity: 1,
      unit: 'meal',
      calories,
      protein: Math.round(Number(nc.protein || 0) * 10) / 10,
      carbs: Math.round(Number(nc.carbohydrates || 0) * 10) / 10,
      fat: Math.round(Number(nc.fat || 0) * 10) / 10,
    });
  }
  return items;
}

// Public API: scrapeMfpDiary({ username, password, date })
// Returns { entries, items, duration, diaryItemCount } — same shape the
// nutrition shortcut path consumes (writeNutritionMacros), one item per
// non-empty meal.
export async function scrapeMfpDiary({ username, password, date = new Date() } = {}) {
  if (!username || !password) {
    throw new Error('mfp username and password required');
  }

  const startTime = Date.now();
  const deviceId = crypto.randomUUID();

  const clientToken = await getClientToken();
  const signingKey = await getSigningKey();
  const code = await authorizeUser({ username: String(username).trim(), password: String(password), clientToken, signingKey });
  const tokens = await exchangeCode(code);
  const mfpUserId = await getMfpDomainUserId(tokens);
  const diaryJson = await fetchDiary({ accessToken: tokens.access_token, mfpUserId, deviceId, date });

  // Water is best-effort: a failure here must never kill the meal sync.
  let waterLiters = null;
  let waterError = '';
  try {
    waterLiters = await fetchDiaryWater({ accessToken: tokens.access_token, mfpUserId, deviceId, date });
  } catch (e) {
    waterError = String(e?.message || 'water read failed').slice(0, 160);
  }

  const items = parseDiaryMeals(diaryJson);
  const loggedAt = (date instanceof Date ? date : new Date(date)).toISOString();
  const entries = items.length ? [{ logged_at: loggedAt, items }] : [];

  return {
    entries,
    items,
    diaryItemCount: Array.isArray(diaryJson?.items) ? diaryJson.items.length : 0,
    waterLiters,
    waterError,
    duration: Date.now() - startTime,
  };
}
