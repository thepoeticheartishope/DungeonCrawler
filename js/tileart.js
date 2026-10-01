// Tile art: the filled-in textures the map draws its floors, walls, pillars
// and boxes with, so a wall reads as stone and each kind of room has its
// own floor. Which texture goes where is TILE_ART in config.js (walls are
// bricks, hallways cobbles, crypt flagstones, library planks, flooded wet
// stone, shrine inlay); the painters for each texture are here.
//
// mapview.js (top-down) and isoview.js (isometric) both call artAt() /
// art() for a square texture and draw it: top-down as a square, isometric
// mapped onto the floor's diamond and the faces of a block. Textures are
// drawn once per size into small canvases and reused every frame.
//
// The textures use their own seeded numbers, never Math.random: the seeded
// tests replace Math.random, and drawing must never use up their numbers.
// So a tile looks the same every time it's drawn.

import { state, key } from './state.js';
import { TILE_ART, TILE_ART_TONES, TILE_ART_LOOKS } from './config.js';

// The darkest colour of each texture, under its tinted strokes: the mortar
// between bricks, the gaps between floor stones.
const GROUT = '#070909';

// How each texture is drawn. Which texture goes where, and how bright they
// are, is TILE_ART / TILE_ART_TONES in config.js.
const FLOOR_TONE = TILE_ART_TONES.floor; // a floor stone's fill, from darkest to lightest
const WALL_TONE = TILE_ART_TONES.wall;   // a brick's fill
const CAP_TONE = TILE_ART_TONES.cap;     // the top of a wall in the isometric view
const BEVEL = 0.07;               // the lit top-left edge of a stone, added to its fill
const SHADE = 0.45;               // the dark bottom-right edge of a stone

// Wall bricks: courses per tile, bricks per course.
const BRICK_COURSES = 4;
const BRICKS_PER_COURSE = 2;
const GAP = 0.035; // the grout between stones and boards, as a share of the tile

// The flagstone layouts, as [left, top, width, height] shares of the
// tile. Each look uses one.
const SLAB_LAYOUTS = [
  [[0, 0, 1, 1]],
  [[0, 0, 1, 0.55], [0, 0.55, 1, 0.45]],
  [[0, 0, 0.45, 1], [0.45, 0, 0.55, 1]],
  [[0, 0, 0.6, 0.6], [0.6, 0, 0.4, 0.6], [0, 0.6, 1, 0.4]],
];

// Every texture by the name TILE_ART uses for it. A new look for the map
// is a new painter here plus its name in TILE_ART.
const PAINTERS = {
  bricks: paintBricks,
  capstone: paintCap,
  columnTop: paintPillarTop,
  columnSide: paintPillarSide,
  crate: paintCrate,
  cobbles: paintCobbles,
  flagstones: paintFlagstones,
  planks: paintPlanks,
  wetStone: paintWetStone,
  inlay: paintInlay,
};

let colourRgb = '190, 220, 228'; // the phosphor tint, from the page's --glow-rgb
let cacheSize = 0;               // the texture size the cache holds, in pixels
const cache = new Map();         // 'texture:look:shade' -> canvas

// Takes the phosphor tint from the page's colours, so the textures match
// the rest of the map. mapview.js calls it once at start.
export function setTileArtColour(glowRgb) {
  colourRgb = glowRgb;
  cache.clear();
}

// Whether tileart.js can draw a texture of this name. The tests check
// every name in TILE_ART with it, so a typo there fails a test instead of
// quietly drawing hallway cobbles.
export function hasTexture(name) {
  return Object.hasOwn(PAINTERS, name);
}

// The texture a tile's floor or wall is drawn with, `size` pixels square:
// the wall texture for a wall, else its room theme's floor (the hallway
// floor outside rooms). Neighbouring tiles get different looks.
export function artAt(row, col, size) {
  const k = key(row, col);
  if (state.floor.wallSet.has(k)) return texture(TILE_ART.wall, row, col, size);
  return texture(floorTexture(k), row, col, size);
}

// The texture for one part of the map (a TILE_ART key: 'wall', 'wallTop',
// 'pillarTop', 'pillarSide', 'box') on a tile, `size` pixels square. The
// tile's place picks its look. `shade` (0..1) darkens it, for a block's
// faces in shadow: baked in here once, not filled over every face every
// frame.
export function art(part, row, col, size, shade = 0) {
  return texture(TILE_ART[part], row, col, size, shade);
}

