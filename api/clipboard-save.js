import { isAuthenticatedRequest } from './_axisAuth.js';
import { supabaseRequest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  const content = String(req.body?.content || '').trim();
  const source = String(req.body?.source || 'axis_web').trim();
  if (!content) {
    return res.status(400).json({ ok: false, error: 'CONTENT REQUIRED' });
  }
  if (content.length > 12000) {
    return res.status(400).json({ ok: false, error: 'CONTENT TOO LONG' });
  }

  try {
    const rows = await supabaseRequest('clipboard_items', {
      method: 'POST',
      body: {
        content,
        source,
        created_at: new Date().toISOString()
      }
    });
    return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE CLIPBOARD ITEM' });
  }
}