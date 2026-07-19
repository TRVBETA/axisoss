import { getDailyTelemetry, upsertDailyTelemetry } from './dailyServer.js';
import { supabaseRequest } from './supabaseServer.js';

export const MAIN_LIFT_META = {
    squat: { label: 'SQUAT', repLower: 3 },
    hinge: { label: 'HINGE', repLower: 3 },
    horizontal_press: { label: 'HORIZONTAL PRESS', repLower: 3 },
    vertical_press: { label: 'VERTICAL PRESS', repLower: 5 },
    horizontal_pull: { label: 'HORIZONTAL PULL', repLower: 6 },
    vertical_pull: { label: 'VERTICAL PULL', repLower: 6 }
};

export const CANONICAL_EXERCISES = [
    'Incline Barbell Bench Press',
    'Machine Chest Press',
    'Upper/Mid Cable Fly',
    'Wide-Grip Lat Pulldown',
    'Shoulder-Width Lat Pulldown',
    'Seated Wide-Grip Row',
    'Single-Arm Cable Row',
    'Cable Shrugs',
    'Machine Shoulder Press',
    'Cable Lateral Raises',
    'Shoulder Extension Machine',
    'Dumbbell Incline Curls',
    'Bayesian Cable Curls',
    'Hammer Curls',
    'Triceps Cable Pushdowns',
    'Single-Arm Cable Pushdowns',
    'Overhead Cable Extensions',
    'Back Squat',
    'Hack Squat',
    'Romanian Deadlift',
    'Leg Press',
    'Calf Raises'
];

const EXERCISE_ALIASES = {
    'incline': 'Incline Barbell Bench Press',
    'incline bench': 'Incline Barbell Bench Press',
    'incline bench press': 'Incline Barbell Bench Press',
    'incline barbell bench': 'Incline Barbell Bench Press',
    'incline barbell bench press': 'Incline Barbell Bench Press',
    'machine chest': 'Machine Chest Press',
    'machine press': 'Machine Chest Press',
    'machine chest press': 'Machine Chest Press',
    'upper chest fly': 'Upper/Mid Cable Fly',
    'upper mid cable fly': 'Upper/Mid Cable Fly',
    'upper/mid cable fly': 'Upper/Mid Cable Fly',
    'fly machine': 'Upper/Mid Cable Fly',
    'chest fly': 'Upper/Mid Cable Fly',
    'chest fly machine': 'Upper/Mid Cable Fly',
    'wide lat pulldown': 'Wide-Grip Lat Pulldown',
    'wide grip lat pulldown': 'Wide-Grip Lat Pulldown',
    'wide-grip lat pulldown': 'Wide-Grip Lat Pulldown',
    'lat pulldown': 'Wide-Grip Lat Pulldown',
    'lat pd': 'Wide-Grip Lat Pulldown',
    'shoulder width lat pulldown': 'Shoulder-Width Lat Pulldown',
    'shoulder-width lat pulldown': 'Shoulder-Width Lat Pulldown',
    'seated row': 'Seated Wide-Grip Row',
    'seated wide grip row': 'Seated Wide-Grip Row',
    'seated wide-grip row': 'Seated Wide-Grip Row',
    'single arm cable row': 'Single-Arm Cable Row',
    'single-arm cable row': 'Single-Arm Cable Row',
    'one arm cable row': 'Single-Arm Cable Row',
    'shrugs': 'Cable Shrugs',
    'cable shrugs': 'Cable Shrugs',
    'shoulder press': 'Machine Shoulder Press',
    'machine shoulder press': 'Machine Shoulder Press',
    'db shoulder press': 'Machine Shoulder Press',
    'lateral raise': 'Cable Lateral Raises',
    'lateral raises': 'Cable Lateral Raises',
    'cable lateral raise': 'Cable Lateral Raises',
    'cable lateral raises': 'Cable Lateral Raises',
    'preacher curl': 'Dumbbell Incline Curls',
    'preacher curls': 'Dumbbell Incline Curls',
    'incline curl': 'Dumbbell Incline Curls',
    'incline curls': 'Dumbbell Incline Curls',
    'dumbbell incline curls': 'Dumbbell Incline Curls',
    'bayesian curl': 'Bayesian Cable Curls',
    'bayesian curls': 'Bayesian Cable Curls',
    'bayesian cable curl': 'Bayesian Cable Curls',
    'bayesian cable curls': 'Bayesian Cable Curls',
    'hammer curl': 'Hammer Curls',
    'hammer curls': 'Hammer Curls',
    'pushdown': 'Triceps Cable Pushdowns',
    'pushdowns': 'Triceps Cable Pushdowns',
    'push down': 'Triceps Cable Pushdowns',
    'tricep pushdown': 'Triceps Cable Pushdowns',
    'triceps pushdown': 'Triceps Cable Pushdowns',
    'triceps cable pushdown': 'Triceps Cable Pushdowns',
    'triceps cable pushdowns': 'Triceps Cable Pushdowns',
    'single arm pushdown': 'Single-Arm Cable Pushdowns',
    'single-arm pushdown': 'Single-Arm Cable Pushdowns',
    'single arm cable pushdown': 'Single-Arm Cable Pushdowns',
    'single-arm cable pushdowns': 'Single-Arm Cable Pushdowns',
    'oh extensions': 'Overhead Cable Extensions',
    'overhead extension': 'Overhead Cable Extensions',
    'overhead extensions': 'Overhead Cable Extensions',
    'overhead cable extension': 'Overhead Cable Extensions',
    'overhead cable extensions': 'Overhead Cable Extensions',
    'back squat': 'Back Squat',
    'hack squat': 'Hack Squat',
    'rdl': 'Romanian Deadlift',
    'romanian deadlift': 'Romanian Deadlift',
    'leg press': 'Leg Press',
    'calf raise': 'Calf Raises',
    'calf raises': 'Calf Raises'
};

