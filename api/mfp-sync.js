// AXIS V5 // MFP sync endpoint
// Logs into MyFitnessPal via the mobile-app OAuth flow
// (lib/mfpScraper.js — the website login is dead: NextAuth +
// reCAPTCHA since 2026), then:
//   1. reads the day's MEAL totals  → nutrition_logs (source: myfitnesspal)
//   2. reads the day's WATER amount → daily_debrief_logs.water_liters
//
// DEDUPE: before writing, any prior source='myfitnesspal' rows for the
// same UTC date are deleted — the sync is IDEMPOTENT. Tapping "Sync
// from MFP now" ten times yields one set of rows. Rows from other
// sources (USDA manual log, old apple_health shortcut data) are never
// touched; use UNDO LAST / CLEAR in the Nutrition tab for those.
//
// WATER POLICY: MFP is the hydration source ONLY when it reports > 0
// liters for the date. A zero is never written over tap-cartridge
// data (0 usually means "not logged in MFP yet today").
//
// Auth:
//   - session cookie (browser "Sync from MFP now")
//   - x-axis-secret / bearer == SHORTCUT_SHARED_SECRET / NUTRITION_SHORTCUT_SECRET
//   - Vercel cron: GET with Authorization: Bearer $CRON_SECRET
//     (Vercel sends this automatically when CRON_SECRET is set). Runs
//     the sync for YESTERDAY — the cron fires 02:00 UTC, i.e. it
//     archives the day that just ended. Before this fix the cron hit
//     the health-check and never synced anything.
//
// MFP credentials come from Vercel env vars (MFP_USERNAME, MFP_PASSWORD)
// — never from the request body. Optional overrides: MFP_CLIENT_ID /
// MFP_CLIENT_SECRET if MFP ever rotates its embedded app credentials.

import { scrapeMfpDiary, formatMfpDate } from '../lib/mfpScraper.js';
import { writeNutritionMacros } from '../lib/nutritionServer.js';
import { supabaseRequest } from '../lib/supabaseServer.js';
import { upsertDailyTelemetry } from '../lib/dailyServer.js';
import { currentAxisDayKey } from '../lib/coreDataServer.js';
import { isAuthenticatedRequest } from '../lib/axisAuth.js';

function getMfpCredentials() {
  return {
    username: process.env.MFP_USERNAME || '',
    password: process.env.MFP_PASSWORD || '',
  };
}

function getShortcutSecret() {
  return process.env.SHORTCUT_SHARED_SECRET || process.env.NUTRITION_SHORTCUT_SECRET || '';
}

function isShortcutAuthorized(req) {
  const expected = getShortcutSecret();
  if (!expected) return false;
  const headerSecret = req.headers['x-axis-secret'] || req.headers['x-shortcut-secret'] || '';
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return [headerSecret, bearer].some((v) => String(v || '').trim() === expected);
}

