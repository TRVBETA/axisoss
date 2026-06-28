/* ==========================================
   AXIS OS // sleep.js
   Sleep module + iPhone Shortcut webhook integration
   ========================================== */

let sleepRecords = JSON.parse(localStorage.getItem('axis_sleep_records') || '[]');
let sleepServerState = { syncMode: 'local', lastError: '' };

if (sleepRecords.length === 0) {
    sleepRecords = [
        { date: '13 JUN', hours: 7.2, wakeTime: '06:30 AM', quality: 4 },
        { date: '14 JUN', hours: 6.5, wakeTime: '07:00 AM', quality: 3 },
        { date: '15 JUN', hours: 8.0, wakeTime: '06:15 AM', quality: 5 },
        { date: '16 JUN', hours: 5.8, wakeTime: '07:45 AM', quality: 2 },
        { date: '17 JUN', hours: 7.5, wakeTime: '06:20 AM', quality: 4 },
        { date: '18 JUN', hours: 6.8, wakeTime: '06:40 AM', quality: 4 },
        { date: '19 JUN', hours: Object.is(todayTelemetry.sleepHours, 0) ? 7.1 : todayTelemetry.sleepHours, wakeTime: '06:25 AM', quality: 4 }
    ];
}

function initSleep() {
    renderSleepView();
    loadSleepFromServer({ silent: true });
}

function renderSleepView() {
    const container = document.getElementById('module-sleep');
    if (!container) return;
    const isMobile = window.innerWidth <= 900;
    let latest = sleepRecords[sleepRecords.length - 1] || { date: 'TODAY', hours: 0, wakeTime: 'PENDING', quality: 3 };

    container.innerHTML = `
        <div class="cockpit-header">
            <span>SLEEP</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${sleepServerState.syncMode === 'server' ? 'SHORTCUT WEBHOOK READY' : 'LOCAL / SIMULATED'}</span>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : 'repeat(3, 1fr)'}; gap: 32px;">
            <div class="cockpit-card" style="padding: 28px; justify-content: space-between; border-color: rgba(255,255,255,0.06); box-shadow: none;">
                <div style="font-family: var(--font-body); font-size: 0.78rem; color: var(--text-muted);">LATEST SLEEP</div>
                <div style="font-family: var(--font-body); font-size: 4.1rem; font-weight: 700; color: var(--text-main); line-height: 1;">
                    ${latest.hours.toFixed(1)} <span style="font-size: 1.5rem; color: var(--text-main); font-weight: normal;">HOURS</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--hud-optimal);">+10 SCORE WHEN LOGGED</div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">WAKE TIME</div>
                <div style="font-family: var(--font-mono); font-size: 3.2rem; font-weight: bold; color: var(--text-main); letter-spacing: 2px;">${latest.wakeTime}</div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">iPHONE SHORTCUT FIELD</div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">QUALITY</div>
                <div style="display: flex; gap: 12px; align-items: center;">${renderQualityStarsHTML(latest.quality)}</div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>${latest.quality} / 5</span>
                    <span style="color: var(--hud-violet); cursor: pointer;" onclick="promptQualityEdit()">EDIT</span>
                </div>
            </div>
        </div>

        <div class="cockpit-card" style="padding: 32px;">
            <div style="font-family: var(--font-mono); font-size: 1rem; font-weight: bold; color: var(--text-main); letter-spacing: 3px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span>WEEKLY TREND</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 24px; height: 260px; align-items: flex-end; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                ${renderWeeklyChartBarsHTML()}
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 24px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 12px;">
                ${sleepRecords.slice(-7).map(r => `<span>${r.date}</span>`).join('')}
            </div>
        </div>

        <div class="cockpit-card" style="padding: 28px; gap: 16px;">
            <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold;">SHORTCUT WEBHOOK</div>
            <div style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted); line-height: 1.7; background: rgba(255,255,255,0.03); padding: 14px;">
                POST sleep data from iPhone Shortcuts to <strong>/api/sleep</strong> with hours, wakeTime, optional quality, and optional secret token.
            </div>
            <form onsubmit="handleSimulateSleepShortcut(event)" style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr 1fr'}; gap: 24px; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Hours</label>
                    <input type="number" step="0.1" class="tactical-input" id="shortcut-sim-hours" required min="1" max="16" value="7.5">
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">Wake Time</label>
                    <input type="text" class="tactical-input" id="shortcut-sim-wake" required value="06:15 AM">
                </div>
                <button type="submit" class="tactical-btn" style="justify-content: center; height: 46px;">SIMULATE WEBHOOK</button>
            </form>
        </div>
    `;
}

