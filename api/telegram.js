import { isAuthenticatedRequest } from '../lib/axisAuth.js';
/* ------------------------------------------
   AXIS OS // api/telegram.js
   One Telegram bot for workout, nutrition, task capture,
   and optional voice transcription.
   ------------------------------------------ */

import { fetchCoreData, toggleTodo } from '../lib/coreDataServer.js';
import { parseWorkoutText, writeWorkoutSession, inferSplitName, getMovementPatternForExercise, SPLIT_MAP } from '../lib/fitnessServer.js';
import { groqParseWorkout, hasGroqParser, shouldAttemptGroqFallback } from '../lib/groqWorkoutParser.js';
import { writeNutritionLog } from '../lib/nutritionServer.js';

const TELEGRAM_VOICE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        if (!isAuthenticatedRequest(req)) {
            return res.status(200).json({ status: 'AXIS TELEGRAM BRIDGE // STANDBY' });
        }
        const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        const masterChatId = String(process.env.AXIS_MASTER_CHAT_ID || '').trim();
        if (!botToken) {
            return res.status(200).json({
                ok: false,
                status: 'AXIS TELEGRAM BRIDGE // UNCONFIGURED',
                configured: false,
                masterChatLocked: !!masterChatId,
                voiceEnabled: !!process.env.GROQ_API_KEY
            });
        }
        try {
            const [meResp, webhookResp] = await Promise.all([
                fetch(`https://api.telegram.org/bot${botToken}/getMe`),
                fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
            ]);
            const meData = await meResp.json().catch(() => ({}));
            const webhookData = await webhookResp.json().catch(() => ({}));
            const telegramOk = !!(meResp.ok && meData?.ok && meData?.result);
            const webhook = webhookData?.result || {};
            return res.status(200).json({
                ok: telegramOk,
                status: telegramOk ? 'AXIS TELEGRAM BRIDGE // ONLINE' : 'AXIS TELEGRAM BRIDGE // DEGRADED',
                configured: true,
                botUsername: meData?.result?.username || '',
                botId: meData?.result?.id || null,
                masterChatLocked: !!masterChatId,
                voiceEnabled: !!process.env.GROQ_API_KEY,
                webhookUrl: webhook.url || '',
                pendingUpdates: Number(webhook.pending_update_count || 0),
                lastErrorDate: webhook.last_error_date || null,
                lastErrorMessage: webhook.last_error_message || '',
                hasCustomCertificate: !!webhook.has_custom_certificate
            });
        } catch (error) {
            return res.status(200).json({
                ok: false,
                status: 'AXIS TELEGRAM BRIDGE // DEGRADED',
                configured: true,
                masterChatLocked: !!masterChatId,
                voiceEnabled: !!process.env.GROQ_API_KEY,
                error: String(error?.message || error || 'Probe failed')
            });
        }
    }

    const update = req.body || {};
    const callback = update.callback_query;
    const incoming = update.message || update.edited_message;

    const chatId = callback?.message?.chat?.id || incoming?.chat?.id || 0;
    if (!chatId) {
        return res.status(200).json({ status: 'NO TELEGRAM CHAT PAYLOAD' });
    }

    const masterChatId = parseInt(process.env.AXIS_MASTER_CHAT_ID || '0', 10);
    if (!masterChatId) {
        // AXIS_MASTER_CHAT_ID not configured. The bot cannot safely
        // identify the owner. Refuse to act.
        return res.status(503).json({
            status: 'AXIS_MASTER_CHAT_ID NOT CONFIGURED',
            error: 'set AXIS_MASTER_CHAT_ID in Vercel env vars and redeploy'
        });
    }
    if (chatId !== masterChatId) {
        if (callback?.id) await safeAnswerCallback(callback.id, 'Access denied');
        await safeTelegramReply(chatId, '🛑 ACCESS DENIED // CIVILIAN IDENTIFIER DETECTED');
        return res.status(200).json({ status: 'UNAUTHORIZED' });
    }

    try {
        if (callback) {
            await handleTelegramCallback(callback);
            return res.status(200).json({ status: 'CALLBACK_HANDLED' });
        }

        if (!incoming) {
            return res.status(200).json({ status: 'NO MESSAGE PAYLOAD' });
        }

        const extraction = await extractIncomingTextOrTranscript(incoming);
        const rawText = String(extraction.text || '').trim();
        if (!rawText) {
            await safeTelegramReply(chatId, '⚠️ Send text, or send a voice note if voice transcription is enabled.', {
                replyMarkup: buildMainMenuInline()
            });
            return res.status(200).json({ status: 'NO_TEXT_CONTENT' });
        }

        const lowered = rawText.toLowerCase();

        if (lowered === '/start' || lowered === '/help' || lowered === '/menu') {
            await safeTelegramReply(chatId, buildHelpMessage(), { replyMarkup: buildMainMenuInline() });
            return res.status(200).json({ status: 'HELP_SENT' });
        }

        if (lowered === '/ping') {
            await safeTelegramReply(chatId, 'AXIS TELEGRAM BRIDGE ONLINE // READY', { replyMarkup: buildMainMenuInline() });
            return res.status(200).json({ status: 'PONG' });
        }

        if (lowered === '/cancel') {
            await safeTelegramReply(chatId, 'Cancelled.', { replyMarkup: buildMainMenuInline() });
            return res.status(200).json({ status: 'CANCELLED' });
        }

        if (lowered === '/log' || lowered === '/workout') {
            await safeTelegramReply(chatId, buildWorkoutPromptMessage(), { replyMarkup: buildWorkoutInline() });
            return res.status(200).json({ status: 'WORKOUT_PROMPT_SENT' });
        }

        if (lowered === '/eat' || lowered === '/food') {
            await safeTelegramReply(chatId, buildNutritionPromptMessage(), { replyMarkup: buildNutritionInline() });
            return res.status(200).json({ status: 'NUTRITION_PROMPT_SENT' });
        }

        if (lowered === '/done' || lowered === '/task') {
            await safeTelegramReply(chatId, buildTaskPromptMessage(), { replyMarkup: buildTaskInline() });
            return res.status(200).json({ status: 'TASK_PROMPT_SENT' });
        }

        if (lowered.startsWith('/split')) {
            await safeTelegramReply(chatId, buildSplitMessage(rawText), { replyMarkup: buildSplitInline() });
            return res.status(200).json({ status: 'SPLIT_SENT' });
        }

        if (lowered.startsWith('/eat ') || lowered.startsWith('/food ') || lowered.startsWith('ate ')) {
            const nutritionText = stripLeadingCommand(rawText).replace(/^ate\s+/i, '').trim();
            const result = await writeNutritionLog(
                nutritionText,
                extraction.source === 'voice' ? 'telegram_voice' : 'telegram_text',
                { defaultMode: 'cooked' }
            );
            await safeTelegramReply(chatId, buildNutritionConfirmationMessage(result), { replyMarkup: buildMainMenuInline() });
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
            await safeTelegramReply(chatId, buildWorkoutConfirmationMessage(result, exercises, mainHits, usedGroq, extraction.source), {
                replyMarkup: buildMainMenuInline()
            });
            return res.status(200).json({ status: 'FITNESS_SYNCED' });
        }

        const taskResult = await matchTodoCandidatesFromText(payloadText, extraction.source);
        if (taskResult.candidates.length) {
            await safeTelegramReply(chatId, buildTaskChoiceMessage(taskResult), {
                replyMarkup: buildTaskChoiceInline(taskResult.candidates, taskResult.confident)
            });
        } else {
            await safeTelegramReply(chatId, buildNoTaskMatchMessage(taskResult), {
                replyMarkup: buildMainMenuInline()
            });
        }
        return res.status(200).json({ status: 'TASK_MATCH_READY' });
    } catch (e) {
        console.error('Telegram Bridge Error:', e);
        await safeTelegramReply(chatId, `⚠️ SYSTEM BRIDGE FAULT\n${truncate(String(e.message || 'Unknown failure'), 320)}`, {
            replyMarkup: buildMainMenuInline()
        });
        return res.status(500).json({ error: e.message || 'UNKNOWN_ERROR' });
    }
}

