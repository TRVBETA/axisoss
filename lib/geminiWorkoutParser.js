import { CANONICAL_EXERCISES, sanitizeIncomingExercises } from './fitnessServer.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

export function hasGeminiParser() {
    return !!process.env.GEMINI_API_KEY;
}

export function extractGeminiJson(text) {
    const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

const PROMPT = (rawText) => [
    'You parse gym workout logs into structured JSON.',
    'Extract only exercises actually performed. Canonical names:',
    CANONICAL_EXERCISES.join(', '),
    '',
    'Return ONLY valid JSON: {"exercises":[{"exercise":"Canonical Name","sets":[{"weight":80,"reps":8}]}]}',
    '',
    'Rules:',
    '- Ignore commentary, motivation, filler.',
    '- Ignore ?, DS, F, failure, assisted if they do not change numbers.',
    '- Split fused exercises on one line into separate entries.',
    '- Each line is usually one exercise.',
    '- Weight may come before/after reps ("80x8", "8 reps @ 80", "80 for 8").',
    '- Dates/greetings are context, not exercises.',
    '- Typos/shorthand -> closest canonical ("wdie ass pulldown" -> Wide-Grip Lat Pulldown, "bnch prss" -> Incline Barbell Bench Press).',
    '- Keep user name if no canonical equivalent.',
    '- Do not invent exercises or sets. Keep only numeric weight and reps.',
    '',
    'Workout log:',
    rawText
].join('\n');

export async function geminiParseWorkout(rawText) {
    if (!hasGeminiParser()) return [];
    const apiKey = process.env.GEMINI_API_KEY;
    const model = DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT(rawText) }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: 'application/json' }
        })
    });
    if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`GEMINI PARSER FAILED // ${t.slice(0, 220)}`);
    }
    const data = await resp.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = extractGeminiJson(content);
    return sanitizeIncomingExercises(parsed?.exercises || []);
}