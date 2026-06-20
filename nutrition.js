/* ==========================================
   AXIS OS // nutrition.js
   Reserved Architecture Placeholder Module
   Philosophy: Will be built when diet situation is clearer (currently at family home)
   ========================================== */

function initNutrition() {
    renderNutritionView();
}

function renderNutritionView() {
    const container = document.getElementById('module-nutrition');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>METABOLIC TELEMETRY // NUTRITION & MACROS</span>
            <span style="font-size: 0.75rem; color: var(--hud-warning);">RESERVED ARCHITECTURAL SLOT</span>
        </div>

        <div class="cockpit-card" style="padding: 60px 40px; align-items: center; justify-content: center; text-align: center; border-color: var(--hud-warning); min-height: 450px; background: radial-gradient(circle at center, rgba(245, 158, 11, 0.05) 0%, transparent 70%);">
            
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--hud-warning)" stroke-width="2" style="margin-bottom: 16px; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.4));">
                <path d="M12 2a10 10 0 1 0 10 104 4 0 0 1-5-5 4 4 0 0 1-5-5z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>

            <div style="font-family: var(--font-mono); font-size: 1.6rem; font-weight: bold; color: var(--text-main); letter-spacing: 4px; text-transform: uppercase;">
                MODULE STANDBY // SUMMER FAMILY RESIDENCE PROTOCOL
            </div>

            <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-muted); max-width: 680px; margin-top: 16px; line-height: 1.6;">
                This slot is permanently locked into the AXIS OS architecture. Full macro nutrition, caloric expenditure matching, and meal intake telemetry will be constructed and deployed here as soon as autonomous control over lunch / daily diet is re-established.
            </div>

            <div style="margin-top: 32px; display: flex; gap: 16px;">
                <button class="tactical-btn" onclick="switchModule('core')">&laquo; RETURN TO CORE</button>
                <button class="tactical-btn" onclick="switchModule('fitness')">CHECK FITNESS LIFECYCLES &raquo;</button>
            </div>

        </div>
    `;
}