function cleanErr(e) {
  return String(e?.message || 'MFP SYNC FAILED')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

// [start, end) of the UTC calendar date, for the dedupe DELETE.
function dayRangeFor(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return { start: d.toISOString(), end: new Date(d.getTime() + 86400000).toISOString() };
}

// Water is stored in the daily-telemetry row the UI shows. For "today"
// that's the AXIS day key (Africa/Cairo, 6am boundary); past dates keep
// their own date so the history lands on the right day.
function waterLogDate(date) {
  const target = formatMfpDate(date);
  const axisToday = currentAxisDayKey();
  const utcToday = formatMfpDate(new Date());
  if (target === utcToday || target === axisToday) return axisToday;
  return target;
}

async function deleteMfpRowsForDate(date) {
  const { start, end } = dayRangeFor(date);
  await supabaseRequest(
    `nutrition_logs?source=eq.myfitnesspal&logged_at=gte.${encodeURIComponent(start)}&logged_at=lt.${encodeURIComponent(end)}`,
    { method: 'DELETE' }
  );
}

async function runMfpSync(date) {
  const creds = getMfpCredentials();
  if (!creds.username || !creds.password) {
    const e = new Error('MFP credentials not configured. Set MFP_USERNAME and MFP_PASSWORD in Vercel env vars.');
    e.statusCode = 503;
    throw e;
  }

  const { entries, items, duration, waterLiters, waterError } = await scrapeMfpDiary({
    username: creds.username,
    password: creds.password,
    date,
  });

  // Water first (independent of meals): only apply when MFP reports > 0.
  let waterApplied = null;
  if (typeof waterLiters === 'number' && waterLiters > 0) {
    const litersRounded = Math.round(waterLiters * 10) / 10;
    await upsertDailyTelemetry({ water_liters: litersRounded }, waterLogDate(date));
    waterApplied = litersRounded;
  }

  // Idempotent meals: wipe this date's prior MFS rows, then re-insert.
  try {
    await deleteMfpRowsForDate(date);
  } catch (e) {
    // Non-fatal: worst case the user sees duplicates once and uses
    // CLEAR. Logged into the response so we can see it.
    console.warn('[mfp-sync] dedupe delete failed:', cleanErr(e));
  }

  let written = 0;
  if (entries.length) {
    const result = await writeNutritionMacros(entries, 'myfitnesspal');
    written = result?.rows?.length ?? items.length;
  }

  return {
    items_found: items.length,
    items_written: written,
    water_liters: waterApplied,
    water_seen: typeof waterLiters === 'number' ? waterLiters : null,
    water_error: waterError || undefined,
    date: formatMfpDate(date),
    duration_ms: duration,
  };
}

function syncError(res, e) {
  const msg = cleanErr(e);
  return res.status(e.statusCode || 502).json({
    ok: false,
    error: msg,
    hint: msg.toLowerCase().includes('login rejected')
      ? 'Google-only MFP accounts have no password — set one at myfitnesspal.com (log out → Forgot password), update the env vars, redeploy.'
      : undefined,
  });
}

export default async function handler(req, res) {
  // ---- Vercel cron: GET + Authorization: Bearer $CRON_SECRET ----
  // Vercel attaches this automatically when CRON_SECRET is set. Must run
  // BEFORE the normal auth gate (the cron has no session cookie).
  if (req.method === 'GET' && process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth === `Bearer ${process.env.CRON_SECRET}`) {
      const yesterday = new Date(Date.now() - 86400000);
      try {
        const result = await runMfpSync(yesterday);
        return res.status(200).json({ ok: true, cron: true, ...result });
      } catch (e) {
        return syncError(res, e);
      }
    }
  }

  // Auth gate: session cookie OR shared secret
  if (!isAuthenticatedRequest(req) && !isShortcutAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  // Health check (also used by the Nutrition tab config probe)
  if (req.method === 'GET') {
    const creds = getMfpCredentials();
    return res.status(200).json({
      ok: true,
      mfp_configured: Boolean(creds.username && creds.password),
      mfp_username_set: Boolean(creds.username),
      mfp_password_set: Boolean(creds.password),
      secret_configured: Boolean(getShortcutSecret()),
      cron_enabled: Boolean(process.env.CRON_SECRET),
    });
  }

  // Sync
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  // Date: default to today. Body can override with { date: "YYYY-MM-DD" }.
  const date = req.body?.date ? new Date(req.body.date) : new Date();
  if (req.body?.date && Number.isNaN(date.getTime())) {
    return res.status(400).json({ ok: false, error: 'INVALID DATE' });
  }

  try {
    const result = await runMfpSync(date);
    if (!result.items_found && result.water_liters == null) {
      return res.status(200).json({
        ok: true,
        message: 'No MFP meals or water found for that day.',
        items_found: 0,
        items_written: 0,
        ...result,
      });
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return syncError(res, e);
  }
}
