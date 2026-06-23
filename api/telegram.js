/* ==========================================
   AXIS OS // api/telegram.js
   Hardened Telegram webhook for shorthand full-session workout logging.
   Writes into fitness_sessions + fitness_sets so AXIS web app can read the same data.
   ========================================== */

import { parseWorkoutText, writeWorkoutSession, inferSplitName, getMovementPatternForExercise, SPLIT_MAP } from '../lib/fitnessServer.js';
import { groqParseWorkout, hasGroqParser, shouldAttemptGroqFallback } from '../lib/groqWorkoutParser.js';

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
    const rawText = String(incoming.text || incoming.caption || '').trim();
    if (!rawText) {
        await safeTelegramReply(chatId, '⚠️ AXIS only parses text workout logs right now. Send text like:\nIncline Bench 80x8 75x9');
        return res.status(200).json({ status: 'NO TEXT CONTENT' });
    }

    const masterChatId = parseInt(process.env.AXIS_MASTER_CHAT_ID || '0', 10);
    if (masterChatId && chatId !== masterChatId) {
        await safeTelegramReply(chatId, '🛑 ACCESS DENIED // CIVILIAN IDENTIFIER DETECTED');
        return res.status(200).json({ status: 'UNAUTHORIZED' });
    }

    try {
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

        if (!exercises.length) {
            await safeTelegramReply(chatId, buildParseFailureMessage(hasGroqParser()));
            return res.status(200).json({ status: 'NO EXERCISES PARSED' });
        }

        const splitName = inferSplitName(exercises);
        const result = await writeWorkoutSession({ splitName, exercises });
        const mainHits = exercises.filter(ex => getMovementPatternForExercise(ex.exercise)).length;

        await safeTelegramReply(chatId, buildConfirmationMessage(result, exercises, mainHits, usedGroq));
        return res.status(200).json({
            status: 'OPTIMAL SYNC',
            splitName: result.splitName,
            exerciseCount: result.exerciseCount,
            setCount: result.setCount,
            usedGroq
        });
    } catch (e) {
        console.error('Telegram Bridge Error:', e);
        await safeTelegramReply(chatId, `⚠️ SYSTEM BRIDGE FAULT:\n${truncate(String(e.message || 'Unknown failure'), 320)}`);
        return res.status(500).json({ error: e.message || 'UNKNOWN ERROR' });
    }
}

function stripLeadingCommand(text) {
    return String(text || '').replace(/^\/(log|session|workout)\b/i, '').trim();
}

function buildHelpMessage() {
    return [
        'AXIS TELEGRAM WORKOUT FORMAT',
        '',
        'Send one exercise per line.',
        'Examples:',
        'Incline Bench 80x8 75x9',
        'Wide Lat Pulldown 90x10 80x12',
        'Shoulder Press 50x8 45x10',
        '',
        'Commands:',
        '/help',
        '/ping',
        '/split',
        '/split chest',
        '/split shoulders',
        '/split legs',
        '',
        'You can also start with /log and then paste the session below it.',
        'AXIS will parse the workout, infer the split, and sync it into the fitness module.'
    ].join('\n');
}

function buildParseFailureMessage(hasAi = false) {
    return [
        `⚠️ AXIS could not parse any exercises${hasAi ? ' even after AI fallback' : ''}.`,
        '',
        'Use one exercise per line, for example:',
        'Incline Bench 80x8 75x9',
        'Wide Lat Pulldown 90x10 80x12',
        'Pushdown 35x12 40x10',
        '',
        'You can also use formats like 50/8 or 10,15,20 × 10,10,8.',
        'Use /split to see the exact exercise names in each split.'
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

    return [
        'Use one of these:',
        '/split',
        '/split chest',
        '/split shoulders',
        '/split legs'
    ].join('\n');
}

function buildConfirmationMessage(result, exercises, mainHits, usedGroq = false) {
    return [
        '⚡ AXIS ACTUAL // TELEMETRY SYNCED',
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
