import { currentAxisDayKey } from './coreDataServer.js';
import { supabaseHeaders, supabaseRequest } from './supabaseServer.js';
import {
  AXIS_V4,
  calculateDayScoreSummary,
  deriveFitnessScore,
  deriveNutritionScore,
  deriveReadingScore,
  deriveSleepScore,
  getDestinyBonus,
  normalizeTierValue,
  normalizeTodoForV4
} from './axisScoreV4.js';

function todayKey() {
  return currentAxisDayKey();
}

async function fetchTasksForDay() {
  try {
    const rows = await supabaseRequest('core_todos?select=id,title,is_done,is_daily,points,task_kind,mode,impact,resistance,depth,points_auto,must_win,done_definition,status,committed_at,incoming_critical,completed_day_key,last_reset_key,created_at,updated_at&order=created_at.desc&limit=120');
    return (rows || []).map(normalizeTodoForV4);
  } catch {
    const rows = await supabaseRequest('core_todos?select=id,title,is_done,is_daily,points,completed_day_key,last_reset_key,created_at,updated_at&order=created_at.desc&limit=120');
    return (rows || []).map(normalizeTodoForV4);
  }
}

async function getCompletedTodoPoints(dayKey) {
  try {
    const rows = await supabaseRequest(`core_todos?select=id,points,is_done,completed_day_key&is_done=eq.true&completed_day_key=eq.${encodeURIComponent(dayKey)}`);
    return (rows || []).reduce((sum, row) => sum + Number(row.points || 1), 0);
  } catch {
    return 0;
  }
}

