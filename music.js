/* ==========================================
   AXIS OS // music.js
   Minimal music surface + Thawra plan
   ========================================== */

let activePlayerState = {
    currentView: localStorage.getItem('axis_music_view') || 'thawra'
};

let thawraPlanState = JSON.parse(localStorage.getItem('axis_thawra_plan_state') || 'null') || {
    dailyAnki: false,
    dailyToneGym: false,
    dailySession: false,
    dailyLesson: '',
    paletteNotes: {
        pigeon_dark: '',
        opium_float: '',
        parker_room: ''
    },
    projectNotes: {
        thawra: ''
    }
};

function initMusic() {
    renderMusicView();
}

function saveThawraPlanState() {
    localStorage.setItem('axis_thawra_plan_state', JSON.stringify(thawraPlanState));
}

function switchMusicView(view) {
    activePlayerState.currentView = view;
    localStorage.setItem('axis_music_view', view);
    renderMusicView();
}

function renderMusicView() {
    const container = document.getElementById('module-music');
    if (!container) return;

    if (activePlayerState.currentView === 'player') {
        container.innerHTML = `
            <div class="cockpit-header">
                <span>MUSIC</span>
                <div class="row flex-wrap" style="gap: 8px;">
                    <button class="tactical-btn ${activePlayerState.currentView === 'player' ? 'active' : ''}" onclick="switchMusicView('player')">PLAYER</button>
                    <button class="tactical-btn ${activePlayerState.currentView === 'thawra' ? 'active' : ''}" onclick="switchMusicView('thawra')">THAWRA</button>
                </div>
            </div>
            <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px;">
                <div class="cockpit-card stack" style="min-height: 280px; justify-content: center; align-items: center; text-align: center;">
                    <div class="font-mono text-base text-muted">PLAYER</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">EMPTY</div>
                </div>
                <div class="cockpit-card stack" style="min-height: 280px; justify-content: center; align-items: center; text-align: center;">
                    <div class="font-mono text-base text-muted">PROJECTS</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">EMPTY</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = renderThawraPlanView();
}

function renderThawraPlanView() {
    const dayChecks = [
        { key: 'dailyAnki', label: 'ANKI' },
        { key: 'dailyToneGym', label: 'TONEGYM' },
        { key: 'dailySession', label: 'SESSION' }
    ];

    const palettes = [
        { id: 'pigeon_dark', name: 'PIGEON DARK', meta: 'F# Dorian • Minor 7th/9th • 70–80 BPM • MOND/Muhab' },
        { id: 'opium_float', name: 'OPIUM FLOAT', meta: 'E Phrygian • Minor 7th • 65–75 BPM • Sofaygo / Lucki' },
        { id: 'parker_room', name: 'PARKER ROOM', meta: 'A Lydian • Maj7 / 9 • 80–90 BPM • Tame Impala' }
    ];

    return `
        <div class="cockpit-header">
            <span>THAWRA // SUMMER PLAN</span>
            <div class="row flex-wrap" style="gap: 8px;">
                <button class="tactical-btn ${activePlayerState.currentView === 'player' ? 'active' : ''}" onclick="switchMusicView('player')">PLAYER</button>
                <button class="tactical-btn ${activePlayerState.currentView === 'thawra' ? 'active' : ''}" onclick="switchMusicView('thawra')">THAWRA</button>
            </div>
        </div>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px;">
            <div class="cockpit-card stack stack-md">
                <div class="font-mono text-base font-semibold text-accent">OVERVIEW</div>
                <div class="stack stack-sm text-base" style="line-height: 1.7;">
                    <div><strong>10 weeks</strong> • 3–4 sessions/week</div>
                    <div>Goal: <strong>drop on Instagram before summer ends</strong></div>
                    <div>DAW: <strong>FL Studio</strong></div>
                    <div>Sound zone: <strong>dark psychedelic hip-hop, opium trap, MOND territory</strong></div>
                </div>
                <div class="divider"></div>
                <div class="font-mono text-base font-semibold text-main">DAILY SYSTEM</div>
                <div class="row flex-wrap" style="gap: 10px;">
                    ${dayChecks.map(item => `
                        <label class="badge badge-muted" style="cursor: pointer; padding: 10px 14px;">
                            <input type="checkbox" ${thawraPlanState[item.key] ? 'checked' : ''} onchange="toggleThawraCheck('${item.key}', this.checked)" style="width: 14px; height: 14px; accent-color: var(--hud-violet);">
                            ${item.label}
                        </label>
                    `).join('')}
                </div>
                <textarea class="tactical-input w-full" rows="4" placeholder="One thing learned today..." oninput="updateThawraDailyLesson(this.value)">${thawraPlanState.dailyLesson || ''}</textarea>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="font-mono text-base font-semibold text-cyan">WHAT YOU'RE FIXING</div>
                <div class="stack stack-sm text-base" style="line-height: 1.7;">
                    <div><strong>Theory gaps</strong> → Memorization system (Anki + ToneGym) + phase-by-phase application</div>
                    <div><strong>Arrangement avoidance</strong> → Structured finishing drills starting Phase 3</div>
                    <div><strong>Mix decisions</strong> → Master chain protocol + reference habit from Week 1</div>
                </div>
                <div class="divider"></div>
                <div class="font-mono text-base font-semibold text-main">MASTER CHAIN</div>
                <div class="stack stack-sm text-sm text-muted" style="line-height: 1.7;">
                    <div>1. Parametric EQ 2 — subtractive only</div>
                    <div>2. Fresh Air — 20–40% max</div>
                    <div>3. Blackbox — subtle warmth/glue</div>
                    <div>4. Ozone Multiband Imager — widen highs, keep lows mono</div>
                    <div>5. Limiter — 1–3dB GR max, -0.3 to -1dB ceiling</div>
                </div>
            </div>
        </section>

        <section class="cockpit-card stack stack-md">
            <div class="font-mono text-base font-semibold text-accent">PHASES</div>
            <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 16px;">
                <div class="list-item stack stack-sm" style="align-items: stretch;">
                    <div class="font-mono font-semibold">PHASE 1 — WEEKS 1–3</div>
                    <div class="text-sm text-muted">Grammar of sound • intervals • Dorian / Phrygian / Lydian • build loops fast</div>
                </div>
                <div class="list-item stack stack-sm" style="align-items: stretch;">
                    <div class="font-mono font-semibold">PHASE 2 — WEEKS 4–6</div>
                    <div class="text-sm text-muted">Harmony that hits • 7ths / 9ths • borrowed chords • voice leading</div>
                </div>
                <div class="list-item stack stack-sm" style="align-items: stretch;">
                    <div class="font-mono font-semibold">PHASE 3 — WEEKS 7–9</div>
                    <div class="text-sm text-muted">Melody + arrangement • motif development • subtraction-based arrangement</div>
                </div>
                <div class="list-item stack stack-sm" style="align-items: stretch;">
                    <div class="font-mono font-semibold">PHASE 4 — WEEKS 10–11</div>
                    <div class="text-sm text-muted">Expression + identity • rhythm / humanization • sound palettes • drop prep</div>
                </div>
            </div>
        </section>

        <section class="cockpit-card stack stack-md">
            <div class="font-mono text-base font-semibold text-cyan">SOUND PALETTES</div>
            <div class="grid grid-cols-1 md-grid-cols-3" style="gap: 16px;">
                ${palettes.map(palette => `
                    <div class="cockpit-card-flat stack stack-sm" style="padding: 16px;">
                        <div class="font-mono font-semibold">${palette.name}</div>
                        <div class="text-sm text-muted">${palette.meta}</div>
                        <textarea class="tactical-input w-full" rows="5" placeholder="Palette notes..." oninput="updateThawraPaletteNote('${palette.id}', this.value)">${thawraPlanState.paletteNotes?.[palette.id] || ''}</textarea>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="cockpit-card stack stack-md">
            <div class="font-mono text-base font-semibold text-main">THAWRA PROJECT NOTES</div>
            <textarea class="tactical-input w-full" rows="8" placeholder="Ideas, release notes, IG strategy, visuals..." oninput="updateThawraProjectNotes(this.value)">${thawraPlanState.projectNotes?.thawra || ''}</textarea>
        </section>
    `;
}

function toggleThawraCheck(key, value) {
    thawraPlanState[key] = !!value;
    saveThawraPlanState();
}

function updateThawraDailyLesson(value) {
    thawraPlanState.dailyLesson = String(value || '');
    saveThawraPlanState();
}

function updateThawraPaletteNote(id, value) {
    thawraPlanState.paletteNotes[id] = String(value || '');
    saveThawraPlanState();
}

function updateThawraProjectNotes(value) {
    thawraPlanState.projectNotes.thawra = String(value || '');
    saveThawraPlanState();
}
