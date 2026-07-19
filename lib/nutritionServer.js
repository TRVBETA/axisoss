import { upsertDailyTelemetry } from './dailyServer.js';
import { supabaseRequest } from './supabaseServer.js';

const FOOD_DB = {
  'rice': { cal: 130, pro: 2.3, carb: 28.5, fat: 0.3 },
  'raw rice': { cal: 360, pro: 6.7, carb: 80, fat: 0.7 },
  'white cheese': { cal: 264, pro: 14, carb: 4.1, fat: 21 },
  'feta': { cal: 264, pro: 14, carb: 4.1, fat: 21 },
  'basmati rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
  'raw basmati rice': { cal: 365, pro: 7.1, carb: 80, fat: 0.7 },
  'cooked rice': { cal: 130, pro: 2.3, carb: 28.5, fat: 0.3 },
  'cooked basmati rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
  'indomie': { cal: 400, pro: 8, carb: 57, fat: 15 },
  'instant noodles': { cal: 400, pro: 8, carb: 57, fat: 15 },
  'noodles': { cal: 138, pro: 4.5, carb: 25, fat: 2 },
  'chicken breast': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'raw chicken breast': { cal: 120, pro: 22.5, carb: 0, fat: 2.6 },
  'cooked chicken breast': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'chicken': { cal: 165, pro: 31, carb: 0, fat: 4 },
  'raw chicken': { cal: 120, pro: 22.5, carb: 0, fat: 2.6 },
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
  'raw pasta': { cal: 371, pro: 13, carb: 75, fat: 1.5 },
  'cooked pasta': { cal: 131, pro: 5, carb: 25, fat: 1.1 },
  'spaghetti': { cal: 131, pro: 5, carb: 25, fat: 1.1 },
  'raw spaghetti': { cal: 371, pro: 13, carb: 75, fat: 1.5 },
  'cooked spaghetti': { cal: 131, pro: 5, carb: 25, fat: 1.1 },
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
  'white bread slice': { cal: 79, pro: 2.7, carb: 15, fat: 1, grams: 30 },
  'brown bread slice': { cal: 74, pro: 3.9, carb: 12.3, fat: 1.1, grams: 30 },
  'whole wheat bread slice': { cal: 74, pro: 3.9, carb: 12.3, fat: 1.1, grams: 30 },
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
  'uncooked rice': 'raw rice',
  'dry rice': 'raw rice',
  'cooked rice': 'cooked rice',
  'uncooked basmati rice': 'raw basmati rice',
  'dry basmati rice': 'raw basmati rice',
  'rice white': 'rice',
  'white rice': 'rice',
  'white cooked rice': 'cooked rice',
  'cooked white rice': 'cooked rice',
  'white raw rice': 'raw rice',
  'white bread': 'white bread',
  'bread': 'white bread',
  'white bread slices': 'white bread',
  'bread slices': 'white bread',
  'slice of bread': 'white bread',
  'slices of bread': 'white bread',
  'white cheese': 'white cheese',
  'feta cheese': 'white cheese',
  'feta': 'white cheese',
  'milk full fat': 'whole milk',
  'raw chicken breast': 'raw chicken breast',
  'raw chicken': 'raw chicken',
  'uncooked chicken breast': 'raw chicken breast',
  'uncooked chicken': 'raw chicken',
  'cooked chicken breast': 'cooked chicken breast',
  'cooked chicken': 'cooked chicken',
  'raw pasta': 'raw pasta',
  'uncooked pasta': 'raw pasta',
  'dry pasta': 'raw pasta',
  'cooked pasta': 'cooked pasta',
  'raw spaghetti': 'raw spaghetti',
  'uncooked spaghetti': 'raw spaghetti',
  'cooked spaghetti': 'cooked spaghetti',
  'coffee black': 'coffee'
};

const PIECE_UNITS = new Set(['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'slice', 'slices', 'item', 'items']);
const VOLUME_UNITS = new Set(['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters']);
const CUP_UNITS = new Set(['cup', 'cups']);
const WEIGHT_UNITS = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592
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
  coffee: 1.0,
  yogurt: 1.03,
  'greek yogurt': 1.03
};
const CUP_GRAMS = {
  rice: 158,
  'basmati rice': 158,
  'cooked rice': 158,
  'cooked basmati rice': 158,
  oats: 80,
  oatmeal: 80,
  pasta: 140,
  spaghetti: 140,
  milk: 244,
  'whole milk': 244,
  yogurt: 245,
  'greek yogurt': 245,
  'white cheese': 150,
  sugar: 200
};

const UNICODE_FRACTIONS = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8'
};

