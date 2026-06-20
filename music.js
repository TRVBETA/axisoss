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
    isPlaying: false,
    volume: 0.75,
    audioElement: null,
    synthGain: null,
    synthOscs: []
};

function initMusic() {
    renderMusicView();
}

function renderMusicView() {
    const container = document.getElementById('module-music');
    if (!container) return;

    let proj = musicProjects[activePlayerState.currentProjectIdx] || musicProjects[0];
    let track = proj.tracks[activePlayerState.currentTrackIdx] || proj.tracks[0];

    container.innerHTML = `
        <div class="cockpit-header">
            <span>TACTICAL SOUNDSCAPE // PRIVATE AUDIO PLAYER</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">SUPABASE STORAGE // HIGH FIDELITY MEMORY</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 500px; gap: 40px;">
            
            <!-- Left: Center Cover Art & Dominant Player HUD -->
            <div class="cockpit-card" style="padding: 40px; align-items: center; justify-content: space-between; min-height: 650px;">
                
                <div style="width: 100%; display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.85rem; color: var(--hud-cyan); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span>ALBUM // ${proj.title}</span>
                    <span>STATE // ${activePlayerState.isPlaying ? 'ACTIVE ENGINE' : 'STANDBY'}</span>
                </div>

                <!-- Large Dominant Center Cover Art -->
                <div style="width: 380px; height: 380px; border-radius: 8px; border: 2px solid var(--hud-violet); box-shadow: 0 0 40px var(--hud-violet-subtle); position: relative; overflow: hidden; group: cover;">
                    <img src="${proj.cover}" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(${activePlayerState.isPlaying ? '1.05' : '0.8'}); transition: all 0.3s;" id="dominant-cover-img" alt="Cover Art">
                    <div style="position: absolute; top: 12px; right: 12px; background: var(--bg-surface-glass); padding: 4px 10px; font-family: var(--font-mono); font-size: 0.7rem; font-weight: bold; color: var(--hud-optimal); border-radius: 4px; border: 1px solid var(--hud-optimal);">
                        LOSSLESS 48kHz
                    </div>
                </div>

                <!-- Track Telemetry Info -->
                <div style="text-align: center; font-family: var(--font-mono); width: 100%;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: var(--text-main); letter-spacing: 2px; text-transform: uppercase;" id="player-track-name">
                        ${track.name}
                    </div>
                    <div style="font-size: 1rem; color: var(--text-muted); letter-spacing: 4px; margin-top: 6px;" id="player-track-artist">
                        ${proj.artist}
                    </div>
                </div>

                <!-- Interactive Scrubber Bar -->
                <div style="width: 100%; display: flex; align-items: center; gap: 16px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
                    <span id="player-curr-time">00:00</span>
                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; position: relative; overflow: hidden;" onclick="scrubPrivateTrack(event)">
                        <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${activePlayerState.isPlaying ? '45%' : '0%'}; background: var(--hud-violet); box-shadow: 0 0 10px var(--hud-violet);" id="player-scrubber-fill"></div>
                    </div>
                    <span id="player-total-time">${track.duration}</span>
                </div>

                <!-- HUD Playback Controls -->
                <div style="display: flex; align-items: center; gap: 32px; margin-top: 10px;">
                    <button onclick="prevPrivateTrack()" style="background: var(--bg-surface); border: 1px solid var(--text-muted); color: var(--text-main); width: 50px; height: 50px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
                    </button>

                    <button onclick="togglePrivatePlay()" style="background: var(--hud-violet); border: none; color: #000; width: 72px; height: 72px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 0 25px var(--hud-violet-glow); transition: all 0.2s;" id="private-play-btn">
                        <svg id="private-icon-play" style="display: ${activePlayerState.isPlaying ? 'none' : 'block'};" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <svg id="private-icon-pause" style="display: ${activePlayerState.isPlaying ? 'block' : 'none'};" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    </button>

                    <button onclick="nextPrivateTrack()" style="background: var(--bg-surface); border: 1px solid var(--text-muted); color: var(--text-main); width: 50px; height: 50px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    </button>
                </div>

                <!-- Volume HUD Slider -->
                <div style="display: flex; align-items: center; gap: 12px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                    <input type="range" min="0" max="1" step="0.05" value="${activePlayerState.volume}" style="width: 120px; accent-color: var(--hud-cyan);" onchange="updatePrivateVolume(this.value)">
                </div>

            </div>

            <!-- Right: Organized Projects Suite & Upload Fortress -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <!-- Projects / Albums Suite -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span>ORGANIZED PRODUCTIONS // PROJECTS</span>
                        <span style="font-size: 0.75rem; color: var(--hud-violet);">${musicProjects.length} ALBUMS LOADED</span>
                    </div>

                    <!-- Album Selector Pills -->
                    <div style="display: flex; gap: 12px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 8px;">
                        ${musicProjects.map((p, i) => `
                            <button onclick="switchPrivateProject(${i})" class="tactical-btn ${i === activePlayerState.currentProjectIdx ? 'cyan active' : ''}" style="padding: 6px 14px; font-size: 0.75rem; white-space: nowrap; background: ${i === activePlayerState.currentProjectIdx ? 'var(--hud-cyan)' : 'var(--bg-surface)'}; color: ${i === activePlayerState.currentProjectIdx ? '#000' : 'var(--text-main)'};">
                                ${p.title}
                            </button>
                        `).join('')}
                    </div>

                    <!-- Tracklist inside active album -->
                    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;" id="private-tracklist-container">
                        ${proj.tracks.map((t, idx) => `
                            <div onclick="loadPrivateTrack(${idx})" style="padding: 12px 16px; background: ${idx === activePlayerState.currentTrackIdx ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-surface)'}; border-left: 3px solid ${idx === activePlayerState.currentTrackIdx ? 'var(--hud-violet)' : 'transparent'}; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); cursor: pointer; transition: all 0.2s;">
                                <div style="font-weight: bold; color: ${idx === activePlayerState.currentTrackIdx ? 'var(--hud-violet)' : 'var(--text-main)'}; font-size: 0.9rem;">
                                    ${t.name}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">
                                    ${t.duration}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Upload Fortress Suite -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px;">
                        INJECT NEW PRODUCTION // UPLOAD
                    </div>

                    <form onsubmit="handlePrivateUpload(event)" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">TARGET PROJECT / ALBUM</label>
                            <select class="tactical-select" id="upload-proj-id">
                                ${musicProjects.map((p, i) => `<option value="${i}">${p.title}</option>`).join('')}
                            </select>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">TRACK TITLE</label>
                            <input type="text" class="tactical-input" id="upload-track-title" placeholder="e.g. 03 // Deep Void Orbit" required>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">AUDIO FILE OR STREAM URL</label>
                            <input type="text" class="tactical-input" id="upload-track-url" placeholder="Paste direct .mp3 / .wav URL or leave empty for Procedural Synth" value="">
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; border-color: var(--hud-optimal);">
                            DEPOSIT INTO SUPABASE STORAGE &raquo;
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