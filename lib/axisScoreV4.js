export const AXIS_V4 = {
  LOW_TIER_MODE_CAP: 10,
  RITUAL_CAP: 5,
  PRIMARY_CAP: 40,
  EFFORT_CAP: 90,
  DAY_CAP: 100,
  MAX_13_PER_DAY: 1,
  MAX_8_PER_DAY_PER_MODE: 2,
  DESTINY_LIMITS: {
    2: 4,
    3: 2,
    4: 1
  },
  DESTINY_DEFAULTS: {
    0: 0,
    1: 10,
    2: 35,
    3: 60,
    4: 100
  }
};

export function normalizeTaskKind(value) {
  return String(value || 'task').trim().toLowerCase() === 'ritual' ? 'ritual' : 'task';
}

export function normalizeTaskMode(value) {
  const clean = String(value || 'desk').trim().toLowerCase();
  return ['desk', 'uni', 'field'].includes(clean) ? clean : 'desk';
}

export function normalizeTierValue(value, allowed = [0, 1, 2, 3, 4]) {
  const num = parseInt(value ?? 0, 10);
  return allowed.includes(num) ? num : allowed[0];
}

export function calculateTaskPointsAuto(task = {}) {
  const kind = normalizeTaskKind(task.task_kind || task.kind || 'task');
  if (kind === 'ritual') return 1;

  const impact = normalizeTierValue(task.impact, [1, 2, 3]);
  const resistance = normalizeTierValue(task.resistance, [1, 2, 3]);
  const depth = Number(task.depth || 0) ? 1 : 0;
  const score = impact + resistance;

  let tier;
  if (score <= 2) tier = 1;
  else if (score === 3) tier = 2;
  else if (score === 4) tier = 3;
  else if (score === 5) tier = 5;
  else tier = 8;

  if (depth === 1) {
    if (tier === 1) tier = 2;
    else if (tier === 2) tier = 3;
    else if (tier === 3) tier = 5;
    else if (tier === 5) tier = 8;
    else if (tier === 8) tier = 13;
  }

  return tier;
}

export function clampEffectiveTaskPoints(rawPoints, autoPoints) {
  const auto = Number(autoPoints || 1);
  const manual = Number(rawPoints || auto);
  return Math.max(0, Math.min(auto, manual));
}

export function isMustWinTask(task = {}) {
  return Number(task.points_auto || calculateTaskPointsAuto(task)) >= 5;
}

export function deriveSleepScore(hours) {
  const h = Number(hours || 0);
  if (h >= 7.5) return 10;
  if (h >= 6) return 5;
  return 0;
}

export function deriveNutritionScore(value) {
  const score = Number(value || 0);
  return [0, 5, 10].includes(score) ? score : 0;
}

export function deriveFitnessScore(value) {
  const score = Number(value || 0);
  return [0, 5, 10, 15, 20].includes(score) ? score : 0;
}

export function deriveReadingScore(value) {
  const score = Number(value || 0);
  return [0, 5, 10].includes(score) ? score : 0;
}

export function getDestinyBonus(tier, explicitBonus = null) {
  const t = normalizeTierValue(tier, [0, 1, 2, 3, 4]);
  if (explicitBonus != null && explicitBonus !== '') {
    return Number(explicitBonus || 0);
  }
  return AXIS_V4.DESTINY_DEFAULTS[t] || 0;
}

export function calculateRitualMomentum(tasks = []) {
  const rituals = tasks.filter(task => normalizeTaskKind(task.task_kind) === 'ritual');
  const done = rituals.filter(task => task.is_done);
  return {
    total: rituals.length,
    done: done.length,
    capped: Math.min(AXIS_V4.RITUAL_CAP, done.length)
  };
}

export function calculatePrimary(tasks = []) {
  const byMode = { desk: [], uni: [], field: [] };
  const doneTasks = tasks.filter(task => normalizeTaskKind(task.task_kind) === 'task' && (task.status === 'done' || task.is_done));
  doneTasks.forEach(task => {
    byMode[normalizeTaskMode(task.mode)].push(task);
  });

  function effectiveForMode(list) {
    const low = list.filter(task => Number(task.points || 0) <= 2).reduce((sum, task) => sum + Number(task.points || 0), 0);
    const high = list.filter(task => Number(task.points || 0) >= 3).reduce((sum, task) => sum + Number(task.points || 0), 0);
    return Math.min(AXIS_V4.LOW_TIER_MODE_CAP, low) + high;
  }

  const deskEff = effectiveForMode(byMode.desk);
  const uniEff = effectiveForMode(byMode.uni);
  const fieldEff = effectiveForMode(byMode.field);
  let primaryMode = 'desk';
  if (uniEff >= deskEff && uniEff >= fieldEff) primaryMode = 'uni';
  else if (fieldEff >= deskEff && fieldEff >= uniEff) primaryMode = 'field';

  const primaryTasks = byMode[primaryMode] || [];
  const hasHard = primaryTasks.some(task => Number(task.points || 0) >= 8);
  const primaryValue = primaryMode === 'desk' ? deskEff : primaryMode === 'uni' ? uniEff : fieldEff;
  const gatedPrimary = primaryValue > 25 && !hasHard ? 25 : primaryValue;

  return {
    primaryMode,
    deskEff,
    uniEff,
    fieldEff,
    primaryValue: Math.min(AXIS_V4.PRIMARY_CAP, gatedPrimary),
    hasHard
  };
}

