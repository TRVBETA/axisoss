import { CANONICAL_EXERCISES, sanitizeIncomingExercises } from './fitnessServer.js';

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

export function hasGroqParser() {
    return !!process.env.GROQ_API_KEY;
}

// True when the local parser wrote a name that is not one of the 22 canonical
// exercises ("bnch prss", "chest", "squat" typo'd...). Those pollute exercise
// memory and never show on the main-lift chart, so the AI pass gets a shot at
// mapping them to the closest canonical exercise.
export function hasUnknownExerciseNames(exercises = []) {
    return exercises.some(ex => ex?.exercise && !CANONICAL_EXERCISES.includes(ex.exercise));
}

// True when a single line looks like it fused two exercises:
// "bench 100x8, fly 30x12" / "bench 100x8 rows 80x10". Signal: after the first
// number, more letters appear that are immediately followed by another number
// (set modifiers like ds/bb/fail are never followed by digits, so they don't trip this).
const FUSED_FALSE_FRIENDS = /^(?:for|rep|reps|set|sets|kg|kgs)$/i;

export function hasFusedExerciseLines(rawText) {
    const lines = String(rawText || '').split(/[\n|•▪◦;]+/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const firstDigit = line.search(/\d/);
        if (firstDigit === -1) continue;
        const tail = line.slice(firstDigit);
        const hits = tail.match(/[a-zA-Z]{2,}\s*\d/g) || [];
        // "fly 30" in "100x8, fly 30x12" = fused second exercise;
        // "80 for 8" / "100kg 5 reps" = legit single exercise, skip those words.
        if (hits.some(tok => !FUSED_FALSE_FRIENDS.test(tok.replace(/\s*\d+$/, '')))) return true;
    }
    return false;
}

export function shouldAttemptGroqFallback(rawText, localExercises = []) {
    if (!hasGroqParser()) return false;
    const text = String(rawText || '').trim();
    if (!text) return false;
    if (localExercises.length === 0) return true;
    if (hasUnknownExerciseNames(localExercises)) return true;
    if (hasFusedExerciseLines(text)) return true;

    const lowered = text.toLowerCase();
    const messyHints = ['felt', 'heavy', 'failure', 'drop', 'ds', 'superset', 'damn', 'phew', 'dead', 'burn'];
    const hasMessyHint = messyHints.some(word => lowered.includes(word));
    const manyWords = lowered.split(/\s+/).length >= 14;
    const manyLines = text.split(/\n+/).filter(Boolean).length >= 3;

    return (hasMessyHint && localExercises.length <= 2) || (manyWords && localExercises.length <= 1) || (manyLines && localExercises.length <= 1);
}

export function extractGroqJson(text) {
    const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const slice = cleaned.slice(start, end + 1);
    try {
        return JSON.parse(slice);
    } catch {
        return null;
    }
}

export async function groqParseWorkout(rawText) {
    if (!hasGroqParser()) return [];

    const apiKey = process.env.GROQ_API_KEY;
    const prompt = [
        'You parse gym workout logs into structured JSON.',
        'The user may write messy shorthand, comments, or broken phrasing.',
        'Extract only exercises that were actually performed.',
        'Canonical exercise names allowed:',
        CANONICAL_EXERCISES.join(', '),
        '',
        'Return ONLY valid JSON in this exact shape:',
        '{"exercises":[{"exercise":"Canonical Exercise Name","sets":[{"weight":80,"reps":8},{"weight":75,"reps":9}]}]}',
        '',
        'Rules:',
        '- Ignore commentary, motivation text, and filler words.',
        '- Ignore question marks and uncertain tokens if needed.',
        '- Ignore notes like DS, F, BB, DB, failure, assisted if they do not change the set numbers.',
        '- If a single line mentions two exercises (e.g. "bench 100x8, fly 30x12"), split it into two entries.',
        '- "yesterday", "last night", dates and greetings are context, not exercises — ignore them.',
        '- If an exercise is not in the canonical list, still return the closest canonical exercise name if obvious (typos and shorthand included: "bnch prss" -> Incline Barbell Bench Press, "squat" -> Back Squat).',
        '- If an exercise clearly has no canonical equivalent, keep the user’s name for it.',
        '- Do not invent exercises or sets.',
        '- Keep only numeric weight and reps.',
        '',
        'Workout log:',
        rawText
    ].join('\n');

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            temperature: 0.1,
            max_tokens: 700,
            messages: [
                { role: 'system', content: 'Return only JSON. No markdown. No explanation.' },
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`GROQ PARSER FAILED // ${text.slice(0, 220)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractGroqJson(content);
    const exercises = sanitizeIncomingExercises(parsed?.exercises || []);
    return exercises;
}
