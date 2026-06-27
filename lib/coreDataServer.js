import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';

export async function ensureCoreBalanceRow() {
  const rows = await supabaseRequest('core_balance?select=id,label,amount,updated_at&order=updated_at.desc&limit=1');
  if (Array.isArray(rows) && rows.length > 0) return rows[0];

  const inserted = await supabaseRequest('core_balance', {
    method: 'POST',
    body: {
      label: 'Main Balance',
      amount: 0,
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

export async function fetchCoreData() {
  const balance = await ensureCoreBalanceRow();
  const todos = await supabaseRequest('core_todos?select=id,title,is_done,created_at,updated_at&order=created_at.desc&limit=50');
  return {
    balance,
    todos: todos || []
  };
}

export async function updateBalance({ id, label, amount }) {
  const balance = await ensureCoreBalanceRow();
  const targetId = id || balance.id;
  const payload = {
    label: String(label || balance.label || 'Main Balance').trim() || 'Main Balance',
    amount: Number(amount || 0),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRequest(`core_balance?id=eq.${encodeURIComponent(targetId)}`, {
    method: 'PATCH',
    body: payload
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function createTodo(title) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('TODO TITLE REQUIRED');
  const rows = await supabaseRequest('core_todos', {
    method: 'POST',
    body: {
      title: clean,
      is_done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function toggleTodo(id, isDone) {
  const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      is_done: !!isDone,
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function deleteTodo(id) {
  await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return true;
}

export async function clearCompletedTodos() {
  await supabaseRequest('core_todos?is_done=eq.true', { method: 'DELETE' });
  return true;
}

export function buildUpsertHeaders() {
  return supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
}
