/* ==========================================
   AXIS OS // api/telegram.js
   Telegram bridge for workout logs, nutrition capture,
   task matching, and voice transcription.
   ========================================== */

import { fetchCoreData, toggleTodo } from '../lib/coreDataServer.js';
import { applyDailyAction, getDailyTelemetry, upsertDailyTelemetry } from '../lib/dailyServer.js';
import { parseWorkoutText, writeWorkoutSession, inferSplitName, getMovementPatternForExercise, SPLIT_MAP } from '../lib/fitnessServer.js';
import { groqParseWorkout, hasGroqParser, shouldAttemptGroqFallback } from '../lib/groqWorkoutParser.js';
import { writeNutritionLog } from '../lib/nutritionServer.js';

const TELEGRAM_VOICE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).json({ status: 'AXIS TELEGRAM BRIDGE // STANDBY' });
    }

    const update = req.body || {};
    const incoming = update.message || update.edited_message;
    if (!incoming || !incoming.chat) {
        return res.status(200).json({ status: 'NO MESSAGE PAYLOAD' });
    }

    const chatId = incoming.chat.id;
    const masterChatId = parseInt(process.env.AXIS_MASTER_CHAT_ID || '0', 10);
    if (masterChatId && chatId !== masterChatId) {
        await safeTelegramReply(chatId, '🛑 ACCESS DENIED // CIVILIAN IDENTIFIER DETECTED');
        return res.status(200).json({ status: 'UNAUTHORIZED' });
    }

    try {
        const extraction = await extractIncomingTextOrTranscript(incoming);
        const rawText = String(extraction.text || '').trim();
        if (!rawText) {
            await safeTelegramReply(chatId, '⚠️ Send text, or send a voice note if Groq voice transcription is enabled.');
            return res.status(200).json({ status: 'NO TEXT CONTENT' });
        }

        const lowered = rawText.toLowerCase();
        if (lowered === '/start' || lowered === '/help') {
            await safeTelegramReply(chatId, buildHelpMessage());
            return res.status(200).json({ status: 'HELP SENT' });
        }

        if (lowered === '/ping') {
            await safeTelegramReply(chatId, 'AXIS TELEGRAM BRIDGE ONLINE // READY');
            return res.status(200).json({ status: 'PONG' });
        }

        if (lowered.startsWith('/split')) {
            await safeTelegramReply(chatId, buildSplitMessage(rawText));
            return res.status(200).json({ status: 'SPLIT SENT' });
        }

        if (lowered.startsWith('/eat') || lowered.startsWith('/food') || lowered.startsWith('ate ')) {
            const nutritionText = stripLeadingCommand(rawText).replace(/^ate\s+/i, '').trim();
            const result = await writeNutritionLog(nutritionText, extraction.source === 'voice' ? 'telegram_voice' : 'telegram_text', { defaultMode: 'auto' });
            await safeTelegramReply(chatId, buildNutritionConfirmationMessage(result));
            return res.status(200).json({ status: 'NUTRITION_SYNCED', itemCount: result.summary?.length || 0 });
        }

        const payloadText = stripLeadingCommand(rawText);
        const localExercises = parseWorkoutText(payloadText);
        let exercises = localExercises;
        let usedGroq = false;

        if (shouldAttemptGroqFallback(payloadText, localExercises)) {
            try {
                const aiExercises = await groqParseWorkout(payloadText);
                if (aiExercises.length >= localExercises.length && aiExercises.length > 0) {
                    exercises = aiExercises;
                    usedGroq = true;
                }
            } catch (groqErr) {
                console.error('Groq fallback parse failed:', groqErr);
            }
        }

        if (exercises.length) {
            const splitName = inferSplitName(exercises);
            const result = await writeWorkoutSession({ splitName, exercises });
            const mainHits = exercises.filter(ex => getMovementPatternForExercise(ex.exercise)).length;
            await safeTelegramReply(chatId, buildConfirmationMessage(result, exercises, mainHits, usedGroq, extraction.source));
            return res.status(200).json({
                status: 'OPTIMAL SYNC',
                splitName: result.splitName,
                exerciseCount: result.exerciseCount,
                setCount: result.setCount,
                usedGroq
            });
        }

        const captureResult = await captureDoneItemsFromText(payloadText, extraction.source);
        await safeTelegramReply(chatId, buildCaptureConfirmationMessage(captureResult));
        return res.status(200).json({ status: 'CAPTURE_SYNCED', ...captureResult });
    } catch (e) {
        console.error('Telegram Bridge Error:', e);
        const status = /DUPLICATE FITNESS SESSION BLOCKED|DUPLICATE NUTRITION BATCH BLOCKED/i.test(String(e.message || '')) ? 409 : 500;
        await safeTelegramReply(chatId, `⚠️ SYSTEM BRIDGE FAULT:\n${truncate(String(e.message || 'Unknown failure'), 320)}`);
        return res.status(status).json({ error: e.message || 'UNKNOWN ERROR' });
    }
}

