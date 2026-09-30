// The isometric map (DEV -> View): the floor drawn as phosphor-vector
// blocks on a diamond grid. Walls and pillars are glowing wireframe
// blocks, the floor dim diamond tiles, glyphs stand upright on their
// tiles, and light fades over the player's five steps.
//
// mapview.js calls drawIsoScene() from its drawScene when
// state.settings.isoView is on, and passes in what the two views share:
// the colours, the list of things on the map, fog, glyph painting, the
// boss mist and the pulses. So both views always show the same things;
// this file only decides where and how they stand. It reads state and
// never changes it.

import { state, key } from './state.js';
import { ISO_TILES_ACROSS, ISO_WALL_HEIGHT, MAP_GLYPH_SIZES, MAP_ANIMATION_MS, PLAYER_CONE_RANGE } from './config.js';
import { FACING_VECTORS } from './sight.js';
import { t } from './text.js';

// How bright a lit tile is, by its steps from the player (0 = their own
// tile): the light fades over the five steps they can see.
const LIGHT_FALLOFF = [1, 1, 0.85, 0.7, 0.56, 0.44];
const BOSS_LIT_LEVEL = 0.5;  // floor only the boss's light shows
const REMEMBERED_LEVEL = 0.2; // floor explored but not lit now
const WALL_MIN_LEVEL = 0.28; // a wall beside remembered floor: still a shape
const SEARCHED_LEVEL = 0.6;  // a box or paper already searched is dimmer

// Sizes, as shares of a tile's width unless they say otherwise.
const CAMERA_Y = 0.5;          // where the player stands, as a share of the map's height
const PILLAR_INSET = 0.24;     // a pillar is thinner than its tile, so it reads as a column
const PILLAR_HEIGHT = 1.15;    // as a share of a wall's height: a pillar stands above the walls
const BOX_INSET = 0.3;
const BOX_HEIGHT = 0.3;
const GLYPH_CELL = 0.85;       // the tile size glyphs are sized for (MAP_GLYPH_SIZES)
const GLYPH_RISE = 0.45;       // a glyph's middle sits this share of its height above the floor
const CONTACT_SHADOW = 0.2;    // the dark ellipse a glyph stands on, as a share of the diamond
const EDGE_WIDTH = 0.02;       // a phosphor line
const RIDGE_BLUR = 0.1;        // the glow along a block's top edges
const FACE_BLUR = 0.07;        // the fainter glow down its corners
const POOL_RADIUS = 2.2;       // the player's light pool, in tiles
const MIST_WIDTH = 2;          // one tile's boss mist, in tiles across
const MIST_SQUASH = 0.62;      // the mist lies flat: its height over its width
const PILLAR_SHADOW = 2.7;     // how far a pillar's shadow reaches, in tiles
const PILLAR_SHADOW_WIDTH = 0.2; // its width at the pillar; it spreads to 1.8x at the end
// The stairs down: nested diamonds sinking into the floor.
const STAIR_STEPS = 4;
const STAIR_INSET = [0.08, 0.09]; // the first step's inset, then each next one's
const STAIR_DROP = 0.1;           // how far each step sinks, as a share of a tile's height
// The paper lying flat, in the tile's own two directions (-1..1 across it).
const PAPER_SHEET = [[-0.8, -0.55], [0.75, -0.7], [0.8, 0.55], [-0.75, 0.7]];
const PAPER_LINES = [-0.3, 0, 0.3];
const PAPER_SCALE = 0.2;
const TARGET_PULSE = [0.45, 1]; // the target diamond's strength at either end of its pulse, as top-down

// The faces of a block, darker than its top so it reads as standing up.
const SOUTH_FACE = '#0a0e0f';
const EAST_FACE = '#0e1315';

// This frame's layout, set by drawIsoScene.
let tw = 0;         // a tile's width on the canvas, in pixels
let th = 0;         // its height (half the width: the diamond)
let wallH = 0;      // a wall's height in pixels
let originX = 0;    // where the player's tile sits on the canvas
let originY = 0;
let size = 0;       // the canvas's width and height
let look = null;    // what mapview.js passed in

