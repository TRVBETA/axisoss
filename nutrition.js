/* ==========================================
   AXIS OS // nutrition.js
   Nutrition placeholder + hydration tracker
   ========================================== */

function initNutrition() {
    renderNutritionView();
}

function renderNutritionView() {
    const container = document.getElementById('module-nutrition');
    if (!container) return;

    const waterLiters = typeof todayTelemetry !== 'undefined' ? todayTelemetry.waterLiters : 0;
    const waterTaps = Math.min(7, Math.floor(waterLiters / 0.6));

    container.innerHTML = `
        <div class="cockpit-header">
            <span>NUTRITION</span>
            <span style="font-size: 0.75rem; color: var(--hud-warning);">PLACEHOLDER + HYDRATION</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start;">
            <div class="cockpit-card" style="padding: 28px;">
                <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-cyan); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>HYDRATION</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">600ML UNITS • GOAL 4.0L</span>
                </div>

                <div style="margin: 16px 0; font-family: var(--font-mono); font-size: 1.4rem; font-weight: bold; color: var(--text-main);">
                    TOTAL: <span style="color: var(--hud-cyan); text-shadow: 0 0 10px var(--hud-cyan-glow);">${waterLiters.toFixed(1)} L</span> / 4.0 L
                </div>

                <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
                    ${typeof renderWaterCartridgesHTML === 'function' ? renderWaterCartridgesHTML(waterTaps) : ''}
                </div>

                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                    <span>TAP A CARTRIDGE TO CHANGE WATER LOG</span>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="resetWaterFromNutrition()">RESET</button>
                </div>
            </div>

            <div class="cockpit-card" style="padding: 40px; align-items: center; justify-content: center; text-align: center; border-color: var(--hud-warning); min-height: 320px; background: radial-gradient(circle at center, rgba(245, 158, 11, 0.05) 0%, transparent 70%);">
                <div style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: bold; color: var(--text-main); letter-spacing: 4px; text-transform: uppercase;">
                    NUTRITION MODULE STANDBY
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-muted); max-width: 560px; margin-top: 16px; line-height: 1.7;">
                    Full macro logging and meal structure can be built later. For now this section keeps hydration and reserves the slot for future food tracking.
                </div>
            </div>
        </div>
    `;
}

function resetWaterFromNutrition() {
    if (typeof resetWater === 'function') resetWater();
    renderNutritionView();
}