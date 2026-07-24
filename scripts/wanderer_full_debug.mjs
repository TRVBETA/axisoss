// Wanderer FULL debug harness — boots a local server that serves both
// static files and the API. Mocks Groq and Supabase so we can verify
// the end-to-end flow (prompts, AI line, memory, touch, visit) without
// external dependencies. Captures screenshots, console errors, network
// errors, and exact prompts + responses.
//
// Run with:  node scripts/wanderer_full_debug.mjs
// Requires:  playwright + chromium installed in node_modules

import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WANDERER_DIR = path.join(PROJECT_ROOT, 'wanderer');
const SHOTS_DIR = path.join(PROJECT_ROOT, 'wanderer_full_debug_shots');
const REPORT_DIR = path.join(PROJECT_ROOT, 'wanderer_full_debug_reports');

const PORT = 8766;
const BASE = `http://localhost:${PORT}`;

// ----- 1. Local server: static files + /api/wanderer + /api/auth -----

// Replay log: every API call, what prompt was built, what we returned.
const apiLog = [];

// State descriptor map (must match api/wanderer.js)
const STATE_DESCRIPTORS = {
  static:   'static, frozen, unable to move',
  restless: 'restless, loud inside, cannot settle',
  grey:     'grey, flat, feeling nothing',
  hollow:   'functioning but hollow, performing without feeling',
  clear:    'clear, just checking in, no particular ache'
};

const SYSTEM_PROMPT_TEMPLATE = `You are the voice of a personal world belonging to a young Arab creator.
He makes dark psychedelic music, writes poetry, and is building a philosophy
of conscious living and intellectual independence — a project that is entirely
his own, built from nothing, against the current.

He has entered his world in this state: [STATE].

Write exactly ONE line. 10-15 words. It is not advice. It is not motivation.
It is a true thing — the kind of line that makes someone feel seen, not fixed.

Archaic register is welcome. Do not mention any name. Do not explain anything.
Just the line.`;

// Mock Groq: deterministic response per state. (In real prod, this is the
// llama-3.3-70b-versatile chat completion. The mock proves the *prompt*
// is well-formed and the response makes it back to the canvas.)
const MOCK_GROQ = {
  static:   'the body waits, and the world is not yet asking anything of you',
  restless: 'four walls, then a chair, then the quiet underneath',
  grey:     'one direction is enough for now, even if the light is far',
  hollow:   'a body that performs deserves a room that does not ask',
  clear:    'a clear day is rare, do not perform it, just walk into it'
};

// In-memory "Supabase" — survives across requests in this process.
const memDb = {
  wanderer_visits: [],
  wanderer_object_touches: []
};