const WORD_NUMBERS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  quarter: 0.25
};

const PREPARATION_MODES = new Set(['auto', 'raw', 'cooked']);
const PREPARATION_OVERRIDES = {
  rice: { raw: 'raw rice', cooked: 'cooked rice' },
  'basmati rice': { raw: 'raw basmati rice', cooked: 'cooked basmati rice' },
  chicken: { raw: 'raw chicken', cooked: 'cooked chicken' },
  'chicken breast': { raw: 'raw chicken breast', cooked: 'cooked chicken breast' },
  pasta: { raw: 'raw pasta', cooked: 'cooked pasta' },
  spaghetti: { raw: 'raw spaghetti', cooked: 'cooked spaghetti' }
};

const USDA_CACHE = new Map();

const NUTRITION_LOW_QUALITY_FOODS = new Set(['chips', 'potato chips', 'sugar', 'indomie', 'instant noodles', 'cookie', 'cookies']);

export function deriveNutritionScoreFromRows(rows = []) {
  if (!rows.length) return 0;
  const totals = rows.reduce((acc, row) => {
    acc.protein += Number(row.protein || 0);
    return acc;
  }, { protein: 0 });
  const hasLowQuality = rows.some(row => NUTRITION_LOW_QUALITY_FOODS.has(String(row.description || '').toLowerCase()));
  if (totals.protein >= 140 && !hasLowQuality) return 10;
  return 5;
}

async function recalcNutritionScoreForToday(targetLoggedAt = new Date().toISOString()) {
  try {
    const rows = await supabaseRequest('nutrition_logs?select=id,description,quantity,unit,calories,protein,carbs,fat,source,logged_at&order=logged_at.desc&limit=300');
    const dayKey = axisNutritionDayKeyFromDate(new Date(targetLoggedAt));
    const todayRows = (rows || []).filter(row => axisNutritionDayKeyFromDate(new Date(row.logged_at)) === dayKey);
    const score = deriveNutritionScoreFromRows(todayRows);
    await upsertDailyTelemetry({ nutrition_score_v4: score }, dayKey);
  } catch {}
}

function normalizeCustomFoodRow(row = {}) {
  return {
    id: row.id,
    name: cleanFoodLabel(row.name || ''),
    aliases: String(row.aliases || '').split(',').map(part => cleanFoodLabel(part)).filter(Boolean),
    calories_per_100g: Number(row.calories_per_100g || 0),
    protein_per_100g: Number(row.protein_per_100g || 0),
    carbs_per_100g: Number(row.carbs_per_100g || 0),
    fat_per_100g: Number(row.fat_per_100g || 0),
    grams_per_piece: row.grams_per_piece == null || row.grams_per_piece === '' ? null : Number(row.grams_per_piece),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function buildCustomFoodsMap(rows = []) {
  const map = new Map();
  for (const row of rows.map(normalizeCustomFoodRow)) {
    if (!row.name) continue;
    map.set(row.name, row);
    for (const alias of row.aliases) {
      if (alias) map.set(alias, row);
    }
  }
  return map;
}

function resolveCustomFood(food, customFoodsMap) {
  if (!customFoodsMap || !(customFoodsMap instanceof Map) || customFoodsMap.size === 0) return null;
  const clean = cleanFoodLabel(food);
  if (!clean) return null;
  if (customFoodsMap.has(clean)) return customFoodsMap.get(clean);
  let best = null;
  let bestScore = 0;
  for (const [key, value] of customFoodsMap.entries()) {
    const score = tokenScore(clean, key);
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  return bestScore >= 0.8 ? best : null;
}

function calcFromCustomFood(row, grams) {
  const m = grams / 100;
  return {
    calories: Number(row.calories_per_100g || 0) * m,
    protein: Number(row.protein_per_100g || 0) * m,
    carbs: Number(row.carbs_per_100g || 0) * m,
    fat: Number(row.fat_per_100g || 0) * m
  };
}

function buildNutritionBatchSignature(summary = []) {
  return summary.map(item => `${cleanFoodLabel(item.matchedFood || item.food)}:${Number(item.quantity).toFixed(2)}:${normalizeUnit(item.unit)}:${Number(item.calories).toFixed(2)}:${Number(item.protein).toFixed(2)}:${Number(item.carbs).toFixed(2)}:${Number(item.fat).toFixed(2)}`).join('|');
}

function groupNutritionRowsIntoBatches(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row.logged_at || '');
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([loggedAt, batchRows]) => ({
      loggedAt,
      rows: batchRows,
      signature: batchRows.map(row => `${cleanFoodLabel(row.description)}:${Number(row.quantity).toFixed(2)}:${normalizeUnit(row.unit)}:${Number(row.calories || 0).toFixed(2)}:${Number(row.protein || 0).toFixed(2)}:${Number(row.carbs || 0).toFixed(2)}:${Number(row.fat || 0).toFixed(2)}`).join('|')
    }))
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
}

function buildNutritionDraftTextFromBatch(batch) {
  if (!batch?.rows?.length) return '';
  return batch.rows.map(row => {
    const unit = normalizeUnit(row.unit);
    if (unit === 'piece') {
      return `${Number(row.quantity)} ${row.description}`;
    }
    return `${Number(row.quantity)}${unit} ${row.description}`;
  }).join('\n');
}

export function normalizeFood(text) {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\b(?:x|×)\b/g, ' ')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/^of\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/^an\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return FOOD_ALIASES[clean] || clean;
}

