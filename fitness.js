/* ==========================================
   AXIS OS // fitness.js
   Fitness tracker, main lifts, exercise memory, chart,
   server sync, test reset, and historical import.
   ========================================== */

const OBSIDIAN_SPLITS = {
    'Chest + Back': [
        'Incline Barbell Bench Press', 'Machine Chest Press', 'Upper/Mid Cable Fly',
        'Wide-Grip Lat Pulldown', 'Shoulder-Width Lat Pulldown', 'Seated Wide-Grip Row',
        'Single-Arm Cable Row', 'Cable Shrugs'
    ],
    'Shoulders + Arms': [
        'Machine Shoulder Press', 'Cable Lateral Raises', 'Shoulder Extension Machine',
        'Dumbbell Incline Curls', 'Bayesian Cable Curls', 'Hammer Curls',
        'Triceps Cable Pushdowns', 'Single-Arm Cable Pushdowns', 'Overhead Cable Extensions'
    ],
    'Legs': ['Back Squat', 'Hack Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises']
};

const MAIN_LIFT_META = {
    squat: { label: 'SQUAT', color: '#22c55e', repLower: 3, defaultExercise: 'Back Squat' },
    hinge: { label: 'HINGE', color: '#14b8a6', repLower: 3, defaultExercise: 'Romanian Deadlift' },
    horizontal_press: { label: 'H PRESS', color: '#e08c2b', repLower: 3, defaultExercise: 'Incline Barbell Bench Press' },
    vertical_press: { label: 'V PRESS', color: '#c4a26b', repLower: 5, defaultExercise: 'Machine Shoulder Press' },
    horizontal_pull: { label: 'H PULL', color: '#9db3bf', repLower: 6, defaultExercise: 'Seated Wide-Grip Row' },
    vertical_pull: { label: 'V PULL', color: '#b4c0c8', repLower: 6, defaultExercise: 'Wide-Grip Lat Pulldown' }
};

const MAIN_LIFT_EXERCISE_MAP = {
    squat: ['Back Squat', 'Hack Squat', 'Front Squat', 'Leg Press'],
    hinge: ['Romanian Deadlift', 'Conventional Deadlift', 'Sumo Deadlift', 'Hip Thrust', 'Good Morning'],
    horizontal_press: ['Incline Barbell Bench Press', 'Incline Bench', 'Machine Chest Press', 'Flat Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press'],
    vertical_press: ['Machine Shoulder Press', 'Shoulder Press', 'Overhead Press', 'Dumbbell Shoulder Press', 'Landmine Press', 'Push Press'],
    horizontal_pull: ['Seated Wide-Grip Row', 'Seated Row', 'Single-Arm Cable Row', 'Cable Row', 'Chest-Supported Row', 'Barbell Row', 'T-Bar Row', 'Seal Row'],
    vertical_pull: ['Wide-Grip Lat Pulldown', 'Wide Lat Pulldown', 'Shoulder-Width Lat Pulldown', 'Lat Pulldown', 'Neutral Grip Pulldown', 'Pull-Up', 'Chin-Up']
};

const HISTORICAL_FITNESS_SESSIONS = [
    {
        loggedAt: '2026-01-04T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Incline Barbell Bench Press', sets: [{ weight: 10, reps: 10 }, { weight: 15, reps: 10 }, { weight: 20, reps: 8 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 55, reps: 7 }, { weight: 60, reps: 4 }] },
            { exercise: 'Seated Wide-Grip Row', sets: [{ weight: 30, reps: 10 }, { weight: 35, reps: 10 }, { weight: 40, reps: 10 }] },
            { exercise: 'Cable Shrugs', sets: [{ weight: 35, reps: 10 }, { weight: 50, reps: 8 }, { weight: 45, reps: 8 }] }
        ]
    },
    {
        loggedAt: '2026-03-02T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Incline Barbell Bench Press', sets: [{ weight: 10, reps: 10 }, { weight: 15, reps: 7 }] },
            { exercise: 'Machine Chest Press', sets: [{ weight: 35, reps: 10 }, { weight: 50, reps: 10 }] },
            { exercise: 'Upper/Mid Cable Fly', sets: [{ weight: 15, reps: 9 }, { weight: 10, reps: 10 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 50, reps: 10 }, { weight: 55, reps: 7 }] },
            { exercise: 'Seated Wide-Grip Row', sets: [{ weight: 25, reps: 10 }, { weight: 40, reps: 10 }, { weight: 40, reps: 6 }] },
            { exercise: 'Cable Shrugs', sets: [{ weight: 35, reps: 10 }, { weight: 40, reps: 10 }] }
        ]
    },
    {
        loggedAt: '2026-03-11T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Incline Barbell Bench Press', sets: [{ weight: 10, reps: 10 }, { weight: 15, reps: 10 }, { weight: 20, reps: 4 }] },
            { exercise: 'Machine Chest Press', sets: [{ weight: 50, reps: 10 }, { weight: 45, reps: 10 }] },
            { exercise: 'Upper/Mid Cable Fly', sets: [{ weight: 10, reps: 10 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 50, reps: 9 }, { weight: 55, reps: 4 }] },
            { exercise: 'Cable Shrugs', sets: [{ weight: 40, reps: 10 }] }
        ]
    },
    {
        loggedAt: '2026-03-29T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Incline Barbell Bench Press', sets: [{ weight: 10, reps: 10 }, { weight: 15, reps: 10 }, { weight: 20, reps: 9 }] },
            { exercise: 'Machine Chest Press', sets: [{ weight: 50, reps: 8 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 50, reps: 9 }, { weight: 55, reps: 5 }, { weight: 45, reps: 10 }] },
            { exercise: 'Seated Wide-Grip Row', sets: [{ weight: 30, reps: 10 }, { weight: 35, reps: 8 }] }
        ]
    },
    {
        loggedAt: '2026-04-14T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Machine Chest Press', sets: [{ weight: 50, reps: 10 }, { weight: 60, reps: 9 }] },
            { exercise: 'Upper/Mid Cable Fly', sets: [{ weight: 30, reps: 10 }, { weight: 45, reps: 10 }, { weight: 55, reps: 10 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 50, reps: 9 }, { weight: 50, reps: 5 }] },
            { exercise: 'Seated Wide-Grip Row', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 10 }] },
            { exercise: 'Cable Shrugs', sets: [{ weight: 30, reps: 10 }, { weight: 35, reps: 10 }, { weight: 40, reps: 10 }] }
        ]
    },
    {
        loggedAt: '2026-04-16T09:00:00.000Z',
        splitName: 'Shoulders + Arms',
        exercises: [
            { exercise: 'Machine Shoulder Press', sets: [{ weight: 25, reps: 10 }, { weight: 40, reps: 8 }, { weight: 45, reps: 7 }] },
            { exercise: 'Cable Lateral Raises', sets: [{ weight: 5, reps: 10 }, { weight: 7.5, reps: 10 }] },
            { exercise: 'Dumbbell Incline Curls', sets: [{ weight: 15, reps: 10 }, { weight: 15, reps: 10 }] },
            { exercise: 'Triceps Cable Pushdowns', sets: [{ weight: 35, reps: 10 }, { weight: 40, reps: 8 }] }
        ]
    },
    {
        loggedAt: '2026-04-19T09:00:00.000Z',
        splitName: 'Chest + Back',
        exercises: [
            { exercise: 'Machine Chest Press', sets: [{ weight: 50, reps: 10 }, { weight: 60, reps: 10 }] },
            { exercise: 'Wide-Grip Lat Pulldown', sets: [{ weight: 50, reps: 9 }, { weight: 50, reps: 4 }] },
            { exercise: 'Seated Wide-Grip Row', sets: [{ weight: 35, reps: 10 }, { weight: 30, reps: 10 }] },
            { exercise: 'Cable Shrugs', sets: [{ weight: 30, reps: 10 }, { weight: 40, reps: 10 }] }
        ]
    }
];

