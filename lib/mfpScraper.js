// AXIS V5 // MFP web scraper
// Logs into myfitnesspal.com with the user's credentials, scrapes
// the food diary for a given date, and returns the entries in the
// same shape as the iOS Shortcut (so the same `writeNutritionMacros`
// function consumes them).
//
// RISKS (documented honestly):
//   1. MFP uses Cloudflare bot protection. A server-side fetch
//      from Vercel may get a Cloudflare challenge page instead of
//      the real diary HTML. The scraper sets a real User-Agent
//      and Accept-Language header, which works for some users but
//      not all. If the user gets blocked, fall back options:
//      - spider.cloud (paid scraping-as-a-service)
//      - MFP's "Export your data" email feature, processed by a
//        secondary service
//   2. MFP's HTML structure may change without notice. The
//      scraper parses the diary table using selectors documented
//      in the python-myfitnesspal library. If MFP redesigns,
//      this breaks silently.
//   3. MFP credentials in Vercel env vars are a real security
//      concern. MFP was breached in 2018 (144M accounts leaked).
//      If Vercel is breached, MFP creds leak too. Use a unique
//      MFP password for this integration.
//
// The user explicitly chose this approach after the iOS Shortcut
// path failed. PROMPT comes from the chat on 2026-07-23.

const MFP_LOGIN_URL = 'https://www.myfitnesspal.com/api/v2/sessions';
const MFP_DIARY_URL = 'https://www.myfitnesspal.com/food/diary';

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

// MFP diary HTML structure (as of 2026):
//   <tr class="meal_header"><td>Breakfast</td></tr>
//   <tr> (one per food entry)
//     <td><a>Food name</a></td>
//     <td>quantity (e.g. "1.5 serving")</td>
//     <td>calories</td>
//     <td>carbs (g)</td>
//     <td>fat (g)</td>
//     <td>protein (g)</td>
//     <td>sodium (mg)</td>
//     <td>sugar (g)</td>
//     <td>...</td>
//   </tr>
// Columns may vary. We pick out calories, carbs, fat, protein by
// header label (the table has <thead> with the field names).

// Login to MFP and return the session cookies.
// Returns a Cookie header string suitable for the fetch API.
async function mfpLogin({ username, password }) {
  const resp = await fetch(MFP_LOGIN_URL, {
    method: 'POST',
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.myfitnesspal.com',
      'Referer': 'https://www.myfitnesspal.com/',
    },
    body: JSON.stringify({
      username: String(username),
      password: String(password),
    }),
    redirect: 'manual',
  });

  if (!resp.ok && resp.status !== 302 && resp.status !== 303) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MFP login failed: HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }

  // MFP returns the session in a Set-Cookie header. Collect all
  // cookies from the response.
  const setCookieHeaders = [];
  // Node 18+ has resp.headers.getSetCookie() but it's not in
  // all runtimes. Fall back to parsing the combined header.
  if (typeof resp.headers.getSetCookie === 'function') {
    setCookieHeaders.push(...resp.headers.getSetCookie());
  } else {
    const combined = resp.headers.get('set-cookie') || '';
    if (combined) setCookieHeaders.push(...combined.split(/,(?=[^ ])/));
  }
  if (!setCookieHeaders.length) {
    throw new Error('MFP login succeeded but no session cookie returned');
  }

  // Extract just the name=value pairs (drop Path, Expires, etc.)
  return setCookieHeaders
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