// Draws the whole isometric map as state has it now, in layer order:
// floor, things lying on it (stairs, papers, the facing wedge, pillar
// shadows), light (the player's pool, the boss mist), then everything
// standing up back to front, so nearer things paint over farther ones.
// `shared` is { colours, things, fogOf, paintGlyph, mistSprite,
// mistStrength, pulse, keepMoving } from mapview.js.
export function drawIsoScene(ctx, canvasSize, shared) {
  look = shared;
  size = canvasSize;
  tw = size / ISO_TILES_ACROSS;
  th = tw / 2;
  wallH = tw * ISO_WALL_HEIGHT;
  originX = size / 2;
  originY = size * CAMERA_Y;
  const tiles = tilesInView();
  tiles.forEach(({ row, col }) => {
    if (!isWall(row, col) && look.fogOf(row, col) !== 'hidden') drawFloor(ctx, row, col);
  });
  const standing = [];
  tiles.forEach(({ row, col }) => {
    if (isWall(row, col)) {
      if (wallShown(row, col)) standing.push({ depth: row + col, draw: () => drawWall(ctx, row, col) });
    } else if (state.floor.pillarSet.has(key(row, col)) && look.fogOf(row, col) !== 'hidden') {
      standing.push({ depth: row + col, draw: () => drawPillar(ctx, row, col) });
    }
  });
  drawPillarShadows(ctx, tiles);
  look.things.forEach(thing => {
    if (!onScreen(thing.at.row, thing.at.col)) return;
    if (thing.kind === 'stairs') return drawStairs(ctx, thing.at);
    if (thing.kind === 'paper' && thing.glyph !== null) return drawPaper(ctx, thing.at);
    if (thing.kind === 'player') drawFacing(ctx, thing.at);
    standing.push({ depth: thing.at.row + thing.at.col + 0.5, draw: () => drawStanding(ctx, thing) });
  });
  drawLight(ctx, tiles);
  standing.sort((a, b) => a.depth - b.depth).forEach(s => s.draw());
  drawPlayerTrace(ctx, tiles);
  drawTarget(ctx);
}

// Every grid tile whose diamond (or a wall standing on it) falls on the
// canvas, back to front.
function tilesInView() {
  const reach = ISO_TILES_ACROSS + 2;
  const tiles = [];
  for (let row = state.floor.playerRow - reach; row <= state.floor.playerRow + reach; row++) {
    for (let col = state.floor.playerCol - reach; col <= state.floor.playerCol + reach; col++) {
      if (row < 0 || col < 0 || row >= state.floor.GRID_SIZE || col >= state.floor.GRID_SIZE) continue;
      if (onScreen(row, col)) tiles.push({ row, col });
    }
  }
  return tiles.sort((a, b) => (a.row + a.col) - (b.row + b.col) || a.row - b.row);
}

// The middle of a tile on the canvas, in pixels. The camera follows the
// player: their tile is always at the origin. Rows and columns may be
// fractional while something slides.
function centre(row, col) {
  const dr = row - state.floor.playerRow;
  const dc = col - state.floor.playerCol;
  return [originX + (dc - dr) * tw / 2, originY + (dc + dr) * th / 2];
}

// Whether a tile, or a wall standing on it, shows anywhere on the canvas.
function onScreen(row, col) {
  const [x, y] = centre(row, col);
  return x > -tw && x < size + tw && y > -th && y < size + wallH + th;
}

function isWall(row, col) {
  return state.floor.wallSet.has(key(row, col));
}

// Walls are never lit themselves (the light stops at them), so a wall
// shows once any floor beside it, corners included, has been seen.
function wallShown(row, col) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= state.floor.GRID_SIZE || c >= state.floor.GRID_SIZE) continue;
      if (!isWall(r, c) && look.fogOf(r, c) !== 'hidden') return true;
    }
  }
  return false;
}

// How bright a floor tile is, from 0 to 1: fading over the player's own
// light, a middle level where only the boss's light shows it, dim where
// only remembered.
function floorLevel(row, col) {
  const fog = look.fogOf(row, col);
  if (fog === 'hidden') return 0;
  if (fog === 'dim') return REMEMBERED_LEVEL;
  if (!state.settings.fogEnabled) return 1;
  if (!state.floor.sightSet.has(key(row, col))) return BOSS_LIT_LEVEL;
  const steps = Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol));
  return LIGHT_FALLOFF[Math.min(steps, LIGHT_FALLOFF.length - 1)];
}

// A wall is as bright as the brightest floor beside it.
function wallLevel(row, col) {
  let level = WALL_MIN_LEVEL;
  for (const [dr, dc] of Object.values(FACING_VECTORS)) {
    if (!isWall(row + dr, col + dc)) level = Math.max(level, floorLevel(row + dr, col + dc));
  }
  return level;
}

// A phosphor colour at strength `a`.
function glow(a) {
  return 'rgba(' + look.colours.glowRgb + ', ' + a + ')';
}

// Sets a glowing line style at strength `a`, with a blur (a share of a tile).
function strokeGlow(ctx, a, blur) {
  ctx.strokeStyle = glow(a);
  ctx.shadowColor = glow(Math.min(0.8, a));
  ctx.shadowBlur = blur * tw;
}

