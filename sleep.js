/* ==========================================
   AXIS OS // sleep.js
   iPhone Shortcuts Telemetry Payload Bridge,
   Sleep Duration, Wake Time, Manual Quality (1-5), and Weekly Trend Chart
   ========================================== */

let sleepRecords = JSON.parse(localStorage.getItem('axis_sleep_records') || '[]');

if (sleepRecords.length === 0) {
    // Seed initial weekly records
    sleepRecords = [
        { date: "13 JUN", hours: 7.2, wakeTime: "06:30 AM", quality: 4 },
        { date: "14 JUN", hours: 6.5, wakeTime: "07:00 AM", quality: 3 },
        { date: "15 JUN", hours: 8.0, wakeTime: "06:15 AM", quality: 5 },
        { date: "16 JUN", hours: 5.8, wakeTime: "07:45 AM", quality: 2 },
        { date: "17 JUN", hours: 7.5, wakeTime: "06:20 AM", quality: 4 },
        { date: "18 JUN", hours: 6.8, wakeTime: "06:40 AM", quality: 4 },
        { date: "19 JUN", hours: Object.is(todayTelemetry.sleepHours, 0) ? 7.1 : todayTelemetry.sleepHours, wakeTime: "06:25 AM", quality: 4 }
    ];
}

function initSleep() {
    renderSleepView();
}

function renderSleepView() {
    const container = document.getElementById('module-sleep');
    if (!container) return;

    let latest = sleepRecords[sleepRecords.length - 1] || { date: "TODAY", hours: 0, wakeTime: "PENDING", quality: 3 };

    container.innerHTML = `
        <div class="cockpit-header">
            <span>BIOMETRIC TELEMETRY // CORE SLEEP & RECOVERY</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">SOURCE: iPHONE HEALTH SHORTCUTS BRIDGE</span>
        </div>

        <!-- Top Overview Tier -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;">
            
            <div class="cockpit-card" style="padding: 28px; justify-content: space-between; border-color: var(--hud-cyan); box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">LATEST SLEEP DURATION</div>
                <div style="font-family: var(--font-mono); font-size: 4.5rem; font-weight: bold; color: var(--hud-cyan); line-height: 1; text-shadow: 0 0 15px var(--hud-cyan-glow);">
                    ${latest.hours.toFixed(1)} <span style="font-size: 1.5rem; color: var(--text-main); font-weight: normal;">HOURS</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--hud-optimal);">
                    ✓ SYNCHRONIZED VIA iOS SHORTCUTS // +10 SCORE
                </div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">AUTOMATIC WAKE UP TIME</div>
                <div style="font-family: var(--font-mono); font-size: 3.2rem; font-weight: bold; color: var(--text-main); letter-spacing: 2px;">
                    ${latest.wakeTime}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
                    CIRCADIAN TELEMETRY // OPTIMAL
                </div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">MANUAL SLEEP QUALITY</div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    ${renderQualityStarsHTML(latest.quality)}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>RATED: ${latest.quality} / 5 STARS</span>
                    <span style="color: var(--hud-violet); cursor: pointer;" onclick="promptQualityEdit()">EDIT &raquo;</span>
                </div>
            </div>

        </div>

        <!-- Middle Full Width: Weekly Trend Chart -->
        <div class="cockpit-card" style="padding: 32px;">
            <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: bold; color: var(--text-main); letter-spacing: 4px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                <span>WEEKLY CIRCADIAN TREND // 7 DAYS</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">GOAL BASELINE: 7.0 HOURS</span>
            </div>

            <!-- CSS Bar Chart Grid -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 24px; height: 260px; align-items: flex-end; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                ${renderWeeklyChartBarsHTML()}
            </div>

            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 24px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 12px;">
                ${sleepRecords.slice(-7).map(r => `<span>${r.date}</span>`).join('')}
            </div>
        </div>

        <!-- Diagnostic Webhook Simulation Feeder -->
        <div class="cockpit-card" style="padding: 28px;">
            <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 16px;">
                ⚡ SIMULATE iPHONE SHORTCUT WEBHOOK PAYLOAD
            </div>

            <form onsubmit="handleSimulateSleepShortcut(event)" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">HOURS SLEPT</label>
                    <input type="number" step="0.1" class="tactical-input" id="shortcut-sim-hours" placeholder="e.g. 7.5" required min="1" max="16" value="7.5">
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">WAKE UP TIME</label>
                    <input type="text" class="tactical-input" id="shortcut-sim-wake" placeholder="e.g. 06:15 AM" required value="06:15 AM">
                </div>
                <button type="submit" class="tactical-btn" style="justify-content: center; height: 46px;">
                    INJECT iOS SHORTCUT PAYLOAD &raquo;
                </button>
            </form>
        </div>
    `;
}

