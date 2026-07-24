// The Wanderer — procedural sound design
// Web Audio API, no asset files. Each zone has its own ambient texture.
// Click is a short soft thump, no speaker pop.
//
// Autoplay policy: AudioContext is created lazily on first user gesture.
// All sound nodes initialize at very low gain (0.001) to avoid the
// browser-specific init pop, then ramp up after a short delay.
//
// Mute state: localStorage 'wanderer_muted'. Default false.
// Icon is rendered by index.html CSS, controlled here.

let ctx = null;
let masterGain = null;
let currentZone = null;        // 'Room' | 'Road' | 'Field' | null
let currentNodes = [];         // active zone nodes (for teardown)
let currentLFOs = [];          // active LFO oscillators (need .start/.stop)
let currentCleanup = null;     // teardown function for current zone
let isMuted = false;
let isInitialized = false;

const STORAGE_KEY = 'wanderer_muted';

function readMute() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function writeMute(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch (_) {
    // ignore
  }
}

export function isSoundMuted() {
  return isMuted;
}

export function toggleMute() {
  isMuted = !isMuted;
  writeMute(isMuted);
  if (masterGain) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : 1, now + 0.2);
  }
  return isMuted;
}

// Lazy init on first user gesture. Idempotent.
export function ensureAudio() {
  if (isInitialized) return;
  isInitialized = true;

  isMuted = readMute();

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    // No Web Audio support — silently disable.
    return;
  }
  ctx = new AudioCtx();
  masterGain = ctx.createGain();
  masterGain.gain.value = isMuted ? 0 : 0.001;
  masterGain.connect(ctx.destination);

  // Ramp up after a short delay to avoid the browser init pop.
  // (Per StackOverflow: 100-150ms is the safe window across Chrome/Safari.)
  setTimeout(() => {
    if (!isMuted && ctx && ctx.state === 'running') {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(1, now + 0.4);
    }
  }, 200);

  // If the context was created outside a gesture, it may be suspended.
  // Try to resume (no-op if already running).
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// Resume context on visibility change (some browsers suspend when tab hidden).
document.addEventListener('visibilitychange', () => {
  if (ctx && ctx.state === 'suspended' && !document.hidden) {
    ctx.resume().catch(() => {});
  }
});

// ----- Helpers -----

// White noise buffer source, looped.
function makeNoiseSource() {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function makeZoneGain(initial = 0.001) {
  const g = ctx.createGain();
  g.gain.value = initial;
  return g;
}

function makeLFO(freq, depth, target) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = depth;
  osc.connect(gain);
  gain.connect(target);
  return osc;
}

function rampTo(param, value, duration = 0.6) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + duration);
}

function stopNodes(nodes, lfos) {
  for (const n of nodes) {
    try { n.disconnect(); } catch (_) {}
  }
  for (const l of lfos) {
    try { l.stop(); } catch (_) {}
  }
}

// ----- Zone ambient builders -----

// THE ROOM — quiet interior hum. Low-mid filtered noise, slow breath LFO.
// Like a room at 6pm. Almost subliminal.
function buildRoom() {
  const noise = makeNoiseSource();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  filter.Q.value = 0.7;

  // Slow breath LFO modulates filter frequency slightly.
  const lfo = makeLFO(0.12, 35, filter.frequency);

  // Subtle low oscillator — a faint room tone.
  const tone = ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.value = 60;
  const toneGain = makeZoneGain(0.001);
  tone.connect(toneGain);

  const zoneGain = makeZoneGain(0.001);
  noise.connect(filter);
  filter.connect(zoneGain);
  toneGain.connect(zoneGain);
  zoneGain.connect(masterGain);

  // Start
  noise.start();
  lfo.start();
  tone.start();
  rampTo(zoneGain.gain, 0.04, 1.2);

  return {
    nodes: [noise, filter, tone, toneGain, zoneGain],
    lfos: [lfo, tone],
    gain: zoneGain.gain
  };
}

