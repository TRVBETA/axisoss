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
window.axisPendingCoreMutation = false;

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
    markers: JSON.parse(localStorage.getItem('axis_core_markers') || '[]'),
    review: null,
    draftBalanceLabel: '',
    draftBalanceAmount: '',
    draftTodo: '',
    draftTodoIsDaily: false,
    draftTodoPoints: 1,
    draftMarkerTitle: '',
    draftMarkerDate: '',
    draftMarkerType: 'deadline',
    draftMarkerNote: '',
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
        updateHudAgeChip();
    }

    update();
    setInterval(update, 500);
}

function getAxisBirthdayValue() {
    return String(localStorage.getItem('axis_birthday') || '').trim();
}

function calculateAxisAgeParts(birthdayValue) {
    const value = String(birthdayValue || '').trim();
    if (!value) return null;
    const birth = new Date(`${value}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;

    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
        months -= 1;
        const previousMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        days += previousMonthDays;
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years < 0) return null;
    return { years, months, days };
}

function updateHudAgeChip() {
    const chip = document.getElementById('hud-age-chip');
    if (!chip) return;
    const parts = calculateAxisAgeParts(getAxisBirthdayValue());
    if (!parts) {
        chip.textContent = 'AGE • SET IN CONFIG';
        return;
    }
    chip.textContent = `AGE • ${parts.years}Y ${parts.months}M ${parts.days}D`;
}

function currentAxisDayKeyClient() {
    const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayTodoPoints() {
    const key = currentAxisDayKeyClient();
    return (coreDataState.todos || []).reduce((sum, todo) => {
        if (todo.is_done && todo.completed_day_key === key) {
            return sum + Number(todo.points || 1);
        }
        return sum;
    }, 0);
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
    pts += getTodayTodoPoints();
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

    const score = computeDailyScore();
    const commanderName = localStorage.getItem('axis_commander_name') || 'AXIS';
    const currentRank = getCurrentRank();
    const rankLabel = String(currentRank.name || 'RANK').split('//')[0].trim();
    const latestClipboard = clipboardState.items[0]?.content || 'No clipboard items yet.';

    container.innerHTML = `
        <section class="grid grid-cols-1 md:grid-cols-3" style="gap: 20px;">
            <div class="cockpit-card stack stack-md">
                <div class="stat-label">Profile</div>
                <div style="font-size: clamp(1.55rem, 4vw, 2.2rem); font-weight: 700; color: var(--text-main); letter-spacing: -0.03em; line-height: 1.08;">${commanderName}</div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <span class="badge badge-accent">Today ${score}/100</span>
                    <span class="badge badge-accent">${rankLabel}</span>
                </div>
                <div class="text-sm text-muted" style="line-height: 1.7;">${getLastLoggedString().replace('LAST LOGGED: ', '')}</div>
            </div>

            <div class="cockpit-card" style="justify-content: center; align-items: center; text-align: center; background: linear-gradient(180deg, rgba(215,154,82,0.08), rgba(215,154,82,0.02)); border-color: rgba(215,154,82,0.16);">
                <div class="text-sm font-semibold tracking-wider text-accent" style="margin-bottom: 6px;">Today score</div>
                <div style="font-size: clamp(3.6rem, 12vw, 5.4rem); font-weight: 700; color: var(--text-main); line-height: 0.95; letter-spacing: -0.06em;">${score}</div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="stat-label">Today</div>
                <div class="stack stack-sm font-mono text-sm">
                    <div class="row" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">GYM</span>
                        <span class="${todayTelemetry.gymLogged ? 'text-accent' : 'text-muted'} font-semibold">${todayTelemetry.gymLogged ? todayTelemetry.gymSplit : 'Pending'}</span>
                    </div>
                    <div class="row" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">DESIGN</span>
                        <span class="${todayTelemetry.designHours > 0 ? 'text-accent' : 'text-muted'} font-semibold">${todayTelemetry.designHours}h</span>
                    </div>
                    <div class="row" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">WATER</span>
                        <span class="${todayTelemetry.waterLiters > 0 ? 'text-accent' : 'text-muted'} font-semibold">${todayTelemetry.waterLiters.toFixed(1)} / 4.0L</span>
                    </div>
                    <div class="row" style="justify-content: space-between; gap: 16px;">
                        <span class="text-muted">SLEEP</span>
                        <span class="${todayTelemetry.sleepHours > 0 ? 'text-accent' : 'text-muted'} font-semibold">${todayTelemetry.sleepHours > 0 ? todayTelemetry.sleepHours + 'h' : 'No data'}</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="row flex-wrap" style="gap: 10px;">
            <div class="badge badge-accent"><span>STREAK</span><span class="font-bold">${todayTelemetry.streakCurrent}</span></div>
            <div class="badge badge-accent"><span>BEST</span><span class="font-bold">${todayTelemetry.streakLongest}</span></div>
            <div class="badge badge-accent"><span>LAST BREAK</span><span class="font-bold">${todayTelemetry.lastBreakDate}</span></div>
            <div class="badge badge-accent"><span>TASK PTS</span><span class="font-bold">${getTodayTodoPoints()}</span></div>
        </section>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px; grid-template-columns: minmax(280px, 0.72fr) minmax(380px, 1.28fr); align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="row" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-accent">BALANCE</span>
                    <span class="badge ${coreDataState.syncMode === 'server' ? 'badge-accent' : 'badge-muted'}">${coreDataState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}</span>
                </div>
                <form onsubmit="handleBalanceSave(event)" class="stack stack-sm">
                    <input id="axis-balance-amount" type="number" step="0.01" class="tactical-input" placeholder="Amount" value="${coreDataState.draftBalanceAmount || Number(coreDataState.balance.amount || 0)}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateBalanceDraft('amount', this.value)">
                    <button type="submit" class="tactical-btn" style="justify-content: center;">Save</button>
                </form>
                <div style="font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 700; color: var(--hud-violet); letter-spacing: -0.04em; line-height: 1;">
                    ${Number(coreDataState.balance.amount || 0).toFixed(2)}
                </div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="row" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-accent">TASKS</span>
                    <button type="button" class="tactical-btn" style="padding: 5px 10px; font-size: 0.68rem;" onclick="clearDoneTodos()">Clear done</button>
                </div>
                <form onsubmit="handleTodoAdd(event)" class="stack stack-sm">
                    <input id="axis-todo-input" class="tactical-input" placeholder="Add a task" value="${escapeHtml(coreDataState.draftTodo || '')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateTodoDraft(this.value)">
                    <div class="row flex-wrap" style="gap: 8px; align-items: center;">
                        <label class="badge badge-accent" style="cursor: pointer; padding: 8px 12px;">
                            <input type="checkbox" ${coreDataState.draftTodoIsDaily ? 'checked' : ''} onchange="updateTodoDaily(this.checked)" style="width: 14px; height: 14px;"> Daily
                        </label>
                        <label class="badge badge-accent" style="padding: 6px 10px; gap: 8px; align-items: center;">
                            Points
                            <input type="number" min="1" step="1" value="${Number(coreDataState.draftTodoPoints || 1)}" class="tactical-input" style="width: 56px; min-height: 34px; padding: 6px 8px; font-size: 0.78rem; border-radius: 10px;" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateTodoPoints(this.value)">
                        </label>
                        <button type="submit" class="tactical-btn" style="padding: 6px 14px;">Add</button>
                    </div>
                </form>
                <div class="stack stack-sm">${renderTodoListHTML()}</div>
            </div>
        </section>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px;">
            <div class="cockpit-card stack stack-md">
                <div class="row" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-accent">CLIPBOARD</span>
                    <span class="badge ${clipboardState.syncMode === 'server' ? 'badge-accent' : 'badge-muted'}">${clipboardState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}</span>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 14px; border-radius: 18px; min-height: 96px; max-height: 110px; overflow: hidden;">
                    <div style="font-family: var(--font-mono); font-size: 0.84rem; color: var(--text-main); line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; word-break: break-word;">
                        ${escapeHtml(latestClipboard)}
                    </div>
                </div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button type="button" class="tactical-btn" onclick="openClipboardModal()">Open</button>
                    <button type="button" class="tactical-btn" onclick="copyLatestClipboardItem()">Copy latest</button>
                </div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="stat-label">Quick actions</div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button class="tactical-btn" onclick="applyDailyQuickAction('gym-quick', { split: 'Quick Mark' })">Gym</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('design-add', { amount: 1 })">+1h design</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('water-add', { amount: 0.6 })">+600ml</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('outside-toggle')">Outside</button>
                    <button class="tactical-btn" onclick="applyDailyQuickAction('tutorial-toggle')">Tutorial</button>
                </div>
                <div class="row flex-wrap" style="gap: 8px; align-items: center;">
                    <button class="tactical-btn" title="Journal" style="width: 50px; height: 50px; justify-content: center; padding: 0; border-radius: 999px;" onclick="switchModule('journal')">J</button>
                    <button class="tactical-btn" title="Notifications" style="width: 50px; height: 50px; justify-content: center; padding: 0; border-radius: 999px;" onclick="switchModule('notifications')">N</button>
                    <button class="tactical-btn" title="Sleep" style="width: 50px; height: 50px; justify-content: center; padding: 0; border-radius: 999px;" onclick="switchModule('sleep')">S</button>
                    <span class="text-sm text-muted font-mono">Journal • Notify • Sleep</span>
                </div>
                <button class="tactical-btn w-full" style="justify-content: center;" onclick="applyDailyQuickAction('reset-core')">Reset today</button>
            </div>
        </section>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px; align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-accent">WEEKLY REVIEW</span>
                    <span class="badge badge-accent">7 DAY LOOP</span>
                </div>
                ${renderWeeklyReviewHTML()}
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-accent">MARKERS</span>
                    <span class="badge badge-accent">DEADLINES + EVENTS</span>
                </div>
                <form onsubmit="handleMarkerSave(event)" class="stack stack-sm">
                    <input id="axis-marker-title" class="tactical-input" placeholder="Title" value="${escapeHtml(coreDataState.draftMarkerTitle || '')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateMarkerDraft('title', this.value)">
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 10px;">
                        <input id="axis-marker-date" type="date" class="tactical-input" value="${escapeHtml(coreDataState.draftMarkerDate || '')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateMarkerDraft('date', this.value)">
                        <select id="axis-marker-type" class="tactical-select" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateMarkerDraft('type', this.value)">
                            <option value="deadline" ${coreDataState.draftMarkerType === 'deadline' ? 'selected' : ''}>Deadline</option>
                            <option value="event" ${coreDataState.draftMarkerType === 'event' ? 'selected' : ''}>Event</option>
                        </select>
                    </div>
                    <input id="axis-marker-note" class="tactical-input" placeholder="Note (optional)" value="${escapeHtml(coreDataState.draftMarkerNote || '')}" onfocus="setCoreDataEditing(true)" onblur="setCoreDataEditing(false)" oninput="updateMarkerDraft('note', this.value)">
                    <button type="submit" class="tactical-btn" style="justify-content: center;">Save marker</button>
                </form>
                ${renderMarkerCalendarHTML()}
                <div class="stack stack-sm">${renderMarkerListHTML()}</div>
            </div>
        </section>
        ${renderClipboardModalHTML()}
    `;
}

function renderWeeklyReviewHTML() {
    const review = coreDataState.review;
    if (!review?.metrics) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">Weekly review loads after sync.</div>`;
    }
    const metric = review.metrics;
    const deltaText = value => {
        const n = Number(value || 0);
        return `${n > 0 ? '+' : ''}${n}`;
    };
    const deltaColor = value => Number(value || 0) >= 0 ? 'var(--hud-violet)' : 'var(--hud-critical)';
    return `
        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
            <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                <div class="text-sm text-muted font-mono">Tasks completed</div>
                <div class="text-2xl font-bold">${metric.tasksCompleted}</div>
                <div class="text-sm" style="color: ${deltaColor(metric.tasksDelta)};">${deltaText(metric.tasksDelta)} vs last 7d</div>
            </div>
            <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                <div class="text-sm text-muted font-mono">Workouts</div>
                <div class="text-2xl font-bold">${metric.workouts}</div>
                <div class="text-sm" style="color: ${deltaColor(metric.workoutsDelta)};">${deltaText(metric.workoutsDelta)} vs last 7d</div>
            </div>
            <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                <div class="text-sm text-muted font-mono">Protein hit days</div>
                <div class="text-2xl font-bold">${metric.proteinHitDays}/7</div>
                <div class="text-sm" style="color: ${deltaColor(metric.proteinHitDelta)};">${deltaText(metric.proteinHitDelta)} vs last 7d</div>
            </div>
            <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                <div class="text-sm text-muted font-mono">Avg sleep</div>
                <div class="text-2xl font-bold">${metric.avgSleep}h</div>
                <div class="text-sm" style="color: ${deltaColor(metric.avgSleepDelta)};">${deltaText(metric.avgSleepDelta)}h vs last 7d</div>
            </div>
        </div>
        <div class="grid grid-cols-1 md-grid-cols-3" style="gap: 10px;">
            <div class="badge badge-muted" style="justify-content: space-between; padding: 10px 12px;"><span>AVG SCORE</span><strong>${metric.avgScore}</strong></div>
            <div class="badge badge-muted" style="justify-content: space-between; padding: 10px 12px;"><span>LAST WORKOUT</span><strong>${review.since?.workout || '—'}</strong></div>
            <div class="badge badge-muted" style="justify-content: space-between; padding: 10px 12px;"><span>LAST OUTSIDE</span><strong>${review.since?.outside || '—'}</strong></div>
        </div>
        <div class="text-sm text-muted" style="line-height: 1.7;">What changed this week: tasks ${deltaText(metric.tasksDelta)}, workouts ${deltaText(metric.workoutsDelta)}, protein hit days ${deltaText(metric.proteinHitDelta)}, sleep ${deltaText(metric.avgSleepDelta)}h.</div>
    `;
}