const MAIN_LIFT_EXERCISE_MAP = {
    squat: ['Back Squat', 'Hack Squat', 'Front Squat', 'Leg Press'],
    hinge: ['Romanian Deadlift', 'Conventional Deadlift', 'Sumo Deadlift', 'Hip Thrust', 'Good Morning'],
    horizontal_press: ['Incline Barbell Bench Press', 'Machine Chest Press', 'Flat Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press'],
    vertical_press: ['Machine Shoulder Press', 'Shoulder Press', 'Overhead Press', 'Dumbbell Shoulder Press', 'Landmine Press', 'Push Press'],
    horizontal_pull: ['Seated Wide-Grip Row', 'Seated Row', 'Single-Arm Cable Row', 'Cable Row', 'Chest-Supported Row', 'Barbell Row'],
    vertical_pull: ['Wide-Grip Lat Pulldown', 'Shoulder-Width Lat Pulldown', 'Lat Pulldown', 'Neutral Grip Pulldown', 'Pull-Up', 'Chin-Up']
};

export const SPLIT_MAP = {
    'Chest + Back': [
        'Incline Barbell Bench Press', 'Machine Chest Press', 'Upper/Mid Cable Fly',
        'Wide-Grip Lat Pulldown', 'Shoulder-Width Lat Pulldown', 'Seated Wide-Grip Row',
        'Single-Arm Cable Row', 'Cable Shrugs'
    ],
    'Shoulders + Arms': [
        'Machine Shoulder Press', 'Cable Lateral Raises', 'Shoulder Extension Machine',
        'Dumbbell Incline Curls', 'Bayesian Cable Curls', 'Hammer Curls',
        'Triceps Cable Pushdowns', 'Single-Arm Cable Pushdowns', 'Overhead Cable Extensions'
    ],
    'Legs': ['Back Squat', 'Hack Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises']
};

const VALID_SET_TYPES = new Set(['leading', 'backoff', 'accessory']);
const VALID_SET_CLASSIFICATIONS = new Set(['warmup', 'top_set', 'backoff', 'accessory']);
const MAX_EXERCISES_PER_SESSION = 24;
const MAX_SETS_PER_EXERCISE = 12;

export function calculateE1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps * 0.0333));
}

