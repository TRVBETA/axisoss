// Aspect test — render the wanderer at multiple device aspect ratios
// so the user can see how it looks on phone-portrait, phone-landscape,
// laptop, and ultrawide.

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(PROJECT_ROOT, 'wanderer_aspect_shots');
const PORT = 8767;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      let filePath = path.join(PROJECT_ROOT, urlPath);
      if (!filePath.startsWith(PROJECT_ROOT)) { res.writeHead(403); res.end(); return; }
      try {
        const fs = await import('fs/promises');
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const ct = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css'
                : ext === '.html' ? 'text/html' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8` });
        res.end(data);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    server.listen(PORT, () => resolve(server));
  });
}

// Common device aspect ratios
const ASPECTS = [
  { name: 'iphone_portrait',  w: 390,  h: 844,  label: 'iPhone portrait (390×844)' },
  { name: 'iphone_landscape', w: 844,  h: 390,  label: 'iPhone landscape (844×390)' },
  { name: 'laptop',           w: 1280, h: 720,  label: 'Laptop 720p (1280×720)' },
  { name: 'laptop_1080',      w: 1920, h: 1080, label: 'Laptop 1080p (1920×1080)' },
  { name: 'desktop_1440',     w: 2560, h: 1440, label: 'Desktop 1440p (2560×1440)' }
];

async function runAspect(browser, a) {
  const context = await browser.newContext({ viewport: { width: a.w, height: a.h } });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/wanderer/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const shot = path.join(SHOTS_DIR, `${a.name}_01_landing.png`);
  await page.screenshot({ path: shot });
  console.log(`  ${a.label}: landing → ${shot}`);
  // Click the Road (grey / 3rd glyph) — need to click the actual button.
  // Buttons are in a flex row in the center of the screen.
  // We use a query selector to find the button.
  await page.click('button.glyph[data-state="grey"]');
  await page.waitForTimeout(2500);
  const shot2 = path.join(SHOTS_DIR, `${a.name}_02_road.png`);
  await page.screenshot({ path: shot2 });
  console.log(`  ${a.label}: road → ${shot2}`);
  // Now go back via tap on canvas
  await page.click('canvas');
  await page.waitForTimeout(2500);
  const shot3 = path.join(SHOTS_DIR, `${a.name}_03_back_to_picker.png`);
  await page.screenshot({ path: shot3 });
  console.log(`  ${a.label}: back → ${shot3}`);
  await context.close();
}

const server = await startServer();
await mkdir(SHOTS_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
console.log('Rendering aspect variants...');
for (const a of ASPECTS) await runAspect(browser, a);
await browser.close();
server.close();
console.log('Done. Screenshots in wanderer_aspect_shots/');
process.exit(0);
