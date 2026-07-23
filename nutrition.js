/* ------------------------------------------
   AXIS OS // nutrition.js
   Nutrition + hydration server integration
   ------------------------------------------ */

let nutritionState = {
    rows: [],
    todayRows: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    targets: { calories: 2650, protein: 140, carbs: 330, fat: 70 },
    syncMode: 'local',
    lastError: '',
    isEditing: false,
    draft: '',
    defaultMode: localStorage.getItem('axis_nutrition_default_mode') || 'cooked',
    latestBatch: null,
    editingBatchLoggedAt: null,
    customFoods: [],
    mealTemplates: [],
    draftTemplateName: '',
    customFoodDraft: {
        name: '',
        aliases: '',
        calories_per_100g: '',
        protein_per_100g: '',
        carbs_per_100g: '',
        fat_per_100g: '',
        grams_per_piece: ''
    }
};

function initNutrition() {
    renderNutritionView();
    loadNutritionFromServer({ silent: true });
}

function renderNutritionView() {
    const container = document.getElementById('module-nutrition');
    if (!container) return;

    const waterLiters = typeof todayTelemetry !== 'undefined' ? todayTelemetry.waterLiters : 0;
    const waterTaps = Math.min(7, Math.floor(waterLiters / 0.6));

    container.innerHTML = `
        <div class="cockpit-header">
            <span>NUTRITION</span>
            <span class="text-sm text-muted">${nutritionState.syncMode === 'server' ? 'SERVER SYNC' : 'LOCAL / STANDBY'}</span>
        </div>

        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; grid-template-columns: 0.95fr 1.05fr; align-items: start;">
            <div class="stack" style="gap: 20px;">
                <div class="cockpit-card stack" style="padding: 20px;">
                    <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                        <div class="font-mono font-bold text-accent">FOOD LOG</div>
                        <div class="row flex-wrap" style="gap: 8px;">
                            <button class="tactical-btn" type="button" style="padding: 6px 12px; font-size: 0.68rem;" onclick="loadLatestNutritionIntoEditor()">LOAD LAST</button>
                            <button class="tactical-btn" type="button" style="padding: 6px 12px; font-size: 0.68rem;" onclick="undoLastNutritionBatch()">UNDO LAST</button>
                            ${nutritionState.editingBatchLoggedAt ? `<button class="tactical-btn" type="button" style="padding: 6px 12px; font-size: 0.68rem;" onclick="cancelNutritionBatchEdit()">CANCEL EDIT</button>` : ``}
                            <button class="tactical-btn" type="button" style="padding: 6px 12px; font-size: 0.68rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="resetNutritionLogs()">CLEAR</button>
                        </div>
                    </div>

                    ${nutritionState.editingBatchLoggedAt ? `<div class="badge badge-accent">EDITING LAST BATCH</div>` : ``}

                    <form onsubmit="handleNutritionLog(event)" class="stack" style="gap: 14px;">
                        <textarea id="nutrition-text-input" class="tactical-input w-full" rows="5" placeholder="Examples:\n400g rice, 200g chicken breast\n5 eggs\n250ml milk\n2 tsp sugar\n3 eggs + 2 bread + 20g cheese" style="resize: vertical; line-height: 1.6;" onfocus="setNutritionEditing(true)" onblur="setNutritionEditing(false)" oninput="updateNutritionDraft(this.value)">${nutritionState.draft || ''}</textarea>
                        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px; align-items: end;">
                            <div class="stack stack-sm">
                                <label class="form-label">Food mode</label>
                                <select id="nutrition-mode-select" class="tactical-select" onfocus="setNutritionEditing(true)" onblur="setNutritionEditing(false)" onchange="updateNutritionDefaultMode(this.value)">
                                    <option value="cooked" ${nutritionState.defaultMode === 'cooked' ? 'selected' : ''}>Cooked default</option>
                                    <option value="raw" ${nutritionState.defaultMode === 'raw' ? 'selected' : ''}>Raw default</option>
                                </select>
                            </div>
                            <button type="submit" class="tactical-btn w-full text-center">${nutritionState.editingBatchLoggedAt ? 'SAVE EDIT' : 'LOG FOOD'}</button>
                        </div>
                    </form>

                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px; align-items: end;">
                        <div class="stack stack-sm">
                            <label class="form-label">Template name</label>
                            <input id="nutrition-template-name" class="tactical-input" placeholder="Example: Omelette" value="${escapeNutritionHtml(nutritionState.draftTemplateName)}" onfocus="setNutritionEditing(true)" onblur="setNutritionEditing(false)" oninput="updateNutritionTemplateNameDraft(this.value)">
                        </div>
                        <button class="tactical-btn w-full" type="button" onclick="saveCurrentNutritionAsTemplate()">SAVE AS TEMPLATE</button>
                    </div>

                    <div class="font-mono text-sm text-muted" style="line-height: 1.6; background: rgba(255,255,255,0.03); padding: 12px 14px;">
                        Primary source: MyFitnessPal via Apple Health. Manual entry here is the fallback. Default is cooked unless you explicitly switch to raw.
                        ${renderNutritionShortcutInstallLink()}
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 20px;">
                    <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                        <div class="font-mono font-bold text-cyan">MEAL TEMPLATES</div>
                        <span class="text-sm text-muted">FAST REUSE</span>
                    </div>
                    <div class="stack" style="gap: 10px;">${renderMealTemplatesHTML()}</div>
                </div>

                <div class="cockpit-card stack" style="padding: 20px;">
                    <div class="row flex-wrap font-mono font-bold text-cyan" style="justify-content: space-between; gap: 12px;">
                        <span>HYDRATION</span>
                        <span class="text-sm text-muted">600ML • GOAL 4.0L</span>
                    </div>

                    <div class="font-mono font-bold text-main" style="font-size: 1.3rem;">
                        ${waterLiters.toFixed(1)} L / 4.0 L
                    </div>

                    <div class="row flex-wrap" style="gap: 12px; margin-bottom: 8px;">
                        ${typeof renderWaterCartridgesHTML === 'function' ? renderWaterCartridgesHTML(waterTaps) : ''}
                    </div>

                    <div class="row font-mono text-sm text-muted" style="justify-content: space-between;">
                        <span>TAP TO UPDATE WATER</span>
                        <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.68rem;" onclick="resetWaterFromNutrition()">RESET</button>
                    </div>
                </div>
            </div>

            <div class="stack" style="gap: 20px;">
                <div class="cockpit-card stack" style="padding: 20px;">
                    <div class="font-mono font-bold text-optimal">TODAY SUMMARY</div>
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 14px;">
                        ${renderNutritionMetricCard('Calories', nutritionState.totals.calories, nutritionState.targets.calories, 'kcal', 'var(--hud-violet)')}
                        ${renderNutritionMetricCard('Protein', nutritionState.totals.protein, nutritionState.targets.protein, 'g', 'var(--hud-optimal)')}
                        ${renderNutritionMetricCard('Carbs', nutritionState.totals.carbs, nutritionState.targets.carbs, 'g', 'var(--hud-cyan)')}
                        ${renderNutritionMetricCard('Fat', nutritionState.totals.fat, nutritionState.targets.fat, 'g', 'var(--hud-warning)')}
                    </div>
                </div>

                <div class="cockpit-card stack" style="padding: 20px;">
                    <div class="font-mono font-bold text-main">RECENT ENTRIES</div>
                    <div class="stack" style="gap: 10px;">
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
        <div class="stack cockpit-card-flat" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 14px; gap: 8px; border-radius: 18px;">
            <div class="font-mono text-sm text-muted">${label}</div>
            <div class="font-mono font-bold" style="font-size: 1.2rem; color: ${color};">${Math.round(value)} / ${target} ${unit}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${pct}%; background: ${color};"></div>
            </div>
        </div>
    `;
}