function renderMarkerCalendarHTML() {
    const slots = coreDataState.review?.markerCalendar || [];
    if (!slots.length) return '';
    return `<div class="axis-mini-calendar">${slots.map(slot => {
        const [y, m, d] = String(slot.dayKey || '').split('-');
        const items = slot.items || [];
        const preview = items[0]?.title ? escapeHtml(items[0].title) : 'No markers';
        const titleText = items.length ? escapeHtml(items.map(item => item.title).join(' • ')) : 'No markers';
        return `<div class="axis-mini-day ${slot.status === 'today' ? 'today' : ''}" title="${titleText}">
            <div class="axis-mini-day-date">${d}/${m}</div>
            ${items.length ? `<span class="axis-mini-day-count">${items.length} marker${items.length > 1 ? 's' : ''}</span>` : `<span class="axis-mini-day-count" style="opacity:.45;">empty</span>`}
            <div class="axis-mini-day-preview">${preview}</div>
        </div>`;
    }).join('')}</div>`;
}

function renderMarkerListHTML() {
    const markers = (coreDataState.markers || []).slice(0, 8);
    if (!markers.length) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">No markers yet.</div>`;
    }
    return markers.map(marker => `
        <div class="list-item" style="align-items: flex-start; gap: 12px; opacity: ${marker.is_done ? '0.6' : '1'};">
            <button type="button" onclick="toggleMarkerItem('${marker.id}', ${!marker.is_done})" style="width: 22px; height: 22px; border-radius: 999px; border: 1.5px solid ${marker.is_done ? 'var(--hud-violet)' : 'rgba(255,255,255,0.18)'}; background: ${marker.is_done ? 'rgba(215,154,82,0.14)' : 'transparent'}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;"><span style="width: 10px; height: 10px; border-radius: 999px; background: ${marker.is_done ? 'var(--hud-violet)' : 'transparent'}; display: block;"></span></button>
            <div class="flex-1" style="min-width: 0;">
                <div class="font-mono text-sm font-bold text-main">${escapeHtml(marker.title)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">${marker.target_date} • ${(marker.marker_type || 'deadline').toUpperCase()}</div>
                ${marker.note ? `<div class="text-sm text-muted" style="margin-top: 4px; line-height: 1.5;">${escapeHtml(marker.note)}</div>` : ''}
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem;" onclick="deleteMarkerItem('${marker.id}')">Del</button>
        </div>
    `).join('');
}

