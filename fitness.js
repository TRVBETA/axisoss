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
    horizontal_press: { label: 'H PRESS', color: '#a855f7', repLower: 3, defaultExercise: 'Incline Barbell Bench Press' },
    vertical_press: { label: 'V PRESS', color: '#818cf8', repLower: 5, defaultExercise: 'Machine Shoulder Press' },
    horizontal_pull: { label: 'H PULL', color: '#38bdf8', repLower: 6, defaultExercise: 'Seated Wide-Grip Row' },
    vertical_pull: { label: 'V PULL', color: '#3b82f6', repLower: 6, defaultExercise: 'Wide-Grip Lat Pulldown' }
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
    lastLoadedAt: 0
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
            <span style="font-size: 0.75rem; color: var(--text-muted);">${renderFitnessSyncBadgeText()}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 32px; align-items: start;">
            <div class="cockpit-card" style="padding: 22px; gap: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">MAIN LIFTS</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="tactical-btn" style="padding: 6px 12px; font-size: 0.68rem;" onclick="manualFitnessSync()">SYNC</button>
                        <button class="tactical-btn" style="padding: 6px 12px; font-size: 0.68rem; border-color: var(--hud-cyan);" onclick="importHistoricalData()">IMPORT PAST DATA</button>
                        <button class="tactical-btn" style="padding: 6px 12px; font-size: 0.68rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="resetFitnessLogs()">CLEAR LOGS</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    ${renderMainLiftCardsHTML()}
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div class="cockpit-card" style="padding: 22px; gap: 16px;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-violet); font-weight: bold;">WORKOUT LOG</div>
                    <form onsubmit="handleTacticalWorkoutLog(event)" style="display: flex; flex-direction: column; gap: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Split</label>
                            <select class="tactical-select" id="workout-split-select" onchange="updateExerciseDropdown()">${splitOptions}</select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Exercise</label>
                            <select class="tactical-select" id="workout-exercise-select" onchange="refreshSelectedExerciseMemory()"></select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Reps</label>
                                <input type="number" class="tactical-input" id="workout-reps" placeholder="e.g. 8" required min="1" max="100" value="8">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">KG</label>
                                <input type="number" step="0.5" class="tactical-input" id="workout-weight" placeholder="e.g. 80" required min="1" max="500" value="80">
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Type</label>
                            <div style="display: flex; gap: 14px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.86rem;">
                                <label><input type="radio" name="set_type" value="leading" checked> Leading</label>
                                <label><input type="radio" name="set_type" value="backoff"> Backoff</label>
                                <label><input type="radio" name="set_type" value="accessory"> Accessory</label>
                            </div>
                        </div>
                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%;">SAVE LOG</button>
                    </form>
                    <div id="selected-exercise-memory-panel"></div>
                </div>

                <div class="cockpit-card" style="padding: 22px; gap: 16px;">
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-main); font-weight: bold;">RECENT LOGS</div>
                    <div id="workout-archives-list" style="display: flex; flex-direction: column; gap: 10px;">${renderWorkoutArchivesHTML()}</div>
                </div>
            </div>
        </div>

        <div class="cockpit-card" style="padding: 22px; gap: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div>
                    <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--hud-cyan); font-weight: bold;">MAIN LIFT CHART</div>
                    <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">6 movement patterns</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'index' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('index')" style="padding: 6px 12px; font-size: 0.68rem;">INDEXED</button>
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'e1rm' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('e1rm')" style="padding: 6px 12px; font-size: 0.68rem;">E1RM</button>
                </div>
            </div>
            ${renderMainLiftChartHTML()}
            <div style="display: flex; gap: 10px; flex-wrap: wrap; font-family: var(--font-mono);">${renderMainLiftLegendHTML()}</div>
        </div>
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
            <div style="background: var(--bg-surface); border: 1px solid ${status.borderColor}; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div>
                        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: ${meta.color}; font-weight: bold; letter-spacing: 2px;">${meta.label}</div>
                        <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-main); font-weight: bold; margin-top: 6px; line-height: 1.35;">${state.activeExercise || meta.defaultExercise}</div>
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.66rem; color: ${status.textColor}; font-weight: bold; white-space: nowrap;">${status.label}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: var(--font-mono); font-size: 0.72rem;">
                    <div style="background: rgba(255,255,255,0.03); padding: 8px;">
                        <div style="color: var(--text-muted); margin-bottom: 4px;">Last</div>
                        <div style="color: var(--text-main); font-weight: bold;">${latest ? formatSetDisplay(latest.weight, latest.reps) : '--'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 8px;">
                        <div style="color: var(--text-muted); margin-bottom: 4px;">e1RM</div>
                        <div style="color: ${meta.color}; font-weight: bold;">${latest ? `~${latest.e1rm}` : '--'}</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 8px; font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); flex-wrap: wrap;">
                    <span>Best <strong style="color: var(--text-main);">${best ? formatSetDisplay(best.weight, best.reps) : '--'}</strong></span>
                    <span>Δ <strong style="color: ${delta >= 0 ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">${latest && first ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : '--'}</strong></span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
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
        return `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 10px;">No history yet.</div>`;
    }
    return `<div style="display: flex; flex-direction: column; gap: 6px;">${rows.map(row => `
        <div style="display: grid; grid-template-columns: 62px 1fr 92px; gap: 8px; align-items: center; background: rgba(255,255,255,0.03); border-left: 3px solid ${MAIN_LIFT_META[pattern].color}; padding: 8px 10px; font-family: var(--font-mono); font-size: 0.7rem;">
            <div style="color: var(--hud-cyan); font-weight: bold;">${row.dateLabel}</div>
            <div style="color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.exercise}</div>
            <div style="text-align: right; color: ${MAIN_LIFT_META[pattern].color}; font-weight: bold;">${formatSetDisplay(row.weight, row.reps)}</div>
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
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-main); font-weight: bold;">${exerciseName}</div>
                <div style="font-family: var(--font-mono); font-size: 0.68rem; color: ${color};">${pattern ? MAIN_LIFT_META[pattern].label : 'MEMORY'}</div>
            </div>
            ${rows.length === 0 ? `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 10px;">No saved history yet.</div>` : `<div style="display: flex; flex-direction: column; gap: 6px;">${rows.map(row => `
                <div style="display: grid; grid-template-columns: 62px 1fr 92px; gap: 8px; align-items: center; background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; padding: 8px 10px; font-family: var(--font-mono); font-size: 0.7rem;">
                    <div style="color: var(--hud-cyan); font-weight: bold;">${row.dateLabel}</div>
                    <div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.split}</div>
                    <div style="text-align: right; color: var(--text-main); font-weight: bold;">${formatSetDisplay(row.weight, row.reps)}</div>
                </div>`).join('')}</div>`}
        </div>
    `;
}

async function handleTacticalWorkoutLog(e) {
    e.preventDefault();
    const split = document.getElementById('workout-split-select').value;
    const exercise = document.getElementById('workout-exercise-select').value;
    const reps = parseInt(document.getElementById('workout-reps').value, 10);
    const weight = parseFloat(document.getElementById('workout-weight').value);
    const setType = document.querySelector('input[name="set_type"]:checked').value;
    if (!exercise || !weight || !reps) return;

    const serverSaved = await postWorkoutToServer([{ exercise, sets: [{ weight, reps, setType }] }], split);
    if (serverSaved) {
        markGymTelemetry(split);
        await loadFitnessFromServer({ silent: false });
        refreshCoreView();
        return;
    }

    logSetLocally({ split, exercise, weight, reps, setType, loggedAt: new Date().toISOString() });
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
    if (!parsed) return alert('Use format like 80 x 8');
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

function logSetLocally({ split, exercise, weight, reps, setType, loggedAt }) {
    const dateObj = new Date(loggedAt || Date.now());
    const timestamp = dateObj.getTime();
    const dateLabel = formatDateLabel(dateObj);
    const e1rm = calculateLiftE1RM(weight, reps);

    pushRecentArchive({ id: timestamp, split, exercise, sets: formatSetDisplay(weight, reps) + ` (${setType.toUpperCase()} // e1RM ~${e1rm}kg)`, date: dateLabel });
    pushExerciseMemory({ split, exercise, weight, reps, setType, e1rm, timestamp, dateLabel });

    const pattern = getMainLiftPatternForExercise(exercise);
    if (pattern && setType === 'leading') {
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

function pushExerciseMemory({ split, exercise, weight, reps, setType, e1rm, timestamp = Date.now(), dateLabel = formatDateLabel(new Date(timestamp)) }) {
    exerciseMemoryLog.unshift({ id: `mem-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, split, exercise, weight, reps, setType, e1rm, timestamp, dateLabel, sessionDateKey: new Date(timestamp).toISOString().slice(0, 10) });
    localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
}

function renderWorkoutArchivesHTML() {
    if (!recentWorkoutArchives.length) {
        return `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 12px;">No logs yet.</div>`;
    }
    return recentWorkoutArchives.map(a => `
        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--hud-violet); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-family: var(--font-mono);">
            <div style="min-width: 0;">
                <div style="font-weight: bold; color: var(--text-main); font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.exercise}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.split} • ${a.date}</div>
            </div>
            <div style="color: var(--hud-optimal); font-weight: bold; text-align: right; font-size: 0.78rem; flex-shrink: 0;">${a.sets}</div>
        </div>`).join('');
}

function renderMainLiftChartHTML() {
    const seriesMap = buildChartSeriesMap(fitnessUiState.chartMode);
    const allSeries = Object.values(seriesMap).filter(series => series.length > 0);
    if (!allSeries.length) {
        return `<div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); min-height: 240px; display: flex; justify-content: center; align-items: center; text-align: center; font-family: var(--font-mono); color: var(--text-muted); line-height: 1.7; padding: 20px;">No main-lift data yet.</div>`;
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

    return `<div style="width: 100%; overflow-x: auto; background: linear-gradient(180deg, rgba(8,12,22,0.88), rgba(3,5,10,0.96)); border: 1px solid rgba(255,255,255,0.06); padding: 16px;"><svg viewBox="0 0 ${width} ${height}" style="width: 100%; min-width: 900px; height: auto; display: block;">${gridSvg}<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" /><line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" />${seriesSvg}${xLabels}</svg></div>`;
}

function renderMainLiftLegendHTML() {
    return Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const latest = mainLiftState[pattern].history.slice(-1)[0];
        return `<div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 7px 10px;"><span style="width: 11px; height: 11px; border-radius: 50%; background: ${meta.color}; display: inline-block;"></span><span style="font-size: 0.72rem; color: var(--text-main); font-family: var(--font-mono); font-weight: bold;">${meta.label}</span><span style="font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono);">${latest ? formatSetDisplay(latest.weight, latest.reps) : 'NO DATA'}</span></div>`;
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
    return exerciseMemoryLog.filter(row => row.exercise === exerciseName).sort((a, b) => b.timestamp - a.timestamp);
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
        const resp = await fetch('/api/fitness-feed', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);

        if (Array.isArray(data.recentArchives)) recentWorkoutArchives = data.recentArchives;
        if (Array.isArray(data.exerciseMemory)) exerciseMemoryLog = data.exerciseMemory;
        if (data.mainLiftState) mainLiftState = normalizeMainLiftState(data.mainLiftState);

        localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));
        localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
        saveMainLiftState();

        if (data.telemetry) {
            todayTelemetry.gymLogged = !!data.telemetry.gymLogged;
            todayTelemetry.gymSplit = data.telemetry.gymSplit || todayTelemetry.gymSplit;
            if (data.telemetry.lastLoggedTimestamp) todayTelemetry.lastLoggedTimestamp = data.telemetry.lastLoggedTimestamp;
            localStorage.setItem('axis_today_gym', todayTelemetry.gymLogged ? 'true' : 'false');
            localStorage.setItem('axis_today_gym_split', todayTelemetry.gymSplit || 'None');
            if (todayTelemetry.lastLoggedTimestamp) localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
        }

        fitnessServerState.loaded = true;
        fitnessServerState.syncMode = 'server';
        fitnessServerState.lastError = '';
        fitnessServerState.lastLoadedAt = Date.now();

        if (!silent) {
            renderFitnessView();
            if (typeof refreshCoreView === 'function') refreshCoreView();
        }
        return true;
    } catch (e) {
        fitnessServerState.lastError = e.message || 'SERVER FITNESS LOAD FAILED';
        fitnessServerState.syncMode = 'local';
        return false;
    }
}

async function postWorkoutToServer(exercises, splitName, loggedAt = null) {
    if (!shouldUseServerFitnessSync()) return false;
    try {
        const payload = {
            splitName,
            loggedAt,
            exercises: exercises.map(ex => ({
                exercise: ex.exercise,
                sets: ex.sets.map((set, idx) => ({
                    weight: set.weight,
                    reps: set.reps,
                    setType: set.setType || ex.setType || (idx === 0 ? 'leading' : 'backoff')
                }))
            }))
        };

        const resp = await fetch('/api/fitness-log', {
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
    if (!ok) alert(`FITNESS SYNC FAILED: ${fitnessServerState.lastError || 'UNKNOWN ERROR'}`);
}

async function importHistoricalData() {
    if (!confirm('Import the valid past workout history into AXIS?')) return;

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
    alert(`Imported ${imported} historical sessions.`);
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
            const resp = await fetch('/api/fitness-reset', { method: 'POST', credentials: 'same-origin' });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        } catch (e) {
            alert(`SERVER RESET FAILED: ${e.message}`);
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
        html += `<div onclick="tapWaterCartridge(${i})" style="width: 38px; height: 50px; border: 2px solid ${isFull ? 'var(--hud-cyan)' : 'var(--text-muted)'}; border-radius: 4px; display: flex; flex-direction: column; justify-content: flex-end; padding: 2px; cursor: pointer; position: relative; background: ${isFull ? 'var(--hud-cyan-glow)' : 'transparent'}; box-shadow: ${isFull ? '0 0 10px var(--hud-cyan)' : 'none'};"><div style="width: 100%; height: ${isFull ? '100%' : '0%'}; background: var(--hud-cyan); transition: height 0.3s;"></div><span style="position: absolute; width: 100%; text-align: center; font-family: var(--font-mono); font-size: 0.6rem; font-weight: bold; color: ${isFull ? '#000' : 'var(--text-muted)'}; bottom: -18px; left: 0;">#${i}</span></div>`;
    }
    return html;
}

function tapWaterCartridge(tapNum) {
    const targetLiters = parseFloat((tapNum * 0.6).toFixed(1));
    if (todayTelemetry.waterLiters === targetLiters) {
        todayTelemetry.waterLiters = Math.max(0, parseFloat(((tapNum - 1) * 0.6).toFixed(1)));
    } else {
        todayTelemetry.waterLiters = targetLiters;
    }
    localStorage.setItem('axis_today_water', todayTelemetry.waterLiters);
    if (typeof renderNutritionView === 'function') renderNutritionView();
    if (typeof refreshCoreView === 'function') refreshCoreView();
}

function resetWater() {
    todayTelemetry.waterLiters = 0;
    localStorage.setItem('axis_today_water', 0);
    if (typeof renderNutritionView === 'function') renderNutritionView();
    if (typeof refreshCoreView === 'function') refreshCoreView();
}

function refreshFitnessWater() {
    renderFitnessView();
}
