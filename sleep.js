/* ==========================================
   AXIS OS // sleep.js
   Sleep module + iPhone Shortcut webhook integration
   ========================================== */

let sleepRecords = JSON.parse(localStorage.getItem('axis_sleep_records') || '[]');
let sleepServerState = { syncMode: 'local', lastError: '' };

function initSleep() {
    renderSleepView();
    loadSleepFromServer({ silent: true });
}

function renderSleepView() {
    const container = document.getElementById('module-sleep');
    if (!container) return;
    const hasSleepData = sleepRecords.length > 0;
    let latest = sleepRecords[sleepRecords.length - 1] || { date: 'TODAY', hours: 0, wakeTime: 'PENDING', quality: 0 };

    container.innerHTML = `
        <div class="cockpit-header">
            <span>SLEEP</span>
            <span class="text-sm text-muted">${sleepServerState.syncMode === 'server' ? 'SHORTCUT WEBHOOK READY' : 'LOCAL / EMPTY'}</span>
        </div>

        <section class="grid grid-cols-1 md-grid-cols-3" style="gap: 24px;">
            <div class="cockpit-card cockpit-card-flat stack" style="padding: 28px; justify-content: space-between;">
                <div class="font-body text-sm text-muted">LATEST SLEEP</div>
                <div class="font-body font-bold text-main" style="font-size: clamp(2.8rem, 10vw, 4.1rem); line-height: 1.1;">
                    ${hasSleepData ? latest.hours.toFixed(1) : '—'} <span style="font-size: 1.5rem; font-weight: normal;">HOURS</span>
                </div>
                <div class="font-mono text-sm ${hasSleepData ? 'text-optimal' : 'text-muted'}">${hasSleepData ? '+10 SCORE WHEN LOGGED' : 'NO SLEEP LOG YET'}</div>
            </div>

            <div class="cockpit-card stack" style="padding: 28px; justify-content: space-between;">
                <div class="font-mono text-sm text-muted">WAKE TIME</div>
                <div class="font-mono font-bold text-main" style="font-size: clamp(2rem, 8vw, 3.2rem); letter-spacing: 2px;">${hasSleepData ? latest.wakeTime : '—'}</div>
                <div class="font-mono text-sm text-muted">iPHONE SHORTCUT FIELD</div>
            </div>

            <div class="cockpit-card stack" style="padding: 28px; justify-content: space-between;">
                <div class="font-mono text-sm text-muted">QUALITY</div>
                <div class="row" style="gap: 12px;">${renderQualityStarsHTML(latest.quality)}</div>
                <div class="row font-mono text-sm text-muted" style="justify-content: space-between;">
                    <span>${hasSleepData ? latest.quality : '0'} / 5</span>
                    <span class="text-accent cursor-pointer" onclick="promptQualityEdit()">EDIT</span>
                </div>
            </div>
        </section>

        <section class="cockpit-card stack" style="padding: 32px;">
            <div class="row flex-wrap font-mono font-bold text-main" style="justify-content: space-between; gap: 12px; letter-spacing: 3px;">
                <span>WEEKLY TREND</span>
            </div>
            <div class="grid" style="grid-template-columns: repeat(7, 1fr); gap: clamp(8px, 3vw, 24px); height: 260px; align-items: flex-end; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                ${renderWeeklyChartBarsHTML()}
            </div>
            <div class="grid font-mono text-sm text-muted text-center" style="grid-template-columns: repeat(7, 1fr); gap: clamp(8px, 3vw, 24px); margin-top: 12px;">
                ${hasSleepData ? sleepRecords.slice(-7).map(r => `<span>${r.date}</span>`).join('') : Array.from({ length: 7 }, () => `<span>—</span>`).join('')}
            </div>
        </section>

        <section class="cockpit-card stack" style="padding: 28px; gap: 16px;">
            <div class="font-mono font-bold text-accent">SHORTCUT WEBHOOK</div>
            <div class="font-mono text-sm text-muted" style="line-height: 1.7; background: rgba(255,255,255,0.03); padding: 14px;">
                POST sleep data from iPhone Shortcuts to <strong>/api/sleep</strong> with hours, wakeTime, optional quality, and optional secret token.
            </div>
            <form onsubmit="handleSimulateSleepShortcut(event)" class="grid grid-cols-1 md-grid-cols-3" style="gap: 24px; align-items: flex-end;">
                <div class="stack" style="gap: 6px;">
                    <label class="form-label">Hours</label>
                    <input type="number" step="0.1" class="tactical-input w-full" id="shortcut-sim-hours" required min="1" max="16" value="7.5">
                </div>
                <div class="stack" style="gap: 6px;">
                    <label class="form-label">Wake Time</label>
                    <input type="text" class="tactical-input w-full" id="shortcut-sim-wake" required value="06:15 AM">
                </div>
                <button type="submit" class="tactical-btn w-full" style="justify-content: center; height: 46px;">SIMULATE WEBHOOK</button>
            </form>
        </section>
    `;
}

function renderQualityStarsHTML(quality) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const active = i <= quality;
        html += `<div onclick="updateLatestQuality(${i})" class="cursor-pointer" style="width: 48px; height: 48px; background: ${active ? 'rgba(200,167,106,0.18)' : 'var(--bg-surface)'}; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; display: flex; justify-content: center; align-items: center; color: ${active ? 'var(--hud-violet)' : 'var(--text-muted)'}; font-size: 1.4rem; font-weight: bold; transition: all 0.2s;">★</div>`;
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
    if (!sleepRecords.length) {
        return Array.from({ length: 7 }, () => `<div class="stack" style="align-items: center; gap: 8px; height: 100%;"><span class="font-body font-semibold" style="font-size: 0.82rem; color: var(--text-muted);">—</span><div style="width: 100%; height: 14%; background: linear-gradient(to top, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); border-radius: 12px 12px 0 0;"></div></div>`).join('');
    }
    const maxH = 10;
    return sleepRecords.slice(-7).map(r => {
        const heightPct = Math.min(100, Math.max(10, (r.hours / maxH) * 100));
        const isOptimal = r.hours >= 7;
        return `<div class="stack" style="align-items: center; gap: 8px; height: 100%;"><span class="font-body font-semibold" style="font-size: 0.82rem; color: ${isOptimal ? 'var(--text-main)' : 'var(--text-muted)'};">${r.hours.toFixed(1)}h</span><div style="width: 100%; height: ${heightPct}%; background: ${isOptimal ? 'linear-gradient(to top, rgba(156,175,136,0.95), rgba(156,175,136,0.55))' : 'linear-gradient(to top, rgba(200,167,106,0.85), rgba(200,167,106,0.45))'}; border-radius: 12px 12px 0 0;"></div></div>`;
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
  if (!ok) console.warn(`Sleep sync failed: ${sleepServerState.lastError || 'Unknown error'}`);
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