function renderClipboardModalHTML() {
    if (!clipboardState.modalOpen) return '';
    return `
        <div id="axis-clipboard-modal" onclick="handleClipboardBackdrop(event)" style="position: fixed; inset: 0; z-index: 9997; background: rgba(6,6,8,0.78); backdrop-filter: blur(16px); display: flex; justify-content: center; align-items: flex-start; padding: 20px 16px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
            <div class="cockpit-card" style="width: min(760px, 96vw); max-height: calc(100vh - 40px); margin: 0 auto; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 16px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
                <div class="row" style="justify-content: space-between; gap: 12px; flex-wrap: wrap; position: sticky; top: 0; background: linear-gradient(180deg, rgba(18, 19, 22, 0.98), rgba(18, 19, 22, 0.88)); padding-bottom: 8px; z-index: 2;">
                    <span class="font-mono text-base font-semibold text-accent">CLIPBOARD</span>
                    <button type="button" class="tactical-btn" onclick="closeClipboardModal()">Close</button>
                </div>
                <form onsubmit="handleClipboardSave(event)" class="stack stack-sm">
                    <textarea id="axis-clipboard-input" class="tactical-input" rows="6" placeholder="Paste notes or TTS text here..." style="resize: vertical; line-height: 1.6; min-height: 160px;" onfocus="setClipboardEditing(true)" onblur="setClipboardEditing(false)" oninput="updateClipboardDraft(this.value)">${escapeHtml(clipboardState.draft || '')}</textarea>
                    <div class="row flex-wrap" style="gap: 8px;">
                        <button type="submit" class="tactical-btn">Save</button>
                        <button type="button" class="tactical-btn" onclick="copyLatestClipboardItem()">Copy latest</button>
                        <button type="button" class="tactical-btn" onclick="resetClipboardItems()">Clear</button>
                    </div>
                </form>
                <div class="divider"></div>
                <div class="stack stack-sm">${renderClipboardHistoryHTML()}</div>
            </div>
        </div>
    `;
}

