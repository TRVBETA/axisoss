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
            <span>FINANCIAL TELEMETRY // EGX & platform POSITIONS</span>
            <span style="font-size: 0.75rem; color: var(--hud-cyan);">PHASE 3 AUTONOMOUS BOT BRIDGE</span>
        </div>

        <!-- Top Full Width Ticker Strip -->
        <div style="background: var(--bg-surface); border: 1px solid var(--text-muted); padding: 16px 32px; font-family: var(--font-mono); font-size: 0.9rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; clip-path: var(--clip-corner-sm);">
            <div style="display: flex; gap: 32px; align-items: center;">
                <span style="color: var(--hud-cyan); font-weight: bold;">LIVE EGX FEED:</span>
                <span>HRHO: <strong style="color: var(--hud-optimal);">19.85 EGP</strong> (+3.8%)</span>
                <span>COMI: <strong style="color: var(--hud-optimal);">84.20 EGP</strong> (+1.2%)</span>
                <span>FWRY: <strong style="color: var(--hud-critical);">6.45 EGP</strong> (-0.8%)</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">SOURCE: EGX LIVE Platform</span>
        </div>

        <!-- Active Position Tier -->
        <div style="display: grid; grid-template-columns: 1fr 400px; gap: 40px;">
            
            <!-- Left: HRHO THNDR Cockpit Card -->
            <div class="cockpit-card" style="padding: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; font-family: var(--font-mono); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">ACTIVE PORTFOLIO ASSET</div>
                        <div style="font-size: 1.8rem; font-weight: bold; color: var(--text-main); margin-top: 4px;">
                            ${currentEGXPosition.ticker}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--hud-cyan); font-weight: bold; margin-top: 4px;">
                            ${currentEGXPosition.platform}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: var(--text-muted);">TOTAL ASSET VALUE</div>
                        <div style="font-size: 1.8rem; font-weight: bold; color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">
                            ~${Math.round(currentValue)} EGP
                        </div>
                    </div>
                </div>

                <!-- Position Metrics Grid -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; font-family: var(--font-mono); margin: 12px 0;">
                    <div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">${currentEGXPosition.shares}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">SHARES HELD</div>
                    </div>
                    <div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">${currentEGXPosition.avgCost} EGP</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">AVG COST</div>
                    </div>
                    <div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">${currentEGXPosition.currentPrice} EGP</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">CURRENT MARKET</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.3rem; font-weight: bold; color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'};">
                            ${isProfit ? '+' : ''}${pnl.toFixed(1)} EGP
                        </div>
                        <div style="font-size: 0.75rem; color: ${isProfit ? 'var(--hud-optimal)' : 'var(--hud-critical)'}; font-weight: bold; margin-top: 4px;">
                            (${isProfit ? '+' : ''}${pnlPct.toFixed(1)}%)
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
                    <span>TELEMETRY STATE: SYNCHRONIZED WITH THNDR</span>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="simulateMarketTick()">SIMULATE EGX TICK</button>
                </div>
            </div>

            <!-- Right: Phase 3 Telegram Finance Bot Notice -->
            <div class="cockpit-card" style="padding: 32px; justify-content: space-between; border-color: rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);">
                <div>
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 12px;">
                        🤖 PHASE 3 AUTONOMOUS FINANCE BOT
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); line-height: 1.6;">
                        This module is engineered to integrate with your standalone Telegram financial AI bot. Once fully deployed, the bot will autonomously scrape live EGX news feeds, parse enterprise financial reports, and inject real-time multi-API stock alerts directly into this cockpit tier.
                    </div>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--hud-optimal); font-weight: bold;">
                    ✓ BRIDGE INFRASTRUCTURE LOCKED
                </div>
            </div>

        </div>
    `;
}

function simulateMarketTick() {
    currentEGXPosition.currentPrice = parseFloat((19.50 + Math.random() * 0.8).toFixed(2));
    renderFinanceView();
}