export function deriveFitnessScoreFromExercisePayload(exercises = []) {
    const setCount = exercises.reduce((sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
    if (setCount >= 12) return 20;
    if (setCount >= 6) return 15;
    if (setCount >= 1) return 10;
    return 0;
}

function deriveFitnessScoreFromSessions(sessions = [], sets = []) {
    if (!sessions.length) return 0;
    const sessionIds = new Set(sessions.map(s => s.id));
    const daySets = sets.filter(set => sessionIds.has(set.session_id));
    const setCount = daySets.length;
    if (setCount >= 12) return 20;
    if (setCount >= 6) return 15;
    if (setCount >= 1) return 10;
    return 0;
}

async function recalcFitnessScoreForLogDate(logDate) {
    try {
        const startIso = `${logDate}T00:00:00.000Z`;
        const endIso = `${logDate}T23:59:59.999Z`;
        const sessions = await supabaseRequest(`fitness_sessions?select=id,split_name,logged_at&logged_at=gte.${encodeURIComponent(startIso)}&logged_at=lte.${encodeURIComponent(endIso)}&order=logged_at.desc&limit=40`);
        const ids = (sessions || []).map(s => s.id);
        const sets = ids.length ? await fetchSessionSetsWithFallback(ids) : [];
        const fitnessScore = deriveFitnessScoreFromSessions(sessions || [], sets || []);
        const latest = Array.isArray(sessions) && sessions.length ? sessions[0] : null;
        await upsertDailyTelemetry({
            gym_logged: !!(sessions || []).length,
            gym_split_name: latest?.split_name || 'None',
            fitness_score_v4: fitnessScore
        }, logDate);
    } catch {}
}

function normalizeSetClassification(rawClassification, exerciseName = '', index = 0) {
    const clean = String(rawClassification || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (clean === 'leading' || clean === 'top' || clean === 'topset' || clean === 'top_set') return 'top_set';
    if (clean === 'warmup' || clean === 'warm_up' || clean === 'wu') return 'warmup';
    if (clean === 'backoff' || clean === 'back_off' || clean === 'bo') return 'backoff';
    if (clean === 'accessory') return 'accessory';

    if (getMovementPatternForExercise(exerciseName)) {
        return index === 0 ? 'top_set' : 'backoff';
    }
    return 'accessory';
}

function classificationToLegacySetType(classification) {
    if (classification === 'top_set') return 'leading';
    if (classification === 'backoff') return 'backoff';
    return 'accessory';
}

function normalizeEffortNote(raw) {
    const clean = String(raw || '').trim().toLowerCase();
    if (!clean) return null;
    if (['failure', 'fail', 'amrap'].includes(clean)) return 'failure';
    return null;
}

function normalizeRirValue(value) {
    if (value == null || value === '') return null;
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0 || num > 10) return null;
    return Number(num.toFixed(2));
}

function extractSetModifiers(text) {
    let working = String(text || '');
    let classification = null;
    let effortNote = null;
    let rir = null;

    const rirMatch = working.match(/\brir\s*[:=\-]?\s*(\d+(?:\.\d+)?)\b/i);
    if (rirMatch) {
        rir = normalizeRirValue(rirMatch[1]);
        working = working.replace(rirMatch[0], ' ');
    }

    if (/\b(?:warm\s*up|warmup|wu)\b/i.test(working)) {
        classification = 'warmup';
        working = working.replace(/\b(?:warm\s*up|warmup|wu)\b/gi, ' ');
    } else if (/\b(?:top\s*set|topset|top)\b/i.test(working)) {
        classification = 'top_set';
        working = working.replace(/\b(?:top\s*set|topset|top)\b/gi, ' ');
    } else if (/\b(?:back\s*off|backoff|bo)\b/i.test(working)) {
        classification = 'backoff';
        working = working.replace(/\b(?:back\s*off|backoff|bo)\b/gi, ' ');
    } else if (/\baccessory\b/i.test(working)) {
        classification = 'accessory';
        working = working.replace(/\baccessory\b/gi, ' ');
    }

    if (/\b(?:failure|fail|amrap)\b/i.test(working)) {
        effortNote = 'failure';
        working = working.replace(/\b(?:failure|fail|amrap)\b/gi, ' ');
        if (rir == null) rir = 0;
    }

    return {
        cleanedText: working.replace(/\s+/g, ' ').trim(),
        classification,
        effortNote,
        rir
    };
}

function decorateParsedSets(sets, exerciseName, modifiers = {}) {
    const baseClassification = modifiers.classification || null;
    return sets.map((set, idx) => {
        let classification = normalizeSetClassification(baseClassification, exerciseName, idx);
        if (baseClassification === 'top_set' && idx > 0) classification = 'backoff';
        if (baseClassification === 'warmup') classification = 'warmup';
        if (baseClassification === 'backoff') classification = 'backoff';
        if (baseClassification === 'accessory') classification = 'accessory';

        const out = { ...set };
        if (classification) out.classification = classification;
        if (modifiers.effortNote) out.effortNote = modifiers.effortNote;
        if (modifiers.rir != null) out.rir = modifiers.rir;
        return out;
    });
}

function normalizeToken(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[×]/g, ' x ')
        .replace(/[–—]/g, '-')
        .replace(/[^a-z0-9+\-\/ ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasLetters(text) {
    return /[a-z]/i.test(String(text || ''));
}

function stripBoilerplate(text) {
    return String(text || '')
        .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ' '))
        .replace(/^\/(log|session|workout)\b/i, ' ')
        .replace(/^[•\-–—*#>]+\s*/g, '')
        .replace(/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+/g, '')
        .replace(/^day\s*\d+\s*[:\-]?/i, '')
        .replace(/^\d+[.)-]\s*/, '')
        .trim();
}

function scoreAliasMatch(normalized, alias) {
    if (normalized === alias) return 1000 + alias.length;
    if (normalized.startsWith(alias + ' ')) return 900 + alias.length;
    if (normalized.includes(' ' + alias + ' ')) return 800 + alias.length;
    if (normalized.endsWith(' ' + alias)) return 700 + alias.length;
    if (normalized.includes(alias)) return 500 + alias.length;
    return -1;
}

export function normalizeExerciseName(rawName) {
    const normalized = normalizeToken(rawName);
    if (!normalized) return String(rawName || '').trim();

    if (EXERCISE_ALIASES[normalized]) return EXERCISE_ALIASES[normalized];

    let best = null;
    let bestScore = -1;
    for (const [alias, canonical] of Object.entries(EXERCISE_ALIASES)) {
        const score = scoreAliasMatch(normalized, alias);
        if (score > bestScore) {
            bestScore = score;
            best = canonical;
        }
    }
    if (best) return best;

    const found = CANONICAL_EXERCISES.find(ex => normalizeToken(ex) === normalized);
    return found || String(rawName || '').trim();
}

export function getMovementPatternForExercise(exerciseName) {
    const name = String(exerciseName || '').toLowerCase();
    for (const [pattern, exercises] of Object.entries(MAIN_LIFT_EXERCISE_MAP)) {
        if (exercises.some(ex => ex.toLowerCase() === name)) return pattern;
    }
    return null;
}

export function inferSplitName(exercises = []) {
    const scores = Object.fromEntries(Object.keys(SPLIT_MAP).map(k => [k, 0]));
    exercises.forEach(ex => {
        Object.entries(SPLIT_MAP).forEach(([split, names]) => {
            if (names.some(name => name.toLowerCase() === String(ex.exercise || '').toLowerCase())) {
                scores[split] += 1;
            }
        });
    });
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] === 0) return 'General Session';
    return ranked[0][0];
}

function parseParallelSetLists(text) {
    const cleaned = String(text || '')
        .replace(/[×]/g, 'x')
        .replace(/\s+/g, ' ')
        .trim();

    const match = cleaned.match(/^([0-9.,\s]+)\s*x\s*([0-9.,?fF\s]+)$/i);
    if (!match) return [];
    if (!match[1].includes(',')) return [];

    const left = match[1].split(',').map(x => x.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n > 0);
    const right = match[2]
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        .map(token => token.match(/^\d+$/) ? Number(token) : null);

    const size = Math.min(left.length, right.length);
    const out = [];
    for (let i = 0; i < size; i++) {
        const weight = left[i];
        const reps = right[i];
        if (Number.isFinite(weight) && Number.isFinite(reps) && reps > 0 && reps < 100) {
            out.push({ weight, reps });
        }
    }
    return out;
}

function parseRepeatedWeightNotation(text) {
    const cleaned = String(text || '')
        .replace(/[×]/g, 'x')
        .replace(/kg/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\s*,\s*\d+)+)$/i);
    if (!match) return [];
    const weight = parseFloat(match[1]);
    const repsList = match[2].split(',').map(x => parseInt(x.trim(), 10)).filter(n => Number.isFinite(n) && n > 0 && n < 100);
    return repsList.map(reps => ({ weight, reps }));
}