function renderTodoListHTML() {
    if (!coreDataState.todos.length) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 12px;">No tasks yet.</div>`;
    }
    return coreDataState.todos.slice(0, 8).map(todo => `
        <div class="list-item" style="gap: 12px; padding: 12px; border-radius: 18px; align-items: center; opacity: ${todo.pending ? '0.72' : '1'};">
            <button type="button" aria-label="toggle task" onclick="toggleTodoItem('${todo.id}', ${!todo.is_done})" style="width: 22px; height: 22px; border-radius: 999px; border: 1.5px solid ${todo.is_done ? 'var(--hud-violet)' : 'rgba(215,154,82,0.36)'}; background: ${todo.is_done ? 'rgba(215,154,82,0.14)' : 'transparent'}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;">
                <span style="width: 10px; height: 10px; border-radius: 999px; background: ${todo.is_done ? 'var(--hud-violet)' : 'transparent'}; display: block;"></span>
            </button>
            <div class="flex-1" style="min-width: 0;">
                <div style="font-size: 0.88rem; color: ${todo.is_done ? 'var(--text-muted)' : 'var(--text-main)'}; text-decoration: ${todo.is_done ? 'line-through' : 'none'};">${escapeHtml(todo.title)}</div>
                <div class="row flex-wrap" style="gap: 6px; margin-top: 4px;">
                    ${todo.is_daily ? `<span class="badge badge-accent" style="padding: 2px 6px; font-size: 0.6rem;">DAILY</span>` : ''}
                    <span class="badge badge-accent" style="padding: 2px 6px; font-size: 0.6rem;">${Number(todo.points || 1)} PTS</span>
                    ${todo.pending ? `<span class="badge badge-muted" style="padding: 2px 6px; font-size: 0.6rem;">SYNCING</span>` : ''}
                </div>
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; flex-shrink: 0;" onclick="deleteTodoItem('${todo.id}')">Del</button>
        </div>
    `).join('');
}

