import { isAuthenticatedRequest } from '../lib/axisAuth.js';
/* ------------------------------------------
   AXIS OS // api/telegram.js
   One Telegram bot for workout, nutrition, task capture,
   and optional voice transcription.
   ------------------------------------------ */

import { fetchCoreData, toggleTodo, createTodo } from '../lib/coreDataServer.js';
import { getDailyTelemetry } from '../lib/dailyServer.js';
import { gradeDay } from '../lib/axisScoreV4.js';
import { parseWorkoutText, writeWorkoutSession, inferSplitName, getMovementPatternForExercise, SPLIT_MAP, ARNOLD_SPLIT_ORDER, getSplitDayState, setSplitDayState, advanceArnoldSplit } from '../lib/fitnessServer.js';
import { groqParseWorkout, hasGroqParser, shouldAttemptGroqFallback } from '../lib/groqWorkoutParser.js';
const TELEGRAM_VOICE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';

/* v63 FAULT LOCK
   Telegram re-delivers every webhook update until it sees HTTP 200.
   Two rules keep one bad update from becoming a reply storm:
   1) Every POST path below MUST end in a 200 (faults included).
   2) update_ids are remembered per instance so a re-delivery that slips
      through is ignored instead of re-processed. */
const TELEGRAM_MAX_FILE_BYTES = 20 * 1024 * 1024; // getFile hard limit
const RECENT_UPDATE_TTL_MS = 24 * 60 * 60 * 1000;
const recentTelegramUpdates = new Map(); // update_id -> first seen timestamp

function hasSeenTelegramUpdate(updateId) {
    const seenAt = recentTelegramUpdates.get(updateId);
    if (!seenAt) return false;
    if (Date.now() - seenAt > RECENT_UPDATE_TTL_MS) {
        recentTelegramUpdates.delete(updateId);
        return false;
    }
    return true;
}

function rememberTelegramUpdate(updateId) {
    if (recentTelegramUpdates.size >= 1000) {
        const oldestKey = recentTelegramUpdates.keys().next().value;
        recentTelegramUpdates.delete(oldestKey);
    }
    recentTelegramUpdates.set(updateId, Date.now());
}

