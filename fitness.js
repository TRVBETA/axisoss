/* ==========================================
   AXIS OS // fitness.js
   FITNESS COMMAND CENTER
   - IP Method Main Lift Tracker
   - Exercise Memory
   - Hydration Cartridges (600ml)
   - Tactical Workout Logging
   ========================================== */

const OBSIDIAN_SPLITS = {
    "Chest + Back": [
        "Incline Barbell Bench Press", "Machine Chest Press", "Upper/Mid Cable Fly",
        "Wide-Grip Lat Pulldown", "Shoulder-Width Lat Pulldown", "Seated Wide-Grip Row",
        "Single-Arm Cable Row", "Cable Shrugs"
    ],
    "Shoulders + Arms": [
        "Machine Shoulder Press", "Cable Lateral Raises", "Shoulder Extension Machine",
        "Dumbbell Incline Curls", "Bayesian Cable Curls", "Hammer Curls",
        "Triceps Cable Pushdowns", "Single-Arm Cable Pushdowns", "Overhead Cable Extensions"
    ],
    "Legs": [
        "Back Squat", "Hack Squat", "Romanian Deadlift", "Leg Press", "Calf Raises"
    ]
};

const MAIN_LIFT_META = {
    squat: {
        label: 'SQUAT',
        shortLabel: 'SQ',
        color: '#10b981',
        repLower: 3,
        defaultExercise: 'Back Squat'
    },
    hinge: {
        label: 'HINGE',
        shortLabel: 'HG',
        color: '#f59e0b',
        repLower: 3,
        defaultExercise: 'Romanian Deadlift'
    },
    horizontal_press: {
        label: 'HORIZONTAL PRESS',
        shortLabel: 'HP',
        color: '#a855f7',
        repLower: 3,
        defaultExercise: 'Incline Barbell Bench Press'
    },
    vertical_press: {
        label: 'VERTICAL PRESS',
        shortLabel: 'VP',
        color: '#38bdf8',
        repLower: 5,
        defaultExercise: 'Machine Shoulder Press'
    },
    horizontal_pull: {
        label: 'HORIZONTAL PULL',
        shortLabel: 'HL',
        color: '#60a5fa',
        repLower: 6,
        defaultExercise: 'Seated Wide-Grip Row'
    },
    vertical_pull: {
        label: 'VERTICAL PULL',
        shortLabel: 'VL',
        color: '#f43f5e',
        repLower: 6,
        defaultExercise: 'Wide-Grip Lat Pulldown'
    }
};

const MAIN_LIFT_EXERCISE_MAP = {
    squat: ['Back Squat', 'Hack Squat', 'Front Squat', 'Leg Press'],
    hinge: ['Romanian Deadlift', 'Conventional Deadlift', 'Sumo Deadlift', 'Hip Thrust', 'Good Morning'],
    horizontal_press: ['Incline Barbell Bench Press', 'Incline Bench', 'Machine Chest Press', 'Flat Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press'],
    vertical_press: ['Machine Shoulder Press', 'Shoulder Press', 'Overhead Press', 'Dumbbell Shoulder Press', 'Landmine Press', 'Push Press'],
    horizontal_pull: ['Seated Wide-Grip Row', 'Seated Row', 'Single-Arm Cable Row', 'Cable Row', 'Chest-Supported Row', 'Barbell Row', 'T-Bar Row', 'Seal Row'],
    vertical_pull: ['Wide-Grip Lat Pulldown', 'Wide Lat Pulldown', 'Shoulder-Width Lat Pulldown', 'Lat Pulldown', 'Neutral Grip Pulldown', 'Pull-Up', 'Chin-Up']
};

let recentWorkoutArchives = JSON.parse(localStorage.getItem('axis_workout_archives') || '[]');
let exerciseMemoryLog = JSON.parse(localStorage.getItem('axis_exercise_memory') || '[]');
let fitnessUiState = {
    expandedMainLift: null,
    chartMode: localStorage.getItem('axis_main_lift_chart_mode') || 'index'
};

if (recentWorkoutArchives.length === 0) {
    recentWorkoutArchives = [
        { id: 1, split: 'Chest + Back', exercise: 'Incline Barbell Bench Press', sets: '85kg x 8, 85kg x 6', date: 'Yesterday' },
        { id: 2, split: 'Shoulders + Arms', exercise: 'Machine Shoulder Press', sets: '70kg x 10, 75kg x 8', date: '17 June' },
        { id: 3, split: 'Chest + Back', exercise: 'Wide-Grip Lat Pulldown', sets: '90kg x 12, 95kg x 10', date: '15 June' }
    ];
}