let recentWorkoutArchives = JSON.parse(localStorage.getItem('axis_workout_archives') || '[]');
let exerciseMemoryLog = JSON.parse(localStorage.getItem('axis_exercise_memory') || '[]');
let fitnessUiState = {
    expandedMainLift: null,
    chartMode: localStorage.getItem('axis_main_lift_chart_mode') || 'index'
};
let fitnessServerState = {
    loaded: false,
    syncMode: 'local',
    lastError: '',
    lastLoadedAt: 0,
    isEditing: false,
    latestSession: null,
    editingLatestSessionId: null
};

function buildDefaultMainLiftState() {
    let state = {};
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        state[pattern] = { activeExercise: MAIN_LIFT_META[pattern].defaultExercise, history: [] };
    });
    return state;
}

function normalizeMainLiftState(rawState) {
    let state = buildDefaultMainLiftState();
    if (!rawState || typeof rawState !== 'object') return state;
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        const raw = rawState[pattern] || {};
        state[pattern].activeExercise = raw.activeExercise || state[pattern].activeExercise;
        state[pattern].history = Array.isArray(raw.history)
            ? raw.history.map(x => ({
                id: x.id || `ml-${Date.now()}`,
                sessionDateKey: x.sessionDateKey || 'unknown-date',
                dateLabel: x.dateLabel || 'UNKNOWN',
                timestamp: x.timestamp || Date.now(),
                exercise: x.exercise || state[pattern].activeExercise,
                weight: parseFloat(x.weight) || 0,
                reps: parseInt(x.reps) || 0,
                e1rm: parseFloat(x.e1rm) || calculateLiftE1RM(parseFloat(x.weight) || 0, parseInt(x.reps) || 0)
            })).sort((a, b) => a.timestamp - b.timestamp)
            : [];
    });
    return state;
}

let mainLiftState = normalizeMainLiftState(JSON.parse(localStorage.getItem('axis_main_lift_state') || 'null'));

function initFitness() {
    renderFitnessView();
    loadFitnessFromServer({ silent: true });
}

function renderFitnessView() {
    const container = document.getElementById('module-fitness');
    if (!container) return;

    let splitOptions = Object.keys(OBSIDIAN_SPLITS).map(s => `<option value="${s}">${s}</option>`).join('');

    container.innerHTML = `
        <div class="cockpit-header">
            <span>FITNESS</span>
            <span class="text-sm text-muted">${renderFitnessSyncBadgeText()}</span>
        </div>

        <!-- Main Lifts + Workout Log -->
        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px;">
            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between;">
                    <span class="font-mono text-base font-semibold text-accent">MAIN LIFTS</span>
                    <div class="row flex-wrap" style="gap: 6px;">
                        <button class="tactical-btn" style="border-color: var(--hud-cyan);" onclick="importHistoricalData()">IMPORT</button>
                        <button class="tactical-btn" style="border-color: var(--hud-critical); color: var(--hud-critical);" onclick="resetFitnessLogs()">CLEAR</button>
                    </div>
                </div>
                <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                    ${renderMainLiftCardsHTML()}
                </div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 8px;">
                    <span class="font-mono text-base font-semibold text-accent">WORKOUT LOG</span>
                    <div class="row flex-wrap" style="gap: 6px;">
                        <button type="button" class="tactical-btn" style="padding: 5px 10px; font-size: 0.66rem;" onclick="loadLatestWorkoutIntoEditor()">LOAD LAST</button>
                        <button type="button" class="tactical-btn" style="padding: 5px 10px; font-size: 0.66rem;" onclick="undoLastWorkoutSession()">UNDO LAST</button>
                        ${fitnessServerState.editingLatestSessionId ? `<button type="button" class="tactical-btn" style="padding: 5px 10px; font-size: 0.66rem;" onclick="cancelLatestWorkoutEdit()">CANCEL EDIT</button>` : ``}
                    </div>
                </div>
                ${fitnessServerState.editingLatestSessionId ? `<div class="badge badge-accent">EDITING LAST SESSION</div>` : ``}
                <form onsubmit="handleTacticalWorkoutLog(event)" class="stack stack-sm">
                    <div class="stack stack-sm">
                        <label class="form-label">Split</label>
                        <select class="tactical-select w-full" id="workout-split-select" onchange="setFitnessEditing(true); updateExerciseDropdown()" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)">${splitOptions}</select>
                    </div>
                    <div class="stack stack-sm">
                        <label class="form-label">Exercise</label>
                        <select class="tactical-select w-full" id="workout-exercise-select" onchange="setFitnessEditing(true); refreshSelectedExerciseMemory()" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)"></select>
                    </div>
                    <div class="stack stack-sm">
                        <label class="form-label">Sets (reps/kg)</label>
                        <input type="text" class="tactical-input w-full" id="workout-set-series" placeholder="10/30 10/40 10/40" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)" oninput="setFitnessEditing(true)">
                        <div class="text-sm text-muted font-mono">Example: 10/30 10/40 10/40 = 3 sets. Slash format means reps/kg.</div>
                    </div>
                    <div class="grid grid-cols-2" style="gap: 12px;">
                        <div class="stack stack-sm">
                            <label class="form-label">Reps</label>
                            <input type="number" class="tactical-input w-full" id="workout-reps" placeholder="8" min="1" max="100" value="8" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)" oninput="setFitnessEditing(true)">
                        </div>
                        <div class="stack stack-sm">
                            <label class="form-label">KG</label>
                            <input type="number" step="0.5" class="tactical-input w-full" id="workout-weight" placeholder="80" min="1" max="500" value="80" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)" oninput="setFitnessEditing(true)">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md-grid-cols-3" style="gap: 12px; align-items: end;">
                        <div class="stack stack-sm">
                            <label class="form-label">Classification</label>
                            <select class="tactical-select w-full" id="workout-classification" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)">
                                <option value="top_set" selected>Top set</option>
                                <option value="backoff">Backoff</option>
                                <option value="warmup">Warm-up</option>
                                <option value="accessory">Accessory</option>
                            </select>
                        </div>
                        <div class="stack stack-sm">
                            <label class="form-label">RIR</label>
                            <input type="number" step="0.5" min="0" max="10" class="tactical-input w-full" id="workout-rir" placeholder="2" onfocus="setFitnessEditing(true)" onblur="setFitnessEditing(false)" oninput="setFitnessEditing(true)">
                        </div>
                        <label class="badge badge-muted" style="padding: 12px 14px; cursor: pointer; justify-content: center; min-height: 48px;">
                            <input type="checkbox" id="workout-failure" onchange="setFitnessEditing(true)"> Failure
                        </label>
                    </div>
                    <button type="submit" class="tactical-btn w-full" style="justify-content: center;">${fitnessServerState.editingLatestSessionId ? 'SAVE EDIT' : 'SAVE LOG'}</button>
                </form>
                <div id="selected-exercise-memory-panel"></div>
            </div>
        </section>

        <!-- Main Lift Chart -->
        <section class="cockpit-card stack stack-md">
            <div class="row flex-wrap" style="justify-content: space-between;">
                <div>
                    <div class="font-mono text-base font-semibold text-cyan">MAIN LIFT CHART</div>
                    <div class="text-sm text-muted">6 movement patterns</div>
                </div>
                <div class="row" style="gap: 6px;">
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'index' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('index')">INDEXED</button>
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'e1rm' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('e1rm')">E1RM</button>
                </div>
            </div>
            ${renderMainLiftChartHTML()}
            <div class="row flex-wrap font-mono">${renderMainLiftLegendHTML()}</div>
        </section>

        <!-- Recent Logs -->
        <section class="cockpit-card stack stack-md">
            <span class="font-mono text-base font-semibold">RECENT LOGS</span>
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
                ${renderWorkoutArchivesHTML()}
            </div>
        </section>
    `;

    updateExerciseDropdown();
}

