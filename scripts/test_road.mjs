import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = '/home/user/axisoss';
const PORT = 8768;

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
server.listen(PORT);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE.ERROR:', m.text()); });
await page.goto(`http://localhost:${PORT}/wanderer/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const stateBefore = await page.evaluate(() => ({
  world: typeof world !== 'undefined' ? { W: world.W, H: world.H, phase: world.phase, revealed: world.revealedZone } : 'no world',
  canvasW: document.getElementById('world')?.width,
  canvasH: document.getElementById('world')?.height,
  canvasCssW: document.getElementById('world')?.getBoundingClientRect().width,
  canvasCssH: document.getElementById('world')?.getBoundingClientRect().height
}));
console.log('BEFORE CLICK:', JSON.stringify(stateBefore));
await page.click('button.glyph[data-state="grey"]');
await page.waitForTimeout(2500);
const stateAfter = await page.evaluate(() => ({
  world: typeof world !== 'undefined' ? { W: world.W, H: world.H, phase: world.phase, revealed: world.revealedZone } : 'no world',
  activeInteractions: typeof world !== 'undefined' ? Object.keys(world.activeInteractions) : 'no world'
}));
console.log('AFTER CLICK:', JSON.stringify(stateAfter));
await browser.close();
server.close();