function normalizePreparationMode(mode) {
  const clean = String(mode || 'cooked').trim().toLowerCase();
  return PREPARATION_MODES.has(clean) ? clean : 'cooked';
}

function stripRecipePrefix(chunk) {
  const text = String(chunk || '').trim();
  const colonIndex = text.indexOf(':');
  if (colonIndex === -1) return text;
  const left = text.slice(0, colonIndex).trim();
  const right = text.slice(colonIndex + 1).trim();
  if (!right) return text;
  if (/\d/.test(left)) return text;
  if (!/\d/.test(right) && !/(half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a\b|an\b)/i.test(right)) return text;
  return right;
}

function applyPreparationMode(food, mode) {
  const normalizedMode = normalizePreparationMode(mode);
  const cleanFood = cleanFoodLabel(food);
  if (!cleanFood || normalizedMode === 'auto') return cleanFood;
  if (/^(raw|cooked)\b/i.test(cleanFood)) return cleanFood;
  const direct = PREPARATION_OVERRIDES[cleanFood];
  if (direct?.[normalizedMode]) return direct[normalizedMode];
  const alias = bestMatch(cleanFood, PREPARATION_OVERRIDES).key;
  if (alias && PREPARATION_OVERRIDES[alias]?.[normalizedMode]) return PREPARATION_OVERRIDES[alias][normalizedMode];
  return cleanFood;
}

