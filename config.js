/* ==========================================
   AXIS OS // config.js
   profile, appearance, nav, session, server, history
   ========================================== */

let hudConfigState = {
    commanderName: localStorage.getItem('axis_commander_name') || 'AXIS',
    birthday: localStorage.getItem('axis_birthday') || '',
    theme: localStorage.getItem('axis_theme') || 'warning',
    fontPreset: localStorage.getItem('axis_font_preset') || 'modern',
    hiddenModules: JSON.parse(localStorage.getItem('axis_hidden_modules') || '[]')
};

let configHistoryState = {
    taskEvents: [],
    loaded: false,
    lastError: ''
};

function initConfig() {
    renderConfigView();
    applyStoredTheme(hudConfigState.theme);
    applyStoredFont(hudConfigState.fontPreset);
    updateNavTabsVisibility();
    if (typeof updateHudAgeChip === 'function') updateHudAgeChip();
    loadConfigTaskHistory({ silent: true });
}

function renderConfigView() {
    const container = document.getElementById('module-config');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>Config</span>
            <span class="text-sm text-muted">Profile • appearance • server</span>
        </div>

        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px;">
            <div class="stack" style="gap: 24px;">
                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-main">PROFILE</div>
                    <form onsubmit="handleSaveNameConfig(event)" class="stack stack-sm">
                        <label class="form-label">Name</label>
                        <div class="row flex-wrap" style="gap: 12px; align-items: stretch;">
                            <input type="text" class="tactical-input flex-1" id="config-input-name" placeholder="Your name" value="${escapeConfigHtml(hudConfigState.commanderName)}" maxlength="40" required>
                            <button type="submit" class="tactical-btn">Save</button>
                        </div>
                    </form>
                    <form onsubmit="handleSaveBirthdayConfig(event)" class="stack stack-sm">
                        <label class="form-label">Birthday</label>
                        <div class="row flex-wrap" style="gap: 12px; align-items: stretch;">
                            <input type="date" class="tactical-input flex-1" id="config-input-birthday" value="${escapeConfigHtml(hudConfigState.birthday)}" max="${new Date().toISOString().slice(0, 10)}">
                            <button type="submit" class="tactical-btn">Set age</button>
                        </div>
                        <div class="text-sm text-muted" style="line-height: 1.6;">Used for the top-left age chip: years / months / days.</div>
                    </form>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-accent">APPEARANCE</div>
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                        <button onclick="handleSelectTheme('warning')" class="tactical-btn ${hudConfigState.theme === 'warning' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #d79a52;">DUNE</button>
                        <button onclick="handleSelectTheme('cyan')" class="tactical-btn ${hudConfigState.theme === 'cyan' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #9eb8cf;">ICE</button>
                        <button onclick="handleSelectTheme('optimal')" class="tactical-btn ${hudConfigState.theme === 'optimal' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #97b589;">MOSS</button>
                        <button onclick="handleSelectTheme('violet')" class="tactical-btn ${hudConfigState.theme === 'violet' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #c78749;">AMBER</button>
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-cyan">TYPE</div>
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                        <button onclick="handleSelectFontPreset('modern')" class="tactical-btn ${hudConfigState.fontPreset === 'modern' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">MODERN</button>
                        <button onclick="handleSelectFontPreset('default')" class="tactical-btn ${hudConfigState.fontPreset === 'default' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">SYSTEM</button>
                        <button onclick="handleSelectFontPreset('compact')" class="tactical-btn ${hudConfigState.fontPreset === 'compact' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">COMPACT</button>
                        <button onclick="handleSelectFontPreset('classic')" class="tactical-btn ${hudConfigState.fontPreset === 'classic' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">CLASSIC</button>
                    </div>
                    <div class="text-sm text-muted" style="line-height: 1.6;">System fonts only, so the preview stays clean everywhere.</div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="row flex-wrap font-mono font-bold text-cyan" style="justify-content: space-between; gap: 12px;">
                        <span>NAVIGATION</span>
                        <span class="text-sm text-muted">Show / hide tabs</span>
                    </div>

                    <div class="grid font-mono text-base" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                        ${['fitness', 'music', 'library', 'design', 'nutrition', 'finance'].map(mod => {
                            const isHidden = hudConfigState.hiddenModules.includes(mod);
                            return `
                                <label class="row cursor-pointer" style="background: rgba(255,255,255,0.03); padding: 12px; border: 1px solid ${isHidden ? 'rgba(255,255,255,0.10)' : 'rgba(151,181,137,0.24)'}; gap: 10px; border-radius: 18px;">
                                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleModuleNavTab('${mod}')"> ${mod.toUpperCase()}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div class="stack" style="gap: 24px;">
                <div class="cockpit-card stack" style="padding: 24px; border-color: rgba(151,181,137,0.22);">
                    <div class="font-mono font-bold text-optimal">SERVER</div>
                    <div class="stack font-mono text-base" style="gap: 12px;">
                        <div class="row" style="justify-content: space-between; gap: 16px;">
                            <span class="text-muted">Server access</span>
                            <span class="text-optimal font-bold">NO KEYS IN BROWSER</span>
                        </div>
                        <div class="row" style="justify-content: space-between; gap: 16px;">
                            <span class="text-muted">Current state</span>
                            <span id="config-db-mirror" class="text-main font-bold">${getDbMirrorStatus()}</span>
                        </div>
                    </div>

                    <button type="button" onclick="runServerConnectionTest()" class="tactical-btn w-full text-center" style="border-color: var(--hud-optimal); margin-top: 4px;">
                        Test server connection
                    </button>

                    <div id="config-db-test-result" class="font-mono text-sm text-muted" style="line-height: 1.5;">
                        Supabase credentials should live in Vercel environment variables.
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px; border-color: rgba(173,181,191,0.22);">
                    <div class="font-mono font-bold text-cyan">SESSION</div>
                    <div class="font-mono text-muted" style="font-size: 0.85rem; line-height: 1.6;">
                        Identifier + PIN are checked by your server. Session lives in a secure cookie.
                    </div>

                    <div class="row font-mono" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">CURRENT STATE</span>
                        <span class="font-bold" style="color: ${window.axisAuthState?.authenticated ? 'var(--hud-optimal)' : 'var(--hud-warning)'};">
                            ${window.axisAuthState?.authenticated ? 'AUTHENTICATED' : 'LOCKED'}
                        </span>
                    </div>

                    <button onclick="logoutAxis()" class="tactical-btn cyan w-full text-center">Log out</button>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                        <div class="font-mono font-bold text-main">TASK HISTORY</div>
                        <button type="button" onclick="loadConfigTaskHistory({ silent: false })" class="tactical-btn" style="padding: 6px 10px; font-size: 0.68rem;">Refresh</button>
                    </div>
                    <div id="config-task-history-list" class="stack stack-sm">${renderConfigTaskHistoryHTML()}</div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px; border-color: rgba(191,122,104,0.22); background: linear-gradient(180deg, rgba(191,122,104,0.06), transparent);">
                    <div class="font-mono font-bold text-critical">RESET</div>
                    <div class="font-mono text-muted" style="font-size: 0.85rem; line-height: 1.6;">
                        This clears local AXIS cache from this device only. Server data is not deleted here.
                    </div>
                    <button onclick="handleFactoryReset()" class="tactical-btn w-full text-center" style="border-color: var(--hud-critical); color: var(--hud-critical); min-height: 46px;">
                        Clear local cache
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderConfigTaskHistoryHTML() {
    if (!configHistoryState.taskEvents.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">No task history yet.</div>`;
    }
    return configHistoryState.taskEvents.slice(0, 12).map(item => `
        <div class="list-item" style="border-left: 3px solid var(--hud-cyan); align-items: flex-start;">
            <div class="flex-1">
                <div class="font-mono text-sm font-bold text-main">${escapeConfigHtml(item.title_snapshot || 'Task')}</div>
                <div class="font-mono text-sm text-muted" style="margin-top: 4px;">${String(item.event_type || '').toUpperCase()} • ${Number(item.points_snapshot || 1)} PTS ${item.is_daily_snapshot ? '• DAILY' : ''}</div>
                <div class="font-mono text-sm text-muted" style="margin-top: 4px;">${formatConfigHistoryTime(item.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function formatConfigHistoryTime(value) {
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${h}:${m}`;
}

async function loadConfigTaskHistory({ silent = false } = {}) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return false;
    try {
        const resp = await fetch('/api/coredata', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        configHistoryState.taskEvents = data.history || [];
        configHistoryState.loaded = true;
        configHistoryState.lastError = '';
        if (!silent) renderConfigView();
        return true;
    } catch (e) {
        configHistoryState.lastError = e.message || 'FAILED TO LOAD TASK HISTORY';
        return false;
    }
}

function getDbMirrorStatus() {
    const dbHud = document.getElementById('hud-db-status');
    return dbHud ? dbHud.textContent : 'UNINITIALIZED';
}

async function runServerConnectionTest() {
    const resultEl = document.getElementById('config-db-test-result');
    const mirrorEl = document.getElementById('config-db-mirror');

    if (resultEl) {
        resultEl.textContent = 'CONTACTING /api/db-test ...';
        resultEl.style.color = 'var(--hud-cyan)';
    }

    try {
        const resp = await fetch('/api/db-test', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.ok) {
            throw new Error(data.error || `HTTP ${resp.status}`);
        }

        if (typeof verifyDatabaseConnection === 'function') await verifyDatabaseConnection();
        if (mirrorEl) mirrorEl.textContent = getDbMirrorStatus();

        if (resultEl) {
            resultEl.textContent = `SERVER BRIDGE VERIFIED // ${data.checkedAt || 'READY'}`;
            resultEl.style.color = 'var(--hud-optimal)';
        }
    } catch (e) {
        if (mirrorEl) mirrorEl.textContent = getDbMirrorStatus();
        if (resultEl) {
            resultEl.textContent = `DB TEST FAILED // ${e.message}`;
            resultEl.style.color = 'var(--hud-critical)';
        }
    }
}

function handleSaveNameConfig(e) {
    e.preventDefault();
    const name = document.getElementById('config-input-name').value.trim() || 'AXIS';
    hudConfigState.commanderName = name;
    localStorage.setItem('axis_commander_name', name);

    if (typeof refreshCoreView === 'function') refreshCoreView();
    if (typeof prepareAxisGreeting === 'function') prepareAxisGreeting();
    renderConfigView();
}

function handleSaveBirthdayConfig(e) {
    e.preventDefault();
    const birthday = String(document.getElementById('config-input-birthday')?.value || '').trim();
    hudConfigState.birthday = birthday;
    if (birthday) {
        localStorage.setItem('axis_birthday', birthday);
    } else {
        localStorage.removeItem('axis_birthday');
    }
    if (typeof updateHudAgeChip === 'function') updateHudAgeChip();
    renderConfigView();
}

function handleSelectTheme(newTheme) {
    hudConfigState.theme = newTheme;
    localStorage.setItem('axis_theme', newTheme);
    applyStoredTheme(newTheme);
    renderConfigView();
}

function handleSelectFontPreset(preset) {
    hudConfigState.fontPreset = preset;
    localStorage.setItem('axis_font_preset', preset);
    applyStoredFont(preset);
    renderConfigView();
}

function applyStoredTheme(themeName) {
    if (themeName === 'cyan') {
        document.documentElement.style.setProperty('--hud-violet', '#a8bfd5');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(168, 191, 213, 0.25)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(168, 191, 213, 0.12)');
    } else if (themeName === 'optimal') {
        document.documentElement.style.setProperty('--hud-violet', '#97b589');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(151, 181, 137, 0.25)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(151, 181, 137, 0.12)');
    } else if (themeName === 'violet') {
        document.documentElement.style.setProperty('--hud-violet', '#c78749');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(199, 135, 73, 0.24)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(199, 135, 73, 0.11)');
    } else {
        document.documentElement.style.setProperty('--hud-violet', '#d79a52');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(215, 154, 82, 0.22)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(215, 154, 82, 0.10)');
    }
}

function applyStoredFont(preset) {
    if (preset === 'modern') {
        document.documentElement.style.setProperty('--font-body', 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
        document.documentElement.style.setProperty('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace');
    } else if (preset === 'compact') {
        document.documentElement.style.setProperty('--font-body', 'Arial, Helvetica, sans-serif');
        document.documentElement.style.setProperty('--font-mono', 'Consolas, "Lucida Console", monospace');
    } else if (preset === 'classic') {
        document.documentElement.style.setProperty('--font-body', 'Georgia, "Times New Roman", serif');
        document.documentElement.style.setProperty('--font-mono', 'Courier New, Courier, monospace');
    } else {
        document.documentElement.style.setProperty('--font-body', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
        document.documentElement.style.setProperty('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace');
    }
}

function toggleModuleNavTab(targetMod) {
    const idx = hudConfigState.hiddenModules.indexOf(targetMod);
    if (idx === -1) {
        hudConfigState.hiddenModules.push(targetMod);
    } else {
        hudConfigState.hiddenModules.splice(idx, 1);
    }
    localStorage.setItem('axis_hidden_modules', JSON.stringify(hudConfigState.hiddenModules));
    updateNavTabsVisibility();
    renderConfigView();
}

function updateNavTabsVisibility() {
    ['fitness', 'music', 'library', 'design', 'nutrition', 'finance'].forEach(mod => {
        const btn = document.getElementById(`tab-${mod}`);
        if (btn) {
            const isHidden = hudConfigState.hiddenModules.includes(mod);
            btn.style.display = isHidden ? 'none' : 'inline-flex';
        }
    });
}

function handleFactoryReset() {
    if (confirm('Clear local AXIS cache from this device?')) {
        const preservedTheme = localStorage.getItem('axis_theme');
        localStorage.clear();
        if (preservedTheme) localStorage.setItem('axis_theme', preservedTheme);
        window.location.reload();
    }
}

function escapeConfigHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