function buildDefaultMainLiftState() {
    let state = {};
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        state[pattern] = {
            activeExercise: MAIN_LIFT_META[pattern].defaultExercise,
            history: []
        };
    });
    return state;
}

function normalizeMainLiftState(rawState) {
    let state = buildDefaultMainLiftState();

    if (!rawState || typeof rawState !== 'object') return state;

    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        let raw = rawState[pattern] || {};
        state[pattern].activeExercise = raw.activeExercise || state[pattern].activeExercise;
        state[pattern].history = Array.isArray(raw.history)
            ? raw.history
                .filter(x => x && typeof x === 'object')
                .map(x => ({
                    id: x.id || ('ml-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
                    sessionDateKey: x.sessionDateKey || 'unknown-date',
                    dateLabel: x.dateLabel || 'UNKNOWN',
                    timestamp: x.timestamp || Date.now(),
                    exercise: x.exercise || state[pattern].activeExercise,
                    weight: parseFloat(x.weight) || 0,
                    reps: parseInt(x.reps) || 0,
                    e1rm: parseFloat(x.e1rm) || calculateLiftE1RM(parseFloat(x.weight) || 0, parseInt(x.reps) || 0)
                }))
                .sort((a, b) => a.timestamp - b.timestamp)
            : [];
    });

    return state;
}

let mainLiftState = normalizeMainLiftState(JSON.parse(localStorage.getItem('axis_main_lift_state') || 'null'));

function initFitness() {
    renderFitnessView();
}

function renderFitnessView() {
    const container = document.getElementById('module-fitness');
    if (!container) return;

    let waterLiters = todayTelemetry.waterLiters;
    let waterTaps = Math.min(7, Math.floor(waterLiters / 0.6));
    let splitOptions = Object.keys(OBSIDIAN_SPLITS).map(s => `<option value="${s}">${s}</option>`).join('');

    container.innerHTML = `
        <div class="cockpit-header">
            <span>BIOMETRIC TELEMETRY // FITNESS COMMAND CENTER</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">IP METHOD + EXERCISE MEMORY ACTIVE</span>
        </div>

        <div style="display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 40px; align-items: start;">
            
            <div style="display: flex; flex-direction: column; gap: 32px;">
                <div class="cockpit-card" style="padding: 28px; border-color: rgba(168, 85, 247, 0.35);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px;">
                        <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold;">
                            MAIN LIFTS // IP METHOD CONTROL
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); letter-spacing: 2px; text-align: right;">
                            LEADING SETS FEED THESE CARDS AUTOMATICALLY
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
                        ${renderMainLiftCardsHTML()}
                    </div>
                </div>

                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                        <span>HYDRATION TELEMETRY</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">UNIT: 600ML CARTRIDGE // GOAL: 4.0L</span>
                    </div>

                    <div style="margin: 16px 0; font-family: var(--font-mono); font-size: 1.4rem; font-weight: bold; color: var(--text-main);">
                        TOTAL LOGGED: <span style="color: var(--hud-cyan); text-shadow: 0 0 10px var(--hud-cyan-glow);">${waterLiters.toFixed(1)} L</span> / 4.0 L
                    </div>

                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
                        ${renderWaterCartridgesHTML(waterTaps)}
                    </div>

                    <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span>CLICK A BOTTLE CARTRIDGE TO CONSUME 600ML</span>
                        <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="resetWater()">PURGE WATER</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 32px;">
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 16px;">
                        TACTICAL WORKOUT LOG // OBSIDIAN SPLIT
                    </div>

                    <form onsubmit="handleTacticalWorkoutLog(event)" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">DISCIPLINE (LIFECYCLE SPLIT)</label>
                            <select class="tactical-select" id="workout-split-select" onchange="updateExerciseDropdown()">
                                ${splitOptions}
                            </select>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">EXERCISE</label>
                            <select class="tactical-select" id="workout-exercise-select" onchange="refreshSelectedExerciseMemory()"></select>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">WEIGHT (KG)</label>
                                <input type="number" step="0.5" class="tactical-input" id="workout-weight" placeholder="e.g. 85" required min="1" max="500" value="85">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">REPS</label>
                                <input type="number" class="tactical-input" id="workout-reps" placeholder="e.g. 8" required min="1" max="100" value="8">
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">SET TYPE</label>
                            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                                <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="set_type" value="leading" checked> 🔥 LEADING SET (IP METHOD)
                                </label>
                                <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="set_type" value="backoff"> 🔄 BACK-OFF SET
                                </label>
                                <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="set_type" value="accessory"> 📎 ACCESSORY SET
                                </label>
                            </div>
                        </div>

                        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); line-height: 1.6; background: var(--bg-surface); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px;">
                            If the selected exercise is mapped to one of the 6 IP movement patterns and you log it as a <strong style="color: var(--hud-optimal);">LEADING SET</strong>, AXIS automatically updates the main-lift tracker and progression chart.
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; margin-top: 8px;">
                            COMMIT TACTICAL LIFT &raquo;
                        </button>
                    </form>

                    <div id="selected-exercise-memory-panel" style="margin-top: 20px;"></div>
                </div>

                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between;">
                        <span>RECENT ARCHIVES</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">LAST 5 SESSION EVENTS</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;" id="workout-archives-list">
                        ${renderWorkoutArchivesHTML()}
                    </div>
                </div>
            </div>
        </div>

        <div class="cockpit-card" style="padding: 28px; border-color: rgba(56, 189, 248, 0.28);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                <div>
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; margin-bottom: 6px;">
                        6 MOVEMENT PROGRESSION // AUGMENTED TREND MAP
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                        Simultaneous line view for the 6 IP movement patterns. Default mode normalizes each lift to its own start point for cleaner comparison.
                    </div>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'index' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('index')" style="padding: 6px 14px; font-size: 0.72rem;">INDEXED</button>
                    <button class="tactical-btn ${fitnessUiState.chartMode === 'e1rm' ? 'cyan active' : ''}" onclick="switchMainLiftChartMode('e1rm')" style="padding: 6px 14px; font-size: 0.72rem;">E1RM</button>
                </div>
            </div>

            <div style="margin-top: 22px;">
                ${renderMainLiftChartHTML()}
            </div>

            <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-top: 18px; font-family: var(--font-mono);">
                ${renderMainLiftLegendHTML()}
            </div>
        </div>
    `;

    updateExerciseDropdown();
}