function renderFitnessSyncBadgeText() {
    if (fitnessServerState.syncMode === 'server') return 'SERVER SYNC';
    if (fitnessServerState.lastError) return 'LOCAL MODE';
    return 'LOCAL';
}

function renderMainLiftCardsHTML() {
    return Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const state = mainLiftState[pattern];
        const latest = state.history[state.history.length - 1] || null;
        const best = getBestMainLiftEntry(pattern);
        const status = getMainLiftStatus(pattern);
        const first = state.history[0] || null;
        const delta = latest && first ? (latest.e1rm - first.e1rm) : 0;
        const expanded = fitnessUiState.expandedMainLift === pattern;

        return `
            <div class="cockpit-card-flat stack" style="border-color: ${status.borderColor}; padding: 14px; gap: 10px;">
                <div class="row flex-wrap" style="justify-content: space-between; align-items: flex-start;">
                    <div class="stack" style="gap: 6px;">
                        <div class="font-mono text-sm font-bold tracking-wider" style="color: ${meta.color};">${meta.label}</div>
                        <div class="font-mono text-base font-bold" style="line-height: 1.35;">${state.activeExercise || meta.defaultExercise}</div>
                    </div>
                    <div class="font-mono text-sm font-bold whitespace-nowrap" style="color: ${status.textColor};">${status.label}</div>
                </div>
                <div class="grid grid-cols-2 font-mono text-sm" style="gap: 8px;">
                    <div style="background: rgba(255,255,255,0.03); padding: 8px;">
                        <div class="text-muted" style="margin-bottom: 4px;">Last</div>
                        <div class="text-main font-bold">${latest ? formatSetDisplay(latest.weight, latest.reps) : '--'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 8px;">
                        <div class="text-muted" style="margin-bottom: 4px;">e1RM</div>
                        <div class="font-bold" style="color: ${meta.color};">${latest ? `~${latest.e1rm}` : '--'}</div>
                    </div>
                </div>
                <div class="row flex-wrap font-mono text-sm text-muted" style="justify-content: space-between; gap: 8px;">
                    <span>Best <strong class="text-main">${best ? formatSetDisplay(best.weight, best.reps) : '--'}</strong></span>
                    <span>Δ <strong style="color: ${delta >= 0 ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">${latest && first ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : '--'}</strong></span>
                </div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button class="tactical-btn" style="padding: 5px 10px; font-size: 0.66rem;" onclick="quickLogMainLift('${pattern}')">QUICK</button>
                    <button class="tactical-btn cyan" style="padding: 5px 10px; font-size: 0.66rem;" onclick="setActiveMainLiftExercise('${pattern}')">SET</button>
                    <button class="tactical-btn" style="padding: 5px 10px; font-size: 0.66rem; border-color: ${meta.color};" onclick="toggleMainLiftHistory('${pattern}')">${expanded ? 'HIDE' : 'HISTORY'}</button>
                </div>
                ${expanded ? renderMainLiftHistoryHTML(pattern) : ''}
            </div>
        `;
    }).join('');
}