// THE ROAD — distant wind, higher bandpass, slow gust LFO.
function buildRoad() {
  const noise = makeNoiseSource();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.5;

  // Two slightly detuned LFOs for wind movement (gust pattern).
  const lfo1 = makeLFO(0.18, 200, filter.frequency);
  const lfo2 = makeLFO(0.07, 80, filter.frequency);

  // A very low distant drone — far horizon tone.
  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 48;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 120;
  const droneGain = makeZoneGain(0.001);
  drone.connect(droneFilter);
  droneFilter.connect(droneGain);

  const zoneGain = makeZoneGain(0.001);
  noise.connect(filter);
  filter.connect(zoneGain);
  droneGain.connect(zoneGain);
  zoneGain.connect(masterGain);

  noise.start();
  lfo1.start();
  lfo2.start();
  drone.start();
  rampTo(zoneGain.gain, 0.06, 1.2);

  return {
    nodes: [noise, filter, drone, droneFilter, droneGain, zoneGain],
    lfos: [lfo1, lfo2],
    gain: zoneGain.gain
  };
}

// THE FIELD — wider wind, lower bandpass, two detuned gusts.
function buildField() {
  const noise = makeNoiseSource();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 350;
  filter.Q.value = 0.9;

  // Two LFOs at slightly different rates for compound gust pattern.
  const lfo1 = makeLFO(0.13, 150, filter.frequency);
  const lfo2 = makeLFO(0.21, 90, filter.frequency);

  // Soft high-frequency sheen, very quiet — like grass hissing.
  const sheen = makeNoiseSource();
  const sheenFilter = ctx.createBiquadFilter();
  sheenFilter.type = 'highpass';
  sheenFilter.frequency.value = 2000;
  const sheenGain = makeZoneGain(0.001);
  sheen.connect(sheenFilter);
  sheenFilter.connect(sheenGain);

  const zoneGain = makeZoneGain(0.001);
  noise.connect(filter);
  filter.connect(zoneGain);
  sheenGain.connect(zoneGain);
  zoneGain.connect(masterGain);

  noise.start();
  sheen.start();
  lfo1.start();
  lfo2.start();
  rampTo(zoneGain.gain, 0.07, 1.2);
  rampTo(sheenGain.gain, 0.012, 1.5);

  return {
    nodes: [noise, filter, sheen, sheenFilter, sheenGain, zoneGain],
    lfos: [lfo1, lfo2],
    gain: zoneGain.gain
  };
}

const ZONE_BUILDERS = {
  Room: buildRoom,
  Road: buildRoad,
  Field: buildField
};

export function setZone(zone) {
  if (!isInitialized) ensureAudio();
  if (!ctx) return;
  if (zone === currentZone) return;

  // Tear down previous zone (fade out, then stop).
  if (currentZone && currentCleanup) {
    try {
      rampTo(currentCleanup.gain, 0.001, 0.5);
    } catch (_) {}
    const oldNodes = currentNodes;
    const oldLFOs = currentLFOs;
    setTimeout(() => stopNodes(oldNodes, oldLFOs), 600);
  }

  currentZone = zone;
  if (!zone) {
    currentNodes = [];
    currentLFOs = [];
    currentCleanup = null;
    return;
  }

  const builder = ZONE_BUILDERS[zone];
  if (!builder) return;
  const built = builder();
  currentNodes = built.nodes;
  currentLFOs = built.lfos;
  currentCleanup = built;
}

// ----- Click sound -----
// Soft, short thump. Low frequency, fast attack and exponential decay.
// Different character per zone but same envelope. Volume 0.18.
export function playClick() {
  if (!isInitialized) ensureAudio();
  if (!ctx || isMuted) return;

  const now = ctx.currentTime;

  // Use a short noise burst shaped by a fast lowpass envelope.
  const burstSize = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, burstSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < burstSize; i++) {
    // Brown-ish noise (lower than white) for warmth.
    data[i] = (Math.random() * 2 - 1) * 0.5;
    if (i > 0) data[i] = (data[i] + data[i - 1]) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 0.8;

  const env = ctx.createGain();
  // Soft attack (5ms) to avoid pop, then exponential decay.
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.18, now + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  // Subtle low sine for body (slightly different per zone).
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = currentZone === 'Field' ? 90
                       : currentZone === 'Road' ? 110
                       : 75;  // Room
  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(0.0001, now);
  bodyEnv.gain.linearRampToValueAtTime(0.12, now + 0.005);
  bodyEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  src.connect(filter);
  filter.connect(env);
  env.connect(masterGain);
  body.connect(bodyEnv);
  bodyEnv.connect(masterGain);

  src.start(now);
  src.stop(now + 0.2);
  body.start(now);
  body.stop(now + 0.25);
}