export function calculateEffortSummary({ tasks = [], nutritionScore = 0, sleepScore = 0, fitnessScore = 0, readingScore = 0 } = {}) {
  const primary = calculatePrimary(tasks);
  const effort = Math.min(
    AXIS_V4.EFFORT_CAP,
    deriveNutritionScore(nutritionScore) +
      deriveSleepScore(sleepScore) +
      primary.primaryValue +
      deriveFitnessScore(fitnessScore) +
      deriveReadingScore(readingScore)
  );

  return {
    effort,
    primary,
    rituals: calculateRitualMomentum(tasks)
  };
}

export function calculateDayScoreSummary({ tasks = [], nutritionScore = 0, sleepScore = 0, fitnessScore = 0, readingScore = 0, destinyTier = 0, destinyBonus = 0 } = {}) {
  const effortSummary = calculateEffortSummary({ tasks, nutritionScore, sleepScore, fitnessScore, readingScore });
  const effort = effortSummary.effort;
  const mustWinDone = tasks.some(task => normalizeTaskKind(task.task_kind) === 'task' && isMustWinTask(task) && (task.status === 'done' || task.is_done));
  const destinyTierNorm = normalizeTierValue(destinyTier, [0, 1, 2, 3, 4]);
  const resolvedDestinyBonus = getDestinyBonus(destinyTierNorm, destinyBonus);

  let score;
  if (destinyTierNorm === 4) {
    score = 100;
  } else {
    score = Math.min(AXIS_V4.DAY_CAP, effort + resolvedDestinyBonus);
    if (!mustWinDone) score = Math.min(score, 60);
    if (effortSummary.primary.primaryValue < 8) score = Math.min(score, 60);
  }

  const grade = gradeDay(score, effort);
  const lowTierDone = tasks.filter(task => normalizeTaskKind(task.task_kind) === 'task' && (task.status === 'done' || task.is_done) && Number(task.points || 0) <= 2).length;
  const highTierDone = tasks.filter(task => normalizeTaskKind(task.task_kind) === 'task' && (task.status === 'done' || task.is_done) && Number(task.points || 0) >= 5).length;
  const totalDone = tasks.filter(task => normalizeTaskKind(task.task_kind) === 'task' && (task.status === 'done' || task.is_done)).length;
  const farmingRatio = totalDone ? Number((lowTierDone / totalDone).toFixed(2)) : 0;

  return {
    effort,
    dayScore: Math.round(score),
    grade,
    mustWinDone,
    destinyTier: destinyTierNorm,
    destinyBonus: resolvedDestinyBonus,
    primary: effortSummary.primary,
    rituals: effortSummary.rituals,
    farmingRatio,
    lowTierDone,
    highTierDone,
    totalDone
  };
}

export function gradeDay(dayScore, effort) {
  if (dayScore === 100) return { label: 'LEGEND', color: '#FF3B30', desc: 'Day you remember in 5 years' };
  if (dayScore >= 95) return { label: 'LEGENDARY GRIND', color: '#FF3B30', desc: 'Perfect grind + fate' };
  if (dayScore >= 90) return { label: 'PERFECT GRIND', color: '#ffffff', desc: 'Max effort, destiny needed for 100' };
  if (dayScore >= 75) return { label: 'GREAT GRIND', color: '#ffffff', desc: 'Hard day' };
  if (dayScore >= 60) return { label: 'GOOD', color: '#aaaaaa', desc: 'Must-win done' };
  if (dayScore >= 40) return { label: 'LOW', color: '#666666', desc: 'Small tasks only' };
  return { label: 'ROT', color: '#333333', desc: 'No must-win, no real work' };
}

export function taskCanCommitForPoints({ now = new Date(), incomingCritical = false } = {}) {
  if (incomingCritical) return true;
  const cairo = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const hour = cairo.getHours();
  return hour >= 6 && hour < 10;
}

export function limitHighPointTasks(tasks = []) {
  const count13 = tasks.filter(task => Number(task.points_auto || 0) >= 13).length;
  const count8ByMode = { desk: 0, uni: 0, field: 0 };
  tasks.forEach(task => {
    if (Number(task.points_auto || 0) >= 8) {
      count8ByMode[normalizeTaskMode(task.mode)] += 1;
    }
  });
  return { count13, count8ByMode };
}

export function normalizeTodoForV4(todo = {}) {
  const task_kind = normalizeTaskKind(todo.task_kind || todo.kind || 'task');
  const mode = normalizeTaskMode(todo.mode || 'desk');
  const impact = task_kind === 'ritual' ? 1 : normalizeTierValue(todo.impact, [1, 2, 3]);
  const resistance = task_kind === 'ritual' ? 1 : normalizeTierValue(todo.resistance, [1, 2, 3]);
  const depth = task_kind === 'ritual' ? 0 : (Number(todo.depth || 0) ? 1 : 0);
  const points_auto = Number(todo.points_auto || calculateTaskPointsAuto({ task_kind, impact, resistance, depth }));
  const points = clampEffectiveTaskPoints(todo.points || points_auto, points_auto);
  const must_win = task_kind === 'ritual' ? false : isMustWinTask({ points_auto });
  const status = String(todo.status || (todo.is_done ? 'done' : 'committed')).toLowerCase();
  return {
    ...todo,
    task_kind,
    mode,
    impact,
    resistance,
    depth,
    points_auto,
    points,
    must_win,
    status,
    done_definition: String(todo.done_definition || '').trim(),
    incoming_critical: !!todo.incoming_critical,
    is_done: !!todo.is_done
  };
}