function renderMainLiftHistoryHTML(pattern) {
    const rows = [...mainLiftState[pattern].history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    if (!rows.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 10px;">No history yet.</div>`;
    }
    return `<div class="stack" style="gap: 6px;">${rows.map(row => `
        <div class="row font-mono text-sm" style="grid-template-columns: 62px 1fr 92px; gap: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid ${MAIN_LIFT_META[pattern].color}; padding: 8px 10px;">
            <div class="text-cyan font-bold" style="width: 62px;">${row.dateLabel}</div>
            <div class="text-main text-truncate flex-1">${row.exercise}</div>
            <div class="text-right font-bold" style="width: 92px; color: ${MAIN_LIFT_META[pattern].color};">${formatSetDisplay(row.weight, row.reps)}</div>
        </div>`).join('')}</div>`;
}

function updateExerciseDropdown() {
    const splitEl = document.getElementById('workout-split-select');
    const exEl = document.getElementById('workout-exercise-select');
    if (!splitEl || !exEl) return;
    const exercises = OBSIDIAN_SPLITS[splitEl.value] || [];
    exEl.innerHTML = exercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');
    refreshSelectedExerciseMemory();
}

function refreshSelectedExerciseMemory() {
    const panel = document.getElementById('selected-exercise-memory-panel');
    const exEl = document.getElementById('workout-exercise-select');
    if (!panel || !exEl) return;
    panel.innerHTML = renderSelectedExerciseMemoryHTML(exEl.value);
}

function renderSelectedExerciseMemoryHTML(exerciseName) {
    const rows = getExerciseMemoryRows(exerciseName).slice(0, 5);
    const pattern = getMainLiftPatternForExercise(exerciseName);
    const color = pattern ? MAIN_LIFT_META[pattern].color : 'var(--hud-violet)';
    return `
        <div class="divider" style="margin: 14px 0;"></div>
        <div class="stack" style="gap: 10px;">
            <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                <div class="font-mono text-base font-bold text-main">${exerciseName}</div>
                <div class="font-mono text-sm" style="color: ${color};">${pattern ? MAIN_LIFT_META[pattern].label : 'MEMORY'}</div>
            </div>
            ${rows.length === 0 ? `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 10px;">No saved history yet.</div>` : `<div class="stack" style="gap: 6px;">${rows.map(row => `
                <div class="row font-mono text-sm" style="gap: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; padding: 8px 10px;">
                    <div class="text-cyan font-bold" style="width: 62px;">${row.dateLabel}</div>
                    <div class="text-muted text-truncate flex-1">${row.split}</div>
                    <div class="text-right text-main font-bold" style="width: 220px;">${row.seriesText || formatSetDisplay(row.weight, row.reps)}</div>
                </div>`).join('')}</div>`}
        </div>
    `;
}

function parseWorkoutSetSeriesInput(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    const parts = text.split(/\s+/).filter(Boolean);
    const sets = [];
    for (const part of parts) {
        let match = part.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
        if (match) {
            sets.push({ reps: parseInt(match[1], 10), weight: parseFloat(match[2]) });
            continue;
        }
        match = part.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
        if (match) {
            const a = parseFloat(match[1]);
            const b = parseFloat(match[2]);
            if (a <= 30 && b >= a) sets.push({ reps: parseInt(a, 10), weight: b });
            else sets.push({ weight: a, reps: parseInt(b, 10) });
        }
    }
    return sets.filter(set => Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.weight > 0 && set.reps > 0);
}

function normalizeWorkoutClassificationClient(value) {
    const clean = String(value || '').trim().toLowerCase();
    if (clean === 'warmup') return 'warmup';
    if (clean === 'backoff') return 'backoff';
    if (clean === 'accessory') return 'accessory';
    return 'top_set';
}

function classificationToLegacySetTypeClient(classification) {
    if (classification === 'top_set') return 'leading';
    if (classification === 'backoff') return 'backoff';
    return 'accessory';
}

function deriveSetClassificationClient(baseClassification, index) {
    const normalized = normalizeWorkoutClassificationClient(baseClassification);
    if (normalized === 'top_set') return index === 0 ? 'top_set' : 'backoff';
    return normalized;
}

function formatFitnessSetTags({ classification, rir, effortNote }) {
    const tags = [];
    if (classification === 'warmup') tags.push('WU');
    else if (classification === 'top_set') tags.push('TOP');
    else if (classification === 'backoff') tags.push('BO');
    else if (classification === 'accessory') tags.push('ACC');
    if (rir != null && rir !== '') tags.push(`RIR ${rir}`);
    if (String(effortNote || '').toLowerCase() === 'failure') tags.push('FAIL');
    return tags.length ? ` [${tags.join(' • ')}]` : '';
}

function buildSeriesTextFromSetsForEditor(sets = []) {
    return sets.map(set => `${set.reps}/${set.weight}`).join(' ');
}

function loadLatestWorkoutIntoEditor() {
    const latest = fitnessServerState.latestSession;
    if (!latest || !Array.isArray(latest.exercises) || latest.exercises.length !== 1) {
        console.warn('Load last edit currently works on single-exercise sessions only.');
        return;
    }

    const exerciseItem = latest.exercises[0];
    const firstSet = exerciseItem.sets?.[0] || null;
    const splitEl = document.getElementById('workout-split-select');
    const exerciseEl = document.getElementById('workout-exercise-select');
    const seriesEl = document.getElementById('workout-set-series');
    const repsEl = document.getElementById('workout-reps');
    const weightEl = document.getElementById('workout-weight');
    const classEl = document.getElementById('workout-classification');
    const rirEl = document.getElementById('workout-rir');
    const failEl = document.getElementById('workout-failure');

    if (splitEl) splitEl.value = latest.splitName || splitEl.value;
    updateExerciseDropdown();
    if (exerciseEl) exerciseEl.value = exerciseItem.exercise;
    refreshSelectedExerciseMemory();
    if (seriesEl) seriesEl.value = buildSeriesTextFromSetsForEditor(exerciseItem.sets || []);
    if (repsEl && firstSet) repsEl.value = firstSet.reps || '';
    if (weightEl && firstSet) weightEl.value = firstSet.weight || '';
    if (classEl && firstSet) classEl.value = firstSet.classification || 'top_set';
    if (rirEl) rirEl.value = firstSet?.rir ?? '';
    if (failEl) failEl.checked = String(firstSet?.effortNote || '').toLowerCase() === 'failure';

    fitnessServerState.editingLatestSessionId = latest.id;
    renderFitnessView();
    setTimeout(() => loadLatestWorkoutIntoEditorAfterRender(latest), 0);
}

function loadLatestWorkoutIntoEditorAfterRender(latest) {
    if (!latest || !Array.isArray(latest.exercises) || latest.exercises.length !== 1) return;
    const exerciseItem = latest.exercises[0];
    const firstSet = exerciseItem.sets?.[0] || null;
    const splitEl = document.getElementById('workout-split-select');
    const exerciseEl = document.getElementById('workout-exercise-select');
    const seriesEl = document.getElementById('workout-set-series');
    const repsEl = document.getElementById('workout-reps');
    const weightEl = document.getElementById('workout-weight');
    const classEl = document.getElementById('workout-classification');
    const rirEl = document.getElementById('workout-rir');
    const failEl = document.getElementById('workout-failure');

    if (splitEl) splitEl.value = latest.splitName || splitEl.value;
    updateExerciseDropdown();
    if (exerciseEl) exerciseEl.value = exerciseItem.exercise;
    refreshSelectedExerciseMemory();
    if (seriesEl) seriesEl.value = buildSeriesTextFromSetsForEditor(exerciseItem.sets || []);
    if (repsEl && firstSet) repsEl.value = firstSet.reps || '';
    if (weightEl && firstSet) weightEl.value = firstSet.weight || '';
    if (classEl && firstSet) classEl.value = firstSet.classification || 'top_set';
    if (rirEl) rirEl.value = firstSet?.rir ?? '';
    if (failEl) failEl.checked = String(firstSet?.effortNote || '').toLowerCase() === 'failure';
}

function cancelLatestWorkoutEdit() {
    fitnessServerState.editingLatestSessionId = null;
    renderFitnessView();
}

async function undoLastWorkoutSession() {
    if (!shouldUseServerFitnessSync()) {
        console.warn('Undo last workout needs server connection online.');
        return;
    }
    try {
        const resp = await fetch('/api/fitness', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'undo-last' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        fitnessServerState.editingLatestSessionId = null;
        await loadFitnessFromServer({ silent: false });
        refreshCoreView();
    } catch (e) {
        console.warn(`Undo last workout failed: ${e.message}`);
    }
}

async function handleTacticalWorkoutLog(e) {
    e.preventDefault();
    const split = document.getElementById('workout-split-select').value;
    const exercise = document.getElementById('workout-exercise-select').value;
    const reps = parseInt(document.getElementById('workout-reps').value, 10);
    const weight = parseFloat(document.getElementById('workout-weight').value);
    const setSeries = document.getElementById('workout-set-series')?.value || '';
    const selectedClassification = normalizeWorkoutClassificationClient(document.getElementById('workout-classification')?.value || 'top_set');
    const rirRaw = document.getElementById('workout-rir')?.value;
    const rir = rirRaw === '' ? null : Math.max(0, Math.min(10, parseFloat(rirRaw)));
    const failureChecked = !!document.getElementById('workout-failure')?.checked;
    const effortNote = failureChecked ? 'failure' : null;

    let sets = parseWorkoutSetSeriesInput(setSeries);
    if (!sets.length && exercise && weight && reps) {
        sets = [{ weight, reps }];
    }
    if (!exercise || !sets.length) return;

    const payloadSets = sets.map((set, idx) => {
        const classification = deriveSetClassificationClient(selectedClassification, idx);
        const legacyType = classificationToLegacySetTypeClient(classification);
        return {
            weight: set.weight,
            reps: set.reps,
            setType: legacyType,
            classification,
            rir: effortNote === 'failure' && (rir == null || Number.isNaN(rir)) ? 0 : (Number.isFinite(rir) ? rir : null),
            effortNote
        };
    });

    const serverSaved = await postWorkoutToServer([{ exercise, sets: payloadSets }], split, fitnessServerState.editingLatestSessionId ? (fitnessServerState.latestSession?.loggedAt || null) : null, fitnessServerState.editingLatestSessionId ? 'replace-last' : 'create');
    if (serverSaved) {
        markGymTelemetry(split);
        await loadFitnessFromServer({ silent: false });
        refreshCoreView();
        const setSeriesInput = document.getElementById('workout-set-series');
        const rirInput = document.getElementById('workout-rir');
        const failureInput = document.getElementById('workout-failure');
        if (setSeriesInput) setSeriesInput.value = '';
        if (rirInput) rirInput.value = '';
        if (failureInput) failureInput.checked = false;
        fitnessServerState.editingLatestSessionId = null;
        return;
    }

    const groupId = `local-group-${Date.now()}`;
    payloadSets.forEach(set => {
        logSetLocally({ split, exercise, weight: set.weight, reps: set.reps, setType: set.setType, classification: set.classification, rir: set.rir, effortNote: set.effortNote, groupId, loggedAt: new Date().toISOString() });
    });
    const setSeriesInput = document.getElementById('workout-set-series');
    const rirInput = document.getElementById('workout-rir');
    const failureInput = document.getElementById('workout-failure');
    if (setSeriesInput) setSeriesInput.value = '';
    if (rirInput) rirInput.value = '';
    if (failureInput) failureInput.checked = false;
    fitnessServerState.editingLatestSessionId = null;
    renderFitnessView();
    refreshCoreView();
}

async function quickLogMainLift(pattern) {
    const meta = MAIN_LIFT_META[pattern];
    const state = mainLiftState[pattern];
    const exercise = prompt(`Exercise for ${meta.label}:`, state.activeExercise || meta.defaultExercise);
    if (!exercise || !exercise.trim()) return;
    const payload = prompt('Enter WEIGHT x REPS', '80 x 8');
    if (!payload) return;
    const parsed = parseWeightRepInput(payload);
    if (!parsed) return console.warn('Use format like 80 x 8');
    mainLiftState[pattern].activeExercise = exercise.trim();
    saveMainLiftState();

    const splitLabel = `Main Lift`;
    const serverSaved = await postWorkoutToServer([{ exercise: exercise.trim(), sets: [{ weight: parsed.weight, reps: parsed.reps, setType: 'leading' }] }], splitLabel);
    if (serverSaved) {
        markGymTelemetry(splitLabel);
        await loadFitnessFromServer({ silent: false });
        refreshCoreView();
        return;
    }

    logSetLocally({ split: splitLabel, exercise: exercise.trim(), weight: parsed.weight, reps: parsed.reps, setType: 'leading', loggedAt: new Date().toISOString() });
    renderFitnessView();
    refreshCoreView();
}

function setActiveMainLiftExercise(pattern) {
    const current = mainLiftState[pattern].activeExercise || MAIN_LIFT_META[pattern].defaultExercise;
    const updated = prompt(`Active exercise for ${MAIN_LIFT_META[pattern].label}:`, current);
    if (!updated || !updated.trim()) return;
    mainLiftState[pattern].activeExercise = updated.trim();
    saveMainLiftState();
    renderFitnessView();
}

function toggleMainLiftHistory(pattern) {
    fitnessUiState.expandedMainLift = fitnessUiState.expandedMainLift === pattern ? null : pattern;
    renderFitnessView();
}

function switchMainLiftChartMode(mode) {
    fitnessUiState.chartMode = mode;
    localStorage.setItem('axis_main_lift_chart_mode', mode);
    renderFitnessView();
}

function logSetLocally({ split, exercise, weight, reps, setType, classification = null, rir = null, effortNote = null, groupId = null, loggedAt }) {
    const dateObj = new Date(loggedAt || Date.now());
    const timestamp = dateObj.getTime();
    const dateLabel = formatDateLabel(dateObj);
    const e1rm = calculateLiftE1RM(weight, reps);
    const localClassification = classification || (setType === 'leading' ? 'top_set' : setType || 'accessory');
    const archiveTags = formatFitnessSetTags({ classification: localClassification, rir, effortNote });

    pushRecentArchive({ id: timestamp, split, exercise, sets: formatSetDisplay(weight, reps) + `${archiveTags} // e1RM ~${e1rm}kg`, date: dateLabel });
    pushExerciseMemory({ split, exercise, weight, reps, setType, classification: localClassification, rir, effortNote, e1rm, timestamp, dateLabel, groupId });

    const pattern = getMainLiftPatternForExercise(exercise);
    if (pattern && localClassification === 'top_set') {
        mainLiftState[pattern].activeExercise = exercise;
        mainLiftState[pattern].history.push({
            id: `ml-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
            sessionDateKey: dateObj.toISOString().slice(0, 10),
            dateLabel,
            timestamp,
            exercise,
            weight,
            reps,
            e1rm
        });
        mainLiftState[pattern].history.sort((a, b) => a.timestamp - b.timestamp);
        saveMainLiftState();
    }

    markGymTelemetry(split, timestamp);
}

function pushRecentArchive(entry) {
    recentWorkoutArchives.unshift(entry);
    if (recentWorkoutArchives.length > 8) recentWorkoutArchives.pop();
    localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));
}

function pushExerciseMemory({ split, exercise, weight, reps, setType, classification = null, rir = null, effortNote = null, groupId = null, e1rm, timestamp = Date.now(), dateLabel = formatDateLabel(new Date(timestamp)) }) {
    exerciseMemoryLog.unshift({
        id: `mem-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: groupId || null,
        split,
        exercise,
        weight,
        reps,
        setType,
        classification,
        rir,
        effortNote,
        e1rm,
        timestamp,
        dateLabel,
        sessionDateKey: new Date(timestamp).toISOString().slice(0, 10),
        seriesText: `${reps}x${weight}kg${formatFitnessSetTags({ classification, rir, effortNote })}`
    });
    localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
}

function renderWorkoutArchivesHTML() {
    if (!recentWorkoutArchives.length) {
        return `<div class="font-mono text-sm text-muted" style="background: rgba(255,255,255,0.03); padding: 12px;">No logs yet.</div>`;
    }
    return recentWorkoutArchives.map(a => `
        <div class="row font-mono" style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--hud-violet); padding: 10px 12px; justify-content: space-between; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="text-main font-bold text-base text-truncate">${a.exercise}</div>
                <div class="text-muted text-sm text-truncate">${a.split} • ${a.date}</div>
            </div>
            <div class="text-optimal font-bold text-right flex-shrink-0 text-base">${a.sets}</div>
        </div>`).join('');
}

function renderMainLiftChartHTML() {
    const seriesMap = buildChartSeriesMap(fitnessUiState.chartMode);
    const allSeries = Object.values(seriesMap).filter(series => series.length > 0);
    if (!allSeries.length) {
        return `<div class="font-mono text-muted text-center" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); min-height: 240px; display: flex; justify-content: center; align-items: center; line-height: 1.7; padding: 20px;">No main-lift data yet.</div>`;
    }

    const width = 1160, height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    let allValues = allSeries.flat().map(p => p.metricValue);
    let minValue = Math.min(...allValues), maxValue = Math.max(...allValues);
    if (minValue === maxValue) { minValue -= 5; maxValue += 5; }
    const pad = Math.max((maxValue - minValue) * 0.12, 3);
    minValue -= pad; maxValue += pad;

    const globalDates = getGlobalMainLiftSessionDates();
    const xStep = globalDates.length <= 1 ? plotWidth / 2 : plotWidth / (globalDates.length - 1);
    const ticks = Array.from({ length: 5 }, (_, i) => {
        const ratio = i / 4;
        const y = margin.top + plotHeight * ratio;
        const value = maxValue - (maxValue - minValue) * ratio;
        return { y, value };
    });

    const gridSvg = ticks.map(t => `<g><line x1="${margin.left}" y1="${t.y.toFixed(2)}" x2="${width - margin.right}" y2="${t.y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-width="1" /><text x="${margin.left - 10}" y="${(t.y + 4).toFixed(2)}" text-anchor="end" fill="#64748b" font-family="Courier New, monospace" font-size="10">${formatChartMetric(t.value)}</text></g>`).join('');
    const xLabels = globalDates.map((dateKey, idx) => `<text x="${(margin.left + xStep * idx).toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="#64748b" font-family="Courier New, monospace" font-size="10">${formatShortDateKey(dateKey)}</text>`).join('');

    const seriesSvg = Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const points = seriesMap[pattern] || [];
        if (!points.length) return '';
        const pointString = points.map(point => {
            const x = margin.left + xStep * point.globalIndex;
            const yRatio = (point.metricValue - minValue) / (maxValue - minValue);
            const y = margin.top + (plotHeight - plotHeight * yRatio);
            point._x = x; point._y = y;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
        const dots = points.map(point => `<circle cx="${point._x.toFixed(2)}" cy="${point._y.toFixed(2)}" r="4" fill="${meta.color}" stroke="#03050a" stroke-width="1.5"><title>${meta.label} // ${point.exercise}\n${point.dateLabel}\n${formatSetDisplay(point.weight, point.reps)}\n${fitnessUiState.chartMode === 'index' ? `Index: ${point.metricValue.toFixed(1)}` : `e1RM: ~${point.metricValue.toFixed(1)}`}</title></circle>`).join('');
        return `<g><polyline fill="none" stroke="${meta.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pointString}" opacity="0.95" />${dots}</g>`;
    }).join('');

    return `<div class="overflow-x-auto" style="background: linear-gradient(180deg, rgba(8,12,22,0.88), rgba(3,5,10,0.96)); border: 1px solid rgba(255,255,255,0.06); padding: 16px;"><svg viewBox="0 0 ${width} ${height}" style="width: 100%; min-width: 900px; height: auto; display: block;">${gridSvg}<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" /><line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" />${seriesSvg}${xLabels}</svg></div>`;
}

function renderMainLiftLegendHTML() {
    return Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const latest = mainLiftState[pattern].history.slice(-1)[0];
        return `<div class="row" style="gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 7px 10px;"><span style="width: 11px; height: 11px; border-radius: 50%; background: ${meta.color}; display: inline-block;"></span><span class="font-mono text-sm text-main font-bold">${meta.label}</span><span class="font-mono text-sm text-muted">${latest ? formatSetDisplay(latest.weight, latest.reps) : 'NO DATA'}</span></div>`;
    }).join('');
}