async function extractIncomingTextOrTranscript(incoming) {
    const rawText = String(incoming.text || incoming.caption || '').trim();
    if (rawText) return { text: rawText, source: 'text' };

    const fileId = incoming.voice?.file_id || incoming.audio?.file_id || incoming.document?.file_id || '';
    if (!fileId) return { text: '', source: 'none' };
    const transcript = await transcribeTelegramFile(fileId);
    return { text: transcript, source: 'voice' };
}

async function transcribeTelegramFile(fileId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN MISSING');
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY REQUIRED FOR VOICE TRANSCRIPTION');

    const fileMetaResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileMeta = await fileMetaResp.json().catch(() => ({}));
    const filePath = fileMeta?.result?.file_path;
    if (!fileMetaResp.ok || !filePath) {
        throw new Error('FAILED TO FETCH TELEGRAM FILE PATH');
    }

    const fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!fileResp.ok) throw new Error('FAILED TO DOWNLOAD TELEGRAM AUDIO');
    const buffer = await fileResp.arrayBuffer();
    const form = new FormData();
    form.append('model', TELEGRAM_VOICE_MODEL);
    form.append('file', new Blob([buffer]), filePath.split('/').pop() || 'voice.ogg');

    const groqResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: form
    });
    const data = await groqResp.json().catch(() => ({}));
    if (!groqResp.ok || !data?.text) {
        throw new Error(data?.error?.message || data?.error || 'VOICE TRANSCRIPTION FAILED');
    }
    return String(data.text || '').trim();
}

async function captureDoneItemsFromText(text, source = 'text') {
    const core = await fetchCoreData();
    const todos = (core?.todos || []).filter(todo => !todo.is_done);
    const normalizedText = normalizeCaptureText(text);
    const phrases = normalizedText.split(/[\n,.!?;]+/).map(part => part.trim()).filter(Boolean);
    const matched = [];
    const suggestions = [];

    for (const todo of todos) {
        const score = scoreTodoAgainstText(todo.title, normalizedText, phrases);
        if (score >= 0.72) {
            await toggleTodo(todo.id, true);
            matched.push(todo.title);
        } else if (score >= 0.45) {
            suggestions.push({ title: todo.title, score });
        }
    }

    const daily = await getDailyTelemetry().catch(() => null);
    const dailyPatch = {};
    if (/\boutside\b|\bsunlight\b|\bwalked\b/.test(normalizedText) && !daily?.went_outside) {
        dailyPatch.went_outside = true;
    }
    if (/\btutorial\b|\blesson\b|\bcourse\b/.test(normalizedText) && !daily?.watched_tutorial) {
        dailyPatch.watched_tutorial = true;
    }
    if (/\bgym\b|\btrained\b|\bworkout\b/.test(normalizedText) && !daily?.gym_logged) {
        dailyPatch.gym_logged = true;
        dailyPatch.gym_split_name = 'Telegram Quick Mark';
    }
    if (Object.keys(dailyPatch).length) {
        await upsertDailyTelemetry(dailyPatch);
    }

    return {
        source,
        transcript: text,
        matched,
        suggestions: suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
    };
}

function normalizeCaptureText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreTodoAgainstText(title, normalizedText, phrases) {
    const normTitle = normalizeCaptureText(title);
    if (!normTitle) return 0;
    if (normalizedText.includes(normTitle)) return 1;

    const todoTokens = new Set(normTitle.split(' ').filter(Boolean));
    let best = 0;
    for (const phrase of phrases) {
        const phraseTokens = new Set(String(phrase).split(' ').filter(Boolean));
        const overlap = [...todoTokens].filter(token => phraseTokens.has(token)).length;
        const score = overlap / Math.max(todoTokens.size, 1);
        if (score > best) best = score;
    }
    return best;
}

