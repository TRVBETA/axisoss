/* ==========================================
   AXIS OS // design.js
   Minimal empty design surface
   ========================================== */

function initDesign() {
    renderDesignView();
}

function renderDesignView() {
    const container = document.getElementById('module-design');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>DESIGN</span>
            <span class="text-sm text-muted">CURRENT PROJECT</span>
        </div>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px;">
            <div class="cockpit-card stack" style="min-height: 260px; justify-content: center; align-items: center; text-align: center;">
                <div class="font-mono text-base text-muted">WORKSPACE</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">EMPTY</div>
                <div class="text-sm text-muted">Use this space intentionally later.</div>
            </div>

            <div class="cockpit-card stack" style="min-height: 260px; justify-content: center; align-items: center; text-align: center;">
                <div class="font-mono text-base text-muted">NOTES / DELIVERABLES</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">EMPTY</div>
                <div class="text-sm text-muted">No fake examples, no filler content.</div>
            </div>
        </section>
    `;
}

async function logAdditionalDesignHour(amount) {
    todayTelemetry.designHours = Math.min(16, Number(todayTelemetry.designHours || 0) + amount);
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_today_design', todayTelemetry.designHours);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);

    if (window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online') {
        fetch('/api/daily', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'design-add', amount })
        }).catch(() => {});
    }

    renderDesignView();
    refreshCoreView();
}

function refreshDesignView() {
    renderDesignView();
}