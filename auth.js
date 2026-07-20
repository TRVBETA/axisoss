/* ------------------------------------------
   AXIS // auth.js
   Personal PIN Gate + Session Bootstrap
   Server session is managed by Vercel API routes.
   ------------------------------------------ */

window.axisAuthState = {
    authenticated: false,
    checked: false
};

async function ensureAxisAuthentication() {
    try {
        const resp = await fetch('/api/auth', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });

        const data = await resp.json().catch(() => ({}));
        const ok = !!data.authenticated;

        window.axisAuthState.authenticated = ok;
        window.axisAuthState.checked = true;

        if (ok) {
            hideAxisLoginOverlay();
            updateAxisAuthHudStatus('AUTHENTICATED', 'var(--hud-optimal)');
            return true;
        }

        showAxisLoginOverlay('ENTER AXIS ACCESS PIN');
        updateAxisAuthHudStatus('LOCKED', 'var(--hud-warning)');
        return false;
    } catch (e) {
        window.axisAuthState.authenticated = false;
        window.axisAuthState.checked = true;
        showAxisLoginOverlay('SESSION CHECK FAILED');
        updateAxisAuthHudStatus('OFFLINE AUTH', 'var(--hud-critical)');
        return false;
    }
}

function showAxisLoginOverlay(message = 'ENTER AXIS ACCESS PIN') {
    const overlay = document.getElementById('axis-login-overlay');
    const status = document.getElementById('axis-login-status');
    const input = document.getElementById('axis-pin-input');

    if (status) status.textContent = message;
    if (overlay) overlay.classList.remove('hidden');

    setTimeout(() => {
        if (input) input.focus();
    }, 60);
}

function hideAxisLoginOverlay() {
    const overlay = document.getElementById('axis-login-overlay');
    const status = document.getElementById('axis-login-status');
    const input = document.getElementById('axis-pin-input');
    const nameInput = document.getElementById('axis-login-name');

    if (overlay) overlay.classList.add('hidden');
    if (status) status.textContent = 'ACCESS GRANTED';
    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
}

async function handleAxisPinSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('axis-login-name');
    const input = document.getElementById('axis-pin-input');
    const status = document.getElementById('axis-login-status');
    const name = (nameInput?.value || '').trim();
    const pin = (input?.value || '').trim();

    if (!name) {
        if (status) status.textContent = 'IDENTIFIER REQUIRED';
        return;
    }

    if (!pin) {
        if (status) status.textContent = 'PIN REQUIRED';
        return;
    }

    if (status) status.textContent = 'VERIFYING COMMAND CODE...';

    try {
        const resp = await fetch('/api/auth', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', name, pin })
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.ok) {
            if (status) status.textContent = data.error || 'ACCESS DENIED';
            return;
        }

        window.axisAuthState.authenticated = true;
        hideAxisLoginOverlay();
        updateAxisAuthHudStatus('AUTHENTICATED', 'var(--hud-optimal)');

        if (typeof startAxisModules === 'function') {
            startAxisModules();
        }
        if (window.axisIdle && typeof window.axisIdle.init === 'function') {
            window.axisIdle.init();
        }
    } catch (err) {
        if (status) status.textContent = 'LOGIN BRIDGE FAULT';
    }
}

async function logoutAxis() {
    try {
        await fetch('/api/auth', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
    } catch (e) {}

    window.axisAuthState.authenticated = false;
    window.location.reload();
}

function updateAxisAuthHudStatus(text, color = 'var(--text-muted)') {
    const el = document.getElementById('hud-auth-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}
