import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';

async function logTaskEvent({ taskId = null, eventType, titleSnapshot = '', pointsSnapshot = 1, isDailySnapshot = false }) {
  try {
    await supabaseRequest('core_task_events', {
      method: 'POST',
      body: {
        task_id: taskId,
        event_type: String(eventType || 'updated'),
        title_snapshot: String(titleSnapshot || '').trim(),
        points_snapshot: Number(pointsSnapshot || 1),
        is_daily_snapshot: !!isDailySnapshot,
        created_at: new Date().toISOString()
      }
    });
  } catch {
    // keep task flow working even if history logging fails
  }
}

export function currentAxisDayKey() {
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
    todos = await supabaseRequest('core_todos?select=id,title,is_done,completed_day_key,created_at,updated_at&order=created_at.desc&limit=50');
  }

  const dayKey = currentAxisDayKey();
  const normalized = (todos || []).map(todo => ({
    ...todo,
    is_daily: !!todo.is_daily,
    points: Number(todo.points || 1),
    last_reset_key: todo.last_reset_key || dayKey,
    completed_day_key: todo.completed_day_key || null
  }));

  const dailyToReset = normalized.filter(todo => todo.is_daily && todo.last_reset_key !== dayKey && todo.is_done);
  for (const todo of dailyToReset) {
    try {
      await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(todo.id)}`, {
        method: 'PATCH',
        body: {
          is_done: false,
          completed_day_key: null,
          last_reset_key: dayKey,
          updated_at: new Date().toISOString()
        }
      });
      todo.is_done = false;
      todo.completed_day_key = null;
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
  const safePoints = Math.max(1, Number(points || 1));
  let row;
  try {
    const rows = await supabaseRequest('core_todos', {
      method: 'POST',
      body: {
        title: clean,
        is_done: false,
        is_daily: !!isDaily,
        points: safePoints,
        last_reset_key: dayKey,
        completed_day_key: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  } catch {
    const rows = await supabaseRequest('core_todos', {
      method: 'POST',
      body: {
        title: clean,
        is_done: false,
        completed_day_key: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
    const inserted = Array.isArray(rows) ? rows[0] : rows;
    row = { ...inserted, is_daily: !!isDaily, points: safePoints, last_reset_key: dayKey, completed_day_key: null };
  }
  await logTaskEvent({ taskId: row?.id || null, eventType: 'created', titleSnapshot: clean, pointsSnapshot: safePoints, isDailySnapshot: !!isDaily });
  return row;
}

export async function toggleTodo(id, isDone) {
  const existingRows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}&select=id,title,points,is_daily`);
  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  const payload = {
    is_done: !!isDone,
    completed_day_key: !!isDone ? currentAxisDayKey() : null,
    updated_at: new Date().toISOString()
  };
  let row;
  try {
    payload.last_reset_key = currentAxisDayKey();
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  } catch {
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { is_done: !!isDone, completed_day_key: !!isDone ? currentAxisDayKey() : null, updated_at: new Date().toISOString() }
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  }
  await logTaskEvent({
    taskId: id,
    eventType: isDone ? 'completed' : 'reopened',
    titleSnapshot: existing?.title || '',
    pointsSnapshot: Number(existing?.points || 1),
    isDailySnapshot: !!existing?.is_daily
  });
  return row;
}

export async function deleteTodo(id) {
  const existingRows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}&select=id,title,points,is_daily`);
  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  await logTaskEvent({
    taskId: id,
    eventType: 'deleted',
    titleSnapshot: existing?.title || '',
    pointsSnapshot: Number(existing?.points || 1),
    isDailySnapshot: !!existing?.is_daily
  });
  return true;
}

export async function clearCompletedTodos() {
  const completed = await supabaseRequest('core_todos?is_done=eq.true&select=id,title,points,is_daily');
  for (const todo of completed || []) {
    await logTaskEvent({
      taskId: todo.id,
      eventType: 'cleared_done',
      titleSnapshot: todo.title || '',
      pointsSnapshot: Number(todo.points || 1),
      isDailySnapshot: !!todo.is_daily
    });
  }
  await supabaseRequest('core_todos?is_done=eq.true', { method: 'DELETE' });
  return true;
}

export async function fetchTaskHistory(limit = 100) {
  const rows = await supabaseRequest(`core_task_events?select=id,task_id,event_type,title_snapshot,points_snapshot,is_daily_snapshot,created_at&order=created_at.desc&limit=${limit}`);
  return rows || [];
}

export function buildUpsertHeaders() {
  return supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
}