// A texture by name, drawn once per size, look and shade and then reused.
function texture(name, row, col, size, shade = 0) {
  const px = Math.max(8, Math.round(size));
  if (px !== cacheSize) {
    cache.clear();
    cacheSize = px;
  }
  const look = lookOf(row, col);
  const id = name + ':' + look + ':' + shade;
  if (!cache.has(id)) cache.set(id, paint(name, look, px, shade));
  return cache.get(id);
}

// The floor texture a tile has: its room theme's, or the hallway's
// outside the rooms (and for a theme TILE_ART.floors doesn't name).
function floorTexture(k) {
  const chamber = state.floor.chamberAt.get(k);
  const theme = chamber === undefined ? null : state.floor.chamberThemes[chamber];
  return TILE_ART.floors[theme] || TILE_ART.hall;
}

// Which of the TILE_ART_LOOKS looks a tile shows: mixed from its place
// and the floor number, so the pattern doesn't repeat in rows.
function lookOf(row, col) {
  let h = (row * 73856093) ^ (col * 19349663) ^ ((state.run.roomIndex + 1) * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % TILE_ART_LOOKS;
}

// Draws one texture into a new canvas `px` pixels square, darkened by
// `shade` (0..1).
function paint(name, variant, px, shade) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = px;
  const ctx = sprite.getContext('2d');
  ctx.scale(px, px);
  const rand = seeded(name.length * 131 + name.charCodeAt(0) * 17 + variant * 7919);
  const painter = PAINTERS[name] || PAINTERS[TILE_ART.hall];
  painter(ctx, rand, variant, px);
  if (shade > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = shadow(shade);
    ctx.fillRect(0, 0, 1, 1);
  }
  return sprite;
}

// A phosphor tint at strength `a`.
function tone(a) {
  return 'rgba(' + colourRgb + ', ' + a + ')';
}

function shadow(a) {
  return 'rgba(0, 0, 0, ' + a + ')';
}

// A number between lo and hi from the texture's own numbers.
function between(rand, [lo, hi]) {
  return lo + (hi - lo) * rand();
}

// One cut stone: filled, lit along its top and left edges, shaded along
// its bottom and right, with a few specks of wear. Units are shares of
// the tile; `line` is one pixel in those units.
function stone(ctx, rand, x, y, w, h, fill, line) {
  ctx.fillStyle = tone(fill);
  ctx.fillRect(x, y, w, h);
  const edge = Math.max(line * 1.5, 0.025);
  ctx.fillStyle = tone(BEVEL);
  ctx.fillRect(x, y, w, edge);
  ctx.fillRect(x, y, edge, h);
  ctx.fillStyle = shadow(SHADE);
  ctx.fillRect(x, y + h - edge, w, edge);
  ctx.fillRect(x + w - edge, y, edge, h);
  specks(ctx, rand, x, y, w, h, line, Math.round(w * h * 14));
}

// Small light and dark marks scattered over a stone, so it isn't flat.
function specks(ctx, rand, x, y, w, h, line, count) {
  for (let i = 0; i < count; i++) {
    const size = line * (1 + rand() * 2);
    ctx.fillStyle = rand() < 0.5 ? shadow(0.35) : tone(0.06);
    ctx.fillRect(x + rand() * (w - size), y + rand() * (h - size), size, size);
  }
}

// A crack across a stone: a jagged dark line with a faint lit edge beside it.
function crack(ctx, rand, x, y, w, h, line) {
  const points = [];
  let px = x + w * (0.15 + rand() * 0.3);
  let py = y + h * 0.1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    points.push([px, py]);
    px += w * (rand() * 0.25 - 0.05);
    py += h * 0.8 / steps;
  }
  [[tone(0.08), line], [shadow(0.7), 0]].forEach(([colour, offset]) => {
    ctx.beginPath();
    points.forEach(([cx, cy], i) => (i ? ctx.lineTo(cx + offset, cy + offset) : ctx.moveTo(cx + offset, cy + offset)));
    ctx.strokeStyle = colour;
    ctx.lineWidth = line * 1.5;
    ctx.stroke();
  });
}