// The four corners of a tile's diamond, shrunk by `inset` (0..0.5).
function diamond(row, col, inset = 0) {
  const [cx, cy] = centre(row, col);
  const hw = tw / 2 * (1 - 2 * inset);
  const hh = th / 2 * (1 - 2 * inset);
  return { T: [cx, cy - hh], R: [cx + hw, cy], B: [cx, cy + hh], L: [cx - hw, cy], cx, cy };
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// A point raised `h` pixels straight up the screen.
function up(p, h) {
  return [p[0], p[1] - h];
}

// One floor diamond: a faint checkerboard fill and a phosphor edge, blue
// where the boss's light lies on it.
function drawFloor(ctx, row, col) {
  const level = floorLevel(row, col);
  const d = diamond(row, col, 0.02);
  const checker = (row + col) % 2 ? 0.1 : 0.08;
  poly(ctx, [d.T, d.R, d.B, d.L]);
  ctx.fillStyle = glow(checker * level * level + 0.012);
  ctx.fill();
  const bossLit = state.floor.bossLitSet.has(key(row, col));
  ctx.strokeStyle = bossLit
    ? 'rgba(' + look.colours.bossLightRgb + ', ' + (0.25 + 0.35 * level) + ')'
    : glow(0.1 + 0.5 * level);
  ctx.lineWidth = EDGE_WIDTH * tw * 0.8;
  ctx.stroke();
}

// A wall block. Its top edges shared with a neighbouring wall are left
// out, so a run of wall reads as one ridge, and a face with a wall in
// front of it isn't drawn.
function drawWall(ctx, row, col) {
  const joined = (dr, dc) => isWall(row + dr, col + dc) && wallShown(row + dr, col + dc);
  drawBlock(ctx, row, col, {
    inset: 0, height: wallH, level: wallLevel(row, col),
    southHidden: joined(1, 0), eastHidden: joined(0, 1),
    ridge: { n: !joined(-1, 0), e: !joined(0, 1), s: !joined(1, 0), w: !joined(0, -1) },
  });
}

// A pillar: a thin block a little taller than the walls.
function drawPillar(ctx, row, col) {
  drawBlock(ctx, row, col, {
    inset: PILLAR_INSET, height: wallH * PILLAR_HEIGHT, level: Math.max(WALL_MIN_LEVEL, floorLevel(row, col)),
  });
}

// A block standing on a tile: a wall, pillar or box. Its faces are
// opaque, so whatever stands behind it is hidden; only its edges glow.
// Options: inset (0..0.5), height in pixels, level (0..1), southHidden /
// eastHidden (a face with a wall in front of it), ridge (which top edges
// to draw: n, e, s, w; all by default).
function drawBlock(ctx, row, col, { inset, height, level, southHidden = false, eastHidden = false, ridge }) {
  const d = diamond(row, col, inset);
  const T = up(d.T, height);
  const R = up(d.R, height);
  const B = up(d.B, height);
  const L = up(d.L, height);
  const edges = ridge || { n: true, e: true, s: true, w: true };
  ctx.save();
  if (!southHidden) {
    poly(ctx, [d.L, d.B, B, L]);
    ctx.fillStyle = SOUTH_FACE;
    ctx.fill();
  }
  if (!eastHidden) {
    poly(ctx, [d.B, d.R, R, B]);
    ctx.fillStyle = EAST_FACE;
    ctx.fill();
  }
  poly(ctx, [T, R, B, L]);
  ctx.fillStyle = 'rgb(' + Math.round(14 + 10 * level) + ', ' + Math.round(18 + 12 * level) + ', ' + Math.round(19 + 12 * level) + ')';
  ctx.fill();
  ctx.lineWidth = EDGE_WIDTH * tw;
  strokeGlow(ctx, 0.85 * level, RIDGE_BLUR * level);
  if (edges.n) line(ctx, T, R);
  if (edges.e) line(ctx, R, B);
  if (edges.s) line(ctx, B, L);
  if (edges.w) line(ctx, L, T);
  // The upright corners, and the foot of each face that shows.
  strokeGlow(ctx, 0.5 * level, FACE_BLUR * level);
  if (!southHidden || !eastHidden) line(ctx, d.B, B);
  if (!southHidden) line(ctx, d.L, L);
  if (!eastHidden) line(ctx, d.R, R);
  strokeGlow(ctx, 0.3 * level, 0);
  if (!southHidden) line(ctx, d.L, d.B);
  if (!eastHidden) line(ctx, d.B, d.R);
  ctx.restore();
}

// The stairs down: diamonds sinking into the floor, glowing and pulsing.
// Drawn even on floor the player hasn't seen: they're the way out.
function drawStairs(ctx, at) {
  look.keepMoving();
  const strength = 0.7 + 0.3 * look.pulse(MAP_ANIMATION_MS.glow);
  ctx.save();
  ctx.lineWidth = EDGE_WIDTH * tw;
  for (let i = 0; i < STAIR_STEPS; i++) {
    const d = diamond(at.row, at.col, STAIR_INSET[0] + i * STAIR_INSET[1]);
    const drop = i * STAIR_DROP * th;
    poly(ctx, [d.T, d.R, d.B, d.L].map(p => [p[0], p[1] + drop]));
    ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.25 + i * 0.18) + ')';
    ctx.fill();
    strokeGlow(ctx, (0.95 - i * 0.18) * strength, RIDGE_BLUR * 1.4 - i * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

// A paper the player has made out, lying flat on its tile with three
// lines of writing.
function drawPaper(ctx, at) {
  const [cx, cy] = centre(at.row, at.col);
  const level = floorLevel(at.row, at.col) * (searched(at) ? SEARCHED_LEVEL : 1);
  const p = ([u, v]) => [cx + (u - v) * tw * PAPER_SCALE, cy + (u + v) * th * PAPER_SCALE];
  ctx.save();
  poly(ctx, PAPER_SHEET.map(p));
  ctx.fillStyle = glow(0.16 * level);
  ctx.fill();
  ctx.lineWidth = EDGE_WIDTH * tw * 0.8;
  strokeGlow(ctx, 0.8 * level, FACE_BLUR);
  ctx.stroke();
  strokeGlow(ctx, 0.45 * level, 0);
  PAPER_LINES.forEach(v => line(ctx, p([-0.5, v - 0.05]), p([0.5, v - 0.15])));
  ctx.restore();
}

// Whether the paper or box on a tile has already been searched.
function searched(at) {
  const prop = state.floor.props.find(p => p.row === at.row && p.col === at.col);
  return Boolean(prop && prop.searched);
}

// The wedge on the floor pointing where the player faces. The top-down
// arrows (^ v < >) would point the wrong way on a diamond.
function drawFacing(ctx, at) {
  const [cx, cy] = centre(at.row, at.col);
  const [fr, fc] = FACING_VECTORS[state.floor.facing];
  const dx = (fc - fr) * tw / 2;
  const dy = (fc + fr) * th / 2;
  const tip = [cx + dx * 0.62, cy + dy * 0.62];
  const baseL = [cx + dx * 0.28 - dy * 0.5, cy + dy * 0.28 + dx * 0.12];
  const baseR = [cx + dx * 0.28 + dy * 0.5, cy + dy * 0.28 - dx * 0.12];
  poly(ctx, [tip, baseL, baseR]);
  ctx.fillStyle = glow(0.5);
  ctx.fill();
}

// A dark wedge thrown away from the player by each pillar in their light:
// the shape of the tiles the pillar keeps dark.
function drawPillarShadows(ctx, tiles) {
  const f = state.floor;
  tiles.forEach(({ row, col }) => {
    if (!f.pillarSet.has(key(row, col)) || !f.sightSet.has(key(row, col))) return;
    const dr = row - f.playerRow;
    const dc = col - f.playerCol;
    const length = Math.hypot(dr, dc);
    if (!length || Math.max(Math.abs(dr), Math.abs(dc)) > PLAYER_CONE_RANGE) return;
    const [px, py] = centre(row, col);
    const [sx, sy] = centre(row + dr / length * PILLAR_SHADOW, col + dc / length * PILLAR_SHADOW);
    // Across the shadow, on screen.
    const run = Math.hypot(sx - px, sy - py) || 1;
    const nx = -(sy - py) / run;
    const ny = (sx - px) / run;
    const near = tw * PILLAR_SHADOW_WIDTH;
    const far = near * 1.8;
    const g = ctx.createLinearGradient(px, py, sx, sy);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    poly(ctx, [[px - nx * near, py - ny * near], [px + nx * near, py + ny * near], [sx + nx * far, sy + ny * far], [sx - nx * far, sy - ny * far]]);
    ctx.fill();
  });
}

// Light added over the floor: a pale pool round the player, and the boss
// mist drifting on the floor it has reached.
function drawLight(ctx, tiles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(originX, originY);
  ctx.scale(1, th / tw);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, tw * POOL_RADIUS);
  g.addColorStop(0, glow(0.2));
  g.addColorStop(0.5, glow(0.08));
  g.addColorStop(1, glow(0));
  ctx.fillStyle = g;
  ctx.fillRect(-tw * POOL_RADIUS, -tw * POOL_RADIUS, tw * POOL_RADIUS * 2, tw * POOL_RADIUS * 2);
  ctx.restore();
  const w = tw * MIST_WIDTH;
  const h = w * MIST_SQUASH;
  tiles.forEach(({ row, col }) => {
    const strength = look.mistStrength(row, col);
    if (!strength) return;
    const [cx, cy] = centre(row, col);
    ctx.globalAlpha = strength;
    ctx.drawImage(look.mistSprite, cx - w / 2, cy - h / 2, w, h);
  });
  ctx.restore();
}

// Where a standing glyph's middle goes above its tile, in pixels.
function glyphPlace(thing) {
  const [cx, cy] = centre(thing.at.row, thing.at.col);
  const glyphSize = tw * GLYPH_CELL * MAP_GLYPH_SIZES[thing.look.size];
  return [cx, cy - glyphSize * GLYPH_RISE - (thing.look.lift || 0) * tw];
}

// Something standing on the floor: a box the player has made out, or a
// glyph upright on a small contact shadow. The player shows as the
// player's symbol; the facing wedge on the floor says which way they face.
function drawStanding(ctx, thing) {
  const { at } = thing;
  if (thing.kind === 'box' && thing.glyph !== null) {
    const level = floorLevel(at.row, at.col) * (searched(at) ? SEARCHED_LEVEL : 1);
    drawBlock(ctx, at.row, at.col, { inset: BOX_INSET, height: tw * BOX_HEIGHT, level: Math.max(WALL_MIN_LEVEL, level) });
    return;
  }
  const [cx, cy] = centre(at.row, at.col);
  ctx.save();
  ctx.globalAlpha = thing.look.alpha === undefined ? 1 : thing.look.alpha;
  ctx.beginPath();
  ctx.ellipse(cx, cy, tw / 2 * CONTACT_SHADOW * 2, th / 2 * CONTACT_SHADOW * 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();
  const glyph = thing.kind === 'player' ? t('term.player.symbol') : thing.glyph;
  const [x, y] = glyphPlace(thing);
  look.paintGlyph(ctx, tw * GLYPH_CELL, x, y, glyph, thing.look);
}

// Until walls in front of the camera are cut away (isometric step 3), a
// wall can stand between the camera and the player. When one does, the
// player's glyph is traced over it as a glowing outline, so they are
// never lost.
function drawPlayerTrace(ctx, tiles) {
  const player = look.things.find(thing => thing.kind === 'player');
  const [x, y] = glyphPlace(player);
  const glyphSize = tw * GLYPH_CELL * MAP_GLYPH_SIZES.player;
  const box = [x - glyphSize * 0.3, y - glyphSize / 2, x + glyphSize * 0.3, y + glyphSize / 2];
  const depth = player.at.row + player.at.col;
  const covered = tiles.some(({ row, col }) => {
    if (row + col <= depth || !isWall(row, col) || !wallShown(row, col)) return false;
    const [cx, cy] = centre(row, col);
    const wall = [cx - tw / 2, cy - th / 2 - wallH, cx + tw / 2, cy + th / 2];
    return wall[0] < box[2] && box[0] < wall[2] && wall[1] < box[3] && box[1] < wall[3];
  });
  if (!covered) return;
  ctx.save();
  ctx.font = Math.round(glyphSize) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = EDGE_WIDTH * tw * 1.1;
  strokeGlow(ctx, 0.95, RIDGE_BLUR * 1.6);
  ctx.strokeText(t('term.player.symbol'), x, y);
  ctx.restore();
}

// The pulsing diamond round whatever the battle screen is fighting.
function drawTarget(ctx) {
  const target = state.battle.selectedTarget;
  if (!target || target.row === undefined || !onScreen(target.row, target.col)) return;
  look.keepMoving();
  const d = diamond(target.row, target.col, 0.04);
  ctx.save();
  ctx.globalAlpha = TARGET_PULSE[0] + (TARGET_PULSE[1] - TARGET_PULSE[0]) * look.pulse(MAP_ANIMATION_MS.target);
  ctx.lineWidth = EDGE_WIDTH * tw * 2;
  ctx.strokeStyle = look.colours.bright;
  ctx.shadowColor = glow(0.5);
  ctx.shadowBlur = RIDGE_BLUR * tw;
  poly(ctx, [d.T, d.R, d.B, d.L]);
  ctx.stroke();
  ctx.restore();
}