async function handleTelegramCallback(callback) {
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    const data = String(callback.data || '');

    if (!chatId || !messageId) {
        if (callback.id) await safeAnswerCallback(callback.id, 'Missing callback context');
        return;
    }

    if (data === 'menu:help') {
        await safeEditTelegramMessage(chatId, messageId, buildHelpMessage(), { replyMarkup: buildMainMenuInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:workout') {
        await safeEditTelegramMessage(chatId, messageId, buildWorkoutPromptMessage(), { replyMarkup: buildWorkoutInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:nutrition') {
        await safeEditTelegramMessage(chatId, messageId, buildNutritionPromptMessage(), { replyMarkup: buildNutritionInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:task') {
        await safeEditTelegramMessage(chatId, messageId, buildTaskPromptMessage(), { replyMarkup: buildTaskInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:split') {
        await safeEditTelegramMessage(chatId, messageId, buildSplitMessage('/split all'), { replyMarkup: buildSplitInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data.startsWith('split:')) {
        const key = data.split(':')[1] || 'all';
        const command = key === 'all' ? '/split all' : `/split ${key}`;
        await safeEditTelegramMessage(chatId, messageId, buildSplitMessage(command), { replyMarkup: buildSplitInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'task:cancel') {
        await safeEditTelegramMessage(chatId, messageId, 'Task capture cancelled.', { replyMarkup: buildMainMenuInline() });
        await safeAnswerCallback(callback.id, 'Cancelled');
        return;
    }

    if (data.startsWith('task:done:')) {
        const taskId = data.slice('task:done:'.length);
        const core = await fetchCoreData();
        const task = (core?.todos || []).find(item => item.id === taskId) || null;
        if (!task) {
            await safeEditTelegramMessage(chatId, messageId, 'That task is no longer available.', { replyMarkup: buildMainMenuInline() });
            await safeAnswerCallback(callback.id, 'Task missing');
            return;
        }
        await toggleTodo(taskId, true);
        await safeEditTelegramMessage(chatId, messageId, `✅ TASK DONE\n\n• ${task.title}`, { replyMarkup: buildMainMenuInline() });
        await safeAnswerCallback(callback.id, 'Task completed');
        return;
    }

    await safeAnswerCallback(callback.id, 'Unknown action');
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
    if (!fileMetaResp.ok || !filePath) throw new Error('FAILED TO FETCH TELEGRAM FILE PATH');

    const fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!fileResp.ok) throw new Error('FAILED TO DOWNLOAD TELEGRAM AUDIO');
    const buffer = await fileResp.arrayBuffer();
    const form = new FormData();
    form.append('model', TELEGRAM_VOICE_MODEL);
    form.append('file', new Blob([buffer]), filePath.split('/').pop() || 'voice.ogg');

    const groqResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: form
    });
    const data = await groqResp.json().catch(() => ({}));
    if (!groqResp.ok || !data?.text) throw new Error(data?.error?.message || data?.error || 'VOICE TRANSCRIPTION FAILED');
    return String(data.text || '').trim();
}

async function matchTodoCandidatesFromText(text, source = 'text') {
    const core = await fetchCoreData();
    const todos = (core?.todos || []).filter(todo => !todo.is_done);
    const normalizedText = normalizeCaptureText(text);
    const phrases = normalizedText.split(/[\n,.!?;]+/).map(part => part.trim()).filter(Boolean);

    const scored = todos
        .map(todo => ({ id: todo.id, title: todo.title, score: scoreTodoAgainstText(todo.title, normalizedText, phrases) }))
        .filter(item => item.score >= 0.45)
        .sort((a, b) => b.score - a.score);

    const confident = scored.filter(item => item.score >= 0.72).slice(0, 3);
    const candidates = (confident.length ? confident : scored).slice(0, 3);

    return {
        source,
        transcript: text,
        confident: confident.length > 0,
        candidates
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
        'AXIS TELEGRAM',
        '',
        'Tap a button below or send text / voice.',
        '',
        '/log → workout',
        '/eat → nutrition',
        '/done → tasks'
    ].join('\n');
}

function buildWorkoutPromptMessage() {
    return [
        'WORKOUT',
        '',
        'Send lines like:',
        'Incline Bench 80x8 75x7',
        'Shoulder Press 3x8@50 warmup',
        'Wide Lat Pulldown 90x10x3'
    ].join('\n');
}

function buildNutritionPromptMessage() {
    return [
        'NUTRITION',
        '',
        'Send lines like:',
        '3 eggs + 2 bread + 20g cheese',
        '400g rice, 200g chicken breast'
    ].join('\n');
}

function buildTaskPromptMessage() {
    return [
        'TASK CAPTURE',
        '',
        'Send what you finished:',
        'finish hero export',
        'edited intro reel',
        'moodboard done'
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

function buildWorkoutConfirmationMessage(result, exercises, mainHits, usedGroq = false, source = 'text') {
    return [
        `⚡ FITNESS // ${source.toUpperCase()}`,
        '',
        `SPLIT: ${result.splitName}`,
        `EXERCISES: ${result.exerciseCount}`,
        `SETS: ${result.setCount}`,
        `PARSER: ${usedGroq ? 'GROQ' : 'LOCAL'}`,
        '',
        ...exercises.slice(0, 6).map(ex => `• ${ex.exercise}: ${ex.sets.map(s => `${s.reps}x${s.weight}kg`).join(', ')}`)
    ].join('\n');
}

function buildNutritionConfirmationMessage(result) {
    return [
        '🍽️ NUTRITION SYNCED',
        '',
        `ITEMS: ${result.summary?.length || 0}`,
        `CAL: ${Math.round(result.totals?.calories || 0)}`,
        `PROTEIN: ${Math.round(result.totals?.protein || 0)}g`
    ].join('\n');
}

function buildTaskChoiceMessage(result) {
    if (result.candidates.length === 1 && result.confident) {
        return [
            `Task from ${result.source.toUpperCase()}`,
            '',
            `Did you finish this?`,
            `• ${result.candidates[0].title}`
        ].join('\n');
    }

    return [
        `Task from ${result.source.toUpperCase()}`,
        '',
        'Pick the task you finished:',
        ...result.candidates.map((item, index) => `${String.fromCharCode(65 + index)}. ${item.title}`)
    ].join('\n');
}

function buildNoTaskMatchMessage(result) {
    return [
        `⚠️ No confident task match from ${result.source.toUpperCase()}.`,
        '',
        `Transcript: ${truncate(result.transcript || '', 180)}`,
        '',
        'Try clearer wording or use /help.'
    ].join('\n');
}

function buildInlineKeyboard(rows) {
    return { inline_keyboard: rows };
}

function buildMainMenuInline() {
    return buildInlineKeyboard([
        [
            { text: 'Workout', callback_data: 'menu:workout' },
            { text: 'Nutrition', callback_data: 'menu:nutrition' }
        ],
        [
            { text: 'Tasks', callback_data: 'menu:task' },
            { text: 'Splits', callback_data: 'menu:split' }
        ],
        [
            { text: 'Help', callback_data: 'menu:help' }
        ]
    ]);
}

function buildWorkoutInline() {
    return buildInlineKeyboard([
        [{ text: 'Splits', callback_data: 'menu:split' }],
        [{ text: 'Main menu', callback_data: 'menu:help' }]
    ]);
}

function buildNutritionInline() {
    return buildInlineKeyboard([
        [{ text: 'Main menu', callback_data: 'menu:help' }]
    ]);
}

function buildTaskInline() {
    return buildInlineKeyboard([
        [{ text: 'Main menu', callback_data: 'menu:help' }]
    ]);
}

function buildSplitInline() {
    return buildInlineKeyboard([
        [
            { text: 'Chest + Back', callback_data: 'split:chest' },
            { text: 'Shoulders + Arms', callback_data: 'split:shoulders' }
        ],
        [
            { text: 'Legs', callback_data: 'split:legs' },
            { text: 'All', callback_data: 'split:all' }
        ],
        [{ text: 'Main menu', callback_data: 'menu:help' }]
    ]);
}

function buildTaskChoiceInline(candidates, confident = false) {
    if (!candidates.length) return buildMainMenuInline();
    if (candidates.length === 1 && confident) {
        return buildInlineKeyboard([
            [
                { text: 'Confirm', callback_data: `task:done:${candidates[0].id}` },
                { text: 'Cancel', callback_data: 'task:cancel' }
            ]
        ]);
    }
    const rows = candidates.map((item, index) => ([{ text: `${String.fromCharCode(65 + index)} • ${truncate(item.title, 24)}`, callback_data: `task:done:${item.id}` }]));
    rows.push([{ text: 'Cancel', callback_data: 'task:cancel' }]);
    return buildInlineKeyboard(rows);
}

function truncate(text, max = 300) {
    const value = String(text || '');
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function safeTelegramReply(chatId, text, options = {}) {
    try {
        await sendTelegramReply(chatId, text, options);
    } catch (e) {
        console.error('Telegram reply failed:', e);
    }
}

async function sendTelegramReply(chatId, text, options = {}) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: options.replyMarkup || undefined
        })
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`TELEGRAM API REJECTED REPLY // ${truncate(body, 220)}`);
    }
}

async function safeEditTelegramMessage(chatId, messageId, text, options = {}) {
    try {
        await editTelegramMessage(chatId, messageId, text, options);
    } catch (e) {
        console.error('Telegram edit failed:', e);
    }
}

async function editTelegramMessage(chatId, messageId, text, options = {}) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: options.replyMarkup || undefined
        })
    });
}

async function safeAnswerCallback(callbackId, text = '') {
    try {
        await answerCallback(callbackId, text);
    } catch (e) {
        console.error('Telegram callback answer failed:', e);
    }
}

async function answerCallback(callbackId, text = '') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !callbackId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: text || undefined })
    });
}
