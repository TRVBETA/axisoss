import { isAuthenticatedRequest } from './_axisAuth.js';
import { supabaseRequest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  try {
    const rows = await supabaseRequest('sleep_circadian_logs?select=log_date,hours_slept,wake_time,quality_rating,logged_at&order=log_date.desc&limit=14');
    return res.status(200).json({ ok: true, rows: rows || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD SLEEP FEED' });
  }
}
