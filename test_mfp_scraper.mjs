// AXIS V5 // Tests for the MFP mobile-app OAuth diary sync
// (lib/mfpScraper.js, v2 — the website scraper died with MFP's
// NextAuth migration; see the header in that file).
//
// Strategy: parseDiaryMeals is pure → test it against the DOCUMENTED
// v2 diary response shape (myfitnesspalapi.com appendix). The full
// 6-step scrapeMfpDiary flow is tested against a mocked fetch that
// replays the live-verified responses captured 2026-10-10:
//   client token 200 ✓ | clientKeys 200 (sig HS512 key) ✓
//   authorize → 302 code ✓ | bogus creds → 302 access_denied ✓
// No network is touched.

import { parseDiaryMeals, scrapeMfpDiary } from './lib/mfpScraper.js';

let failures = 0;
function check(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); failures++; }
}

// ---------- 1. parseDiaryMeals: documented shape ----------
const DOCUMENTED = {
  items: [
    { type: 'diary_meal', date: '2014-08-25', diary_meal: 'Breakfast',
      nutritional_contents: {
        protein: 22.35, fat: 25.72, carbohydrates: 49.72, sodium: 945.06,
        energy: { unit: 'calories', value: 515 },
      } },
    { type: 'diary_meal', date: '2014-08-25', diary_meal: 'Lunch',
      nutritional_contents: {
        protein: 30.71, fat: 4.27, carbohydrates: 92.81,
        energy: { unit: 'calories', value: 526 },
      } },
    { type: 'exercise', date: '2014-08-25', exercise: { id: '1' }, duration: 1800,
      energy: { unit: 'calories', value: 210 } },
  ],
};

const meals = parseDiaryMeals(DOCUMENTED);
check(meals.length === 2, `expected 2 meal items (exercise skipped), got ${meals.length}`);
const bk = meals.find((m) => m.name.includes('Breakfast'));
check(bk && bk.name === 'MFP · Breakfast', `meal label, got "${bk?.name}"`);
check(bk.calories === 515, `breakfast cal ${bk.calories}`);
check(bk.protein === 22.4, `breakfast protein rounded ${bk.protein}`);
check(bk.carbs === 49.7, `breakfast carbs ${bk.carbs}`);
check(bk.fat === 25.7, `breakfast fat ${bk.fat}`);
check(bk.quantity === 1 && bk.unit === 'meal', 'meal qty/unit');
const lu = meals.find((m) => m.name.includes('Lunch'));
check(lu && lu.calories === 526, 'lunch present');

// ---------- 2. kilojoules → kcal conversion ----------
const kj = parseDiaryMeals({ items: [
  { type: 'diary_meal', diary_meal: 'Dinner', nutritional_contents: {
    protein: 10, fat: 5, carbohydrates: 20,
    energy: { unit: 'kilojoules', value: 2092 },
  } },
] });
check(kj.length === 1, 'kJ meal present');
check(kj[0].calories === Math.round(2092 / 4.184), `kJ→kcal (${kj[0].calories} vs ${Math.round(2092 / 4.184)})`);

// ---------- 3. defensive skips ----------
const junk = parseDiaryMeals({ items: [
  { type: 'diary_meal', diary_meal: 'Snack', nutritional_contents: { energy: { unit: 'calories', value: 0 } } },
  { type: 'diary_meal', diary_meal: 'Snack 2' }, // no nutritional_contents
  null,
  'garbage',
] });
check(junk.length === 0, `empty/missing meals skipped, got ${junk.length}`);
check(parseDiaryMeals(null).length === 0, 'null input safe');
check(parseDiaryMeals({}).length === 0, 'no items key safe');

// ---------- 4. full flow, mocked MFP edge ----------
const SIG_KEY_K = Buffer.from('axis-test-signing-key-0123456789abcdef').toString('base64url');
const SIG_KID = 'test-kid-1234';
const USER_SUB = 'uuid-user-999';
const MFP_DOMAIN_ID = '2320694511409';

