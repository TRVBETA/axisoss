// 1920x1080 full-flow test for the user.
// Renders landing, all 3 zones, object interactions, exit.
// Captures every state. Reports all errors. Saves screenshots.

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import http from 'http';

const PROJECT_ROOT = '/home/user/axisoss';
const SHOTS_DIR = path.join(PROJECT_ROOT, 'wanderer_1920_shots');
const PORT = 8770;

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
        const ct = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8` });
        res.end(data);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function shoot(page, name) {
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

const server = await startServer();
await mkdir(SHOTS_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE.ERROR: ${m.text()}`); });
page.on('requestfailed', r => errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) errors.push(`HTTP${r.status()}: ${r.url()}`); });

console.log('=== Loading /wanderer/ at 1920x1080 ===');
await page.goto(`http://localhost:${PORT}/wanderer/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await shoot(page, '01_landing');

console.log('=== Tapping grey (Road) ===');
await page.click('button.glyph[data-state="grey"]');
await page.waitForTimeout(1500);
await shoot(page, '02_road_revealing');
await page.waitForTimeout(1500);
await shoot(page, '03_road_world');
await page.waitForTimeout(2000);
await shoot(page, '04_road_with_line');

console.log('=== Tapping empty canvas to exit Road ===');
await page.click('#world', { position: { x: 100, y: 100 } });
await page.waitForTimeout(2500);
await shoot(page, '05_back_to_picker');

console.log('=== Tapping restless (Room) ===');
await page.click('button.glyph[data-state="restless"]');
await page.waitForTimeout(2500);
await shoot(page, '06_room_world');
await page.waitForTimeout(1500);

console.log('=== Tapping lamp area in Room ===');
// Lamp is at left side of canvas. With 16:9 letterbox on 1920x1080,
// canvas is full size. Lamp at x=8% of width.
await page.click('#world', { position: { x: 150, y: 700 } });
await page.waitForTimeout(800);
await shoot(page, '07_room_lamp_tapped');

console.log('=== Tapping empty canvas to exit Room ===');
await page.click('#world', { position: { x: 100, y: 100 } });
await page.waitForTimeout(2500);
await shoot(page, '08_back_to_picker_2');

console.log('=== Tapping static (Field) ===');
await page.click('button.glyph[data-state="static"]');
await page.waitForTimeout(2500);
await shoot(page, '09_field_world');
await page.waitForTimeout(1500);

console.log('=== Tapping fire in Field ===');
await page.click('#world', { position: { x: 350, y: 580 } });
await page.waitForTimeout(1500);
await shoot(page, '10_field_fire');

console.log('=== Exit back ===');
await page.click('#world', { position: { x: 100, y: 100 } });
await page.waitForTimeout(2500);
await shoot(page, '11_back_to_picker_3');

console.log('=== Tapping clear (random zone) ===');
await page.click('button.glyph[data-state="clear"]');
await page.waitForTimeout(2500);
await shoot(page, '12_clear_random_zone');

console.log('=== Mute toggle ===');
await page.click('#mute-toggle');
await page.waitForTimeout(500);
await shoot(page, '13_after_mute');
await page.click('#mute-toggle');
await page.waitForTimeout(500);

console.log('=== Hover state ===');
await page.click('#world', { position: { x: 100, y: 100 } });
await page.waitForTimeout(2500);
await page.hover('button.glyph[data-state="grey"]');
await page.waitForTimeout(800);
await shoot(page, '14_picker_hover');

await browser.close();
server.close();

console.log('\n=== ERRORS ===');
if (errors.length === 0) console.log('  (none)');
else errors.forEach(e => console.log('  ' + e));

console.log('\n=== DONE ===');
console.log('Screenshots: ' + SHOTS_DIR);
process.exit(0);
