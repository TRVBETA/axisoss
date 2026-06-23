import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { clearNutritionLogs, fetchNutritionSummary, writeNutritionLog } from '../lib/nutritionServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const data = await fetchNutritionSummary();
      return res.status(200).json({ ok: true, ...data });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD NUTRITION FEED' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (action === 'reset') {
    try {
      await clearNutritionLogs();
      return res.status(200).json({ ok: true, message: 'NUTRITION LOGS CLEARED' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO CLEAR NUTRITION LOGS' });
    }
  }

  const text = String(req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'TEXT REQUIRED' });
  }

  try {
    const result = await writeNutritionLog(text, 'axis_web');
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOG NUTRITION' });
  }
}