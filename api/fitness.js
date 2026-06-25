import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { upsertDailyTelemetry } from '../lib/dailyServer.js';
import { clearAllFitnessData, fetchFitnessFeed, writeWorkoutSession } from '../lib/fitnessServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const feed = await fetchFitnessFeed();
      return res.status(200).json({ ok: true, ...feed });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD FITNESS FEED' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (action === 'reset') {
    try {
      await clearAllFitnessData();
      await upsertDailyTelemetry({ gym_logged: false, gym_split_name: 'None' });
      return res.status(200).json({ ok: true, message: 'FITNESS DATA CLEARED' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO CLEAR FITNESS DATA' });
    }
  }

  const splitName = String(req.body?.splitName || '').trim();
  const loggedAt = req.body?.loggedAt || null;
  const exercises = Array.isArray(req.body?.exercises) ? req.body.exercises : [];
  if (!exercises.length) {
    return res.status(400).json({ ok: false, error: 'NO EXERCISES PROVIDED' });
  }

  try {
    const result = await writeWorkoutSession({ splitName, exercises, loggedAt });
    return res.status(200).json({
      ok: true,
      splitName: result.splitName,
      exerciseCount: result.exerciseCount,
      setCount: result.setCount
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO WRITE FITNESS SESSION' });
  }
}