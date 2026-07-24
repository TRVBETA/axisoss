import { chromium } from 'playwright';
import http from 'http';
import path from 'path';

const PROJECT_ROOT = '/home/user/axisoss';
const PORT = 8769;

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
page.on('console', m => console.log(`CONSOLE.${m.type().toUpperCase()}:`, m.text()));

await page.goto(`http://localhost:${PORT}/wanderer/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/test_landing.png' });
console.log('--- BEFORE CLICK ---');
console.log(await page.evaluate(() => ({
  canvasW: document.getElementById('world')?.width,
  canvasH: document.getElementById('world')?.height,
  glyphs: document.querySelectorAll('button.glyph').length,
  pickerVisible: getComputedStyle(document.getElementById('picker-row')).display
})));

await page.click('button.glyph[data-state="grey"]');
console.log('--- AFTER GREY CLICK (waiting 2.5s) ---');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/test_after_grey.png' });
console.log(await page.evaluate(() => ({
  pickerDisplay: getComputedStyle(document.getElementById('picker-row')).display,
  zoneLabelText: document.getElementById('zone-label')?.textContent,
  zoneLabelVisible: document.getElementById('zone-label')?.classList.contains('visible'),
  leaveVisible: document.getElementById('leave-hint')?.classList.contains('visible'),
  canvasNonBlack: (() => {
    const c = document.getElementById('world');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonBlack = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i+1] + data[i+2] > 30) nonBlack++;
    }
    return { total: data.length / 4, nonBlack, pct: (nonBlack / (data.length / 4) * 100).toFixed(1) + '%' };
  })()
})));

await browser.close();
server.close();