function renderQualityStarsHTML(quality) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const active = i <= quality;
        html += `<div onclick="updateLatestQuality(${i})" style="width: 48px; height: 48px; background: ${active ? 'rgba(200,167,106,0.18)' : 'var(--bg-surface)'}; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; display: flex; justify-content: center; align-items: center; color: ${active ? 'var(--hud-violet)' : 'var(--text-muted)'}; font-size: 1.4rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">★</div>`;
    }
    return html;
}

function updateLatestQuality(newQ) {
    if (sleepRecords.length > 0) {
        sleepRecords[sleepRecords.length - 1].quality = newQ;
        localStorage.setItem('axis_sleep_records', JSON.stringify(sleepRecords));
    }
    renderSleepView();
}

function promptQualityEdit() {
    const q = prompt('Enter Sleep Quality Rating (1 to 5):', '4');
    if (q !== null) {
        const num = parseInt(q, 10);
        if (num >= 1 && num <= 5) updateLatestQuality(num);
    }
}

function renderWeeklyChartBarsHTML() {
    const maxH = 10;
    return sleepRecords.slice(-7).map(r => {
        const heightPct = Math.min(100, Math.max(10, (r.hours / maxH) * 100));
        const isOptimal = r.hours >= 7;
        return `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%;"><span style="font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; color: ${isOptimal ? 'var(--text-main)' : 'var(--text-muted)'};">${r.hours.toFixed(1)}h</span><div style="width: 100%; height: ${heightPct}%; background: ${isOptimal ? 'linear-gradient(to top, rgba(156,175,136,0.95), rgba(156,175,136,0.55))' : 'linear-gradient(to top, rgba(200,167,106,0.85), rgba(200,167,106,0.45))'}; border-radius: 12px 12px 0 0;"></div></div>`;
    }).join('');
}

function shouldUseSleepServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadSleepFromServer({ silent = false } = {}) {
    if (!shouldUseSleepServer()) return false;
    try {
        const resp = await fetch('/api/sleep', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        if (Array.isArray(data.rows) && data.rows.length) {
          sleepRecords = data.rows
            .slice()
            .reverse()
            .map(row => ({
              date: formatSleepDate(row.log_date),
              hours: Number(row.hours_slept),
              wakeTime: row.wake_time,
              quality: row.quality_rating || 3
            }));
          localStorage.setItem('axis_sleep_records', JSON.stringify(sleepRecords));
        }
        sleepServerState.syncMode = 'server';
        sleepServerState.lastError = '';
        renderSleepView();
        refreshCoreView();
        return true;
    } catch (e) {
        sleepServerState.syncMode = 'local';
        sleepServerState.lastError = e.message || 'FAILED TO LOAD SLEEP';
        return false;
    }
}

async function manualSleepSync() {
  const ok = await loadSleepFromServer({ silent: false });
  if (!ok) alert(`Sleep sync failed: ${sleepServerState.lastError || 'Unknown error'}`);
}

async function handleSimulateSleepShortcut(e) {
    e.preventDefault();
    const hours = parseFloat(document.getElementById('shortcut-sim-hours').value);
    const wakeTime = document.getElementById('shortcut-sim-wake').value;

    if (shouldUseSleepServer()) {
      try {
        const resp = await fetch('/api/sleep', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours, wakeTime, quality: 4 })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        await loadSleepFromServer({ silent: false });
        return;
      } catch (err) {
        console.warn('Webhook simulation failed:', err.message);
      }
    }

    const now = new Date();
    const dateStr = formatSleepDate(now.toISOString());
    const newRec = { date: dateStr, hours, wakeTime, quality: 4 };
    if (sleepRecords.length > 0 && sleepRecords[sleepRecords.length - 1].date === dateStr) sleepRecords[sleepRecords.length - 1] = newRec;
    else {
        sleepRecords.push(newRec);
        if (sleepRecords.length > 14) sleepRecords.shift();
    }
    localStorage.setItem('axis_sleep_records', JSON.stringify(sleepRecords));
    todayTelemetry.sleepHours = hours;
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_today_sleep', hours);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
    renderSleepView();
    refreshCoreView();
}

function formatSleepDate(value) {
  const now = new Date(value);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]}`;
}

function refreshSleepView() {
    renderSleepView();
}