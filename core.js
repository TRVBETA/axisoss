/* ==========================================
   AXIS OS // core.js
   HUD Chronometer, Daily Score Engine, Core Home,
   and Quick Clipboard Bridge
   ========================================== */

const REVOLUTION_RANKS = [
    { level: 1, name: 'RANK I: CIVILIAN // المتمرد', minScoreSum: 0, color: 'var(--text-muted)' },
    { level: 2, name: 'RANK II: VANGUARD // الطليعة', minScoreSum: 500, color: 'var(--hud-cyan)' },
    { level: 3, name: 'RANK III: RADICAL // الراديكالي', minScoreSum: 1200, color: 'var(--hud-violet)' },
    { level: 4, name: 'RANK IV: LIBERATOR // المحرر', minScoreSum: 2500, color: 'var(--hud-optimal)' },
    { level: 5, name: 'RANK V: COMMANDER // القائد', minScoreSum: 4500, color: 'var(--hud-warning)' },
    { level: 6, name: 'RANK VI: ARCHITECT // مهندس الثورة', minScoreSum: 7500, color: '#f43f5e' },
    { level: 7, name: 'RANK VII: SOVEREIGN // السيادة', minScoreSum: 12000, color: '#fff' }
];

let todayTelemetry = {
    gymLogged: localStorage.getItem('axis_today_gym') === 'true',
    gymSplit: localStorage.getItem('axis_today_gym_split') || 'None',
    designHours: parseFloat(localStorage.getItem('axis_today_design')) || 0,
    sleepHours: parseFloat(localStorage.getItem('axis_today_sleep')) || 0,
    waterLiters: parseFloat(localStorage.getItem('axis_today_water')) || 0,
    wentOutside: localStorage.getItem('axis_today_outside') === 'true',
    watchedTutorial: localStorage.getItem('axis_today_tutorial') === 'true',
    lastLoggedTimestamp: parseInt(localStorage.getItem('axis_last_logged_time')) || 0,
    streakCurrent: parseInt(localStorage.getItem('axis_streak_curr')) || 12,
    streakLongest: parseInt(localStorage.getItem('axis_streak_long')) || 24,
    lastBreakDate: localStorage.getItem('axis_streak_break') || '2026-05-01',
    totalHistoricalScore: parseInt(localStorage.getItem('axis_total_score')) || 1420
};

window.axisPendingDailyMutation = false;

let clipboardState = {
    items: JSON.parse(localStorage.getItem('axis_clipboard_items') || '[]'),
    syncMode: 'local',
    lastError: '',
    isEditing: false,
    draft: '',
    modalOpen: false
};

let coreDataState = {
    balance: JSON.parse(localStorage.getItem('axis_core_balance') || 'null') || { id: '', label: 'Main Balance', amount: 0 },
    todos: JSON.parse(localStorage.getItem('axis_core_todos') || '[]'),
    draftBalanceLabel: '',
    draftBalanceAmount: '',
    draftTodo: '',
    draftTodoIsDaily: false,
    draftTodoPoints: 1,
    isEditing: false,
    syncMode: 'local',
    lastError: ''
};

function initCore() {
    init12hClock();
    renderCoreHome();
    computeAndDisplayScore();
    loadDailyFromServer({ silent: true });
    loadClipboardFromServer({ silent: true });
    loadCoreDataFromServer({ silent: true });
}

