// The Wanderer — slice 2
// PIN login -> 5 alchemical symbols on canvas -> tap a symbol -> zone label fades in -> world renders.
//
// State -> zone mapping (locked from SPEC.md):
//   0x2638 (static)    -> Field
//   0x263B (restless)  -> Room
//   0x2639 (grey)      -> Road
//   0x263C (hollow)    -> Room
//   25EF  (clear)      -> random between all three

import { drawRoad, drawRoom, drawField } from './zones.js';
import { ensureAudio, setZone, playClick, toggleMute, isSoundMuted } from './sound.js';
import { getObjectRects } from './objects.js';

// ----- DOM refs -----
const pinScreen   = document.getElementById('pin-screen');
const worldScreen = document.getElementById('world-screen');
const pinForm     = document.getElementById('pin-form');
const pinInput    = document.getElementById('pin-input');
const pinError    = document.getElementById('pin-error');
const canvas      = document.getElementById('world');
const ctx         = canvas.getContext('2d');
const muteButton  = document.getElementById('mute-toggle');

ctx.imageSmoothingEnabled = false;

// ----- State -----
const W = 640;
const H = 360;

const STATES = [
  { id: 'static',    glyph: '🜁', zone: 'Field' },
  { id: 'restless',  glyph: '🜂', zone: 'Room'  },
  { id: 'grey',      glyph: '🜃', zone: 'Road'  },
  { id: 'hollow',    glyph: '🜄', zone: 'Room'  },
  { id: 'clear',     glyph: '◯', zone: null    }
];

const ZONES = ['Field', 'Room', 'Road'];

const PAL = {
  void:      '#0a0a0c',
  voidSoft:  '#14141a',
  amber:     '#c89c64',
  amberDim:  '#8a6a3f',
  rose:      '#c98a82',
  teal:      '#4a706e',
  off:       '#ebe3d3',
  offDim:    '#5e564a'
};

// ----- PIN login (reuses AXIS /api/auth) -----
// Form-submit is the primary path — fires on Enter, on tap of the visible
// "Enter →" button, and on iOS Safari's "Go" keypress reliably across all
// WebViews. We keep the keydown listener as a defensive fallback for browsers
// that don't fire submit on Enter for some reason.
pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitPin();
});

pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitPin();
  }
});

// In iOS PWA / standalone mode, the keyboard's "Go" button sometimes fires
// `keypress` instead of `keydown`. Defensive fallback.
pinInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitPin();
  }
});

async function submitPin() {
  const pin = pinInput.value.trim();
  if (!pin) {
    pinError.textContent = 'PIN REQUIRED';
    return;
  }
  pinError.textContent = '';
  pinInput.disabled = true;

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', pin })
    });
    if (res.ok) {
      enterWorld();
    } else {
      const data = await res.json().catch(() => ({}));
      pinError.textContent = (data && data.error) ? data.error.toUpperCase() : 'ACCESS DENIED';
      pinInput.disabled = false;
      pinInput.value = '';
      pinInput.focus();
    }
  } catch (err) {
    pinError.textContent = 'NETWORK ERROR';
    pinInput.disabled = false;
    pinInput.focus();
  }
}

// ----- World entry -----
function enterWorld() {
  pinScreen.classList.remove('visible');
  worldScreen.classList.add('visible');
  // Audio context starts on user gesture — PIN submit is a gesture.
  ensureAudio();
  fitCanvas();
  startLoop();
  // Reflect mute state on button.
  if (isSoundMuted()) {
    muteButton.classList.add('muted');
  } else {
    muteButton.classList.remove('muted');
  }
}

// Mute button
muteButton.addEventListener('click', (e) => {
  e.stopPropagation();
  ensureAudio();
  const nowMuted = toggleMute();
  if (nowMuted) {
    muteButton.classList.add('muted');
  } else {
    muteButton.classList.remove('muted');
  }
});

// ----- Canvas sizing -----
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', fitCanvas);

