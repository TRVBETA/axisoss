import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { upsertDailyTelemetry } from '../lib/dailyServer.js';
import { supabaseHeaders, supabaseRequest } from '../lib/supabaseServer.js';

function getShortcutSecret() {
    return process.env.SHORTCUT_SHARED_SECRET || process.env.SLEEP_SHORTCUT_SECRET || '';
}

function isShortcutAuthorized(req) {
    const expected = getShortcutSecret();
    if (!expected) return false; // no secret configured = shortcut path disabled

    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const headerSecret = req.headers['x-axis-secret'] || req.headers['x-shortcut-secret'] || '';
    const bodySecret = req.body?.secret || req.body?.token || '';
    const querySecret = req.query?.secret || req.query?.token || '';

    return [bearer, headerSecret, bodySecret, querySecret].some(v => String(v || '').trim() === expected);
}

function normalizeDate(input) {
    if (!input) return new Date().toISOString().slice(0, 10);
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

async function loadHandoffState() {
    // The handoff state lives in sleep_circadian_logs metadata.
    // We treat the most recent row as authoritative: if it was a
    // wake-only entry (no hours) the user is awake. If it has hours,
    // they're awake and a sleep is pending.
    const rows = await supabaseRequest(
        'sleep_circadian_logs?select=log_date,hours_slept,wake_time,quality_rating,source_bridge,logged_at&order=log_date.desc&limit=7'
    );
    if (!Array.isArray(rows) || !rows.length) {
        return { currentEvent: 'unknown', lastWakeAt: null, lastSleepAt: null, lastSleepHours: null, lastSleepQuality: null };
    }
    // We piggyback on a synthetic row written when the shortcut
    // posts event:sleep. That row has hours_slept = 0 and source_bridge
    // = 'shortcut:sleep'. The matching wake row has hours_slept set
    // and source_bridge = 'shortcut:wake'. We walk newest-first.
    let lastWake = null;
    let lastSleep = null;
    let lastSleepHours = null;
    let lastSleepQuality = null;
    for (const row of rows) {
        const src = String(row.source_bridge || '');
        if (!lastWake && src === 'shortcut:wake') {
            lastWake = { at: row.logged_at, wakeTime: row.wake_time };
        }
        if (!lastSleep && src === 'shortcut:sleep') {
            lastSleep = { at: row.logged_at };
        }
        if (lastSleepHours == null && Number(row.hours_slept) > 0) {
            lastSleepHours = Number(row.hours_slept);
            lastSleepQuality = row.quality_rating || null;
        }
        if (lastWake && lastSleep) break;
    }
    // currentEvent: if newest shortcut event is 'sleep' and no newer 'wake' → sleeping.
    // Otherwise awake. If no events at all → unknown.
    const newest = rows[0];
    const newestSrc = String(newest?.source_bridge || '');
    let currentEvent = 'unknown';
    if (newestSrc === 'shortcut:sleep') currentEvent = 'sleeping';
    else if (newestSrc === 'shortcut:wake') currentEvent = 'awake';
    return {
        currentEvent,
        lastWakeAt: lastWake?.at || null,
        lastSleepAt: lastSleep?.at || null,
        lastSleepHours,
        lastSleepQuality
    };
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        if (!isAuthenticatedRequest(req)) {
            return res.status(200).json({ ok: true, message: 'AXIS SLEEP ENDPOINT READY' });
        }
        try {
            if (String(req.query?.view || '') === 'handoff') {
                const handoff = await loadHandoffState();
                return res.status(200).json({ ok: true, handoff });
            }
            const rows = await supabaseRequest('sleep_circadian_logs?select=log_date,hours_slept,wake_time,quality_rating,logged_at&order=log_date.desc&limit=14');
            return res.status(200).json({ ok: true, rows: rows || [] });
        } catch (e) {
            return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD SLEEP FEED' });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    const event = String(req.body?.event || '').trim().toLowerCase();
    const allow = isAuthenticatedRequest(req) || isShortcutAuthorized(req);
    if (!allow) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED REQUEST' });
    }

    // ---- Shortcut handoff: { event: "wake" } or { event: "sleep" } ----
    if (event === 'wake' || event === 'sleep') {
        const now = new Date();
        const logDate = normalizeDate(req.body?.logDate || req.body?.date);
        const nowIso = now.toISOString();
        const wakeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (event === 'wake') {
            // Find the most recent 'shortcut:sleep' marker. If there is one
            // and no newer 'shortcut:wake', compute the gap as lastSleepHours.
            const rows = await supabaseRequest(
                'sleep_circadian_logs?select=log_date,hours_slept,wake_time,source_bridge,logged_at&order=logged_at.desc&limit=10'
            );
            const list = Array.isArray(rows) ? rows : [];
            const lastSleep = list.find(r => String(r.source_bridge || '') === 'shortcut:sleep');
            const newerWake = list.find(r => String(r.source_bridge || '') === 'shortcut:wake' && (!lastSleep || new Date(r.logged_at).getTime() > new Date(lastSleep.logged_at).getTime()));

            let computedHours = null;
            if (lastSleep && !newerWake) {
                const gapMs = now.getTime() - new Date(lastSleep.logged_at).getTime();
                const hours = gapMs / (1000 * 60 * 60);
                if (hours > 0 && hours < 24) {
                    computedHours = Math.round(hours * 10) / 10;
                }
            }

            // Always record a wake marker. If we have computed hours, write
            // them into the wake row so V4 scoring still receives sleep data.
            const payload = {
                log_date: logDate,
                hours_slept: Number((computedHours ?? 0).toFixed(1)),
                wake_time: wakeTime,
                quality_rating: null,
                source_bridge: 'shortcut:wake',
                logged_at: nowIso
            };
            const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
            const written = await supabaseRequest('sleep_circadian_logs?on_conflict=log_date', { method: 'POST', headers, body: payload });
            // If the computed hours are non-zero, propagate to daily telemetry.
            if (computedHours && computedHours > 0) {
                await upsertDailyTelemetry({ sleep_hours: Number(computedHours.toFixed(1)) }, logDate);
            }
            return res.status(200).json({
                ok: true,
                event: 'wake',
                computedHours,
                row: Array.isArray(written) ? written[0] : written
            });
        }

        if (event === 'sleep') {
            // Write a sleep marker with hours=0. This is overwritten by the
            // next wake row once the gap is known.
            const payload = {
                log_date: logDate,
                hours_slept: 0,
                wake_time: '',
                quality_rating: null,
                source_bridge: 'shortcut:sleep',
                logged_at: nowIso
            };
            const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
            const written = await supabaseRequest('sleep_circadian_logs?on_conflict=log_date', { method: 'POST', headers, body: payload });
            return res.status(200).json({
                ok: true,
                event: 'sleep',
                row: Array.isArray(written) ? written[0] : written
            });
        }
    }

    // ---- Legacy webhook path: { hours, wakeTime, quality, logDate } ----
    const hours = parseFloat(req.body?.hours ?? req.body?.hoursSlept ?? req.body?.sleepHours);
    const wakeTime = String(req.body?.wakeTime || req.body?.wake_time || req.body?.wake || '').trim();
    const qualityRaw = req.body?.quality ?? req.body?.qualityRating ?? req.body?.quality_rating;
    const quality = qualityRaw === undefined || qualityRaw === null || qualityRaw === '' ? null : parseInt(qualityRaw, 10);
    const logDate = normalizeDate(req.body?.logDate || req.body?.date);

    if (!Number.isFinite(hours) || hours <= 0) {
        return res.status(400).json({ ok: false, error: 'INVALID HOURS VALUE' });
    }
    if (!wakeTime) {
        return res.status(400).json({ ok: false, error: 'WAKE TIME REQUIRED' });
    }
    if (quality !== null && (!Number.isFinite(quality) || quality < 1 || quality > 5)) {
        return res.status(400).json({ ok: false, error: 'QUALITY MUST BE 1 TO 5' });
    }

    const payload = {
        log_date: logDate,
        hours_slept: Number(hours.toFixed(1)),
        wake_time: wakeTime,
        quality_rating: quality,
        source_bridge: 'shortcut:legacy',
        logged_at: new Date().toISOString()
    };

    try {
        const headers = supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
        const rows = await supabaseRequest('sleep_circadian_logs?on_conflict=log_date', { method: 'POST', headers, body: payload });
        await upsertDailyTelemetry({ sleep_hours: payload.hours_slept }, logDate);
        return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message || 'FAILED TO WRITE SLEEP LOG' });
    }
}
