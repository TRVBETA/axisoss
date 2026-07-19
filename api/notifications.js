import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { createNotificationRule, deleteNotificationRule, fetchNotificationRules, markNotificationRuleFired, updateNotificationRule } from '../lib/notificationServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await fetchNotificationRules(100);
      return res.status(200).json({ ok: true, rows });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD NOTIFICATIONS' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();

  try {
    if (action === 'delete') {
      await deleteNotificationRule(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }
    if (action === 'mark-fired') {
      const row = await markNotificationRuleFired(String(req.body?.id || ''), req.body?.firedAt);
      return res.status(200).json({ ok: true, row });
    }
    if (action === 'update') {
      const row = await updateNotificationRule(String(req.body?.id || ''), req.body || {});
      return res.status(200).json({ ok: true, row });
    }
    const row = await createNotificationRule(req.body || {});
    return res.status(200).json({ ok: true, row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE NOTIFICATION RULE' });
  }
}