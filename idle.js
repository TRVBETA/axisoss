/* ------------------------------------------
   AXIS // idle.js
   V5 // Quiet auto-logout after 4h of inactivity.
   The session cookie still lasts 30 days on the
   server. This is a UX enforcement: if you close
   the laptop and walk away, AXIS signs itself out
   the next time the tab is focused (or every 60s
   in the background). No modal, no scary alert.
   ------------------------------------------ */

(function () {
    'use strict';

    const STORAGE_KEY = 'axis_last_activity_at';
    const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours
    const CHECK_INTERVAL_MS = 60 * 1000;      // 1 minute
    const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'pointerdown', 'wheel', 'focus'];

    let lastActivity = Date.now();
    let loggedOut = false;
    let checkTimer = null;
    let started = false;

    function readStored() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const n = raw ? parseInt(raw, 10) : NaN;
            if (Number.isFinite(n)) return n;
        } catch (_) {}
        return Date.now();
    }

    function writeStored(t) {
        try { localStorage.setItem(STORAGE_KEY, String(t)); } catch (_) {}
    }

    function isAuthed() {
        return !!(window.axisAuthState && window.axisAuthState.authenticated);
    }

    function noteActivity() {
        if (loggedOut) return;
        lastActivity = Date.now();
        writeStored(lastActivity);
    }

    function shouldLogout() {
        if (!isAuthed()) return false;
        const now = Date.now();
        const since = Math.max(now - lastActivity, 0);
        return since >= IDLE_LIMIT_MS;
    }

    async function doLogout(reason) {
        if (loggedOut) return;
        loggedOut = true;
        // Best-effort server logout. Even if the network is down,
        // we still reset local auth state so the next paint shows
        // the login overlay.
        try {
            await fetch('/api/auth', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'logout' })
            });
        } catch (_) {}
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        window.axisAuthState.authenticated = false;
        // Soft reload so the boot/login flow takes over cleanly.
        // Avoid a hard reload flash by setting the flag first.
        try {
            if (typeof window.showAxisLoginOverlay === 'function') {
                window.showAxisLoginOverlay(reason || 'Session closed after 4h idle.');
            }
        } catch (_) {}
        // Update the HUD chip if it exists.
        try {
            const el = document.getElementById('hud-auth-status');
            if (el) {
                el.textContent = 'IDLE LOGOUT';
                el.style.color = 'var(--hud-warning)';
            }
        } catch (_) {}
        // Reload to make sure all module state resets.
        setTimeout(() => {
            try { window.location.reload(); } catch (_) {}
        }, 250);
    }

    function tick() {
        if (loggedOut) return;
        if (shouldLogout()) {
            doLogout('Signed out after 4 hours idle.');
        }
    }

    function bindActivity() {
        const handler = () => noteActivity();
        ACTIVITY_EVENTS.forEach((evt) => {
            window.addEventListener(evt, handler, { passive: true, capture: true });
        });
        document.addEventListener('visibilitychange', () => {
            // When the tab comes back into focus, also check immediately.
            if (!document.hidden) {
                noteActivity();
                tick();
            }
        });
        window.addEventListener('focus', () => { noteActivity(); tick(); });
        window.addEventListener('blur', () => { tick(); });
    }

    function init() {
        if (started) return;
        started = true;
        lastActivity = readStored();
        bindActivity();
        tick();
        if (checkTimer) clearInterval(checkTimer);
        checkTimer = setInterval(tick, CHECK_INTERVAL_MS);
    }

    // Public API for tests / manual poke.
    window.axisIdle = {
        init,
        noteActivity,
        getLastActivity: () => lastActivity,
        getIdleLimitMs: () => IDLE_LIMIT_MS,
        isLoggedOut: () => loggedOut
    };
})();