function renderClipboardHistoryHTML() {
    if (!clipboardState.items.length) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px;">No items yet.</div>`;
    }
    return clipboardState.items.slice(0, 6).map(item => `
        <div class="list-item" style="border-left: 3px solid var(--hud-violet); gap: 10px; align-items: start;">
            <div class="flex-1" style="min-width: 0;">
                <div style="font-size: 0.82rem; color: var(--text-main); line-height: 1.55; white-space: pre-wrap; word-break: break-word; user-select: text;">${escapeHtml(item.content)}</div>
                <div style="font-size: 0.66rem; color: var(--text-muted); margin-top: 4px;">${item.source || 'axis'} • ${formatClipboardTime(item.created_at || item.timestamp)}</div>
            </div>
            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.64rem; flex-shrink: 0;" onclick="copyClipboardByIndex(${item.__idx})">Copy</button>
            <button class="tactical-btn" style="padding: 4px 8px; font-size: 0.6rem; flex-shrink: 0;" onclick="deleteClipboardItem('${item.id}')">Del</button>
        </div>
    `).join('');
}

function persistCoreDataSnapshot() {
    localStorage.setItem('axis_core_balance', JSON.stringify(coreDataState.balance));
    localStorage.setItem('axis_core_todos', JSON.stringify(coreDataState.todos));
    localStorage.setItem('axis_core_markers', JSON.stringify(coreDataState.markers || []));
}