function makeSessionCookie() {
  const encoded = Buffer.from(JSON.stringify({
    axis: true,
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const secret = 'axis-dev-session-secret-change-me';
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `axis_session=${encoded}.${sig}`;
}

function readSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('axis_session='));
  if (!m) return null;
  const tok = m.slice('axis_session='.length);
  if (!tok.includes('.')) return null;
  const [encoded, sig] = tok.split('.');
  const secret = 'axis-dev-session-secret-change-me';
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch { return null; }
}

function serveStatic(filePath, res) {
  return import('fs/promises').then(async (fs) => {
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath);
      const ct = ext === '.js' ? 'text/javascript'
              : ext === '.css' ? 'text/css'
              : ext === '.html' ? 'text/html'
              : ext === '.json' ? 'application/json'
              : ext === '.png' ? 'image/png'
              : ext === '.svg' ? 'image/svg+xml'
              : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8` });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
    }
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ----- /api/auth (login) -----
  if (url === '/api/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (data.action === 'login' && data.pin) {
          res.setHeader('Set-Cookie', makeSessionCookie());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: 'ACCESS GRANTED' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'BAD REQUEST' }));
        }
      } catch (e) {
        res.writeHead(400); res.end('bad json');
      }
    });
    return;
  }

  // ----- /api/wanderer (consolidated) -----
  if (url === '/api/wanderer' && req.method === 'POST') {
    const session = readSessionCookie(req.headers.cookie);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'NOT AUTHENTICATED' }));
      return;
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let data;
      try { data = JSON.parse(body || '{}'); } catch { data = {}; }
      const action = (data.action || '').toLowerCase();
      const log = { action, t: Date.now(), request: data };

      if (action === 'line') {
        const state = data.state;
        const line = MOCK_GROQ[state] || MOCK_GROQ.clear;
        // Build the actual prompt that WOULD be sent to Groq in production.
        // This proves the prompt template + state substitution is correct.
        const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('[STATE]', STATE_DESCRIPTORS[state] || 'unknown');
        log.full_prompt = {
          model: 'llama-3.3-70b-versatile',
          temperature: 0.9,
          max_tokens: 80,
          top_p: 0.9,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: 'enter.' }
          ]
        };
        log.response = { line, fallback: false };
        apiLog.push(log);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, line, fallback: false }));
        return;
      }

      if (action === 'touch') {
        const rec = { zone: data.zone, object_key: data.object_key, visit_id: data.visit_id || null, created_at: new Date().toISOString() };
        memDb.wanderer_object_touches.push(rec);
        log.response = { ok: true, recorded: true };
        apiLog.push(log);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, recorded: true }));
        return;
      }

      if (action === 'visit') {
        const rec = { id: memDb.wanderer_visits.length + 1, state: data.state, zone: data.zone, line: data.line || null, was_fallback: !!data.was_fallback, created_at: new Date().toISOString() };
        memDb.wanderer_visits.push(rec);
        const memory = computeMemory();
        log.response = { ok: true, recorded: true, visit_id: rec.id, memory };
        apiLog.push(log);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, recorded: true, visit_id: rec.id, memory }));
        return;
      }

      if (action === 'read') {
        const memory = computeMemory();
        log.response = { ok: true, memory };
        apiLog.push(log);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, memory }));
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'INVALID ACTION' }));
    });
    return;
  }

  // ----- Static file serving -----
  let urlPath = decodeURIComponent(url);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  let filePath = path.join(PROJECT_ROOT, urlPath);
  if (!filePath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  await serveStatic(filePath, res);
});

function computeMemory() {
  const HOUR = 3600 * 1000;
  const DAY  = 24 * HOUR;
  const visits = memDb.wanderer_visits;
  const last = visits[visits.length - 1] || null;
  const lastAt = last ? new Date(last.created_at).getTime() : null;
  const hours = lastAt ? (Date.now() - lastAt) / HOUR : null;
  const zoneCounts = { Road: 0, Room: 0, Field: 0 };
  for (const v of visits) if (zoneCounts[v.zone] !== undefined) zoneCounts[v.zone]++;
  const stateCounts = { static: 0, restless: 0, grey: 0, hollow: 0, clear: 0 };
  for (const v of visits) if (stateCounts[v.state] !== undefined) stateCounts[v.state]++;
  let timeBucket = 'first';
  if (hours === null) timeBucket = 'first';
  else if (hours < 24) timeBucket = 'recent';
  else if (hours < 24 * 7) timeBucket = 'days';
  else timeBucket = 'long';

  // last_touch_per_zone
  const lastTouchPerZone = {};
  for (const t of memDb.wanderer_object_touches) {
    if (!lastTouchPerZone[t.zone]) {
      lastTouchPerZone[t.zone] = { object_key: t.object_key, created_at: t.created_at };
    }
  }

  return {
    total_visits: visits.length,
    hours_since_last: hours,
    time_bucket: timeBucket,
    favorite_zone: Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    favorite_state: Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    zone_counts: zoneCounts,
    state_counts: stateCounts,
    last_zone: last?.zone || null,
    last_state: last?.state || null,
    last_line: last?.line || null,
    is_veteran: visits.length >= 5,
    last_touch_per_zone: lastTouchPerZone
  };
}

// Object hit-test rects, must match wanderer/objects.js
const HORIZON_RATIO = 0.62;
function getObjectRects(zone, W, H) {
  const HORIZON = H * HORIZON_RATIO;
  if (zone === 'Road') return [
    { key: 'bird',     x: W * 0.20, y: HORIZON - H * 0.20, w: W * 0.04, h: H * 0.04 },
    { key: 'door',     x: W * 0.74, y: HORIZON - H * 0.08, w: W * 0.03, h: H * 0.10 },
    { key: 'cassette', x: W * 0.55, y: H * 0.83,           w: W * 0.04, h: H * 0.03 },
    { key: 'post',     x: W * 0.12, y: HORIZON + H * 0.04, w: W * 0.025, h: H * 0.20 },
    { key: 'sign',     x: W * 0.85, y: HORIZON + H * 0.08, w: W * 0.04, h: H * 0.08 }
  ];
  if (zone === 'Room') return [
    { key: 'notebook', x: W * 0.62, y: H * 0.62, w: W * 0.06, h: H * 0.05 },
    { key: 'window',   x: W * 0.12, y: H * 0.16, w: W * 0.18, h: H * 0.32 },
    { key: 'planet',   x: W * 0.87, y: H * 0.28, w: W * 0.03, h: H * 0.05 },
    { key: 'lamp',     x: W * 0.05, y: H * 0.68, w: W * 0.04, h: H * 0.15 },
    { key: 'chair',    x: W * 0.32, y: H * 0.68, w: W * 0.04, h: H * 0.10 }
  ];
  if (zone === 'Field') return [
    { key: 'roads',   x: W * 0.05, y: H * 0.82, w: W * 0.90, h: H * 0.15 },
    { key: 'fire',    x: W * 0.18, y: HORIZON - H * 0.05, w: W * 0.05, h: H * 0.05 },
    { key: 'grass',   x: W * 0.05, y: H * 0.65, w: W * 0.40, h: H * 0.20 },
    { key: 'horizon', x: W * 0.85, y: HORIZON - H * 0.06, w: W * 0.03, h: H * 0.08 },
    { key: 'stone',   x: W * 0.46, y: H * 0.80, w: W * 0.02, h: H * 0.03 }
  ];
  return [];
}

// ----- 2. Browser test -----

async function run() {
  await mkdir(SHOTS_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleMsgs = [];
  const networkFails = [];

  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleMsgs.push({ type: 'pageerror', text: err.message + '\n' + (err.stack || '') });
  });
  page.on('requestfailed', (req) => {
    networkFails.push({ url: req.url(), failure: req.failure()?.errorText });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkFails.push({ url: res.url(), status: res.status() });
    }
  });

  // Set session cookie before navigating (since wanderer doesn't have PIN screen)
  await context.addCookies([{
    name: 'axis_session',
    value: 'debug',
    domain: 'localhost',
    path: '/',
    // The page won't actually check value — server rebuilds real cookie. But we set something
    // so that requests have a cookie header; server-side rebuild handles signature.
  }]);

  console.log(`[browser] navigating to ${BASE}/wanderer/`);
  await page.goto(`${BASE}/wanderer/`, { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => {
    console.log(`[browser] nav error: ${e.message}`);
  });
  await page.waitForTimeout(1500);

  // Inject a real session cookie via a login roundtrip — but wanderer doesn't have PIN UI.
  // Workaround: the server treats any request without a valid signature as 401, but the
  // wanderer client only fetches /api/wanderer on user actions. So we just need to make
  // sure that when those happen, the session is valid.
  //
  // We do that by intercepting fetches in the page and replacing them with a real call
  // that includes a fresh cookie. Simpler: call /api/auth to set the cookie, then re-run.

  console.log('[auth] logging in to set real session cookie');
  const loginRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'login', pin: 'debug' })
    });
    return { status: r.status, body: await r.text() };
  });
  console.log('[auth] login response:', JSON.stringify(loginRes));

  // Screenshot landing
  await page.screenshot({ path: path.join(SHOTS_DIR, '01_landing_1920.png') });
  console.log('[shot] 01_landing_1920.png');

  // Page state
  const state = await page.evaluate(() => {
    const c = document.getElementById('world');
    const rect = c?.getBoundingClientRect();
    return {
      canvas: c ? { w: c.width, h: c.height, cssW: rect?.width, cssH: rect?.height } : null,
      picker_visible: document.getElementById('picker-row')?.style.display !== 'none',
      picker_btns: Array.from(document.querySelectorAll('.glyph')).map(b => ({
        state: b.dataset.state,
        text: b.textContent.trim().slice(0, 4)
      })),
      title: document.title,
      line_visible: document.getElementById('line')?.classList.contains('visible'),
      body_bg: getComputedStyle(document.body).backgroundColor
    };
  });
  console.log('[state] page:', JSON.stringify(state, null, 2));

  // Click each state in turn: static, restless, grey, hollow, clear
  // We click by data-state selector.
  const states = ['static', 'restless', 'grey', 'hollow', 'clear'];
  const glyphs = await page.locator('#picker-row .glyph').all();
  console.log(`[browser] found ${glyphs.length} glyph buttons`);

  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    console.log(`\n--- testing state: ${s} ---`);
    // Re-show picker if hidden (after exit, picker should be back, but guard anyway)
    const pickerVisible = await page.evaluate(() => document.getElementById('picker-row').style.display !== 'none');
    if (!pickerVisible) {
      console.log('[browser] picker hidden, simulating tap-to-leave to reset');
      // tap empty canvas to exit
      const cb = await page.locator('#world').boundingBox();
      if (cb) await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height - 30);
      await page.waitForTimeout(2500);
    }

    // Click glyph
    const btn = page.locator(`#picker-row .glyph[data-state="${s}"]`);
    await btn.click();
    console.log(`[browser] clicked ${s}`);

    // Capture reveal state
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS_DIR, `02_reveal_${s}.png`) });

    // Wait for world phase (reveal = 1.8s)
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS_DIR, `03_world_${s}.png`) });

    // Check that the AI line was fetched and is visible
    const lineInfo = await page.evaluate(() => {
      const el = document.getElementById('line');
      return {
        text: el?.textContent || null,
        visible: el?.classList.contains('visible') || false
      };
    });
    console.log(`[ai] line for ${s}:`, JSON.stringify(lineInfo));

    // Tap each known object in the revealed zone, using its hit-test center.
    const cb = await page.locator('#world').boundingBox();
    if (cb) {
      // Get current zone + canvas size from page state
      const pageState = await page.evaluate(() => {
        const c = document.getElementById('world');
        return {
          cssW: c.getBoundingClientRect().width,
          cssH: c.getBoundingClientRect().height,
          rect: c.getBoundingClientRect()
        };
      });
      // Determine zone for this state
      const zoneMap = { static: 'Field', restless: 'Room', grey: 'Road', hollow: 'Room', clear: 'Field' };
      const zone = zoneMap[s] || 'Field';
      const rects = getObjectRects(zone, pageState.cssW, pageState.cssH);
      console.log(`[browser] ${zone} has ${rects.length} objects, hitting each:`);
      for (const r of rects) {
        const cx = pageState.rect.left + r.x + r.w / 2;
        const cy = pageState.rect.top  + r.y + r.h / 2;
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(200);
        console.log(`  -> tap ${r.key} at (${Math.round(cx)},${Math.round(cy)})`);
      }
    }
    await page.screenshot({ path: path.join(SHOTS_DIR, `04_after_taps_${s}.png`) });

    // Tap empty area to exit (bottom-right corner, should not hit any object)
    if (cb) {
      await page.mouse.click(cb.x + cb.width - 30, cb.y + cb.height - 30);
      await page.waitForTimeout(2500);
    }
  }

  // Final screenshot
  await page.screenshot({ path: path.join(SHOTS_DIR, '05_final.png') });

  // ----- 3. Reports -----
  console.log('\n=== CONSOLE MESSAGES ===');
  if (consoleMsgs.length === 0) console.log('  (none)');
  else for (const m of consoleMsgs) console.log(`  [${m.type}] ${m.text}`);

  console.log('\n=== NETWORK FAILURES ===');
  if (networkFails.length === 0) console.log('  (none)');
  else for (const f of networkFails) console.log(`  ${f.status || f.failure || '?'} ${f.url}`);

  console.log('\n=== API CALL LOG ===');
  for (const a of apiLog) {
    console.log(`  [${a.action}] req=${JSON.stringify(a.request)} -> ${JSON.stringify(a.response).slice(0, 200)}`);
  }

  // Write JSON reports
  await writeFile(path.join(REPORT_DIR, 'api_log.json'), JSON.stringify(apiLog, null, 2));
  await writeFile(path.join(REPORT_DIR, 'console.json'), JSON.stringify(consoleMsgs, null, 2));
  await writeFile(path.join(REPORT_DIR, 'network.json'), JSON.stringify(networkFails, null, 2));
  await writeFile(path.join(REPORT_DIR, 'memory_db.json'), JSON.stringify(memDb, null, 2));

  await browser.close();
}

server.listen(PORT, async () => {
  console.log(`[server] listening on ${BASE}`);
  try {
    await run();
  } catch (err) {
    console.error('[fatal]', err.message);
    console.error(err.stack);
  } finally {
    server.close();
    console.log('[server] closed');
    process.exit(0);
  }
});
