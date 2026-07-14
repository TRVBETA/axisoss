import assert from 'node:assert/strict';
import {
  parseNutritionTextLocal,
  sanitizeNutritionItems,
  calculateNutrition,
  normalizeFood,
  summarizeNutritionItems
} from './lib/nutritionServer.js';

const parseCases = [
  {
    name: 'basic grams + comma split',
    input: '400g rice, 200g chicken breast',
    expected: [
      { food: 'rice', quantity: 400, unit: 'g' },
      { food: 'chicken breast', quantity: 200, unit: 'g' }
    ]
  },
  {
    name: 'food before quantity',
    input: 'rice 400g',
    expected: [
      { food: 'rice', quantity: 400, unit: 'g' }
    ]
  },
  {
    name: 'piece items',
    input: '5 eggs',
    expected: [
      { food: 'eggs', quantity: 5, unit: 'piece' }
    ]
  },
  {
    name: 'volume items',
    input: '250ml milk',
    expected: [
      { food: 'milk', quantity: 250, unit: 'ml' }
    ]
  },
  {
    name: 'spoon items',
    input: '2 tsp sugar',
    expected: [
      { food: 'sugar', quantity: 2, unit: 'tsp' }
    ]
  },
  {
    name: 'bread slices + conjunction split',
    input: '2 slices bread and 3 eggs',
    expected: [
      { food: 'white bread slice', quantity: 2, unit: 'piece' },
      { food: 'eggs', quantity: 3, unit: 'piece' }
    ]
  },
  {
    name: 'unicode fraction cup',
    input: '½ cup oats',
    expected: [
      { food: 'oats', quantity: 0.5, unit: 'cup' }
    ]
  },
  {
    name: 'mixed fraction cup',
    input: '1 1/2 cup rice',
    expected: [
      { food: 'rice', quantity: 1.5, unit: 'cup' }
    ]
  },
  {
    name: 'x prefix count notation',
    input: '2x banana',
    expected: [
      { food: 'banana', quantity: 2, unit: 'piece' }
    ]
  },
  {
    name: 'ignore kcal note',
    input: 'chicken breast 200g - 165 kcal',
    expected: [
      { food: 'chicken breast', quantity: 200, unit: 'g' }
    ]
  },
  {
    name: 'recipe prefix with plus grouping',
    input: 'omelette: 3 eggs + 2 bread + 20g cheese',
    expected: [
      { food: 'eggs', quantity: 3, unit: 'piece' },
      { food: 'white bread slice', quantity: 2, unit: 'piece' },
      { food: 'cheese', quantity: 20, unit: 'g' }
    ]
  }
];

for (const testCase of parseCases) {
  const parsed = parseNutritionTextLocal(testCase.input);
  assert.deepEqual(parsed, testCase.expected, `${testCase.name}: parsed mismatch`);
}

assert.equal(normalizeFood('feta'), 'white cheese');
assert.equal(normalizeFood('bread'), 'white bread');

const sanitized = sanitizeNutritionItems([
  { food: '  of rice ', quantity: '400', unit: 'grams' },
  { food: 'milk', quantity: '250', unit: 'milliliters' }
]);
assert.deepEqual(sanitized, [
  { food: 'rice', quantity: 400, unit: 'g' },
  { food: 'milk', quantity: 250, unit: 'ml' }
]);

const rawModeItems = parseNutritionTextLocal('100g rice, 100g chicken breast', { defaultMode: 'raw' });
assert.deepEqual(rawModeItems, [
  { food: 'raw rice', quantity: 100, unit: 'g' },
  { food: 'raw chicken breast', quantity: 100, unit: 'g' }
]);

const cookedModeItems = parseNutritionTextLocal('100g rice, 100g chicken breast', { defaultMode: 'cooked' });
assert.deepEqual(cookedModeItems, [
  { food: 'cooked rice', quantity: 100, unit: 'g' },
  { food: 'cooked chicken breast', quantity: 100, unit: 'g' }
]);

const riceMacros = await calculateNutrition('rice', 400, 'g');
assert.equal(Math.round(riceMacros.calories), 520);
assert.equal(Math.round(riceMacros.carbs), 114);

const eggsMacros = await calculateNutrition('eggs', 3, 'piece');
assert.equal(Math.round(eggsMacros.calories), 234);
assert.equal(Math.round(eggsMacros.protein), 18);

const rawRiceMacros = await calculateNutrition('raw rice', 100, 'g');
const cookedRiceMacros = await calculateNutrition('cooked rice', 100, 'g');
assert.ok(rawRiceMacros.calories > cookedRiceMacros.calories);

const summary = await summarizeNutritionItems(parseNutritionTextLocal('400g rice, 5 eggs'));
assert.equal(Math.round(summary.totals.calories), 910);
assert.equal(Math.round(summary.totals.protein), 39);

console.log('nutrition-parser-tests-ok');
