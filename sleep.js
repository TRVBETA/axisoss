/* ------------------------------------------
   AXIS // sleep.js
   V5 // Clean rewrite. The sleep page is now a
   small read-only status surface for the wake /
   sleep iPhone Shortcut handoff. The shortcut
   hits POST /api/sleep with { event: "wake" } or
   { event: "sleep" }. The page reflects the
   current state and the last known window.
   ------------------------------------------ */

(function () {
    'use strict';

    const STORAGE_KEY = 'axis_sleep_state_v1';

    // Source of truth for the page render. Server is authoritative
    // when online; we hydrate local state from the server response.
    const state = {
        currentEvent: 'unknown',     // 'awake' | 'sleeping' | 'unknown'
        lastWakeAt: null,            // ISO string
        lastSleepAt: null,           // ISO string
        lastSleepHours: null,        // number
        lastSleepQuality: null,      // 1..5
        syncMode: 'idle',            // 'server' | 'local' | 'idle'
        lastError: ''
    };

    function loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.assign(state, parsed);
            }
        } catch (_) {}
    }

    function persistLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                currentEvent: state.currentEvent,
                lastWakeAt: state.lastWakeAt,
                lastSleepAt: state.lastSleepAt,
                lastSleepHours: state.lastSleepHours,
                lastSleepQuality: state.lastSleepQuality
            }));
        } catch (_) {}
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtTime(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        // 12-hour with explicit AM/PM, e.g. "7:42 AM" / "11:08 PM"
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${m} ${ampm}`;
    }

    function fmtDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`;
    }

    function fmtRelative(iso) {
        if (!iso) return '—';
        const d = new Date(iso).getTime();
        if (!Number.isFinite(d)) return '—';
        const diff = Date.now() - d;
        const min = Math.round(diff / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return `${min}m ago`;
        const hr = Math.round(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const day = Math.round(hr / 24);
        if (day === 1) return `yesterday ${fmtTime(iso)}`;
        if (day < 7) return `${day}d ago`;
        return `${fmtDate(iso)} ${fmtTime(iso)}`;
    }

    // Handoff card visibility. Default collapsed. Two ways to expand it:
    //  1. Click the "Show setup" toggle. State persists in localStorage.
    //  2. Land on the page with ?handoff=1 in the URL (one-time reveal,
    //     then back to whatever the user last chose).
    const HANDOFF_FLAG_KEY = 'axis_sleep_handoff_visible';
    function isHandoffVisible() {
        try {
            const url = new URL(location.href);
            if (url.searchParams.get('handoff') === '1') return true;
        } catch (_) {}
        try {
            return localStorage.getItem(HANDOFF_FLAG_KEY) === '1';
        } catch (_) {}
        return false;
    }
    function setHandoffVisible(flag) {
        try { localStorage.setItem(HANDOFF_FLAG_KEY, flag ? '1' : '0'); } catch (_) {}
        renderSleepView();
    }

    function statusPill() {
        if (state.currentEvent === 'awake') {
            return `<span class="badge badge-optimal" style="font-size: 0.7rem;">AWAKE</span>`;
        }
        if (state.currentEvent === 'sleeping') {
            return `<span class="badge badge-warning" style="font-size: 0.7rem;">SLEEPING</span>`;
        }
        return `<span class="badge badge-muted" style="font-size: 0.7rem;">UNKNOWN</span>`;
    }

    function renderSleepView() {
        const container = document.getElementById('module-sleep');
        if (!container) return;

        const handoffVisible = isHandoffVisible();
        const webhookUrl = `${location.origin}/api/sleep`;
        const wakePayload = JSON.stringify({ event: 'wake', secret: 'YOUR_SHORTCUT_SECRET' }, null, 2);
        const sleepPayload = JSON.stringify({ event: 'sleep', secret: 'YOUR_SHORTCUT_SECRET' }, null, 2);

        container.innerHTML = `
            <div class="cockpit-header">
                <span>SLEEP</span>
                <div class="row" style="gap: 8px;">
                    ${statusPill()}
                    <span class="text-sm text-muted">${state.syncMode === 'server' ? 'SYNCED' : state.syncMode === 'local' ? 'LOCAL' : 'IDLE'}</span>
                </div>
            </div>

            <section class="grid grid-cols-1 md-grid-cols-3" style="gap: 18px;">
                <div class="cockpit-card stack" style="padding: 26px; gap: 14px;">
                    <span class="axis-section-overline">Last wake</span>
                    <div style="font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.04;">${fmtTime(state.lastWakeAt)}</div>
                    <div class="text-sm text-muted">${fmtRelative(state.lastWakeAt)}</div>
                </div>
                <div class="cockpit-card stack" style="padding: 26px; gap: 14px;">
                    <span class="axis-section-overline">Last sleep</span>
                    <div style="font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.04;">${fmtTime(state.lastSleepAt)}</div>
                    <div class="text-sm text-muted">${fmtRelative(state.lastSleepAt)}</div>
                </div>
                <div class="cockpit-card stack" style="padding: 26px; gap: 14px;">
                    <span class="axis-section-overline">Last sleep duration</span>
                    <div style="font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.04;">${state.lastSleepHours != null ? state.lastSleepHours.toFixed(1) + 'h' : '—'}</div>
                    <div class="text-sm text-muted">${state.lastSleepQuality != null ? 'Quality ' + state.lastSleepQuality + '/5' : 'No quality recorded'}</div>
                </div>
            </section>

            <div class="row" style="justify-content: flex-end; gap: 8px;">
                <button type="button" class="tactical-btn" style="padding: 6px 12px; font-size: 0.66rem; min-height: 32px;" onclick="window.axisSleep.toggleHandoff()">${handoffVisible ? 'HIDE SETUP' : 'SHOW SETUP'}</button>
            </div>

            ${handoffVisible ? `
            <section class="cockpit-card stack" style="padding: 28px; gap: 16px;">
                <div class="row" style="justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <div class="stack stack-sm" style="gap: 4px;">
                        <span class="axis-section-overline">iPhone Shortcut handoff</span>
                        <div style="font-size: 1.05rem; font-weight: 650; letter-spacing: -0.01em;">One shortcut. Wake and sleep. Nothing else.</div>
                    </div>
                </div>
                <div class="axis-quiet-note" style="line-height: 1.7;">
                    Build one Shortcut with two actions: a menu asking <em>Wake up</em> or <em>Going to sleep</em>, then a <em>Get contents of URL</em> action that POSTs JSON to the endpoint below. The <code>secret</code> field must match the <code>SHORTCUT_SHARED_SECRET</code> env var on Vercel — without it, the webhook returns 401.
                </div>

                <div class="stack stack-sm" style="gap: 6px;">
                    <label class="form-label">Webhook URL</label>
                    <input class="tactical-input" readonly value="${escapeHtml(webhookUrl)}" onclick="this.select()" style="font-family: var(--font-mono); font-size: 0.82rem;">
                </div>

                <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                    <div class="stack stack-sm" style="gap: 6px;">
                        <label class="form-label">Wake payload</label>
                        <textarea class="tactical-input" readonly rows="4" onclick="this.select()" style="font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.55;">${escapeHtml(wakePayload)}</textarea>
                    </div>
                    <div class="stack stack-sm" style="gap: 6px;">
                        <label class="form-label">Sleep payload</label>
                        <textarea class="tactical-input" readonly rows="4" onclick="this.select()" style="font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.55;">${escapeHtml(sleepPayload)}</textarea>
                    </div>
                </div>

                <div class="row flex-wrap" style="gap: 8px;">
                    <button type="button" class="tactical-btn" onclick="window.axisSleep.simulateWake()">SIMULATE WAKE</button>
                    <button type="button" class="tactical-btn" onclick="window.axisSleep.simulateSleep()">SIMULATE SLEEP</button>
                </div>

                <div class="text-sm text-muted" style="line-height: 1.7;">
                    When AXIS receives a <em>sleep</em> event, it remembers the timestamp. The next <em>wake</em> event computes the gap and writes a row to the same <code>sleep_circadian_logs</code> table the old webhook used, so V4 scoring still works.
                </div>
            </section>
            ` : ''}
        `;
    }

    async function loadSleepFromServer({ silent = false } = {}) {
        if (!window.axisAuthState?.authenticated) {
            state.syncMode = 'idle';
            if (!silent) renderSleepView();
            return false;
        }
        if (typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
            state.syncMode = 'local';
            if (!silent) renderSleepView();
            return false;
        }
        try {
            const resp = await fetch('/api/sleep?view=handoff', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            if (data.handoff) {
                state.currentEvent = data.handoff.currentEvent || 'unknown';
                state.lastWakeAt = data.handoff.lastWakeAt || null;
                state.lastSleepAt = data.handoff.lastSleepAt || null;
                state.lastSleepHours = data.handoff.lastSleepHours ?? null;
                state.lastSleepQuality = data.handoff.lastSleepQuality ?? null;
                persistLocal();
            }
            state.syncMode = 'server';
            state.lastError = '';
            renderSleepView();
            return true;
        } catch (e) {
            state.syncMode = 'local';
            state.lastError = e.message || 'FAILED TO LOAD SLEEP';
            if (!silent) renderSleepView();
            return false;
        }
    }

    async function postEvent(event) {
        if (!window.axisAuthState?.authenticated) return;
        if (typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return;
        try {
            const resp = await fetch('/api/sleep', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            // Reload authoritative state from server.
            await loadSleepFromServer({ silent: true });
            if (typeof loadDailyFromServer === 'function') await loadDailyFromServer({ silent: true });
            if (typeof refreshCoreView === 'function') refreshCoreView();
        } catch (e) {
            state.lastError = e.message;
            renderSleepView();
        }
    }

    function simulateWake() { postEvent('wake'); }
    function simulateSleep() { postEvent('sleep'); }
    function toggleHandoff() {
        setHandoffVisible(!isHandoffVisible());
    }

    function initSleep() {
        loadLocal();
        renderSleepView();
        loadSleepFromServer({ silent: true });
    }

    function refreshSleepView() { renderSleepView(); }

    window.axisSleep = {
        init: initSleep,
        load: loadSleepFromServer,
        refresh: refreshSleepView,
        simulateWake,
        simulateSleep,
        toggleHandoff,
        isHandoffVisible
    };
})();
