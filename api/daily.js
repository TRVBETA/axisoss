import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { applyDailyAction, getDailyTelemetry, upsertDailyTelemetry } from '../lib/dailyServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const row = await getDailyTelemetry();
      return res.status(200).json({ ok: true, row });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD DAILY TELEMETRY' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    let row;
    if (action) {
      row = await applyDailyAction(action, req.body || {});
    } else {
      row = await upsertDailyTelemetry(req.body || {});
    }
    return res.status(200).json({ ok: true, row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO UPDATE DAILY TELEMETRY' });
  }
}