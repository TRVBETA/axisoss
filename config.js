/* ==========================================
   AXIS OS // config.js
   HUD Configuration Suite: Commander Name, Theme Architecture,
   Module Visibility Toggles, Session Control, DB Status, and Memory Purge
   ========================================== */

let hudConfigState = {
    commanderName: localStorage.getItem('axis_commander_name') || 'ALEX MERCER',
    theme: localStorage.getItem('axis_theme') || 'warning',
    fontPreset: localStorage.getItem('axis_font_preset') || 'default',
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
    loadConfigTaskHistory({ silent: true });
}

function renderConfigView() {
    const container = document.getElementById('module-config');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>SYSTEM CONFIGURATION // HUD COCKPIT PARAMS</span>
            <span class="text-sm text-cyan">AXIS V4.3 CORE SETTINGS</span>
        </div>

        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px;">

            <!-- Left Column: Name, Themes, Modules -->
            <div class="stack" style="gap: 24px;">

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-main">
                        COMMANDER IDENTIFIER // PROFILE
                    </div>
                    <form onsubmit="handleSaveNameConfig(event)" class="row flex-wrap" style="gap: 16px;">
                        <input type="text" class="tactical-input flex-1" id="config-input-name" placeholder="Enter Commander Name" value="${hudConfigState.commanderName}" maxlength="30" required>
                        <button type="submit" class="tactical-btn">COMMIT</button>
                    </form>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-accent">
                        CHROMATIC THEME ARCHITECTURE
                    </div>

                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 16px;">
                        <button onclick="handleSelectTheme('violet')" class="tactical-btn ${hudConfigState.theme === 'violet' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #a855f7;">
                            COCKPIT VIOLET
                        </button>
                        <button onclick="handleSelectTheme('cyan')" class="tactical-btn ${hudConfigState.theme === 'cyan' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #38bdf8;">
                            STARK CYAN
                        </button>
                        <button onclick="handleSelectTheme('optimal')" class="tactical-btn ${hudConfigState.theme === 'optimal' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #10b981;">
                            OPTIMAL GREEN
                        </button>
                        <button onclick="handleSelectTheme('warning')" class="tactical-btn ${hudConfigState.theme === 'warning' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #f59e0b;">
                            SOLAR FLARE
                        </button>
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-cyan">
                        FONT PRESET
                    </div>
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 16px;">
                        <button onclick="handleSelectFontPreset('default')" class="tactical-btn ${hudConfigState.fontPreset === 'default' ? 'active' : ''}" style="justify-content: center; height: 50px;">DEFAULT</button>
                        <button onclick="handleSelectFontPreset('modern')" class="tactical-btn ${hudConfigState.fontPreset === 'modern' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-cyan);">MODERN</button>
                        <button onclick="handleSelectFontPreset('compact')" class="tactical-btn ${hudConfigState.fontPreset === 'compact' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-optimal);">COMPACT</button>
                        <button onclick="handleSelectFontPreset('classic')" class="tactical-btn ${hudConfigState.fontPreset === 'classic' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-warning);">CLASSIC</button>
                    </div>
                    <div class="font-mono text-sm text-muted" style="margin-top: 14px; line-height: 1.5;">
                        System-font presets only, so they render inside the Arena preview and work without external font CDNs.
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="row flex-wrap font-mono font-bold text-cyan" style="justify-content: space-between; gap: 12px;">
                        <span>MODULE TACTICAL TOGGLES</span>
                        <span class="text-sm text-muted">SHOW OR HIDE NAV TABS</span>
                    </div>

                    <div class="grid font-mono text-base" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                        ${['fitness', 'music', 'library', 'design', 'nutrition', 'finance'].map(mod => {
                            let isHidden = hudConfigState.hiddenModules.includes(mod);
                            return `
                                <label class="row cursor-pointer" style="background: var(--bg-surface); padding: 12px; border: 1px solid ${isHidden ? 'var(--text-muted)' : 'var(--hud-optimal)'}; gap: 10px; border-radius: 8px;">
                                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleModuleNavTab('${mod}')" style="accent-color: var(--hud-optimal);"> ${mod.toUpperCase()}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Right Column: DB Status, Session & Reset -->
            <div class="stack" style="gap: 24px;">

                <div class="cockpit-card stack" style="padding: 24px; border-color: var(--hud-optimal);">
                    <div class="font-mono font-bold text-optimal">
                        SERVER DATABASE BRIDGE
                    </div>

                    <div class="stack font-mono text-base" style="gap: 12px;">
                        <div class="row" style="justify-content: space-between; gap: 16px;">
                            <span class="text-muted">Vercel-managed server access</span>
                            <span class="text-optimal font-bold">NO KEYS IN BROWSER</span>
                        </div>
                        <div class="row" style="justify-content: space-between; gap: 16px;">
                            <span class="text-muted">Current DB HUD state</span>
                            <span id="config-db-mirror" class="text-main font-bold">${getDbMirrorStatus()}</span>
                        </div>
                    </div>

                    <button type="button" onclick="runServerConnectionTest()" class="tactical-btn w-full text-center" style="border-color: var(--hud-optimal); margin-top: 18px;">
                        TEST SERVER CONNECTION
                    </button>

                    <div id="config-db-test-result" class="font-mono text-sm text-muted" style="margin-top: 14px; line-height: 1.5;">
                        AXIS now expects Supabase credentials to live in Vercel Environment Variables, not in this browser.
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px; border-color: var(--hud-cyan);">
                    <div class="font-mono font-bold text-cyan">
                        ACCESS SESSION CONTROL
                    </div>

                    <div class="font-mono text-muted" style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
                        This fortress is protected by a small access PIN verified by your Vercel server. Session is stored as a secure cookie.
                    </div>

                    <div class="row font-mono" style="justify-content: space-between; margin-bottom: 16px;">
                        <span class="text-muted">CURRENT SESSION STATE</span>
                        <span class="font-bold" style="color: ${window.axisAuthState?.authenticated ? 'var(--hud-optimal)' : 'var(--hud-warning)'};">
                            ${window.axisAuthState?.authenticated ? 'AUTHENTICATED' : 'LOCKED'}
                        </span>
                    </div>

                    <button onclick="logoutAxis()" class="tactical-btn cyan w-full text-center">
                        LOG OUT OF AXIS
                    </button>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                        <div class="font-mono font-bold text-main">TASK HISTORY</div>
                        <button type="button" onclick="loadConfigTaskHistory({ silent: false })" class="tactical-btn" style="padding: 6px 10px; font-size: 0.68rem;">REFRESH</button>
                    </div>
                    <div id="config-task-history-list" class="stack stack-sm">${renderConfigTaskHistoryHTML()}</div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px; border-color: var(--hud-critical); background: linear-gradient(180deg, rgba(187,123,98,0.05), transparent);">
                    <div class="font-mono font-bold text-critical">
                        CRITICAL TELEMETRY PURGE
                    </div>

                    <div class="font-mono text-muted" style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
                        Executing a system purge will instantly erase all active session caches, hydration records, private music projects, EPUB bookmarks, and custom HUD parameters from this device.
                    </div>

                    <button onclick="handleFactoryReset()" class="tactical-btn w-full text-center" style="border-color: var(--hud-critical); color: var(--hud-critical); height: 50px;">
                        PURGE ALL LOCAL CACHE & RESET
                    </button>
                </div>

            </div>

        </div>
    `;
}

function renderConfigTaskHistoryHTML() {
    if (!configHistoryState.taskEvents.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px;">No task history yet.</div>`;
    }
    return configHistoryState.taskEvents.slice(0, 12).map(item => `
        <div class="list-item" style="border-left: 3px solid var(--hud-cyan); align-items: flex-start;">
            <div class="flex-1">
                <div class="font-mono text-sm font-bold text-main">${item.title_snapshot || 'Task'}</div>
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
    let name = document.getElementById('config-input-name').value.trim() || 'COMMANDER';
    hudConfigState.commanderName = name;
    localStorage.setItem('axis_commander_name', name);
    
    if (typeof refreshCoreView === 'function') refreshCoreView();
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
    if(themeName === 'cyan') {
        document.documentElement.style.setProperty('--hud-violet', '#38bdf8');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(56, 189, 248, 0.4)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(56, 189, 248, 0.15)');
    } else if(themeName === 'optimal') {
        document.documentElement.style.setProperty('--hud-violet', '#10b981');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(16, 185, 129, 0.4)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(16, 185, 129, 0.15)');
    } else if(themeName === 'warning') {
        document.documentElement.style.setProperty('--hud-violet', '#f59e0b');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(245, 158, 11, 0.4)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(245, 158, 11, 0.15)');
    } else {
        document.documentElement.style.setProperty('--hud-violet', '#e08c2b');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(224, 140, 43, 0.12)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(224, 140, 43, 0.06)');
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
        document.documentElement.style.setProperty('--font-mono', 'Courier New, Consolas, monospace');
    }
}

function toggleModuleNavTab(targetMod) {
    let idx = hudConfigState.hiddenModules.indexOf(targetMod);
    if(idx === -1) {
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
        let btn = document.getElementById(`tab-${mod}`);
        if(btn) {
            let isHidden = hudConfigState.hiddenModules.includes(mod);
            btn.style.display = isHidden ? 'none' : 'inline-block';
        }
    });
}

function handleFactoryReset() {
    if(confirm("CRITICAL WARNING: Purge all local AXIS OS data and session caches from this device?")) {
        const preservedTheme = localStorage.getItem('axis_theme');
        localStorage.clear();
        if (preservedTheme) localStorage.setItem('axis_theme', preservedTheme);
        window.location.reload();
    }
}