function parseSetsRepsAtWeight(text) {
    const cleaned = String(text || '')
        .replace(/[×]/g, 'x')
        .replace(/kg/gi, '')
        .replace(/\s+at\s+/gi, '@')
        .replace(/\s+/g, ' ')
        .trim();

    const match = cleaned.match(/^(\d+)\s*x\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)$/i);
    if (!match) return [];
    const sets = parseInt(match[1], 10);
    const reps = parseInt(match[2], 10);
    const weight = parseFloat(match[3]);
    if (!Number.isFinite(sets) || !Number.isFinite(reps) || !Number.isFinite(weight) || sets <= 0 || sets > 20) return [];
    return Array.from({ length: sets }, () => ({ weight, reps }));
}

function parseTripleNotation(text) {
    const cleaned = String(text || '')
        .replace(/[×]/g, 'x')
        .replace(/kg/gi, '')
        .replace(/\s+/g, '')
        .trim();

    const match = cleaned.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
    if (!match) return [];
    const a = parseFloat(match[1]);
    const b = parseFloat(match[2]);
    const c = parseFloat(match[3]);

    if (a > 20 && b > 0 && b < 100 && c > 0 && c <= 20) {
        return Array.from({ length: parseInt(c, 10) }, () => ({ weight: a, reps: parseInt(b, 10) }));
    }
    if (a > 0 && a <= 20 && b > 0 && b < 100 && c > 20) {
        return Array.from({ length: parseInt(a, 10) }, () => ({ weight: c, reps: parseInt(b, 10) }));
    }
    return [];
}

