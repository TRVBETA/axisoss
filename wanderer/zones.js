// The Wanderer — three zones
// Each zone is a draw() function. They get a ctx, the canvas size, the current world time,
// and an optional memory object. They return a list of objects the figure can interact with later (slice 5).
// No interaction in slice 2 — just visual rendering.

import { drawFigure, FIGURE } from './figure.js';

const W = 640;
const H = 360;
const HORIZON = H * 0.62;

// ----- Memory-driven modifiers -----
// memory shape (from /api/wanderer-memory):
//   { time_bucket: 'first'|'recent'|'days'|'long', is_veteran: bool, total_visits: int, ... }
function modPosture(basePosture, memory) {
  if (!memory || !memory.is_veteran) return basePosture;
  // Veterans get a slightly different posture per base type — feels like the world knows them.
  if (basePosture === 'standing') return 'sitting';   // veterans sit more
  if (basePosture === 'walking')  return 'standing';  // veterans stand instead of pacing
  if (basePosture === 'headDown') return 'standing';  // veterans look up
  return basePosture;
}

function modBirdOffset(memory) {
  if (!memory) return 0;
  if (memory.time_bucket === 'days')  return 18;
  if (memory.time_bucket === 'long')  return -24;
  return 0;
}

function modPlanetFrame(memory) {
  if (!memory) return 0;
  if (memory.time_bucket === 'days') return 1;
  if (memory.time_bucket === 'long') return 2;
  return 0;
}

function modSkyTone(memory) {
  if (!memory || memory.time_bucket !== 'long') return null;
  // Long absence: sky shifts to late-evening rose.
  return { top: '#1a1410', mid: '#3a2025', low: '#7a3a3a', horizon: '#a85a3a' };
}

const PAL = {
  void:      '#0a0a0c',
  voidSoft:  '#14141a',
  amber:     '#c89c64',
  amberDim:  '#8a6a3f',
  amberDeep: '#5a4525',
  rose:      '#c98a82',
  roseDim:   '#7a4e48',
  teal:      '#4a706e',
  tealDim:   '#2a4443',
  tealDeep:  '#1a2e2d',
  off:       '#ebe3d3',
  offDim:    '#5e564a',
  offDark:   '#3a3530',
};

