import { supabaseRequest } from './supabaseServer.js';

const FOOD_DB = {
  'rice': { cal: 130, pro: 2.3, carb: 28.5, fat: 0.3 },
  'white cheese': { cal: 264, pro: 14, carb: 4.1, fat: 21 },
  'feta': { cal: 264, pro: 14, carb: 4.1, fat: 21 },
  'basmati rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
  'cooked rice': { cal: 130, pro: 2.3, carb: 28.5, fat: 0.3 },
  'cooked basmati rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
  'indomie': { cal: 400, pro: 8, carb: 57, fat: 15 },
  'instant noodles': { cal: 400, pro: 8, carb: 57, fat: 15 },
  'noodles': { cal: 138, pro: 4.5, carb: 25, fat: 2 },
  'chicken breast': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'cooked chicken breast': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'chicken': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'cooked chicken': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'sugar': { cal: 387, pro: 0, carb: 100, fat: 0 },
  'milk': { cal: 61, pro: 3, carb: 5, fat: 3 },
  'whole milk': { cal: 61, pro: 3, carb: 5, fat: 3 },
  'chips': { cal: 520, pro: 6, carb: 53, fat: 32 },
  'potato chips': { cal: 520, pro: 6, carb: 53, fat: 32 },
  'bread': { cal: 265, pro: 9, carb: 51, fat: 3.2 },
  'white bread': { cal: 265, pro: 9, carb: 51, fat: 3.2 },
  'brown bread': { cal: 247, pro: 13, carb: 41, fat: 3.5 },
  'whole wheat bread': { cal: 247, pro: 13, carb: 41, fat: 3.5 },
  'pasta': { cal: 131, pro: 5, carb: 25, fat: 1.1 },
  'spaghetti': { cal: 131, pro: 5, carb: 25, fat: 1.1 },
  'beef': { cal: 250, pro: 26, carb: 0, fat: 17 },
  'ground beef': { cal: 250, pro: 26, carb: 0, fat: 17 },
  'salmon': { cal: 208, pro: 20, carb: 0, fat: 13 },
  'tuna': { cal: 116, pro: 26, carb: 0, fat: 1 },
  'yogurt': { cal: 59, pro: 10, carb: 3.6, fat: 0.4 },
  'greek yogurt': { cal: 59, pro: 10, carb: 3.6, fat: 0.4 },
  'cheese': { cal: 402, pro: 25, carb: 1.3, fat: 33 },
  'cheddar': { cal: 402, pro: 25, carb: 1.3, fat: 33 },
  'butter': { cal: 717, pro: 0.9, carb: 0.1, fat: 81 },
  'olive oil': { cal: 884, pro: 0, carb: 0, fat: 100 },
  'oil': { cal: 884, pro: 0, carb: 0, fat: 100 },
  'vegetable oil': { cal: 884, pro: 0, carb: 0, fat: 100 },
  'potato': { cal: 77, pro: 2, carb: 17, fat: 0.1 },
  'sweet potato': { cal: 86, pro: 1.6, carb: 20, fat: 0.1 },
  'broccoli': { cal: 34, pro: 2.8, carb: 7, fat: 0.4 },
  'carrot': { cal: 41, pro: 0.9, carb: 10, fat: 0.2 },
  'tomato': { cal: 18, pro: 0.9, carb: 3.9, fat: 0.2 },
  'cucumber': { cal: 16, pro: 0.7, carb: 3.6, fat: 0.1 },
  'watermelon': { cal: 30, pro: 0.6, carb: 7.6, fat: 0.2 },
  'grapes': { cal: 69, pro: 0.7, carb: 18, fat: 0.2 },
  'mango': { cal: 60, pro: 0.8, carb: 15, fat: 0.4 },
  'strawberry': { cal: 32, pro: 0.7, carb: 7.7, fat: 0.3 },
  'strawberries': { cal: 32, pro: 0.7, carb: 7.7, fat: 0.3 },
  'lentils': { cal: 116, pro: 9, carb: 20, fat: 0.4 },
  'chickpeas': { cal: 164, pro: 8.9, carb: 27, fat: 2.6 },
  'black beans': { cal: 132, pro: 8.9, carb: 24, fat: 0.5 },
  'almonds': { cal: 579, pro: 21, carb: 22, fat: 50 },
  'peanuts': { cal: 567, pro: 26, carb: 16, fat: 49 },
  'peanut butter': { cal: 588, pro: 25, carb: 20, fat: 50 },
  'walnuts': { cal: 654, pro: 15, carb: 14, fat: 65 },
  'oats': { cal: 389, pro: 17, carb: 66, fat: 7 },
  'oatmeal': { cal: 389, pro: 17, carb: 66, fat: 7 },
  'orange juice': { cal: 45, pro: 0.7, carb: 10, fat: 0.2 },
  'coffee': { cal: 2, pro: 0.3, carb: 0, fat: 0 }
};

