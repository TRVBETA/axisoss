/* ==========================================
   AXIS OS // finance.js
   EGX Ticker Module, Active HRHO Position (~1300 EGP on THNDR),
   P&L Telemetry Readout, and Phase 3 Autonomous Bot Integration
   ========================================== */

let currentEGXPosition = {
    ticker: "HRHO.CA // EFG HOLDING",
    platform: "THNDR PLATFORM // SECURE",
    shares: 68,
    avgCost: 19.12,
    currentPrice: 19.85,
    lastUpdated: "JUST NOW"
};

function initFinance() {
    renderFinanceView();
}

function renderFinanceView() {
    const container = document.getElementById('module-finance');
    if (!container) return;

    let invested = currentEGXPosition.shares * currentEGXPosition.avgCost;
    let currentValue = currentEGXPosition.shares * currentEGXPosition.currentPrice;
    let pnl = currentValue - invested;
    let pnlPct = (pnl / invested) * 100;

    let isProfit = pnl >= 0;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>FINANCIAL TELEMETRY // EGX & PLATFORM POSITIONS</span>
            <span class="text-sm text-cyan">PHASE 3 AUTONOMOUS BOT BRIDGE</span>
        </div>

        <!-- Top Full Width Ticker Strip -->
        <section class="row flex-wrap font-mono text-base text-main" style="background: var(--bg-surface); border: 1px solid var(--text-muted); padding: clamp(12px, 2vw, 16px) clamp(16px, 3vw, 32px); gap: clamp(16px, 3vw, 32px); justify-content: space-between; border-radius: 12px;">
            <div class="row flex-wrap" style="gap: clamp(16px, 3vw, 32px); align-items: center;">
                <span class="text-cyan font-bold">LIVE EGX FEED:</span>
                <span>HRHO: <strong class="text-optimal">19.85 EGP</strong> (+3.8%)</span>
                <span>COMI: <strong class="text-optimal">84.20 EGP</strong> (+1.2%)</span>
                <span>FWRY: <strong class="text-critical">6.45 EGP</strong> (-0.8%)</span>
            </div>
            <span class="text-sm text-muted">SOURCE: EGX LIVE Platform</span>
        </section>

        <!-- Active Position Tier -->
        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; grid-template-columns: 1fr clamp(280px, 30vw, 400px);">

            <!-- Left: HRHO THNDR Cockpit Card -->
            <div class="cockpit-card stack" style="padding: clamp(20px, 3vw, 32px);">
                <div class="row flex-wrap font-mono" style="justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
                    <div class="flex-1" style="min-width: 0;">
                        <div class="text-sm text-muted">ACTIVE PORTFOLIO ASSET</div>
                        <div class="font-bold text-main" style="font-size: clamp(1.2rem, 3vw, 1.8rem); margin-top: 4px;">
                            ${currentEGXPosition.ticker}
                        </div>
                        <div class="font-bold text-cyan" style="font-size: 0.85rem; margin-top: 4px;">
                            ${currentEGXPosition.platform}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-muted">TOTAL ASSET VALUE</div>
                        <div class="font-bold" style="font-size: clamp(1.2rem, 3vw, 1.8rem); color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">
                            ~${Math.round(currentValue)} EGP
                        </div>
                    </div>
                </div>

                <!-- Position Metrics Grid -->
                <div class="grid font-mono" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 16px; margin: 12px 0;">
                    <div class="stat-block">
                        <div class="stat-value">${currentEGXPosition.shares}</div>
                        <div class="stat-label">SHARES HELD</div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-value">${currentEGXPosition.avgCost} EGP</div>
                        <div class="stat-label">AVG COST</div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-value">${currentEGXPosition.currentPrice} EGP</div>
                        <div class="stat-label">CURRENT MARKET</div>
                    </div>
                    <div class="stat-block text-right">
                        <div class="stat-value" style="color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">
                            ${isProfit ? '+' : ''}${pnl.toFixed(1)} EGP
                        </div>
                        <div class="stat-label" style="color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">
                            (${isProfit ? '+' : ''}${pnlPct.toFixed(1)}%)
                        </div>
                    </div>
                </div>

                <div class="row flex-wrap font-mono text-sm text-muted" style="justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; gap: 12px;">
                    <span>TELEMETRY STATE: SYNCHRONIZED WITH THNDR</span>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="simulateMarketTick()">SIMULATE EGX TICK</button>
                </div>
            </div>

            <!-- Right: Phase 3 Telegram Finance Bot Notice -->
            <div class="cockpit-card stack" style="padding: clamp(20px, 3vw, 32px); justify-content: space-between; border-color: rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);">
                <div>
                    <div class="font-mono font-bold text-accent" style="font-size: 1rem; margin-bottom: 12px;">
                        PHASE 3 AUTONOMOUS FINANCE BOT
                    </div>
                    <div class="font-mono text-muted" style="font-size: 0.85rem; line-height: 1.6;">
                        This module is engineered to integrate with your standalone Telegram financial AI bot. Once fully deployed, the bot will autonomously scrape live EGX news feeds, parse enterprise financial reports, and inject real-time multi-API stock alerts directly into this cockpit tier.
                    </div>
                </div>
                <div class="font-mono text-sm text-optimal font-bold">
                    BRIDGE INFRASTRUCTURE LOCKED
                </div>
            </div>

        </div>
    `;
}

function simulateMarketTick() {
    currentEGXPosition.currentPrice = parseFloat((19.50 + Math.random() * 0.8).toFixed(2));
    renderFinanceView();
}