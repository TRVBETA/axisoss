// AXIS V5 // Tests for MFP HTML parser
// Validates the parseDiaryHtml function against a realistic
// mock of MFP's diary HTML. Does not hit MFP.
//
// Why this matters: MFP's HTML structure is the only thing the
// scraper depends on, and it's the most likely thing to change.
// A test against a captured snapshot catches regressions.

import { parseDiaryHtml } from './lib/mfpScraper.js';

const SAMPLE_HTML = `
<html>
<body>
<table class="table0">
  <thead>
    <tr>
      <th>Food</th>
      <th>Servings</th>
      <th>Calories</th>
      <th>Carbs (g)</th>
      <th>Fat (g)</th>
      <th>Protein (g)</th>
      <th>Sodium (mg)</th>
      <th>Sugar (g)</th>
    </tr>
  </thead>
  <tbody>
    <tr class="meal_header"><td colspan="8"><strong>Breakfast</strong></td></tr>
    <tr>
      <td><a href="/food/calories/123">Scrambled Eggs</a></td>
      <td>2 serving</td>
      <td>200</td>
      <td>2</td>
      <td>14</td>
      <td>14</td>
      <td>340</td>
      <td>1</td>
    </tr>
    <tr>
      <td><a href="/food/calories/456">Whole Wheat Toast</a></td>
      <td>1 slice</td>
      <td>80</td>
      <td>14</td>
      <td>1</td>
      <td>4</td>
      <td>150</td>
      <td>1</td>
    </tr>
    <tr class="meal_header"><td colspan="8"><strong>Lunch</strong></td></tr>
    <tr>
      <td><a href="/food/calories/789">Grilled Chicken Salad</a></td>
      <td>1.5 cup</td>
      <td>320</td>
      <td>18</td>
      <td>10</td>
      <td>38</td>
      <td>680</td>
      <td>6</td>
    </tr>
    <tr>
      <td><a href="/food/calories/abc">Black Coffee</a></td>
      <td>1 cup</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
      <td>0</td>
    </tr>
    <tr>
      <td><a href="/food/calories/def">Apple &amp; Peanut Butter</a></td>
      <td>1 serving</td>
      <td>280</td>
      <td>32</td>
      <td>16</td>
      <td>8</td>
      <td>5</td>
      <td>22</td>
    </tr>
  </tbody>
</table>
</body>
</html>
`;

const results = parseDiaryHtml(SAMPLE_HTML);

const expected = 4; // Black coffee (0 cal) gets filtered out
if (results.length !== expected) {
    console.error(`FAIL: expected ${expected} entries, got ${results.length}`);
    console.error('entries:', JSON.stringify(results, null, 2));
    process.exit(1);
}

const eggs = results.find((r) => r.name.includes('Scrambled'));
if (!eggs) { console.error('FAIL: no Scrambled Eggs entry'); process.exit(1); }
if (eggs.calories !== 200) { console.error(`FAIL: eggs cal ${eggs.calories}`); process.exit(1); }
if (eggs.protein !== 14) { console.error(`FAIL: eggs prot ${eggs.protein}`); process.exit(1); }
if (eggs.fat !== 14) { console.error(`FAIL: eggs fat ${eggs.fat}`); process.exit(1); }
if (eggs.carbs !== 2) { console.error(`FAIL: eggs carbs ${eggs.carbs}`); process.exit(1); }
if (eggs.quantity !== 2) { console.error(`FAIL: eggs qty ${eggs.quantity}`); process.exit(1); }
if (eggs.unit !== 'serving') { console.error(`FAIL: eggs unit ${eggs.unit}`); process.exit(1); }

const apple = results.find((r) => r.name.includes('Apple'));
if (!apple) { console.error('FAIL: no Apple entry'); process.exit(1); }
if (!apple.name.includes('&')) {
    // HTML entities should be decoded
    console.error(`FAIL: HTML entities not decoded: ${apple.name}`);
    process.exit(1);
}

const coffee = results.find((r) => r.name.includes('Coffee'));
if (coffee) { console.error('FAIL: Black Coffee (0 cal) should have been filtered'); process.exit(1); }

const salad = results.find((r) => r.name.includes('Salad'));
if (!salad) { console.error('FAIL: no Salad entry'); process.exit(1); }
if (salad.quantity !== 1.5) { console.error(`FAIL: salad qty ${salad.quantity}`); process.exit(1); }
if (salad.unit !== 'cup') { console.error(`FAIL: salad unit ${salad.unit}`); process.exit(1); }

console.log('mfp-scraper-tests-ok');
