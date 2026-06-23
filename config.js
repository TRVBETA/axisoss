/* ==========================================
   AXIS OS // config.js
   HUD Configuration Suite: Commander Name, Theme Architecture,
   Module Visibility Toggles, Session Control, DB Status, and Memory Purge
   ========================================== */

let hudConfigState = {
    commanderName: localStorage.getItem('axis_commander_name') || 'ALEX MERCER',
    theme: localStorage.getItem('axis_theme') || 'violet',
    fontPreset: localStorage.getItem('axis_font_preset') || 'default',
    hiddenModules: JSON.parse(localStorage.getItem('axis_hidden_modules') || '[]')
};

function initConfig() {
    renderConfigView();
    applyStoredTheme(hudConfigState.theme);
    applyStoredFont(hudConfigState.fontPreset);
    updateNavTabsVisibility();
}

function renderConfigView() {
    const container = document.getElementById('module-config');
    if (!container) return;

    const isMobile = window.innerWidth <= 900;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>SYSTEM CONFIGURATION // HUD COCKPIT PARAMS</span>
            <span style="font-size: 0.75rem; color: var(--hud-cyan);">AXIS V4.3 CORE SETTINGS</span>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 40px;">
            
            <!-- Left Column: Name, Themes, Modules -->
            <div style="display: flex; flex-direction: column; gap: 32px;">
                
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-bottom: 16px;">
                        COMMANDER IDENTIFIER // PROFILE
                    </div>
                    <form onsubmit="handleSaveNameConfig(event)" style="display: flex; gap: 16px;">
                        <input type="text" class="tactical-input" style="flex: 1;" id="config-input-name" placeholder="Enter Commander Name" value="${hudConfigState.commanderName}" maxlength="30" required>
                        <button type="submit" class="tactical-btn">COMMIT IDENTIFIER</button>
                    </form>
                </div>

                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 16px;">
                        CHROMATIC THEME ARCHITECTURE
                    </div>
                    
                    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 16px;">
                        <button onclick="handleSelectTheme('violet')" class="tactical-btn ${hudConfigState.theme === 'violet' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #a855f7;">
                            COCKPIT VIOLET (MASTER)
                        </button>
                        <button onclick="handleSelectTheme('cyan')" class="tactical-btn ${hudConfigState.theme === 'cyan' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #38bdf8;">
                            STARK CYBER CYAN
                        </button>
                        <button onclick="handleSelectTheme('optimal')" class="tactical-btn ${hudConfigState.theme === 'optimal' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #10b981;">
                            OPTIMAL BIO GREEN
                        </button>
                        <button onclick="handleSelectTheme('warning')" class="tactical-btn ${hudConfigState.theme === 'warning' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: #f59e0b;">
                            SOLAR FLARE ORANGE
                        </button>
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; margin-bottom: 16px;">
                        FONT PRESET
                    </div>
                    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 16px;">
                        <button onclick="handleSelectFontPreset('default')" class="tactical-btn ${hudConfigState.fontPreset === 'default' ? 'active' : ''}" style="justify-content: center; height: 50px;">DEFAULT</button>
                        <button onclick="handleSelectFontPreset('modern')" class="tactical-btn ${hudConfigState.fontPreset === 'modern' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-cyan);">MODERN</button>
                        <button onclick="handleSelectFontPreset('compact')" class="tactical-btn ${hudConfigState.fontPreset === 'compact' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-optimal);">COMPACT</button>
                        <button onclick="handleSelectFontPreset('classic')" class="tactical-btn ${hudConfigState.fontPreset === 'classic' ? 'active' : ''}" style="justify-content: center; height: 50px; border-color: var(--hud-warning);">CLASSIC</button>
                    </div>
                    <div style="margin-top: 14px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                        System-font presets only, so they render inside the Arena preview and work without external font CDNs.
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between;">
                        <span>MODULE TACTICAL TOGGLES</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">SHOW OR HIDE NAV TABS</span>
                    </div>

                    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : 'repeat(3, 1fr)'}; gap: 16px; font-family: var(--font-mono); font-size: 0.9rem;">
                        ${['fitness', 'sleep', 'music', 'library', 'design', 'nutrition', 'finance'].map(mod => {
                            let isHidden = hudConfigState.hiddenModules.includes(mod);
                            return `
                                <label style="background: var(--bg-surface); padding: 12px; border: 1px solid ${isHidden ? 'var(--text-muted)' : 'var(--hud-optimal)'}; display: flex; align-items: center; gap: 10px; cursor: pointer; border-radius: 2px;">
                                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleModuleNavTab('${mod}')" style="accent-color: var(--hud-optimal);"> ${mod.toUpperCase()}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Right Column: DB Status, Session & Reset -->
            <div style="display: flex; flex-direction: column; gap: 32px;">
                
                <div class="cockpit-card" style="padding: 28px; border-color: var(--hud-optimal);">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px;">
                        SERVER DATABASE BRIDGE
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px; font-family: var(--font-mono); font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between; gap: 24px; align-items: center;">
                            <span style="color: var(--text-muted);">Vercel-managed server access</span>
                            <span style="color: var(--hud-optimal); font-weight: bold;">NO KEYS IN BROWSER</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 24px; align-items: center;">
                            <span style="color: var(--text-muted);">Current DB HUD state</span>
                            <span id="config-db-mirror" style="color: var(--text-main); font-weight: bold;">${getDbMirrorStatus()}</span>
                        </div>
                    </div>

                    <button type="button" onclick="runServerConnectionTest()" class="tactical-btn" style="justify-content: center; width: 100%; border-color: var(--hud-optimal); margin-top: 18px;">
                        TEST SERVER CONNECTION
                    </button>

                    <div id="config-db-test-result" style="margin-top: 14px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                        AXIS now expects Supabase credentials to live in Vercel Environment Variables, not in this browser.
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 28px; border-color: var(--hud-cyan);">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; margin-bottom: 12px;">
                        ACCESS SESSION CONTROL
                    </div>
                    
                    <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px;">
                        This fortress is protected by a small access PIN verified by your Vercel server. Session is stored as a secure cookie.
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); margin-bottom: 18px;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);">CURRENT SESSION STATE</span>
                        <span style="font-size: 0.9rem; color: ${window.axisAuthState?.authenticated ? 'var(--hud-optimal)' : 'var(--hud-warning)'}; font-weight: bold;">
                            ${window.axisAuthState?.authenticated ? 'AUTHENTICATED' : 'LOCKED'}
                        </span>
                    </div>

                    <button onclick="logoutAxis()" class="tactical-btn cyan" style="justify-content: center; width: 100%;">
                        LOG OUT OF AXIS
                    </button>
                </div>

                <div class="cockpit-card" style="padding: 28px; border-color: var(--hud-critical); background: radial-gradient(circle at center, rgba(244, 63, 94, 0.05) 0%, transparent 80%);">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-critical); font-weight: bold; margin-bottom: 12px;">
                        ⚠️ CRITICAL TELEMETRY PURGE
                    </div>
                    
                    <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px;">
                        Executing a system purge will instantly erase all active session caches, hydration records, private music projects, EPUB bookmarks, and custom HUD parameters from this device.
                    </div>

                    <button onclick="handleFactoryReset()" class="tactical-btn" style="justify-content: center; width: 100%; border-color: var(--hud-critical); color: var(--hud-critical); height: 50px;">
                        PURGE ALL LOCAL CACHE & RESET
                    </button>
                </div>

            </div>

        </div>
    `;
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
        document.documentElement.style.setProperty('--hud-violet', '#a855f7');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(168, 85, 247, 0.4)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(168, 85, 247, 0.15)');
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
    ['fitness', 'sleep', 'music', 'library', 'design', 'nutrition', 'finance'].forEach(mod => {
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