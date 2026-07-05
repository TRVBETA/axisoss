import { currentAxisDayKey } from './coreDataServer.js';
import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getCompletedTodoPoints(dayKey) {
  try {
    const rows = await supabaseRequest(`core_todos?select=id,points,is_done,completed_day_key&is_done=eq.true&completed_day_key=eq.${encodeURIComponent(dayKey)}`);
    return (rows || []).reduce((sum, row) => sum + Number(row.points || 1), 0);
  } catch {
    return 0;
  }
}

export async function getDailyTelemetry(logDate = todayKey()) {
  const rows = await supabaseRequest(`daily_debrief_logs?log_date=eq.${logDate}&select=log_date,gym_logged,gym_split_name,design_hours,sleep_hours,water_liters,went_outside,watched_tutorial,daily_score,created_at`);
  const row = Array.isArray(rows) ? rows[0] : rows;
  const todoPoints = await getCompletedTodoPoints(currentAxisDayKey());
  if (row) return { ...row, todo_points: todoPoints, daily_score: computeDailyScore(row, todoPoints) };
  return {
    log_date: logDate,
    gym_logged: false,
    gym_split_name: 'None',
    design_hours: 0,
    sleep_hours: 0,
    water_liters: 0,
    went_outside: false,
    watched_tutorial: false,
    daily_score: computeDailyScore({}, todoPoints),
    todo_points: todoPoints
  };
}

function computeDailyScore(row, todoPoints = 0) {
  let pts = 0;
  if (row.gym_logged) pts += 40;
  if (Number(row.design_hours) >= 1) pts += 30;
  else if (Number(row.design_hours) > 0) pts += Math.round(Number(row.design_hours) * 30);
  if (Number(row.sleep_hours) > 0) pts += 10;
  pts += Math.min(10, Math.round((Number(row.water_liters || 0) / 4) * 10));
  if (row.went_outside) pts += 5;
  if (row.watched_tutorial) pts += 5;
  pts += Number(todoPoints || 0);
  return Math.min(100, pts);
}

export async function upsertDailyTelemetry(patch = {}, logDate = todayKey()) {
  const current = await getDailyTelemetry(logDate);
  const merged = {
    ...current,
    ...patch,
    log_date: logDate
  };
  const todoPoints = await getCompletedTodoPoints(currentAxisDayKey());
  merged.todo_points = todoPoints;
  merged.daily_score = computeDailyScore(merged, todoPoints);

  const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
  const rows = await supabaseRequest('daily_debrief_logs?on_conflict=log_date', {
    method: 'POST',
    headers,
    body: {
      log_date: merged.log_date,
      gym_logged: !!merged.gym_logged,
      gym_split_name: merged.gym_split_name || 'None',
      design_hours: Number(merged.design_hours || 0),
      sleep_hours: Number(merged.sleep_hours || 0),
      water_liters: Number(merged.water_liters || 0),
      went_outside: !!merged.went_outside,
      watched_tutorial: !!merged.watched_tutorial,
      daily_score: merged.daily_score
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function applyDailyAction(action, payload = {}, logDate = todayKey()) {
  const current = await getDailyTelemetry(logDate);
  let patch = {};

  switch (action) {
    case 'water-add':
      patch.water_liters = Number((Number(current.water_liters || 0) + Number(payload.amount || 0.6)).toFixed(1));
      break;
    case 'water-set':
      patch.water_liters = Number(payload.amount || 0);
      break;
    case 'water-reset':
      patch.water_liters = 0;
      break;
    case 'outside-toggle':
      patch.went_outside = !current.went_outside;
      break;
    case 'tutorial-toggle':
      patch.watched_tutorial = !current.watched_tutorial;
      break;
    case 'design-add':
      patch.design_hours = Number(current.design_hours || 0) + Number(payload.amount || 1);
      break;
    case 'design-set':
      patch.design_hours = Number(payload.amount || 0);
      break;
    case 'sleep-set':
      patch.sleep_hours = Number(payload.amount || 0);
      break;
    case 'gym-quick':
      patch.gym_logged = true;
      patch.gym_split_name = payload.split || current.gym_split_name || 'Quick Mark';
      break;
    case 'reset-core':
      patch = {
        gym_logged: false,
        gym_split_name: 'None',
        design_hours: 0,
        sleep_hours: 0,
        water_liters: 0,
        went_outside: false,
        watched_tutorial: false
      };
      break;
    default:
      throw new Error('INVALID DAILY ACTION');
  }

  return upsertDailyTelemetry(patch, logDate);
}