function nutritionSourceBadge(source) {
    const s = String(source || '').toLowerCase();
    if (!s) return '';
    if (s.includes('apple_health') || s.includes('myfitnesspal') || s.includes('healthkit')) {
        return `<span class="badge" style="font-size: 0.58rem; padding: 3px 7px; min-height: 22px; background: rgba(151, 181, 137, 0.12); border: 1px solid rgba(151, 181, 137, 0.22); color: var(--hud-optimal); letter-spacing: 0.08em;">MFP</span>`;
    }
    if (s.startsWith('usda')) {
        return `<span class="badge" style="font-size: 0.58rem; padding: 3px 7px; min-height: 22px; background: rgba(184, 190, 200, 0.10); border: 1px solid rgba(184, 190, 200, 0.18); color: var(--hud-cyan); letter-spacing: 0.08em;">USDA</span>`;
    }
    if (s.startsWith('custom')) {
        return `<span class="badge" style="font-size: 0.58rem; padding: 3px 7px; min-height: 22px; background: rgba(215, 154, 82, 0.10); border: 1px solid rgba(215, 154, 82, 0.20); color: var(--hud-warning); letter-spacing: 0.08em;">CUSTOM</span>`;
    }
    if (s.startsWith('db')) {
        return `<span class="badge" style="font-size: 0.58rem; padding: 3px 7px; min-height: 22px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.10); color: var(--text-muted); letter-spacing: 0.08em;">LOCAL</span>`;
    }
    return '';
}