// Fetch the diary page for a given date. Returns the HTML string.
async function fetchDiaryHtml({ cookie, date }) {
  const dateStr = formatMfpDate(date);
  const url = `${MFP_DIARY_URL}?date=${dateStr}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookie,
      'Referer': 'https://www.myfitnesspal.com/',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    // Cloudflare challenge page returns 403 or 503 with a
    // "cf-challenge" or "Just a moment..." body. Detect that
    // and throw a more helpful error.
    if (text.includes('cf-challenge') || text.includes('Just a moment') || resp.status === 403 || resp.status === 503) {
      throw new Error('MFP blocked the server fetch with Cloudflare bot protection. The scraper needs a Cloudflare bypass (paid service like spider.cloud) or MFP\'s "Export your data" email feature.');
    }
    throw new Error(`MFP diary fetch failed: HTTP ${resp.status}`);
  }

  return await resp.text();
}

// Format a Date as YYYY-MM-DD in MFP's expected format.
function formatMfpDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse the diary HTML into entries. Pure regex/string parsing
// to avoid pulling in a heavy HTML parser. MFP's HTML is server-
// rendered (not a SPA) so the table is in the initial response.
export function parseDiaryHtml(html) {
  // The diary table rows. Each food row has the food name in
  // <a href="...">...</a> and the nutrients in <td> cells.
  // We use a forgiving parser: split on <tr ...>...</tr>.

  const entries = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRegex.exec(html)) !== null) {
    const rowHtml = m[1];

    // Skip meal_header rows (those are meal titles like "Breakfast").
    // We detect them by checking for the meal class.
    if (/<tr[^>]*class\s*=\s*["'][^"']*meal/i.test(m[0])) continue;
    if (/<tr[^>]*class\s*=\s*["'][^"']*header/i.test(m[0])) continue;

    // Extract the food name from the first <a> tag in the row.
    const nameMatch = rowHtml.match(/<a[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const name = decodeHtml(nameMatch[1]).trim();
    if (!name || name.length < 1) continue;

    // Extract all <td> cell values.
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellText = cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      cells.push(decodeHtml(cellText));
    }
    if (cells.length < 4) continue; // not enough columns to be a food row

    // The nutrient columns vary by MFP page state. We pick the
    // first row in <thead> to learn the column order. If we
    // can't, fall back to a default order: Food, Quantity,
    // Calories, Carbs, Fat, Protein, Sodium, Sugar.
    // For the entries we expect, the typical order after the
    // food name is: Quantity, Calories, Carbs(g), Fat(g),
    // Protein(g), Sodium(mg), Sugar(g). So cells[1] = qty,
    // cells[2] = cal, cells[3] = carbs, cells[4] = fat,
    // cells[5] = protein.
    const quantityText = cells[1] || '';
    const calories = parseNumber(cells[2]);
    const carbs = parseNumber(cells[3]);
    const fat = parseNumber(cells[4]);
    const protein = parseNumber(cells[5]);

    // Skip zero-calorie entries (water, black coffee, etc.) —
    // they pollute the log. The user can add those manually.
    if (calories === 0) continue;

    // Parse the quantity field. It's usually "1.5 serving" or
    // "200 g" or "1 cup". Pull out the number.
    const qtyMatch = quantityText.match(/^([\d.]+)\s*(.*)$/);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) || 1 : 1;
    const unit = qtyMatch ? (qtyMatch[2] || 'serving').trim() || 'serving' : 'serving';

    entries.push({
      name,
      quantity,
      unit,
      calories,
      protein,
      carbs,
      fat,
    });
  }
  return entries;
}

function parseNumber(s) {
  if (!s) return 0;
  const m = String(s).match(/[\d.]+/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Public API: scrapeMfpDiary({ username, password, date })
// Returns { entries, rawHtml, cookie, duration }.
export async function scrapeMfpDiary({ username, password, date = new Date() } = {}) {
  if (!username || !password) {
    throw new Error('mfp username and password required');
  }

  const startTime = Date.now();

  // Step 1: log in
  const cookie = await mfpLogin({ username, password });

  // Step 2: fetch the diary
  const rawHtml = await fetchDiaryHtml({ cookie, date });

  // Step 3: parse the HTML
  const items = parseDiaryHtml(rawHtml);

  // Step 4: format into the entries shape the shortcut produces
  const loggedAt = (date instanceof Date ? date : new Date(date)).toISOString();
  const entries = items.length
    ? [{ logged_at: loggedAt, items }]
    : [];

  return {
    entries,
    items,
    cookie,
    rawHtmlLength: rawHtml.length,
    duration: Date.now() - startTime,
  };
}
