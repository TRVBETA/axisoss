/* ==========================================
   AXIS OS // music.js
   Private Spotify / Audio Engine for Private Productions,
   Large Dominant Center Cover Art, HUD Playback Controls,
   Audio / Cover Upload Suite, and Organized Projects View
   ========================================== */

let musicProjects = JSON.parse(localStorage.getItem('axis_music_projects') || '[]');

if (musicProjects.length === 0) {
    // Seed initial private albums
    musicProjects = [
        {
            id: "proj-1",
            title: "SYNTHWAVE TELEMETRY",
            artist: "AXIS ACTUAL // PRIVATE PRODUCTION",
            cover: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80",
            tracks: [
                { id: "t-1", name: "01 // Nightcall Telemetry", duration: "04:20", audioUrl: "", isSynth: true, synthFreq: 110 },
                { id: "t-2", name: "02 // Hyperbaric Resonance", duration: "03:45", audioUrl: "", isSynth: true, synthFreq: 146.83 },
                { id: "t-3", name: "03 // Quantum Grid", duration: "05:12", audioUrl: "", isSynth: true, synthFreq: 82.41 }
            ]
        },
        {
            id: "proj-2",
            title: "INDOMIE EGYPT // COMMERCIAL OST",
            artist: "AXIS COMMERCIAL LAB",
            cover: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80",
            tracks: [
                { id: "t-4", name: "01 // Indomie Main Theme (Action)", duration: "01:30", audioUrl: "", isSynth: true, synthFreq: 196 },
                { id: "t-5", name: "02 // Noodle Crunch (Percussion)", duration: "00:45", audioUrl: "", isSynth: true, synthFreq: 220 }
            ]
        }
    ];
}

