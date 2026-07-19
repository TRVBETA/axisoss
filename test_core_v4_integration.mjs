import assert from 'node:assert/strict';
import { normalizeTodoForV4, calculateDayScoreSummary } from './lib/axisScoreV4.js';
import { deriveFitnessScoreFromExercisePayload } from './lib/fitnessServer.js';
import { deriveNutritionScoreFromRows } from './lib/nutritionServer.js';

const rituals = [
  normalizeTodoForV4({ title: 'Brush teeth', task_kind: 'ritual', is_done: true, status: 'done', points: 1, points_auto: 1 }),
  normalizeTodoForV4({ title: 'Moisturizer', task_kind: 'ritual', is_done: true, status: 'done', points: 1, points_auto: 1 })
];

const tasks = [
  normalizeTodoForV4({ title: 'Export hero section', task_kind: 'task', mode: 'desk', impact: 3, resistance: 3, depth: 1, points: 13, points_auto: 13, is_done: true, status: 'done', done_definition: 'export v3 in drive' }),
  normalizeTodoForV4({ title: 'Edit intro reel', task_kind: 'task', mode: 'desk', impact: 2, resistance: 2, depth: 1, points: 5, points_auto: 5, is_done: true, status: 'done', done_definition: 'final export uploaded' }),
  normalizeTodoForV4({ title: 'Reply to one email', task_kind: 'task', mode: 'desk', impact: 1, resistance: 1, depth: 0, points: 1, points_auto: 1, is_done: true, status: 'done' })
];

const all = [...rituals, ...tasks];
const summary = calculateDayScoreSummary({
  tasks: all,
  nutritionScore: 10,
  sleepScore: 10,
  fitnessScore: 15,
  readingScore: 5,
  destinyTier: 0,
  destinyBonus: 0
});

assert.equal(summary.mustWinDone, true);
assert.equal(summary.primary.primaryMode, 'desk');
assert.equal(summary.primary.primaryValue, 19);
assert.equal(summary.rituals.done, 2);
assert.equal(summary.effort, 59);
assert.equal(summary.dayScore, 59);

const nutritionRowsLight = [{ description: 'cooked rice', protein: 20 }, { description: 'cooked chicken breast', protein: 50 }];
assert.equal(deriveNutritionScoreFromRows([]), 0);
assert.equal(deriveNutritionScoreFromRows(nutritionRowsLight), 5);
const nutritionRowsPerfect = [{ description: 'cooked rice', protein: 40 }, { description: 'cooked chicken breast', protein: 110 }];
assert.equal(deriveNutritionScoreFromRows(nutritionRowsPerfect), 10);
const nutritionRowsJunk = [{ description: 'chips', protein: 0 }, { description: 'cooked chicken breast', protein: 160 }];
assert.equal(deriveNutritionScoreFromRows(nutritionRowsJunk), 5);

assert.equal(deriveFitnessScoreFromExercisePayload([{ exercise: 'A', sets: [{}, {}, {}, {}, {}, {}] }]), 15);
assert.equal(deriveFitnessScoreFromExercisePayload([{ exercise: 'A', sets: Array.from({ length: 12 }, () => ({})) }]), 20);

console.log('core-v4-integration-tests-ok');