function renderMainLiftCardsHTML() {
    return Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const state = mainLiftState[pattern];
        const latest = state.history[state.history.length - 1] || null;
        const best = getBestMainLiftEntry(pattern);
        const status = getMainLiftStatus(pattern);
        const first = state.history[0] || null;
        const e1rmDelta = latest && first ? (latest.e1rm - first.e1rm) : 0;
        const isExpanded = fitnessUiState.expandedMainLift === pattern;

        return `
            <div style="background: linear-gradient(180deg, rgba(8, 12, 22, 0.95), rgba(13, 19, 34, 0.95)); border: 1px solid ${status.borderColor}; clip-path: var(--clip-corner-sm); padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 0 18px ${status.glow};">
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;">
                    <div>
                        <div style="font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 2px; color: ${meta.color}; font-weight: bold;">${meta.label}</div>
                        <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-top: 6px; line-height: 1.35;">
                            ${state.activeExercise || meta.defaultExercise}
                        </div>
                    </div>
                    <div style="padding: 4px 10px; border: 1px solid ${status.borderColor}; color: ${status.textColor}; font-family: var(--font-mono); font-size: 0.68rem; font-weight: bold; white-space: nowrap; background: rgba(255,255,255,0.02);">
                        ${status.label}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-family: var(--font-mono);">
                    <div style="background: var(--bg-surface); padding: 10px; border: 1px solid rgba(255,255,255,0.06);">
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 6px;">LAST TOP SET</div>
                        <div style="font-size: 0.92rem; font-weight: bold; color: var(--text-main);">${latest ? `${latest.weight}×${latest.reps}` : '--'}</div>
                    </div>
                    <div style="background: var(--bg-surface); padding: 10px; border: 1px solid rgba(255,255,255,0.06);">
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 6px;">CURRENT E1RM</div>
                        <div style="font-size: 0.92rem; font-weight: bold; color: ${meta.color};">${latest ? `~${latest.e1rm}` : '--'}</div>
                    </div>
                    <div style="background: var(--bg-surface); padding: 10px; border: 1px solid rgba(255,255,255,0.06);">
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 6px;">LIFECYCLE</div>
                        <div style="font-size: 0.92rem; font-weight: bold; color: var(--text-main);">${state.history.length ? `W${getLifecycleWeeks(pattern)}` : 'STBY'}</div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
                    <span>BEST: <strong style="color: var(--text-main);">${best ? `${best.weight}×${best.reps}` : '--'}</strong></span>
                    <span>Δ e1RM: <strong style="color: ${e1rmDelta >= 0 ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">${latest && first ? `${e1rmDelta >= 0 ? '+' : ''}${e1rmDelta.toFixed(1)}` : '--'}</strong></span>
                    <span>SESSIONS: <strong style="color: var(--hud-cyan);">${state.history.length}</strong></span>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="tactical-btn" style="padding: 6px 12px; font-size: 0.7rem;" onclick="quickLogMainLift('${pattern}')">QUICK LOG</button>
                    <button class="tactical-btn cyan" style="padding: 6px 12px; font-size: 0.7rem;" onclick="setActiveMainLiftExercise('${pattern}')">SET EXERCISE</button>
                    <button class="tactical-btn optimal" style="padding: 6px 12px; font-size: 0.7rem; border-color: ${meta.color};" onclick="toggleMainLiftHistory('${pattern}')">${isExpanded ? 'HIDE HISTORY' : 'SHOW HISTORY'}</button>
                </div>

                ${isExpanded ? renderMainLiftHistoryHTML(pattern) : ''}
            </div>
        `;
    }).join('');
}

