/* ==========================================
   AXIS OS // fitness.js
   IP Method Core Lifecycles, EKG Monitor, Hydration Cartridges (600ml units),
   and Tactical Workout Split Logging
   ========================================== */

/* Locked Obsidian Splits */
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

let recentWorkoutArchives = JSON.parse(localStorage.getItem('axis_workout_archives') || '[]');

if (recentWorkoutArchives.length === 0) {
    // Seed initial recent archives
    recentWorkoutArchives = [
        { id: 1, split: "Chest + Back", exercise: "Incline Barbell Bench Press", sets: "85kg x 8, 85kg x 6", date: "Yesterday" },
        { id: 2, split: "Shoulders + Arms", exercise: "Machine Shoulder Press", sets: "70kg x 10, 75kg x 8", date: "17 June" },
        { id: 3, split: "Chest + Back", exercise: "Wide-Grip Lat Pulldown", sets: "90kg x 12, 95kg x 10", date: "15 June" }
    ];
}

function initFitness() {
    renderFitnessView();
    initEKGCanvas();
}

function renderFitnessView() {
    const container = document.getElementById('module-fitness');
    if (!container) return;

    let waterLiters = todayTelemetry.waterLiters;
    let waterTaps = Math.min(7, Math.floor(waterLiters / 0.6));

    let splitOptions = Object.keys(OBSIDIAN_SPLITS).map(s => `<option value="${s}">${s}</option>`).join('');

    container.innerHTML = `
        <div class="cockpit-header">
            <span>BIOMETRIC TELEMETRY // CORE FITNESS & LIFECYCLES</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">IP METHOD V4.2 ENGINE</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            
            <!-- Left Column: EKG & Hydration -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <!-- Active EKG Cockpit Monitor -->
                <div class="cockpit-card" style="padding: 24px;">
                    <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--hud-optimal); font-weight: bold; display: flex; justify-content: space-between;">
                        <span>REAL-TIME THORACIC EKG FEED</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">IDLE SENSOR STATE</span>
                    </div>
                    <div style="width: 100%; height: 200px; background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.2); position: relative; border-radius: 4px; overflow: hidden;">
                        <canvas id="fitness-ekg-canvas" style="width: 100%; height: 100%;"></canvas>
                        <div style="position: absolute; top: 16px; left: 16px; font-family: var(--font-mono);">
                            <div style="font-size: 2.5rem; font-weight: bold; color: var(--hud-optimal); text-shadow: 0 0 15px rgba(16, 185, 129, 0.5);">
                                68 <span style="font-size: 1rem; font-weight: normal; color: var(--text-main);">BPM</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">HRV: 44ms // RECOVERY OPTIMAL</div>
                        </div>
                    </div>
                </div>

                <!-- Hydration Cartridge Telemetry -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                        <span>HYDRATION TELEMETRY</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">UNIT: 600ML CARTRIDGE // GOAL: 4.0L</span>
                    </div>

                    <div style="margin: 16px 0; font-family: var(--font-mono); font-size: 1.4rem; font-weight: bold; color: var(--text-main);">
                        TOTAL LOGGED: <span style="color: var(--hud-cyan); text-shadow: 0 0 10px var(--hud-cyan-glow);">${waterLiters.toFixed(1)} L</span> / 4.0 L
                    </div>

                    <!-- Cartridges Grid -->
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
                        ${renderWaterCartridgesHTML(waterTaps)}
                    </div>

                    <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span>CLICK A BOTTLE CARTRIDGE TO CONSUME 600ML</span>
                        <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="resetWater()">PURGE WATER</button>
                    </div>
                </div>

            </div>

            <!-- Right Column: Tactical Workout Logging & Archives -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <!-- Tactical Workout Log Form -->
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
                            <select class="tactical-select" id="workout-exercise-select">
                                <!-- Populated by JS -->
                            </select>
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
                            <div style="display: flex; gap: 16px;">
                                <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="set_type" value="leading" checked> 🔥 LEADING SET (IP METHOD)
                                </label>
                                <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="set_type" value="backoff"> 🔄 BACK-OFF SET
                                </label>
                            </div>
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; margin-top: 8px;">
                            COMMIT TACTICAL LIFT &raquo;
                        </button>
                    </form>
                </div>

                <!-- Recent Archives -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between;">
                        <span>RECENT ARCHIVES</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">LAST 5 SESSIONS</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;" id="workout-archives-list">
                        ${renderWorkoutArchivesHTML()}
                    </div>
                </div>

            </div>

        </div>
    `;

    updateExerciseDropdown();
}