function setCoreSyncVisual(state = 'quiet', detail = '') {
    if (typeof setAxisSyncState === 'function') {
        setAxisSyncState(state, detail);
    }
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
    } catch (e) {
        console.warn('Daily telemetry load failed:', e.message || e);
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
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    renderCoreHome();
}

function closeClipboardModal() {
    clipboardState.modalOpen = false;
    clipboardState.isEditing = false;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    renderCoreHome();
}

function handleClipboardBackdrop(e) {
    if (e.target?.id === 'axis-clipboard-modal') closeClipboardModal();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && clipboardState.modalOpen) closeClipboardModal();
});

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
        const shouldIncludeReview = !silent || document.getElementById('module-core')?.classList.contains('active') || !coreDataState.review;
        const resp = await fetch(`/api/coredata${shouldIncludeReview ? '?review=1' : ''}`, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.balance = data.balance || coreDataState.balance;
        coreDataState.todos = data.todos || [];
        coreDataState.markers = data.markers || [];
        coreDataState.review = data.review || coreDataState.review;
        coreDataState.syncMode = 'server';
        coreDataState.lastError = '';
        localStorage.setItem('axis_core_balance', JSON.stringify(coreDataState.balance));
        localStorage.setItem('axis_core_todos', JSON.stringify(coreDataState.todos));
        localStorage.setItem('axis_core_markers', JSON.stringify(coreDataState.markers || []));
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
    const label = String(coreDataState.balance.label || 'Main Balance').trim() || 'Main Balance';
    const amount = Number(coreDataState.draftBalanceAmount || coreDataState.balance.amount || 0);
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Core balance needs server connection online.');
        return;
    }

    const previous = { ...coreDataState.balance };
    coreDataState.balance = { ...coreDataState.balance, label, amount };
    coreDataState.draftBalanceAmount = '';
    persistCoreDataSnapshot();
    setCoreSyncVisual('busy');
    renderCoreHome();

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
        coreDataState.isEditing = false;
        persistCoreDataSnapshot();
        setCoreSyncVisual('quiet');
        renderCoreHome();
    } catch (e) {
        coreDataState.balance = previous;
        persistCoreDataSnapshot();
        setCoreSyncVisual('warn', 'Balance sync failed');
        renderCoreHome();
        console.warn(`Balance save failed: ${e.message}`);
    }
}