// ----- World state -----
const world = {
  phase: 'picking',        // 'picking' | 'reveal' | 'world' | 'exiting'
  hoveredGlyph: -1,
  selected: null,
  revealedZone: null,
  revealStart: 0,
  revealDuration: 2000,
  worldT0: 0,              // when current zone started rendering
  // AI line
  line: null,
  lineFallback: false,
  lineStart: 0,
  lineDuration: 20000,
  lineRequested: null,
  // Memory
  memory: null,            // fetched on world entry
  visitRecorded: false,    // has the current visit been POSTed
  visitRecordDue: 0,       // when to POST (after line fades)
  // Visit payload (for recording)
  visitPayload: null,
  // Interactions
  activeInteractions: {},  // { response_key: startTime } — drives animation states
  // Lamp toggle state (persists across frames)
  lampOn: true,
  // Silent exit
  exitStart: 0,
  exitDuration: 2200,      // 2.2s for figure to walk off
  exitDirection: 1         // 1 = right, -1 = left
};

// ----- Main loop -----
let rafId = null;
function startLoop() {
  cancelAnimationFrame(rafId);
  const tick = (t) => {
    maybeRecordVisit();
    draw(t);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

// ----- Drawing -----
function draw(t) {
  // Background.
  ctx.fillStyle = PAL.void;
  ctx.fillRect(0, 0, W, H);

  if (world.phase === 'picking') {
    drawGlyphs(t);
  } else if (world.phase === 'reveal' && world.revealedZone) {
    drawZoneLabel(t);
  } else if (world.phase === 'world' && world.revealedZone) {
    drawZoneWorld(t);
  } else if (world.phase === 'exiting' && world.revealedZone) {
    drawExit(t);
  }
}

function drawGlyphs(t) {
  const cx = W / 2;
  const cy = H / 2;
  const spacing = 90;
  const totalWidth = (STATES.length - 1) * spacing;
  const startX = cx - totalWidth / 2;

  ctx.font = '38px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < STATES.length; i++) {
    const x = startX + i * spacing;
    const isHover = (i === world.hoveredGlyph);
    // Each glyph drifts on its own phase so the row feels alive, not static.
    const drift = Math.sin(t * 0.0007 + i * 0.9) * 1.5;
    const y = cy + drift + (isHover ? -2 : 0);

    if (isHover) {
      ctx.shadowColor = PAL.amber;
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = isHover ? PAL.amber : PAL.offDim;
    ctx.fillText(STATES[i].glyph, x, y);
  }

  ctx.shadowBlur = 0;

  // Hint, slow fade.
  const hintAlpha = 0.35 + 0.15 * Math.sin(t * 0.001);
  ctx.fillStyle = withAlpha(PAL.offDim, hintAlpha);
  ctx.font = '10px ui-monospace, "SF Mono", monospace';
  ctx.fillText('TAP A MARK', cx, cy + 60);
}

function drawZoneLabel(t) {
  const elapsed = t - world.revealStart;
  const phase = elapsed / world.revealDuration;
  if (phase >= 1) {
    // Done revealing — switch to world.
    world.phase = 'world';
    world.worldT0 = t;
    return;
  }

  let alpha;
  if (phase < 0.4) {
    alpha = phase / 0.4;
  } else if (phase > 0.6) {
    alpha = 1 - (phase - 0.6) / 0.4;
  } else {
    alpha = 1;
  }

  const cx = W / 2;
  const cy = H / 2;

  ctx.fillStyle = withAlpha(PAL.off, alpha);
  ctx.font = '14px ui-monospace, "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.revealedZone.toUpperCase(), cx, cy + 50);

  ctx.font = '32px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols2", sans-serif';
  ctx.fillStyle = withAlpha(PAL.amber, alpha);
  ctx.fillText(world.selected.glyph, cx, cy - 8);
}

function drawZoneWorld(t) {
  const localT = t - world.worldT0;
  const mem = world.memory || null;
  // Filter out expired interactions (>3s old).
  const inter = {};
  for (const [k, t0] of Object.entries(world.activeInteractions)) {
    if (localT - t0 < 3000) inter[k] = t0;
  }
  world.activeInteractions = inter;
  // Pass persistent state in a small object — keeps zone signatures stable.
  const zoneState = { lampOn: world.lampOn };
  if (world.revealedZone === 'Road') {
    drawRoad(ctx, localT, mem, inter, zoneState);
  } else if (world.revealedZone === 'Room') {
    drawRoom(ctx, localT, mem, inter, zoneState);
  } else if (world.revealedZone === 'Field') {
    drawField(ctx, localT, mem, inter, zoneState);
  }

  // AI line — fades in (1s), holds (18s), fades out (1s) — total 20s.
  if (world.line) {
    drawLine(localT);
  }

  // Tiny "tap to leave" hint, very faint, lower-right.
  const hintAlpha = 0.25 + 0.15 * Math.sin(localT * 0.0008);
  ctx.fillStyle = withAlpha(PAL.offDim, hintAlpha);
  ctx.font = '9px ui-monospace, "SF Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('TAP TO LEAVE', W - 12, H - 8);
}

function drawLine(localT) {
  const t = (performance.now() - world.lineStart) / 1000; // seconds since line arrived
  const FADE_IN  = 1.0;
  const HOLD_END = 19.0;
  const FADE_OUT = 20.0;

  let alpha;
  if (t < FADE_IN) {
    alpha = t / FADE_IN;
  } else if (t < HOLD_END) {
    alpha = 1;
  } else if (t < FADE_OUT) {
    alpha = 1 - (t - HOLD_END) / (FADE_OUT - HOLD_END);
  } else {
    world.line = null;
    return;
  }

  if (alpha <= 0) return;

  // The line is environmental text in the world — mid-low, soft, never centered.
  // Two-line wrap if it's long, with even word distribution.
  const words = world.line.split(/\s+/);
  const lines = wrapToTwoLines(words, 36);
  const cx = W / 2;
  // Place it in the lower third of the canvas, just above the bottom edge.
  // Offset by +30 from center to feel like "in the world" not "in a dialog."
  const baseY = H * 0.78;

  ctx.save();
  ctx.font = '13px ui-monospace, "SF Mono", "Cascadia Code", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Soft glow behind the text.
  ctx.shadowColor = 'rgba(200, 156, 100, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = `rgba(235, 227, 211, ${alpha * 0.92})`;
  for (let i = 0; i < lines.length; i++) {
    const ly = baseY + (i - (lines.length - 1) / 2) * 18;
    ctx.fillText(lines[i], cx, ly);
  }
  // A subtle horizontal rule above and below, like a margin mark.
  ctx.shadowBlur = 0;
  const ruleAlpha = alpha * 0.25;
  ctx.fillStyle = `rgba(94, 86, 74, ${ruleAlpha})`;
  ctx.fillRect(cx - 60, baseY - (lines.length * 18) / 2 - 14, 120, 1);
  ctx.fillRect(cx - 60, baseY + (lines.length * 18) / 2 + 14, 120, 1);
  ctx.restore();
}

function wrapToTwoLines(words, maxPerLine) {
  if (words.length <= maxPerLine) return [words.join(' ')];
  // Try to break at the closest space to the middle.
  const mid = Math.floor(words.length / 2);
  let bestBreak = mid;
  let bestDelta = Infinity;
  for (let i = Math.max(1, mid - 6); i <= Math.min(words.length - 1, mid + 6); i++) {
    const delta = Math.abs(i - mid);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestBreak = i;
    }
  }
  return [
    words.slice(0, bestBreak).join(' '),
    words.slice(bestBreak).join(' ')
  ];
}

// ----- Picking -----
function pickFromCoords(x, y) {
  const rect = canvas.getBoundingClientRect();
  const cssX = (x - rect.left) * (W / rect.width);
  const cssY = (y - rect.top)  * (H / rect.height);

  const cx = W / 2;
  const cy = H / 2;
  const spacing = 90;
  const totalWidth = (STATES.length - 1) * spacing;
  const startX = cx - totalWidth / 2;

  const hitR = 42;
  for (let i = 0; i < STATES.length; i++) {
    const gx = startX + i * spacing;
    const gy = cy;
    const dx = cssX - gx;
    const dy = cssY - gy;
    if (dx * dx + dy * dy <= hitR * hitR) {
      return i;
    }
  }
  return -1;
}

function hoverFromCoords(x, y) {
  const i = pickFromCoords(x, y);
  world.hoveredGlyph = i;
}

canvas.addEventListener('pointermove', (e) => {
  if (world.phase !== 'picking') return;
  hoverFromCoords(e.clientX, e.clientY);
});

canvas.addEventListener('pointerdown', (e) => {
  if (world.phase === 'picking') {
    const i = pickFromCoords(e.clientX, e.clientY);
    if (i >= 0) {
      selectState(i);
    }
    return;
  }
  if (world.phase === 'reveal') {
    // Skip the label animation — go straight to world.
    world.phase = 'world';
    world.worldT0 = performance.now();
    playClick();
    return;
  }
  if (world.phase === 'world') {
    // First check for object hits.
    const hit = hitTestObject(e.clientX, e.clientY);
    if (hit) {
      triggerObject(hit);
      return;
    }
    // Tap on empty area = silent exit. Figure walks off, world fades.
    // Direction: right by default. Long-press held on the entry symbol flips to left.
    // For now, alternate per visit, or pick based on which side has more sky.
    world.exitDirection = (world.revealedZone === 'Field') ? -1 : 1;
    world.exitStart = performance.now();
    world.phase = 'exiting';
    // Soft exit whoosh (lower volume click).
    playClick();
    setZone(null);
  }
});

function hitTestObject(clientX, clientY) {
  if (!world.revealedZone) return null;
  const rect = canvas.getBoundingClientRect();
  const cssX = (clientX - rect.left) * (W / rect.width);
  const cssY = (clientY - rect.top)  * (H / rect.height);
  const rects = getObjectRects(world.revealedZone);
  for (const r of rects) {
    if (cssX >= r.x && cssX <= r.x + r.w && cssY >= r.y && cssY <= r.y + r.h) {
      return r;
    }
  }
  return null;
}

function triggerObject(obj) {
  const localT = performance.now() - world.worldT0;
  world.activeInteractions[obj.response] = localT;
  // Lamp is special — it toggles persistent state, not an animation.
  if (obj.response === 'lamp_toggle') {
    world.lampOn = !world.lampOn;
  }
  playClick();
  // Record the touch (best-effort).
  try {
    fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'touch', zone: world.revealedZone, object_key: obj.key })
    }).catch(() => {});
  } catch (_) {
    // ignore
  }
}

