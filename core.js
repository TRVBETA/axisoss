/* ==========================================
   AXIS OS // core.js
   HUD Chronometer, Daily 100-Point Scoring Engine,
   7-Level Revolution Rank Logic, and CORE Home Layout
   ========================================== */

/* 7 Revolution Ranks (الثورة) */
const REVOLUTION_RANKS = [
    { level: 1, name: "RANK I: CIVILIAN // المتمرد", minScoreSum: 0, color: "var(--text-muted)" },
    { level: 2, name: "RANK II: VANGUARD // الطليعة", minScoreSum: 500, color: "var(--hud-cyan)" },
    { level: 3, name: "RANK III: RADICAL // الراديكالي", minScoreSum: 1200, color: "var(--hud-violet)" },
    { level: 4, name: "RANK IV: LIBERATOR // المحرر", minScoreSum: 2500, color: "var(--hud-optimal)" },
    { level: 5, name: "RANK V: COMMANDER // القائد", minScoreSum: 4500, color: "var(--hud-warning)" },
    { level: 6, name: "RANK VI: ARCHITECT // مهندس الثورة", minScoreSum: 7500, color: "#f43f5e" },
    { level: 7, name: "RANK VII: SOVEREIGN // السيادة", minScoreSum: 12000, color: "#fff" }
];

/* Global Today Telemetry State */
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
    lastBreakDate: localStorage.getItem('axis_streak_break') || "2026-05-01",
    totalHistoricalScore: parseInt(localStorage.getItem('axis_total_score')) || 1420
};

function initCore() {
    init12hClock();
    renderCoreHome();
    computeAndDisplayScore();
}

/* Precise 12h Live Chronometer */
function init12hClock() {
    const timeEl = document.getElementById('hud-live-clock');
    const dateEl = document.getElementById('hud-live-date');

    function update() {
        const now = new Date();
        
        let h = now.getHours();
        let m = String(now.getMinutes()).padStart(2, '0');
        let s = String(now.getSeconds()).padStart(2, '0');
        let ampm = h >= 12 ? 'PM' : 'AM';
        
        h = h % 12;
        h = h ? h : 12; // convert 0 to 12
        h = String(h).padStart(2, '0');

        if(timeEl) timeEl.textContent = `${h}:${m}:${s} ${ampm}`;

        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        let dayName = days[now.getDay()];
        let dayNum = String(now.getDate()).padStart(2, '0');
        let monthName = months[now.getMonth()];
        let year = now.getFullYear();

        if(dateEl) dateEl.textContent = `${dayName} // ${dayNum} ${monthName} ${year}`;
    }

    update();
    setInterval(update, 500);
}

/* Compute Daily 100-Point Formula */
function computeDailyScore() {
    let pts = 0;
    
    // Gym session logged: 40 pts
    if (todayTelemetry.gymLogged) pts += 40;

    // Design hours logged (min 1h): 30 pts max
    if (todayTelemetry.designHours >= 1) {
        pts += 30;
    } else if (todayTelemetry.designHours > 0) {
        // partial credit
        pts += Math.round(todayTelemetry.designHours * 30);
    }

    // Sleep logged: 10 pts
    if (todayTelemetry.sleepHours > 0) pts += 10;

    // Water goal hit (4L): 10 pts max. Partial credit (e.g. 2L = 5pts)
    let waterPts = Math.min(10, Math.round((todayTelemetry.waterLiters / 4.0) * 10));
    pts += waterPts;

    // Went outside: 5 pts
    if (todayTelemetry.wentOutside) pts += 5;

    // Tutorial/video watched: 5 pts
    if (todayTelemetry.watchedTutorial) pts += 5;

    return Math.min(100, pts);
}

/* Derive 7 Revolution Rank */
function getCurrentRank() {
    let total = todayTelemetry.totalHistoricalScore;
    let rank = REVOLUTION_RANKS[0];

    for (let r of REVOLUTION_RANKS) {
        if (total >= r.minScoreSum) {
            rank = r;
        } else {
            break;
        }
    }
    return rank;
}

/* Calculate Last Logged String of Truth */
function getLastLoggedString() {
    if (!todayTelemetry.lastLoggedTimestamp) return "NOTHING LOGGED TODAY";
    
    let diffMinutes = Math.floor((Date.now() - todayTelemetry.lastLoggedTimestamp) / (1000 * 60));
    if (diffMinutes < 1) return "LAST LOGGED: JUST NOW";
    if (diffMinutes < 60) return `LAST LOGGED: ${diffMinutes} MINUTES AGO`;
    
    let diffHours = Math.floor(diffMinutes / 60);
    return `LAST LOGGED: ${diffHours} HOURS AGO`;
}

