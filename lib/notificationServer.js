import { supabaseRequest } from './supabaseServer.js';

const VALID_UNITS = new Set(['minutes', 'hours', 'days']);

function normalizeUnit(unit) {
  const clean = String(unit || '').trim().toLowerCase();
  return VALID_UNITS.has(clean) ? clean : 'hours';
}

function normalizeRule(input = {}) {
  return {
    title: String(input.title || '').trim() || 'AXIS Reminder',
    message: String(input.message || '').trim() || 'AXIS notification',
    enabled: !!input.enabled,
    start_at: new Date(input.startAt || input.start_at || new Date().toISOString()).toISOString(),
    repeat_value: Math.max(1, parseInt(input.repeatValue ?? input.repeat_value ?? 1, 10) || 1),
    repeat_unit: normalizeUnit(input.repeatUnit || input.repeat_unit),
    last_fired_at: input.lastFiredAt || input.last_fired_at || null,
    updated_at: new Date().toISOString()
  };
}

export async function fetchNotificationRules(limit = 100) {
  const rows = await supabaseRequest(`notification_rules?select=id,title,message,enabled,start_at,repeat_value,repeat_unit,last_fired_at,created_at,updated_at&order=created_at.desc&limit=${limit}`);
  return rows || [];
}

export async function createNotificationRule(payload) {
  const rule = normalizeRule(payload);
  const rows = await supabaseRequest('notification_rules', {
    method: 'POST',
    body: {
      ...rule,
      created_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function updateNotificationRule(id, payload) {
  const rule = normalizeRule(payload);
  const rows = await supabaseRequest(`notification_rules?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: rule
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function deleteNotificationRule(id) {
  await supabaseRequest(`notification_rules?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function markNotificationRuleFired(id, firedAt = new Date().toISOString()) {
  const rows = await supabaseRequest(`notification_rules?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      last_fired_at: firedAt,
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}