async function handleTodoAdd(e) {
    e.preventDefault();
    const title = String(coreDataState.draftTodo || '').trim();
    if (!title) return;
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Task add needs server connection online.');
        return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticRow = {
        id: tempId,
        title,
        is_done: false,
        is_daily: !!coreDataState.draftTodoIsDaily,
        points: Math.max(1, Number(coreDataState.draftTodoPoints || 1)),
        last_reset_key: currentAxisDayKeyClient(),
        completed_day_key: null,
        pending: true
    };

    coreDataState.todos.unshift(optimisticRow);
    coreDataState.draftTodo = '';
    coreDataState.draftTodoIsDaily = false;
    coreDataState.draftTodoPoints = 1;
    coreDataState.isEditing = false;
    window.axisPendingCoreMutation = true;
    persistCoreDataSnapshot();
    setCoreSyncVisual('busy');
    renderCoreHome();

    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-add', title, isDaily: optimisticRow.is_daily, points: optimisticRow.points })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos = coreDataState.todos.map(todo => todo.id === tempId ? data.row : todo);
        persistCoreDataSnapshot();
        setCoreSyncVisual('quiet');
        renderCoreHome();
    } catch (e) {
        coreDataState.todos = coreDataState.todos.filter(todo => todo.id !== tempId);
        coreDataState.draftTodo = title;
        coreDataState.draftTodoIsDaily = optimisticRow.is_daily;
        coreDataState.draftTodoPoints = optimisticRow.points;
        persistCoreDataSnapshot();
        setCoreSyncVisual('warn', 'Task sync failed');
        renderCoreHome();
        console.warn(`Todo add failed: ${e.message}`);
    } finally {
        window.axisPendingCoreMutation = false;
    }
}

async function toggleTodoItem(id, isDone) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Task toggle needs server connection online.');
        return;
    }

    const previousTodos = coreDataState.todos.map(todo => ({ ...todo }));
    coreDataState.todos = coreDataState.todos.map(todo => todo.id === id ? {
        ...todo,
        is_done: !!isDone,
        completed_day_key: isDone ? currentAxisDayKeyClient() : null,
        last_reset_key: currentAxisDayKeyClient(),
        pending: true
    } : todo);
    window.axisPendingCoreMutation = true;
    persistCoreDataSnapshot();
    setCoreSyncVisual('busy');
    renderCoreHome();

    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-toggle', id, isDone })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.todos = coreDataState.todos.map(todo => todo.id === id ? { ...todo, ...(data.row || {}), is_done: !!isDone, pending: false } : todo);
        persistCoreDataSnapshot();
        setCoreSyncVisual('quiet');
        renderCoreHome();
    } catch (e) {
        coreDataState.todos = previousTodos;
        persistCoreDataSnapshot();
        setCoreSyncVisual('warn', 'Task sync failed');
        renderCoreHome();
        console.warn(`Todo update failed: ${e.message}`);
    } finally {
        window.axisPendingCoreMutation = false;
    }
}

