import {
  clearNutritionLogs,
  deleteNutritionBatch,
  deleteNutritionCustomFood,
  deleteNutritionMealTemplate,
  fetchLatestNutritionBatch,
  fetchNutritionSummary,
  replaceLatestNutritionBatch,
  saveNutritionCustomFood,
  saveNutritionMealTemplate,
  undoLatestNutritionBatch,
  writeNutritionLog
} from '../lib/nutritionServer.js';
import { isAuthenticatedRequest } from '../lib/axisAuth.js';

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

  try {
    if (action === 'reset') {
      await clearNutritionLogs();
      return res.status(200).json({ ok: true, message: 'NUTRITION LOGS CLEARED' });
    }

    if (action === 'undo-last') {
      const removed = await undoLatestNutritionBatch();
      return res.status(200).json({ ok: true, removed });
    }

    if (action === 'latest-batch') {
      const latestBatch = await fetchLatestNutritionBatch();
      return res.status(200).json({ ok: true, latestBatch });
    }

    if (action === 'delete-batch') {
      await deleteNutritionBatch(String(req.body?.loggedAt || ''));
      return res.status(200).json({ ok: true });
    }

    if (action === 'save-custom-food') {
      const row = await saveNutritionCustomFood(req.body || {});
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'delete-custom-food') {
      await deleteNutritionCustomFood(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    if (action === 'save-template') {
      const row = await saveNutritionMealTemplate(req.body || {});
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'delete-template') {
      await deleteNutritionMealTemplate(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    const text = String(req.body?.text || '').trim();
    const mode = String(req.body?.mode || 'auto').trim().toLowerCase();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'TEXT REQUIRED' });
    }

    const result = action === 'replace-last'
      ? await replaceLatestNutritionBatch(text, 'axis_web', { defaultMode: mode })
      : await writeNutritionLog(text, 'axis_web', { defaultMode: mode });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const message = e.message || 'FAILED TO LOG NUTRITION';
    const status = /DUPLICATE NUTRITION BATCH BLOCKED/i.test(message)
      ? 409
      : /NO FOOD ITEMS PARSED|No reliable piece data|Unsupported unit|No cup conversion found|No match found|CUSTOM FOOD NAME REQUIRED|TEMPLATE NAME REQUIRED|TEMPLATE BODY REQUIRED/i.test(message)
        ? 400
        : 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