canvas.addEventListener('touchstart', (e) => {
  if (world.phase !== 'picking') return;
  if (e.touches.length > 0) {
    const t = e.touches[0];
    hoverFromCoords(t.clientX, t.clientY);
  }
}, { passive: true });

function selectState(i) {
  const s = STATES[i];
  let zone = s.zone;
  if (zone === null) {
    zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  }
  world.selected = s;
  world.revealedZone = zone;
  world.revealStart = performance.now();
  world.phase = 'reveal';
  // Click + switch ambient to the new zone.
  playClick();
  setZone(zone);
  // Fetch the AI line in the background. It will fade in when the world renders.
  fetchLine(s.id, zone);
  // Refetch memory in case it changed since last entry.
  fetchMemory();
  // Visit recording happens ~22s after world renders, after the line has faded.
  world.visitRecorded = false;
  world.visitRecordDue = performance.now() + 22000;
  world.visitPayload = { state: s.id, zone };
  // Clear any prior interactions.
  world.activeInteractions = {};
}

async function fetchLine(state, zone) {
  // Avoid duplicate fetches if user re-picks the same state quickly.
  world.lineRequested = { state, zone, t: performance.now() };
  try {
    const res = await fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'line', state })
    });
    if (!res.ok) {
      world.line = null;
      return;
    }
    const data = await res.json();
    if (data && data.ok && data.line) {
      // Only apply if this is still the most recent request.
      if (world.lineRequested && world.lineRequested.state === state && world.lineRequested.zone === zone) {
        world.line = data.line;
        world.lineFallback = !!data.fallback;
        world.lineStart = performance.now();
        world.lineDuration = 20000; // 20s total: 1s in, 18s hold, 1s out
      }
    } else {
      world.line = null;
    }
  } catch (_) {
    world.line = null;
  }
}