function computeLegacyScore(row, todoPoints = 0) {
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

function normalizeDailyRow(row = {}, logDate = todayKey()) {
  return {
    log_date: row.log_date || logDate,
    gym_logged: !!row.gym_logged,
    gym_split_name: row.gym_split_name || 'None',
    design_hours: Number(row.design_hours || 0),
    sleep_hours: Number(row.sleep_hours || 0),
    water_liters: Number(row.water_liters || 0),
    went_outside: !!row.went_outside,
    watched_tutorial: !!row.watched_tutorial,
    fitness_score_v4: deriveFitnessScore(row.fitness_score_v4),
    nutrition_score_v4: deriveNutritionScore(row.nutrition_score_v4),
    sleep_score_v4: row.sleep_score_v4 == null ? deriveSleepScore(row.sleep_hours) : deriveNutritionScore(row.sleep_score_v4),
    reading_score_v4: deriveReadingScore(row.reading_score_v4),
    destiny_tier: normalizeTierValue(row.destiny_tier, [0, 1, 2, 3, 4]),
    destiny_title: String(row.destiny_title || '').trim(),
    destiny_bonus_points: Number(row.destiny_bonus_points || 0),
    destiny_proof_url: String(row.destiny_proof_url || '').trim(),
    daily_score: Number(row.daily_score || 0),
    effort_v4: Number(row.effort_v4 || 0),
    day_score_v4: Number(row.day_score_v4 || 0),
    grade_v4: String(row.grade_v4 || 'ROT'),
    primary_mode_v4: String(row.primary_mode_v4 || 'desk'),
    desk_eff_v4: Number(row.desk_eff_v4 || 0),
    uni_eff_v4: Number(row.uni_eff_v4 || 0),
    field_eff_v4: Number(row.field_eff_v4 || 0),
    farming_ratio_v4: Number(row.farming_ratio_v4 || 0),
    must_win_done_v4: !!row.must_win_done_v4,
    created_at: row.created_at || null
  };
}

async function computeV4Row(row, tasks) {
  const normalized = normalizeDailyRow(row, row.log_date || todayKey());
  const v4 = calculateDayScoreSummary({
    tasks,
    nutritionScore: normalized.nutrition_score_v4,
    sleepScore: normalized.sleep_score_v4,
    fitnessScore: normalized.fitness_score_v4,
    readingScore: normalized.reading_score_v4,
    destinyTier: normalized.destiny_tier,
    destinyBonus: normalized.destiny_bonus_points
  });
  return {
    ...normalized,
    effort_v4: v4.effort,
    day_score_v4: v4.dayScore,
    grade_v4: v4.grade.label,
    grade_meta_v4: v4.grade,
    primary_mode_v4: v4.primary.primaryMode,
    desk_eff_v4: v4.primary.deskEff,
    uni_eff_v4: v4.primary.uniEff,
    field_eff_v4: v4.primary.fieldEff,
    must_win_done_v4: v4.mustWinDone,
    farming_ratio_v4: v4.farmingRatio,
    rituals_done_v4: v4.rituals.done,
    rituals_total_v4: v4.rituals.total,
    rituals_capped_v4: v4.rituals.capped,
    destiny_bonus_effective_v4: v4.destinyBonus
  };
}

async function countDestinyTierThisMonth(tier, targetDayKey = todayKey()) {
  if (!tier || tier < 2) return 0;
  const [year, month] = String(targetDayKey).split('-');
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;
  try {
    const rows = await supabaseRequest(`daily_debrief_logs?select=log_date,destiny_tier&destiny_tier=eq.${tier}&log_date=gte.${start}&log_date=lte.${end}&limit=100`);
    return (rows || []).length;
  } catch {
    return 0;
  }
}

async function enforceDestinyLimit(tier, targetDayKey) {
  const normalizedTier = normalizeTierValue(tier, [0, 1, 2, 3, 4]);
  const limit = AXIS_V4.DESTINY_LIMITS[normalizedTier];
  if (!limit) return;
  const used = await countDestinyTierThisMonth(normalizedTier, targetDayKey);
  if (used >= limit) {
    throw new Error(`DESTINY TIER ${normalizedTier} MONTHLY LIMIT REACHED`);
  }
}

export async function getDailyTelemetry(logDate = todayKey()) {
  let rows;
  try {
    rows = await supabaseRequest(`daily_debrief_logs?log_date=eq.${logDate}&select=log_date,gym_logged,gym_split_name,design_hours,sleep_hours,water_liters,went_outside,watched_tutorial,daily_score,fitness_score_v4,nutrition_score_v4,sleep_score_v4,reading_score_v4,destiny_tier,destiny_title,destiny_bonus_points,destiny_proof_url,effort_v4,day_score_v4,grade_v4,primary_mode_v4,desk_eff_v4,uni_eff_v4,field_eff_v4,farming_ratio_v4,must_win_done_v4,created_at`);
  } catch {
    rows = await supabaseRequest(`daily_debrief_logs?log_date=eq.${logDate}&select=log_date,gym_logged,gym_split_name,design_hours,sleep_hours,water_liters,went_outside,watched_tutorial,daily_score,created_at`);
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  const todoPoints = await getCompletedTodoPoints(currentAxisDayKey());
  const tasks = await fetchTasksForDay();

  const baseRow = row || { log_date: logDate };
  const v4Row = await computeV4Row(baseRow, tasks);
  return {
    ...v4Row,
    todo_points: todoPoints,
    daily_score: computeLegacyScore(v4Row, todoPoints)
  };
}

export async function upsertDailyTelemetry(patch = {}, logDate = todayKey()) {
  const current = await getDailyTelemetry(logDate);
  const merged = normalizeDailyRow({ ...current, ...patch, log_date: logDate }, logDate);
  if (patch.destiny_tier != null) {
    const tier = normalizeTierValue(patch.destiny_tier, [0, 1, 2, 3, 4]);
    if (tier >= 2) {
      await enforceDestinyLimit(tier, logDate);
      if (!String(merged.destiny_proof_url || '').trim()) {
        throw new Error('DESTINY PROOF REQUIRED FOR TIER 2+');
      }
    }
    merged.destiny_bonus_points = getDestinyBonus(tier, patch.destiny_bonus_points ?? merged.destiny_bonus_points);
  }

  if (patch.sleep_hours != null && patch.sleep_score_v4 == null) {
    merged.sleep_score_v4 = deriveSleepScore(patch.sleep_hours);
  }

  const tasks = await fetchTasksForDay();
  const todoPoints = await getCompletedTodoPoints(currentAxisDayKey());
  const v4Row = await computeV4Row(merged, tasks);
  const legacyScore = computeLegacyScore(v4Row, todoPoints);

  const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
  const fullBody = {
    log_date: v4Row.log_date,
    gym_logged: !!v4Row.gym_logged,
    gym_split_name: v4Row.gym_split_name || 'None',
    design_hours: Number(v4Row.design_hours || 0),
    sleep_hours: Number(v4Row.sleep_hours || 0),
    water_liters: Number(v4Row.water_liters || 0),
    went_outside: !!v4Row.went_outside,
    watched_tutorial: !!v4Row.watched_tutorial,
    daily_score: legacyScore,
    fitness_score_v4: Number(v4Row.fitness_score_v4 || 0),
    nutrition_score_v4: Number(v4Row.nutrition_score_v4 || 0),
    sleep_score_v4: Number(v4Row.sleep_score_v4 || 0),
    reading_score_v4: Number(v4Row.reading_score_v4 || 0),
    destiny_tier: Number(v4Row.destiny_tier || 0),
    destiny_title: v4Row.destiny_title || '',
    destiny_bonus_points: Number(v4Row.destiny_bonus_points || 0),
    destiny_proof_url: v4Row.destiny_proof_url || '',
    effort_v4: Number(v4Row.effort_v4 || 0),
    day_score_v4: Number(v4Row.day_score_v4 || 0),
    grade_v4: v4Row.grade_v4 || 'ROT',
    primary_mode_v4: v4Row.primary_mode_v4 || 'desk',
    desk_eff_v4: Number(v4Row.desk_eff_v4 || 0),
    uni_eff_v4: Number(v4Row.uni_eff_v4 || 0),
    field_eff_v4: Number(v4Row.field_eff_v4 || 0),
    farming_ratio_v4: Number(v4Row.farming_ratio_v4 || 0),
    must_win_done_v4: !!v4Row.must_win_done_v4
  };

  let rows;
  try {
    rows = await supabaseRequest('daily_debrief_logs?on_conflict=log_date', {
      method: 'POST',
      headers,
      body: fullBody
    });
  } catch {
    rows = await supabaseRequest('daily_debrief_logs?on_conflict=log_date', {
      method: 'POST',
      headers,
      body: {
        log_date: fullBody.log_date,
        gym_logged: fullBody.gym_logged,
        gym_split_name: fullBody.gym_split_name,
        design_hours: fullBody.design_hours,
        sleep_hours: fullBody.sleep_hours,
        water_liters: fullBody.water_liters,
        went_outside: fullBody.went_outside,
        watched_tutorial: fullBody.watched_tutorial,
        daily_score: fullBody.daily_score
      }
    });
  }

  const saved = Array.isArray(rows) ? rows[0] : rows;
  return {
    ...v4Row,
    ...saved,
    todo_points: todoPoints,
    daily_score: legacyScore
  };
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
      patch.sleep_score_v4 = deriveSleepScore(Number(payload.amount || 0));
      break;
    case 'sleep-score-set':
      patch.sleep_score_v4 = deriveNutritionScore(payload.score);
      break;
    case 'nutrition-score-set':
      patch.nutrition_score_v4 = deriveNutritionScore(payload.score);
      break;
    case 'fitness-score-set':
      patch.fitness_score_v4 = deriveFitnessScore(payload.score);
      break;
    case 'reading-score-set':
      patch.reading_score_v4 = deriveReadingScore(payload.score);
      break;
    case 'destiny-set':
      patch.destiny_tier = normalizeTierValue(payload.tier, [0, 1, 2, 3, 4]);
      patch.destiny_title = String(payload.title || '').trim();
      patch.destiny_bonus_points = getDestinyBonus(patch.destiny_tier, payload.bonusPoints);
      patch.destiny_proof_url = String(payload.proofUrl || '').trim();
      break;
    case 'destiny-clear':
      patch.destiny_tier = 0;
      patch.destiny_title = '';
      patch.destiny_bonus_points = 0;
      patch.destiny_proof_url = '';
      break;
    case 'gym-quick':
      patch.gym_logged = true;
      patch.gym_split_name = payload.split || current.gym_split_name || 'Quick Mark';
      patch.fitness_score_v4 = Math.max(15, Number(current.fitness_score_v4 || 0));
      break;
    case 'reset-core':
      patch = {
        gym_logged: false,
        gym_split_name: 'None',
        design_hours: 0,
        sleep_hours: 0,
        water_liters: 0,
        went_outside: false,
        watched_tutorial: false,
        fitness_score_v4: 0,
        nutrition_score_v4: 0,
        sleep_score_v4: 0,
        reading_score_v4: 0,
        destiny_tier: 0,
        destiny_title: '',
        destiny_bonus_points: 0,
        destiny_proof_url: ''
      };
      break;
    default:
      throw new Error('INVALID DAILY ACTION');
  }

  return upsertDailyTelemetry(patch, logDate);
}
