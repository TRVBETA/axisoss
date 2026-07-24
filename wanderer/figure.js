// The Wanderer — figure sprite
// 16x16 pixel-art figure. Dark outline, no face. Expressive through posture.
//
// Frame buffer is rendered ONCE at boot into an offscreen canvas, then
// blitted per frame. No asset files. Pixel data lives in this file.
//
// 4 postures, 2 frames each (breath cycle):
//   standing  - neutral, weight centered
//   walking   - slight forward lean
//   sitting   - lower body compressed
//   headDown  - shoulders raised, head lowered
//
// Color: dark teal outline (#2a3a3a), amber fill on torso (#c89c64), off-white accent.

const FIG_W = 16;
const FIG_H = 16;

// Each frame is 16 rows of 16 chars. '.' = transparent, others = palette key.
const FRAMES = {
  standing: [
    '................',
    '................',
    '.......##.......',
    '......####......',
    '......#aa#......',
    '......####......',
    '......####......',
    '.....######.....',
    '....#a##a#a#....',
    '....#a####a#....',
    '....#a####a#....',
    '....#a####a#....',
    '.....##..##.....',
    '.....#a..a#.....',
    '....##....##....',
    '....#......#....',
  ],
  walking: [
    '................',
    '................',
    '......####......',
    '......#aa#......',
    '......#aa#......',
    '......####......',
    '......####......',
    '.....######.....',
    '....#a##a#a#....',
    '....#a####a#....',
    '....#a####a#....',
    '....#a####a#....',
    '....##...##.....',
    '...#a#...#a#....',
    '..##........##..',
    '..#..........#..',
  ],
  sitting: [
    '................',
    '................',
    '................',
    '......####......',
    '......#aa#......',
    '......####......',
    '......####......',
    '.....######.....',
    '....#a##a#a#....',
    '....#a####a#....',
    '....#a####a#....',
    '...##aaaa##.....',
    '..#a#aaaa#a#....',
    '.##.##..##.##...',
    '................',
    '................',
  ],
  headDown: [
    '................',
    '................',
    '................',
    '......####......',
    '.....#aa##......',
    '.....####.......',
    '.....####.......',
    '....######......',
    '...#a##a#a#.....',
    '...#a####a#.....',
    '...#a####a#.....',
    '...#a####a#.....',
    '....##..##......',
    '....#a..a#......',
    '...##....##.....',
    '..##......##....',
  ],
  lying: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......####......',
    '.....#aa##......',
    '.....####.......',
    '.....####.......',
    '....#a##a#a#....',
    '...#a####a#.....',
    '....######......',
  ],
};

const PAL = {
  '#': '#2a3a3a',  // outline (dark teal)
  'a': '#c89c64',  // torso (amber)
  'o': '#ebe3d3',  // accent (off-white) — reserved, not used in v1 frames
};

function buildFrame(rows) {
  const c = document.createElement('canvas');
  c.width = FIG_W;
  c.height = FIG_H;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (let y = 0; y < FIG_H; y++) {
    const row = rows[y];
    for (let x = 0; x < FIG_W; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = PAL[ch];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Pre-render every posture. The breath cycle picks frame 0 or 1 of the current posture.
const SPRITE = {};
for (const [name, rows] of Object.entries(FRAMES)) {
  SPRITE[name] = buildFrame(rows);
}

export function drawFigure(ctx, x, y, posture = 'standing', breath = 0) {
  // breath: 0..1 — used by caller to swap torso row offset (1px chest rise).
  const src = SPRITE[posture] || SPRITE.standing;
  // Tiny breath: shift down 1px on exhale phase.
  const dy = breath > 0.5 ? 1 : 0;
  ctx.drawImage(src, Math.round(x - FIG_W / 2), Math.round(y - FIG_H + dy));
}

export const FIGURE = { w: FIG_W, h: FIG_H, SPRITE };
