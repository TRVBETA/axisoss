// The Wanderer — three zones, drawn as clean illustrations.
// No pixel art, no low-res canvas. All drawing is at native pixels
// using gradients, smooth shapes, and proper silhouettes. Sized to
// canvas W,H so it looks good at any resolution.

const HORIZON_RATIO = 0.62;

// ----- THE ROAD -----
export function drawRoad(ctx, t, W, H, memory, inter, state) {
  const HORIZON = H * HORIZON_RATIO;
  const isVeteran = memory && memory.is_veteran;
  const timeBucket = memory && memory.time_bucket;

  // Sky — teal to rose gradient (subtle brightness lift)
  let skyColors;
  if (timeBucket === 'long') {
    skyColors = ['#241814', '#4a2c2c', '#8a4640', '#b86a44'];
  } else {
    skyColors = ['#141418', '#26403e', '#6a4640', '#9a6a44'];
  }
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, skyColors[0]);
  sky.addColorStop(0.5, skyColors[1]);
  sky.addColorStop(0.85, skyColors[2]);
  sky.addColorStop(1, skyColors[3]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Stars (subtle, distance)
  const stars = [
    [0.09, 0.08], [0.19, 0.05], [0.31, 0.13], [0.45, 0.06], [0.59, 0.14],
    [0.74, 0.08], [0.86, 0.11], [0.95, 0.17], [0.06, 0.23], [0.28, 0.25],
    [0.52, 0.21], [0.81, 0.27], [0.91, 0.31], [0.14, 0.33], [0.66, 0.36],
    [0.04, 0.14], [0.24, 0.19], [0.38, 0.30], [0.56, 0.03], [0.70, 0.18],
    [0.80, 0.03], [0.93, 0.27], [0.11, 0.40], [0.48, 0.39], [0.77, 0.40],
    [0.34, 0.07], [0.67, 0.31]
  ];
  for (let i = 0; i < stars.length; i++) {
    const [rx, ry] = stars[i];
    const sx = rx * W, sy = ry * H;
    const twinkle = (Math.sin(t * 0.002 + sx * 0.3) + 1) * 0.5;
    const isBright = (i % 3) === 0;
    const baseAlpha = isBright ? 0.6 : 0.3;
    const alpha = baseAlpha + twinkle * (isBright ? 0.4 : 0.2);
    const sz = Math.max(1, Math.min(W, H) / 800);
    ctx.fillStyle = `rgba(235, 227, 211, ${alpha})`;
    ctx.fillRect(sx, sy, sz, sz);
  }

  // Distant amber light ahead (the destination)
  const lightPulse = 0.6 + 0.4 * Math.sin(t * 0.0008);
  const lightX = W / 2;
  const lightY = HORIZON - H * 0.012;
  const baseR = Math.max(4, W / 240);
  const lightR = baseR + lightPulse * baseR * 0.5;
  const halo = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, lightR * 8);
  halo.addColorStop(0, `rgba(255, 200, 130, ${0.7 * lightPulse})`);
  halo.addColorStop(0.3, `rgba(255, 170, 130, ${0.3 * lightPulse})`);
  halo.addColorStop(0.6, `rgba(200, 138, 130, ${0.15 * lightPulse})`);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(lightX - lightR * 8, lightY - lightR * 8, lightR * 16, lightR * 16);
  // Bright core
  ctx.fillStyle = '#ffe6b0';
  ctx.beginPath();
  ctx.arc(lightX, lightY, lightR, 0, Math.PI * 2);
  ctx.fill();

  // Distant city lights along the horizon (small warm dots)
  const cityX = [W * 0.36, W * 0.39, W * 0.42, W * 0.58, W * 0.62, W * 0.66, W * 0.30, W * 0.70];
  for (let i = 0; i < cityX.length; i++) {
    const flick = (Math.sin(t * 0.003 + i * 1.7) + 1) * 0.5;
    const alpha = 0.25 + flick * 0.4;
    const sz = Math.max(1, W / 1200);
    ctx.fillStyle = `rgba(255, 180, 120, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cityX[i], HORIZON - sz * 2, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#4a2820');
  ground.addColorStop(0.5, '#1a1410');
  ground.addColorStop(1, '#0a0808');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Path — receding to vanishing point
  const pathCenterX = W / 2;
  const pathTopW = W * 0.012;
  const pathBotW = W * 0.30;
  const pathGrad = ctx.createLinearGradient(0, HORIZON, 0, H);
  pathGrad.addColorStop(0, 'rgba(200, 156, 100, 0.4)');
  pathGrad.addColorStop(1, 'rgba(120, 90, 60, 0.25)');
  ctx.fillStyle = pathGrad;
  ctx.beginPath();
  ctx.moveTo(pathCenterX - pathTopW / 2, HORIZON);
  ctx.lineTo(pathCenterX + pathTopW / 2, HORIZON);
  ctx.lineTo(pathCenterX + pathBotW / 2, H);
  ctx.lineTo(pathCenterX - pathBotW / 2, H);
  ctx.closePath();
  ctx.fill();

  // Path edges
  ctx.strokeStyle = 'rgba(200, 156, 100, 0.7)';
  ctx.lineWidth = Math.max(1, W / 800);
  ctx.beginPath();
  ctx.moveTo(pathCenterX - pathTopW / 2, HORIZON);
  ctx.lineTo(pathCenterX - pathBotW / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pathCenterX + pathTopW / 2, HORIZON);
  ctx.lineTo(pathCenterX + pathBotW / 2, H);
  ctx.stroke();

  // Bird on a wire
  const wireY = HORIZON - H * 0.20;
  ctx.strokeStyle = 'rgba(150, 130, 110, 0.4)';
  ctx.lineWidth = Math.max(1, W / 1500);
  ctx.beginPath();
  ctx.moveTo(0, wireY);
  ctx.lineTo(W, wireY);
  ctx.stroke();

  let birdX = W * 0.20;
  let birdY = wireY;
  if (inter.bird_flies !== undefined && (t - inter.bird_flies) < 2000) {
    const phase = (t - inter.bird_flies) / 2000;
    birdX += phase * W * 0.3;
    birdY -= phase * H * 0.12;
    ctx.globalAlpha = 1 - phase;
  }
  drawBird(ctx, birdX, birdY, t, W);

  // Door
  let doorBrightness = 0;
  if (inter.door_opens !== undefined && (t - inter.door_opens) < 2500) {
    doorBrightness = 1 - (t - inter.door_opens) / 2500;
  }
  const doorX = W * 0.74;
  const doorY = HORIZON - H * 0.10;
  if (doorBrightness > 0) {
    const doorGlow = ctx.createRadialGradient(doorX, doorY + H * 0.05, 0, doorX, doorY + H * 0.05, W * 0.06);
    doorGlow.addColorStop(0, `rgba(255, 200, 130, ${0.5 * doorBrightness})`);
    doorGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = doorGlow;
    ctx.fillRect(doorX - W * 0.06, doorY, W * 0.12, H * 0.14);
  }
  drawDoor(ctx, doorX, doorY, W);

  // Cassette
  const figX = W / 2;
  const figY = H * 0.81;
  if (inter.cassette_held !== undefined && (t - inter.cassette_held) < 2000) {
    drawCassette(ctx, figX - W * 0.012, figY - H * 0.07);
    // Sky shifts color while cassette is held
    ctx.globalAlpha = 0.4 * (1 - (t - inter.cassette_held) / 2000);
    ctx.fillStyle = '#c98a82';
    ctx.fillRect(0, 0, W, HORIZON);
    ctx.globalAlpha = 1;
  } else {
    drawCassette(ctx, figX + W * 0.05, figY + H * 0.02);
  }

  // Light post
  let postBright = 0;
  if (inter.post_pulse !== undefined && (t - inter.post_pulse) < 1500) {
    const phase = (t - inter.post_pulse) / 1500;
    postBright = Math.sin(phase * Math.PI) * 0.7;
  }
  drawLightPost(ctx, W * 0.12, HORIZON + H * 0.04, postBright, W);

  // Sign
  drawSign(ctx, W * 0.85, HORIZON + H * 0.08, W);

  // Figure — walking toward the light
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  const posture = isVeteran ? 'standing' : 'walking';
  // Subtle warm rim-light around the figure so it reads against the dark ground.
  const figRim = ctx.createRadialGradient(figX, figY - H * 0.10, 0, figX, figY - H * 0.10, H * 0.18);
  figRim.addColorStop(0, 'rgba(200, 156, 100, 0.18)');
  figRim.addColorStop(0.5, 'rgba(200, 156, 100, 0.07)');
  figRim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = figRim;
  ctx.fillRect(figX - H * 0.2, figY - H * 0.3, H * 0.4, H * 0.4);
  drawFigure(ctx, figX, figY, posture, breath, W, H);

  if (inter.sign_look !== undefined && (t - inter.sign_look) < 1200) {
    const alpha = 1 - (t - inter.sign_look) / 1200;
    // Small upward arrow from figure head
    ctx.fillStyle = `rgba(200, 156, 100, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(figX, figY - H * 0.07);
    ctx.lineTo(figX - W * 0.004, figY - H * 0.05);
    ctx.lineTo(figX + W * 0.004, figY - H * 0.05);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBird(ctx, x, y, t, W) {
  const flap = Math.floor(t / 200) % 2;
  const sz = Math.max(1.5, W / 400);
  // Silhouette: body + head + wings
  ctx.fillStyle = '#1a1a1c';
  ctx.beginPath();
  ctx.ellipse(x, y, 6 * sz, 3 * sz, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(x + 5 * sz, y - 1 * sz, 2.5 * sz, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#c89c64';
  ctx.beginPath();
  ctx.moveTo(x + 7 * sz, y - 1 * sz);
  ctx.lineTo(x + 9 * sz, y - 0.5 * sz);
  ctx.lineTo(x + 7 * sz, y);
  ctx.closePath();
  ctx.fill();
  // Wings
  ctx.fillStyle = '#0a0a0c';
  if (flap === 0) {
    ctx.beginPath();
    ctx.ellipse(x - 2 * sz, y, 4 * sz, 1.5 * sz, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2 * sz, y, 4 * sz, 1.5 * sz, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(x - 2 * sz, y - 1.5 * sz, 4 * sz, 1.5 * sz, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2 * sz, y - 1.5 * sz, 4 * sz, 1.5 * sz, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDoor(ctx, x, y, W) {
  const w = W * 0.022;
  const h = w * 2;
  // Door frame
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(x - w/2, y, w, h);
  // Highlight on edges
  ctx.fillStyle = '#5a3a30';
  ctx.fillRect(x - w/2, y, w * 0.15, h);
  ctx.fillRect(x + w/2 - w * 0.15, y, w * 0.15, h);
  // Knob
  ctx.fillStyle = '#c89c64';
  ctx.beginPath();
  ctx.arc(x + w * 0.3, y + h * 0.5, Math.max(1, w * 0.05), 0, Math.PI * 2);
  ctx.fill();
}

function drawCassette(ctx, x, y) {
  const w = 18, h = 10;
  // Body
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x - w/2, y - h/2, w, h);
  // Label
  ctx.fillStyle = '#5a3a35';
  ctx.fillRect(x - w/2 + 2, y - h/2 + 1, w - 4, 3);
  // Reels
  ctx.fillStyle = '#0a0a0c';
  ctx.beginPath();
  ctx.arc(x - 3, y + 1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3, y + 1, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightPost(ctx, x, y, bright, W) {
  const sz = W / 640;
  // Post
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(x, y, 3 * sz, 60 * sz);
  // Arm
  ctx.fillRect(x + 3 * sz, y, 8 * sz, 2 * sz);
  // Lamp head
  ctx.fillStyle = '#3a2820';
  ctx.fillRect(x + 8 * sz, y - 4 * sz, 6 * sz, 6 * sz);
  // Glow
  const baseGlow = 0.4 + (bright || 0);
  const radius = (12 + (bright || 0) * 30) * sz;
  const glow = ctx.createRadialGradient(x + 11 * sz, y, 0, x + 11 * sz, y, radius);
  glow.addColorStop(0, `rgba(255, 200, 130, ${baseGlow})`);
  glow.addColorStop(0.5, `rgba(200, 156, 100, ${baseGlow * 0.4})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius * 0.5, y - radius * 0.5, radius * 2, radius * 2);
}

function drawSign(ctx, x, y, W) {
  const sz = W / 640;
  // Post
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x, y, 2 * sz, 25 * sz);
  // Sign board
  ctx.fillStyle = '#5a3a35';
  ctx.fillRect(x - 10 * sz, y - 8 * sz, 22 * sz, 10 * sz);
  // Symbol on sign
  ctx.fillStyle = '#c89c64';
  ctx.fillRect(x - 2 * sz, y - 5 * sz, 4 * sz, 1 * sz);
  ctx.fillRect(x - 1 * sz, y - 4 * sz, 2 * sz, 4 * sz);
}

// ----- THE ROOM -----
export function drawRoom(ctx, t, W, H, memory, inter, state) {
  const HORIZON = H * HORIZON_RATIO;
  const isVeteran = memory && memory.is_veteran;
  const timeBucket = memory && memory.time_bucket;
  const lampOn = !state || state.lampOn !== false;

  // Wall (subtle brightness lift)
  const wall = ctx.createLinearGradient(0, 0, 0, H * 0.67);
  wall.addColorStop(0, '#5a3a2c');
  wall.addColorStop(0.6, '#3a2822');
  wall.addColorStop(1, '#241814');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H * 0.67);

  // Floor
  const floor = ctx.createLinearGradient(0, H * 0.67, 0, H);
  floor.addColorStop(0, '#1a1410');
  floor.addColorStop(0.5, '#0e0a08');
  floor.addColorStop(1, '#050403');
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.67, W, H * 0.33);

  // Window — single light source
  const winX = W * 0.12, winY = H * 0.17, winW = W * 0.16, winH = H * 0.31;
  const lightPhase = (Math.sin(t * 0.0003) + 1) * 0.5;
  let r, g, b;
  if (timeBucket === 'long') {
    r = 168; g = 90; b = 58;
  } else {
    r = Math.round(120 + 80 * lightPhase);
    g = Math.round(100 + 60 * (1 - lightPhase));
    b = Math.round(80 + 60 * (1 - lightPhase));
  }
  const skyWin = ctx.createLinearGradient(0, winY, 0, winY + winH);
  skyWin.addColorStop(0, `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`);
  skyWin.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
  ctx.fillStyle = skyWin;
  ctx.fillRect(winX, winY, winW, winH);

  // Cast of window light on floor
  const cast = ctx.createRadialGradient(winX + winW / 2, winY + winH, 0, winX + winW / 2, winY + winH, W * 0.22);
  cast.addColorStop(0, `rgba(255, 200, 130, 0.25)`);
  cast.addColorStop(0.5, `rgba(200, 156, 100, 0.10)`);
  cast.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cast;
  ctx.fillRect(winX - W * 0.12, H * 0.55, W * 0.4, H * 0.3);

  // Window frame
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = Math.max(2, W / 600);
  ctx.strokeRect(winX, winY, winW, winH);
  ctx.beginPath();
  ctx.moveTo(winX + winW / 2, winY);
  ctx.lineTo(winX + winW / 2, winY + winH);
  ctx.moveTo(winX, winY + winH / 2);
  ctx.lineTo(winX + winW, winY + winH / 2);
  ctx.stroke();

  // Desk
  const deskX = W * 0.59, deskY = H * 0.64, deskW = W * 0.25, deskH = H * 0.14;
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(deskX, deskY, deskW, deskH);
  // Desk top highlight
  const deskTop = ctx.createLinearGradient(0, deskY, 0, deskY + 4);
  deskTop.addColorStop(0, '#5a3a30');
  deskTop.addColorStop(1, '#2a1f1c');
  ctx.fillStyle = deskTop;
  ctx.fillRect(deskX, deskY, deskW, 4);
  // Legs
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(deskX + 8, deskY + deskH, 4, H * 0.18);
  ctx.fillRect(deskX + deskW - 12, deskY + deskH, 4, H * 0.18);
  // Notebook
  const noteW = W * 0.05, noteH = H * 0.034;
  ctx.fillStyle = '#ebe3d3';
  ctx.fillRect(deskX + W * 0.05, deskY - noteH, noteW, noteH);
  ctx.fillStyle = '#5e564a';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(deskX + W * 0.055, deskY - noteH + 4 + i * 4, noteW * 0.8, 1);
  }

  // Shelf + planet
  const shelfX = W * 0.84, shelfY = H * 0.33;
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(shelfX, shelfY, W * 0.13, 5);
  const planetBoostT = (inter.planet_glow !== undefined && (t - inter.planet_glow) < 1500)
    ? t + Math.sin((t - inter.planet_glow) * 0.01) * 200
    : t;
  drawPlanet(ctx, shelfX + W * 0.05, shelfY - H * 0.022, planetBoostT, W);
  if (inter.planet_glow !== undefined && (t - inter.planet_glow) < 1500) {
    const alpha = 1 - (t - inter.planet_glow) / 1500;
    const ring = ctx.createRadialGradient(shelfX + W * 0.054, shelfY - H * 0.011, 0, shelfX + W * 0.054, shelfY - H * 0.011, W * 0.04);
    ring.addColorStop(0, `rgba(255, 200, 130, ${0.6 * alpha})`);
    ring.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ring;
    ctx.fillRect(shelfX + W * 0.022, shelfY - H * 0.06, W * 0.06, H * 0.1);
  }

  // Lamp
  const lampX = W * 0.08, lampY = H * 0.78;
  // Base
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(lampX - W * 0.01, lampY + H * 0.01, W * 0.02, H * 0.015);
  // Stem
  ctx.fillStyle = '#2a1f1c';
  ctx.fillRect(lampX - 1, lampY - H * 0.08, 2, H * 0.09);
  // Shade
  ctx.fillStyle = lampOn ? '#8a6a3f' : '#1a1410';
  ctx.beginPath();
  ctx.moveTo(lampX - W * 0.014, lampY - H * 0.10);
  ctx.lineTo(lampX + W * 0.014, lampY - H * 0.10);
  ctx.lineTo(lampX + W * 0.011, lampY - H * 0.075);
  ctx.lineTo(lampX - W * 0.011, lampY - H * 0.075);
  ctx.closePath();
  ctx.fill();
  // Glow when on
  if (lampOn) {
    const lampGlow = ctx.createRadialGradient(lampX, lampY - H * 0.085, 0, lampX, lampY - H * 0.085, H * 0.20);
    lampGlow.addColorStop(0, 'rgba(255, 200, 130, 0.55)');
    lampGlow.addColorStop(0.3, 'rgba(200, 156, 100, 0.25)');
    lampGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(lampX - H * 0.2, lampY - H * 0.3, H * 0.4, H * 0.4);
  }

  // Chair
  const chairX = W * 0.32, chairY = H * 0.67;
  ctx.fillStyle = '#3a2a25';
  ctx.fillRect(chairX - W * 0.025, chairY, W * 0.05, H * 0.012);
  // Back
  ctx.fillRect(chairX - W * 0.025, chairY - H * 0.05, W * 0.005, H * 0.06);
  // Legs
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(chairX - W * 0.022, chairY + H * 0.012, W * 0.005, H * 0.06);
  ctx.fillRect(chairX + W * 0.017, chairY + H * 0.012, W * 0.005, H * 0.06);

  // Figure — standing center
  const figX = W / 2, figY = H * 0.75;
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  const figurePosture = (inter.chair_sit !== undefined && (t - inter.chair_sit) < 4000) ? 'sitting' : (isVeteran ? 'sitting' : 'standing');
  // Subtle warm rim-light around the figure so it reads against the dark room.
  const figRim = ctx.createRadialGradient(figX, figY - H * 0.10, 0, figX, figY - H * 0.10, H * 0.18);
  figRim.addColorStop(0, lampOn ? 'rgba(255, 200, 130, 0.22)' : 'rgba(200, 156, 100, 0.12)');
  figRim.addColorStop(0.5, 'rgba(200, 156, 100, 0.07)');
  figRim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = figRim;
  ctx.fillRect(figX - H * 0.2, figY - H * 0.3, H * 0.4, H * 0.4);
  drawFigure(ctx, figX, figY, figurePosture, breath, W, H);

  // Dust motes drifting in lamp light (and window light)
  for (let i = 0; i < 8; i++) {
    const motePhase = (t * 0.00015 + i * 0.7) % 1;
    const moteX = lampX + Math.sin(t * 0.0004 + i * 1.3) * W * 0.04;
    const moteY = H * 0.66 - motePhase * H * 0.4;
    const moteAlpha = (1 - motePhase) * 0.5 * (lampOn ? 1 : 0.3);
    const msz = Math.max(1, W / 800);
    ctx.fillStyle = `rgba(255, 230, 200, ${moteAlpha})`;
    ctx.beginPath();
    ctx.arc(Math.round(moteX), Math.round(moteY), msz, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlanet(ctx, x, y, t, W) {
  const sz = W / 320;
  // Planet body with gradient
  const planetGrad = ctx.createRadialGradient(x + 3 * sz, y + 3 * sz, 0, x + 4 * sz, y + 4 * sz, 8 * sz);
  planetGrad.addColorStop(0, '#a07ab0');
  planetGrad.addColorStop(0.5, '#7a5a8a');
  planetGrad.addColorStop(1, '#3a2a4a');
  ctx.fillStyle = planetGrad;
  ctx.beginPath();
  ctx.arc(x + 4 * sz, y + 4 * sz, 6 * sz, 0, Math.PI * 2);
  ctx.fill();
  // Ring around planet
  const frame = Math.floor(t / 600) % 4;
  ctx.strokeStyle = '#c89c64';
  ctx.lineWidth = sz * 0.4;
  ctx.beginPath();
  ctx.ellipse(x + 4 * sz, y + 4 * sz, 7 * sz, 2 * sz, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(x + 2 * sz, y + 2 * sz, 2 * sz, 0, Math.PI * 2);
  ctx.fill();
  // Glow on the first frame
  if (frame === 0) {
    const glow = ctx.createRadialGradient(x + 4 * sz, y + 4 * sz, 0, x + 4 * sz, y + 4 * sz, 16 * sz);
    glow.addColorStop(0, 'rgba(200, 156, 100, 0.4)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 8 * sz, y - 8 * sz, 24 * sz, 24 * sz);
  }
}

// ----- THE FIELD -----
export function drawField(ctx, t, W, H, memory, inter, state) {
  const HORIZON = H * HORIZON_RATIO;
  const isVeteran = memory && memory.is_veteran;
  const timeBucket = memory && memory.time_bucket;

  // Sky (subtle brightness lift)
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#345a58');
  sky.addColorStop(0.5, '#5a4444');
  sky.addColorStop(1, '#8a5444');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Horizon haze
  const haze = ctx.createLinearGradient(0, HORIZON - H * 0.04, 0, HORIZON);
  haze.addColorStop(0, 'rgba(200, 138, 130, 0)');
  haze.addColorStop(1, 'rgba(200, 138, 130, 0.4)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON - H * 0.04, W, H * 0.04);

  // Distant mass
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.ellipse(W / 2, HORIZON, W * 0.10, H * 0.015, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ground
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#5a3a35');
  ground.addColorStop(0.5, '#3a2820');
  ground.addColorStop(1, '#1a1410');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Grass tufts — drawn as soft shapes
  const tufts = [
    [0.05, 0.69, 0.025, 0.0],  [0.10, 0.71, 0.022, 0.4],  [0.14, 0.67, 0.019, 0.8],
    [0.22, 0.75, 0.017, 1.2],  [0.27, 0.71, 0.022, 0.6],  [0.31, 0.79, 0.014, 0.5],
    [0.38, 0.74, 0.019, 1.8],  [0.44, 0.83, 0.011, 2.1],  [0.50, 0.81, 0.017, 1.0],
    [0.56, 0.89, 0.011, 1.5],  [0.63, 0.85, 0.014, 0.9],  [0.69, 0.78, 0.017, 0.8],
    [0.75, 0.86, 0.014, 2.3],  [0.81, 0.82, 0.014, 1.9],  [0.86, 0.76, 0.019, 1.4],
    [0.92, 0.86, 0.011, 0.3],  [0.95, 0.81, 0.017, 2.6],  [0.17, 0.82, 0.014, 1.7],
    [0.59, 0.76, 0.017, 2.0],  [0.39, 0.89, 0.011, 1.3]
  ];
  for (const [rx, ry, rh, phase] of tufts) {
    const extraPhase = (inter.grass_ripple !== undefined && (t - inter.grass_ripple) < 2000)
      ? Math.sin((t - inter.grass_ripple) * 0.005) * 1.5 : 0;
    drawGrassTuft(ctx, rx * W, ry * H, rh * H, t * 0.001 + phase + (timeBucket === 'long' || timeBucket === 'days' ? 0.4 : 0) + extraPhase, W);
  }

  // Drifting cloud
  const cloudX = (t * 0.005) % (W + 80) - 40;
  const cloudY = H * 0.14;
  ctx.fillStyle = 'rgba(94, 86, 74, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cloudX, cloudY, W * 0.04, H * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();

  // Two roads diverging
  const figX = W / 2, figY = H * 0.81;
  const roadsChoice = (inter.roads_choose !== undefined) ? Math.floor((t - inter.roads_choose) / 3000) % 2 : -1;
  const roadsActive = inter.roads_choose !== undefined && (t - inter.roads_choose) < 3000;
  const roadsAlpha = roadsActive ? 0.6 * (1 - (t - inter.roads_choose) / 3000) : 0.3;
  ctx.strokeStyle = `rgba(200, 156, 100, ${roadsAlpha})`;
  ctx.lineWidth = Math.max(2, W / 600);
  ctx.beginPath(); ctx.moveTo(figX, figY); ctx.quadraticCurveTo(W * 0.2, H * 0.93, W * 0.06, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(figX, figY); ctx.quadraticCurveTo(W * 0.8, H * 0.93, W * 0.94, H); ctx.stroke();
  if (roadsChoice >= 0) {
    ctx.strokeStyle = `rgba(255, 230, 200, ${roadsAlpha * 1.4})`;
    ctx.lineWidth = Math.max(3, W / 400);
    ctx.beginPath();
    if (roadsChoice === 0) { ctx.moveTo(figX, figY); ctx.quadraticCurveTo(W * 0.2, H * 0.93, W * 0.06, H); }
    else { ctx.moveTo(figX, figY); ctx.quadraticCurveTo(W * 0.8, H * 0.93, W * 0.94, H); }
    ctx.stroke();
  }

  // Fire
  const fireBoost = (inter.fire_approach !== undefined && (t - inter.fire_approach) < 3000)
    ? (1 - (t - inter.fire_approach) / 3000) * 0.8 : 0;
  const firePhase = (Math.sin(t * 0.002) + 1) * 0.5;
  const fireX = W * 0.19, fireY = HORIZON - 2;
  const fireRadius = (16 + fireBoost * 24) * (W / 1920);
  const fireGlow = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, fireRadius);
  fireGlow.addColorStop(0, `rgba(255, 180, 100, ${0.7 + 0.3 * firePhase + fireBoost * 0.4})`);
  fireGlow.addColorStop(0.5, `rgba(255, 120, 80, ${(0.4 + fireBoost * 0.3) * firePhase})`);
  fireGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fireGlow;
  ctx.fillRect(fireX - fireRadius, fireY - fireRadius, fireRadius * 2, fireRadius * 2);
  // Core
  ctx.fillStyle = '#ffaa55';
  ctx.beginPath();
  ctx.arc(fireX, fireY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Horizon shimmer
  if (inter.horizon_shimmer !== undefined && (t - inter.horizon_shimmer) < 2500) {
    const alpha = 1 - (t - inter.horizon_shimmer) / 2500;
    const shimmer = ctx.createLinearGradient(0, HORIZON - H * 0.08, 0, HORIZON);
    shimmer.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shimmer.addColorStop(0.5, `rgba(255, 200, 130, ${0.3 * alpha})`);
    shimmer.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, HORIZON - H * 0.08, W, H * 0.08);
  }
  // Horizon marker
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(W * 0.87, HORIZON - H * 0.05, W * 0.005, H * 0.05);

  // Stone
  let stoneX = figX - W * 0.05;
  if (inter.stone_move !== undefined && (t - inter.stone_move) < 2000) {
    const ph = (t - inter.stone_move) / 2000;
    stoneX += Math.sin(ph * Math.PI) * W * 0.03;
  }
  ctx.fillStyle = '#3a2a25';
  ctx.beginPath();
  ctx.ellipse(stoneX, figY + H * 0.012, W * 0.012, H * 0.008, 0, 0, Math.PI * 2);
  ctx.fill();

  // Figure
  const breath = (Math.sin(t * 0.003) + 1) * 0.5;
  const figurePosture = (inter.fire_approach !== undefined && (t - inter.fire_approach) < 3000) ? 'sitting' : (isVeteran ? 'standing' : 'headDown');
  // Subtle warm rim-light around the figure so it reads against the dusk field.
  const figRim = ctx.createRadialGradient(figX, figY - H * 0.10, 0, figX, figY - H * 0.10, H * 0.18);
  figRim.addColorStop(0, 'rgba(200, 138, 130, 0.20)');
  figRim.addColorStop(0.5, 'rgba(200, 138, 130, 0.08)');
  figRim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = figRim;
  ctx.fillRect(figX - H * 0.2, figY - H * 0.3, H * 0.4, H * 0.4);
  drawFigure(ctx, figX, figY, figurePosture, breath, W, H);
}

function drawGrassTuft(ctx, x, y, h, phase, W) {
  const wind = Math.sin(phase) * 0.5;
  const tuftW = W * 0.012;
  // Each tuft is 3 blades, drawn as soft triangles
  for (let i = 0; i < 3; i++) {
    const bx = x + i * 2;
    const tipX = bx + Math.round(wind * 4);
    // Filled triangle for the blade
    ctx.fillStyle = 'rgba(90, 74, 48, 0.7)';
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(tipX - 1, y - h);
    ctx.lineTo(tipX + 1, y - h);
    ctx.lineTo(bx + 1, y);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(140, 120, 80, 0.5)';
    ctx.beginPath();
    ctx.moveTo(bx, y - h * 0.3);
    ctx.lineTo(tipX, y - h);
    ctx.lineTo(bx + 0.5, y - h * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

// ----- FIGURE -----
// Clean illustrated silhouette. Width and height are based on canvas H.
// Head is a circle, body is a rounded rectangle, legs are a tapered shape.
// Subtle lift: silhouette is warm-dark rather than near-black so the
// figure reads against the night backgrounds.
const FIGURE_FILL = '#2a2018';
function drawFigure(ctx, x, y, posture, breath, W, H) {
  // Sizing: figure is ~12% of canvas height tall, scaled to look natural
  const unitH = H * 0.16;
  const breathOffset = breath > 0.5 ? unitH * 0.01 : 0;
  const headR = unitH * 0.16;
  const headY = y - unitH + headR;
  const bodyTop = headY + headR;
  const bodyBottom = y - unitH * 0.55;
  const bodyW = unitH * 0.18;

  if (posture === 'sitting') {
    // Compressed figure: head + body + folded legs
    const bodyH = unitH * 0.4;
    // Body
    ctx.fillStyle = FIGURE_FILL;
    ctx.beginPath();
    ctx.ellipse(x, headY + headR + bodyH * 0.5, bodyW * 0.7, bodyH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    // Legs (compressed, horizontal)
    ctx.fillStyle = FIGURE_FILL;
    ctx.fillRect(x - bodyW, y - unitH * 0.5, bodyW * 2, unitH * 0.18);
    return;
  }

  if (posture === 'headDown') {
    // Figure with head lowered (looking down, contemplative)
    // Body
    ctx.fillStyle = FIGURE_FILL;
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + (bodyBottom - bodyTop) * 0.5, bodyW * 0.5, (bodyBottom - bodyTop) * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head, slightly lowered and tilted
    ctx.beginPath();
    ctx.arc(x, headY + headR * 0.4, headR, 0, Math.PI * 2);
    ctx.fill();
    // Shoulders raised slightly
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + (bodyBottom - bodyTop) * 0.15, bodyW * 0.7, bodyW * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillStyle = FIGURE_FILL;
    ctx.fillRect(x - bodyW * 0.3, bodyBottom, bodyW * 0.6, y - bodyBottom);
    return;
  }

  if (posture === 'walking') {
    // Walking: body + head + alternating leg positions
    // Body
    ctx.fillStyle = FIGURE_FILL;
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + (bodyBottom - bodyTop) * 0.5, bodyW * 0.5, (bodyBottom - bodyTop) * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    // Legs alternating based on breath
    const legSpread = breath > 0.5 ? 0.15 : -0.15;
    // Back leg
    ctx.fillStyle = FIGURE_FILL;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.15, bodyBottom);
    ctx.lineTo(x - bodyW * 0.3 - legSpread * bodyW, y);
    ctx.lineTo(x - bodyW * 0.05 - legSpread * bodyW, y);
    ctx.lineTo(x + bodyW * 0.1, bodyBottom);
    ctx.closePath();
    ctx.fill();
    // Front leg
    ctx.fillStyle = FIGURE_FILL;
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.15, bodyBottom);
    ctx.lineTo(x + bodyW * 0.3 + legSpread * bodyW, y);
    ctx.lineTo(x + bodyW * 0.05 + legSpread * bodyW, y);
    ctx.lineTo(x - bodyW * 0.1, bodyBottom);
    ctx.closePath();
    ctx.fill();
    return;
  }

  // standing (default)
  // Body
  ctx.fillStyle = FIGURE_FILL;
  ctx.beginPath();
  ctx.ellipse(x, bodyTop + (bodyBottom - bodyTop) * 0.5, bodyW * 0.5, (bodyBottom - bodyTop) * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(x, headY + breathOffset, headR, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = FIGURE_FILL;
  ctx.fillRect(x - bodyW * 0.3, bodyBottom, bodyW * 0.25, y - bodyBottom);
  ctx.fillRect(x + bodyW * 0.05, bodyBottom, bodyW * 0.25, y - bodyBottom);
}
