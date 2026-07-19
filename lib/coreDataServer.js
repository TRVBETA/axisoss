import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';
import { AXIS_V4, calculateTaskPointsAuto, clampEffectiveTaskPoints, isMustWinTask, normalizeTodoForV4, taskCanCommitForPoints } from './axisScoreV4.js';

async function logTaskEvent({ taskId = null, eventType, titleSnapshot = '', pointsSnapshot = 1, isDailySnapshot = false, taskKindSnapshot = 'task', modeSnapshot = 'desk', dayKey = currentAxisDayKey() }) {
  try {
    await supabaseRequest('core_task_events', {
      method: 'POST',
      body: {
        task_id: taskId,
        event_type: String(eventType || 'updated'),
        title_snapshot: String(titleSnapshot || '').trim(),
        points_snapshot: Number(pointsSnapshot || 1),
        is_daily_snapshot: !!isDailySnapshot,
        task_kind_snapshot: String(taskKindSnapshot || 'task'),
        mode_snapshot: String(modeSnapshot || 'desk'),
        day_key: dayKey,
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
    todos = await supabaseRequest('core_todos?select=id,title,is_done,is_daily,points,task_kind,mode,impact,resistance,depth,points_auto,must_win,done_definition,status,committed_at,incoming_critical,last_reset_key,completed_day_key,created_at,updated_at&order=created_at.desc&limit=80');
  } catch {
    todos = await supabaseRequest('core_todos?select=id,title,is_done,completed_day_key,created_at,updated_at&order=created_at.desc&limit=80');
  }

  const dayKey = currentAxisDayKey();
  const normalized = (todos || []).map(todo => ({
    ...normalizeTodoForV4(todo),
    is_daily: !!todo.is_daily,
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
  const momentum = await fetchTaskMomentum(normalized);
  return {
    balance,
    todos: normalized,
    markers,
    momentum
  };
}

function getStreakTier(days = 0) {
  const value = Number(days || 0);
  if (value >= 14) return { key: 'inferno', label: 'INFERNO', rank: 5 };
  if (value >= 8) return { key: 'blaze', label: 'BLAZE', rank: 4 };
  if (value >= 5) return { key: 'flare', label: 'FLARE', rank: 3 };
  if (value >= 3) return { key: 'spark', label: 'SPARK', rank: 2 };
  if (value >= 1) return { key: 'ember', label: 'EMBER', rank: 1 };
  return { key: 'none', label: 'NONE', rank: 0 };
}

function summarizeStreakDays(daySet = new Set(), title = 'Task', taskId = '', mode = 'desk') {
  const days = [...daySet].sort();
  let longest = 0;
  let currentRun = 0;
  let activeRun = 0;
  let prev = null;

  for (const day of days) {
    const date = new Date(`${day}T12:00:00+02:00`);
    if (!prev) {
      activeRun = 1;
      longest = 1;
      prev = date;
      continue;
    }
    const diff = Math.round((date - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) activeRun += 1;
    else activeRun = 1;
    longest = Math.max(longest, activeRun);
    prev = date;
  }

  const currentKey = currentAxisDayKey();
  const currentDate = new Date(`${currentKey}T12:00:00+02:00`);
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - i);
    const key = formatCairoDayKey(d);
    if (daySet.has(key)) currentRun += 1;
    else break;
  }

  const tier = getStreakTier(currentRun || longest);
  return {
    task_id: taskId,
    title,
    mode,
    completionDays: days.length,
    currentStreak: currentRun,
    longestStreak: Math.max(longest, currentRun),
    lastCompletedDay: days[days.length - 1] || null,
    tier
  };
}

function summarizeMomentumGroup(items = []) {
  const active = items.filter(item => item.currentStreak > 0).length;
  const currentBest = items.reduce((max, item) => Math.max(max, Number(item.currentStreak || 0)), 0);
  const longestBest = items.reduce((max, item) => Math.max(max, Number(item.longestStreak || 0)), 0);
  const totalCurrent = items.reduce((sum, item) => sum + Number(item.currentStreak || 0), 0);
  return {
    active,
    currentBest,
    longestBest,
    totalCurrent,
    tier: getStreakTier(currentBest)
  };
}

export async function fetchTaskMomentum(todos = []) {
  try {
    const rows = await supabaseRequest('core_task_events?select=task_id,title_snapshot,event_type,day_key,task_kind_snapshot,mode_snapshot,created_at&order=created_at.desc&limit=2000');
    const taskMap = new Map();
    const ritualMap = new Map();

    for (const row of rows || []) {
      if (!row.task_id || row.event_type !== 'completed' || !row.day_key) continue;
      const target = String(row.task_kind_snapshot || 'task').toLowerCase() === 'ritual' ? ritualMap : taskMap;
      if (!target.has(row.task_id)) {
        target.set(row.task_id, {
          title: row.title_snapshot || 'Task',
          mode: row.mode_snapshot || 'desk',
          days: new Set()
        });
      }
      target.get(row.task_id).days.add(row.day_key);
    }

    for (const todo of todos || []) {
      const target = String(todo.task_kind || 'task') === 'ritual' ? ritualMap : taskMap;
      if (!target.has(todo.id)) {
        target.set(todo.id, {
          title: todo.title || 'Task',
          mode: todo.mode || 'desk',
          days: new Set()
        });
      }
    }

    const tasks = [...taskMap.entries()].map(([taskId, info]) => summarizeStreakDays(info.days, info.title, taskId, info.mode))
      .sort((a, b) => (b.currentStreak - a.currentStreak) || (b.longestStreak - a.longestStreak) || b.completionDays - a.completionDays);
    const rituals = [...ritualMap.entries()].map(([taskId, info]) => summarizeStreakDays(info.days, info.title, taskId, info.mode))
      .sort((a, b) => (b.currentStreak - a.currentStreak) || (b.longestStreak - a.longestStreak) || b.completionDays - a.completionDays);

    const taskTotals = summarizeMomentumGroup(tasks);
    const ritualTotals = summarizeMomentumGroup(rituals);

    return {
      tasks,
      rituals,
      taskTotals,
      ritualTotals,
      totalCurrent: taskTotals.currentBest,
      totalLongest: taskTotals.longestBest,
      overallTier: taskTotals.tier
    };
  } catch {
    return {
      tasks: [],
      rituals: [],
      taskTotals: { active: 0, currentBest: 0, longestBest: 0, totalCurrent: 0, tier: getStreakTier(0) },
      ritualTotals: { active: 0, currentBest: 0, longestBest: 0, totalCurrent: 0, tier: getStreakTier(0) },
      totalCurrent: 0,
      totalLongest: 0,
      overallTier: getStreakTier(0)
    };
  }
}

export async function fetchRitualMomentum() {
  const momentum = await fetchTaskMomentum();
  return {
    rituals: momentum.rituals || [],
    totalCurrent: momentum.ritualTotals?.currentBest || 0,
    totalLongest: momentum.ritualTotals?.longestBest || 0
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

export async function createTodo({ title, isDaily = false, points = 1, taskKind = 'task', mode = 'desk', impact = 1, resistance = 1, depth = 0, doneDefinition = '', incomingCritical = false }) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('TODO TITLE REQUIRED');
  const dayKey = currentAxisDayKey();
  const kind = String(taskKind || 'task').trim().toLowerCase() === 'ritual' ? 'ritual' : 'task';
  const normalizedMode = kind === 'ritual' ? 'desk' : String(mode || 'desk').trim().toLowerCase();
  const safeImpact = kind === 'ritual' ? 1 : [1,2,3].includes(Number(impact)) ? Number(impact) : 1;
  const safeResistance = kind === 'ritual' ? 1 : [1,2,3].includes(Number(resistance)) ? Number(resistance) : 1;
  const safeDepth = kind === 'ritual' ? 0 : (Number(depth || 0) ? 1 : 0);
  const autoPoints = taskCanCommitForPoints({ incomingCritical: !!incomingCritical }) ? calculateTaskPointsAuto({ task_kind: kind, impact: safeImpact, resistance: safeResistance, depth: safeDepth }) : 0;
  const safePoints = clampEffectiveTaskPoints(kind === 'ritual' ? 1 : Math.max(0, Number(points || autoPoints)), autoPoints || (kind === 'ritual' ? 1 : 0));
  const mustWin = kind === 'ritual' ? false : isMustWinTask({ points_auto: autoPoints });
  let row;
  try {
    const rows = await supabaseRequest('core_todos', {
      method: 'POST',
      body: {
        title: clean,
        is_done: false,
        is_daily: !!isDaily,
        points: safePoints,
        task_kind: kind,
        mode: normalizedMode,
        impact: safeImpact,
        resistance: safeResistance,
        depth: safeDepth,
        points_auto: autoPoints,
        must_win: mustWin,
        done_definition: String(doneDefinition || '').trim(),
        status: 'committed',
        committed_at: new Date().toISOString(),
        incoming_critical: !!incomingCritical,
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
    row = { ...inserted, is_daily: !!isDaily, points: safePoints, task_kind: kind, mode: normalizedMode, impact: safeImpact, resistance: safeResistance, depth: safeDepth, points_auto: autoPoints, must_win: mustWin, done_definition: String(doneDefinition || '').trim(), status: 'committed', committed_at: new Date().toISOString(), incoming_critical: !!incomingCritical, last_reset_key: dayKey, completed_day_key: null };
  }
  row = normalizeTodoForV4({ ...row, points: row.points ?? safePoints });
  await logTaskEvent({ taskId: row?.id || null, eventType: 'created', titleSnapshot: clean, pointsSnapshot: row.points, isDailySnapshot: !!isDaily, taskKindSnapshot: row.task_kind, modeSnapshot: row.mode, dayKey });
  return row;
}

export async function toggleTodo(id, isDone) {
  const existingRows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}&select=id,title,points,is_daily,task_kind,mode,must_win`);
  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  const payload = {
    is_done: !!isDone,
    completed_day_key: !!isDone ? currentAxisDayKey() : null,
    updated_at: new Date().toISOString()
  };
  let row;
  try {
    payload.last_reset_key = currentAxisDayKey();
    payload.status = !!isDone ? 'done' : 'committed';
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  } catch {
    const rows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { is_done: !!isDone, completed_day_key: !!isDone ? currentAxisDayKey() : null, status: !!isDone ? 'done' : 'committed', updated_at: new Date().toISOString() }
    });
    row = Array.isArray(rows) ? rows[0] : rows;
  }
  await logTaskEvent({
    taskId: id,
    eventType: isDone ? 'completed' : 'reopened',
    titleSnapshot: existing?.title || '',
    pointsSnapshot: Number(existing?.points || 1),
    isDailySnapshot: !!existing?.is_daily,
    taskKindSnapshot: existing?.task_kind || 'task',
    modeSnapshot: existing?.mode || 'desk',
    dayKey: currentAxisDayKey()
  });
  return row;
}

export async function deleteTodo(id) {
  const existingRows = await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}&select=id,title,points,is_daily,task_kind,mode,must_win`);
  const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
  await supabaseRequest(`core_todos?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  await logTaskEvent({
    taskId: id,
    eventType: 'deleted',
    titleSnapshot: existing?.title || '',
    pointsSnapshot: Number(existing?.points || 1),
    isDailySnapshot: !!existing?.is_daily,
    taskKindSnapshot: existing?.task_kind || 'task',
    modeSnapshot: existing?.mode || 'desk',
    dayKey: currentAxisDayKey()
  });
  return true;
}

export async function clearCompletedTodos() {
  const completed = await supabaseRequest('core_todos?is_done=eq.true&select=id,title,points,is_daily,task_kind,mode');
  for (const todo of completed || []) {
    await logTaskEvent({
      taskId: todo.id,
      eventType: 'cleared_done',
      titleSnapshot: todo.title || '',
      pointsSnapshot: Number(todo.points || 1),
      isDailySnapshot: !!todo.is_daily,
      taskKindSnapshot: todo.task_kind || 'task',
      modeSnapshot: todo.mode || 'desk',
      dayKey: currentAxisDayKey()
    });
  }
  await supabaseRequest('core_todos?is_done=eq.true', { method: 'DELETE' });
  return true;
}

export async function fetchTaskHistory(limit = 100) {
  const rows = await supabaseRequest(`core_task_events?select=id,task_id,event_type,title_snapshot,points_snapshot,is_daily_snapshot,task_kind_snapshot,mode_snapshot,day_key,created_at&order=created_at.desc&limit=${limit}`);
  return rows || [];
}

export function buildUpsertHeaders() {
  return supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
}
