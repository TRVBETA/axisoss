import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { supabaseRequest } from '../lib/supabaseServer.js';

function getShortcutSecret() {
  return process.env.CLIPBOARD_SHARED_SECRET || process.env.SHORTCUT_SHARED_SECRET || '';
}

function isShortcutAuthorized(req) {
    const expected = getShortcutSecret();
    if (!expected) return false; // no secret configured = shortcut path disabled

  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers['x-axis-secret'] || req.headers['x-shortcut-secret'] || '';
  const bodySecret = req.body?.secret || req.body?.token || '';
  const querySecret = req.query?.secret || req.query?.token || '';

  return [bearer, headerSecret, bodySecret, querySecret].some(v => String(v || '').trim() === expected);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
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

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (action === 'reset') {
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

  if (action === 'delete') {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }
    const id = String(req.body?.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'ITEM ID REQUIRED' });
    try {
      await supabaseRequest(`clipboard_items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true, message: 'CLIPBOARD ITEM DELETED' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO DELETE CLIPBOARD ITEM' });
    }
  }

  const allow = isAuthenticatedRequest(req) || isShortcutAuthorized(req);
  if (!allow) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  const content = String(req.body?.content || req.body?.text || '').trim();
  const source = String(req.body?.source || (isAuthenticatedRequest(req) ? 'axis_web' : 'iphone_shortcut')).trim();
  if (!content) {
    return res.status(400).json({ ok: false, error: 'CONTENT REQUIRED' });
  }
  if (content.length > 12000) {
    return res.status(400).json({ ok: false, error: 'CONTENT TOO LONG' });
  }

  try {
    const rows = await supabaseRequest('clipboard_items', {
      method: 'POST',
      body: { content, source, created_at: new Date().toISOString() }
    });
    return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE CLIPBOARD ITEM' });
  }
}