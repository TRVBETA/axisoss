import { isAuthenticatedRequest } from './_axisAuth.js';
import { supabaseRequest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  try {
    await supabaseRequest('clipboard_items?id=not.is.null', { method: 'DELETE' });
    return res.status(200).json({ ok: true, message: 'CLIPBOARD CLEARED' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO CLEAR CLIPBOARD' });
  }
}