// =====================================================================
// THE ROAD
// Long path stretching to vanishing point. Night sky. One light ahead.
// Figure walks slowly forward.
// =====================================================================
export function drawRoad(ctx, t, memory, inter, state) {
  const posture = modPosture('walking', memory);
  const birdDx = modBirdOffset(memory);
  const interT = inter || {};
  const stateObj = state || {};
  const birdFliesSince   = 'bird_flies'   in interT ? t - interT.bird_flies   : null;
  const doorOpensSince   = 'door_opens'   in interT ? t - interT.door_opens   : null;
  const cassetteHeldSince= 'cassette_held' in interT ? t - interT.cassette_held : null;
  const postPulseSince   = 'post_pulse'   in interT ? t - interT.post_pulse   : null;
  const signLookSince    = 'sign_look'    in interT ? t - interT.sign_look    : null;
  // Sky — deep teal at top, fading to amber-rose at horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#0a0a0c');
  sky.addColorStop(0.5, '#1a2e2d');
  sky.addColorStop(0.85, '#5a3a35');
  sky.addColorStop(1, '#8a5a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Stars — sparse, twinkle. Two layers: bright + faint.
  const stars = [
    [60, 30], [120, 18], [200, 45], [290, 22], [380, 50], [470, 28], [560, 38], [610, 60],
    [40, 80], [180, 90], [330, 75], [520, 95], [580, 110], [90, 120], [420, 130],
    [25, 50], [155, 65], [245, 105], [355, 12], [445, 65], [510, 12], [595, 95],
    [70, 145], [310, 140], [490, 145], [220, 25], [430, 110]
  ];
  for (let i = 0; i < stars.length; i++) {
    const [sx, sy] = stars[i];
    const twinkle = (Math.sin(t * 0.002 + sx * 0.3) + 1) * 0.5;
    // Half the stars are faint background.
    const isBright = (i % 3) === 0;
    const baseAlpha = isBright ? 0.45 : 0.18;
    const alpha = baseAlpha + twinkle * (isBright ? 0.45 : 0.2);
    ctx.fillStyle = `rgba(235, 227, 211, ${alpha})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Distant light far ahead — warm amber, the only light source.
  // Pulses slowly (the 20% feeling).
  const lightPulse = 0.6 + 0.4 * Math.sin(t * 0.0008);
  const lightX = W / 2;
  const lightY = HORIZON - 4;
  const lightR = 4 + lightPulse * 2;
  // Glow halo
  const halo = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, lightR * 6);
  halo.addColorStop(0, `rgba(200, 156, 100, ${0.6 * lightPulse})`);
  halo.addColorStop(0.4, `rgba(200, 138, 130, ${0.25 * lightPulse})`);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(lightX - lightR * 6, lightY - lightR * 6, lightR * 12, lightR * 12);
  // Core
  ctx.fillStyle = PAL.amber;
  ctx.fillRect(lightX - 1, lightY - 1, 2, 2);
  ctx.fillStyle = PAL.off;
  ctx.fillRect(lightX, lightY, 1, 1);

  // Distant city lights along the horizon — small, warm, sparse.
  // Each is a single dim pixel that occasionally flickers.
  const cityLights = [
    [lightX - 90, HORIZON - 1], [lightX - 70, HORIZON - 2], [lightX - 50, HORIZON - 1],
    [lightX + 50, HORIZON - 1], [lightX + 75, HORIZON - 2], [lightX + 100, HORIZON - 1],
    [lightX - 130, HORIZON - 1], [lightX + 130, HORIZON - 1]
  ];
  for (let i = 0; i < cityLights.length; i++) {
    const [cx2, cy2] = cityLights[i];
    const flick = (Math.sin(t * 0.003 + i * 1.7) + 1) * 0.5;
    const alpha = 0.15 + flick * 0.25;
    ctx.fillStyle = `rgba(200, 138, 100, ${alpha})`;
    ctx.fillRect(cx2, cy2, 1, 1);
  }

  // Ground — path receding to vanishing point.
  // Darker near, lighter far (under the light).
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#3a2820');
  ground.addColorStop(0.5, '#1a1410');
  ground.addColorStop(1, '#0a0808');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Path — subtle warm tint in the center, wider near, narrower far.
  // Painted as triangle from horizon to bottom.
  const pathTopW = 4;
  const pathBotW = 180;
  ctx.fillStyle = 'rgba(200, 156, 100, 0.18)';
  ctx.beginPath();
  ctx.moveTo(lightX - pathTopW / 2, HORIZON);
  ctx.lineTo(lightX + pathTopW / 2, HORIZON);
  ctx.lineTo(W / 2 + pathBotW / 2, H);
  ctx.lineTo(W / 2 - pathBotW / 2, H);
  ctx.closePath();
  ctx.fill();

  // Path edges — soft amber line fading into distance.
  ctx.strokeStyle = 'rgba(200, 156, 100, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lightX - pathTopW / 2, HORIZON);
  ctx.lineTo(W / 2 - pathBotW / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lightX + pathTopW / 2, HORIZON);
  ctx.lineTo(W / 2 + pathBotW / 2, H);
  ctx.stroke();

  // Figure — walking forward, position fixed in foreground.
  const figX = W / 2;
  const figY = H - 70;
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  drawFigure(ctx, figX, figY, posture, breath);

  // ----- Objects (visual only, no interaction yet) -----
  // 1. Bird on a wire — wire on the left, a small bird shape sitting.
  drawWire(ctx, 100, 130);
  // Bird flies off if tapped.
  let birdX = 130 + birdDx;
  let birdY = 128;
  if (birdFliesSince !== null && birdFliesSince < 2000) {
    // Bird takes off, flies up and right, fades.
    const phase = birdFliesSince / 2000;
    birdX += phase * 200;
    birdY -= phase * 40;
    ctx.globalAlpha = 1 - phase;
  }
  drawBird(ctx, birdX, birdY, t);
  ctx.globalAlpha = 1;

  // 2. Door in the middle of the road — small, surreal, off to the right.
  // Tap -> door opens, path gets slightly brighter for a moment.
  let doorBrightness = 0;
  if (doorOpensSince !== null && doorOpensSince < 2500) {
    doorBrightness = 1 - doorOpensSince / 2500;
  }
  drawDoor(ctx, 480, HORIZON - 28, doorBrightness);

  // 3. Cassette tape on the ground — near figure.
  // Tap -> figure picks it up, holds it; sky shifts color.
  if (cassetteHeldSince !== null && cassetteHeldSince < 2000) {
    // Cassette held by figure.
    drawCassette(ctx, figX - 4, figY - 10);
    // Sky color shift.
    ctx.globalAlpha = 0.3 * (1 - cassetteHeldSince / 2000);
    ctx.fillStyle = '#c98a82';
    ctx.fillRect(0, 0, W, HORIZON);
    ctx.globalAlpha = 1;
  } else {
    drawCassette(ctx, figX + 40, figY + 6);
  }

  // 4. Light post — to the left of the path, dim.
  let postBright = 0;
  if (postPulseSince !== null && postPulseSince < 1500) {
    const phase = postPulseSince / 1500;
    postBright = Math.sin(phase * Math.PI) * 0.7;
  }
  drawLightPost(ctx, 80, HORIZON + 20, postBright);

  // 5. Sign — to the right, tilted. Tap -> figure looks up briefly.
  drawSign(ctx, 540, HORIZON + 35);
  if (signLookSince !== null && signLookSince < 1200) {
    // Brief figure head-up posture overlay (already shown by posture change is hard;
    // instead, draw a tiny upward arrow from figure head).
    ctx.fillStyle = `rgba(200, 156, 100, ${1 - signLookSince / 1200})`;
    ctx.fillRect(figX, figY - 24, 1, 1);
    ctx.fillRect(figX, figY - 26, 1, 1);
    ctx.fillRect(figX, figY - 28, 1, 1);
  }
}

function drawWire(ctx, x, y) {
  ctx.strokeStyle = '#3a3530';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

function drawBird(ctx, x, y, t) {
  // 2-frame wing flap.
  const flap = Math.floor(t / 250) % 2;
  // Body
  ctx.fillStyle = '#1a1a1c';
  ctx.fillRect(x, y, 4, 2);
  // Head
  ctx.fillRect(x + 3, y - 1, 1, 1);
  // Wings
  if (flap === 0) {
    ctx.fillRect(x - 1, y, 2, 1);
    ctx.fillRect(x + 4, y, 2, 1);
  } else {
    ctx.fillRect(x - 1, y - 1, 2, 1);
    ctx.fillRect(x + 4, y - 1, 2, 1);
  }
}

function drawDoor(ctx, x, y, brightness) {
  // Small surreal door standing in the path of the light.
  // brightness 0..1 fades the door "open" effect (a brighter inner glow).
  if (brightness > 0) {
    ctx.fillStyle = `rgba(200, 156, 100, ${0.5 * brightness})`;
    ctx.fillRect(x - 4, y - 4, 22, 36);
  }
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(x, y, 14, 28);
  // Frame
  ctx.fillStyle = '#5a3a30';
  ctx.fillRect(x - 1, y - 1, 16, 1);
  ctx.fillRect(x - 1, y + 28, 16, 1);
  // Knob
  ctx.fillStyle = PAL.amber;
  ctx.fillRect(x + 11, y + 14, 1, 1);
}

function drawCassette(ctx, x, y) {
  // Small cassette on the ground.
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x, y, 14, 8);
  // Label
  ctx.fillStyle = '#5a3a35';
  ctx.fillRect(x + 1, y + 1, 12, 3);
  // Reels
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x + 3, y + 5, 2, 2);
  ctx.fillRect(x + 9, y + 5, 2, 2);
}

function drawLightPost(ctx, x, y, bright) {
  // Vertical post.
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(x, y, 2, 60);
  // Arm
  ctx.fillRect(x + 2, y, 6, 1);
  // Lamp head
  ctx.fillStyle = '#3a2820';
  ctx.fillRect(x + 6, y - 2, 4, 4);
  // Glow
  const baseGlow = 0.25 + (bright || 0);
  const radius = 10 + (bright || 0) * 20;
  const glow = ctx.createRadialGradient(x + 8, y, 0, x + 8, y, radius);
  glow.addColorStop(0, `rgba(200, 156, 100, ${baseGlow})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawSign(ctx, x, y) {
  // Tilted sign on a post.
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x, y, 1, 20);
  ctx.fillStyle = '#5a3a35';
  ctx.fillRect(x - 8, y - 6, 18, 8);
  // Faint symbol on the sign
  ctx.fillStyle = '#c89c64';
  ctx.fillRect(x - 2, y - 3, 1, 1);
  ctx.fillRect(x + 1, y - 3, 1, 1);
  ctx.fillRect(x, y - 2, 1, 1);
}

// =====================================================================
// THE ROOM
// Small interior. Window with shifting light. Desk, shelf, lamp, chair.
// Figure stands center.
// =====================================================================
export function drawRoom(ctx, t, memory, inter, state) {
  const posture = modPosture('standing', memory);
  const planetOffset = modPlanetFrame(memory);
  const skyTone = modSkyTone(memory);
  const interT = inter || {};
  const stateObj = state || {};
  const lampOn = stateObj.lampOn !== false; // default true
  const notebookSince   = 'notebook_poem' in interT ? t - interT.notebook_poem : null;
  const windowSince     = 'window_shift'  in interT ? t - interT.window_shift  : null;
  const planetGlowSince = 'planet_glow'   in interT ? t - interT.planet_glow   : null;
  const chairSitSince    = 'chair_sit'     in interT ? t - interT.chair_sit     : null;

  // Curated poetry lines for the notebook (rotated per tap).
  const POEMS = [
    'a held breath, a slow walk, a door you do not open',
    'the city sleeps and the lamp keeps its own time',
    'what you cannot say is also a kind of weather',
    'a long walk does not always reach a destination',
    'the room is small because you are not small'
  ];
  const poemIndex = notebookSince !== null
    ? Math.floor(notebookSince / 4000) % POEMS.length
    : 0;
  // Wall — warm dusty rose gradient.
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#3a2a25');
  wall.addColorStop(0.6, '#2a1f1c');
  wall.addColorStop(1, '#1a1410');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // Floor — darker, slightly cooler.
  ctx.fillStyle = '#0e0a08';
  ctx.fillRect(0, 240, W, H - 240);

  // Floor line.
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(0, 240, W, 1);

  // ----- Window (back wall, left) — single source of ambient light.
  // Light shifts slowly (time of day feeling).
  const lightPhase = (Math.sin(t * 0.0003) + 1) * 0.5; // 0..1
  const winX = 80, winY = 60, winW = 100, winH = 110;
  // Sky through window — amber to teal based on phase. Memory: long absence = late-evening rose.
  // Window tap: brief golden-hour shift.
  const winShiftActive = windowSince !== null && windowSince < 2000;
  const winShiftPhase = winShiftActive ? (1 - windowSince / 2000) : 0;
  const skyWin = ctx.createLinearGradient(0, winY, 0, winY + winH);
  let r, g, b;
  if (skyTone) {
    r = parseInt(skyTone.horizon.slice(1, 3), 16);
    g = parseInt(skyTone.horizon.slice(3, 5), 16);
    b = parseInt(skyTone.horizon.slice(5, 7), 16);
  } else if (winShiftActive) {
    // Golden hour: warm orange-pink.
    r = Math.round(220 * winShiftPhase + (120 + 80 * lightPhase) * (1 - winShiftPhase));
    g = Math.round(120 * winShiftPhase + (100 + 60 * (1 - lightPhase)) * (1 - winShiftPhase));
    b = Math.round(80 * winShiftPhase + (80 + 60 * (1 - lightPhase)) * (1 - winShiftPhase));
  } else {
    r = Math.round(120 + 80 * lightPhase);
    g = Math.round(100 + 60 * (1 - lightPhase));
    b = Math.round(80 + 60 * (1 - lightPhase));
  }
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(winX, winY, winW, winH);
  // Window light cast on floor — soft amber.
  const cast = ctx.createRadialGradient(winX + winW / 2, winY + winH, 0, winX + winW / 2, winY + winH, 120);
  cast.addColorStop(0, `rgba(200, 156, 100, ${0.18 + 0.1 * lightPhase})`);
  cast.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cast;
  ctx.fillRect(winX - 60, 220, 220, 80);
  // Window frame
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(winX - 1, winY - 1, winW + 2, 1);
  ctx.fillRect(winX - 1, winY + winH, winW + 2, 1);
  ctx.fillRect(winX - 1, winY, 1, winH + 1);
  ctx.fillRect(winX + winW, winY, 1, winH + 1);
  // Cross
  ctx.fillRect(winX + winW / 2 - 1, winY, 2, winH);
  ctx.fillRect(winX, winY + winH / 2 - 1, winW, 2);

  // ----- Desk (right of figure) — small, holds notebook.
  const deskX = 380, deskY = 230, deskW = 160, deskH = 50;
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(deskX, deskY, deskW, deskH);
  // Desk top edge
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(deskX, deskY, deskW, 2);
  // Legs
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(deskX + 5, deskY + deskH, 4, H - deskY - deskH);
  ctx.fillRect(deskX + deskW - 9, deskY + deskH, 4, H - deskY - deskH);
  // Notebook on desk
  ctx.fillStyle = '#ebe3d3';
  ctx.fillRect(deskX + 30, deskY - 8, 30, 12);
  // Lines on notebook
  ctx.fillStyle = '#5e564a';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(deskX + 33, deskY - 5 + i * 3, 24, 1);
  }
  // Notebook tap -> poetry line floats above the desk briefly.
  if (notebookSince !== null && notebookSince < 4000) {
    const alpha = 1 - notebookSince / 4000;
    const poem = POEMS[poemIndex];
    const words = poem.split(/\s+/);
    const lines = [];
    if (words.length > 6) {
      const mid = Math.floor(words.length / 2);
      lines.push(words.slice(0, mid).join(' '));
      lines.push(words.slice(mid).join(' '));
    } else {
      lines.push(poem);
    }
    ctx.save();
    ctx.font = '11px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(200, 156, 100, ${alpha})`;
    const px = deskX + 30 + 15;
    const py = deskY - 8 - 22;
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], px, py - (lines.length - 1 - li) * 13);
    }
    ctx.restore();
  }

  // ----- Shelf (right wall) — holds planet.
  const shelfX = 540, shelfY = 120;
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(shelfX, shelfY, 80, 4);
  // Planet — rotates slowly. Memory offsets rotation by 1 or 2 frames.
  // On glow tap, planet pulses with extra glow for 1.5s.
  let planetBoostT = t;
  if (planetGlowSince !== null && planetGlowSince < 1500) {
    planetBoostT = t + Math.sin(planetGlowSince * 0.01) * 200;
  }
  drawPlanet(ctx, shelfX + 30, shelfY - 8, planetBoostT + planetOffset * 600);
  // Extra glow ring on tap.
  if (planetGlowSince !== null && planetGlowSince < 1500) {
    const alpha = 1 - planetGlowSince / 1500;
    const ring = ctx.createRadialGradient(shelfX + 34, shelfY - 4, 0, shelfX + 34, shelfY - 4, 18);
    ring.addColorStop(0, `rgba(200, 156, 100, ${0.6 * alpha})`);
    ring.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ring;
    ctx.fillRect(shelfX + 14, shelfY - 22, 40, 36);
  }

  // ----- Lamp (left, near window) — warm glow. Toggles on tap.
  const lampX = 50, lampY = 280;
  // Base
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(lampX - 4, lampY + 4, 8, 6);
  // Stem
  ctx.fillRect(lampX, lampY - 30, 2, 36);
  // Shade
  ctx.fillStyle = lampOn ? PAL.amberDeep : '#1a1410';
  ctx.fillRect(lampX - 8, lampY - 38, 18, 10);
  // Glow
  if (lampOn) {
    const lampGlow = ctx.createRadialGradient(lampX, lampY - 32, 0, lampX, lampY - 32, 70);
    lampGlow.addColorStop(0, 'rgba(200, 156, 100, 0.45)');
    lampGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(lampX - 70, lampY - 100, 140, 140);
  }

  // ----- Chair (left of figure).
  const chairX = 220, chairY = 250;
  // Seat
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(chairX - 10, chairY, 20, 4);
  // Back
  ctx.fillRect(chairX - 10, chairY - 20, 2, 22);
  // Legs
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(chairX - 8, chairY + 4, 2, 24);
  ctx.fillRect(chairX + 6, chairY + 4, 2, 24);

  // Figure — standing center. Chair tap -> figure sits.
  const figX = W / 2;
  const figY = H - 90;
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  // If chair was just tapped within 4s, override posture to sitting.
  const figurePosture = (chairSitSince !== null && chairSitSince < 4000) ? 'sitting' : posture;
  drawFigure(ctx, figX, figY, figurePosture, breath);

  // Dust motes drifting in the lamp's light cone.
  // Slow upward drift, faint, recycled when off-screen.
  for (let i = 0; i < 6; i++) {
    const motePhase = (t * 0.00015 + i * 0.7) % 1;
    const moteX = lampX + Math.sin(t * 0.0004 + i * 1.3) * 30;
    const moteY = 240 - motePhase * 180; // drift from y=240 to y=60
    const moteAlpha = (1 - motePhase) * 0.35 * (lampOn ? 1 : 0.3);
    ctx.fillStyle = `rgba(235, 227, 211, ${moteAlpha})`;
    ctx.fillRect(Math.round(moteX), Math.round(moteY), 1, 1);
  }
}