const UNIT_FOODS = {
  'egg': { cal: 78, pro: 6, carb: 0.6, fat: 5, grams: 50 },
  'eggs': { cal: 78, pro: 6, carb: 0.6, fat: 5, grams: 50 },
  'boiled egg': { cal: 78, pro: 6, carb: 0.6, fat: 5, grams: 50 },
  'boiled eggs': { cal: 78, pro: 6, carb: 0.6, fat: 5, grams: 50 },
  'fried egg': { cal: 90, pro: 6.3, carb: 0.4, fat: 7, grams: 50 },
  'scrambled egg': { cal: 91, pro: 6.1, carb: 1.6, fat: 6.7, grams: 50 },
  'scrambled eggs': { cal: 91, pro: 6.1, carb: 1.6, fat: 6.7, grams: 50 },
  'banana': { cal: 89, pro: 1.1, carb: 23, fat: 0.3, grams: 118 },
  'apple': { cal: 95, pro: 0.5, carb: 25, fat: 0.3, grams: 182 },
  'orange': { cal: 62, pro: 1.2, carb: 15, fat: 0.2, grams: 131 },
  'pear': { cal: 101, pro: 0.6, carb: 27, fat: 0.2, grams: 178 },
  'peach': { cal: 58, pro: 1.4, carb: 14, fat: 0.4, grams: 150 },
  'kiwi': { cal: 42, pro: 0.8, carb: 10, fat: 0.4, grams: 76 },
  'date': { cal: 20, pro: 0.2, carb: 5.3, fat: 0, grams: 8 },
  'dates': { cal: 20, pro: 0.2, carb: 5.3, fat: 0, grams: 8 },
  'fig': { cal: 37, pro: 0.4, carb: 10, fat: 0.1, grams: 50 },
  'figs': { cal: 37, pro: 0.4, carb: 10, fat: 0.1, grams: 50 },
  'bread slice': { cal: 79, pro: 2.7, carb: 15, fat: 1, grams: 30 },
  'toast': { cal: 79, pro: 2.7, carb: 15, fat: 1, grams: 30 },
  'cookie': { cal: 48, pro: 0.6, carb: 7, fat: 2, grams: 11 },
  'cookies': { cal: 48, pro: 0.6, carb: 7, fat: 2, grams: 11 }
};

const TARGETS = {
  calories: 2650,
  protein: 140,
  carbs: 330,
  fat: 70
};

const FOOD_ALIASES = {
  'of rice': 'rice',
  'white bread': 'white bread',
  'bread': 'white bread',
  'white cheese': 'white cheese',
  'feta cheese': 'white cheese',
  'feta': 'white cheese'
};

