import assert from 'node:assert/strict';
import {
  parseWorkoutText,
  normalizeExerciseName,
  inferSplitName,
  getMovementPatternForExercise,
  calculateE1RM,
  sanitizeIncomingExercises
} from './api/_fitnessServer.js';
import {
  extractGroqJson,
  shouldAttemptGroqFallback
} from './api/_groqWorkoutParser.js';

const cases = [
  {
    name: 'basic multiline x syntax',
    input: `Incline Bench 80x8 75x9\nWide Lat Pulldown 90x10 80x12`,
    expectCount: 2,
    expectExercises: ['Incline Barbell Bench Press', 'Wide-Grip Lat Pulldown']
  },
  {
    name: 'slash syntax',
    input: `Shoulder Press 50/8 45/10\nPushdown 35/12 40/10`,
    expectCount: 2,
    expectExercises: ['Machine Shoulder Press', 'Triceps Cable Pushdowns']
  },
  {
    name: 'parallel list syntax',
    input: `Incline Bench 10,15,20 × 10,10,8`,
    expectCount: 1,
    expectExercises: ['Incline Barbell Bench Press'],
    expectFirstSets: [{ weight: 10, reps: 10 }, { weight: 15, reps: 10 }, { weight: 20, reps: 8 }]
  },
  {
    name: 'command prefix',
    input: `/log\nIncline Bench 80x8 75x9`,
    expectCount: 1,
    expectExercises: ['Incline Barbell Bench Press']
  },
  {
    name: 'dates and bullets ignored',
    input: `19/4 Incline Bench 50x10 60x10\n- Seated Row 50x9 55x8`,
    expectCount: 2,
    expectExercises: ['Incline Barbell Bench Press', 'Seated Wide-Grip Row']
  },
  {
    name: 'notes ds and failure ignored safely',
    input: `Pushdown 35x12 40x10 DS to 20x8\nHammer Curl 12.5x10 10x12 F`,
    expectCount: 2,
    expectExercises: ['Triceps Cable Pushdowns', 'Hammer Curls']
  },
  {
    name: 'comma separated by big gaps fallback',
    input: `Incline Bench 80 8 75 9    Wide Lat Pulldown 90 10 80 12`,
    expectCount: 2,
    expectExercises: ['Incline Barbell Bench Press', 'Wide-Grip Lat Pulldown']
  }
];

for (const testCase of cases) {
  const parsed = parseWorkoutText(testCase.input);
  assert.equal(parsed.length, testCase.expectCount, `${testCase.name}: wrong exercise count`);
  assert.deepEqual(parsed.map(x => x.exercise), testCase.expectExercises, `${testCase.name}: wrong exercise names`);
  if (testCase.expectFirstSets) {
    assert.deepEqual(parsed[0].sets, testCase.expectFirstSets, `${testCase.name}: wrong sets parsed`);
  }
}

assert.equal(normalizeExerciseName('lat pd'), 'Wide-Grip Lat Pulldown');
assert.equal(normalizeExerciseName('single arm pushdown'), 'Single-Arm Cable Pushdowns');
assert.equal(getMovementPatternForExercise('Machine Shoulder Press'), 'vertical_press');
assert.equal(getMovementPatternForExercise('Wide-Grip Lat Pulldown'), 'vertical_pull');
assert.equal(inferSplitName(parseWorkoutText(`Incline Bench 80x8\nWide Lat Pulldown 90x10`)), 'Chest + Back');
assert.equal(calculateE1RM(80, 8), 101);

const fenced = extractGroqJson('```json\n{"exercises":[{"exercise":"Incline Barbell Bench Press","sets":[{"weight":80,"reps":8}]}]}\n```');
assert.equal(fenced.exercises[0].exercise, 'Incline Barbell Bench Press');
assert.equal(sanitizeIncomingExercises(fenced.exercises).length, 1);
assert.equal(Boolean(shouldAttemptGroqFallback('incline bench 80x8 phew that was heavy man', [{ exercise: 'Incline Barbell Bench Press', sets: [{ weight: 80, reps: 8 }] }])), Boolean(process.env.GROQ_API_KEY));

console.log('telegram-parser-tests-ok');
