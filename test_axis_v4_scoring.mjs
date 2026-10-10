import assert from 'node:assert/strict';
import {
  calculateTaskPointsAuto,
  calculateWorkPoints,
  calculateDayScoreSummary,
  deriveSleepScore,
  normalizeTodoForV4,
  taskCanCommitForPoints
} from './lib/axisScoreV4.js';

assert.equal(calculateTaskPointsAuto({ task_kind: 'ritual' }), 1);
assert.equal(calculateTaskPointsAuto({ impact: 1, resistance: 1, depth: 0 }), 1);
assert.equal(calculateTaskPointsAuto({ impact: 2, resistance: 2, depth: 0 }), 3);
assert.equal(calculateTaskPointsAuto({ impact: 3, resistance: 3, depth: 1 }), 13);
assert.equal(deriveSleepScore(5.5), 0);
assert.equal(deriveSleepScore(6.5), 5);
assert.equal(deriveSleepScore(7.6), 10);

const tasks = [
  normalizeTodoForV4({ title: 'Small 1', task_kind: 'task', mode: 'desk', impact: 1, resistance: 1, depth: 0, points: 1, points_auto: 1, is_done: true, status: 'done' }),
  normalizeTodoForV4({ title: 'Small 2', task_kind: 'task', mode: 'desk', impact: 1, resistance: 2, depth: 0, points: 2, points_auto: 2, is_done: true, status: 'done' }),
  normalizeTodoForV4({ title: 'Hard', task_kind: 'task', mode: 'desk', impact: 3, resistance: 3, depth: 1, points: 13, points_auto: 13, is_done: true, status: 'done' }),
  normalizeTodoForV4({ title: 'Ritual', task_kind: 'ritual', is_done: true, status: 'done', points: 1, points_auto: 1 })
];
const work = calculateWorkPoints(tasks);
assert.equal(work.workValue, 16); // low(1+2 capped under 10) + high(13)
assert.equal(work.hasHard, true);

// Mode-blindness: the same points scattered across legacy modes must
// score identically — the desk/summer/field split no longer exists.
const split = tasks.map((t, i) => normalizeTodoForV4({ ...t, mode: ['desk', 'uni', 'field', 'desk'][i % 4] }));
assert.equal(calculateWorkPoints(split).workValue, 16);

// Anti-gaming gates survived: no hard task done -> >25 collapses to 25.
const softHeavy = Array.from({ length: 20 }, (_, i) => normalizeTodoForV4({ title: 'soft' + i, task_kind: 'task', points: 3, points_auto: 3, is_done: true, status: 'done' }));
assert.equal(calculateWorkPoints(softHeavy).workValue, 25);
// Low-tier flood caps at 10; high tier still counts.
const lowFlood = Array.from({ length: 20 }, (_, i) => normalizeTodoForV4({ title: 'low' + i, task_kind: 'task', points: 2, points_auto: 2, is_done: true, status: 'done' }));
assert.equal(calculateWorkPoints(lowFlood).workValue, 10);
assert.equal(calculateWorkPoints([...lowFlood, normalizeTodoForV4({ title: 'Hard', task_kind: 'task', points: 8, points_auto: 8, is_done: true, status: 'done' })]).workValue, 18);

const day = calculateDayScoreSummary({
  tasks,
  nutritionScore: 10,
  sleepScore: 10,
  fitnessScore: 20,
  readingScore: 10,
  destinyTier: 0,
  destinyBonus: 0
});
assert.equal(day.effort, 66);
assert.equal(day.dayScore, 66);
assert.equal(day.grade.label, 'GOOD');
assert.equal(day.rituals.done, 1);

const withDestiny = calculateDayScoreSummary({
  tasks,
  nutritionScore: 10,
  sleepScore: 10,
  fitnessScore: 20,
  readingScore: 10,
  destinyTier: 2,
  destinyBonus: 35
});
assert.equal(withDestiny.dayScore, 100);
assert.equal(withDestiny.grade.label, 'LEGEND');

assert.equal(taskCanCommitForPoints({ now: new Date('2026-07-19T06:30:00+02:00') }), true);

console.log('axis-v4-scoring-tests-ok');