const PIECE_UNITS = new Set(['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'slice', 'slices', 'item', 'items']);
const VOLUME_UNITS = new Set(['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters']);
const WEIGHT_UNITS = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000
};
const SPOON_UNITS = {
  tsp: { sugar: 4, oil: 4, butter: 4, default: 5 },
  teaspoon: { sugar: 4, oil: 4, butter: 4, default: 5 },
  teaspoons: { sugar: 4, oil: 4, butter: 4, default: 5 },
  tbsp: { sugar: 12, oil: 11, butter: 14, default: 15 },
  tablespoon: { sugar: 12, oil: 11, butter: 14, default: 15 },
  tablespoons: { sugar: 12, oil: 11, butter: 14, default: 15 }
};
const DENSITIES = {
  milk: 1.03,
  'whole milk': 1.03,
  'orange juice': 1.04,
  water: 1.0,
  oil: 0.92,
  'olive oil': 0.92,
  'vegetable oil': 0.92,
  coffee: 1.0
};

export function normalizeFood(text) {
  const clean = String(text || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
  return FOOD_ALIASES[clean] || clean;
}

function tokenScore(a, b) {
  const aTokens = new Set(a.split(/\s+/).filter(Boolean));
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  const overlap = [...aTokens].filter(t => bTokens.has(t)).length;
  return overlap / Math.max(aTokens.size, 1);
}

function bestMatch(name, dict) {
  const norm = normalizeFood(name);
  if (dict[norm]) return { key: norm, confidence: 1 };
  let best = null;
  let bestScore = 0;
  for (const key of Object.keys(dict)) {
    const score = tokenScore(norm, key);
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  if (bestScore >= 0.6) return { key: best, confidence: bestScore };
  return { key: null, confidence: 0 };
}

function calcFromBase(base, grams) {
  const m = grams / 100;
  return {
    calories: base.cal * m,
    protein: base.pro * m,
    carbs: base.carb * m,
    fat: base.fat * m
  };
}

async function usdaLookup(food) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', food);
    url.searchParams.set('pageSize', '1');
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    const item = data?.foods?.[0];
    if (!item) return null;
    const nutrients = item.foodNutrients || [];
    const result = { cal: null, pro: 0, carb: 0, fat: 0 };
    for (const n of nutrients) {
      const name = String(n.nutrientName || '').toLowerCase();
      const unit = String(n.unitName || '').toLowerCase();
      const val = Number(n.value || 0);
      if (name.includes('energy') && unit === 'kcal') result.cal = val;
      else if (name.includes('protein')) result.pro = val;
      else if (name.includes('carbohydrate')) result.carb = val;
      else if (name.includes('total lipid')) result.fat = val;
    }
    if (!result.cal || result.cal <= 0) return null;
    return result;
  } catch {
    return null;
  }
}

async function calcByWeight(food, grams) {
  const { key, confidence } = bestMatch(food, FOOD_DB);
  if (key) {
    return { ...calcFromBase(FOOD_DB[key], grams), source: `DB (${Math.round(confidence * 100)}%)` };
  }
  const usda = await usdaLookup(food);
  if (!usda) throw new Error(`No match found for '${food}'`);
  return { ...calcFromBase(usda, grams), source: 'USDA' };
}

export async function calculateNutrition(food, quantity, unit) {
  const unitLower = String(unit || '').toLowerCase().trim();

  if (PIECE_UNITS.has(unitLower)) {
    const { key } = bestMatch(food, UNIT_FOODS);
    if (key) {
      const base = UNIT_FOODS[key];
      return {
        calories: base.cal * quantity,
        protein: base.pro * quantity,
        carbs: base.carb * quantity,
        fat: base.fat * quantity,
        source: `DB/unit (${key})`
      };
    }
    const usda = await usdaLookup(food);
    if (usda) {
      return {
        calories: usda.cal * quantity,
        protein: usda.pro * quantity,
        carbs: usda.carb * quantity,
        fat: usda.fat * quantity,
        source: 'USDA/unit-estimate'
      };
    }
    throw new Error(`No data found for '${food}'`);
  }

  if (unitLower in WEIGHT_UNITS) {
    return calcByWeight(food, quantity * WEIGHT_UNITS[unitLower]);
  }

  if (VOLUME_UNITS.has(unitLower)) {
    let ml = quantity;
    if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'liters') ml *= 1000;
    const density = DENSITIES[normalizeFood(food)] || 1;
    return calcByWeight(food, ml * density);
  }

  if (unitLower in SPOON_UNITS) {
    const gramsPer = SPOON_UNITS[unitLower][normalizeFood(food)] || SPOON_UNITS[unitLower].default;
    return calcByWeight(food, quantity * gramsPer);
  }

  throw new Error(`Unsupported unit '${unit}'`);
}

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function parseNutritionText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const local = parseNutritionTextLocal(raw);
  if (local.length > 0) return local;

  if (!process.env.GROQ_API_KEY) return [];

  const prompt = [
    'Extract food items from the user text and return only JSON.',
    'JSON shape: {"items":[{"food":"string","quantity":number,"unit":"g|kg|ml|l|tsp|tbsp|piece"}]}',
    'Rules:',
    '- 5 eggs => eggs, 5, piece',
    '- 2 bananas => banana, 2, piece',
    '- 400g rice => rice, 400, g',
    '- 250ml milk => milk, 250, ml',
    '- 2 tsp sugar => sugar, 2, tsp',
    '- chicken breast - 165 kcal should not return calories, only the food item if clearly extractable',
    '- return every item you can parse',
    '',
    `Text: ${raw}`
  ].join('\n');

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: 'system', content: 'Return only valid JSON. No markdown. No explanation.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    return sanitizeNutritionItems(parsed?.items || []);
  } catch {
    return [];
  }
}

