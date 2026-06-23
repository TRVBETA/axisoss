import { CANONICAL_EXERCISES, sanitizeIncomingExercises } from './_fitnessServer.js';

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

export function hasGroqParser() {
    return !!process.env.GROQ_API_KEY;
}

export function shouldAttemptGroqFallback(rawText, localExercises = []) {
    if (!hasGroqParser()) return false;
    const text = String(rawText || '').trim();
    if (!text) return false;
    if (localExercises.length === 0) return true;

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
        '- If an exercise is not in the canonical list, still return the closest canonical exercise name if obvious.',
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