// Wall: courses of stone bricks in mortar, each course shifted half a
// brick, some bricks chipped.
function paintBricks(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  const courseH = 1 / BRICK_COURSES;
  const brickW = 1 / BRICKS_PER_COURSE;
  for (let c = 0; c < BRICK_COURSES; c++) {
    const shift = (c + variant) % 2 ? brickW / 2 : 0;
    for (let b = -1; b < BRICKS_PER_COURSE; b++) {
      const x = b * brickW + shift + GAP / 2;
      const y = c * courseH + GAP / 2;
      const w = brickW - GAP;
      const h = courseH - GAP;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 1, 1);
      ctx.clip();
      stone(ctx, rand, x, y, w, h, between(rand, WALL_TONE), line);
      if (rand() < 0.3) {
        // A chipped corner.
        const cx = rand() < 0.5 ? x : x + w;
        const cy = rand() < 0.5 ? y : y + h;
        const s = h * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (cx === x ? s : -s), cy);
        ctx.lineTo(cx, cy + (cy === y ? s : -s));
        ctx.closePath();
        ctx.fillStyle = GROUT;
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// The top of a wall seen from above in the isometric view: one capstone,
// a little brighter than the bricks, with a lit rim.
function paintCap(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  stone(ctx, rand, GAP, GAP, 1 - GAP * 2, 1 - GAP * 2, between(rand, CAP_TONE), line);
  if (variant === 3) crack(ctx, rand, GAP, GAP, 1 - GAP * 2, 1 - GAP * 2, line);
}

// A pillar seen from above (top-down): a round column on a dark footing,
// lit from the top left, with rings where its drums meet.
function paintPillarTop(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.beginPath();
  ctx.arc(0.53, 0.55, 0.42, 0, Math.PI * 2);
  ctx.fillStyle = shadow(0.6);
  ctx.fill();
  const g = ctx.createRadialGradient(0.38, 0.38, 0.02, 0.5, 0.5, 0.4);
  g.addColorStop(0, tone(0.45));
  g.addColorStop(0.6, tone(0.24));
  g.addColorStop(1, tone(0.12));
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.38, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0e0f';
  ctx.fill();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = line * 1.5;
  ctx.strokeStyle = tone(0.55);
  ctx.stroke();
  [0.27, 0.16].forEach(r => {
    ctx.beginPath();
    ctx.arc(0.5, 0.5, r, 0, Math.PI * 2);
    ctx.strokeStyle = shadow(0.4);
    ctx.stroke();
  });
  specks(ctx, rand, 0.3, 0.3, 0.4, 0.4, line, 4 + variant);
}

// A pillar's side in the isometric view: stacked stone drums with
// upright fluting.
function paintPillarSide(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  const drums = 3;
  for (let d = 0; d < drums; d++) {
    stone(ctx, rand, 0, d / drums + GAP / 2, 1, 1 / drums - GAP, between(rand, WALL_TONE), line);
  }
  ctx.lineWidth = line * 1.5;
  [0.25, 0.5, 0.75].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1);
    ctx.strokeStyle = shadow(0.35);
    ctx.stroke();
  });
}

// A box's sides and lid: boards inside a frame, with a cross brace.
function paintCrate(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  boards(ctx, rand, 3, [0.12, 0.17], line);
  ctx.strokeStyle = tone(0.22);
  ctx.lineWidth = 0.09;
  ctx.strokeRect(0.045, 0.045, 0.91, 0.91);
  ctx.beginPath();
  ctx.moveTo(0.1, 0.1);
  ctx.lineTo(0.9, 0.9);
  ctx.stroke();
}

// Floor boards running across the tile: `count` boards with grain and an
// end seam each.
function boards(ctx, rand, count, fill, line) {
  const boardH = 1 / count;
  for (let b = 0; b < count; b++) {
    const y = b * boardH + GAP / 2;
    const h = boardH - GAP;
    ctx.fillStyle = tone(between(rand, fill));
    ctx.fillRect(0, y, 1, h);
    ctx.fillStyle = tone(BEVEL * 0.6);
    ctx.fillRect(0, y, 1, Math.max(line * 1.5, 0.02));
    // Grain: thin wavy lines along the board.
    ctx.lineWidth = line;
    for (let g = 0; g < 3; g++) {
      const gy = y + h * (0.25 + g * 0.25) + (rand() - 0.5) * h * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(0.33, gy + (rand() - 0.5) * h * 0.3, 0.66, gy + (rand() - 0.5) * h * 0.3, 1, gy);
      ctx.strokeStyle = shadow(0.3);
      ctx.stroke();
    }
    // Where one board ends and the next begins, with a nail each side.
    const seam = 0.15 + rand() * 0.7;
    ctx.fillStyle = GROUT;
    ctx.fillRect(seam, y, GAP * 0.7, h);
    ctx.fillStyle = tone(0.2);
    const nail = Math.max(line * 2, 0.025);
    [seam - nail * 2, seam + GAP * 0.7 + nail].forEach(nx => ctx.fillRect(nx, y + h / 2 - nail / 2, nail, nail));
  }
}