function tokenScore(a, b) {
  const aTokens = new Set(String(a || '').split(/\s+/).filter(Boolean));
  const bTokens = new Set(String(b || '').split(/\s+/).filter(Boolean));
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

function normalizeUnit(unit) {
  const u = String(unit || '').toLowerCase().trim();
  if (u === 'grams' || u === 'gram' || u === 'gm' || u === 'gms') return 'g';
  if (u === 'kilogram' || u === 'kilograms' || u === 'kgs') return 'kg';
  if (u === 'liter' || u === 'liters') return 'l';
  if (u === 'milliliter' || u === 'milliliters') return 'ml';
  if (u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'pieces' || u === 'pc' || u === 'pcs' || u === 'items' || u === 'units') return 'piece';
  if (u === 'slices') return 'slice';
  return u;
}

function applyUnicodeFractions(text) {
  let out = String(text || '');
  for (const [symbol, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.replaceAll(symbol, ` ${replacement} `);
  }
  return out;
}

function cleanFoodLabel(food) {
  return normalizeFood(
    String(food || '')
      .replace(/\b(?:with|and|plus)\b\s*$/i, '')
      .replace(/^of\s+/i, '')
      .replace(/^the\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function parseSimpleFraction(token) {
  const match = String(token || '').match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!denominator) return null;
  return numerator / denominator;
}

function parseNumberToken(token) {
  const raw = String(token || '').trim().toLowerCase().replace(',', '.');
  if (!raw) return null;
  if (WORD_NUMBERS[raw] != null) return WORD_NUMBERS[raw];
  const frac = parseSimpleFraction(raw);
  if (frac != null) return frac;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseAmountFromTokens(tokens, startIndex = 0) {
  const first = parseNumberToken(tokens[startIndex]);
  if (first == null) return null;
  const second = parseSimpleFraction(tokens[startIndex + 1]);
  if (second != null) {
    return { value: first + second, consumed: 2 };
  }
  return { value: first, consumed: 1 };
}

function parseAmountFromTail(tokens) {
  if (!tokens.length) return null;
  const last = parseNumberToken(tokens[tokens.length - 1]);
  if (last == null) return null;
  if (tokens.length >= 2) {
    const prev = parseNumberToken(tokens[tokens.length - 2]);
    if (prev != null && prev >= 1 && tokens[tokens.length - 1].includes('/')) {
      return { value: prev + (parseSimpleFraction(tokens[tokens.length - 1]) || 0), consumed: 2 };
    }
  }
  return { value: last, consumed: 1 };
}

function stripMacroNoise(text) {
  return String(text || '')
    .replace(/\s*[-–—]\s*\d+(?:\.\d+)?\s*kcal\b.*$/i, '')
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*kcal[^)]*\)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function separateAttachedUnits(text) {
  return String(text || '')
    .replace(/(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*(kg|kgs|g|gm|gms|grams|gram|ml|l|liter|liters|milliliter|milliliters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|cups?|oz|ounce|ounces|lb|lbs|pound|pounds)\b/gi, '$1 $2')
    .replace(/(\d+(?:[.,]\d+)?)\s*([x×])\s*(?=[a-z])/gi, '$1 $2 ');
}

function splitNutritionChunks(text) {
  const raw = separateAttachedUnits(applyUnicodeFractions(text))
    .replace(/[+•]/g, '\n')
    .replace(/\r/g, '\n');

  const firstPass = raw
.split(/\n|,|;/)
    .map(part => stripRecipePrefix(part.trim()))
    .filter(Boolean);

  const out = [];
  const amountLeadRegex = /(?:^|\s)(?:\d|[¼½¾]|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a\b|an\b)/i;
  for (const chunk of firstPass) {
    const sub = chunk
      .split(/\band\b(?=\s*(?:\d|[¼½¾]|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a\b|an\b))/i)
      .map(part => part.trim())
      .filter(Boolean);
    if (sub.length > 1) {
      out.push(...sub);
      continue;
    }
    if (amountLeadRegex.test(chunk)) {
      out.push(chunk);
    }
  }
  return out;
}

function resolvePieceFood(food, countUnit = 'piece') {
  const clean = cleanFoodLabel(food);
  const normalizedUnit = normalizeUnit(countUnit);
  if (!clean) return '';

  const breadMatch = bestMatch(clean, {
    'white bread': true,
    'bread': true,
    'brown bread': true,
    'whole wheat bread': true,
    'toast': true
  }).key;

  if (normalizedUnit === 'slice') {
    if (breadMatch === 'brown bread') return 'brown bread slice';
    if (breadMatch === 'whole wheat bread') return 'whole wheat bread slice';
    if (breadMatch === 'toast') return 'toast';
    if (breadMatch) return 'white bread slice';
  }

  if (breadMatch === 'brown bread') return 'brown bread slice';
  if (breadMatch === 'whole wheat bread') return 'whole wheat bread slice';
  if (breadMatch === 'toast') return 'toast';
  if (breadMatch) return 'white bread slice';

  const direct = bestMatch(clean, UNIT_FOODS).key;
  if (direct) return direct;
  return singularizeFood(clean);
}

function parseChunkLeading(chunk) {
  const normalized = separateAttachedUnits(stripMacroNoise(chunk));
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  const amount = parseAmountFromTokens(tokens, 0);
  if (!amount) return null;
  let idx = amount.consumed;
  if (tokens[idx] && /^(x|×)$/i.test(tokens[idx])) idx += 1;

  const maybeUnit = normalizeUnit(tokens[idx] || '');
  if (maybeUnit in WEIGHT_UNITS || VOLUME_UNITS.has(maybeUnit) || CUP_UNITS.has(maybeUnit) || maybeUnit in SPOON_UNITS) {
    const food = cleanFoodLabel(tokens.slice(idx + 1).join(' '));
    if (!food) return null;
    return { quantity: amount.value, unit: maybeUnit, food };
  }

  if (PIECE_UNITS.has(maybeUnit)) {
    const food = resolvePieceFood(tokens.slice(idx + 1).join(' '), maybeUnit);
    if (!food) return null;
    return { quantity: amount.value, unit: maybeUnit, food };
  }

  const food = resolvePieceFood(tokens.slice(idx).join(' '), 'piece');
  if (!food) return null;
  return { quantity: amount.value, unit: 'piece', food };
}

function parseChunkTrailing(chunk) {
  const normalized = separateAttachedUnits(stripMacroNoise(chunk));
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const lastUnit = normalizeUnit(tokens[tokens.length - 1]);
  if (!(lastUnit in WEIGHT_UNITS || VOLUME_UNITS.has(lastUnit) || CUP_UNITS.has(lastUnit) || lastUnit in SPOON_UNITS || PIECE_UNITS.has(lastUnit))) {
    return null;
  }

  const amount = parseAmountFromTail(tokens.slice(0, -1));
  if (!amount) return null;

  const foodTokens = tokens.slice(0, -1 - amount.consumed);
  const food = PIECE_UNITS.has(lastUnit)
    ? resolvePieceFood(foodTokens.join(' '), lastUnit)
    : cleanFoodLabel(foodTokens.join(' '));
  if (!food) return null;
  return { quantity: amount.value, unit: lastUnit, food };
}

function parseNutritionChunk(chunk) {
  return parseChunkLeading(chunk) || parseChunkTrailing(chunk);
}

function singularizeFood(food) {
  const text = String(food || '').trim();
  if (!text) return '';
  if (text.toLowerCase().endsWith('s') && !text.toLowerCase().endsWith('ss')) return text.slice(0, -1);
  return text;
}

function sanitizeUnitForOutput(unit) {
  const clean = normalizeUnit(unit);
  if (clean === 'slice') return 'piece';
  return clean;
}

function extractUsdaMacrosFromNutrients(nutrients = []) {
  const result = { cal: null, pro: 0, carb: 0, fat: 0 };
  for (const nutrientRow of nutrients) {
    const nutrientObj = nutrientRow?.nutrient || {};
    const name = String(nutrientRow?.nutrientName || nutrientObj?.name || '').toLowerCase();
    const unit = String(nutrientRow?.unitName || nutrientObj?.unitName || '').toLowerCase();
    const number = String(nutrientObj?.number || nutrientRow?.nutrientNumber || nutrientRow?.number || '');
    const val = Number(nutrientRow?.amount ?? nutrientRow?.value ?? 0);
    if (!Number.isFinite(val)) continue;

    if ((name.includes('energy') && unit === 'kcal') || number === '1008' || number === '208') result.cal = val;
    else if (name.includes('protein') || number === '1003' || number === '203') result.pro = val;
    else if (name.includes('carbohydrate') || number === '1005' || number === '205') result.carb = val;
    else if (name.includes('total lipid') || name === 'fat' || number === '1004' || number === '204') result.fat = val;
  }
  return result.cal && result.cal > 0 ? result : null;
}

function scoreUsdaCandidate(query, item) {
  const normalizedQuery = normalizeFood(query);
  const description = normalizeFood(item?.description || item?.lowercaseDescription || '');
  if (!description) return -Infinity;

  let score = tokenScore(normalizedQuery, description) * 10;
  if (description === normalizedQuery) score += 12;
  if (description.startsWith(normalizedQuery + ' ')) score += 4;
  if (description.includes(' ' + normalizedQuery + ' ')) score += 2;

  const dataType = String(item?.dataType || '').toLowerCase();
  if (dataType.includes('foundation')) score += 2;
  else if (dataType.includes('legacy')) score += 1.5;
  else if (dataType.includes('survey')) score += 1;
  else if (dataType.includes('branded')) score -= 2;

  if (item?.brandOwner) score -= 1.5;
  return score;
}

async function usdaLookup(food) {
  const apiKey = process.env.USDA_API_KEY;
  const normalizedFood = normalizeFood(food);
  if (!apiKey || !normalizedFood) return null;
  if (USDA_CACHE.has(normalizedFood)) return USDA_CACHE.get(normalizedFood);

  try {
    const searchUrl = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    searchUrl.searchParams.set('api_key', apiKey);
    searchUrl.searchParams.set('query', normalizedFood);
    searchUrl.searchParams.set('pageSize', '8');

    const searchResp = await fetch(searchUrl.toString());
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const foods = Array.isArray(searchData?.foods) ? searchData.foods : [];
    if (!foods.length) return null;

    const best = [...foods].sort((a, b) => scoreUsdaCandidate(normalizedFood, b) - scoreUsdaCandidate(normalizedFood, a))[0];
    if (!best?.fdcId) return null;

    const detailUrl = new URL(`https://api.nal.usda.gov/fdc/v1/food/${best.fdcId}`);
    detailUrl.searchParams.set('api_key', apiKey);
    const detailResp = await fetch(detailUrl.toString());
    const detailData = detailResp.ok ? await detailResp.json() : best;

    const extracted = extractUsdaMacrosFromNutrients(detailData?.foodNutrients || best?.foodNutrients || []);
    if (!extracted) return null;
    USDA_CACHE.set(normalizedFood, extracted);
    return extracted;
  } catch {
    return null;
  }
}

async function calcByWeight(food, grams) {
  const { key, confidence } = bestMatch(food, FOOD_DB);
  if (key) {
    return { ...calcFromBase(FOOD_DB[key], grams), source: `DB (${Math.round(confidence * 100)}%)`, matchedFood: key };
  }
  const usda = await usdaLookup(food);
  if (!usda) throw new Error(`No match found for '${food}'`);
  return { ...calcFromBase(usda, grams), source: 'USDA', matchedFood: normalizeFood(food) };
}

export async function calculateNutrition(food, quantity, unit, context = {}) {
  const unitLower = normalizeUnit(unit);
  const cleanFood = cleanFoodLabel(food);
  const customFood = resolveCustomFood(cleanFood, context.customFoodsMap);

  if (customFood) {
    if (PIECE_UNITS.has(unitLower)) {
      if (!customFood.grams_per_piece) {
        throw new Error(`Custom food '${customFood.name}' needs grams_per_piece for piece logs`);
      }
      return { ...calcFromCustomFood(customFood, quantity * customFood.grams_per_piece), source: `CUSTOM (${customFood.name})`, matchedFood: customFood.name };
    }
    if (unitLower in WEIGHT_UNITS) {
      return { ...calcFromCustomFood(customFood, quantity * WEIGHT_UNITS[unitLower]), source: `CUSTOM (${customFood.name})`, matchedFood: customFood.name };
    }
  }

  if (PIECE_UNITS.has(unitLower)) {
    const pieceFood = resolvePieceFood(cleanFood, unitLower);
    const { key } = bestMatch(pieceFood, UNIT_FOODS);
    if (!key) {
      throw new Error(`No reliable piece data found for '${food}'`);
    }
    const base = UNIT_FOODS[key];
    return {
      calories: base.cal * quantity,
      protein: base.pro * quantity,
      carbs: base.carb * quantity,
      fat: base.fat * quantity,
      source: `DB/unit (${key})`,
      matchedFood: key
    };
  }

  if (unitLower in WEIGHT_UNITS) {
    return calcByWeight(cleanFood, quantity * WEIGHT_UNITS[unitLower]);
  }

  if (VOLUME_UNITS.has(unitLower)) {
    let ml = quantity;
    if (unitLower === 'l') ml *= 1000;
    const density = DENSITIES[normalizeFood(cleanFood)] || 1;
    return calcByWeight(cleanFood, ml * density);
  }

  if (CUP_UNITS.has(unitLower)) {
    const foodKey = bestMatch(cleanFood, CUP_GRAMS).key || normalizeFood(cleanFood);
    const gramsPerCup = CUP_GRAMS[foodKey];
    if (!gramsPerCup) throw new Error(`No cup conversion found for '${food}'`);
    return calcByWeight(cleanFood, quantity * gramsPerCup);
  }

  if (unitLower in SPOON_UNITS) {
    const foodKey = normalizeFood(cleanFood);
    const gramsPer = SPOON_UNITS[unitLower][foodKey] || SPOON_UNITS[unitLower].default;
    return calcByWeight(cleanFood, quantity * gramsPer);
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

export function parseNutritionTextLocal(text, options = {}) {
  const chunks = splitNutritionChunks(text);
  const items = [];
  const defaultMode = normalizePreparationMode(options.defaultMode);
  for (const chunk of chunks) {
    const parsed = parseNutritionChunk(chunk);
    if (parsed) items.push({ ...parsed, food: applyPreparationMode(parsed.food, defaultMode) });
  }
  return sanitizeNutritionItems(items);
}

export async function parseNutritionText(text, options = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const chunks = splitNutritionChunks(raw);
  const defaultMode = normalizePreparationMode(options.defaultMode);
  const local = parseNutritionTextLocal(raw, { defaultMode });
  if (local.length > 0 && local.length >= Math.max(1, chunks.length)) return local;
  if (local.length > 0 && !process.env.GROQ_API_KEY) return local;
  if (!process.env.GROQ_API_KEY) return [];

  const prompt = [
    'Extract food items from the user text and return only JSON.',
    'JSON shape: {"items":[{"food":"string","quantity":number,"unit":"g|kg|ml|l|cup|tsp|tbsp|piece|slice|oz|lb"}]}',
    'Rules:',
    '- Keep only foods the user actually logged.',
    '- 5 eggs => eggs, 5, piece',
    '- 2 bananas => banana, 2, piece',
    '- 400g rice => rice, 400, g',
    '- rice 400g => rice, 400, g',
    '- 250ml milk => milk, 250, ml',
    '- 2 tsp sugar => sugar, 2, tsp',
    '- 2 slices white bread => white bread, 2, slice',
    '- Ignore calorie notes like "- 165 kcal"',
    '- Return every item you can parse, but do not invent food names or quantities.',
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
    if (!resp.ok) return local;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const aiItems = sanitizeNutritionItems((parsed?.items || []).map(item => ({ ...item, food: applyPreparationMode(item.food || '', defaultMode) })));
    return aiItems.length > local.length ? aiItems : local;
  } catch {
    return local;
  }
}

export function sanitizeNutritionItems(items = []) {
  return items
    .map(item => ({
      food: cleanFoodLabel(item.food || ''),
      quantity: parseFloat(item.quantity),
      unit: sanitizeUnitForOutput(item.unit)
    }))
    .filter(item => item.food && Number.isFinite(item.quantity) && item.quantity > 0 && item.unit)
    .slice(0, 20);
}

export async function summarizeNutritionItems(items = [], context = {}) {
  const summary = [];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    const macros = await calculateNutrition(item.food, item.quantity, item.unit, context);
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

export async function writeNutritionLog(text, source = 'axis_web', options = {}) {
  const items = await parseNutritionText(text, options);
  if (!items.length) throw new Error('NO FOOD ITEMS PARSED');

  const customFoods = await fetchNutritionCustomFoods();
  const customFoodsMap = buildCustomFoodsMap(customFoods);
  const { summary, totals } = await summarizeNutritionItems(items, { customFoodsMap });
  const signature = buildNutritionBatchSignature(summary);

  if (!options.skipDuplicateCheck) {
    const recentRows = await supabaseRequest('nutrition_logs?select=id,description,quantity,unit,calories,protein,carbs,fat,source,logged_at&order=logged_at.desc&limit=120');
    const batches = groupNutritionRowsIntoBatches(recentRows || []);
    const duplicate = batches.find(batch => batch.signature === signature && Math.abs(new Date(batch.loggedAt).getTime() - Date.now()) <= 90 * 1000);
    if (duplicate) {
      throw new Error('DUPLICATE NUTRITION BATCH BLOCKED');
    }
  }

  const createdAt = new Date().toISOString();
  const payload = summary.map(item => ({
    description: item.matchedFood || item.food,
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

  await recalcNutritionScoreForToday(createdAt);

  return { inserted, summary, totals, items, loggedAt: createdAt, latestBatch: { loggedAt: createdAt, rows: inserted || payload, draftText: buildNutritionDraftTextFromBatch({ rows: inserted || payload }) } };
}

export async function fetchLatestNutritionBatch() {
  const rows = await supabaseRequest('nutrition_logs?select=id,description,quantity,unit,calories,protein,carbs,fat,source,logged_at&order=logged_at.desc&limit=80');
  const batch = groupNutritionRowsIntoBatches(rows || [])[0] || null;
  if (!batch) return null;
  return { ...batch, draftText: buildNutritionDraftTextFromBatch(batch) };
}

export async function deleteNutritionBatch(loggedAt) {
  if (!loggedAt) return false;
  await supabaseRequest(`nutrition_logs?logged_at=eq.${encodeURIComponent(loggedAt)}`, { method: 'DELETE' });
  await recalcNutritionScoreForToday(loggedAt);
  return true;
}

export async function undoLatestNutritionBatch() {
  const latest = await fetchLatestNutritionBatch();
  if (!latest?.loggedAt) return null;
  await deleteNutritionBatch(latest.loggedAt);
  return latest;
}

export async function replaceLatestNutritionBatch(text, source = 'axis_web', options = {}) {
  const latest = await fetchLatestNutritionBatch();
  if (!latest?.loggedAt) throw new Error('NO LATEST NUTRITION BATCH');
  await deleteNutritionBatch(latest.loggedAt);
  return writeNutritionLog(text, source, { ...options, skipDuplicateCheck: true });
}

export async function fetchNutritionCustomFoods(limit = 100) {
  try {
    const rows = await supabaseRequest(`nutrition_custom_foods?select=id,name,aliases,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,grams_per_piece,created_at,updated_at&order=updated_at.desc&limit=${limit}`);
    return (rows || []).map(normalizeCustomFoodRow);
  } catch {
    return [];
  }
}

export async function saveNutritionCustomFood(payload = {}) {
  const body = {
    name: cleanFoodLabel(payload.name || ''),
    aliases: String(payload.aliases || '').split(',').map(part => cleanFoodLabel(part)).filter(Boolean).join(', '),
    calories_per_100g: Number(payload.calories_per_100g || payload.caloriesPer100g || 0),
    protein_per_100g: Number(payload.protein_per_100g || payload.proteinPer100g || 0),
    carbs_per_100g: Number(payload.carbs_per_100g || payload.carbsPer100g || 0),
    fat_per_100g: Number(payload.fat_per_100g || payload.fatPer100g || 0),
    grams_per_piece: payload.grams_per_piece == null || payload.grams_per_piece === '' ? null : Number(payload.grams_per_piece),
    updated_at: new Date().toISOString()
  };
  if (!body.name) throw new Error('CUSTOM FOOD NAME REQUIRED');
  let row;
  try {
    const rows = await supabaseRequest(`nutrition_custom_foods?name=eq.${encodeURIComponent(body.name)}`, { method: 'PATCH', body });
    row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('PATCH_EMPTY');
  } catch {
    const rows = await supabaseRequest('nutrition_custom_foods', { method: 'POST', body: { ...body, created_at: new Date().toISOString() } });
    row = Array.isArray(rows) ? rows[0] : rows;
  }
  return normalizeCustomFoodRow(row);
}

export async function deleteNutritionCustomFood(id) {
  if (!id) return false;
  await supabaseRequest(`nutrition_custom_foods?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchNutritionMealTemplates(limit = 50) {
  try {
    const rows = await supabaseRequest(`nutrition_meal_templates?select=id,name,body_text,default_mode,created_at,updated_at&order=updated_at.desc&limit=${limit}`);
    return rows || [];
  } catch {
    return [];
  }
}

export async function saveNutritionMealTemplate(payload = {}) {
  const body = {
    name: String(payload.name || '').trim(),
    body_text: String(payload.body_text || payload.bodyText || '').trim(),
    default_mode: normalizePreparationMode(payload.default_mode || payload.defaultMode || 'auto'),
    updated_at: new Date().toISOString()
  };
  if (!body.name) throw new Error('TEMPLATE NAME REQUIRED');
  if (!body.body_text) throw new Error('TEMPLATE BODY REQUIRED');
  let row;
  try {
    const rows = await supabaseRequest(`nutrition_meal_templates?name=eq.${encodeURIComponent(body.name)}`, { method: 'PATCH', body });
    row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('PATCH_EMPTY');
  } catch {
    const rows = await supabaseRequest('nutrition_meal_templates', { method: 'POST', body: { ...body, created_at: new Date().toISOString() } });
    row = Array.isArray(rows) ? rows[0] : rows;
  }
  return row;
}

export async function deleteNutritionMealTemplate(id) {
  if (!id) return false;
  await supabaseRequest(`nutrition_meal_templates?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

function cairoDayKeyFromDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function axisNutritionDayKeyFromDate(date = new Date()) {
  return cairoDayKeyFromDate(new Date(new Date(date).getTime() - 6 * 60 * 60 * 1000));
}

export async function fetchNutritionSummary(limit = 20) {
  const rows = await supabaseRequest(`nutrition_logs?select=id,description,quantity,unit,calories,protein,carbs,fat,source,logged_at&order=logged_at.desc&limit=${limit}`);
  const todayKey = axisNutritionDayKeyFromDate(new Date());
  const todayRows = (rows || []).filter(row => axisNutritionDayKeyFromDate(new Date(row.logged_at)) === todayKey);
  const totals = todayRows.reduce((acc, row) => {
    acc.calories += Number(row.calories || 0);
    acc.protein += Number(row.protein || 0);
    acc.carbs += Number(row.carbs || 0);
    acc.fat += Number(row.fat || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const latestBatch = await fetchLatestNutritionBatch().catch(() => null);
  const customFoods = await fetchNutritionCustomFoods().catch(() => []);
  const mealTemplates = await fetchNutritionMealTemplates().catch(() => []);
  return { rows: rows || [], todayRows, totals, targets: TARGETS, latestBatch, customFoods, mealTemplates };
}

export async function deleteNutritionRow(id) {
  if (!id) return false;
  const rows = await supabaseRequest(`nutrition_logs?id=eq.${encodeURIComponent(id)}&select=id,logged_at`);
  const row = Array.isArray(rows) ? rows[0] : rows;
  await supabaseRequest(`nutrition_logs?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (row?.logged_at) await recalcNutritionScoreForToday(row.logged_at);
  return true;
}

export async function clearNutritionLogs() {
  await supabaseRequest('nutrition_logs?id=not.is.null', { method: 'DELETE' });
  try { await upsertDailyTelemetry({ nutrition_score_v4: 0 }); } catch {}
  return true;
}

export { TARGETS };
