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
    const rows = await supabaseRequest('clipboard_items?select=id,content,source,created_at&order=created_at.desc&limit=20');
    return res.status(200).json({ ok: true, rows: rows || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD CLIPBOARD' });
  }
}