async function deleteTodoItem(id) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Task delete needs server connection online.');
        return;
    }

    const previousTodos = coreDataState.todos.map(todo => ({ ...todo }));
    coreDataState.todos = coreDataState.todos.filter(todo => todo.id !== id);
    window.axisPendingCoreMutation = true;
    persistCoreDataSnapshot();
    setCoreSyncVisual('busy');
    renderCoreHome();

    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        persistCoreDataSnapshot();
        setCoreSyncVisual('quiet');
        renderCoreHome();
    } catch (e) {
        coreDataState.todos = previousTodos;
        persistCoreDataSnapshot();
        setCoreSyncVisual('warn', 'Task delete failed');
        renderCoreHome();
        console.warn(`Todo delete failed: ${e.message}`);
    } finally {
        window.axisPendingCoreMutation = false;
    }
}

async function clearDoneTodos() {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Task clear needs server connection online.');
        return;
    }

    const previousTodos = coreDataState.todos.map(todo => ({ ...todo }));
    coreDataState.todos = coreDataState.todos.filter(todo => !todo.is_done);
    window.axisPendingCoreMutation = true;
    persistCoreDataSnapshot();
    setCoreSyncVisual('busy');
    renderCoreHome();

    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'todo-clear-done' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        persistCoreDataSnapshot();
        setCoreSyncVisual('quiet');
        renderCoreHome();
    } catch (e) {
        coreDataState.todos = previousTodos;
        persistCoreDataSnapshot();
        setCoreSyncVisual('warn', 'Task clear failed');
        renderCoreHome();
        console.warn(`Todo clear failed: ${e.message}`);
    } finally {
        window.axisPendingCoreMutation = false;
    }
}

async function handleMarkerSave(e) {
    e.preventDefault();
    const title = String(coreDataState.draftMarkerTitle || '').trim();
    const targetDate = String(coreDataState.draftMarkerDate || '').trim();
    if (!title || !targetDate) return;
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'marker-save', title, targetDate, markerType: coreDataState.draftMarkerType, note: coreDataState.draftMarkerNote })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.markers.push(data.row);
        coreDataState.markers.sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)));
        coreDataState.draftMarkerTitle = '';
        coreDataState.draftMarkerDate = '';
        coreDataState.draftMarkerType = 'deadline';
        coreDataState.draftMarkerNote = '';
        persistCoreDataSnapshot();
        await loadCoreDataFromServer({ silent: false });
        renderCoreHome();
    } catch (e) {
        console.warn(`Marker save failed: ${e.message}`);
    }
}

async function toggleMarkerItem(id, isDone) {
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'marker-toggle', id, isDone })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.markers = coreDataState.markers.map(marker => marker.id === id ? { ...marker, ...(data.row || {}), is_done: !!isDone } : marker);
        persistCoreDataSnapshot();
        await loadCoreDataFromServer({ silent: false });
        renderCoreHome();
    } catch (e) {
        console.warn(`Marker toggle failed: ${e.message}`);
    }
}

async function deleteMarkerItem(id) {
    try {
        const resp = await fetch('/api/coredata', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'marker-delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        coreDataState.markers = coreDataState.markers.filter(marker => marker.id !== id);
        persistCoreDataSnapshot();
        await loadCoreDataFromServer({ silent: false });
        renderCoreHome();
    } catch (e) {
        console.warn(`Marker delete failed: ${e.message}`);
    }
}

function updateMarkerDraft(field, value) {
    coreDataState.isEditing = true;
    if (field === 'title') coreDataState.draftMarkerTitle = String(value || '');
    if (field === 'date') coreDataState.draftMarkerDate = String(value || '');
    if (field === 'type') coreDataState.draftMarkerType = String(value || 'deadline');
    if (field === 'note') coreDataState.draftMarkerNote = String(value || '');
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