function init12hClock() {
    const timeEl = document.getElementById('hud-live-clock');
    const dateEl = document.getElementById('hud-live-date');

    function update() {
        const now = new Date();
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        h = String(h).padStart(2, '0');

        if (timeEl) timeEl.textContent = `${h}:${m}:${s} ${ampm}`;

        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        if (dateEl) dateEl.textContent = `${days[now.getDay()]} // ${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    update();
    setInterval(update, 500);
}

function computeDailyScore() {
    let pts = 0;
    if (todayTelemetry.gymLogged) pts += 40;
    if (todayTelemetry.designHours >= 1) pts += 30;
    else if (todayTelemetry.designHours > 0) pts += Math.round(todayTelemetry.designHours * 30);
    if (todayTelemetry.sleepHours > 0) pts += 10;
    pts += Math.min(10, Math.round((todayTelemetry.waterLiters / 4.0) * 10));
    if (todayTelemetry.wentOutside) pts += 5;
    if (todayTelemetry.watchedTutorial) pts += 5;
    return Math.min(100, pts);
}

function getCurrentRank() {
    let total = todayTelemetry.totalHistoricalScore;
    let rank = REVOLUTION_RANKS[0];
    for (const r of REVOLUTION_RANKS) {
        if (total >= r.minScoreSum) rank = r;
        else break;
    }
    return rank;
}

function getLastLoggedString() {
    if (!todayTelemetry.lastLoggedTimestamp) return 'NOTHING LOGGED TODAY';
    const diffMinutes = Math.floor((Date.now() - todayTelemetry.lastLoggedTimestamp) / (1000 * 60));
    if (diffMinutes < 1) return 'LAST LOGGED: JUST NOW';
    if (diffMinutes < 60) return `LAST LOGGED: ${diffMinutes} MINUTES AGO`;
    return `LAST LOGGED: ${Math.floor(diffMinutes / 60)} HOURS AGO`;
}

function renderCoreHome() {
    const container = document.getElementById('module-core');
    if (!container) return;

    const isMobile = window.innerWidth <= 900;
    const score = computeDailyScore();
    const commanderName = localStorage.getItem('axis_commander_name') || 'ALEX MERCER';

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 340px 1fr'}; gap: 32px; align-items: ${isMobile ? 'stretch' : 'center'};">
            <div class="cockpit-card" style="padding: 24px; min-height: 220px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">COMMANDER IDENTIFIER</div>
                <div style="font-size: 2.2rem; font-weight: bold; color: var(--text-main); letter-spacing: 4px; text-transform: uppercase;">${commanderName}</div>
                <div>
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: bold; color: var(--text-main);">SYSTEM READY</div>
                    <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">TOTAL SCORE: ${todayTelemetry.totalHistoricalScore} PTS</div>
                </div>
            </div>

            <div class="cockpit-card" style="padding: 24px; min-height: 220px; align-items: center; justify-content: center; text-align: center; border-color: rgba(255,255,255,0.06); box-shadow: none;">
                <div style="font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em; color: var(--hud-violet);">DAILY SCORE</div>
                <div style="font-family: var(--font-body); font-size: ${isMobile ? '4.2rem' : '5rem'}; font-weight: 700; color: var(--text-main); line-height: 1;">${score}</div>
                <div style="font-family: var(--font-body); font-size: 0.72rem; color: var(--text-muted); letter-spacing: 0.08em;">MAX 100</div>
            </div>

            <div class="cockpit-card" style="padding: 24px; min-height: 220px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); letter-spacing: 2px;">STATUS STRIP</div>
                <div style="display: flex; flex-direction: column; gap: 12px; font-family: var(--font-mono); font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;"><span>GYM:</span><span style="color: ${todayTelemetry.gymLogged ? 'var(--hud-optimal)' : 'var(--text-muted)'}; font-weight: bold;">${todayTelemetry.gymLogged ? '✓ ' + todayTelemetry.gymSplit : 'PENDING'}</span></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><span>DESIGN:</span><span style="color: ${todayTelemetry.designHours >= 1 ? 'var(--hud-optimal)' : (todayTelemetry.designHours > 0 ? 'var(--hud-warning)' : 'var(--text-muted)')}; font-weight: bold;">${todayTelemetry.designHours} HOURS</span></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><span>WATER:</span><span style="color: ${todayTelemetry.waterLiters >= 4 ? 'var(--hud-optimal)' : 'var(--hud-cyan)'}; font-weight: bold;">${todayTelemetry.waterLiters.toFixed(1)} / 4.0 L</span></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;"><span>SLEEP:</span><span style="color: ${todayTelemetry.sleepHours > 0 ? 'var(--hud-optimal)' : 'var(--text-muted)'}; font-weight: bold;">${todayTelemetry.sleepHours > 0 ? todayTelemetry.sleepHours + 'h' : 'NO DATA'}</span></div>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: 6px; font-family: var(--font-body);">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 10px 14px; display: inline-flex; gap: 8px; align-items: baseline;">
                <span style="font-size: 0.72rem; color: var(--text-muted); letter-spacing: 0.08em;">STREAK</span>
                <span style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${todayTelemetry.streakCurrent}</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 10px 14px; display: inline-flex; gap: 8px; align-items: baseline;">
                <span style="font-size: 0.72rem; color: var(--text-muted); letter-spacing: 0.08em;">LONGEST</span>
                <span style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${todayTelemetry.streakLongest}</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 10px 14px; display: inline-flex; gap: 8px; align-items: baseline;">
                <span style="font-size: 0.72rem; color: var(--text-muted); letter-spacing: 0.08em;">LAST BREAK</span>
                <span style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${todayTelemetry.lastBreakDate}</span>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 32px; align-items: start; margin-top: 32px;">
            <div class="cockpit-card" style="padding: 22px; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">BALANCE</div>
                    <div style="font-family: var(--font-mono); font-size: 0.68rem; color: ${coreDataState.syncMode === 'server' ? 'var(--hud-optimal)' : 'var(--text-muted)'};">${coreDataState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}</div>
                </div>
                <form onsubmit="handleBalanceSave(event)" style="display: flex; flex-direction: column; gap: 12px;">
                    <input id="axis-balance-label" class="tactical-input" placeholder="Balance label" value="${escapeHtml(coreDataState.draftBalanceLabel || coreDataState.balance.label || 'Main Balance')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateBalanceDraft('label', this.value)">
                    <input id="axis-balance-amount" type="number" step="0.01" class="tactical-input" placeholder="0" value="${coreDataState.draftBalanceAmount || Number(coreDataState.balance.amount || 0)}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateBalanceDraft('amount', this.value)">
                    <button type="submit" class="tactical-btn" style="padding: 8px 14px; justify-content: center;">SAVE BALANCE</button>
                </form>
                <div style="font-family: var(--font-mono); font-size: 1.8rem; font-weight: bold; color: var(--hud-optimal);">${coreDataState.balance.label || 'Main Balance'}: ${Number(coreDataState.balance.amount || 0).toFixed(2)}</div>
            </div>

            <div class="cockpit-card" style="padding: 22px; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-cyan); font-weight: bold;">TODO</div>
                    <button type="button" class="tactical-btn" style="padding: 6px 10px; font-size: 0.68rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="clearDoneTodos()">CLEAR DONE</button>
                </div>
                <form onsubmit="handleTodoAdd(event)" style="display: flex; flex-direction: column; gap: 12px;">
                    <input id="axis-todo-input" class="tactical-input" style="flex: 1; min-width: 220px;" placeholder="Add a task" value="${escapeHtml(coreDataState.draftTodo || '')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateTodoDraft(this.value)">
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <label style="display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body); font-size: 0.76rem; color: var(--text-muted); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 999px; padding: 10px 12px;">
                            <input type="checkbox" ${coreDataState.draftTodoIsDaily ? 'checked' : ''} onchange="updateTodoDaily(this.checked)"> Daily
                        </label>
                        <label style="display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body); font-size: 0.76rem; color: var(--text-muted); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 999px; padding: 8px 12px;">
                            Points
                            <input type="number" min="1" step="1" value="${Number(coreDataState.draftTodoPoints || 1)}" class="tactical-input" style="width: 72px; padding: 8px 10px;" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateTodoPoints(this.value)">
                        </label>
                        <button type="submit" class="tactical-btn" style="padding: 8px 14px;">ADD</button>
                    </div>
                </form>
                <div style="display: flex; flex-direction: column; gap: 10px;">${renderTodoListHTML()}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 32px; align-items: start; margin-top: 32px;">
            <div class="cockpit-card" style="padding: 22px; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">QUICK CLIPBOARD</div>
                    <div style="font-family: var(--font-mono); font-size: 0.68rem; color: ${clipboardState.syncMode === 'server' ? 'var(--hud-optimal)' : 'var(--text-muted)'};">${clipboardState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}</div>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-main); line-height: 1.6; background: rgba(255,255,255,0.03); padding: 14px; min-height: 96px; white-space: pre-wrap; word-break: break-word;">${clipboardState.items[0] ? escapeHtml(clipboardState.items[0].content) : 'No clipboard items yet.'}</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="tactical-btn" style="padding: 8px 14px;" onclick="openClipboardModal()">OPEN</button>
                    <button type="button" class="tactical-btn" style="padding: 8px 14px; border-color: var(--hud-optimal); color: var(--hud-optimal);" onclick="copyLatestClipboardItem()">COPY LATEST</button>
                </div>
            </div>

            <div class="cockpit-card" style="padding: 24px; gap: 16px;">
                <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); letter-spacing: 2px;">ACTIONS</div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <button class="tactical-btn optimal" onclick="applyDailyQuickAction('gym-quick', { split: 'Quick Mark' })">GYM</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('design-add', { amount: 1 })">+1H DESIGN</button>
                    <button class="tactical-btn cyan" onclick="applyDailyQuickAction('water-add', { amount: 0.6 })">WATER +600ML</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('outside-toggle')">OUTSIDE</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('tutorial-toggle')">TUTORIAL</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('reset-core')" style="border-color: var(--hud-critical); color: var(--hud-critical);">RESET TODAY</button>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); line-height: 1.6; background: rgba(255,255,255,0.03); padding: 12px 14px;">
                    Clipboard endpoint is <strong>/api/clipboard</strong>. Sleep shortcut endpoint is <strong>/api/sleep</strong>. Core actions, balance, and todos now use shared backend state.
                </div>
            </div>
        </div>
        ${renderClipboardModalHTML()}
    `;
}

function renderClipboardModalHTML() {
    if (!clipboardState.modalOpen) return '';
    return `
        <div id="axis-clipboard-modal" onclick="handleClipboardBackdrop(event)" style="position: fixed; inset: 0; z-index: 9997; background: rgba(8,8,8,0.72); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; padding: 24px;">
            <div class="cockpit-card" style="width: min(920px, 96vw); max-height: 88vh; overflow: auto; padding: 24px; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">CLIPBOARD</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="tactical-btn" style="padding: 8px 14px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="closeClipboardModal()">CLOSE</button>
                    </div>
                </div>
                <form onsubmit="handleClipboardSave(event)" style="display: flex; flex-direction: column; gap: 12px;">
                    <textarea id="axis-clipboard-input" class="tactical-input" rows="6" placeholder="Paste fast notes or TTS text here..." style="resize: vertical; line-height: 1.6;" onfocus="setClipboardEditing(true)" onblur="setClipboardEditing(false)" oninput="updateClipboardDraft(this.value)">${escapeHtml(clipboardState.draft || '')}</textarea>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="submit" class="tactical-btn" style="padding: 8px 14px;">SAVE</button>
                        <button type="button" class="tactical-btn" style="padding: 8px 14px; border-color: var(--hud-optimal); color: var(--hud-optimal);" onclick="copyLatestClipboardItem()">COPY LATEST</button>
                        <button type="button" class="tactical-btn" style="padding: 8px 14px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="resetClipboardItems()">CLEAR</button>
                    </div>
                </form>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">${renderClipboardHistoryHTML()}</div>
            </div>
        </div>
    `;
}

function renderTodoListHTML() {
    if (!coreDataState.todos.length) {
        return `<div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 12px;">No tasks yet.</div>`;
    }
    return coreDataState.todos.slice(0, 8).map(todo => `
        <div style="background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 12px 14px; font-family: var(--font-body); display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center;">
            <input type="checkbox" ${todo.is_done ? 'checked' : ''} onchange="toggleTodoItem('${todo.id}', this.checked)">
            <div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;">
                <div style="font-size: 0.84rem; color: ${todo.is_done ? 'var(--text-muted)' : 'var(--text-main)'}; text-decoration: ${todo.is_done ? 'line-through' : 'none'};">${escapeHtml(todo.title)}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    ${todo.is_daily ? `<span style="font-size: 0.64rem; color: var(--hud-violet); background: rgba(224,140,43,0.12); border: 1px solid rgba(224,140,43,0.18); border-radius: 999px; padding: 4px 8px;">DAILY</span>` : ''}
                    <span style="font-size: 0.64rem; color: var(--text-muted); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 999px; padding: 4px 8px;">${Number(todo.points || 1)} PTS</span>
                </div>
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="deleteTodoItem('${todo.id}')">DEL</button>
        </div>
    `).join('');
}

function renderClipboardHistoryHTML() {
    if (!clipboardState.items.length) {
        return `<div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 12px;">Clipboard empty.</div>`;
    }
    return clipboardState.items.slice(0, 6).map(item => `
        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--hud-cyan); padding: 10px 12px; font-family: var(--font-mono); display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: start;">
            <div style="min-width: 0;">
                <div style="font-size: 0.78rem; color: var(--text-main); line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeHtml(item.content)}</div>
                <div style="font-size: 0.66rem; color: var(--text-muted); margin-top: 6px;">${item.source || 'axis'} • ${formatClipboardTime(item.created_at || item.timestamp)}</div>
            </div>
            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.64rem;" onclick="copyClipboardByIndex(${item.__idx})">COPY</button>
            <button class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="deleteClipboardItem('${item.id}')">DEL</button>
        </div>
    `).join('');
}

function shouldUseClipboardServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

function shouldUseDailyServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadDailyFromServer({ silent = false } = {}) {
    if (!shouldUseDailyServer()) return false;
    try {
        const resp = await fetch('/api/daily', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        const row = data.row || {};
        todayTelemetry.gymLogged = !!row.gym_logged;
        todayTelemetry.gymSplit = row.gym_split_name || 'None';
        todayTelemetry.designHours = Number(row.design_hours || 0);
        todayTelemetry.sleepHours = Number(row.sleep_hours || 0);
        todayTelemetry.waterLiters = Number(row.water_liters || 0);
        todayTelemetry.wentOutside = !!row.went_outside;
        todayTelemetry.watchedTutorial = !!row.watched_tutorial;
        todayTelemetry.lastLoggedTimestamp = Date.now();
        localStorage.setItem('axis_today_gym', todayTelemetry.gymLogged ? 'true' : 'false');
        localStorage.setItem('axis_today_gym_split', todayTelemetry.gymSplit);
        localStorage.setItem('axis_today_design', todayTelemetry.designHours);
        localStorage.setItem('axis_today_sleep', todayTelemetry.sleepHours);
        localStorage.setItem('axis_today_water', todayTelemetry.waterLiters);
        localStorage.setItem('axis_today_outside', todayTelemetry.wentOutside ? 'true' : 'false');
        localStorage.setItem('axis_today_tutorial', todayTelemetry.watchedTutorial ? 'true' : 'false');
        if (!(silent && coreEditingActive())) renderCoreHome();
        return true;
    } catch {
        return false;
    }
}

function applyLocalDailyAction(action, payload = {}) {
    switch (action) {
        case 'gym-quick':
            todayTelemetry.gymLogged = true;
            todayTelemetry.gymSplit = payload.split || 'Quick Mark';
            break;
        case 'design-add':
            todayTelemetry.designHours = Number(todayTelemetry.designHours || 0) + Number(payload.amount || 1);
            break;
        case 'water-add':
            todayTelemetry.waterLiters = Number((Number(todayTelemetry.waterLiters || 0) + Number(payload.amount || 0.6)).toFixed(1));
            break;
        case 'outside-toggle':
            todayTelemetry.wentOutside = !todayTelemetry.wentOutside;
            break;
        case 'tutorial-toggle':
            todayTelemetry.watchedTutorial = !todayTelemetry.watchedTutorial;
            break;
        case 'reset-core':
            todayTelemetry.gymLogged = false;
            todayTelemetry.gymSplit = 'None';
            todayTelemetry.designHours = 0;
            todayTelemetry.sleepHours = 0;
            todayTelemetry.waterLiters = 0;
            todayTelemetry.wentOutside = false;
            todayTelemetry.watchedTutorial = false;
            break;
    }
}

async function applyDailyQuickAction(action, payload = {}) {
    if (!shouldUseDailyServer()) {
        console.warn('Daily actions need server connection online.');
        return;
    }
    window.axisPendingDailyMutation = true;
    applyLocalDailyAction(action, payload);
    renderCoreHome();
    if (typeof renderNutritionView === 'function') renderNutritionView();
    try {
        const resp = await fetch('/api/daily', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        await loadDailyFromServer({ silent: false });
        if (typeof renderNutritionView === 'function') renderNutritionView();
        if (typeof renderFitnessView === 'function') renderFitnessView();
    } catch (e) {
        await loadDailyFromServer({ silent: false });
        console.warn(`Daily action failed: ${e.message}`);
    } finally {
        window.axisPendingDailyMutation = false;
    }
}

async function loadClipboardFromServer({ silent = false } = {}) {
    if (!shouldUseClipboardServer()) return false;
    try {
        const resp = await fetch('/api/clipboard', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        clipboardState.items = (data.rows || []).map((row, idx) => ({ ...row, __idx: idx }));
        localStorage.setItem('axis_clipboard_items', JSON.stringify(clipboardState.items));
        clipboardState.syncMode = 'server';
        clipboardState.lastError = '';
        if (!(silent && coreEditingActive())) renderCoreHome();
        return true;
    } catch (e) {
        clipboardState.syncMode = 'local';
        clipboardState.lastError = e.message || 'FAILED TO LOAD CLIPBOARD';
        return false;
    }
}

function openClipboardModal() {
    clipboardState.modalOpen = true;
    renderCoreHome();
}

function closeClipboardModal() {
    clipboardState.modalOpen = false;
    clipboardState.isEditing = false;
    renderCoreHome();
}

function handleClipboardBackdrop(e) {
    if (e.target?.id === 'axis-clipboard-modal') closeClipboardModal();
}

async function handleClipboardSave(e) {
    e.preventDefault();
    const input = document.getElementById('axis-clipboard-input');
    const content = String(input?.value || '').trim();
    if (!content) return;

    const saved = await saveClipboardItem(content, 'axis_web');
    if (!saved) {
        console.warn(`Clipboard save failed: ${clipboardState.lastError || 'Unknown error'}`);
        return;
    }
    clipboardState.draft = '';
    if (input) input.value = '';
    if (typeof refreshCoreView === 'function') refreshCoreView();
}

async function saveClipboardItem(content, source = 'axis_web') {
    if (shouldUseClipboardServer()) {
        try {
            const resp = await fetch('/api/clipboard', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, source })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            await loadClipboardFromServer({ silent: false });
            return true;
        } catch (e) {
            clipboardState.syncMode = 'local';
            clipboardState.lastError = e.message || 'FAILED TO SAVE CLIPBOARD';
        }
    }

    const item = {
        id: 'local-' + Date.now(),
        content,
        source,
        created_at: new Date().toISOString()
    };
    clipboardState.items.unshift(item);
    clipboardState.items = clipboardState.items.slice(0, 20).map((row, idx) => ({ ...row, __idx: idx }));
    localStorage.setItem('axis_clipboard_items', JSON.stringify(clipboardState.items));
    renderCoreHome();
    return true;
}

async function manualClipboardSync() {
    const ok = await loadClipboardFromServer({ silent: false });
    if (!ok) console.warn(`Clipboard sync failed: ${clipboardState.lastError || 'Unknown error'}`);
}

async function deleteClipboardItem(id) {
    try {
        const resp = await fetch('/api/clipboard', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        clipboardState.items = clipboardState.items.filter(item => item.id !== id).map((row, idx) => ({ ...row, __idx: idx }));
        renderCoreHome();
    } catch (e) {
        console.warn(`Clipboard delete failed: ${e.message}`);
    }
}

async function resetClipboardItems() {
    if (!confirm('Clear clipboard memory?')) return;

    if (shouldUseClipboardServer()) {
        try {
            const resp = await fetch('/api/clipboard', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset' })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        } catch (e) {
            console.warn(`Clipboard clear failed: ${e.message}`);
            return;
        }
    }

    clipboardState.items = [];
    localStorage.setItem('axis_clipboard_items', JSON.stringify([]));
    renderCoreHome();
}

async function loadCoreDataFromServer({ silent = false } = {}) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return false;
    try {
        const resp = await fetch('/api/coredata', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.balance = data.balance || coreDataState.balance;
        coreDataState.todos = data.todos || [];
        coreDataState.syncMode = 'server';
        coreDataState.lastError = '';
        localStorage.setItem('axis_core_balance', JSON.stringify(coreDataState.balance));
        localStorage.setItem('axis_core_todos', JSON.stringify(coreDataState.todos));
        if (!(silent && coreEditingActive())) renderCoreHome();
        return true;
    } catch (e) {
        coreDataState.syncMode = 'local';
        coreDataState.lastError = e.message || 'FAILED TO LOAD CORE DATA';
        return false;
    }
}

async function handleBalanceSave(e) {
    e.preventDefault();
    const label = String(coreDataState.draftBalanceLabel || coreDataState.balance.label || 'Main Balance').trim() || 'Main Balance';
    const amount = Number(coreDataState.draftBalanceAmount || coreDataState.balance.amount || 0);
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Core balance needs server connection online.');
        return;
    }
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'balance', id: coreDataState.balance.id, label, amount })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.balance = data.row || coreDataState.balance;
        coreDataState.draftBalanceLabel = '';
        coreDataState.draftBalanceAmount = '';
        coreDataState.isEditing = false;
        renderCoreHome();
    } catch (e) {
        console.warn(`Balance save failed: ${e.message}`);
    }
}

async function handleTodoAdd(e) {
    e.preventDefault();
    const title = String(coreDataState.draftTodo || '').trim();
    if (!title) return;
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-add', title, isDaily: coreDataState.draftTodoIsDaily, points: coreDataState.draftTodoPoints })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos.unshift(data.row);
        coreDataState.draftTodo = '';
        coreDataState.draftTodoIsDaily = false;
        coreDataState.draftTodoPoints = 1;
        coreDataState.isEditing = false;
        renderCoreHome();
    } catch (e) {
        console.warn(`Todo add failed: ${e.message}`);
    }
}