function drawPlanet(ctx, x, y, t) {
  // 8x8 planet, rotating via 4 frame swap.
  const frame = Math.floor(t / 600) % 4;
  const planetFrames = [
    [
      '..####..',
      '.#aaaa#.',
      '#aa##aa#',
      '#a####a#',
      '#a####a#',
      '#aa##aa#',
      '.#aaaa#.',
      '..####..',
    ],
    [
      '..####..',
      '.#a##a#.',
      '#a####a#',
      '#a####a#',
      '#a####a#',
      '#a####a#',
      '.#a##a#.',
      '..####..',
    ],
    [
      '..####..',
      '.#aaaa#.',
      '#a####a#',
      '#aa##aa#',
      '#aa##aa#',
      '#a####a#',
      '.#aaaa#.',
      '..####..',
    ],
    [
      '..####..',
      '.#a##a#.',
      '#a####a#',
      '#a####a#',
      '#a####a#',
      '#a####a#',
      '.#a##a#.',
      '..####..',
    ],
  ];
  const rows = planetFrames[frame];
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const ch = rows[py][px];
      if (ch === '#') {
        ctx.fillStyle = '#2a1f1c';
      } else if (ch === 'a') {
        // Slight color variation based on rotation
        ctx.fillStyle = frame % 2 === 0 ? '#7a5a8a' : '#5a4a6a';
      } else {
        continue;
      }
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
  // Tiny glow once per cycle (every 4 frames)
  if (frame === 0) {
    const glow = ctx.createRadialGradient(x + 4, y + 4, 0, x + 4, y + 4, 12);
    glow.addColorStop(0, 'rgba(200, 156, 100, 0.4)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 8, y - 8, 24, 24);
  }
}

// =====================================================================
// THE FIELD
// Open space. Horizon. Grass tufts that ripple. Wind. Figure stands.
// =====================================================================
export function drawField(ctx, t, memory, inter, state) {
  const posture = modPosture('headDown', memory);
  const grassPhaseOffset = memory && (memory.time_bucket === 'long' || memory.time_bucket === 'days') ? 0.4 : 0;
  const interT = inter || {};
  const stateObj = state || {};
  const roadsSince    = 'roads_choose'    in interT ? t - interT.roads_choose    : null;
  const fireSince     = 'fire_approach'   in interT ? t - interT.fire_approach   : null;
  const grassSince    = 'grass_ripple'    in interT ? t - interT.grass_ripple    : null;
  const horizonSince  = 'horizon_shimmer' in interT ? t - interT.horizon_shimmer : null;
  const stoneSince    = 'stone_move'      in interT ? t - interT.stone_move      : null;
  // Sky — teal at top fading to dusty rose at horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#2a4443');
  sky.addColorStop(0.5, '#4a3a3a');
  sky.addColorStop(1, '#7a4a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Horizon line — soft, almost invisible.
  ctx.fillStyle = 'rgba(200, 138, 130, 0.3)';
  ctx.fillRect(0, HORIZON, W, 1);

  // "Something in the distance" — a small dark mass on the horizon.
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(W / 2 - 30, HORIZON - 4, 60, 4);
  ctx.fillRect(W / 2 - 20, HORIZON - 8, 40, 4);

  // Ground — warm dusty field.
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#5a3a35');
  ground.addColorStop(0.5, '#3a2820');
  ground.addColorStop(1, '#1a1410');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Grass tufts — dense, ripple with the wind.
  // Each tuft has a phase so they don't all ripple together.
  const tufts = [
    { x: 30,  y: 245, h: 9,  phase: 0.0 },
    { x: 60,  y: 252, h: 8,  phase: 0.4 },
    { x: 90,  y: 240, h: 7,  phase: 0.8 },
    { x: 140, y: 270, h: 6,  phase: 1.2 },
    { x: 175, y: 255, h: 8,  phase: 0.6 },
    { x: 200, y: 285, h: 5,  phase: 0.5 },
    { x: 240, y: 265, h: 7,  phase: 1.8 },
    { x: 280, y: 300, h: 4,  phase: 2.1 },
    { x: 320, y: 290, h: 6,  phase: 1.0 },
    { x: 360, y: 320, h: 4,  phase: 1.5 },
    { x: 400, y: 305, h: 5,  phase: 0.9 },
    { x: 440, y: 280, h: 6,  phase: 0.8 },
    { x: 480, y: 310, h: 5,  phase: 2.3 },
    { x: 520, y: 295, h: 5,  phase: 1.9 },
    { x: 560, y: 275, h: 7,  phase: 1.4 },
    { x: 590, y: 310, h: 4,  phase: 0.3 },
    { x: 615, y: 290, h: 6,  phase: 2.6 },
    { x: 110, y: 295, h: 5,  phase: 1.7 },
    { x: 380, y: 275, h: 6,  phase: 2.0 },
    { x: 250, y: 320, h: 4,  phase: 1.3 }
  ];
  for (const tuft of tufts) {
    // Grass tap -> extra wind force for 2s.
    const extraPhase = grassSince !== null && grassSince < 2000
      ? Math.sin(grassSince * 0.005) * 1.5
      : 0;
    drawGrassTuft(ctx, tuft.x, tuft.y, tuft.h, t * 0.001 + tuft.phase + grassPhaseOffset + extraPhase);
  }

  // A small drifting cloud — slow horizontal travel, very faint.
  const cloudX = (t * 0.005) % (W + 80) - 40;
  const cloudY = 50;
  ctx.fillStyle = 'rgba(94, 86, 74, 0.18)';
  ctx.fillRect(Math.round(cloudX),     cloudY,     30, 2);
  ctx.fillRect(Math.round(cloudX) + 4, cloudY - 1, 22, 1);
  ctx.fillRect(Math.round(cloudX) + 8, cloudY + 2, 18, 1);

  // Two roads diverging — one goes left, one goes right, very faint.
  // Painted as faded amber lines starting at the figure and curving away.
  const figX = W / 2;
  const figY = H - 70;
  // Roads tap -> the chosen road gets brighter for 3s.
  const roadsChoice = roadsSince !== null ? Math.floor(roadsSince / 3000) % 2 : -1;
  const roadsActive = roadsSince !== null && roadsSince < 3000;
  const roadsAlpha = roadsActive ? 0.4 * (1 - roadsSince / 3000) : 0.15;
  ctx.strokeStyle = `rgba(200, 156, 100, ${roadsAlpha})`;
  ctx.lineWidth = 1;
  // Left road
  ctx.beginPath();
  ctx.moveTo(figX, figY + 10);
  ctx.quadraticCurveTo(W * 0.2, figY + 30, 40, H);
  ctx.stroke();
  // Right road
  ctx.beginPath();
  ctx.moveTo(figX, figY + 10);
  ctx.quadraticCurveTo(W * 0.8, figY + 30, W - 40, H);
  ctx.stroke();
  // The chosen road gets a brighter line.
  if (roadsChoice >= 0) {
    ctx.strokeStyle = `rgba(235, 227, 211, ${roadsAlpha * 1.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (roadsChoice === 0) {
      ctx.moveTo(figX, figY + 10);
      ctx.quadraticCurveTo(W * 0.2, figY + 30, 40, H);
    } else {
      ctx.moveTo(figX, figY + 10);
      ctx.quadraticCurveTo(W * 0.8, figY + 30, W - 40, H);
    }
    ctx.stroke();
  }

  // Fire in the distance — small warm light on the horizon, left.
  // Fire tap -> fire gets bigger, figure sits for 3s.
  const fireBoost = fireSince !== null && fireSince < 3000
    ? (1 - fireSince / 3000) * 0.8
    : 0;
  const firePhase = (Math.sin(t * 0.002) + 1) * 0.5;
  const fireX = 120;
  const fireY = HORIZON - 2;
  const fireRadius = 14 + fireBoost * 20;
  const fireGlow = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, fireRadius);
  fireGlow.addColorStop(0, `rgba(255, 180, 100, ${0.5 + 0.3 * firePhase + fireBoost * 0.4})`);
  fireGlow.addColorStop(0.5, `rgba(200, 100, 80, ${(0.3 + fireBoost * 0.3) * firePhase})`);
  fireGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fireGlow;
  ctx.fillRect(fireX - fireRadius, fireY - fireRadius, fireRadius * 2, fireRadius * 2);
  // Core
  ctx.fillStyle = '#ffaa55';
  ctx.fillRect(fireX, fireY, 1, 1);

  // Horizon marker — a tall thin silhouette far right. Shimmer effect on tap.
  if (horizonSince !== null && horizonSince < 2500) {
    const alpha = 1 - horizonSince / 2500;
    const shimmer = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON);
    shimmer.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shimmer.addColorStop(0.5, `rgba(200, 156, 100, ${0.25 * alpha})`);
    shimmer.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, HORIZON - 30, W, 30);
  }
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(560, HORIZON - 18, 2, 18);

  // Small stone — in front of figure, left. Stone tap -> stone moves a few px.
  let stoneX = figX - 30;
  if (stoneSince !== null && stoneSince < 2000) {
    const phase = stoneSince / 2000;
    stoneX += Math.sin(phase * Math.PI) * 20;
  }
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(stoneX, figY + 4, 5, 3);

  // Figure — standing, slight head-down posture. Fire tap -> sit.
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  const figurePosture = (fireSince !== null && fireSince < 3000) ? 'sitting' : posture;
  drawFigure(ctx, figX, figY, figurePosture, breath);
}

function drawGrassTuft(ctx, x, y, h, phase) {
  // 3 blades of grass, each tilts with the wind.
  const wind = Math.sin(phase) * 0.5; // -0.5..0.5
  ctx.fillStyle = '#5a4a30';
  for (let i = 0; i < 3; i++) {
    const bx = x + i * 2;
    const tipX = bx + Math.round(wind * 2);
    // Draw a thin vertical line
    for (let dy = 0; dy < h; dy++) {
      const t = dy / h;
      const px = bx + Math.round((tipX - bx) * t);
      ctx.fillRect(px, y - dy, 1, 1);
    }
  }
}
