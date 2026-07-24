// The Wanderer — clean interactive web app, native resolution.
// Canvas fills viewport, draws at native pixels. HTML overlay for UI/text.

import { drawRoad, drawRoom, drawField } from './zones.js';
import { ensureAudio, setZone, playClick, toggleMute, isSoundMuted } from './sound.js';
import { getObjectRects } from './objects.js';

// ----- DOM refs -----
const canvas      = document.getElementById('world');
const ctx         = canvas.getContext('2d', { alpha: false });
const muteButton  = document.getElementById('mute-toggle');
const pickerRow   = document.getElementById('picker-row');
const pickerHint  = document.getElementById('picker-hint');
const zoneLabel   = document.getElementById('zone-label');
const lineEl      = document.getElementById('line');
const leaveHint   = document.getElementById('leave-hint');

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// ----- Constants -----
const STATES = [
  { id: 'static',    glyph: '🜁', zone: 'Field' },
  { id: 'restless',  glyph: '🜂', zone: 'Room'  },
  { id: 'grey',      glyph: '🜃', zone: 'Road'  },
  { id: 'hollow',    glyph: '🜄', zone: 'Room'  },
  { id: 'clear',     glyph: '◯', zone: null    }
];

const ZONES = ['Field', 'Room', 'Road'];

// Aspect ratio for the world (16:9). The canvas resizes to fit the viewport
// while maintaining this aspect ratio. Letterboxed with the void color.
const ASPECT_W = 16;
const ASPECT_H = 9;

// ----- Canvas sizing — fit viewport, maintain 16:9 -----
function fitCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewportAspect = vw / vh;
  const targetAspect = ASPECT_W / ASPECT_H;
  let cssW, cssH;
  if (viewportAspect > targetAspect) {
    // Viewport is wider than 16:9 — letterbox sides.
    cssH = vh;
    cssW = vh * targetAspect;
  } else {
    // Viewport is taller than 16:9 — letterbox top/bottom.
    cssW = vw;
    cssH = vw / targetAspect;
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Logical (CSS-pixel) dimensions for drawing.
  world.W = cssW;
  world.H = cssH;
}
window.addEventListener('resize', fitCanvas);

// ----- World state -----
const world = {
  W: 0,
  H: 0,
  phase: 'picking',         // 'picking' | 'reveal' | 'world' | 'exiting'
  selected: null,
  revealedZone: null,
  revealStart: 0,
  revealDuration: 1800,
  worldT0: 0,
  // AI line
  line: null,
  lineFallback: false,
  lineStart: 0,
  lineRequested: null,
  // Memory
  memory: null,
  // Interactions
  activeInteractions: {},
  // Lamp toggle
  lampOn: true,
  // Silent exit
  exitStart: 0,
  exitDuration: 2200,
  exitDirection: 1
};

// ----- Mute button -----
muteButton.addEventListener('click', (e) => {
  e.stopPropagation();
  ensureAudio();
  const nowMuted = toggleMute();
  if (nowMuted) muteButton.classList.add('muted');
  else muteButton.classList.remove('muted');
});

// ----- Picker (HTML buttons) -----
const glyphButtons = pickerRow.querySelectorAll('.glyph');
for (const btn of glyphButtons) {
  const stateId = btn.dataset.state;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    ensureAudio();
    selectState(stateId, btn);
  });
}

// ----- Pointer on canvas: hit-test objects in world phase -----
// Listen to multiple event types for max compatibility:
//   - pointerdown: standard modern, fires for mouse + touch + pen
//   - mousedown: fallback for browsers/engines that skip pointer events
//   - touchstart: fallback for older mobile WebViews
function onCanvasDown(e) {
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0]?.clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0]?.clientY);
  if (clientX === undefined || clientY === undefined) return;
  if (world.phase === 'world') {
    const hit = hitTestObject(clientX, clientY);
    if (hit) {
      triggerObject(hit);
      return;
    }
    // Empty area = silent exit
    world.exitDirection = (world.revealedZone === 'Field') ? -1 : 1;
    world.exitStart = performance.now();
    world.phase = 'exiting';
    playClick();
    setZone(null);
    return;
  }
  if (world.phase === 'reveal') {
    // Skip reveal, go straight to world
    world.phase = 'world';
    world.worldT0 = performance.now();
    playClick();
  }
  if (world.phase === 'exiting') {
    // Tap during exit: complete the exit immediately
    world.phase = 'picking';
    world.selected = null;
    world.revealedZone = null;
    world.activeInteractions = {};
    showPicker();
    leaveHint.classList.remove('visible');
    lineEl.classList.remove('visible');
  }
}
canvas.addEventListener('pointerdown', onCanvasDown);
canvas.addEventListener('mousedown', onCanvasDown);
canvas.addEventListener('touchstart', (e) => {
  // Prevent default to avoid double-firing.
  if (e.touches && e.touches[0]) {
    onCanvasDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    e.preventDefault();
  }
}, { passive: false });