export function parseNutritionTextLocal(text) {
  const chunks = String(text || '')
    .split(/\n|,|;/)
    .map(x => x.trim())
    .filter(Boolean);

  const items = [];
  for (const chunk of chunks) {
    const norm = normalizeFood(chunk);

    let match = chunk.match(/(\d+(?:\.\d+)?)\s*(kg|g|grams|gram|ml|l|liter|liters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)\s+(.+)/i);
    if (match) {
      items.push({ quantity: parseFloat(match[1]), unit: normalizeUnit(match[2]), food: match[3].trim() });
      continue;
    }

    match = chunk.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|grams|gram|ml|l|liter|liters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)$/i);
    if (match) {
      items.push({ food: match[1].trim(), quantity: parseFloat(match[2]), unit: normalizeUnit(match[3]) });
      continue;
    }

    match = chunk.match(/(\d+(?:\.\d+)?)\s+(.+)/i);
    if (match) {
      const rest = match[2].trim();
      const unitFood = bestMatch(rest, UNIT_FOODS).key ? rest : singularizeFood(rest);
      items.push({ quantity: parseFloat(match[1]), unit: 'piece', food: unitFood });
      continue;
    }
  }
  return sanitizeNutritionItems(items);
}

function singularizeFood(food) {
  const text = String(food || '').trim();
  if (text.toLowerCase().endsWith('s') && !text.toLowerCase().endsWith('ss')) return text.slice(0, -1);
  return text;
}

function normalizeUnit(unit) {
  const u = String(unit || '').toLowerCase().trim();
  if (u === 'grams' || u === 'gram') return 'g';
  if (u === 'liter' || u === 'liters') return 'l';
  if (u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  return u;
}

function cleanFoodLabel(food) {
  return String(food || '')
    .trim()
    .replace(/^of\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ');
}

export function sanitizeNutritionItems(items = []) {
  return items
    .map(item => ({
      food: cleanFoodLabel(item.food || ''),
      quantity: parseFloat(item.quantity),
      unit: normalizeUnit(item.unit)
    }))
    .filter(item => item.food && Number.isFinite(item.quantity) && item.quantity > 0 && item.unit)
    .slice(0, 20);
}

export async function summarizeNutritionItems(items = []) {
  const summary = [];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    const macros = await calculateNutrition(item.food, item.quantity, item.unit);
    const row = {
      food: item.food,
      quantity: item.quantity,
      unit: item.unit,
      ...macros
    };
    summary.push(row);
    totals.calories += row.calories;
    totals.protein += row.protein;
    totals.carbs += row.carbs;
    totals.fat += row.fat;
  }
  return { summary, totals };
}

export async function writeNutritionLog(text, source = 'axis_web') {
  const items = await parseNutritionText(text);
  if (!items.length) throw new Error('NO FOOD ITEMS PARSED');
  const { summary, totals } = await summarizeNutritionItems(items);

  const createdAt = new Date().toISOString();
  const payload = summary.map(item => ({
    description: item.food,
    quantity: item.quantity,
    unit: item.unit,
    calories: Number(item.calories.toFixed(2)),
    protein: Number(item.protein.toFixed(2)),
    carbs: Number(item.carbs.toFixed(2)),
    fat: Number(item.fat.toFixed(2)),
    source,
    logged_at: createdAt
  }));

  const inserted = await supabaseRequest('nutrition_logs', {
    method: 'POST',
    body: payload
  });

  return { inserted, summary, totals, loggedAt: createdAt };
}

export async function fetchNutritionSummary(limit = 20) {
  const rows = await supabaseRequest(`nutrition_logs?select=id,description,quantity,unit,calories,protein,carbs,fat,source,logged_at&order=logged_at.desc&limit=${limit}`);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRows = (rows || []).filter(row => String(row.logged_at).slice(0, 10) === todayKey);
  const totals = todayRows.reduce((acc, row) => {
    acc.calories += Number(row.calories || 0);
    acc.protein += Number(row.protein || 0);
    acc.carbs += Number(row.carbs || 0);
    acc.fat += Number(row.fat || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return { rows: rows || [], todayRows, totals, targets: TARGETS };
}

export async function clearNutritionLogs() {
  await supabaseRequest('nutrition_logs?id=not.is.null', { method: 'DELETE' });
  return true;
}

export { TARGETS };