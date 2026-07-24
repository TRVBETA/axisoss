// Wanderer debug — opens /wanderer/ in headless chromium, captures
// console errors and network failures, takes a screenshot, reports.
//
// Run with:  node scripts/wanderer_debug.mjs
// Requires:  playwright + chromium installed (npm i -g playwright, npx playwright install chromium)

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WANDERER_DIR = path.join(PROJECT_ROOT, 'wanderer');
const SHOTS_DIR = path.join(PROJECT_ROOT, 'wanderer_debug_shots');

const PORT = 8765;
const BASE = `http://localhost:${PORT}`;

// ----- 1. Static server for the project root -----
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // Strip query, decode path
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      // Map /wanderer/* -> wanderer/*
      // Map /api/* -> not served by this static server (they'd 404, which is fine for debug)
      let filePath = path.join(PROJECT_ROOT, urlPath);
      // Security: prevent directory traversal
      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      try {
        const fs = await import('fs/promises');
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const ct = ext === '.js' ? 'text/javascript'
                : ext === '.css' ? 'text/css'
                : ext === '.html' ? 'text/html'
                : ext === '.json' ? 'application/json'
                : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8` });
        res.end(data);
      } catch (e) {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
      }
    });
    server.listen(PORT, () => {
      console.log(`[server] static on ${BASE} (project root)`);
      resolve(server);
    });
  });
}

// ----- 2. Headless browser test -----
async function runBrowser() {
  await mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
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

  console.log(`[browser] navigating to ${BASE}/wanderer/`);
  await page.goto(`${BASE}/wanderer/`, { waitUntil: 'networkidle', timeout: 15000 }).catch((e) => {
    console.log(`[browser] navigation error: ${e.message}`);
  });

  // Wait a moment for any post-load canvas rendering
  await page.waitForTimeout(1500);

  // Screenshot the landing
  const shot1 = path.join(SHOTS_DIR, '01_landing.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`[browser] shot: ${shot1}`);

  // Check what's actually rendered
  const visible = await page.evaluate(() => {
    const out = {};
    out.canvas_present = !!document.getElementById('world');
    out.canvas_w = document.getElementById('world')?.width || 0;
    out.canvas_h = document.getElementById('world')?.height || 0;
    out.world_screen_visible = document.getElementById('world-screen')?.classList.contains('visible');
    out.pin_screen_present = !!document.getElementById('pin-screen');
    out.body_bg = getComputedStyle(document.body).backgroundColor;
    out.title = document.title;
    return out;
  });
  console.log('[browser] page state:', JSON.stringify(visible, null, 2));

  // Try clicking a glyph (use absolute coordinates — center of canvas, plus offsets for each glyph)
  // The picker is at canvas center, glyphs at 90px spacing
  const canvasBox = await page.locator('#world').boundingBox();
  if (canvasBox) {
    console.log(`[browser] canvas at:`, canvasBox);
    // Click center glyph (◯ / clear) at canvas center
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    console.log(`[browser] clicking center (clear) at ${cx}, ${cy}`);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(500);

    const shot2 = path.join(SHOTS_DIR, '02_after_click_center.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`[browser] shot: ${shot2}`);

    // Wait for zone reveal (2s) and world to render
    await page.waitForTimeout(2500);
    const shot3 = path.join(SHOTS_DIR, '03_after_zone_reveal.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`[browser] shot: ${shot3}`);

    // Click another glyph (leftmost = static = field)
    const leftX = canvasBox.x + canvasBox.width / 2 - 180; // -2 * 90
    console.log(`[browser] clicking leftmost (static) at ${leftX}, ${cy}`);
    await page.mouse.click(leftX, cy);
    await page.waitForTimeout(2500);
    const shot4 = path.join(SHOTS_DIR, '04_after_field.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`[browser] shot: ${shot4}`);
  } else {
    console.log('[browser] no canvas bounding box — page not rendered');
  }

  // Final summary
  console.log('\n=== CONSOLE MESSAGES ===');
  if (consoleMsgs.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of consoleMsgs) {
      console.log(`  [${m.type}] ${m.text}`);
    }
  }

  console.log('\n=== NETWORK FAILURES ===');
  if (networkFails.length === 0) {
    console.log('  (none)');
  } else {
    for (const f of networkFails) {
      console.log(`  ${f.status || f.failure || '?'} ${f.url}`);
    }
  }

  await browser.close();
}

// ----- 3. Main -----
const server = await startServer();
try {
  await runBrowser();
} catch (err) {
  console.error('[fatal]', err.message);
  console.error(err.stack);
} finally {
  server.close();
  console.log('[server] closed');
  process.exit(0);
}
