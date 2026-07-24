// AXIS V5 // MFP sync endpoint
// Triggers a scrape of today's MyFitnessPal food diary, parses
// the entries, and posts them to the nutrition log.
//
// Auth: requires the same SHORTCUT_SHARED_SECRET used by the
// iOS Shortcut path. The MFP credentials come from Vercel env
// vars (MFP_USERNAME, MFP_PASSWORD) — never from the request body.
//
// Methods:
//   POST /api/mfp-sync        — sync today's diary
//   POST /api/mfp-sync        — sync a specific date (body: { date: "YYYY-MM-DD" })
//   GET  /api/mfp-sync        — health check (returns config status, no MFP call)
//
// Cron usage: configure Vercel cron to call this endpoint nightly
// (see vercel.json). The shared secret goes in the x-axis-secret
// header.

import { scrapeMfpDiary } from '../lib/mfpScraper.js';
import { writeNutritionMacros } from '../lib/nutritionServer.js';
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

export default async function handler(req, res) {
  // Auth gate: session cookie OR shared secret
  if (!isAuthenticatedRequest(req) && !isShortcutAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  // Health check
  if (req.method === 'GET') {
    const creds = getMfpCredentials();
    return res.status(200).json({
      ok: true,
      mfp_configured: Boolean(creds.username && creds.password),
      mfp_username_set: Boolean(creds.username),
      mfp_password_set: Boolean(creds.password),
      secret_configured: Boolean(getShortcutSecret()),
    });
  }

  // Sync
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const creds = getMfpCredentials();
  if (!creds.username || !creds.password) {
    return res.status(503).json({
      ok: false,
      error: 'MFP credentials not configured. Set MFP_USERNAME and MFP_PASSWORD in Vercel env vars.',
    });
  }

  // Date: default to today (local time). Body can override.
  const date = req.body?.date ? new Date(req.body.date) : new Date();
  if (req.body?.date && Number.isNaN(date.getTime())) {
    return res.status(400).json({ ok: false, error: 'INVALID DATE' });
  }

  try {
    const { entries, items, duration, rawHtmlLength } = await scrapeMfpDiary({
      username: creds.username,
      password: creds.password,
      date,
    });

    if (!entries.length) {
      return res.status(200).json({
        ok: true,
        message: 'NO MFP ENTRIES FOUND',
        items_found: 0,
        items_written: 0,
        duration_ms: duration,
        html_size: rawHtmlLength,
      });
    }

    const result = await writeNutritionMacros(entries, 'apple_health');

    return res.status(200).json({
      ok: true,
      items_found: items.length,
      items_written: result?.rows?.length ?? items.length,
      duration_ms: duration,
      html_size: rawHtmlLength,
    });
  } catch (e) {
    // Cloudflare / login / parse errors
    const msg = String(e?.message || 'MFP SYNC FAILED');
    return res.status(502).json({
      ok: false,
      error: msg,
      hint: msg.includes('Cloudflare')
        ? 'Server fetch blocked. Set up spider.cloud or use MFP email export.'
        : undefined,
    });
  }
}