export { telegramTodoLabel, buildDashboardMessage, buildDashboardKeyboard, buildRitualPromptMessage, buildRitualCreatedMessage };

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

    // v63: drop re-delivered updates immediately.
    const updateId = Number(update.update_id || 0);
    if (updateId) {
        if (hasSeenTelegramUpdate(updateId)) {
            return res.status(200).json({ status: 'DUPLICATE_UPDATE_IGNORED' });
        }
        rememberTelegramUpdate(updateId);
    }

    const callback = update.callback_query;
    const incoming = update.message || update.edited_message;

    const chatId = callback?.message?.chat?.id || incoming?.chat?.id || 0;
    if (!chatId) {
        return res.status(200).json({ status: 'NO TELEGRAM CHAT PAYLOAD' });
    }

    const masterChatId = parseInt(process.env.AXIS_MASTER_CHAT_ID || '0', 10);
    if (!masterChatId) {
        // AXIS_MASTER_CHAT_ID not configured. The bot cannot safely
        // identify the owner. Refuse to act — but still answer 200 so
        // Telegram does not re-deliver this update forever.
        return res.status(200).json({
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
            const hint = extraction.source === 'too_big'
                ? '⚠️ File too large for the voice bridge (20MB max). Send text or a shorter voice note.'
                : '⚠️ Send text, or send a voice note if voice transcription is enabled.';
            await safeTelegramReply(chatId, hint, {
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
            const splitDay = await getSplitDayState();
            if (!splitDay) {
                await safeTelegramReply(chatId, buildSplitDayAskMessage(true), { replyMarkup: buildSplitDayPickInline() });
                return res.status(200).json({ status: 'SPLIT_DAY_ASKED' });
            }
            await safeTelegramReply(chatId, buildWorkoutPromptMessage(splitDay), { replyMarkup: buildWorkoutInline() });
            return res.status(200).json({ status: 'WORKOUT_PROMPT_SENT' });
        }

        if (lowered === '/splitday') {
            await safeTelegramReply(chatId, buildSplitDayAskMessage(false), { replyMarkup: buildSplitDayPickInline() });
            return res.status(200).json({ status: 'SPLIT_DAY_ASKED' });
        }

        if (lowered === '/eat' || lowered === '/food') {
            await safeTelegramReply(chatId, buildNutritionSleepMessage(), { replyMarkup: buildMainMenuInline() });
            return res.status(200).json({ status: 'NUTRITION_SLEEP' });
        }

        if (lowered === '/done' || lowered === '/task') {
            await safeTelegramReply(chatId, buildTaskPromptMessage(), { replyMarkup: buildTaskInline() });
            return res.status(200).json({ status: 'TASK_PROMPT_SENT' });
        }

        if (lowered === '/dashboard') {
            const payload = await buildDashboardMessage();
            await safeTelegramReply(chatId, payload.text, { replyMarkup: buildDashboardKeyboard(payload.todos) });
            return res.status(200).json({ status: 'DASHBOARD_SENT' });
        }

        if (lowered.startsWith('/ritual')) {
            const title = stripLeadingCommand(rawText).replace(/^\/ritual\b/i, '').trim();
            if (!title) {
                await safeTelegramReply(chatId, buildRitualPromptMessage(), { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'RITUAL_PROMPT_SENT' });
            }
            try {
                const row = await createTodo({ title, isDaily: true, taskKind: 'ritual' });
                await safeTelegramReply(chatId, buildRitualCreatedMessage(row), { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'RITUAL_CREATED' });
            } catch (e) {
                await safeTelegramReply(chatId, `⚠️ Ritual failed: ${truncate(String(e.message || 'Unknown failure'), 160)}`, { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'RITUAL_FAULT' });
            }
        }

        if (lowered.startsWith('/task')) {
            const parsed = parseTaskCommand(stripLeadingCommand(rawText).replace(/^\/task\b/i, '').trim());
            if (!parsed.title) {
                await safeTelegramReply(chatId, buildTaskPromptMessage(), { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'TASK_PROMPT_SENT' });
            }
            try {
                const row = await createTodo({
                    title: parsed.title,
                    isDaily: !!parsed.daily,
                    taskKind: 'task',
                    points: parsed.points == null ? undefined : parsed.points,
                    tag: parsed.tag
                });
                await safeTelegramReply(chatId, buildTaskCreatedMessage(row), { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'TASK_CREATED' });
            } catch (e) {
                await safeTelegramReply(chatId, '⚠️ Task failed: ' + truncate(String(e.message || 'Unknown failure'), 160), { replyMarkup: buildMainMenuInline() });
                return res.status(200).json({ status: 'TASK_FAULT' });
            }
        }

        if (lowered.startsWith('/split')) {
            const splitDay = await getSplitDayState();
            await safeTelegramReply(chatId, buildSplitMessage(rawText, splitDay), { replyMarkup: buildSplitInline() });
            return res.status(200).json({ status: 'SPLIT_SENT' });
        }

        if (lowered.startsWith('/eat ') || lowered.startsWith('/food ') || lowered.startsWith('ate ')) {
            // NUTRITION_SLEEP (v62): food logging retired — MFP is the source.
            await safeTelegramReply(chatId, buildNutritionSleepMessage(), { replyMarkup: buildMainMenuInline() });
            return res.status(200).json({ status: 'NUTRITION_SLEEP' });
        }

        const backdate = extractWorkoutBackdate(stripLeadingCommand(rawText));
        const payloadText = backdate.text;
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
            const result = await writeWorkoutSession({ splitName, exercises, loggedAt: backdate.loggedAt });
            const mainHits = exercises.filter(ex => getMovementPatternForExercise(ex.exercise)).length;
            // v64: Arnold rotation advances off the split that was actually
            // trained. Rest days never burn a split day.
            let rotation = null;
            if (ARNOLD_SPLIT_ORDER.includes(splitName)) {
                rotation = await advanceArnoldSplit(splitName).catch(() => null);
            }
            await safeTelegramReply(chatId, buildWorkoutConfirmationMessage(result, exercises, mainHits, usedGroq, extraction.source, backdate.backdated, rotation), {
                replyMarkup: buildMainMenuInline()
            });
            return res.status(200).json({ status: 'FITNESS_SYNCED', backdated: backdate.backdated, rotationNext: rotation?.next || null });
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
        // v63: ALWAYS 200. A non-200 tells Telegram to re-deliver this exact
        // update, and every re-delivery used to send this fault again — that
        // is what turned one bad file into hundreds of bridge-fault messages.
        return res.status(200).json({ status: 'BRIDGE_FAULT_HANDLED', error: e.message || 'UNKNOWN_ERROR' });
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

    if (data === 'menu:dashboard') {
        const payload = await buildDashboardMessage();
        await safeEditTelegramMessage(chatId, messageId, payload.text, { replyMarkup: buildDashboardKeyboard(payload.todos) });
        await safeAnswerCallback(callback.id, 'Dashboard');
        return;
    }

    if (data === 'dashboard:refresh') {
        const payload = await buildDashboardMessage();
        await safeEditTelegramMessage(chatId, messageId, payload.text, { replyMarkup: buildDashboardKeyboard(payload.todos) });
        await safeAnswerCallback(callback.id, 'Refreshed');
        return;
    }

    if (data === 'menu:workout') {
        const splitDay = await getSplitDayState();
        if (!splitDay) {
            await safeEditTelegramMessage(chatId, messageId, buildSplitDayAskMessage(true), { replyMarkup: buildSplitDayPickInline() });
            await safeAnswerCallback(callback.id);
            return;
        }
        await safeEditTelegramMessage(chatId, messageId, buildWorkoutPromptMessage(splitDay), { replyMarkup: buildWorkoutInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:splitday') {
        await safeEditTelegramMessage(chatId, messageId, buildSplitDayAskMessage(false), { replyMarkup: buildSplitDayPickInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data.startsWith('splitday:set:')) {
        const day = decodeURIComponent(data.slice('splitday:set:'.length));
        if (!ARNOLD_SPLIT_ORDER.includes(day)) {
            await safeAnswerCallback(callback.id, 'Unknown split day');
            return;
        }
        await setSplitDayState(day);
        await safeEditTelegramMessage(chatId, messageId, buildSplitDayLockedMessage(day), { replyMarkup: buildWorkoutInline() });
        await safeAnswerCallback(callback.id, `Today: ${day}`);
        return;
    }

    if (data === 'menu:nutrition') {
        await safeEditTelegramMessage(chatId, messageId, buildNutritionSleepMessage(), { replyMarkup: buildMainMenuInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:task') {
        await safeEditTelegramMessage(chatId, messageId, buildTaskPromptMessage(), { replyMarkup: buildTaskInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data === 'menu:split') {
        const splitDay = await getSplitDayState();
        await safeEditTelegramMessage(chatId, messageId, buildSplitMessage('/split all', splitDay), { replyMarkup: buildSplitInline() });
        await safeAnswerCallback(callback.id);
        return;
    }

    if (data.startsWith('split:')) {
        const key = data.split(':')[1] || 'all';
        const command = key === 'all' ? '/split all' : `/split ${key}`;
        const splitDay = await getSplitDayState();
        await safeEditTelegramMessage(chatId, messageId, buildSplitMessage(command, splitDay), { replyMarkup: buildSplitInline() });
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

const AUDIO_MIME_RE = /^audio\//i;
const AUDIO_EXT_RE = /\.(ogg|oga|opus|mp3|m4a|aac|wav|flac|webm|mp4|mpe?g)$/i;

async function extractIncomingTextOrTranscript(incoming) {
    const rawText = String(incoming.text || incoming.caption || '').trim();
    if (rawText) return { text: rawText, source: 'text' };

    // v63: only genuine audio reaches Groq. A "random file" (zip/pdf/apk/…)
    // used to be piped straight into transcription, faulted, and Telegram's
    // re-delivery loop multiplied that fault into a message storm.
    let fileMeta = incoming.voice || incoming.audio || null;
    if (!fileMeta && incoming.document) {
        const doc = incoming.document;
        if (AUDIO_MIME_RE.test(doc.mime_type || '') || AUDIO_EXT_RE.test(doc.file_name || '')) {
            fileMeta = doc;
        }
    }
    if (!fileMeta?.file_id) return { text: '', source: 'none' };
    const sizeBytes = Number(fileMeta.file_size || 0);
    if (sizeBytes > TELEGRAM_MAX_FILE_BYTES) return { text: '', source: 'too_big' };
    const transcript = await transcribeTelegramFile(fileMeta.file_id);
    return { text: transcript, source: 'voice' };
}

async function transcribeTelegramFile(fileId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN MISSING');
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY REQUIRED FOR VOICE TRANSCRIPTION');

    const fileMetaResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, {
        signal: AbortSignal.timeout(10000)
    });
    const fileMeta = await fileMetaResp.json().catch(() => ({}));
    const filePath = fileMeta?.result?.file_path;
    if (!fileMetaResp.ok || !filePath) throw new Error('FAILED TO FETCH TELEGRAM FILE PATH');

    const fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
        signal: AbortSignal.timeout(20000)
    });
    if (!fileResp.ok) throw new Error('FAILED TO DOWNLOAD TELEGRAM AUDIO');
    const buffer = await fileResp.arrayBuffer();
    const form = new FormData();
    form.append('model', TELEGRAM_VOICE_MODEL);
    form.append('file', new Blob([buffer]), filePath.split('/').pop() || 'voice.ogg');

    const groqResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(30000)
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
// /task <title> [#tag] [+N]
// Mirrors the site's task capture: a title, an optional #tag, and optional
// explicit points. Points are clamped to V4 rules by createTodo, so passing
// +5 on a low-tier task is silently capped rather than gaming the score.
function parseTaskCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return { title: '', tag: null, points: null, daily: false };
  let title = raw;
  let tag = null;
  let points = null;
  let daily = false;
  const tagMatch = title.match(/\b#([A-Za-z][A-Za-z0-9_-]*)\s*$/);
  if (tagMatch) { tag = tagMatch[1].toLowerCase(); title = title.slice(0, tagMatch.index).trim(); }
  const ptsMatch = title.match(/\+(\d{1,3})\s*$/);
  if (ptsMatch) { points = Math.max(0, parseInt(ptsMatch[1], 10)); title = title.slice(0, ptsMatch.index).trim(); }
  if (/\bdaily\b/i.test(title)) { daily = true; title = title.replace(/\bdaily\b/i, '').trim(); }
  return { title, tag, points, daily };
}

function buildTaskPromptMessage() {
    return [
        'TASK CAPTURE',
        '',
        'Send what you finished:',
        'finish hero export',
        'edited intro reel #body',
        'moodboard done +5',
        'read 10 pages daily'
    ].join('\n');
}

function buildTaskCreatedMessage(row) {
    const pts = Number(row.points || 0) ? ' ' + Number(row.points) + 'pts' : '';
    const tag = row.tag ? ' [' + String(row.tag).toUpperCase() + ']' : '';
    return [
        '✅ TASK ADDED',
        '',
        '• ' + escapeTelegramHtml(row.title || 'Task') + tag + pts,
        '',
        'Tick it off in the Dashboard.'
    ].join('\n');
}


// ---- Dashboard ----
// A read-only surface inside Telegram: today's score, the open tasks, and
// one-tap completion. Everything here is a button or a menu — no typing
// required, so it works as a replacement for the site when you're on the
// move and only need to check / tick things off.

function escapeTelegramHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function telegramTodoLabel(todo) {
  const tag = todo.tag ? ` [${String(todo.tag).toUpperCase()}]` : '';
  const pts = Number(todo.points || 0) ? ` ${Number(todo.points)}pts` : '';
  const mustWin = todo.must_win ? ' ⚡' : '';
  const kind = String(todo.task_kind || 'task') === 'ritual' ? ' ♻' : '';
  return `${escapeTelegramHtml(todo.title)}${kind}${tag}${pts}${mustWin}`;
}

// Cairo-axis day key: shift by -6h so the day flips at 6am local (matches
// coreDataServer.currentAxisDayKey). Keeps "done today" aligned with how
// tasks are stamped server-side regardless of where Vercel runs.
function axisTodayKey() {
  const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

function isDoneToday(todo) {
  return String(todo.completed_day_key || '') === axisTodayKey();
}

async function buildDashboardMessage() {
  let core, telemetry;
  try { core = await fetchCoreData(); } catch { core = { todos: [], rank: {} }; }
  try { telemetry = await getDailyTelemetry(); } catch { telemetry = { day_score_v4: 0, grade_v4: 'ROT', effort_v4: 0, work_points_v4: 0 }; }

  const allTodos = core.todos || [];
  const open = allTodos.filter(t => !t.is_done);
  const doneToday = allTodos.filter(t => t.is_done && isDoneToday(t));
  const doneEarlier = allTodos.filter(t => t.is_done && !isDoneToday(t));
  const openRituals = open.filter(t => String(t.task_kind || 'task') === 'ritual');
  const openTasks = open.filter(t => String(t.task_kind || 'task') !== 'ritual');
  const doneRitualsToday = doneToday.filter(t => String(t.task_kind || 'task') === 'ritual');
  const grade = gradeDay(Number(telemetry.day_score_v4 || 0), Number(telemetry.effort_v4 || 0));

  const lines = [];
  lines.push('📊 DASHBOARD');
  lines.push('');
  lines.push(`TODAY'S SCORE  ${Number(telemetry.day_score_v4 || 0)}/100  ${grade.label}`);
  lines.push(`EFFORT        ${Number(telemetry.effort_v4 || 0)}/90`);
  lines.push(`WORK POINTS   ${Number(telemetry.work_points_v4 || 0)}/40`);
  lines.push(`RANK          ${escapeTelegramHtml(core.rank?.shortLabel || '—')}`);
  lines.push('');

  if (openRituals.length) {
    lines.push(`♻ RITUALS  ${openRituals.length}`);
    openRituals.slice(0, 5).forEach(t => lines.push(`· ${telegramTodoLabel(t)}`));
    if (openRituals.length > 5) lines.push(`… and ${openRituals.length - 5} more`);
    lines.push('');
  }

  if (openTasks.length) {
    lines.push(`☑ TASKS  ${openTasks.length}`);
    openTasks.slice(0, 8).forEach((t, i) => {
      lines.push(`${String.fromCharCode(65 + i)} ${telegramTodoLabel(t)}`);
    });
    if (openTasks.length > 8) lines.push(`… and ${openTasks.length - 8} more`);
    lines.push('');
  } else if (!openRituals.length) {
    lines.push('✅ Nothing left to do today.');
    lines.push('');
  }

  if (doneRitualsToday.length) {
    lines.push(`DONE TODAY  ${doneRitualsToday.length}`);
    doneRitualsToday.slice(0, 3).forEach(t => lines.push(`✓ ${telegramTodoLabel(t)}`));
    lines.push('');
  }

  if (doneEarlier.length) {
    lines.push(`DONE EARLIER  ${doneEarlier.length} (prior days)`);
    doneEarlier.slice(0, 2).forEach(t => lines.push(`✓ ${telegramTodoLabel(t)}`));
    lines.push('');
  }

  lines.push('Pick a task to mark done, or use the menu below.');
  return { text: lines.join('
'), todos: openTasks };
}

function buildDashboardKeyboard(todos) {
  const open = (todos || []).filter(t => !t.is_done).slice(0, 8);
  if (!open.length) return buildMainMenuInline();
  const rows = open.map((t, i) => ([
    { text: `${String.fromCharCode(65 + i)} • ${truncate(t.title, 24)}`, callback_data: `task:done:${t.id}` }
  ]));
  rows.push([{ text: '⟲ Refresh', callback_data: 'dashboard:refresh' }]);
  rows.push([{ text: 'Home', callback_data: 'menu:help' }]);
  return buildInlineKeyboard(rows);
}

// "yesterday incline 80x8" used to be silently logged as today.
// Detect the backdating cue, strip it, and pin the session to yesterday midday UTC
// (midday keeps the date stable no matter what hour the message is sent).
function extractWorkoutBackdate(text) {
    const cleaned = String(text || '').trim();
    if (!/\b(yesterday|last\s+night)\b/i.test(cleaned)) {
        return { text: cleaned, loggedAt: undefined, backdated: false };
    }
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    d.setUTCHours(12, 0, 0, 0);
    return {
        text: cleaned.replace(/\b(yesterday|last\s+night)\b/gi, ' ').replace(/\s+/g, ' ').trim(),
        loggedAt: d.toISOString(),
        backdated: true
    };
}

function buildHelpMessage() {
    return [
        'AXIS TELEGRAM',
        '',
        'Tap a button below or send text / voice.',
        '',
        '📊 /dashboard → today\'s score + open tasks, one-tap done',
        '/log → workout (split day auto-advances)',
        '/split → rotation + exercises · /splitday → set today',
        '/ritual <text> → add a daily ritual',
        '/task <text> [#tag] [+N] → add a task with the same scoring as the site',
        '/done → tasks',
        'food → log in MyFitnessPal (syncs here)'
    ].join('\n');
}

function buildWorkoutPromptMessage(splitDay = null) {
    const header = ['WORKOUT', ''];
    if (splitDay && ARNOLD_SPLIT_ORDER.includes(splitDay)) {
        header.push(
            `TODAY'S SPLIT: ${splitDay.toUpperCase()}`,
            ...SPLIT_MAP[splitDay].map(ex => `• ${ex}`),
            ''
        );
    }
    return [
        ...header,
        'Send lines like:',
        'Incline Bench 80x8 75x7',
        'Shoulder Press 3x8@50 warmup',
        'Wide Lat Pulldown 90x10x3'
    ].join('\n');
}

function buildSplitDayAskMessage(firstRun = true) {
    return [
        firstRun ? 'ARNOLD ROTATION // FIRST RUN SETUP' : 'ARNOLD ROTATION // SET TODAY',
        '',
        'Locked order:',
        ...ARNOLD_SPLIT_ORDER.map((d, i) => `${i + 1}) ${d.toUpperCase()}`),
        '',
        'Which day are you on?',
        '(asked once — it auto-advances after every logged session; /splitday changes it anytime)'
    ].join('\n');
}

function buildSplitDayPickInline() {
    return buildInlineKeyboard([
        ARNOLD_SPLIT_ORDER.map(d => ({ text: d.toUpperCase(), callback_data: `splitday:set:${encodeURIComponent(d)}` })),
        [{ text: 'Main menu', callback_data: 'menu:help' }]
    ]);
}

function buildSplitDayLockedMessage(day) {
    return [
        `ROTATION LOCKED // TODAY: ${day.toUpperCase()}`,
        '',
        ...SPLIT_MAP[day].map(ex => `• ${ex}`),
        '',
        'Send the session as text/voice lines (e.g. "Machine Shoulder Press 60x8 55x8").',
        'After you log it, tomorrow flips automatically.'
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

function buildRitualPromptMessage() {
    return [
        'RITUAL',
        '',
        'Send the ritual you want to repeat daily:',
        'meditate 10 minutes',
        'read 10 pages',
        'journal 3 lines'
    ].join('\n');
}

function buildRitualCreatedMessage(row) {
    return [
        '✅ RITUAL ADDED',
        '',
        `• ${escapeTelegramHtml(row.title || 'Ritual')}`,
        '',
        'Repeats daily. Tick it off in the Dashboard.'
    ].join('\n');
}

function buildSplitStatusHeader(splitDay) {
    if (!splitDay || !ARNOLD_SPLIT_ORDER.includes(splitDay)) return [];
    const next = ARNOLD_SPLIT_ORDER[(ARNOLD_SPLIT_ORDER.indexOf(splitDay) + 1) % ARNOLD_SPLIT_ORDER.length];
    return [`ROTATION // TODAY: ${splitDay.toUpperCase()} · NEXT: ${next.toUpperCase()}`, ''];
}

function buildSplitMessage(rawText, splitDay = null) {
    const lowered = String(rawText || '').toLowerCase().trim();

    if (lowered === '/split' || lowered === '/split all') {
        const header = buildSplitStatusHeader(splitDay);
        return [...header, Object.entries(SPLIT_MAP).map(([split, exercises]) => {
            return [`${split.toUpperCase()}`, ...exercises.map(ex => `• ${ex}`)].join('\n');
        }).join('\n\n')].join('\n');
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

function buildWorkoutConfirmationMessage(result, exercises, mainHits, usedGroq = false, source = 'text', backdated = false, rotationNext = null) {
    return [
        `⚡ FITNESS // ${source.toUpperCase()}`,
        '',
        `SPLIT: ${result.splitName}`,
        `EXERCISES: ${result.exerciseCount}`,
        `SETS: ${result.setCount}`,
        `PARSER: ${usedGroq ? 'GROQ' : 'LOCAL'}`,
        ...(backdated ? ['LOGGED: BACKDATED (YESTERDAY)'] : []),
        '',
        ...exercises.slice(0, 6).map(ex => `• ${ex.exercise}: ${ex.sets.map(s => `${s.reps}x${s.weight}kg`).join(', ')}`),
        ...(rotationNext && ARNOLD_SPLIT_ORDER.includes(rotationNext.next) ? [
            '',
            ...(rotationNext.previous ? [] : ['ROTATION LOCKED FROM THIS SESSION']),
            `NEXT SPLIT: ${rotationNext.next.toUpperCase()}`,
            ...SPLIT_MAP[rotationNext.next].map(ex => `• ${ex}`)
        ] : [])
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

function buildNutritionSleepMessage() {
    return [
        'NUTRITION RETIRED // v62',
        '',
        'Food logging moved to MyFitnessPal as the single source.',
        'Log meals + water in the MFP app — they land in AXIS via the sync (manual tap or nightly cron).',
        '',
        'Everything else works: /log → workout, /done → tasks, voice → same.'
    ].join('\n');
}

function buildInlineKeyboard(rows) {
    return { inline_keyboard: rows };
}

function buildMainMenuInline() {
    return buildInlineKeyboard([
        [
            { text: '📊 Dashboard', callback_data: 'menu:dashboard' },
            { text: 'Workout', callback_data: 'menu:workout' },
            { text: 'Tasks', callback_data: 'menu:task' }
        ],
        [
            { text: 'Splits', callback_data: 'menu:split' },
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
        [{ text: '⟳ Change today', callback_data: 'menu:splitday' }],
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