async function toggleTodoItem(id, isDone) {
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-toggle', id, isDone })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos = coreDataState.todos.map(todo => todo.id === id ? { ...todo, is_done: !!isDone } : todo);
        renderCoreHome();
    } catch (e) {
        console.warn(`Todo update failed: ${e.message}`);
    }
}

async function deleteTodoItem(id) {
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos = coreDataState.todos.filter(todo => todo.id !== id);
        renderCoreHome();
    } catch (e) {
        console.warn(`Todo delete failed: ${e.message}`);
    }
}

async function clearDoneTodos() {
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-clear-done' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos = coreDataState.todos.filter(todo => !todo.is_done);
        renderCoreHome();
    } catch (e) {
        console.warn(`Todo clear failed: ${e.message}`);
    }
}

async function copyLatestClipboardItem() {
    if (!clipboardState.items.length) return;
    await copyTextToClipboard(clipboardState.items[0].content);
}

async function copyClipboardByIndex(index) {
    const item = clipboardState.items[index];
    if (!item) return;
    await copyTextToClipboard(item.content);
}

async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
    }
}

function formatClipboardTime(value) {
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${h}:${m}`;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setClipboardEditing(flag) {
    clipboardState.isEditing = !!flag;
}

function updateClipboardDraft(value) {
    clipboardState.draft = String(value || '');
    clipboardState.isEditing = true;
}

function setCoreDataEditing(flag) {
    coreDataState.isEditing = !!flag;
}

function updateBalanceDraft(type, value) {
    coreDataState.isEditing = true;
    if (type === 'label') coreDataState.draftBalanceLabel = String(value || '');
    if (type === 'amount') coreDataState.draftBalanceAmount = String(value || '');
}

function updateTodoDraft(value) {
    coreDataState.isEditing = true;
    coreDataState.draftTodo = String(value || '');
}

function updateTodoDaily(value) {
    coreDataState.isEditing = true;
    coreDataState.draftTodoIsDaily = !!value;
}

function updateTodoPoints(value) {
    coreDataState.isEditing = true;
    coreDataState.draftTodoPoints = Math.max(1, parseInt(value || 1, 10) || 1);
}

function computeAndDisplayScore() {
    renderCoreHome();
}

function coreEditingActive() {
    const coreEl = document.getElementById('module-core');
    const activeCore = coreEl?.classList.contains('active');
    if (!activeCore) return false;
    if (clipboardState.isEditing || coreDataState.isEditing) return true;
    const el = document.activeElement;
    if (!el) return false;
    return coreEl?.contains(el) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function refreshCoreView() {
    if (coreEditingActive()) return;
    renderCoreHome();
}

function injectQuickTelemetry(type) {
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);

    if (type === 'gym') {
        todayTelemetry.gymLogged = true;
        todayTelemetry.gymSplit = 'Chest + Back';
        localStorage.setItem('axis_today_gym', 'true');
        localStorage.setItem('axis_today_gym_split', 'Chest + Back');
    } else if (type === 'design') {
        todayTelemetry.designHours = Math.min(10, todayTelemetry.designHours + 2);
        localStorage.setItem('axis_today_design', todayTelemetry.designHours);
    } else if (type === 'water') {
        todayTelemetry.waterLiters = parseFloat((todayTelemetry.waterLiters + 0.6).toFixed(1));
        localStorage.setItem('axis_today_water', todayTelemetry.waterLiters);
        if (typeof refreshFitnessWater === 'function') refreshFitnessWater();
        if (typeof renderNutritionView === 'function') renderNutritionView();
    } else if (type === 'outside') {
        todayTelemetry.wentOutside = true;
        localStorage.setItem('axis_today_outside', 'true');
    } else if (type === 'reset') {
        todayTelemetry.gymLogged = false;
        todayTelemetry.gymSplit = 'None';
        todayTelemetry.designHours = 0;
        todayTelemetry.waterLiters = 0;
        todayTelemetry.sleepHours = 0;
        todayTelemetry.wentOutside = false;
        todayTelemetry.watchedTutorial = false;
        todayTelemetry.lastLoggedTimestamp = 0;
        localStorage.clear();
    }

    renderCoreHome();
}