function hitTestObject(clientX, clientY) {
  if (!world.revealedZone) return null;
  const rect = canvas.getBoundingClientRect();
  // Canvas occupies the centered letterbox area. Convert client → canvas local.
  const cx = (clientX - rect.left) * (world.W / rect.width);
  const cy = (clientY - rect.top)  * (world.H / rect.height);
  const rects = getObjectRects(world.revealedZone, world.W, world.H);
  for (const r of rects) {
    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
      return r;
    }
  }
  return null;
}

function triggerObject(obj) {
  const localT = performance.now() - world.worldT0;
  world.activeInteractions[obj.response] = localT;
  if (obj.response === 'lamp_toggle') {
    world.lampOn = !world.lampOn;
  }
  playClick();
  // Best-effort touch recording.
  try {
    fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'touch', zone: world.revealedZone, object_key: obj.key })
    }).catch(() => {});
  } catch (_) {}
}

function selectState(stateId, btn) {
  const s = STATES.find(s => s.id === stateId);
  if (!s) return;
  let zone = s.zone;
  if (zone === null) {
    zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  }
  world.selected = { id: s.id, zone };
  world.revealedZone = zone;
  world.revealStart = performance.now();
  world.phase = 'reveal';
  playClick();
  setZone(zone);
  fetchLine(s.id);
  fetchMemory();
  world.activeInteractions = {};
  showZoneLabel(zone);
  hidePicker();
  leaveHint.classList.add('visible');
}

function showZoneLabel(zone) {
  zoneLabel.textContent = zone.toUpperCase();
  zoneLabel.classList.add('visible');
  setTimeout(() => {
    zoneLabel.classList.remove('visible');
  }, world.revealDuration);
}

function hidePicker() {
  pickerRow.style.display = 'none';
  pickerHint.style.display = 'none';
}

function showPicker() {
  pickerRow.style.display = 'flex';
  pickerHint.style.display = '';
}

async function fetchLine(state) {
  world.lineRequested = { state, t: performance.now() };
  try {
    const res = await fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'line', state })
    });
    if (!res.ok) { world.line = null; return; }
    const data = await res.json();
    if (data && data.ok && data.line) {
      if (world.lineRequested && world.lineRequested.state === state) {
        world.line = data.line;
        world.lineFallback = !!data.fallback;
        world.lineStart = performance.now();
        showLine();
      }
    } else {
      world.line = null;
    }
  } catch (_) {
    world.line = null;
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
  } catch (_) {}
}

function showLine() {
  if (!world.line) return;
  lineEl.textContent = world.line;
  lineEl.classList.add('visible');
  setTimeout(() => {
    lineEl.classList.remove('visible');
  }, 18000);
}

// ----- Main loop -----
let rafId = null;
function startLoop() {
  cancelAnimationFrame(rafId);
  const tick = (t) => {
    draw(t);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function draw(t) {
  if (!world.W || !world.H) return;

  // Background.
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, world.W, world.H);

  const mem = world.memory || null;
  const inter = {};
  for (const [k, t0] of Object.entries(world.activeInteractions)) {
    if (world.phase === 'world' && t - world.worldT0 - t0 < 3000) inter[k] = t0;
  }
  world.activeInteractions = inter;
  const zoneState = { lampOn: world.lampOn };

  if (world.phase === 'world' && world.revealedZone) {
    if (world.revealedZone === 'Road')  drawRoad(ctx,  t, world.W, world.H, mem, inter, zoneState);
    if (world.revealedZone === 'Room')  drawRoom(ctx,  t, world.W, world.H, mem, inter, zoneState);
    if (world.revealedZone === 'Field') drawField(ctx, t, world.W, world.H, mem, inter, zoneState);
  } else if (world.phase === 'exiting' && world.revealedZone) {
    const elapsed = t - world.exitStart;
    const phase = Math.min(elapsed / world.exitDuration, 1);
    const localT = elapsed;
    if (world.revealedZone === 'Road')  drawRoad(ctx,  localT, world.W, world.H, mem, inter, zoneState);
    if (world.revealedZone === 'Room')  drawRoom(ctx,  localT, world.W, world.H, mem, inter, zoneState);
    if (world.revealedZone === 'Field') drawField(ctx, localT, world.W, world.H, mem, inter, zoneState);
    // Fade overlay
    const fadeAlpha = phase > 0.4 ? (phase - 0.4) / 0.6 : 0;
    if (fadeAlpha > 0) {
      ctx.fillStyle = `rgba(10, 10, 12, ${Math.min(fadeAlpha, 1)})`;
      ctx.fillRect(0, 0, world.W, world.H);
    }
    if (phase >= 1) {
      world.phase = 'picking';
      world.selected = null;
      world.revealedZone = null;
      world.activeInteractions = {};
      showPicker();
      leaveHint.classList.remove('visible');
      lineEl.classList.remove('visible');
    }
  }
  // picking and reveal phases: the canvas is just the void background
  // (no zones drawn). HTML overlay shows the picker.
}

// ----- Boot -----
function start() {
  if (isSoundMuted()) muteButton.classList.add('muted');
  fitCanvas();
  startLoop();
}
start();