/* Render CORE Home View */
function renderCoreHome() {
    const container = document.getElementById('module-core');
    if (!container) return;

    let score = computeDailyScore();
    let rank = getCurrentRank();
    let commanderName = localStorage.getItem('axis_commander_name') || 'ALEX MERCER';

    container.innerHTML = `
        <!-- Top Status Tier -->
        <div style="display: grid; grid-template-columns: 1fr 400px 1fr; gap: 32px; align-items: center;">
            
            <!-- Left: Name, Rank, Time -->
            <div class="cockpit-card" style="padding: 24px; min-height: 220px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">COMMANDER IDENTIFIER</div>
                <div style="font-size: 2.2rem; font-weight: bold; color: var(--text-main); letter-spacing: 4px; text-transform: uppercase;">
                    ${commanderName}
                </div>
                <div>
                    <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: bold; color: ${rank.color};">
                        ${rank.name}
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
                        REVOLUTION POWER: ${todayTelemetry.totalHistoricalScore} PTS // EARNED FORTRESS
                    </div>
                </div>
            </div>

            <!-- Center: Big Live Daily Score Fortress -->
            <div class="cockpit-card" style="padding: 24px; min-height: 220px; align-items: center; justify-content: center; text-align: center; border-color: var(--hud-violet); box-shadow: 0 0 30px var(--hud-violet-subtle);">
                <div style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: bold; letter-spacing: 6px; color: var(--hud-violet);">DAILY SCORE</div>
                <div style="font-family: var(--font-mono); font-size: 6.5rem; font-weight: 900; color: var(--text-main); line-height: 1; text-shadow: 0 0 25px var(--hud-violet-glow);">
                    ${score}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); letter-spacing: 4px;">
                    MAXIMUM 100 TRUTH
                </div>
            </div>

            <!-- Right: Quick Status Strip Readout -->
            <div class="cockpit-card" style="padding: 24px; min-height: 220px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); letter-spacing: 2px;">TELEMETRY STRIP AT A GLANCE</div>
                
                <div style="display: flex; flex-direction: column; gap: 12px; font-family: var(--font-mono); font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>🏋️ GYM LIFTING:</span>
                        <span style="color: ${todayTelemetry.gymLogged ? 'var(--hud-optimal)' : 'var(--text-muted)'}; font-weight: bold;">
                            ${todayTelemetry.gymLogged ? '✓ ' + todayTelemetry.gymSplit : 'PENDING'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>📐 DESIGN SPRINT:</span>
                        <span style="color: ${todayTelemetry.designHours >= 1 ? 'var(--hud-optimal)' : (todayTelemetry.designHours > 0 ? 'var(--hud-warning)' : 'var(--text-muted)')}; font-weight: bold;">
                            ${todayTelemetry.designHours} HOURS
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>💧 HYDRATION:</span>
                        <span style="color: ${todayTelemetry.waterLiters >= 4 ? 'var(--hud-optimal)' : 'var(--hud-cyan)'}; font-weight: bold;">
                            ${todayTelemetry.waterLiters.toFixed(1)} / 4.0 L
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>🌙 SLEEP:</span>
                        <span style="color: ${todayTelemetry.sleepHours > 0 ? 'var(--hud-optimal)' : 'var(--text-muted)'}; font-weight: bold;">
                            ${todayTelemetry.sleepHours > 0 ? todayTelemetry.sleepHours + 'h' : 'NO DATA'}
                        </span>
                    </div>
                </div>
            </div>

        </div>

        <!-- Middle Streak & Accountability Bar -->
        <div class="cockpit-card" style="padding: 28px 32px; flex-direction: row; justify-content: space-between; align-items: center; background: linear-gradient(90deg, var(--bg-card), var(--bg-surface));">
            <div style="display: flex; align-items: center; gap: 24px;">
                <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid var(--hud-optimal); display: flex; justify-content: center; align-items: center; color: var(--hud-optimal); font-family: var(--font-mono); font-size: 1.6rem; font-weight: bold; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);">
                    🔥
                </div>
                <div>
                    <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); letter-spacing: 2px;">ACCOUNTABILITY FORTRESS</div>
                    <div style="font-family: var(--font-mono); font-size: 1.8rem; font-weight: bold; color: var(--hud-optimal); letter-spacing: 4px;">
                        ${todayTelemetry.streakCurrent} DAYS STREAK // OPTIMAL
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 40px; font-family: var(--font-mono); text-align: right;">
                <div>
                    <div style="font-size: 1.4rem; font-weight: bold; color: var(--text-main);">${todayTelemetry.streakLongest} DAYS</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); letter-spacing: 2px;">LONGEST STREAK</div>
                </div>
                <div style="border-left: 1px solid rgba(255,255,255,0.1); padding-left: 40px;">
                    <div style="font-size: 1.4rem; font-weight: bold; color: var(--hud-warning);">${todayTelemetry.lastBreakDate}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); letter-spacing: 2px;">LAST BREAK DATE</div>
                </div>
            </div>
        </div>

        <!-- Bottom Line of Truth -->
        <div style="background: var(--bg-surface); border: 1px solid var(--text-muted); padding: 16px 32px; font-family: var(--font-mono); font-size: 0.95rem; font-weight: bold; color: var(--hud-cyan); letter-spacing: 4px; display: flex; justify-content: space-between; align-items: center; clip-path: var(--clip-corner-sm);">
            <span>🚀 TRUTH PROTOCOL // SENSOR FEEDS ACTIVE</span>
            <span id="line-of-truth-text">${getLastLoggedString()}</span>
        </div>

        <!-- Diagnostic Actions Tier for Arena Demonstration -->
        <div class="cockpit-card" style="padding: 24px;">
            <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 8px;">
                ⚡ TACTICAL SIMULATION FEED (TEST DATA INJECTION)
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <button class="tactical-btn optimal" onclick="injectQuickTelemetry('gym')">✓ LOG GYM (CHEST+BACK)</button>
                <button class="tactical-btn" onclick="injectQuickTelemetry('design')">📐 LOG +2H DESIGN</button>
                <button class="tactical-btn cyan" onclick="injectQuickTelemetry('water')">💧 DRINK +600ML WATER</button>
                <button class="tactical-btn" onclick="injectQuickTelemetry('outside')">🚶 WENT OUTSIDE</button>
                <button class="tactical-btn" onclick="injectQuickTelemetry('reset')" style="border-color: var(--hud-critical); color: var(--hud-critical);">⚠️ RESET TODAY</button>
            </div>
        </div>
    `;
}

function computeAndDisplayScore() {
    renderCoreHome();
}

function refreshCoreView() {
    renderCoreHome();
}

/* Helper to update timestamp and trigger render */
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