function renderWaterCartridgesHTML(waterTaps) {
    let html = '';
    for(let i=1; i<=7; i++) {
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
        // decrement if clicking exact full one
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
}

function handleTacticalWorkoutLog(e) {
    e.preventDefault();

    const split = document.getElementById('workout-split-select').value;
    const exercise = document.getElementById('workout-exercise-select').value;
    const weight = parseFloat(document.getElementById('workout-weight').value);
    const reps = parseInt(document.getElementById('workout-reps').value);
    const setType = document.querySelector('input[name="set_type"]:checked').value;

    let e1RM = Math.round(weight * (1 + reps * 0.0333));

    let newEntry = {
        id: Date.now(),
        split,
        exercise,
        sets: `${weight}kg x ${reps} (${setType.toUpperCase()} // e1RM ~${e1RM}kg)`,
        date: "Just Logged"
    };

    recentWorkoutArchives.unshift(newEntry);
    if(recentWorkoutArchives.length > 5) recentWorkoutArchives.pop();
    localStorage.setItem('axis_workout_archives', JSON.stringify(recentWorkoutArchives));

    // Update global today telemetry
    todayTelemetry.gymLogged = true;
    todayTelemetry.gymSplit = split;
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_today_gym', 'true');
    localStorage.setItem('axis_today_gym_split', split);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);

    renderFitnessView();
    refreshCoreView();
}

function renderWorkoutArchivesHTML() {
    return recentWorkoutArchives.map(a => `
        <div style="background: var(--bg-surface); border-left: 3px solid var(--hud-violet); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono);">
            <div>
                <div style="font-weight: bold; color: var(--text-main); font-size: 0.95rem;">${a.exercise}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">[${a.split}] // ${a.date}</div>
            </div>
            <div style="color: var(--hud-optimal); font-weight: bold; text-align: right; font-size: 0.9rem;">
                ${a.sets}
            </div>
        </div>
    `).join('');
}

function refreshFitnessView() {
    renderFitnessView();
}

function refreshFitnessWater() {
    renderFitnessView();
}

function initEKGCanvas() {
    const canvas = document.getElementById('fitness-ekg-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = canvas.parentElement.clientWidth || 700;
    let height = canvas.height = canvas.parentElement.clientHeight || 200;

    let scanlineX = 0;

    function draw() {
        if(!document.getElementById('fitness-ekg-canvas')) return; // exit if page swapped

        ctx.fillStyle = 'rgba(8, 12, 22, 0.2)';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
        ctx.lineWidth = 1;
        for(let x=0; x<width; x+=25) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
        for(let y=0; y<height; y+=25) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }

        scanlineX += 5;
        if(scanlineX >= width) scanlineX = 0;

        ctx.strokeStyle = 'var(--hud-optimal)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(scanlineX, 0); ctx.lineTo(scanlineX, height); ctx.stroke();

        ctx.strokeStyle = 'var(--hud-optimal)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'var(--hud-optimal)';
        ctx.beginPath();
        
        let startY = height / 2;
        ctx.moveTo(0, startY);

        for(let x=0; x<width; x+=5) {
            let y = startY;
            let cyclePos = (x + (width - scanlineX) + 24000) % 240;
            if(cyclePos > 100 && cyclePos < 140) {
                if(cyclePos < 110) y -= 15;
                else if(cyclePos < 118) y += 12;
                else if(cyclePos < 124) y -= 70;
                else if(cyclePos < 130) y += 30;
                else y -= 10;
            }
            y += (Math.random() - 0.5) * 3;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        requestAnimationFrame(draw);
    }

    draw();
}