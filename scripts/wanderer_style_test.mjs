// Style test — render the wanderer picker at multiple resolutions,
// with multiple scale methods, save screenshots so the user can pick.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { writeFile, mkdir, copyFile } from 'fs/promises';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(PROJECT_ROOT, 'wanderer_style_shots');

const PORT = 8766;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      let filePath = path.join(PROJECT_ROOT, urlPath);
      if (!filePath.startsWith(PROJECT_ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
      try {
        const fs = await import('fs/promises');
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const ct = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css'
                : ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json'
                : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8` });
        res.end(data);
      } catch (e) {
        res.writeHead(404); res.end('Not found: ' + urlPath);
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

const VARIANTS = [
  // [name, internalW, internalH, scale, label, mode]
  { name: 'A_320x180_fit',   W: 320, H: 180, scale: 'fit',      label: '320×180 fit' },
  { name: 'B_480x270_fit',   W: 480, H: 270, scale: 'fit',      label: '480×270 fit (my rec)' },
  { name: 'C_640x360_fit',   W: 640, H: 360, scale: 'fit',      label: '640×360 fit' },
  { name: 'D_480x270_int3',  W: 480, H: 270, scale: 'integer3', label: '480×270 @ 3× integer' },
  { name: 'E_480x270_int2',  W: 480, H: 270, scale: 'integer2', label: '480×270 @ 2× integer' },
  { name: 'F_native',        W: null, H: null, scale: 'native',   label: 'Native (no pixel art)' }
];

async function runVariant(browser, v) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Inject style override before page loads
  await page.addInitScript((cfg) => {
    // Wait for DOM, then override
    window.addEventListener('DOMContentLoaded', () => {
      const canvas = document.getElementById('world');
      const screen = document.getElementById('world-screen');
      if (!canvas || !screen) return;
      const W = window.innerWidth;
      const H = window.innerHeight;

      if (cfg.W === null) {
        // Native: just match viewport
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.imageRendering = 'auto';
        // We need to scale all drawing to native resolution.
        // For demo purposes, set CSS width/height directly and the existing
        // W/H constants in the JS will mismatch. Skip for now.
        return;
      }

      // Set canvas drawing buffer to internal resolution
      canvas.width = cfg.W;
      canvas.height = cfg.H;
      canvas.style.imageRendering = 'pixelated';

      // Scale display
      let scale;
      const ratioW = Math.floor(W / cfg.W);
      const ratioH = Math.floor(H / cfg.H);
      const ratio = Math.max(1, Math.min(ratioW, ratioH));
      if (cfg.scale === 'fit') {
        // Non-integer scale that fits exactly
        scale = Math.min(W / cfg.W, H / cfg.H);
      } else if (cfg.scale === 'integer3') {
        scale = Math.min(3, ratio);
      } else if (cfg.scale === 'integer2') {
        scale = Math.min(2, ratio);
      } else {
        scale = ratio;
      }

      const displayW = cfg.W * scale;
      const displayH = cfg.H * scale;
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
      canvas.style.position = 'absolute';
      canvas.style.left = ((W - displayW) / 2) + 'px';
      canvas.style.top = ((H - displayH) / 2) + 'px';

      screen.style.background = '#000';
      screen.style.display = 'flex';
      screen.style.alignItems = 'center';
      screen.style.justifyContent = 'center';
    });
  }, v);

  await page.goto(`http://localhost:${PORT}/wanderer/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const shot = path.join(SHOTS_DIR, `${v.name}.png`);
  await page.screenshot({ path: shot });
  console.log(`  ${v.label}: ${shot}${errors.length ? '  ERRORS: ' + errors.join('; ') : ''}`);
  await context.close();
}

const server = await startServer();
await mkdir(SHOTS_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
console.log('Rendering variants...');
for (const v of VARIANTS) {
  await runVariant(browser, v);
}
await browser.close();
server.close();
console.log('Done. Screenshots in wanderer_style_shots/');
process.exit(0);