function respond(body, status = 200, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => text,
  };
}

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ url: u, method: opts.method || 'GET' });

  if (u.endsWith('/oauth/token') && opts.body?.get?.('grant_type') === 'client_credentials') {
    return respond({ access_token: 'CLIENT.TOKEN', token_type: 'Bearer', expires_in: 900 });
  }
  if (u.endsWith('/clientKeys')) {
    return respond({ _embedded: { clientKeys: [
      { key: { kty: 'oct', use: 'sig', kid: SIG_KID, k: SIG_KEY_K, alg: 'HS512' }, keyId: SIG_KID, clientId: 'x' },
    ] } });
  }
  if (u.endsWith('/oauth/authorize')) {
    // Verify the credentials JWT: HS512 with the key we handed out.
    const jwt = opts.body?.get?.('credentials') || '';
    const [h, p, s] = jwt.split('.');
    check(Boolean(h && p && s), 'authorize: credentials JWT has 3 parts');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    check(header.alg === 'HS512' && header.kid === SIG_KID, 'JWT header alg/kid');
    const cryptoMod = await import('node:crypto');
    const expect = cryptoMod.createHmac('sha512', Buffer.from(SIG_KEY_K, 'base64url'))
      .update(`${h}.${p}`).digest('base64url');
    check(s === expect, 'JWT signature verifies against clientKeys sig key');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    check(claims.username === 'me@example.com' && typeof claims.password === 'string' && claims.password.length > 0, 'JWT carries username/password claims');
    const location = claims.password === 'pw'
      ? 'mfp://identity/callback?code=AUTHCODE123'
      : 'mfp://identity/callback?error=access_denied&error_description=Access+denied';
    return respond('', 302, { location });
  }
  if (u.endsWith('/oauth/token') && opts.body?.get?.('grant_type') === 'authorization_code') {
    check(opts.body.get('code') === 'AUTHCODE123', 'exchange uses the authorize code');
    const idToken = ['x', Buffer.from(JSON.stringify({ sub: USER_SUB })).toString('base64url'), 'y'].join('.');
    return respond({ access_token: 'USER.TOKEN', refresh_token: 'R', id_token: idToken, expires_in: 3600 });
  }
  if (u.includes(`/users/${USER_SUB}`)) {
    return respond({ userId: 1, accountLinks: [
      { domain: 'GOOGLE', domainUserId: 'g-1' },
      { domain: 'MFP', domainUserId: MFP_DOMAIN_ID },
    ] });
  }
  if (u.startsWith('https://api.myfitnesspal.com/v2/diary')) {
    check(u.includes('entry_date=2026-10-10'), `diary date param: ${u}`);
    check(u.includes('types=diary_meal'), 'diary types param');
    check(opts.headers?.authorization === 'Bearer USER.TOKEN' || opts.headers?.Authorization === 'Bearer USER.TOKEN', 'diary uses user token');
    const mfpUid = opts.headers?.['mfp-user-id'] || opts.headers?.['MFP-User-Id'];
    check(mfpUid === MFP_DOMAIN_ID, `diary mfp-user-id header (${mfpUid})`);
    return respond(DOCUMENTED);
  }
  return respond({ error: 'unmocked url', url: u }, 500);
};

const out = await scrapeMfpDiary({ username: 'me@example.com', password: 'pw', date: new Date('2026-10-10T12:00:00Z') });
check(out.items.length === 2, `flow items (${out.items.length})`);
check(out.entries.length === 1, 'flow entries wrapper');
check(out.entries[0].logged_at === '2026-10-10T12:00:00.000Z', 'logged_at = requested date');
check(calls.length === 6, `6 network calls (token/key/authorize/exchange/user/diary), got ${calls.length}`);
check(out.duration >= 0, 'duration present');

// ---------- 5. wrong password → actionable Google-account message ----------
let denied = '';
try {
  calls.length = 0;
  await scrapeMfpDiary({ username: 'me@example.com', password: 'WRONG', date: new Date('2026-10-10T12:00:00Z') });
} catch (e) {
  denied = String(e?.message || e);
}
check(denied.includes('wrong username or password'), `access_denied maps to password message: ${denied.slice(0, 90)}`);
check(denied.includes('Google'), 'message mentions Google sign-in fix');
check(calls.length === 3, `stops after authorize (3 calls), got ${calls.length}`);

// ---------- 6. missing creds ----------
let missing = '';
try { await scrapeMfpDiary({}); } catch (e) { missing = String(e?.message || e); }
check(missing.includes('required'), 'missing creds rejected early');

globalThis.fetch = realFetch;

if (failures) { console.error(`mfp-scraper-tests FAILED (${failures})`); process.exit(1); }
console.log('mfp-scraper-tests-ok');
