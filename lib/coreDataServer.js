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

function cairoDateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00+02:00`);
}

function shiftedCairoNow() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function formatCairoDayKey(dateObj) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

function listAxisDayKeys(days = 7, endKey = currentAxisDayKey()) {
  const endDate = cairoDateFromKey(endKey);
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(formatCairoDayKey(d));
  }
  return keys;
}

function hoursSince(isoValue) {
  if (!isoValue) return null;
  const t = new Date(isoValue).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / (1000 * 60 * 60));
}

function formatSinceShort(isoValue) {
  const hours = hoursSince(isoValue);
  if (hours == null) return '—';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function average(numbers = []) {
  const valid = numbers.filter(v => Number.isFinite(Number(v)));
  if (!valid.length) return 0;
  return valid.reduce((sum, v) => sum + Number(v), 0) / valid.length;
}

function delta(current, previous) {
  return Number((Number(current || 0) - Number(previous || 0)).toFixed(1));
}

function markerDateStatus(targetDate, todayKey) {
  if (!targetDate) return 'none';
  if (targetDate < todayKey) return 'past';
  if (targetDate === todayKey) return 'today';
  return 'future';
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

  const markers = await fetchAxisMarkers(80);
  return {
    balance,
    todos: normalized,
    markers
  };
}

export async function fetchAxisMarkers(limit = 80) {
  try {
    const rows = await supabaseRequest(`axis_markers?select=id,title,marker_type,target_date,is_done,note,created_at,updated_at&order=target_date.asc&limit=${limit}`);
    return (rows || []).map(row => ({
      ...row,
      marker_type: row.marker_type || 'deadline',
      is_done: !!row.is_done,
      note: row.note || ''
    }));
  } catch {
    return [];
  }
}

export async function saveAxisMarker({ id = '', title = '', markerType = 'deadline', targetDate = '', note = '', isDone = false }) {
  const cleanTitle = String(title || '').trim();
  const cleanDate = String(targetDate || '').trim();
  if (!cleanTitle) throw new Error('MARKER TITLE REQUIRED');
  if (!cleanDate) throw new Error('MARKER DATE REQUIRED');
  const payload = {
    title: cleanTitle,
    marker_type: String(markerType || 'deadline').trim() || 'deadline',
    target_date: cleanDate,
    note: String(note || '').trim(),
    is_done: !!isDone,
    updated_at: new Date().toISOString()
  };
  let row;
  if (id) {
    const rows = await supabaseRequest(`axis_markers?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  } else {
    const rows = await supabaseRequest('axis_markers', {
      method: 'POST',
      body: {
        ...payload,
        created_at: new Date().toISOString()
      }
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  }
  return row;
}

export async function deleteAxisMarker(id) {
  if (!id) return true;
  await supabaseRequest(`axis_markers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function toggleAxisMarkerDone(id, isDone) {
  if (!id) throw new Error('MARKER ID REQUIRED');
  const rows = await supabaseRequest(`axis_markers?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      is_done: !!isDone,
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function fetchWeeklyReviewSummary() {
  const currentKeys = listAxisDayKeys(7);
  const previousKeys = listAxisDayKeys(14).slice(0, 7);
  const currentStart = currentKeys[0];
  const currentEnd = currentKeys[currentKeys.length - 1];
  const previousStart = previousKeys[0];
  const previousEnd = previousKeys[previousKeys.length - 1];

  const dailyRows = await supabaseRequest(`daily_debrief_logs?select=log_date,gym_logged,gym_split_name,design_hours,sleep_hours,water_liters,went_outside,watched_tutorial,daily_score,created_at&log_date=gte.${currentStart}&order=log_date.asc&limit=30`).catch(() => []);
  const previousDailyRows = await supabaseRequest(`daily_debrief_logs?select=log_date,gym_logged,design_hours,sleep_hours,water_liters,went_outside,watched_tutorial,daily_score&log_date=gte.${previousStart}&log_date=lte.${previousEnd}&order=log_date.asc&limit=30`).catch(() => []);
  const fitnessRows = await supabaseRequest(`fitness_sessions?select=id,split_name,logged_at&logged_at=gte.${encodeURIComponent(cairoDateFromKey(previousStart).toISOString())}&order=logged_at.desc&limit=80`).catch(() => []);
  const nutritionRows = await supabaseRequest(`nutrition_logs?select=id,protein,calories,logged_at&logged_at=gte.${encodeURIComponent(cairoDateFromKey(previousStart).toISOString())}&order=logged_at.desc&limit=500`).catch(() => []);
  const taskEventRows = await supabaseRequest(`core_task_events?select=id,event_type,created_at&created_at=gte.${encodeURIComponent(cairoDateFromKey(previousStart).toISOString())}&order=created_at.desc&limit=300`).catch(() => []);
  const markers = await fetchAxisMarkers(60);

  const fitnessCurrent = (fitnessRows || []).filter(row => {
    const key = formatCairoDayKey(new Date(row.logged_at));
    return currentKeys.includes(key);
  });
  const fitnessPrevious = (fitnessRows || []).filter(row => {
    const key = formatCairoDayKey(new Date(row.logged_at));
    return previousKeys.includes(key);
  });

  function nutritionByDay(rows, keys) {
    const map = Object.fromEntries(keys.map(key => [key, { protein: 0, calories: 0 }]));
    (rows || []).forEach(row => {
      const key = formatCairoDayKey(new Date(row.logged_at));
      if (!map[key]) return;
      map[key].protein += Number(row.protein || 0);
      map[key].calories += Number(row.calories || 0);
    });
    return map;
  }

  const currentNutritionDays = nutritionByDay(nutritionRows, currentKeys);
  const previousNutritionDays = nutritionByDay(nutritionRows, previousKeys);
  const currentProteinHitDays = Object.values(currentNutritionDays).filter(day => day.protein >= 140).length;
  const previousProteinHitDays = Object.values(previousNutritionDays).filter(day => day.protein >= 140).length;

  const currentTasksCompleted = (taskEventRows || []).filter(row => {
    const key = formatCairoDayKey(new Date(row.created_at));
    return currentKeys.includes(key) && String(row.event_type || '').toLowerCase() === 'completed';
  }).length;
  const previousTasksCompleted = (taskEventRows || []).filter(row => {
    const key = formatCairoDayKey(new Date(row.created_at));
    return previousKeys.includes(key) && String(row.event_type || '').toLowerCase() === 'completed';
  }).length;

  const currentSleepAvg = average((dailyRows || []).filter(row => currentKeys.includes(row.log_date)).map(row => Number(row.sleep_hours || 0)).filter(v => v > 0));
  const previousSleepAvg = average((previousDailyRows || []).map(row => Number(row.sleep_hours || 0)).filter(v => v > 0));
  const currentScoreAvg = average((dailyRows || []).filter(row => currentKeys.includes(row.log_date)).map(row => Number(row.daily_score || 0)));
  const previousScoreAvg = average((previousDailyRows || []).map(row => Number(row.daily_score || 0)));
  const currentOutsideDays = (dailyRows || []).filter(row => currentKeys.includes(row.log_date) && row.went_outside).length;
  const previousOutsideDays = (previousDailyRows || []).filter(row => row.went_outside).length;

  const latestWorkout = (fitnessRows || [])[0] || null;
  const latestOutside = [...(dailyRows || []), ...(previousDailyRows || [])].filter(row => row.went_outside).sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)))[0] || null;
  const latestDesign = [...(dailyRows || []), ...(previousDailyRows || [])].filter(row => Number(row.design_hours || 0) > 0).sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)))[0] || null;

  const todayKey = currentAxisDayKey();
  const next14Keys = listAxisDayKeys(14);
  const markerMap = Object.fromEntries(next14Keys.map(key => [key, []]));
  markers.forEach(marker => {
    if (markerMap[marker.target_date]) markerMap[marker.target_date].push(marker);
  });

  return {
    currentKeys,
    previousKeys,
    metrics: {
      tasksCompleted: currentTasksCompleted,
      tasksDelta: delta(currentTasksCompleted, previousTasksCompleted),
      workouts: fitnessCurrent.length,
      workoutsDelta: delta(fitnessCurrent.length, fitnessPrevious.length),
      proteinHitDays: currentProteinHitDays,
      proteinHitDelta: delta(currentProteinHitDays, previousProteinHitDays),
      outsideDays: currentOutsideDays,
      outsideDelta: delta(currentOutsideDays, previousOutsideDays),
      avgSleep: Number(currentSleepAvg.toFixed(1)),
      avgSleepDelta: delta(Number(currentSleepAvg.toFixed(1)), Number(previousSleepAvg.toFixed(1))),
      avgScore: Number(currentScoreAvg.toFixed(1)),
      avgScoreDelta: delta(Number(currentScoreAvg.toFixed(1)), Number(previousScoreAvg.toFixed(1)))
    },
    since: {
      workout: latestWorkout ? formatSinceShort(latestWorkout.logged_at) : '—',
      outside: latestOutside ? formatSinceShort(`${latestOutside.log_date}T12:00:00+02:00`) : '—',
      design: latestDesign ? formatSinceShort(`${latestDesign.log_date}T12:00:00+02:00`) : '—'
    },
    markerCalendar: next14Keys.map(key => ({
      dayKey: key,
      items: markerMap[key] || [],
      status: markerDateStatus(key, todayKey)
    })),
    upcomingMarkers: markers.filter(marker => !marker.is_done).slice(0, 8)
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