// Inline link to install the iOS Shortcut.
//
// Why this is shown on ALL devices, not just iOS:
// The user is often on the desktop when reading the setup or pushing
// the slice. If the link only renders on iOS, they have no way to
// confirm the file is deployed and reachable. Showing the link
// everywhere gives the user a single, stable affordance they can find
// from any device, then tap on the iPhone to import.
//
// Behavior on tap:
//   iPhone/iPad: shortcuts://import-shortcut?url=... opens Shortcuts
//                and shows the iOS import sheet.
//   Desktop/other: falls through to the raw .shortcut URL via the
//                  same <a> href, which the browser downloads. The
//                  user can Airdrop/email that to the iPhone.
function renderNutritionShortcutInstallLink() {
    if (typeof window === 'undefined') return '';
    const origin = window.location?.origin || '';
    if (!origin) return '';
    const installed = localStorage.getItem('axis_ios_shortcut_installed') === '1';
    if (installed) {
        return `<div style="margin-top: 10px; font-size: 0.7rem; letter-spacing: 0.08em; opacity: 0.7;">iOS Shortcut installed. Run it from Shortcuts to sync.</div>`;
    }
    const url = origin + '/AXIS_sync_nutrition.shortcut';
    // Use a plain anchor with the raw .shortcut URL as href so it
    // works on every device (iOS deep link is a JS fallback).
    return `<div style="margin-top: 10px; font-size: 0.7rem; letter-spacing: 0.08em; line-height: 1.6;"><a id="axis-ios-shortcut-link" href="${url}" onclick="try{localStorage.setItem('axis_ios_shortcut_installed','1');}catch(e){}" style="color: var(--hud-cyan); text-decoration: underline;">Install iOS Shortcut</a> <span style="opacity: 0.6;">— tap on iPhone to import. ${url}</span></div>`;
}

function renderNutritionRowsHTML() {
    if (!nutritionState.rows.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">No nutrition entries yet.</div>`;
    }
    return nutritionState.rows.slice(0, 10).map(row => {
        const badge = nutritionSourceBadge(row.source);
        return `
        <div class="list-item" style="align-items: flex-start; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                    <div class="text-base font-bold text-main">${escapeNutritionHtml(row.description)}</div>
                    ${badge}
                </div>
                <div class="text-sm text-muted">${row.quantity} ${row.unit} • ${formatNutritionTime(row.logged_at)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">P ${Math.round(Number(row.protein || 0))}g • C ${Math.round(Number(row.carbs || 0))}g • F ${Math.round(Number(row.fat || 0))}g</div>
            </div>
            <div class="stack" style="gap: 8px; align-items: flex-end;">
                <div class="text-right text-sm text-optimal font-bold flex-shrink-0">${Math.round(row.calories)} kcal</div>
                <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem;" onclick="deleteNutritionRowItem('${row.id}')">DEL</button>
            </div>
        </div>
    `;
    }).join('');
}