function parseInlinePairs(text) {
    const cleaned = String(text || '')
        .replace(/[×]/g, 'x')
        .replace(/kg/gi, '')
        .replace(/\b(?:ds|drop\s*set|fail(?:ure)?|amrap|assisted|bb|db|smith)\b/gi, ' ')
        .replace(/[()\[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const pairs = [];
    const pairRegex = /(\d+(?:\.\d+)?)\s*(?:x|\/|by)\s*(\d+(?:\.\d+)?)/gi;
    let match;
    while ((match = pairRegex.exec(cleaned)) !== null) {
        const a = parseFloat(match[1]);
        const b = parseFloat(match[2]);
        if (a <= 30 && b >= a) {
            pairs.push({ weight: b, reps: parseInt(a, 10) });
        } else {
            pairs.push({ weight: a, reps: parseInt(b, 10) });
        }
    }

    if (pairs.length > 0) return pairs;

    const nums = [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
    if (nums.length >= 2 && nums.length % 2 === 0) {
        for (let i = 0; i < nums.length; i += 2) {
            pairs.push({ weight: nums[i], reps: parseInt(nums[i + 1], 10) });
        }
    }

    return pairs;
}

function parseSetsFromText(text) {
    const parallel = parseParallelSetLists(text);
    const repeatedWeight = parallel.length ? [] : parseRepeatedWeightNotation(text);
    const setsAtWeight = (parallel.length || repeatedWeight.length) ? [] : parseSetsRepsAtWeight(text);
    const triple = (parallel.length || repeatedWeight.length || setsAtWeight.length) ? [] : parseTripleNotation(text);
    const pairs = parallel.length
        ? parallel
        : repeatedWeight.length
            ? repeatedWeight
            : setsAtWeight.length
                ? setsAtWeight
                : triple.length
                    ? triple
                    : parseInlinePairs(text);
    return pairs
        .map(p => ({ weight: Number(p.weight), reps: Number(p.reps) }))
        .filter(p => Number.isFinite(p.weight) && Number.isFinite(p.reps) && p.weight > 0 && p.reps > 0 && p.reps < 100)
        .slice(0, MAX_SETS_PER_EXERCISE);
}

function splitIntoCandidateChunks(rawText) {
    const cleaned = stripBoilerplate(rawText)
        .replace(/\r/g, '\n')
        .replace(/[•▪◦]/g, '\n')
        .replace(/\s*\|\s*/g, '\n')
        .replace(/\s*;\s*/g, '\n')
        .replace(/\s{3,}/g, '\n');

    return cleaned
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);
}

function parseLineChunk(line) {
    const cleanedLine = stripBoilerplate(line);
    if (!cleanedLine) return null;

    const firstNumber = cleanedLine.search(/\d/);
    if (firstNumber === -1) return null;

    const rawName = cleanedLine.slice(0, firstNumber).trim().replace(/[,:;\-]+$/, '').trim();
    const setPart = cleanedLine.slice(firstNumber).trim();
    if (!rawName || !hasLetters(rawName)) return null;

    const canonical = normalizeExerciseName(rawName);
    const modifiers = extractSetModifiers(setPart);
    const sets = decorateParsedSets(parseSetsFromText(modifiers.cleanedText), canonical, modifiers);
    if (!canonical || !sets.length) return null;

    return { rawExercise: rawName, exercise: canonical, sets };
}

export function parseWorkoutText(rawText) {
    const chunks = splitIntoCandidateChunks(rawText);
    const exercises = [];

    for (const chunk of chunks) {
        const parsed = parseLineChunk(chunk);
        if (parsed) exercises.push(parsed);
    }

    if (exercises.length === 0 && chunks.length === 1) {
        const single = chunks[0];
        const candidateParts = single
            .split(/\s{2,}/)
            .map(x => x.trim())
            .filter(Boolean);
        for (const part of candidateParts) {
            const parsed = parseLineChunk(part);
            if (parsed) exercises.push(parsed);
        }
    }

    return dedupeAndTrimExercises(exercises);
}

function dedupeAndTrimExercises(exercises) {
    const out = [];
    for (const ex of exercises) {
        if (!ex?.exercise || !Array.isArray(ex.sets) || ex.sets.length === 0) continue;
        const fingerprint = `${ex.exercise.toLowerCase()}|${ex.sets.map(s => `${s.weight}x${s.reps}`).join(',')}`;
        if (out.some(existing => `${existing.exercise.toLowerCase()}|${existing.sets.map(s => `${s.weight}x${s.reps}`).join(',')}` === fingerprint)) {
            continue;
        }
        out.push({ ...ex, sets: ex.sets.slice(0, MAX_SETS_PER_EXERCISE) });
        if (out.length >= MAX_EXERCISES_PER_SESSION) break;
    }
    return out;
}

export function sanitizeIncomingExercises(exercises = []) {
    return dedupeAndTrimExercises(
        exercises.map(item => {
            const exercise = normalizeExerciseName(item.exercise || item.rawExercise || '');
            const sets = Array.isArray(item.sets)
                ? item.sets
                    .map((set, idx) => {
                        const weight = parseFloat(set.weight);
                        const reps = parseInt(set.reps, 10);
                        const rawClassification = set.classification || set.setClassification || set.set_type || set.setType;
                        const classification = normalizeSetClassification(rawClassification, exercise, idx);
                        const legacySetType = VALID_SET_TYPES.has(String(set.setType || '').toLowerCase().trim())
                            ? String(set.setType || '').toLowerCase().trim()
                            : classificationToLegacySetType(classification);
                        const effortNote = normalizeEffortNote(set.effortNote || set.note || set.effort_note || '');
                        let rir = normalizeRirValue(set.rir);
                        if (effortNote === 'failure' && rir == null) rir = 0;
                        return {
                            weight,
                            reps,
                            setType: legacySetType,
                            classification,
                            rir,
                            effortNote,
                            isWarmup: classification === 'warmup'
                        };
                    })
                    .filter(set => Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.weight > 0 && set.reps > 0 && set.reps < 100)
                : [];
            return { exercise, sets };
        })
    );
}

function normalizeLoggedAt(loggedAt) {
    if (!loggedAt) return new Date().toISOString();
    const date = new Date(loggedAt);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function buildWorkoutSignature(exercises = []) {
    const clean = sanitizeIncomingExercises(exercises);
    return clean.map(ex => `${String(ex.exercise || '').toLowerCase()}::${(ex.sets || []).map(set => {
        const cls = String(set.classification || '').toLowerCase();
        const rir = set.rir == null ? '' : Number(set.rir);
        const effort = String(set.effortNote || '').toLowerCase();
        return `${Number(set.weight)}x${Number(set.reps)}:${cls}:${rir}:${effort}`;
    }).join(',')}`).join('|');
}

async function fetchSessionSetsWithFallback(sessionIds = []) {
    if (!sessionIds.length) return [];
    const idList = sessionIds.join(',');
    try {
        return await supabaseRequest(`fitness_sets?select=id,session_id,exercise_name,set_type,set_classification,rir,effort_note,is_warmup,weight,reps,e1rm,logged_at&session_id=in.(${idList})&order=logged_at.asc`);
    } catch {
        return await supabaseRequest(`fitness_sets?select=id,session_id,exercise_name,set_type,weight,reps,e1rm,logged_at&session_id=in.(${idList})&order=logged_at.asc`);
    }
}

function buildSessionExercisesFromRows(rows = []) {
    const grouped = new Map();
    for (const row of rows) {
        const key = String(row.exercise_name || '');
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push({
            weight: Number(row.weight),
            reps: Number(row.reps),
            setType: row.set_type,
            classification: row.set_classification || (row.set_type === 'leading' ? 'top_set' : row.set_type || 'accessory'),
            rir: row.rir == null ? null : Number(row.rir),
            effortNote: row.effort_note || null,
            isWarmup: !!row.is_warmup,
            logged_at: row.logged_at
        });
    }
    return [...grouped.entries()].map(([exercise, sets]) => ({ exercise, sets }));
}

async function findDuplicateWorkoutSession({ splitName, exercises, loggedAt, ignoreSessionId = null }) {
    const signature = buildWorkoutSignature(exercises);
    if (!signature) return null;

    const targetTime = new Date(loggedAt || Date.now()).getTime();
    if (!Number.isFinite(targetTime)) return null;
    const startIso = new Date(targetTime - 5 * 60 * 1000).toISOString();
    const endIso = new Date(targetTime + 5 * 60 * 1000).toISOString();
    const sessions = await supabaseRequest(`fitness_sessions?select=id,split_name,logged_at&logged_at=gte.${encodeURIComponent(startIso)}&logged_at=lte.${encodeURIComponent(endIso)}&order=logged_at.desc&limit=20`);
    const filteredSessions = (sessions || []).filter(session => session.id !== ignoreSessionId);
    if (!filteredSessions.length) return null;
    const sets = await fetchSessionSetsWithFallback(filteredSessions.map(session => session.id));

    for (const session of filteredSessions) {
        const sessionRows = (sets || []).filter(row => row.session_id === session.id);
        const sessionExercises = buildSessionExercisesFromRows(sessionRows);
        const sessionSignature = buildWorkoutSignature(sessionExercises);
        const timeDelta = Math.abs(new Date(session.logged_at).getTime() - targetTime);
        if (sessionSignature === signature && String(session.split_name || '') === String(splitName || session.split_name || '') && timeDelta <= 90 * 1000) {
            return session;
        }
    }
    return null;
}

export async function fetchLatestWorkoutSession() {
    const sessions = await supabaseRequest('fitness_sessions?select=id,split_name,logged_at&order=logged_at.desc&limit=1');
    const session = Array.isArray(sessions) ? sessions[0] : sessions;
    if (!session?.id) return null;
    const sets = await fetchSessionSetsWithFallback([session.id]);
    const exercises = buildSessionExercisesFromRows(sets || []);
    return {
        id: session.id,
        splitName: session.split_name,
        loggedAt: session.logged_at,
        exercises
    };
}

export async function deleteWorkoutSessionById(sessionId) {
    if (!sessionId) return false;
    const sessionRows = await supabaseRequest(`fitness_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,logged_at`);
    const session = Array.isArray(sessionRows) ? sessionRows[0] : sessionRows;
    await supabaseRequest(`fitness_sessions?id=eq.${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    if (session?.logged_at) await recalcFitnessScoreForLogDate(String(session.logged_at).slice(0, 10));
    return true;
}

export async function undoLatestWorkoutSession() {
    const latest = await fetchLatestWorkoutSession();
    if (!latest?.id) return null;
    await deleteWorkoutSessionById(latest.id);
    return latest;
}

export async function replaceLatestWorkoutSession({ splitName, exercises, loggedAt }) {
    const latest = await fetchLatestWorkoutSession();
    if (!latest?.id) throw new Error('NO LATEST FITNESS SESSION');
    await deleteWorkoutSessionById(latest.id);
    return writeWorkoutSession({ splitName, exercises, loggedAt, allowDuplicate: true, ignoreSessionId: latest.id });
}

export async function writeWorkoutSession({ splitName, exercises, loggedAt, allowDuplicate = false, ignoreSessionId = null }) {
    const cleanExercises = sanitizeIncomingExercises(exercises);
    if (!Array.isArray(cleanExercises) || cleanExercises.length === 0) {
        throw new Error('NO EXERCISES TO WRITE');
    }

    const resolvedSplit = splitName || inferSplitName(cleanExercises);
    const sessionLoggedAt = normalizeLoggedAt(loggedAt);

    if (!allowDuplicate) {
        const duplicate = await findDuplicateWorkoutSession({ splitName: resolvedSplit, exercises: cleanExercises, loggedAt: sessionLoggedAt, ignoreSessionId });
        if (duplicate) {
            throw new Error('DUPLICATE FITNESS SESSION BLOCKED');
        }
    }

    const sessionRows = await supabaseRequest('fitness_sessions', {
        method: 'POST',
        body: { split_name: resolvedSplit, logged_at: sessionLoggedAt }
    });

    const session = Array.isArray(sessionRows) ? sessionRows[0] : sessionRows;
    if (!session?.id) throw new Error('FAILED TO CREATE FITNESS SESSION');

    const setRows = [];
    cleanExercises.forEach(exerciseItem => {
        exerciseItem.sets.forEach(set => {
            setRows.push({
                session_id: session.id,
                exercise_name: exerciseItem.exercise,
                set_type: set.setType,
                set_classification: set.classification,
                rir: set.rir,
                effort_note: set.effortNote,
                is_warmup: !!set.isWarmup,
                weight: set.weight,
                reps: set.reps,
                e1rm: calculateE1RM(set.weight, set.reps),
                logged_at: sessionLoggedAt
            });
        });
    });

    try {
        let insertedSets;
        try {
            insertedSets = await supabaseRequest('fitness_sets', {
                method: 'POST',
                body: setRows
            });
        } catch {
            insertedSets = await supabaseRequest('fitness_sets', {
                method: 'POST',
                body: setRows.map(({ session_id, exercise_name, set_type, weight, reps, e1rm, logged_at }) => ({ session_id, exercise_name, set_type, weight, reps, e1rm, logged_at }))
            });
        }

        await upsertDailyTelemetry({
            gym_logged: true,
            gym_split_name: session.split_name || 'Tracked Session',
            fitness_score_v4: deriveFitnessScoreFromExercisePayload(cleanExercises)
        }, sessionLoggedAt.slice(0, 10));

        return {
            session,
            sets: insertedSets,
            splitName: session.split_name,
            exerciseCount: cleanExercises.length,
            setCount: setRows.length,
            exercises: cleanExercises
        };
    } catch (e) {
        try {
            await supabaseRequest(`fitness_sessions?id=eq.${session.id}`, { method: 'DELETE' });
        } catch {}
        throw e;
    }
}

export async function clearAllFitnessData() {
    await supabaseRequest('fitness_sets?id=not.is.null', { method: 'DELETE' });
    await supabaseRequest('fitness_sessions?id=not.is.null', { method: 'DELETE' });
    try { await upsertDailyTelemetry({ gym_logged: false, gym_split_name: 'None', fitness_score_v4: 0 }); } catch {}
    return true;
}

export async function fetchFitnessFeed(limitSessions = 40, limitSets = 250) {
    const sessions = await supabaseRequest(`fitness_sessions?select=id,split_name,logged_at&order=logged_at.desc&limit=${limitSessions}`);
    let sets;
    try {
        sets = await supabaseRequest(`fitness_sets?select=id,session_id,exercise_name,set_type,set_classification,rir,effort_note,is_warmup,weight,reps,e1rm,logged_at&order=logged_at.desc&limit=${limitSets}`);
    } catch {
        sets = await supabaseRequest(`fitness_sets?select=id,session_id,exercise_name,set_type,weight,reps,e1rm,logged_at&order=logged_at.desc&limit=${limitSets}`);
    }

    const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
    const enrichedSets = (sets || [])
        .filter(set => sessionMap.has(set.session_id))
        .map(set => {
            const session = sessionMap.get(set.session_id);
            return { ...set, split_name: session.split_name, session_logged_at: session.logged_at };
        })
        .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

    const grouped = [];
    const groupMap = new Map();
    for (const set of [...enrichedSets].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))) {
        const key = `${set.session_id}__${set.exercise_name}`;
        if (!groupMap.has(key)) {
            const row = {
                id: key,
                split: set.split_name,
                exercise: set.exercise_name,
                date: formatDateLabel(set.logged_at),
                timestamp: new Date(set.logged_at).getTime(),
                setsList: []
            };
            groupMap.set(key, row);
            grouped.push(row);
        }
        groupMap.get(key).setsList.push(set);
    }

    const recentArchives = grouped.slice(0, 5).map(group => {
        const ordered = [...group.setsList].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
        return {
            id: group.id,
            split: group.split,
            exercise: group.exercise,
            sets: ordered.map(set => formatSetSummary(set)).join(', '),
            date: group.date
        };
    });

    const exerciseMemory = grouped.flatMap(group => {
        const ordered = [...group.setsList].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
        return ordered.map(set => ({
            id: set.id,
            groupId: group.id,
            split: group.split,
            exercise: group.exercise,
            weight: Number(set.weight),
            reps: Number(set.reps),
            setType: set.set_type,
            classification: set.set_classification || (set.set_type === 'leading' ? 'top_set' : set.set_type || 'accessory'),
            rir: set.rir == null ? null : Number(set.rir),
            effortNote: set.effort_note || null,
            isWarmup: !!set.is_warmup,
            e1rm: Number(set.e1rm),
            timestamp: new Date(set.logged_at).getTime(),
            dateLabel: formatDateLabel(set.logged_at),
            sessionDateKey: String(set.logged_at).slice(0, 10),
            seriesText: ordered.map(s => formatSetSummary(s)).join(', ')
        }));
    });

    const mainLiftState = buildMainLiftStateFromSets(enrichedSets);
    const telemetry = buildTelemetryFromSessions(sessions || []);
    const latestSession = (sessions && sessions.length)
        ? {
            id: sessions[0].id,
            splitName: sessions[0].split_name,
            loggedAt: sessions[0].logged_at,
            exercises: buildSessionExercisesFromRows((enrichedSets || []).filter(set => set.session_id === sessions[0].id))
        }
        : null;
    return { recentArchives, exerciseMemory, mainLiftState, telemetry, latestSession };
}

function buildMainLiftStateFromSets(sets) {
    const state = {};
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        state[pattern] = { activeExercise: '', history: [] };
    });

    sets
        .filter(set => (set.set_classification ? set.set_classification === 'top_set' : set.set_type === 'leading'))
        .sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
        .forEach(set => {
            const pattern = getMovementPatternForExercise(set.exercise_name);
            if (!pattern) return;
            state[pattern].activeExercise = set.exercise_name;
            state[pattern].history.push({
                id: set.id,
                sessionDateKey: String(set.logged_at).slice(0, 10),
                dateLabel: formatDateLabel(set.logged_at),
                timestamp: new Date(set.logged_at).getTime(),
                exercise: set.exercise_name,
                weight: Number(set.weight),
                reps: Number(set.reps),
                e1rm: Number(set.e1rm)
            });
        });

    return state;
}

function buildTelemetryFromSessions(sessions) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySessions = sessions.filter(s => String(s.logged_at).slice(0, 10) === todayKey);
    if (!todaySessions.length) return { gymLogged: false, gymSplit: 'None' };
    const latest = todaySessions.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0];
    return {
        gymLogged: true,
        gymSplit: latest.split_name || 'Tracked Session',
        lastLoggedTimestamp: new Date(latest.logged_at).getTime()
    };
}

function formatSetSummary(set) {
    const reps = Number(set.reps || 0);
    const weight = Number(set.weight || 0);
    const classification = String(set.set_classification || set.classification || '').trim().toLowerCase();
    const rir = set.rir == null || set.rir === '' ? null : Number(set.rir);
    const effortNote = normalizeEffortNote(set.effort_note || set.effortNote || '');
    const tags = [];
    if (classification === 'warmup') tags.push('WU');
    else if (classification === 'top_set') tags.push('TOP');
    else if (classification === 'backoff') tags.push('BO');
    else if (classification === 'accessory') tags.push('ACC');
    if (rir != null) tags.push(`RIR ${rir}`);
    if (effortNote === 'failure') tags.push('FAIL');
    return `${reps}x${weight}kg${tags.length ? ` [${tags.join(' • ')}]` : ''}`;
}

function formatDateLabel(value) {
    const date = new Date(value);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
}
