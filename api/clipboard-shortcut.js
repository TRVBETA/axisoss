import { supabaseRequest } from './_supabase.js';

function getShortcutSecret() {
  return process.env.CLIPBOARD_SHARED_SECRET || process.env.SHORTCUT_SHARED_SECRET || '';
}

function isAuthorized(req) {
  const expected = getShortcutSecret();
  if (!expected) return true;

  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers['x-axis-secret'] || req.headers['x-shortcut-secret'] || '';
  const bodySecret = req.body?.secret || req.body?.token || '';
  const querySecret = req.query?.secret || req.query?.token || '';

  return [bearer, headerSecret, bodySecret, querySecret].some(v => String(v || '').trim() === expected);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'AXIS CLIPBOARD SHORTCUT ENDPOINT READY' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED SHORTCUT REQUEST' });
  }

  const content = String(req.body?.content || req.body?.text || '').trim();
  const source = String(req.body?.source || 'iphone_shortcut').trim();
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
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE CLIPBOARD SHORTCUT ITEM' });
  }
}