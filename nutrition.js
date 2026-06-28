/* ==========================================
   AXIS OS // nutrition.js
   Nutrition + hydration server integration
   ========================================== */

let nutritionState = {
    rows: [],
    todayRows: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    targets: { calories: 2650, protein: 140, carbs: 330, fat: 70 },
    syncMode: 'local',
    lastError: '',
    isEditing: false,
    draft: ''
};

function initNutrition() {
    renderNutritionView();
    loadNutritionFromServer({ silent: true });
}

function renderNutritionView() {
    const container = document.getElementById('module-nutrition');
    if (!container) return;

    const isMobile = window.innerWidth <= 900;
    const waterLiters = typeof todayTelemetry !== 'undefined' ? todayTelemetry.waterLiters : 0;
    const waterTaps = Math.min(7, Math.floor(waterLiters / 0.6));

    container.innerHTML = `
        <div class="cockpit-header">
            <span>NUTRITION</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${nutritionState.syncMode === 'server' ? 'SERVER SYNC' : 'LOCAL / STANDBY'}</span>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '0.95fr 1.05fr'}; gap: 32px; align-items: start;">
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div class="cockpit-card" style="padding: 24px; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">FOOD LOG</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="tactical-btn" type="button" style="padding: 6px 12px; font-size: 0.68rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="resetNutritionLogs()">CLEAR</button>
                        </div>
                    </div>

                    <form onsubmit="handleNutritionLog(event)" style="display: flex; flex-direction: column; gap: 14px;">
                        <textarea id="nutrition-text-input" class="tactical-input" rows="5" placeholder="Examples:\n400g rice, 200g chicken breast\n5 eggs\n250ml milk\n2 tsp sugar" style="resize: vertical; line-height: 1.6;" onfocus="setNutritionEditing(true)" onblur="setNutritionEditing(false)" oninput="updateNutritionDraft(this.value)">${nutritionState.draft || ''}</textarea>
                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%;">LOG FOOD</button>
                    </form>

                    <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); line-height: 1.6; background: rgba(255,255,255,0.03); padding: 12px 14px;">
                        Powered by the hardened nutrition parser. It uses local parsing first, then Groq fallback if enabled, with USDA fallback for foods outside the internal database.
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 24px; gap: 16px;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-cyan); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                        <span>HYDRATION</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">600ML • GOAL 4.0L</span>
                    </div>

                    <div style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: bold; color: var(--text-main);">
                        ${waterLiters.toFixed(1)} L / 4.0 L
                    </div>

                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                        ${typeof renderWaterCartridgesHTML === 'function' ? renderWaterCartridgesHTML(waterTaps) : ''}
                    </div>

                    <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span>TAP TO UPDATE WATER</span>
                        <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.68rem;" onclick="resetWaterFromNutrition()">RESET</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div class="cockpit-card" style="padding: 24px; gap: 16px;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-optimal); font-weight: bold;">TODAY SUMMARY</div>
                    <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 14px;">
                        ${renderNutritionMetricCard('Calories', nutritionState.totals.calories, nutritionState.targets.calories, 'kcal', 'var(--hud-violet)')}
                        ${renderNutritionMetricCard('Protein', nutritionState.totals.protein, nutritionState.targets.protein, 'g', 'var(--hud-optimal)')}
                        ${renderNutritionMetricCard('Carbs', nutritionState.totals.carbs, nutritionState.targets.carbs, 'g', 'var(--hud-cyan)')}
                        ${renderNutritionMetricCard('Fat', nutritionState.totals.fat, nutritionState.targets.fat, 'g', 'var(--hud-warning)')}
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 24px; gap: 16px;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-main); font-weight: bold;">RECENT ENTRIES</div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${renderNutritionRowsHTML()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderNutritionMetricCard(label, value, target, unit, color) {
    const pct = Math.max(0, Math.min(100, (value / Math.max(target, 1)) * 100));
    return `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">${label}</div>
            <div style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: bold; color: ${color};">${Math.round(value)} / ${target} ${unit}</div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
            </div>
        </div>
    `;
}

function renderNutritionRowsHTML() {
    if (!nutritionState.rows.length) {
        return `<div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 12px;">No nutrition entries yet.</div>`;
    }
    return nutritionState.rows.slice(0, 10).map(row => `
        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--hud-violet); padding: 10px 12px; font-family: var(--font-mono); display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
            <div>
                <div style="font-size: 0.82rem; color: var(--text-main); font-weight: bold;">${row.description}</div>
                <div style="font-size: 0.68rem; color: var(--text-muted);">${row.quantity} ${row.unit} • ${formatNutritionTime(row.logged_at)} • ${row.source || 'axis'}</div>
            </div>
            <div style="text-align: right; font-size: 0.75rem; color: var(--hud-optimal); font-weight: bold;">
                ${Math.round(row.calories)} kcal
            </div>
        </div>
    `).join('');
}

function formatNutritionTime(value) {
  const d = new Date(value);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function shouldUseNutritionServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadNutritionFromServer({ silent = false } = {}) {
    if (!shouldUseNutritionServer()) return false;
    try {
        const resp = await fetch('/api/nutrition', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.rows = data.rows || [];
        nutritionState.todayRows = data.todayRows || [];
        nutritionState.totals = data.totals || nutritionState.totals;
        nutritionState.targets = data.targets || nutritionState.targets;
        nutritionState.syncMode = 'server';
        nutritionState.lastError = '';
        if (!(silent && nutritionState.isEditing)) {
            renderNutritionView();
        }
        return true;
    } catch (e) {
        nutritionState.syncMode = 'local';
        nutritionState.lastError = e.message || 'FAILED TO LOAD NUTRITION';
        return false;
    }
}

async function handleNutritionLog(e) {
    e.preventDefault();
    const input = document.getElementById('nutrition-text-input');
    const text = String(input?.value || '').trim();
    if (!text) return;

    if (!shouldUseNutritionServer()) {
        console.warn('Nutrition logging needs online server sync first.');
        return;
    }

    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.draft = '';
        nutritionState.isEditing = false;
        if (input) input.value = '';
        await loadNutritionFromServer({ silent: false });
    } catch (err) {
        console.warn('Nutrition log failed:', err.message);
    }
}

async function manualNutritionSync() {
    const ok = await loadNutritionFromServer({ silent: false });
    if (!ok) console.warn(`Nutrition sync failed: ${nutritionState.lastError || 'Unknown error'}`);
}

async function resetNutritionLogs() {
    if (!confirm('Clear all nutrition logs?')) return;
    if (!shouldUseNutritionServer()) {
        console.warn('Nutrition reset needs server mode online.');
        return;
    }
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.rows = [];
        nutritionState.todayRows = [];
        nutritionState.totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        renderNutritionView();
    } catch (err) {
        console.warn(`Nutrition reset failed: ${err.message}`);
    }
}

function setNutritionEditing(flag) {
    nutritionState.isEditing = !!flag;
}

function updateNutritionDraft(value) {
    nutritionState.draft = String(value || '');
    nutritionState.isEditing = true;
}

function resetWaterFromNutrition() {
    if (typeof resetWater === 'function') resetWater();
    renderNutritionView();
}