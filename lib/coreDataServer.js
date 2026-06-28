import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';

function currentAxisDayKey() {
  const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(shifted);
}

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
  let todos;
  try {
    todos = await supabaseRequest('core_todos?select=id,title,is_done,is_daily,points,last_reset_key,created_at,updated_at&order=created_at.desc&limit=50');
  } catch {
    todos = await supabaseRequest('core_todos?select=id,title,is_done,created_at,updated_at&order=created_at.desc&limit=50');
  }

  const dayKey = currentAxisDayKey();
  const normalized = (todos || []).map(todo => ({
    ...todo,
    is_daily: !!todo.is_daily,
    points: Number(todo.points || 1),
    last_reset_key: todo.last_reset_key || dayKey
  }));

  const dailyToReset = normalized.filter(todo => todo.is_daily && todo.last_reset_key !== dayKey && todo.is_done);
  for (const todo of dailyToReset) {
    try {
      await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(todo.id)}`, {
        method: 'PATCH',
        body: {
          is_done: false,
          last_reset_key: dayKey,
          updated_at: new Date().toISOString()
        }
      });
      todo.is_done = false;
      todo.last_reset_key = dayKey;
    } catch {}
  }

  return {
    balance,
    todos: normalized
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

export async function createTodo({ title, isDaily = false, points = 1 }) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('TODO TITLE REQUIRED');
  const dayKey = currentAxisDayKey();
  try {
    const rows = await supabaseRequest('core_todos', {
      method: 'POST',
      body: {
        title: clean,
        is_done: false,
        is_daily: !!isDaily,
        points: Math.max(1, Number(points || 1)),
        last_reset_key: dayKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch {
    const rows = await supabaseRequest('core_todos', {
      method: 'POST',
      body: {
        title: clean,
        is_done: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { ...row, is_daily: !!isDaily, points: Math.max(1, Number(points || 1)), last_reset_key: dayKey };
  }
}

export async function toggleTodo(id, isDone) {
  const payload = {
    is_done: !!isDone,
    updated_at: new Date().toISOString()
  };
  try {
    payload.last_reset_key = currentAxisDayKey();
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch {
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { is_done: !!isDone, updated_at: new Date().toISOString() }
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }
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