function buildChartSeriesMap(mode = 'index') {
    const globalDates = getGlobalMainLiftSessionDates();
    const indexLookup = Object.fromEntries(globalDates.map((d, i) => [d, i]));
    let out = {};
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        const history = Object.values(compressPatternHistoryByDate(pattern)).sort((a, b) => a.timestamp - b.timestamp);
        if (!history.length) { out[pattern] = []; return; }
        const firstE1RM = history[0].e1rm || 1;
        out[pattern] = history.map(entry => ({ ...entry, globalIndex: indexLookup[entry.sessionDateKey], metricValue: mode === 'index' ? ((entry.e1rm / firstE1RM) * 100) : entry.e1rm }));
    });
    return out;
}

function compressPatternHistoryByDate(pattern) {
    const byDate = {};
    (mainLiftState[pattern].history || []).forEach(entry => { byDate[entry.sessionDateKey] = entry; });
    return byDate;
}

function getGlobalMainLiftSessionDates() {
    const set = new Set();
    Object.keys(MAIN_LIFT_META).forEach(pattern => (mainLiftState[pattern].history || []).forEach(entry => set.add(entry.sessionDateKey)));
    return Array.from(set).sort();
}

function getMainLiftPatternForExercise(exerciseName) {
    const normalized = String(exerciseName || '').trim().toLowerCase();
    if (!normalized) return null;
    for (const pattern of Object.keys(MAIN_LIFT_EXERCISE_MAP)) {
        if (MAIN_LIFT_EXERCISE_MAP[pattern].some(name => name.toLowerCase() === normalized)) return pattern;
    }
    return null;
}