// Hallway floor: rough round cobbles packed in dark grit.
function paintCobbles(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  const per = 3;
  const cell = 1 / per;
  for (let r = 0; r < per; r++) {
    for (let c = 0; c < per; c++) {
      const cx = (c + 0.5) * cell + (rand() - 0.5) * cell * 0.25;
      const cy = (r + 0.5) * cell + (rand() - 0.5) * cell * 0.25;
      const rx = cell * (0.4 + rand() * 0.08);
      const ry = cell * (0.36 + rand() * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = tone(between(rand, FLOOR_TONE));
      ctx.fill();
      // Lit top-left rim and a shaded bottom-right one.
      ctx.lineWidth = line * 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0, Math.PI, Math.PI * 1.5);
      ctx.strokeStyle = tone(BEVEL);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 0.5);
      ctx.strokeStyle = shadow(SHADE);
      ctx.stroke();
    }
  }
}

// Crypt floor: big worn flagstones, laid in one of SLAB_LAYOUTS, one look
// cracked.
function paintFlagstones(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  SLAB_LAYOUTS[variant % SLAB_LAYOUTS.length].forEach(([x, y, w, h]) => {
    stone(ctx, rand, x + GAP / 2, y + GAP / 2, w - GAP, h - GAP, between(rand, FLOOR_TONE), line);
  });
  if (variant === 0) crack(ctx, rand, 0.1, 0.05, 0.8, 0.9, line);
}

// Library floor: wooden boards.
function paintPlanks(ctx, rand, variant, px) {
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  boards(ctx, rand, 4, FLOOR_TONE, 1 / px);
}

// Flooded cellar: dark square stones under a skin of water, with a puddle
// and short glints where the water catches the light.
function paintWetStone(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]].forEach(([x, y]) => {
    stone(ctx, rand, x + GAP / 2, y + GAP / 2, 0.5 - GAP, 0.5 - GAP, FLOOR_TONE[0] * 0.8 + rand() * 0.02, line);
  });
  const cx = 0.3 + rand() * 0.4;
  const cy = 0.3 + rand() * 0.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.3 + rand() * 0.12, 0.18 + rand() * 0.08, rand() * Math.PI, 0, Math.PI * 2);
  ctx.fillStyle = tone(0.05);
  ctx.fill();
  ctx.lineWidth = line * 1.2;
  ctx.strokeStyle = tone(0.12);
  ctx.stroke();
  ctx.lineWidth = line * 1.5;
  for (let i = 0; i < 3; i++) {
    const gx = 0.1 + rand() * 0.75;
    const gy = 0.1 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 0.12, gy - 0.03);
    ctx.strokeStyle = tone(0.22);
    ctx.stroke();
  }
}

// Shrine floor: inlaid tiles, each with a border and a diamond, so the
// room reads as a made, holy place.
function paintInlay(ctx, rand, variant, px) {
  const line = 1 / px;
  ctx.fillStyle = GROUT;
  ctx.fillRect(0, 0, 1, 1);
  stone(ctx, rand, GAP / 2, GAP / 2, 1 - GAP, 1 - GAP, FLOOR_TONE[1], line);
  ctx.lineWidth = line * 2;
  ctx.strokeStyle = tone(0.1);
  ctx.strokeRect(0.12, 0.12, 0.76, 0.76);
  ctx.beginPath();
  ctx.moveTo(0.5, 0.17);
  ctx.lineTo(0.83, 0.5);
  ctx.lineTo(0.5, 0.83);
  ctx.lineTo(0.17, 0.5);
  ctx.closePath();
  ctx.fillStyle = shadow(0.3);
  ctx.fill();
  ctx.strokeStyle = tone(0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.5, 0.38);
  ctx.lineTo(0.62, 0.5);
  ctx.lineTo(0.5, 0.62);
  ctx.lineTo(0.38, 0.5);
  ctx.closePath();
  ctx.fillStyle = tone(0.14);
  ctx.fill();
}

// A small seeded random number source (mulberry32): the same seed gives
// the same numbers, so each texture comes out the same every time.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
