/* ------------------------------------------
   AXIS OS // finance.js
   Minimal finance surface
   ------------------------------------------ */

let currentEGXPosition = {
    ticker: 'HRHO.CA',
    label: 'EFG Holding',
    platform: 'THNDR',
    shares: 68,
    avgCost: 19.12,
    currentPrice: 19.85,
    lastUpdated: 'Just now'
};

function initFinance() {
    renderFinanceView();
}

function renderFinanceView() {
    const container = document.getElementById('module-finance');
    if (!container) return;

    const invested = currentEGXPosition.shares * currentEGXPosition.avgCost;
    const currentValue = currentEGXPosition.shares * currentEGXPosition.currentPrice;
    const pnl = currentValue - invested;
    const pnlPct = invested ? (pnl / invested) * 100 : 0;
    const isProfit = pnl >= 0;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>Finance</span>
            <span class="text-sm text-muted">Single position overview</span>
        </div>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px; align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px; align-items: flex-start;">
                    <div class="stack stack-sm">
                        <div class="stat-label">Position</div>
                        <div style="font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05;">${currentEGXPosition.ticker}</div>
                        <div class="text-sm text-muted">${currentEGXPosition.label} • ${currentEGXPosition.platform}</div>
                    </div>
                    <span class="badge ${isProfit ? 'badge-accent' : 'badge-muted'}">${isProfit ? 'In profit' : 'Below cost'}</span>
                </div>

                <div class="grid grid-cols-2" style="gap: 12px;">
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">Current value</div>
                        <div class="text-2xl font-bold">${Math.round(currentValue)} EGP</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">P&L</div>
                        <div class="text-2xl font-bold" style="color: ${isProfit ? 'var(--hud-violet)' : 'var(--hud-critical)'};">${isProfit ? '+' : ''}${pnl.toFixed(1)} EGP</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 md-grid-cols-4" style="gap: 12px;">
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">Shares</div>
                        <div class="font-bold text-main">${currentEGXPosition.shares}</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">Avg cost</div>
                        <div class="font-bold text-main">${currentEGXPosition.avgCost} EGP</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">Market</div>
                        <div class="font-bold text-main">${currentEGXPosition.currentPrice} EGP</div>
                    </div>
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 14px;">
                        <div class="text-sm text-muted">Change</div>
                        <div class="font-bold" style="color: ${isProfit ? 'var(--hud-violet)' : 'var(--hud-critical)'};">${isProfit ? '+' : ''}${pnlPct.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="stat-label">Note</div>
                <div class="text-base" style="line-height: 1.8; color: var(--text-main);">This page stays intentionally quiet. If you later want full finance tracking, use it for editable balances, positions, and simple notes instead of fake market clutter.</div>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button class="tactical-btn" onclick="simulateMarketTick()">Refresh mock price</button>
                </div>
                <div class="text-sm text-muted">Last updated: ${currentEGXPosition.lastUpdated}</div>
            </div>
        </section>
    `;
}

function simulateMarketTick() {
    currentEGXPosition.currentPrice = parseFloat((19.50 + Math.random() * 0.8).toFixed(2));
    currentEGXPosition.lastUpdated = 'Just now';
    renderFinanceView();
}