function getMainLiftStatus(pattern) {
    const history = mainLiftState[pattern].history || [];
    const meta = MAIN_LIFT_META[pattern];
    if (!history.length) return { label: 'STBY', textColor: 'var(--text-muted)', borderColor: 'rgba(100,116,139,0.28)', glow: 'transparent' };
    if (history.length < 3) return { label: 'NEW', textColor: 'var(--hud-cyan)', borderColor: 'rgba(56,189,248,0.28)', glow: 'transparent' };
    const last3 = history.slice(-3);
    const below = last3.filter(entry => entry.reps < meta.repLower).length;
    if (below >= 2) return { label: below === 3 ? 'CRIT' : 'WARN', textColor: below === 3 ? 'var(--hud-critical)' : 'var(--hud-warning)', borderColor: below === 3 ? 'rgba(244,63,94,0.35)' : 'rgba(245,158,11,0.35)', glow: 'transparent' };
    const first = history[0], latest = history[history.length - 1];
    return { label: latest.e1rm >= first.e1rm ? 'OK' : 'WATCH', textColor: latest.e1rm >= first.e1rm ? 'var(--hud-optimal)' : 'var(--hud-warning)', borderColor: latest.e1rm >= first.e1rm ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)', glow: 'transparent' };
}

function getBestMainLiftEntry(pattern) {
    const history = mainLiftState[pattern].history || [];
    if (!history.length) return null;
    return [...history].sort((a, b) => b.e1rm - a.e1rm)[0];
}