function renderQualityStarsHTML(quality) {
    let html = '';
    for(let i=1; i<=5; i++) {
        let active = i <= quality;
        html += `
            <div onclick="updateLatestQuality(${i})" style="width: 48px; height: 48px; background: ${active ? 'var(--hud-violet)' : 'var(--bg-surface)'}; clip-path: var(--clip-corner-sm); display: flex; justify-content: center; align-items: center; color: ${active ? '#000' : 'var(--text-muted)'}; font-size: 1.4rem; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: ${active ? '0 0 15px var(--hud-violet-glow)' : 'none'};">
                ★
            </div>
        `;
    }
    return html;
}

function updateLatestQuality(newQ) {
    if(sleepRecords.length > 0) {
        sleepRecords[sleepRecords.length - 1].quality = newQ;
        localStorage.setItem('axis_sleep_records', JSON.stringify(sleepRecords));
    }
    renderSleepView();
}

function promptQualityEdit() {
    let q = prompt("Enter Sleep Quality Rating (1 to 5):", "4");
    if(q !== null) {
        let num = parseInt(q);
        if(num >= 1 && num <= 5) updateLatestQuality(num);
    }
}

function renderWeeklyChartBarsHTML() {
    let maxH = 10.0; // 10 hours = 100% height
    return sleepRecords.slice(-7).map(r => {
        let heightPct = Math.min(100, Math.max(10, (r.hours / maxH) * 100));
        let isOptimal = r.hours >= 7.0;
        return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%;">
                <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: bold; color: ${isOptimal ? 'var(--hud-optimal)' : 'var(--text-main)'};">${r.hours.toFixed(1)}h</span>
                <div style="width: 100%; height: ${heightPct}%; background: ${isOptimal ? 'linear-gradient(to top, var(--hud-optimal), #34d399)' : 'linear-gradient(to top, var(--hud-cyan), var(--hud-violet))'}; border-radius: 4px 4px 0 0; transition: height 0.5s ease; box-shadow: ${isOptimal ? '0 0 15px rgba(16, 185, 129, 0.4)' : '0 0 15px var(--hud-cyan-glow)'};"></div>
            </div>
        `;
    }).join('');
}

function handleSimulateSleepShortcut(e) {
    e.preventDefault();
    let hours = parseFloat(document.getElementById('shortcut-sim-hours').value);
    let wakeTime = document.getElementById('shortcut-sim-wake').value;

    let now = new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    let dateStr = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]}`;

    let newRec = { date: dateStr, hours, wakeTime, quality: 4 };

    // Update if today already logged, else push
    if(sleepRecords.length > 0 && sleepRecords[sleepRecords.length - 1].date === dateStr) {
        sleepRecords[sleepRecords.length - 1] = newRec;
    } else {
        sleepRecords.push(newRec);
        if(sleepRecords.length > 14) sleepRecords.shift();
    }

    localStorage.setItem('axis_sleep_records', JSON.stringify(sleepRecords));

    // Update today telemetry
    todayTelemetry.sleepHours = hours;
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_today_sleep', hours);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);

    renderSleepView();
    refreshCoreView();
}

function refreshSleepView() {
    renderSleepView();
}