function renderMainLiftHistoryHTML(pattern) {
    const history = [...mainLiftState[pattern].history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
    if (history.length === 0) {
        return `
            <div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); padding: 14px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
                No top-set memory yet. Log your first leading set to start this movement lifecycle.
            </div>
        `;
    }

    return `
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 2px;">
            ${history.map(entry => `
                <div style="display: grid; grid-template-columns: 90px 1fr 95px 75px; gap: 10px; align-items: center; background: var(--bg-surface); border-left: 3px solid ${MAIN_LIFT_META[pattern].color}; padding: 10px 12px; font-family: var(--font-mono); font-size: 0.76rem;">
                    <div style="color: var(--hud-cyan); font-weight: bold;">${entry.dateLabel}</div>
                    <div style="color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.exercise}</div>
                    <div style="color: var(--text-main); font-weight: bold;">${entry.weight}×${entry.reps}</div>
                    <div style="color: ${MAIN_LIFT_META[pattern].color}; font-weight: bold; text-align: right;">~${entry.e1rm}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderWaterCartridgesHTML(waterTaps) {
    let html = '';
    for (let i = 1; i <= 7; i++) {
        let isFull = i <= waterTaps;
        html += `
            <div onclick="tapWaterCartridge(${i})" style="width: 38px; height: 50px; border: 2px solid ${isFull ? 'var(--hud-cyan)' : 'var(--text-muted)'}; border-radius: 4px; display: flex; flex-direction: column; justify-content: flex-end; padding: 2px; cursor: pointer; transition: all 0.2s; position: relative; background: ${isFull ? 'var(--hud-cyan-glow)' : 'transparent'}; box-shadow: ${isFull ? '0 0 10px var(--hud-cyan)' : 'none'};">
                <div style="width: 100%; height: ${isFull ? '100%' : '0%'}; background: var(--hud-cyan); transition: height 0.3s;"></div>
                <span style="position: absolute; width: 100%; text-align: center; font-family: var(--font-mono); font-size: 0.6rem; font-weight: bold; color: ${isFull ? '#000' : 'var(--text-muted)'}; bottom: -18px; left: 0;">#${i}</span>
            </div>
        `;
    }
    return html;
}

function tapWaterCartridge(tapNum) {
    let targetLiters = parseFloat((tapNum * 0.6).toFixed(1));
    if (todayTelemetry.waterLiters === targetLiters) {
        todayTelemetry.waterLiters = Math.max(0, parseFloat(((tapNum - 1) * 0.6).toFixed(1)));
    } else {
        todayTelemetry.waterLiters = targetLiters;
    }
    localStorage.setItem('axis_today_water', todayTelemetry.waterLiters);
    renderFitnessView();
    refreshCoreView();
}

function resetWater() {
    todayTelemetry.waterLiters = 0;
    localStorage.setItem('axis_today_water', 0);
    renderFitnessView();
    refreshCoreView();
}

function updateExerciseDropdown() {
    const splitEl = document.getElementById('workout-split-select');
    const exEl = document.getElementById('workout-exercise-select');
    if (!splitEl || !exEl) return;

    let split = splitEl.value;
    let exercises = OBSIDIAN_SPLITS[split] || [];
    exEl.innerHTML = exercises.map(e => `<option value="${e}">${e}</option>`).join('');
    refreshSelectedExerciseMemory();
}

function refreshSelectedExerciseMemory() {
    const panel = document.getElementById('selected-exercise-memory-panel');
    const exEl = document.getElementById('workout-exercise-select');
    if (!panel || !exEl) return;
    panel.innerHTML = renderSelectedExerciseMemoryHTML(exEl.value);
}

function renderSelectedExerciseMemoryHTML(exerciseName) {
    let rows = getExerciseMemoryRows(exerciseName).slice(0, 5);
    const pattern = getMainLiftPatternForExercise(exerciseName);
    const patternMeta = pattern ? MAIN_LIFT_META[pattern] : null;

    return `
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-family: var(--font-mono); font-size: 0.84rem; color: var(--text-main); font-weight: bold;">
                    EXERCISE MEMORY // ${exerciseName}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.7rem; color: ${patternMeta ? patternMeta.color : 'var(--text-muted)'}; letter-spacing: 2px;">
                    ${patternMeta ? `MAPPED TO ${patternMeta.label}` : 'ACCESSORY / MEMORY ONLY'}
                </div>
            </div>

            ${rows.length === 0 ? `
                <div style="background: var(--bg-surface); border: 1px dashed rgba(255,255,255,0.1); padding: 14px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                    No structured memory stored yet for this exercise. Your next log will start the archive.
                </div>
            ` : `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${rows.map(row => `
                        <div style="display: grid; grid-template-columns: 84px 1fr 82px 72px; gap: 10px; align-items: center; background: var(--bg-surface); border-left: 3px solid ${patternMeta ? patternMeta.color : 'var(--hud-violet)'}; padding: 10px 12px; font-family: var(--font-mono); font-size: 0.75rem;">
                            <div style="color: var(--hud-cyan); font-weight: bold;">${row.dateLabel}</div>
                            <div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.split}</div>
                            <div style="color: var(--text-main); font-weight: bold;">${row.weight}×${row.reps}</div>
                            <div style="text-align: right; color: var(--hud-optimal); font-weight: bold;">~${row.e1rm}</div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

function handleTacticalWorkoutLog(e) {
    e.preventDefault();

    const split = document.getElementById('workout-split-select').value;
    const exercise = document.getElementById('workout-exercise-select').value;
    const weight = parseFloat(document.getElementById('workout-weight').value);
    const reps = parseInt(document.getElementById('workout-reps').value);
    const setType = document.querySelector('input[name="set_type"]:checked').value;

    if (!exercise || !weight || !reps) return;

    let e1RM = calculateLiftE1RM(weight, reps);
    let newEntry = {
        id: Date.now(),
        split,
        exercise,
        sets: `${weight}kg x ${reps} (${setType.toUpperCase()} // e1RM ~${e1RM}kg)`,
        date: 'Just Logged'
    };

    pushRecentArchive(newEntry);
    pushExerciseMemory({ split, exercise, weight, reps, setType, e1rm: e1RM });

    let pattern = getMainLiftPatternForExercise(exercise);
    if (pattern && setType === 'leading') {
        recordMainLiftSet(pattern, exercise, weight, reps, { skipArchive: true, skipMemory: true, splitLabel: split });
    } else {
        markGymTelemetry(split);
    }

    renderFitnessView();
    refreshCoreView();
}

function quickLogMainLift(pattern) {
    const meta = MAIN_LIFT_META[pattern];
    const state = mainLiftState[pattern];
    const exercise = prompt(`Set active exercise for ${meta.label}:`, state.activeExercise || meta.defaultExercise);
    if (!exercise || !exercise.trim()) return;

    const payload = prompt(`Enter top set for ${exercise.trim()} in format WEIGHT x REPS`, '60 x 8');
    if (!payload) return;

    const parsed = parseWeightRepInput(payload);
    if (!parsed) {
        alert('Invalid format. Use something like 60 x 8');
        return;
    }

    mainLiftState[pattern].activeExercise = exercise.trim();
    recordMainLiftSet(pattern, exercise.trim(), parsed.weight, parsed.reps, { splitLabel: `IP METHOD // ${meta.label}` });
    renderFitnessView();
    refreshCoreView();
}

function setActiveMainLiftExercise(pattern) {
    const meta = MAIN_LIFT_META[pattern];
    const current = mainLiftState[pattern].activeExercise || meta.defaultExercise;
    const updated = prompt(`Active exercise for ${meta.label}:`, current);
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

function recordMainLiftSet(pattern, exercise, weight, reps, options = {}) {
    let now = new Date();
    let timestamp = now.getTime();
    let dateLabel = formatDateLabel(now);
    let sessionDateKey = now.toISOString().slice(0, 10);
    let e1rm = calculateLiftE1RM(weight, reps);

    mainLiftState[pattern].activeExercise = exercise;
    mainLiftState[pattern].history.push({
        id: `ml-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
        sessionDateKey,
        dateLabel,
        timestamp,
        exercise,
        weight,
        reps,
        e1rm
    });
    mainLiftState[pattern].history.sort((a, b) => a.timestamp - b.timestamp);
    saveMainLiftState();

    if (!options.skipMemory) {
        pushExerciseMemory({
            split: options.splitLabel || `IP METHOD // ${MAIN_LIFT_META[pattern].label}`,
            exercise,
            weight,
            reps,
            setType: 'leading',
            e1rm,
            timestamp,
            dateLabel
        });
    }

    if (!options.skipArchive) {
        pushRecentArchive({
            id: timestamp,
            split: options.splitLabel || `IP METHOD // ${MAIN_LIFT_META[pattern].label}`,
            exercise,
            sets: `${weight}kg x ${reps} (LEADING // e1RM ~${e1rm}kg)`,
            date: 'Just Logged'
        });
    }

    markGymTelemetry(options.splitLabel || `IP METHOD // ${MAIN_LIFT_META[pattern].label}`);
}

function markGymTelemetry(splitLabel) {
    todayTelemetry.gymLogged = true;
    todayTelemetry.gymSplit = splitLabel || 'Tracked Session';
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_today_gym', 'true');
    localStorage.setItem('axis_today_gym_split', todayTelemetry.gymSplit);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
}

function pushRecentArchive(entry) {
    recentWorkoutArchives.unshift(entry);
    if (recentWorkoutArchives.length > 5) recentWorkoutArchives.pop();
    localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));
}

function pushExerciseMemory({ split, exercise, weight, reps, setType, e1rm, timestamp = Date.now(), dateLabel = formatDateLabel(new Date(timestamp)) }) {
    exerciseMemoryLog.unshift({
        id: `mem-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        split,
        exercise,
        weight,
        reps,
        setType,
        e1rm,
        timestamp,
        dateLabel,
        sessionDateKey: new Date(timestamp).toISOString().slice(0, 10)
    });
    localStorage.setItem('axis_exercise_memory', JSON.stringify(exerciseMemoryLog));
}

function renderWorkoutArchivesHTML() {
    return recentWorkoutArchives.map(a => `
        <div style="background: var(--bg-surface); border-left: 3px solid var(--hud-violet); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); gap: 12px;">
            <div style="min-width: 0;">
                <div style="font-weight: bold; color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.exercise}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">[${a.split}] // ${a.date}</div>
            </div>
            <div style="color: var(--hud-optimal); font-weight: bold; text-align: right; font-size: 0.9rem; flex-shrink: 0;">
                ${a.sets}
            </div>
        </div>
    `).join('');
}

function renderMainLiftChartHTML() {
    const seriesMap = buildChartSeriesMap(fitnessUiState.chartMode);
    const allSeries = Object.values(seriesMap).filter(series => series.length > 0);

    if (allSeries.length === 0) {
        return `
            <div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); min-height: 280px; display: flex; justify-content: center; align-items: center; text-align: center; font-family: var(--font-mono); color: var(--text-muted); line-height: 1.8; padding: 20px;">
                No main-lift progression data yet.<br>
                Log leading sets for the 6 IP movement patterns and AXIS will draw the simultaneous trend map here.
            </div>
        `;
    }

    const width = 1160;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 40, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    let allValues = allSeries.flat().map(p => p.metricValue);
    let minValue = Math.min(...allValues);
    let maxValue = Math.max(...allValues);

    if (minValue === maxValue) {
        minValue -= 5;
        maxValue += 5;
    }

    const pad = Math.max((maxValue - minValue) * 0.12, 3);
    minValue -= pad;
    maxValue += pad;

    const globalDates = getGlobalMainLiftSessionDates();
    const xStep = globalDates.length <= 1 ? plotWidth / 2 : plotWidth / (globalDates.length - 1);

    let yTicks = 5;
    let tickLines = [];
    for (let i = 0; i < yTicks; i++) {
        const ratio = i / (yTicks - 1);
        const y = margin.top + plotHeight * ratio;
        const value = maxValue - (maxValue - minValue) * ratio;
        tickLines.push({ y, value });
    }

    let gridSvg = tickLines.map(t => `
        <g>
            <line x1="${margin.left}" y1="${t.y.toFixed(2)}" x2="${width - margin.right}" y2="${t.y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
            <text x="${margin.left - 10}" y="${(t.y + 4).toFixed(2)}" text-anchor="end" fill="#64748b" font-family="Courier New, monospace" font-size="10">${formatChartMetric(t.value, fitnessUiState.chartMode)}</text>
        </g>
    `).join('');

    let xLabels = globalDates.map((dateKey, idx) => {
        const x = margin.left + xStep * idx;
        return `
            <text x="${x.toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="#64748b" font-family="Courier New, monospace" font-size="10">${formatShortDateKey(dateKey)}</text>
        `;
    }).join('');

    let seriesSvg = Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const points = seriesMap[pattern] || [];
        if (!points.length) return '';

        const pointString = points.map(point => {
            const x = margin.left + xStep * point.globalIndex;
            const yRatio = (point.metricValue - minValue) / (maxValue - minValue);
            const y = margin.top + (plotHeight - plotHeight * yRatio);
            point._x = x;
            point._y = y;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');

        const dots = points.map(point => `
            <circle cx="${point._x.toFixed(2)}" cy="${point._y.toFixed(2)}" r="4" fill="${meta.color}" stroke="#03050a" stroke-width="1.5">
                <title>${meta.label} // ${point.exercise}\n${point.dateLabel}\n${point.weight}kg x ${point.reps}\n${fitnessUiState.chartMode === 'index' ? `Index: ${point.metricValue.toFixed(1)}` : `e1RM: ~${point.metricValue.toFixed(1)}`}</title>
            </circle>
        `).join('');

        return `
            <g>
                <polyline fill="none" stroke="${meta.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pointString}" opacity="0.95" />
                ${dots}
            </g>
        `;
    }).join('');

    return `
        <div style="width: 100%; overflow-x: auto; background: linear-gradient(180deg, rgba(8,12,22,0.88), rgba(3,5,10,0.96)); border: 1px solid rgba(255,255,255,0.06); padding: 18px;">
            <svg viewBox="0 0 ${width} ${height}" style="width: 100%; min-width: 900px; height: auto; display: block;">
                ${gridSvg}
                <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" />
                <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" stroke-width="1.4" />
                ${seriesSvg}
                ${xLabels}
                <text x="${width / 2}" y="${height - 2}" text-anchor="middle" fill="#94a3b8" font-family="Courier New, monospace" font-size="11">SESSION DATE</text>
                <text x="18" y="${height / 2}" text-anchor="middle" transform="rotate(-90 18 ${height / 2})" fill="#94a3b8" font-family="Courier New, monospace" font-size="11">${fitnessUiState.chartMode === 'index' ? 'INDEXED PROGRESSION' : 'ESTIMATED 1RM'}</text>
            </svg>
        </div>
    `;
}

function renderMainLiftLegendHTML() {
    return Object.keys(MAIN_LIFT_META).map(pattern => {
        const meta = MAIN_LIFT_META[pattern];
        const latest = mainLiftState[pattern].history.slice(-1)[0];
        return `
            <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background: ${meta.color}; display: inline-block;"></span>
                <span style="font-size: 0.76rem; color: var(--text-main); font-weight: bold;">${meta.label}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${latest ? `${latest.weight}×${latest.reps}` : 'NO DATA'}</span>
            </div>
        `;
    }).join('');
}

function buildChartSeriesMap(mode = 'index') {
    const globalDates = getGlobalMainLiftSessionDates();
    const indexLookup = Object.fromEntries(globalDates.map((d, i) => [d, i]));
    let out = {};

    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        const bySessionDate = compressPatternHistoryByDate(pattern);
        const history = Object.values(bySessionDate).sort((a, b) => a.timestamp - b.timestamp);

        if (!history.length) {
            out[pattern] = [];
            return;
        }

        const firstE1RM = history[0].e1rm || 1;
        out[pattern] = history.map(entry => ({
            ...entry,
            globalIndex: indexLookup[entry.sessionDateKey],
            metricValue: mode === 'index' ? ((entry.e1rm / firstE1RM) * 100) : entry.e1rm
        }));
    });

    return out;
}

function compressPatternHistoryByDate(pattern) {
    const history = mainLiftState[pattern].history || [];
    const byDate = {};
    history.forEach(entry => {
        byDate[entry.sessionDateKey] = entry;
    });
    return byDate;
}

function getGlobalMainLiftSessionDates() {
    const set = new Set();
    Object.keys(MAIN_LIFT_META).forEach(pattern => {
        (mainLiftState[pattern].history || []).forEach(entry => set.add(entry.sessionDateKey));
    });
    return Array.from(set).sort();
}

function getMainLiftPatternForExercise(exerciseName) {
    let normalized = String(exerciseName || '').trim().toLowerCase();
    if (!normalized) return null;

    for (let pattern of Object.keys(MAIN_LIFT_EXERCISE_MAP)) {
        if (MAIN_LIFT_EXERCISE_MAP[pattern].some(name => name.toLowerCase() === normalized)) {
            return pattern;
        }
    }
    return null;
}

function getMainLiftStatus(pattern) {
    const history = mainLiftState[pattern].history || [];
    const meta = MAIN_LIFT_META[pattern];

    if (history.length === 0) {
        return {
            label: 'STANDBY',
            textColor: 'var(--text-muted)',
            borderColor: 'rgba(100, 116, 139, 0.35)',
            glow: 'rgba(100, 116, 139, 0.08)'
        };
    }

    if (history.length < 3) {
        return {
            label: 'BUILDING',
            textColor: 'var(--hud-cyan)',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            glow: 'rgba(56, 189, 248, 0.1)'
        };
    }

    const last3 = history.slice(-3);
    const below = last3.filter(entry => entry.reps < meta.repLower).length;

    if (below >= 2) {
        return {
            label: below === 3 ? 'CRITICAL' : 'WARNING',
            textColor: below === 3 ? 'var(--hud-critical)' : 'var(--hud-warning)',
            borderColor: below === 3 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(245, 158, 11, 0.42)',
            glow: below === 3 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)'
        };
    }

    const first = history[0];
    const latest = history[history.length - 1];
    const up = latest.e1rm >= first.e1rm;

    return {
        label: up ? 'OPTIMAL' : 'WATCH',
        textColor: up ? 'var(--hud-optimal)' : 'var(--hud-warning)',
        borderColor: up ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.35)',
        glow: up ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.1)'
    };
}

function getBestMainLiftEntry(pattern) {
    const history = mainLiftState[pattern].history || [];
    if (!history.length) return null;
    return [...history].sort((a, b) => b.e1rm - a.e1rm)[0];
}

function getLifecycleWeeks(pattern) {
    const history = mainLiftState[pattern].history || [];
    if (!history.length) return 1;
    const firstTime = history[0].timestamp;
    return Math.max(1, Math.ceil((Date.now() - firstTime) / (1000 * 60 * 60 * 24 * 7)));
}

function getExerciseMemoryRows(exerciseName) {
    let exact = exerciseMemoryLog
        .filter(row => row.exercise === exerciseName)
        .sort((a, b) => b.timestamp - a.timestamp);

    if (exact.length > 0) return exact;

    return recentWorkoutArchives
        .filter(row => row.exercise === exerciseName)
        .map(row => {
            let parsed = parseArchiveSetString(row.sets);
            return {
                dateLabel: row.date,
                split: row.split,
                exercise: row.exercise,
                weight: parsed.weight,
                reps: parsed.reps,
                e1rm: calculateLiftE1RM(parsed.weight, parsed.reps)
            };
        })
        .filter(row => row.weight > 0 && row.reps > 0);
}

function parseArchiveSetString(text) {
    const match = String(text || '').match(/(\d+(?:\.\d+)?)kg\s*x\s*(\d+)/i);
    if (!match) return { weight: 0, reps: 0 };
    return {
        weight: parseFloat(match[1]) || 0,
        reps: parseInt(match[2]) || 0
    };
}

function parseWeightRepInput(text) {
    const clean = String(text || '').toLowerCase().replace('kg', '').trim();
    let match = clean.match(/(\d+(?:\.\d+)?)\s*[x/]\s*(\d+)/i) || clean.match(/(\d+(?:\.\d+)?)\s+(\d+)/i);
    if (!match) return null;
    return {
        weight: parseFloat(match[1]),
        reps: parseInt(match[2])
    };
}

function calculateLiftE1RM(weight, reps) {
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps * 0.0333));
}

function formatDateLabel(dateObj) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]}`;
}

function formatShortDateKey(dateKey) {
    const [y, m, d] = String(dateKey).split('-');
    return `${d}/${m}`;
}

function formatChartMetric(value, mode) {
    return mode === 'index' ? value.toFixed(0) : value.toFixed(0);
}

function saveMainLiftState() {
    localStorage.setItem('axis_main_lift_state', JSON.stringify(mainLiftState));
}

function refreshFitnessView() {
    renderFitnessView();
}

function refreshFitnessWater() {
    renderFitnessView();
}