function getExerciseMemoryRows(exerciseName) {
    const rows = exerciseMemoryLog.filter(row => row.exercise === exerciseName).sort((a, b) => b.timestamp - a.timestamp);
    const grouped = [];
    const seen = new Set();
    for (const row of rows) {
        const key = row.groupId || `${row.exercise}-${row.sessionDateKey}-${row.seriesText || row.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        grouped.push({
            ...row,
            seriesText: row.seriesText || `${row.reps}x${row.weight}kg`
        });
    }
    return grouped;
}

function parseWeightRepInput(text) {
    const clean = String(text || '').toLowerCase().replace('kg', '').trim();
    const match = clean.match(/(\d+(?:\.\d+)?)\s*[x/]\s*(\d+)/i) || clean.match(/(\d+(?:\.\d+)?)\s+(\d+)/i);
    if (!match) return null;
    return { weight: parseFloat(match[1]), reps: parseInt(match[2], 10) };
}

function calculateLiftE1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps * 0.0333));
}

function formatDateLabel(dateObj) {
    const date = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
}

function formatShortDateKey(dateKey) {
    const [y, m, d] = String(dateKey).split('-');
    return `${d}/${m}`;
}

function formatChartMetric(value) { return value.toFixed(0); }

function formatSetDisplay(weight, reps) {
    return `${reps} x ${weight}kg`;
}

function saveMainLiftState() {
    localStorage.setItem('axis_main_lift_state', JSON.stringify(mainLiftState));
}

function shouldUseServerFitnessSync() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadFitnessFromServer({ silent = false } = {}) {
    if (!shouldUseServerFitnessSync()) return false;
    try {
        const resp = await fetch('/api/fitness', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);

        if (Array.isArray(data.recentArchives)) recentWorkoutArchives = data.recentArchives;
        if (Array.isArray(data.exerciseMemory)) exerciseMemoryLog = data.exerciseMemory;
        if (data.mainLiftState) mainLiftState = normalizeMainLiftState(data.mainLiftState);
        fitnessServerState.latestSession = data.latestSession || null;

        localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));
        localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
        saveMainLiftState();

        fitnessServerState.loaded = true;
        fitnessServerState.syncMode = 'server';
        fitnessServerState.lastError = '';
        fitnessServerState.lastLoadedAt = Date.now();

        if (!(silent && fitnessServerState.isEditing)) renderFitnessView();
        if (typeof refreshCoreView === 'function') refreshCoreView();
        return true;
    } catch (e) {
        fitnessServerState.lastError = e.message || 'SERVER FITNESS LOAD FAILED';
        fitnessServerState.syncMode = 'local';
        return false;
    }
}

async function postWorkoutToServer(exercises, splitName, loggedAt = null, action = 'create') {
    if (!shouldUseServerFitnessSync()) return false;
    try {
        const payload = {
            action: action === 'replace-last' ? 'replace-last' : '',
            splitName,
            loggedAt,
            exercises: exercises.map(ex => ({
                exercise: ex.exercise,
                sets: ex.sets.map((set, idx) => ({
                    weight: set.weight,
                    reps: set.reps,
                    setType: set.setType || ex.setType || (idx === 0 ? 'leading' : 'backoff'),
                    classification: set.classification || null,
                    rir: set.rir ?? null,
                    effortNote: set.effortNote || null
                }))
            }))
        };

        const resp = await fetch('/api/fitness', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        fitnessServerState.syncMode = 'server';
        fitnessServerState.lastError = '';
        return true;
    } catch (e) {
        fitnessServerState.lastError = e.message || 'SERVER WRITE FAILED';
        fitnessServerState.syncMode = 'local';
        return false;
    }
}

async function manualFitnessSync() {
    const ok = await loadFitnessFromServer({ silent: false });
    if (!ok) console.warn(`FITNESS SYNC FAILED: ${fitnessServerState.lastError || 'UNKNOWN ERROR'}`);
}

async function importHistoricalData() {
    if (localStorage.getItem('axis_history_seed_v1_imported') === 'true') {
        if (!confirm('Past data already imported once. Import again anyway?')) return;
    } else {
        if (!confirm('Import the valid past workout history into AXIS?')) return;
    }

    let imported = 0;
    for (const session of HISTORICAL_FITNESS_SESSIONS) {
        const saved = await postWorkoutToServer(session.exercises, session.splitName, session.loggedAt);
        if (saved) {
            imported += 1;
        } else {
            applyHistoricalSessionLocally(session);
            imported += 1;
        }
    }

    localStorage.setItem('axis_history_seed_v1_imported', 'true');
    await loadFitnessFromServer({ silent: true });
    renderFitnessView();
    refreshCoreView();
    console.log(`Imported ${imported} historical sessions.`);
}

function applyHistoricalSessionLocally(session) {
    session.exercises.forEach((exerciseItem) => {
        exerciseItem.sets.forEach((set, idx) => {
            const pattern = getMainLiftPatternForExercise(exerciseItem.exercise);
            const setType = pattern ? (idx === 0 ? 'leading' : 'backoff') : 'accessory';
            logSetLocally({ split: session.splitName, exercise: exerciseItem.exercise, weight: set.weight, reps: set.reps, setType, loggedAt: session.loggedAt });
        });
    });
}

async function resetFitnessLogs() {
    if (!confirm('Clear all current fitness logs? This is for testing.')) return;

    clearLocalFitnessData();

    if (shouldUseServerFitnessSync()) {
        try {
            const resp = await fetch('/api/fitness', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset' })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        } catch (e) {
            console.warn(`SERVER RESET FAILED: ${e.message}`);
        }
    }

    renderFitnessView();
    refreshCoreView();
}

function clearLocalFitnessData() {
    recentWorkoutArchives = [];
    exerciseMemoryLog = [];
    mainLiftState = buildDefaultMainLiftState();
    localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));
    localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
    saveMainLiftState();
    localStorage.removeItem('axis_history_seed_v1_imported');
    todayTelemetry.gymLogged = false;
    todayTelemetry.gymSplit = 'None';
    localStorage.setItem('axis_today_gym', 'false');
    localStorage.setItem('axis_today_gym_split', 'None');
}

function markGymTelemetry(splitLabel, timestamp = Date.now()) {
    todayTelemetry.gymLogged = true;
    todayTelemetry.gymSplit = splitLabel || 'Tracked Session';
    todayTelemetry.lastLoggedTimestamp = timestamp;
    localStorage.setItem('axis_today_gym', 'true');
    localStorage.setItem('axis_today_gym_split', todayTelemetry.gymSplit);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
}

function refreshFitnessView() {
    renderFitnessView();
}

function renderWaterCartridgesHTML(waterTaps) {
    let html = '';
    for (let i = 1; i <= 7; i++) {
        const isFull = i <= waterTaps;
        html += `<button type="button" onclick="tapWaterCartridge(${i})" class="cursor-pointer" style="width: 40px; height: 54px; border: 1px solid ${isFull ? 'rgba(173,181,191,0.34)' : 'rgba(255,255,255,0.10)'}; border-radius: 14px; display: flex; flex-direction: column; justify-content: flex-end; padding: 4px; position: relative; background: rgba(255,255,255,0.03); box-shadow: none; appearance:none;"><div style="width: 100%; height: ${isFull ? '100%' : '0%'}; background: linear-gradient(180deg, rgba(173,181,191,0.95), rgba(173,181,191,0.56)); border-radius: 10px; transition: height 0.22s cubic-bezier(0.16, 1, 0.3, 1);"></div><span class="font-mono font-bold" style="position: absolute; width: 100%; text-align: center; font-size: 0.6rem; color: ${isFull ? 'var(--text-main)' : 'var(--text-muted)'}; bottom: -18px; left: 0;">#${i}</span></button>`;
    }
    return html;
}