function stripLeadingCommand(text) {
    return String(text || '').replace(/^\/(log|session|workout|done|task|eat|food)\b/i, '').trim();
}

function buildHelpMessage() {
    return [
        'AXIS TELEGRAM CAPTURE',
        '',
        'Workout examples:',
        'Incline Bench 80x8 75x9',
        'Wide Lat Pulldown 90x10 80x12',
        'Shoulder Press 3x8@50 warmup',
        '',
        'Nutrition examples:',
        '/eat 3 eggs + 2 bread + 20g cheese',
        '/food 400g rice, 200g chicken breast',
        '',
        'Task capture examples:',
        '/done finish moodboard and export hero',
        'voice note: finished gym, outside, and hero export',
        '',
        'Commands:',
        '/help',
        '/ping',
        '/split'
    ].join('\n');
}

function buildSplitMessage(rawText) {
    const lowered = String(rawText || '').toLowerCase().trim();

    if (lowered === '/split' || lowered === '/split all') {
        return Object.entries(SPLIT_MAP).map(([split, exercises]) => {
            return [`${split.toUpperCase()}`, ...exercises.map(ex => `• ${ex}`)].join('\n');
        }).join('\n\n');
    }

    if (lowered.includes('chest') || lowered.includes('back') || lowered.includes('1')) {
        return ['CHEST + BACK', ...SPLIT_MAP['Chest + Back'].map(ex => `• ${ex}`)].join('\n');
    }
    if (lowered.includes('should') || lowered.includes('arm') || lowered.includes('2')) {
        return ['SHOULDERS + ARMS', ...SPLIT_MAP['Shoulders + Arms'].map(ex => `• ${ex}`)].join('\n');
    }
    if (lowered.includes('leg') || lowered.includes('3')) {
        return ['LEGS', ...SPLIT_MAP['Legs'].map(ex => `• ${ex}`)].join('\n');
    }

    return ['/split', '/split chest', '/split shoulders', '/split legs'].join('\n');
}

function buildConfirmationMessage(result, exercises, mainHits, usedGroq = false, source = 'text') {
    return [
        `⚡ AXIS FITNESS // ${source.toUpperCase()} SYNCED`,
        '',
        `SPLIT: ${result.splitName}`,
        `EXERCISES: ${result.exerciseCount}`,
        `SETS: ${result.setCount}`,
        `MAIN-LIFT LINES: ${mainHits}`,
        `PARSER: ${usedGroq ? 'GROQ FALLBACK' : 'LOCAL PARSER'}`,
        '',
        ...exercises.slice(0, 8).map(ex => `• ${ex.exercise}: ${ex.sets.map(s => `${s.reps}x${s.weight}kg`).join(', ')}`)
    ].join('\n');
}

function buildNutritionConfirmationMessage(result) {
    return [
        '🍽️ AXIS NUTRITION SYNCED',
        '',
        `ITEMS: ${result.summary?.length || 0}`,
        `CALORIES: ${Math.round(result.totals?.calories || 0)}`,
        `PROTEIN: ${Math.round(result.totals?.protein || 0)}g`,
        '',
        ...(result.summary || []).slice(0, 6).map(item => `• ${item.matchedFood || item.food}: ${item.quantity}${item.unit}`)
    ].join('\n');
}

function buildCaptureConfirmationMessage(result) {
    if (result.matched?.length) {
        return [
            `✅ AXIS TASK CAPTURE // ${String(result.source || 'text').toUpperCase()}`,
            '',
            'MATCHED TASKS:',
            ...result.matched.map(item => `• ${item}`)
        ].join('\n');
    }
    return [
        `⚠️ AXIS heard this ${String(result.source || 'text').toUpperCase()} note but found no confident task match.`,
        '',
        `Transcript: ${truncate(result.transcript || '', 180)}`,
        '',
        ...(result.suggestions?.length ? ['Closest tasks:', ...result.suggestions.map(item => `• ${item.title}`)] : ['Try clearer wording or start with /done'])
    ].join('\n');
}

function truncate(text, max = 300) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function safeTelegramReply(chatId, text) {
    try {
        await sendTelegramReply(chatId, text);
    } catch (e) {
        console.error('Telegram reply failed:', e);
    }
}

async function sendTelegramReply(chatId, text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`TELEGRAM API REJECTED REPLY // ${truncate(body, 220)}`);
    }
}