let activePlayerState = {
    currentProjectIdx: 0,
    currentTrackIdx: 0,
    currentView: localStorage.getItem('axis_music_view') || 'player',
    isPlaying: false,
    volume: 0.75,
    audioElement: null,
    synthGain: null,
    synthOscs: []
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

    let proj = musicProjects[activePlayerState.currentProjectIdx] || musicProjects[0];
    let track = proj.tracks[activePlayerState.currentTrackIdx] || proj.tracks[0];

    if (activePlayerState.currentView === 'thawra') {
        container.innerHTML = renderThawraPlanView();
        return;
    }

    container.innerHTML = `
        <div class="cockpit-header">
            <span>MUSIC</span>
            <div class="row flex-wrap" style="gap: 8px;">
                <button class="tactical-btn ${activePlayerState.currentView === 'player' ? 'active' : ''}" onclick="switchMusicView('player')">PLAYER</button>
                <button class="tactical-btn ${activePlayerState.currentView === 'thawra' ? 'active' : ''}" onclick="switchMusicView('thawra')">THAWRA</button>
            </div>
        </div>

        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; grid-template-columns: 1fr clamp(300px, 40vw, 500px);">

            <!-- Left: Center Cover Art & Dominant Player HUD -->
            <div class="cockpit-card stack" style="padding: 24px; align-items: center; justify-content: space-between; min-height: clamp(400px, 60vh, 650px);">

                <div class="row font-mono text-base text-cyan w-full" style="justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span>ALBUM // ${proj.title}</span>
                    <span>STATE // ${activePlayerState.isPlaying ? 'ACTIVE ENGINE' : 'STANDBY'}</span>
                </div>

                <!-- Large Dominant Center Cover Art -->
                <div style="width: clamp(200px, 50vw, 380px); height: clamp(200px, 50vw, 380px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 18px 36px rgba(0,0,0,0.24); position: relative; overflow: hidden;">
                    <img src="${proj.cover}" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(${activePlayerState.isPlaying ? '1.05' : '0.8'}); transition: all 0.3s;" id="dominant-cover-img" alt="Cover Art">
                    <div style="position: absolute; top: 12px; right: 12px; background: var(--bg-surface-glass); padding: 4px 10px; font-family: var(--font-mono); font-size: 0.7rem; font-weight: bold; color: var(--hud-optimal); border-radius: 4px; border: 1px solid var(--hud-optimal);">
                        LOSSLESS 48kHz
                    </div>
                </div>

                <!-- Track Telemetry Info -->
                <div class="text-center font-mono w-full">
                    <div class="font-bold text-main" style="font-size: clamp(1.1rem, 3vw, 1.8rem); letter-spacing: 2px; text-transform: uppercase;" id="player-track-name">
                        ${track.name}
                    </div>
                    <div class="text-muted" style="font-size: clamp(0.8rem, 2vw, 1rem); letter-spacing: 4px; margin-top: 6px;" id="player-track-artist">
                        ${proj.artist}
                    </div>
                </div>

                <!-- Interactive Scrubber Bar -->
                <div class="row w-full font-mono text-sm text-muted" style="gap: 16px;">
                    <span id="player-curr-time">00:00</span>
                    <div class="progress-bar cursor-pointer flex-1" style="height: 6px;" onclick="scrubPrivateTrack(event)">
                        <div class="progress-fill progress-fill-accent" style="width: ${activePlayerState.isPlaying ? '45%' : '0%'};" id="player-scrubber-fill"></div>
                    </div>
                    <span id="player-total-time">${track.duration}</span>
                </div>

                <!-- HUD Playback Controls -->
                <div class="row" style="gap: clamp(16px, 4vw, 32px); margin-top: 10px;">
                    <button onclick="prevPrivateTrack()" class="cursor-pointer" style="background: var(--bg-surface); border: 1px solid var(--text-muted); color: var(--text-main); width: clamp(40px, 10vw, 50px); height: clamp(40px, 10vw, 50px); border-radius: 50%; display: flex; justify-content: center; align-items: center; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
                    </button>

                    <button onclick="togglePrivatePlay()" class="cursor-pointer" style="background: rgba(200,167,106,0.92); border: none; color: #12110d; width: clamp(56px, 14vw, 72px); height: clamp(56px, 14vw, 72px); border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 10px 22px rgba(0,0,0,0.18); transition: all 0.2s;" id="private-play-btn">
                        <svg id="private-icon-play" style="display: ${activePlayerState.isPlaying ? 'none' : 'block'};" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <svg id="private-icon-pause" style="display: ${activePlayerState.isPlaying ? 'block' : 'none'};" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    </button>

                    <button onclick="nextPrivateTrack()" class="cursor-pointer" style="background: var(--bg-surface); border: 1px solid var(--text-muted); color: var(--text-main); width: clamp(40px, 10vw, 50px); height: clamp(40px, 10vw, 50px); border-radius: 50%; display: flex; justify-content: center; align-items: center; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    </button>
                </div>

                <!-- Volume HUD Slider -->
                <div class="row font-mono text-sm text-muted" style="gap: 12px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                    <input type="range" min="0" max="1" step="0.05" value="${activePlayerState.volume}" style="width: 120px; accent-color: var(--hud-cyan);" onchange="updatePrivateVolume(this.value)">
                </div>

            </div>

            <!-- Right: Organized Projects Suite & Upload Fortress -->
            <div class="stack" style="gap: 24px;">

                <!-- Projects / Albums Suite -->
                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="row flex-wrap font-mono text-main font-bold" style="justify-content: space-between; gap: 12px;">
                        <span>ORGANIZED PRODUCTIONS</span>
                        <span class="text-sm text-accent">${musicProjects.length} ALBUMS</span>
                    </div>

                    <!-- Album Selector Pills -->
                    <div class="row flex-wrap overflow-x-auto" style="gap: 10px; padding-bottom: 8px;">
                        ${musicProjects.map((p, i) => `
                            <button onclick="switchPrivateProject(${i})" class="tactical-btn ${i === activePlayerState.currentProjectIdx ? 'cyan active' : ''}" style="padding: 6px 14px; font-size: 0.75rem; white-space: nowrap; background: ${i === activePlayerState.currentProjectIdx ? 'var(--hud-cyan)' : 'var(--bg-surface)'}; color: ${i === activePlayerState.currentProjectIdx ? '#000' : 'var(--text-main)'};">
                                ${p.title}
                            </button>
                        `).join('')}
                    </div>

                    <!-- Tracklist inside active album -->
                    <div class="stack overflow-auto" style="gap: 8px; max-height: 280px;" id="private-tracklist-container">
                        ${proj.tracks.map((t, idx) => `
                            <div onclick="loadPrivateTrack(${idx})" class="cursor-pointer" style="padding: 12px 16px; background: ${idx === activePlayerState.currentTrackIdx ? 'rgba(224, 140, 43, 0.15)' : 'var(--bg-surface)'}; border-left: 3px solid ${idx === activePlayerState.currentTrackIdx ? 'var(--hud-violet)' : 'transparent'}; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); transition: all 0.2s;">
                                <div class="font-bold" style="font-size: 0.9rem; color: ${idx === activePlayerState.currentTrackIdx ? 'var(--hud-violet)' : 'var(--text-main)'};">
                                    ${t.name}
                                </div>
                                <div class="text-sm text-muted">
                                    ${t.duration}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Upload Fortress Suite -->
                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-optimal">
                        INJECT NEW PRODUCTION
                    </div>

                    <form onsubmit="handlePrivateUpload(event)" class="stack" style="gap: 16px;">
                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">TARGET PROJECT / ALBUM</label>
                            <select class="tactical-select w-full" id="upload-proj-id">
                                ${musicProjects.map((p, i) => `<option value="${i}">${p.title}</option>`).join('')}
                            </select>
                        </div>

                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">TRACK TITLE</label>
                            <input type="text" class="tactical-input w-full" id="upload-track-title" placeholder="e.g. 03 // Deep Void Orbit" required>
                        </div>

                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">AUDIO FILE OR STREAM URL</label>
                            <input type="text" class="tactical-input w-full" id="upload-track-url" placeholder="Paste direct .mp3 / .wav URL or leave empty for Procedural Synth" value="">
                        </div>

                        <button type="submit" class="tactical-btn w-full text-center" style="border-color: var(--hud-optimal);">
                            DEPOSIT INTO STORAGE
                        </button>
                    </form>
                </div>

            </div>

        </div>
    `;
}

function switchPrivateProject(projIdx) {
    activePlayerState.currentProjectIdx = projIdx;
    activePlayerState.currentTrackIdx = 0;
    if(activePlayerState.isPlaying) stopProceduralSynth();
    renderMusicView();
}

function loadPrivateTrack(trackIdx) {
    activePlayerState.currentTrackIdx = trackIdx;
    if(activePlayerState.isPlaying) {
        stopProceduralSynth();
        startProceduralSynth();
    }
    renderMusicView();
}

function togglePrivatePlay() {
    if(activePlayerState.isPlaying) {
        stopProceduralSynth();
    } else {
        startProceduralSynth();
    }
    renderMusicView();
}

function nextPrivateTrack() {
    let proj = musicProjects[activePlayerState.currentProjectIdx];
    activePlayerState.currentTrackIdx = (activePlayerState.currentTrackIdx + 1) % proj.tracks.length;
    if(activePlayerState.isPlaying) {
        stopProceduralSynth();
        startProceduralSynth();
    }
    renderMusicView();
}

function prevPrivateTrack() {
    let proj = musicProjects[activePlayerState.currentProjectIdx];
    activePlayerState.currentTrackIdx = (activePlayerState.currentTrackIdx - 1 + proj.tracks.length) % proj.tracks.length;
    if(activePlayerState.isPlaying) {
        stopProceduralSynth();
        startProceduralSynth();
    }
    renderMusicView();
}

function updatePrivateVolume(vol) {
    activePlayerState.volume = parseFloat(vol);
    if(activePlayerState.synthGain) {
        try { activePlayerState.synthGain.gain.setValueAtTime(activePlayerState.volume * 0.2, getMusicAudioContext().currentTime); } catch(e){}
    }
}

function scrubPrivateTrack(e) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    let fill = document.getElementById('player-scrubber-fill');
    if(fill) fill.style.width = `${pos * 100}%`;
}

/* Intelligent Web Audio Engine */
let musicAudioCtx = null;
function getMusicAudioContext() {
    if (!musicAudioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        musicAudioCtx = new AudioCtxClass();
    }
    if (musicAudioCtx.state === 'suspended') musicAudioCtx.resume();
    return musicAudioCtx;
}

function startProceduralSynth() {
    try {
        const ctx = getMusicAudioContext();
        stopProceduralSynth();

        let proj = musicProjects[activePlayerState.currentProjectIdx];
        let track = proj.tracks[activePlayerState.currentTrackIdx];
        let baseFreq = track.synthFreq || 130.81;

        activePlayerState.synthGain = ctx.createGain();
        activePlayerState.synthGain.gain.setValueAtTime(0.01, ctx.currentTime);
        activePlayerState.synthGain.gain.linearRampToValueAtTime(activePlayerState.volume * 0.25, ctx.currentTime + 1.5);

        // Low Pass Filter for relaxing cinematic space depth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);

        activePlayerState.synthGain.connect(filter);
        filter.connect(ctx.destination);

        // Space Triad Chord
        let chord = [baseFreq, baseFreq * 1.5, baseFreq * 1.875];
        activePlayerState.synthOscs = [];

        chord.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(f, ctx.currentTime);
            osc.connect(activePlayerState.synthGain);
            osc.start();
            activePlayerState.synthOscs.push(osc);
        });

        activePlayerState.isPlaying = true;
    } catch(e) {
        console.warn('Procedural Synth failed', e);
    }
}

function stopProceduralSynth() {
    if (activePlayerState.synthOscs.length > 0) {
        activePlayerState.synthOscs.forEach(o => { try{o.stop(); o.disconnect();}catch(e){} });
        activePlayerState.synthOscs = [];
    }
    if (activePlayerState.synthGain) {
        try{activePlayerState.synthGain.disconnect();}catch(e){}
        activePlayerState.synthGain = null;
    }
    activePlayerState.isPlaying = false;
}

function handlePrivateUpload(e) {
    e.preventDefault();
    let targetProjIdx = parseInt(document.getElementById('upload-proj-id').value);
    let title = document.getElementById('upload-track-title').value.trim();
    let url = document.getElementById('upload-track-url').value.trim();

    if(!title) return;

    let newTrack = {
        id: "t-" + Date.now(),
        name: title,
        duration: "03:50",
        audioUrl: url,
        isSynth: true,
        synthFreq: 110 + Math.floor(Math.random() * 100)
    };

    musicProjects[targetProjIdx].tracks.push(newTrack);
    localStorage.setItem('axis_music_projects', JSON.stringify(musicProjects));

    renderMusicView();
}

function renderThawraPlanView() {
    const dayChecks = [
        { key: 'dailyAnki', label: 'ANKI' },
        { key: 'dailyToneGym', label: 'TONEGYM' },
        { key: 'dailySession', label: 'SESSION' }
    ];

    const palettes = [
        {
            id: 'pigeon_dark',
            name: 'PIGEON DARK',
            meta: 'F# Dorian • Minor 7th/9th • 70–80 BPM • MOND/Muhab'
        },
        {
            id: 'opium_float',
            name: 'OPIUM FLOAT',
            meta: 'E Phrygian • Minor 7th • 65–75 BPM • Sofaygo / Lucki'
        },
        {
            id: 'parker_room',
            name: 'PARKER ROOM',
            meta: 'A Lydian • Maj7 / 9 • 80–90 BPM • Tame Impala'
        }
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