function renderMealTemplatesHTML() {
    if (!nutritionState.mealTemplates.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px;">No templates yet.</div>`;
    }
    return nutritionState.mealTemplates.map(template => `
        <div class="list-item" style="align-items: flex-start; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="font-mono text-sm font-bold text-main">${escapeNutritionHtml(template.name)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px; white-space: pre-wrap;">${escapeNutritionHtml(template.body_text || '')}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">MODE: ${(template.default_mode || 'auto').toUpperCase()}</div>
            </div>
            <div class="stack" style="gap: 6px;">
                <button class="tactical-btn" type="button" style="padding: 4px 8px; font-size: 0.62rem;" onclick="useNutritionMealTemplate('${template.id}')">USE</button>
                <button class="tactical-btn" type="button" style="padding: 4px 8px; font-size: 0.62rem;" onclick="deleteNutritionMealTemplateItem('${template.id}')">DEL</button>
            </div>
        </div>
    `).join('');
}

function renderCustomFoodsHTML() {
    if (!nutritionState.customFoods.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px;">No custom foods yet.</div>`;
    }
    return nutritionState.customFoods.map(food => `
        <div class="list-item" style="align-items: flex-start; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="font-mono text-sm font-bold text-main">${escapeNutritionHtml(food.name)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">${Math.round(Number(food.calories_per_100g || 0))} kcal • ${Number(food.protein_per_100g || 0)}p • ${Number(food.carbs_per_100g || 0)}c • ${Number(food.fat_per_100g || 0)}f / 100g</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">ALIASES: ${escapeNutritionHtml(food.aliases?.join(', ') || '—')}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">GRAMS / PIECE: ${food.grams_per_piece ?? '—'}</div>
            </div>
            <button class="tactical-btn" type="button" style="padding: 4px 8px; font-size: 0.62rem;" onclick="deleteNutritionCustomFoodItem('${food.id}')">DEL</button>
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
        nutritionState.customFoods = data.customFoods || [];
        nutritionState.mealTemplates = data.mealTemplates || [];
        nutritionState.latestBatch = data.latestBatch || null;
        nutritionState.syncMode = 'server';
        nutritionState.lastError = '';
        if (!(silent && nutritionState.isEditing)) {
            if (typeof loadDailyFromServer === 'function') await loadDailyFromServer({ silent: true });
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
            body: JSON.stringify({
                action: nutritionState.editingBatchLoggedAt ? 'replace-last' : '',
                text,
                mode: nutritionState.defaultMode || 'auto'
            })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.draft = '';
        nutritionState.isEditing = false;
        nutritionState.editingBatchLoggedAt = null;
        if (input) input.value = '';
        await loadNutritionFromServer({ silent: false });
        if (typeof loadDailyFromServer === 'function') await loadDailyFromServer({ silent: true });
        if (typeof refreshCoreView === 'function') refreshCoreView();
    } catch (err) {
        console.warn('Nutrition log failed:', err.message);
    }
}

async function deleteNutritionRowItem(id) {
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-row', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.rows = nutritionState.rows.filter(row => row.id !== id);
        nutritionState.todayRows = nutritionState.todayRows.filter(row => row.id !== id);
        nutritionState.totals = nutritionState.todayRows.reduce((acc, row) => {
            acc.calories += Number(row.calories || 0);
            acc.protein += Number(row.protein || 0);
            acc.carbs += Number(row.carbs || 0);
            acc.fat += Number(row.fat || 0);
            return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
        if (typeof loadDailyFromServer === 'function') await loadDailyFromServer({ silent: true });
        renderNutritionView();
    } catch (e) {
        console.warn(`Delete nutrition row failed: ${e.message}`);
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
        nutritionState.latestBatch = null;
        nutritionState.editingBatchLoggedAt = null;
        renderNutritionView();
    } catch (err) {
        console.warn(`Nutrition reset failed: ${err.message}`);
    }
}

async function loadLatestNutritionIntoEditor() {
    if (!nutritionState.latestBatch?.draftText) {
        await loadNutritionFromServer({ silent: false });
    }
    const latest = nutritionState.latestBatch;
    if (!latest?.draftText) {
        console.warn('No latest nutrition batch to load.');
        return;
    }
    nutritionState.draft = latest.draftText;
    nutritionState.editingBatchLoggedAt = latest.loggedAt;
    renderNutritionView();
}

async function undoLastNutritionBatch() {
    if (!shouldUseNutritionServer()) {
        console.warn('Undo last nutrition batch needs server connection online.');
        return;
    }
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'undo-last' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.editingBatchLoggedAt = null;
        await loadNutritionFromServer({ silent: false });
        if (typeof loadDailyFromServer === 'function') await loadDailyFromServer({ silent: true });
        if (typeof refreshCoreView === 'function') refreshCoreView();
    } catch (e) {
        console.warn(`Undo last nutrition batch failed: ${e.message}`);
    }
}

function cancelNutritionBatchEdit() {
    nutritionState.editingBatchLoggedAt = null;
    nutritionState.draft = '';
    renderNutritionView();
}

async function saveCurrentNutritionAsTemplate() {
    const bodyText = String(nutritionState.draft || '').trim();
    const name = String(nutritionState.draftTemplateName || '').trim();
    if (!bodyText || !name) return;
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-template', name, bodyText, defaultMode: nutritionState.defaultMode })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.draftTemplateName = '';
        await loadNutritionFromServer({ silent: false });
    } catch (e) {
        console.warn(`Save nutrition template failed: ${e.message}`);
    }
}

function useNutritionMealTemplate(id) {
    const template = (nutritionState.mealTemplates || []).find(item => item.id === id);
    if (!template) return;
    nutritionState.draft = String(template.body_text || '');
    nutritionState.defaultMode = String(template.default_mode || 'auto');
    localStorage.setItem('axis_nutrition_default_mode', nutritionState.defaultMode);
    renderNutritionView();
}

async function deleteNutritionMealTemplateItem(id) {
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-template', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        await loadNutritionFromServer({ silent: false });
    } catch (e) {
        console.warn(`Delete nutrition template failed: ${e.message}`);
    }
}

async function saveNutritionCustomFood() {
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-custom-food', ...nutritionState.customFoodDraft })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        nutritionState.customFoodDraft = {
            name: '', aliases: '', calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '', grams_per_piece: ''
        };
        await loadNutritionFromServer({ silent: false });
    } catch (e) {
        console.warn(`Save custom food failed: ${e.message}`);
    }
}

async function deleteNutritionCustomFoodItem(id) {
    try {
        const resp = await fetch('/api/nutrition', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-custom-food', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        await loadNutritionFromServer({ silent: false });
    } catch (e) {
        console.warn(`Delete custom food failed: ${e.message}`);
    }
}

function setNutritionEditing(flag) {
    nutritionState.isEditing = !!flag;
}

function updateNutritionDraft(value) {
    nutritionState.draft = String(value || '');
    nutritionState.isEditing = true;
}

function updateNutritionDefaultMode(value) {
    nutritionState.defaultMode = String(value || 'auto');
    localStorage.setItem('axis_nutrition_default_mode', nutritionState.defaultMode);
    nutritionState.isEditing = true;
}

function updateNutritionTemplateNameDraft(value) {
    nutritionState.draftTemplateName = String(value || '');
    nutritionState.isEditing = true;
}

function updateCustomFoodDraftField(field, value) {
    nutritionState.customFoodDraft[field] = String(value || '');
    nutritionState.isEditing = true;
}

function resetWaterFromNutrition() {
    if (typeof resetWater === 'function') resetWater();
    renderNutritionView();
}

function escapeNutritionHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
