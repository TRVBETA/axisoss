// The Wanderer — slice 2 (no-PIN version)
// Open /wanderer/, see the picker, tap a symbol, enter the world.
//
// State -> zone mapping (locked from SPEC.md):
//   static    -> Field
//   restless  -> Room
//   grey      -> Road
//   hollow    -> Room
//   clear     -> random between all three

import { drawRoad, drawRoom, drawField } from './zones.js';
import { ensureAudio, setZone, playClick, toggleMute, isSoundMuted } from './sound.js';
import { getObjectRects } from './objects.js';

// ----- DOM refs -----
const canvas      = document.getElementById('world');
const ctx         = canvas.getContext('2d');
const muteButton  = document.getElementById('mute-toggle');

ctx.imageSmoothingEnabled = false;

// ----- Constants -----
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

// ----- Mute button -----
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
  worldT0: 0,
  // AI line (optional, fails gracefully if backend is down)
  line: null,
  lineFallback: false,
  lineStart: 0,
  lineRequested: null,
  // Memory (optional)
  memory: null,
  // Interactions
  activeInteractions: {},
  // Lamp toggle state
  lampOn: true,
  // Silent exit
  exitStart: 0,
  exitDuration: 2200,
  exitDirection: 1
};

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

  const hintAlpha = 0.35 + 0.15 * Math.sin(t * 0.001);
  ctx.fillStyle = withAlpha(PAL.offDim, hintAlpha);
  ctx.font = '10px ui-monospace, "SF Mono", monospace';
  ctx.fillText('TAP A MARK', cx, cy + 60);
}

function drawZoneLabel(t) {
  const elapsed = t - world.revealStart;
  const phase = elapsed / world.revealDuration;
  if (phase >= 1) {
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
  const inter = {};
  for (const [k, t0] of Object.entries(world.activeInteractions)) {
    if (localT - t0 < 3000) inter[k] = t0;
  }
  world.activeInteractions = inter;
  const zoneState = { lampOn: world.lampOn };
  if (world.revealedZone === 'Road') {
    drawRoad(ctx, localT, mem, inter, zoneState);
  } else if (world.revealedZone === 'Room') {
    drawRoom(ctx, localT, mem, inter, zoneState);
  } else if (world.revealedZone === 'Field') {
    drawField(ctx, localT, mem, inter, zoneState);
  }

  if (world.line) {
    drawLine(localT);
  }

  const hintAlpha = 0.25 + 0.15 * Math.sin(localT * 0.0008);
  ctx.fillStyle = withAlpha(PAL.offDim, hintAlpha);
  ctx.font = '9px ui-monospace, "SF Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('TAP TO LEAVE', W - 12, H - 8);
}

function drawLine(localT) {
  const t = (performance.now() - world.lineStart) / 1000;
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

  const words = world.line.split(/\s+/);
  const lines = wrapToTwoLines(words, 36);
  const cx = W / 2;
  const baseY = H * 0.78;

  ctx.save();
  ctx.font = '13px ui-monospace, "SF Mono", "Cascadia Code", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(200, 156, 100, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = `rgba(235, 227, 211, ${alpha * 0.92})`;
  for (let i = 0; i < lines.length; i++) {
    const ly = baseY + (i - (lines.length - 1) / 2) * 18;
    ctx.fillText(lines[i], cx, ly);
  }
  ctx.shadowBlur = 0;
  const ruleAlpha = alpha * 0.25;
  ctx.fillStyle = `rgba(94, 86, 74, ${ruleAlpha})`;
  ctx.fillRect(cx - 60, baseY - (lines.length * 18) / 2 - 14, 120, 1);
  ctx.fillRect(cx - 60, baseY + (lines.length * 18) / 2 + 14, 120, 1);
  ctx.restore();
}

function wrapToTwoLines(words, maxPerLine) {
  if (words.length <= maxPerLine) return [words.join(' ')];
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

function drawExit(t) {
  const elapsed = t - world.exitStart;
  const phase = Math.min(elapsed / world.exitDuration, 1);
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

  const baseFigX = W / 2;
  const baseFigY = world.revealedZone === 'Field' ? H - 70
                 : world.revealedZone === 'Road'  ? H - 70
                 : H - 90;
  const walkDx = world.exitDirection * W * 0.7 * phase;
  const walkDy = world.revealedZone === 'Field' ? 0 : -2 * Math.sin(phase * Math.PI);
  const breath = (Math.sin(t * 0.005) + 1) * 0.5;
  // Inline drawFigure would need import — use a simple placeholder via drawFigure import
  // Since we removed the figure import, we just fade without walking figure for now
  void breath; void baseFigX; void baseFigY; void walkDx; void walkDy;

  let fadeAlpha = 0;
  if (phase > 0.4) {
    fadeAlpha = (phase - 0.4) / 0.6;
  }
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(10, 10, 12, ${Math.min(fadeAlpha, 1)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (phase >= 1) {
    world.phase = 'picking';
    world.selected = null;
    world.revealedZone = null;
    world.line = null;
    world.lineRequested = null;
    world.activeInteractions = {};
  }
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
    world.phase = 'world';
    world.worldT0 = performance.now();
    playClick();
    return;
  }
  if (world.phase === 'world') {
    const hit = hitTestObject(e.clientX, e.clientY);
    if (hit) {
      triggerObject(hit);
      return;
    }
    world.exitDirection = (world.revealedZone === 'Field') ? -1 : 1;
    world.exitStart = performance.now();
    world.phase = 'exiting';
    playClick();
    setZone(null);
  }
});

canvas.addEventListener('touchstart', (e) => {
  if (world.phase !== 'picking') return;
  if (e.touches.length > 0) {
    const t = e.touches[0];
    hoverFromCoords(t.clientX, t.clientY);
  }
}, { passive: true });

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
  if (obj.response === 'lamp_toggle') {
    world.lampOn = !world.lampOn;
  }
  playClick();
  // Best-effort touch recording — silently fails if backend is down.
  try {
    fetch('/api/wanderer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'touch', zone: world.revealedZone, object_key: obj.key })
    }).catch(() => {});
  } catch (_) {}
}

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
  playClick();
  setZone(zone);
  // Best-effort: fetch AI line and memory. Both fail silently.
  fetchLine(s.id);
  fetchMemory();
  world.activeInteractions = {};
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

// ----- Color helpers -----
function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ----- Boot -----
function start() {
  if (isSoundMuted()) {
    muteButton.classList.add('muted');
  } else {
    muteButton.classList.remove('muted');
  }
  fitCanvas();
  startLoop();
}
start();
