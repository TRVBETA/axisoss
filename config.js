/* ==========================================
   AXIS OS // config.js
   HUD Configuration Suite: Commander Name, Chromatic Theme Architecture,
   Supabase REST API Keys Injection, Module Visibility Toggles,
   and System Memory Purge
   ========================================== */

let hudConfigState = {
    commanderName: localStorage.getItem('axis_commander_name') || 'ALEX MERCER',
    theme: localStorage.getItem('axis_theme') || 'violet',
    hiddenModules: JSON.parse(localStorage.getItem('axis_hidden_modules') || '[]'),
    supabaseUrl: localStorage.getItem('axis_supabase_url') || '',
    supabaseKey: localStorage.getItem('axis_supabase_key') || ''
};

function initConfig() {
    renderConfigView();
    applyStoredTheme(hudConfigState.theme);
    updateNavTabsVisibility();
}

function renderConfigView() {
    const container = document.getElementById('module-config');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>SYSTEM CONFIGURATION // HUD COCKPIT PARAMS</span>
            <span style="font-size: 0.75rem; color: var(--hud-cyan);">AXIS V4.2 CORE SETTINGS</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            
            <!-- Left Column: Name, Themes, Modules & Anim -->
            <div style="display: flex; flex-direction: column; gap: 32px;">
                
                <!-- Commander Name Identifier Card -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-bottom: 16px;">
                        COMMANDER IDENTIFIER // PROFILE
                    </div>
                    <form onsubmit="handleSaveNameConfig(event)" style="display: flex; gap: 16px;">
                        <input type="text" class="tactical-input" style="flex: 1;" id="config-input-name" placeholder="Enter Commander Name" value="${hudConfigState.commanderName}" maxlength="30" required>
                        <button type="submit" class="tactical-btn">COMMIT IDENTIFIER</button>
                    </form>
                </div>

                <!-- Chromatic Theme Architecture Suite -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 16px;">
                        CHROMATIC THEME ARCHITECTURE
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
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

                <!-- Module Visibility Toggle Suite -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between;">
                        <span>MODULE TACTICAL TOGGLES</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">SHOW OR HIDE NAV TABS</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-family: var(--font-mono); font-size: 0.9rem;">
                        ${['fitness', 'sleep', 'music', 'library', 'design', 'nutrition', 'finance'].map(mod => {
                            let isHidden = hudConfigState.hiddenModules.includes(mod);
                            return `
                                <label style="background: var(--bg-surface); padding: 12px; border: 1px solid ${isHidden ? 'var(--text-muted)' : 'var(--hud-optimal)'}; display: flex; align-items: center; gap: 10px; cursor: pointer; border-radius: 2px;">
                                    <input type="checkbox" checked="${!isHidden}" onchange="toggleModuleNavTab('${mod}')" style="accent-color: var(--hud-optimal);"> ${mod.toUpperCase()}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Right Column: Supabase Injection & Memory Purge -->
            <div style="display: flex; flex-direction: column; gap: 32px;">
                
                <!-- Supabase REST API Keys Injection -->
                <div class="cockpit-card" style="padding: 28px; border-color: var(--hud-optimal);">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px;">
                        SUPABASE DATABASE & STORAGE BRIDGE
                    </div>

                    <form onsubmit="handleSaveSupabaseKeys(event)" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">SUPABASE PROJECT URL</label>
                            <input type="url" class="tactical-input" id="config-sub-url" placeholder="e.g. https://xyz.supabase.co" value="${hudConfigState.supabaseUrl}">
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">SUPABASE ANON / API KEY</label>
                            <input type="password" class="tactical-input" id="config-sub-key" placeholder="Paste full eyJhbGciOi..." value="${hudConfigState.supabaseKey}">
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; border-color: var(--hud-optimal);">
                            CONNECT REST ENGINE &raquo;
                        </button>
                    </form>

                    <div style="margin-top: 16px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                        Injecting real keys instantly activates the PostgREST DB Engine. When offline or unconfigured, AXIS autonomously executes in LocalStorage Offline Fortress Mode.
                    </div>
                </div>

                <!-- Critical System Memory Purge -->
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

function handleSaveNameConfig(e) {
    e.preventDefault();
    let name = document.getElementById('config-input-name').value.trim() || 'COMMANDER';
    hudConfigState.commanderName = name;
    localStorage.setItem('axis_commander_name', name);
    
    // Trigger update on Core Home
    if (typeof refreshCoreView === 'function') refreshCoreView();
    renderConfigView();
}

function handleSelectTheme(newTheme) {
    hudConfigState.theme = newTheme;
    localStorage.setItem('axis_theme', newTheme);
    applyStoredTheme(newTheme);
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
        // default violet
        document.documentElement.style.setProperty('--hud-violet', '#a855f7');
        document.documentElement.style.setProperty('--hud-violet-glow', 'rgba(168, 85, 247, 0.4)');
        document.documentElement.style.setProperty('--hud-violet-subtle', 'rgba(168, 85, 247, 0.15)');
    }
}

function handleSaveSupabaseKeys(e) {
    e.preventDefault();
    let url = document.getElementById('config-sub-url').value.trim();
    let key = document.getElementById('config-sub-key').value.trim();

    hudConfigState.supabaseUrl = url;
    hudConfigState.supabaseKey = key;
    localStorage.setItem('axis_supabase_url', url);
    localStorage.setItem('axis_supabase_key', key);

    // reinit supabase client
    if(typeof supabaseClient !== 'undefined') {
        supabaseClient.url = url;
        supabaseClient.key = key;
    }
    if(typeof initSupabase === 'function') initSupabase();
    
    renderConfigView();
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
    if(confirm("CRITICAL WARNING: Purge all local AXIS OS data, session logs, and credentials from this device?")) {
        localStorage.clear();
        window.location.reload();
    }
}