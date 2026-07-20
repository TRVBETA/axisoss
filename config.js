/* ------------------------------------------
   AXIS OS // config.js
   profile, appearance, nav, update safety, backup, telegram
   ------------------------------------------ */

const AXIS_APP_VERSION = '2026.07.14.review-capture';
const AXIS_SCHEMA_VERSION = '2026.07.14-b';
const AXIS_BUILD_NAME = 'AXIS_repo_latest_weekly_review_telegram_capture_safe_updates_2026-07-14.zip';

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

let configOpsState = {
    lastBackupAt: localStorage.getItem('axis_last_backup_at') || '',
    importStatus: '',
    telegramStatus: 'UNKNOWN'
};

function initConfig() {
    renderConfigView();
    applyStoredTheme(hudConfigState.theme);
    applyStoredFont(hudConfigState.fontPreset);
    updateNavTabsVisibility();
    if (typeof updateHudAgeChip === 'function') updateHudAgeChip();
    loadConfigTaskHistory({ silent: true });
    probeTelegramCaptureBridge();
}

function renderConfigView() {
    const container = document.getElementById('module-config');
    if (!container) return;

    container.innerHTML = `
        <input id="axis-import-file" type="file" accept="application/json" style="display:none;" onchange="handleAxisImportFile(event)">

        <div class="cockpit-header">
            <span>Config</span>
            <span class="text-sm text-muted">Profile • trust • backup • telegram</span>
        </div>

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
                <div class="font-mono font-bold text-accent">APPEARANCE + NAV</div>
                <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                    <button onclick="handleSelectTheme('warning')" class="tactical-btn axis-settings-choice ${hudConfigState.theme === 'warning' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #d79a52;">DUNE</button>
                    <button onclick="handleSelectTheme('cyan')" class="tactical-btn axis-settings-choice ${hudConfigState.theme === 'cyan' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #9eb8cf;">ICE</button>
                    <button onclick="handleSelectTheme('optimal')" class="tactical-btn axis-settings-choice ${hudConfigState.theme === 'optimal' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #97b589;">MOSS</button>
                    <button onclick="handleSelectTheme('violet')" class="tactical-btn axis-settings-choice ${hudConfigState.theme === 'violet' ? 'active' : ''}" style="justify-content: center; min-height: 46px; border-color: #c78749;">AMBER</button>
                </div>
                <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                    <button onclick="handleSelectFontPreset('modern')" class="tactical-btn axis-settings-choice ${hudConfigState.fontPreset === 'modern' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">MODERN</button>
                    <button onclick="handleSelectFontPreset('default')" class="tactical-btn axis-settings-choice ${hudConfigState.fontPreset === 'default' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">SYSTEM</button>
                    <button onclick="handleSelectFontPreset('compact')" class="tactical-btn axis-settings-choice ${hudConfigState.fontPreset === 'compact' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">COMPACT</button>
                    <button onclick="handleSelectFontPreset('classic')" class="tactical-btn axis-settings-choice ${hudConfigState.fontPreset === 'classic' ? 'active' : ''}" style="justify-content: center; min-height: 46px;">CLASSIC</button>
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

            <div class="cockpit-card stack" style="padding: 24px;">
                <div class="font-mono font-bold text-optimal">TRUST CENTER</div>
                <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted font-mono">App version</div>
                        <div class="font-mono font-bold text-main config-info-wrap">${AXIS_APP_VERSION}</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted font-mono">Schema version</div>
                        <div class="font-mono font-bold text-main config-info-wrap">${AXIS_SCHEMA_VERSION}</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted font-mono">Build</div>
                        <div class="font-mono font-bold text-main config-info-wrap">${escapeConfigHtml(AXIS_BUILD_NAME)}</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted font-mono">Last backup</div>
                        <div class="font-mono font-bold text-main config-info-wrap">${configOpsState.lastBackupAt ? escapeConfigHtml(configOpsState.lastBackupAt) : 'NONE'}</div>
                    </div>
                </div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button type="button" class="tactical-btn" onclick="exportAxisFullSnapshot()">EXPORT FULL SNAPSHOT</button>
                    <button type="button" class="tactical-btn" onclick="exportAxisSettingsSnapshot()">EXPORT SETTINGS ONLY</button>
                    <button type="button" class="tactical-btn" onclick="openAxisImportPicker()">IMPORT SNAPSHOT</button>
                </div>
                <div class="font-mono text-sm text-muted config-info-wrap">Safe update order: 1) export backup 2) apply schema SQL if needed 3) deploy zip 4) test fitness, nutrition, and Core sync.</div>
                <div class="font-mono text-sm" style="color: var(--text-main); min-height: 18px;">${escapeConfigHtml(configOpsState.importStatus || '')}</div>
            </div>

            <div class="cockpit-card stack" style="padding: 24px;">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                    <div class="font-mono font-bold text-cyan">TELEGRAM CAPTURE</div>
                    <span class="badge ${configOpsState.telegramStatus === 'ONLINE' ? 'badge-accent' : 'badge-muted'}">${configOpsState.telegramStatus}</span>
                </div>
                <div class="font-mono text-sm text-muted config-info-wrap">
                    /done finish hero export → match open tasks<br>
                    /eat 3 eggs + 2 bread + 20g cheese → nutrition log<br>
                    Workout shorthand → fitness log<br>
                    Voice note → transcribe, then route the same way
                </div>
                <button type="button" onclick="probeTelegramCaptureBridge()" class="tactical-btn w-full text-center">CHECK TELEGRAM BRIDGE</button>
            </div>

            <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; align-items: start;">
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
                    <button type="button" onclick="runServerConnectionTest()" class="tactical-btn w-full text-center" style="border-color: var(--hud-optimal);">TEST SERVER CONNECTION</button>
                    <div id="config-db-test-result" class="font-mono text-sm text-muted config-info-wrap">Supabase credentials should live in Vercel environment variables.</div>
                </div>

                <div class="cockpit-card stack" style="padding: 24px; border-color: rgba(173,181,191,0.22);">
                    <div class="font-mono font-bold text-cyan">SESSION</div>
                    <div class="font-mono text-muted config-info-wrap">Identifier + PIN are checked by your server. Session lives in a secure cookie.</div>
                    <div class="row font-mono" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">CURRENT STATE</span>
                        <span class="font-bold" style="color: ${window.axisAuthState?.authenticated ? 'var(--hud-optimal)' : 'var(--hud-warning)'};">${window.axisAuthState?.authenticated ? 'AUTHENTICATED' : 'LOCKED'}</span>
                    </div>
                    <button onclick="logoutAxis()" class="tactical-btn cyan w-full text-center">Log out</button>
                </div>
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
                <div class="font-mono text-muted config-info-wrap">This clears local AXIS cache from this device only. Server data is not deleted here.</div>
                <button onclick="handleFactoryReset()" class="tactical-btn w-full text-center" style="border-color: var(--hud-critical); color: var(--hud-critical); min-height: 46px;">Clear local cache</button>
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

async function probeTelegramCaptureBridge() {
    try {
        const resp = await fetch('/api/telegram', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) configOpsState.telegramStatus = 'ONLINE';
        else if (resp.ok && data.configured) configOpsState.telegramStatus = 'DEGRADED';
        else if (resp.ok && data.status) configOpsState.telegramStatus = 'STANDBY';
        else configOpsState.telegramStatus = 'OFFLINE';
    } catch {
        configOpsState.telegramStatus = 'OFFLINE';
    }
    const active = document.getElementById('module-config')?.classList.contains('active');
    if (active) renderConfigView();
}

async function gatherAxisSnapshot() {
    const endpointList = [
        ['/api/daily', 'daily'],
        ['/api/coredata', 'core'],
        ['/api/fitness', 'fitness'],
        ['/api/nutrition', 'nutrition'],
        ['/api/journal', 'journal'],
        ['/api/sleep', 'sleep']
    ];

    const results = await Promise.allSettled(endpointList.map(async ([url, key]) => {
        const resp = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        return [key, data];
    }));

    const server = {};
    results.forEach(item => {
        if (item.status === 'fulfilled') {
            const [key, value] = item.value;
            server[key] = value;
        }
    });

    return {
        exportedAt: new Date().toISOString(),
        appVersion: AXIS_APP_VERSION,
        schemaVersion: AXIS_SCHEMA_VERSION,
        buildName: AXIS_BUILD_NAME,
        local: {
            commanderName: localStorage.getItem('axis_commander_name') || '',
            birthday: localStorage.getItem('axis_birthday') || '',
            theme: localStorage.getItem('axis_theme') || '',
            fontPreset: localStorage.getItem('axis_font_preset') || '',
            hiddenModules: JSON.parse(localStorage.getItem('axis_hidden_modules') || '[]')
        },
        server
    };
}

function downloadAxisJsonFile(fileName, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function exportAxisFullSnapshot() {
    try {
        const snapshot = await gatherAxisSnapshot();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadAxisJsonFile(`axis_full_snapshot_${stamp}.json`, snapshot);
        configOpsState.lastBackupAt = new Date().toLocaleString();
        localStorage.setItem('axis_last_backup_at', configOpsState.lastBackupAt);
        configOpsState.importStatus = 'Full snapshot exported.';
        renderConfigView();
    } catch (e) {
        configOpsState.importStatus = `Export failed: ${e.message}`;
        renderConfigView();
    }
}

function exportAxisSettingsSnapshot() {
    const payload = {
        exportedAt: new Date().toISOString(),
        appVersion: AXIS_APP_VERSION,
        schemaVersion: AXIS_SCHEMA_VERSION,
        local: {
            commanderName: localStorage.getItem('axis_commander_name') || '',
            birthday: localStorage.getItem('axis_birthday') || '',
            theme: localStorage.getItem('axis_theme') || '',
            fontPreset: localStorage.getItem('axis_font_preset') || '',
            hiddenModules: JSON.parse(localStorage.getItem('axis_hidden_modules') || '[]')
        }
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadAxisJsonFile(`axis_settings_snapshot_${stamp}.json`, payload);
    configOpsState.lastBackupAt = new Date().toLocaleString();
    localStorage.setItem('axis_last_backup_at', configOpsState.lastBackupAt);
    configOpsState.importStatus = 'Settings snapshot exported.';
    renderConfigView();
}

function openAxisImportPicker() {
    document.getElementById('axis-import-file')?.click();
}

async function handleAxisImportFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
        const raw = await file.text();
        const data = JSON.parse(raw);
        await importAxisSnapshot(data);
        configOpsState.importStatus = 'Snapshot import applied.';
        renderConfigView();
    } catch (e) {
        configOpsState.importStatus = `Import failed: ${e.message}`;
        renderConfigView();
    } finally {
        if (event?.target) event.target.value = '';
    }
}

async function importAxisSnapshot(snapshot = {}) {
    const local = snapshot.local || {};
    if (local.commanderName) localStorage.setItem('axis_commander_name', local.commanderName);
    if (local.birthday) localStorage.setItem('axis_birthday', local.birthday);
    if (local.theme) localStorage.setItem('axis_theme', local.theme);
    if (local.fontPreset) localStorage.setItem('axis_font_preset', local.fontPreset);
    if (Array.isArray(local.hiddenModules)) localStorage.setItem('axis_hidden_modules', JSON.stringify(local.hiddenModules));

    hudConfigState.commanderName = local.commanderName || hudConfigState.commanderName;
    hudConfigState.birthday = local.birthday || hudConfigState.birthday;
    hudConfigState.theme = local.theme || hudConfigState.theme;
    hudConfigState.fontPreset = local.fontPreset || hudConfigState.fontPreset;
    hudConfigState.hiddenModules = Array.isArray(local.hiddenModules) ? local.hiddenModules : hudConfigState.hiddenModules;
    applyStoredTheme(hudConfigState.theme);
    applyStoredFont(hudConfigState.fontPreset);
    updateNavTabsVisibility();
    if (typeof updateHudAgeChip === 'function') updateHudAgeChip();
    if (typeof refreshCoreView === 'function') refreshCoreView();

    const nutrition = snapshot.server?.nutrition || {};
    for (const row of nutrition.customFoods || []) {
        await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-custom-food', ...row })
        });
    }
    for (const row of nutrition.mealTemplates || []) {
        await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-template', ...row })
        });
    }

    const core = snapshot.server?.core || {};
    if (core.balance?.amount != null) {
        await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'balance', label: core.balance.label || 'Main Balance', amount: core.balance.amount })
        });
    }
    for (const marker of core.markers || []) {
        await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'marker-save', title: marker.title, targetDate: marker.target_date, markerType: marker.marker_type, note: marker.note, isDone: marker.is_done })
        });
    }

    await loadConfigTaskHistory({ silent: true });
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
