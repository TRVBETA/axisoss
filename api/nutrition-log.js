import { isAuthenticatedRequest } from './_axisAuth.js';
import { writeNutritionLog } from './_nutritionServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
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