async function tapWaterCartridge(tapNum) {
    const targetLiters = parseFloat((tapNum * 0.6).toFixed(1));
    if (todayTelemetry.waterLiters === targetLiters) {
        todayTelemetry.waterLiters = Math.max(0, parseFloat(((tapNum - 1) * 0.6).toFixed(1)));
    } else {
        todayTelemetry.waterLiters = targetLiters;
    }
    localStorage.setItem('axis_today_water', todayTelemetry.waterLiters);
    if (typeof renderNutritionView === 'function') renderNutritionView();
    if (typeof refreshCoreView === 'function') refreshCoreView();
    if (typeof shouldUseDailyServer === 'function' && shouldUseDailyServer()) {
        try {
            await fetch('/api/daily', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'water-set', amount: todayTelemetry.waterLiters })
            });
        } catch {}
    }
}

async function resetWater() {
    todayTelemetry.waterLiters = 0;
    localStorage.setItem('axis_today_water', 0);
    if (typeof renderNutritionView === 'function') renderNutritionView();
    if (typeof refreshCoreView === 'function') refreshCoreView();
    if (typeof shouldUseDailyServer === 'function' && shouldUseDailyServer()) {
        try {
            await fetch('/api/daily', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'water-reset' })
            });
        } catch {}
    }
}

function setFitnessEditing(flag) {
    fitnessServerState.isEditing = !!flag;
}

function refreshFitnessWater() {
    renderFitnessView();
}