// Visit recording — fires ~22s after world render, after the line has faded.
// Response includes the memory snapshot, so we no longer need a separate GET.
async function recordVisit() {
  if (world.visitRecorded) return;
  if (!world.visitPayload) return;
  world.visitRecorded = true;
  try {
    const res = await fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'visit',
        state: world.visitPayload.state,
        zone:  world.visitPayload.zone,
        line:  world.line || null,
        was_fallback: !!world.lineFallback
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.ok && data.memory) {
        world.memory = data.memory;
      }
    }
  } catch (_) {
    // Best-effort. Don't surface failures.
  }
}

async function fetchMemory() {
  try {
    const res = await fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read' })
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.ok && data.memory) {
      world.memory = data.memory;
    }
  } catch (_) {
    // Best-effort. Default to null (no modifier).
  }
}

// Visit-record timer — checked each frame in the main draw loop.
function maybeRecordVisit() {
  if (world.visitRecorded) return;
  if (!world.visitPayload) return;
  if (world.phase !== 'world') return;
  if (performance.now() >= world.visitRecordDue) {
    recordVisit();
  }
}

// Silent exit — figure walks off-screen, world fades to black.
// The original zone still draws behind a dark overlay that grows over time.
function drawExit(t) {
  const elapsed = t - world.exitStart;
  const phase = Math.min(elapsed / world.exitDuration, 1);
  // Stop ambient at the moment exit began (setZone(null) was called).
  // Draw the last frame of the world, then overlay a fade.
  // Use the last-known worldT0 so ambient animations stay in sync.
  const mem = world.memory || null;
  const inter = world.activeInteractions;
  const zoneState = { lampOn: world.lampOn };
  if (world.revealedZone === 'Road') {
    drawRoad(ctx, elapsed, mem, inter, zoneState);
  } else if (world.revealedZone === 'Room') {
    drawRoom(ctx, elapsed, mem, inter, zoneState);
  } else if (world.revealedZone === 'Field') {
    drawField(ctx, elapsed, mem, inter, zoneState);
  }

  // Figure walks off in the chosen direction.
  // Base figure position by zone.
  const baseFigX = W / 2;
  const baseFigY = world.revealedZone === 'Field' ? H - 70
                 : world.revealedZone === 'Road'  ? H - 70
                 : H - 90;
  // Walk off-screen: x moves by ~W * 0.7 over the exit duration.
  const walkDx = world.exitDirection * W * 0.7 * phase;
  const walkDy = world.revealedZone === 'Field' ? 0 : -2 * Math.sin(phase * Math.PI); // gentle bob
  const breath = (Math.sin(t * 0.005) + 1) * 0.5;
  drawFigure(ctx, baseFigX + walkDx, baseFigY + walkDy, 'walking', breath);

  // Fade overlay: starts at 0.4 phase, ends at 1.0.
  let fadeAlpha = 0;
  if (phase > 0.4) {
    fadeAlpha = (phase - 0.4) / 0.6;
  }
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(10, 10, 12, ${Math.min(fadeAlpha, 1)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // When done, return to picker.
  if (phase >= 1) {
    world.phase = 'picking';
    world.selected = null;
    world.revealedZone = null;
    world.line = null;
    world.lineRequested = null;
    world.activeInteractions = {};
    world.visitPayload = null;
  }
}

// ----- Color helpers -----
function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ----- Boot -----
async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated) {
        enterWorld();
        return;
      }
    }
  } catch (_) {
    // Fall through to PIN screen.
  }
  pinInput.focus();
}
checkExistingSession();
