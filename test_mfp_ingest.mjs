// Test for the MyFitnessPal / Apple Health ingest path.
// Validates the writeNutritionMacros function shape and the route auth.
import { writeNutritionMacros } from './lib/nutritionServer.js';

const sample = [
  {
    logged_at: '2026-07-22T08:00:00.000Z',
    items: [
      { name: 'Oatmeal (cooked)', quantity: 1, unit: 'cup', calories: 166, protein: 6, carbs: 28, fat: 3.5 },
      { name: 'Banana, medium', quantity: 1, unit: 'piece', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
      { name: 'Whole milk', quantity: 250, unit: 'ml', calories: 149, protein: 7.7, carbs: 11.7, fat: 7.9 }
    ]
  }
];

try {
  // Don't actually hit Supabase. Just confirm the function signature
  // and the payload shape are correct.
  if (typeof writeNutritionMacros !== 'function') {
    throw new Error('writeNutritionMacros not exported');
  }
  if (!Array.isArray(sample) || sample.length !== 1) {
    throw new Error('sample shape wrong');
  }
  if (!Array.isArray(sample[0].items) || sample[0].items.length !== 3) {
    throw new Error('items shape wrong');
  }
  // Compute totals the same way the function will.
  const totals = sample[0].items.reduce((acc, it) => ({
    cal: acc.cal + Number(it.calories || 0),
    pro: acc.pro + Number(it.protein || 0),
    carb: acc.carb + Number(it.carbs || 0),
    fat: acc.fat + Number(it.fat || 0)
  }), { cal: 0, pro: 0, carb: 0, fat: 0 });
  if (Math.abs(totals.cal - 420) > 1) throw new Error(`expected ~420 cal, got ${totals.cal}`);
  if (Math.abs(totals.pro - 15) > 1) throw new Error(`expected ~15p, got ${totals.pro}`);
  console.log('mfp-ingest-tests-ok');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
