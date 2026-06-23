import { isAuthenticatedRequest } from './_axisAuth.js';
import { fetchNutritionSummary } from './_nutritionServer.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  try {
    const data = await fetchNutritionSummary();
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD NUTRITION FEED' });
  }
}
