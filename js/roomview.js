// The room view (room view plan, `ideas/room-view-plan.md` outside the
// repo): a fixed camera looking down on one room at a time at the angle
// of the RPG Maker horror games, drawn as pixel art. Back walls show their
// face, the floor runs toward the player, and the dark round the room is
// black. Built beside the shoulder view behind ?view=room until step G.
//
// Step A draws the walls (faces, the rim round each room), the floors, the
// light and the player's stick man. Step B draws the things on the floor
// as pictures (ROOM_DRAWINGS): boxes, energy cells, papers, grates, the
// reflective desk and its warm pool, relays, the chest, the coin, keys, the
// stairs and their column of light, the boss's mist, a mistake's sound and
// the letters a downed stick man drops. The rest stay glyphs until steps C
// and D. Step C draws the stick men (stickforms.js) at the canvas's own
// size over the picture, so their lines glow crisp and their tendrils'
// letters read, and redraws what stands in front of each over it, so they
// walk behind desks and crates too; their eyes, heard '!', maim ring, and a
// cold mark at the edge for one in sight but off screen. Step D, with the
// gun on: the stick man holds it the way the light points (raised while a
// shot waits, kicked back on a shot), the tiles it reaches lit faintly,
// corner brackets on what can be shot and the breathing target, a dashed
// laser to the target's chest, the shot's flash and ring or MISS (the last
// shot from mapshared.js), the answer ring after a miss (swirl.js), and
// the tutorial's ring of words. The picture is drawn at ROOM_VIEW.tilePx a tile into a small
// canvas, lit there, and scaled up by a whole number with smoothing off.
// What gives off its own light (a key, the stairs' column, the desk's
// pool, a cell's breath, the mist, a sound) is added after the lighting,
// so it shows in the dark the way the rules let it.
//
// The light is the rules' light, not its own: lit tiles are the floor's
// visibleSet, remembered ones its exploredSet (sight.js). On top of that,
// the room the player is in shows dimly, so they see its shape. Each tile
// gets one level; a tiny canvas of those levels is scaled up smoothly and
// multiplied over the picture, so the light's edges are soft.
//
// mapview.js calls drawRoomScene() from its drawScene when roomViewWanted(),
// and roomTileAt() / roomGridAt() to turn a tap into a tile or a floor
// point. faceOf, viewScale, cameraGoal and ROOM_DRAWINGS are exported for
// the tests.
// Reads state and never changes it.

import { state, key } from './state.js';
import {
  ROOM_VIEW, PLAYER_CONE_RANGE, MAP_GLYPH_SIZES, ISO_TILES_ACROSS, ISO_TILES_ACROSS_NARROW,
  ISO_NARROW_MAP_WIDTH, PLAYER_GLANCE, PLAYER_EMBER, MAP_ANIMATION_MS, ENEMY_LIGHT, MINION_KINDS, ANSWER_RING,
} from './config.js';
import { lookAngle, wrapAngle } from './look.js';
import { playerPose, playerActive, resetPlayerForm, emberGlow } from './playerform.js';
import {
  searched, DRUM_BREATH, DRUM_BREATH_REACH, DESK_GLOW, DESK_GLOW_RADIUS, STAIR_BEAM_LAYERS, STAIR_BEAM_FADE,
  SOUND_INSET, SOUND_LEVEL, GRATE_RATTLE_SWAYS,
} from './mapshared.js';
import { drawDroppedLetters, drawStickForm, stickBox, dyingSticks } from './stickforms.js';
import {
  minionOn, eyeOf, EYE_LIFT, EYE_WIDTH, HEARD_LIFT, WEAK_RING, WEAK_RING_LEVEL, inReach, liveTarget, lastShot,
  recoilAt, darkRingAt, answerRingLetters, REACH_FILL, BRACKET_ARM, BRACKET_HALF, BRACKET_LEVEL, BRACKET_PULSE,
  BRACKET_TEXT_SIZE, BRACKET_HP_GAP, LASER_LEVEL, SHOT_RING, MISS_TEXT_SIZE, MISS_RISE, ISO_STICK_HEIGHT,
} from './mapshared.js';
import { canShoot } from './sight.js';
import { answerRingNow } from './swirl.js';
import { t } from './text.js';

const T = ROOM_VIEW.tilePx;
const ENEMY_KINDS = ['minion', 'hunter']; // what a tap on its glyph picks (gun.js pickTarget)

// The picture's colours: the floors (wood planks, lino squares, carpet,
// small tiles, stone flags) and each room's look (step E): its floor and
// its wallpaper, by the room's name on a fixed plan. A room without one
// (a random floor, a rest) is wood with the plain paper; hallways are lino.
const WOOD = { base: '#4a3427', light: '#4f3829', dark: '#463124', seam: '#2f2118', knot: '#5a4130' };
const LINO = { a: '#4f5357', b: '#43474b', scuff: '#35383b' };
const CARPET = { base: '#3c2a3b', weave: '#45313f', edge: '#4c3547' };
const TILE = { a: '#8a8f8d', b: '#7d8280', grout: '#5f6361' };
const STONE = { base: '#56524c', light: '#5f5b54', crack: '#403d38' };
const PAPER = { room: ['#5f5560', '#685d69'], hall: ['#565b62', '#5e646b'] };
const ROOM_LOOK = { floor: 'wood', paper: PAPER.room };
const HALL_LOOK = { floor: 'lino', paper: PAPER.hall };
const ROOM_LOOKS = {
  'plan.school.examHall': { floor: 'wood', paper: ['#4f4a44', '#58524b'] },
  'plan.school.frontHall': { floor: 'stone', paper: ['#57534d', '#605b55'] },
  'plan.school.lab': { floor: 'tile', paper: ['#5d6763', '#66716c'] },
  'plan.school.library': { floor: 'carpet', paper: ['#5b4a5a', '#644f62'] },
  'plan.school.artRoom': { floor: 'wood', paper: ['#6b5f4e', '#756856'] },
  'plan.school.class1': { floor: 'wood', paper: ['#5f6656', '#68705e'] },
  'plan.school.class2': { floor: 'wood', paper: ['#5f6656', '#68705e'] },
  'plan.school.toilets': { floor: 'tile', paper: ['#5a6a6e', '#637478'] },
  'plan.school.staffRoom': { floor: 'carpet', paper: ['#5e5040', '#685948'] },
};
const CROWN = ['#2b2230', '#3d3343'];          // the dark moulding along a wall's top, and its light edge
const SKIRTING = ['#3a2c26', '#4c3b32'];       // the board along a wall's foot, and its light edge
const RIM = ['#463c4f', '#5c516a'];            // the band round a room, and its light edge
const RIM_WIDTH = 4;                           // in the picture's pixels
const PILLAR = { body: '#4a4652', light: '#5a5662', dark: '#38343f', top: '#625d6b', rise: 1.5 };
// The tints of the light: the player's own light is the phosphor's cool
// white, the dim room and memory a touch violet.
const LIT_TINT = [228, 240, 244];
const DIM_TINT = [244, 236, 255];
// The player's stick man, drawn in the picture's pixels.
const STICK_LINE = 1;
const HEAD_SHARE = 0.12;         // the head's radius, a share of his height
const POSE_SCALE = ROOM_VIEW.stickHeight / 0.75; // playerform's poses are sized for a 0.75-tile stick man

// How each kind of thing is drawn (step B; tests/roomview.test.mjs checks
// every kind the game puts on the map has one): 'flat' lies on the floor
// under everything, 'stand' stands on its tile and is sorted with the
// stick men, 'form' is a stick man (stickforms.js, step C), 'glyph' stays
// its glyph over the picture (the hunter, the boss and THE UNFOLDING, as
// in the shoulder view), 'player' is the player's stick man. A thing not
// made out yet is a pixel '?' that stands like a prop, except the stairs
// and a grate (drawn as they are) and enemies (never shown as a '?').
export const ROOM_DRAWINGS = {
  paper: 'flat', vent: 'flat', stairs: 'flat',
  box: 'stand', furniture: 'stand', cell: 'stand', desk: 'stand', relay: 'stand', chest: 'stand', coin: 'stand', key: 'stand',
  minion: 'form', exchange: 'glyph', boss: 'glyph', hunter: 'glyph', player: 'player',
};
// The things' colours, in the picture's pixels.
const CRATE = { top: '#86663f', front: '#6b4f36', plank: '#4a3524', post: '#55402b', inside: '#1c140e' };
const CELL = { body: '#3b4650', light: '#4d5a66', shade: '#2c353d', band: '#262d34', lid: '#5a6874', dead: '#1a1e22' };
const SHEET = { fresh: '#d2cbbb', read: '#a8a294', ink: '#8a8476' };
const GRATE = { frame: '#2a2e32', edge: '#5d656c', bar: '#50575d', seal: '#8b939a', sway: 2 }; // sway: how far it shudders, in picture pixels
const DESK = { top: '#6e4d33', front: '#523a27', frame: '#4a3a30', glass: '#8fa3ad', shine: '#c9d6dc', dull: '#3a4448' };
const RELAY = { body: '#4a5058', seam: '#33383e', dead: '#2a2e32', leg: '#2e3236' };
const CHEST = { lid: '#5a3d2c', lidLight: '#6e4b36', body: '#4a3224', band: '#2e211a', lock: '#b49a6a' };
const COIN = { face: '#d8b45a', shine: '#f3dc8e', rgb: '216, 180, 90' };
const KEY = { metal: '#dfe8ea', glow: 0.7 };   // glow: its light at the brightest of its pulse, as a share of the pulse's strength
const STAIRS = ['#3a3540', '#25212b', '#16131a', '#0a090c']; // each step down darker
const STAIR_EDGE = '#5a5464';
const BEAM_RISE = 2.6;          // the stairs' column of light, in tiles above the floor
const MIST_GLOW = 0.22;         // the boss's mist at full strength over a tile
const BREATH_GLOW = 2;          // a cell's breath is this many times its shoulder view strength (smaller here)
// The '?' of a thing not made out yet, as rows of picture pixels.
const UNKNOWN = [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '];
const UNKNOWN_GLOW = 0.5;       // it shows this strongly over the dark, so a lit one reads
// The stick men's glowing lines: halo layers (width a share of the line,
// strength) under the core line, as in the shoulder view.
const HALO_LAYERS = [{ width: 3.5, strength: 0.07 }, { width: 1.6, strength: 0.14 }];
const EDGE_MARK = 0.22;         // the cold mark for a stick man off screen, as a share of a tile
// The gun in the player's hand (step D), as shares of his height: how far
// ahead and to his right his hand holds it, how high, its length, its
// grip, how far it lifts while a shot waits and kicks back on a shot.
const GUN = { ahead: 0.2, side: 0.08, height: 0.5, length: 0.3, grip: 0.08, raise: 0.06, kick: 0.08 };
const GUN_COLOUR = '#c8d2d6';
const SHOT_AT = 0.55;            // a shot goes to this share of a stick man's height
const LASER_DASH = [5, 4];      // its dash and gap, in line widths
const DARK_RING = { lift: 0.5, size: 0.3 }; // the tutorial's ring of words: how high it floats and its letters' size, in tiles

let look = null;          // what mapview.js hands each frame (see drawRoomScene)
let built = null;         // this floor's still picture and what it was built from
let buf = null;           // the picture at its own size, then lit
let bctx = null;
let lights = null;        // the light, one pixel a tile
let lctx = null;
let glow = null;          // the light at the picture's size
let gctx = null;
let scale = 1;            // canvas pixels per picture pixel
let pageScale = 1;        // canvas pixels per CSS pixel
let shownCam = null;      // the camera's top-left in picture pixels, gliding toward its goal
let shownFloor = null;    // the floor the camera was last on (a new one snaps it)
let lastFrameAt = 0;
let poseLook = null;      // the light's angle at the last frame, so a turn stops his glances
let tapBoxes = [];        // this frame's enemies, for taps: [{ box: [left, top, right, bottom], tile }]
let mask = null;          // what stands in front of a stick man, redrawn over it (redrawInFront)
let mctx = null;
let view = { w: 0, h: 0 }; // the picture's size this frame
let muzzle = null;        // the gun's muzzle this frame in picture pixels, or null with no gun drawn
let frame = { ox: 0, oy: 0 }; // the camera's top-left this frame, in picture pixels

// True when the page asked for the room view (?view=room).
export function roomViewWanted() {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('view') === 'room';
}

// What a wall tile at (row, col) shows, given `wall(row, col)`: 'lower'
// for the face just above floor, 'upper' for the one above that (faces are
// ROOM_VIEW.faceRows tall at most, and only over wall), else null (a rim
// or the dark). Floor is never a face.
export function faceOf(row, col, wall) {
  if (!wall(row, col)) return null;
  if (!wall(row + 1, col)) return 'lower';
  if (ROOM_VIEW.faceRows > 1 && wall(row + 1, col) && !wall(row + 2, col)) return 'upper';
  return null;
}

// How many canvas pixels each picture pixel takes on a canvas `w` by `h`:
// the biggest whole number that still shows ROOM_VIEW.minAcross tiles
// across (minAcrossTall on a map taller than wide) and minDown down, and
// at least 1.
export function viewScale(w, h) {
  const across = h > w ? ROOM_VIEW.minAcrossTall : ROOM_VIEW.minAcross;
  return Math.max(1, Math.floor(Math.min(w / (T * across), h / (T * ROOM_VIEW.minDown))));
}

// Where the camera's top-left wants to be, in picture pixels, for a view
// `viewW` by `viewH` and the player's middle at `at` ({ x, y } pixels): a
// space that fits (`bounds` { x0, y0, x1, y1 }) is framed in the middle;
// one that doesn't follows the player without showing past its edge; with
// no bounds (a hallway) the player stays in the middle.
export function cameraGoal(bounds, at, viewW, viewH) {
  const axis = (lo, hi, p, size) => {
    if (!bounds) return p - size / 2;
    if (hi - lo <= size) return (lo + hi) / 2 - size / 2;
    return Math.min(Math.max(p - size / 2, lo), hi - size);
  };
  return {
    x: axis(bounds && bounds.x0, bounds && bounds.x1, at.x, viewW),
    y: axis(bounds && bounds.y0, bounds && bounds.y1, at.y, viewH),
  };
}

// Draws the whole map from the room camera. `canvasSize` is { width,
// height, pageWidth }; `shared` is what mapview.js hands it (colours,
// things, fogOf, paintGlyph, keepMoving, showPlain, now, still, walkAt).
export function drawRoomScene(ctx, canvasSize, shared) {
  look = shared;
  const f = state.floor;
  if (!built || built.floor !== f || built.entered !== state.run.floorsEntered || built.walls !== f.wallSet || built.pillars !== f.pillarSet) built = buildFloor(f);
  if (shownFloor !== state.run.floorsEntered) {
    resetPlayerForm();
    shownCam = null;
    shownFloor = state.run.floorsEntered;
  }
  pageScale = canvasSize.pageWidth ? canvasSize.width / canvasSize.pageWidth : 1;
  scale = viewScale(canvasSize.width, canvasSize.height);
  const viewW = Math.ceil(canvasSize.width / scale);
  const viewH = Math.ceil(canvasSize.height / scale);
  sizeCanvases(viewW, viewH);
  view = { w: viewW, h: viewH };

  const at = look.walkAt;
  const space = spaceOf(f.playerRow, f.playerCol);
  const goal = cameraGoal(space.bounds, { x: (at.col + 0.5) * T, y: (at.row + 0.5) * T }, viewW, viewH);
  if (moveCamera(goal) || at.row !== f.playerRow || at.col !== f.playerCol) look.showPlain();
  const ox = Math.round(shownCam.x);
  const oy = Math.round(shownCam.y);
  frame = { ox, oy };
  muzzle = null;

  // The picture: the still floor, then what stands on it, back to front.
  bctx.globalCompositeOperation = 'source-over';
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, viewW, viewH);
  bctx.drawImage(built.world, ox, oy, viewW, viewH, 0, 0, viewW, viewH);
  const items = [];
  const c0 = Math.floor(ox / T) - 1, c1 = Math.ceil((ox + viewW) / T) + 1;
  const r0 = Math.floor(oy / T) - 1, r1 = Math.ceil((oy + viewH) / T) + 2;
  const inView = (row, col) => row >= r0 && row <= r1 && col >= c0 && col <= c1;
  f.pillarSet.forEach(k => {
    const [row, col] = tileOf(k);
    if (inView(row, col)) items.push({ y: row + 1, row, col, draw: () => drawPillar(row, col, ox, oy) });
  });
  const glows = [];
  look.things.forEach(thing => {
    const drawing = drawingOf(thing);
    if (!inView(Math.round(thing.at.row), Math.round(thing.at.col))) return;
    const x = Math.round(thing.at.col * T) - ox;
    const y = Math.round(thing.at.row * T) - oy;
    if (drawing === 'flat') FLAT[thing.kind](thing, x, y, glows);
    const { row, col } = thing.tile;
    if (drawing === 'stand') items.push({ y: thing.at.row + 1, row, col, draw: () => STAND[thing.kind](thing, x, y, glows) });
    if (drawing === 'unknown') items.push({ y: thing.at.row + 1, row, col, draw: () => drawUnknown(x, y, glows) });
  });
  // The tutorial's light from above falls in a column like the stairs' light.
  const tut = f.tutorial;
  if (tut && f.spotSet.size && inView(tut.spot.row, tut.spot.col)) glows.push(() => drawBeam((tut.spot.col + 0.5) * T - ox, (tut.spot.row + 0.7) * T - oy));
  items.push({ y: at.row + ROOM_VIEW.footAt + 0.01, draw: () => drawStickMan(at, ox, oy) });
  items.sort((a, b) => a.y - b.y).forEach(item => item.draw());
  const standing = items.filter(item => item.row !== undefined);

  // The light, multiplied over it.
  lightTiles(space, at, c0, r0, c1 - c0 + 1, r1 - r0 + 1);
  gctx.globalCompositeOperation = 'source-over';
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, viewW, viewH);
  gctx.imageSmoothingEnabled = true;
  gctx.drawImage(lights, 0, 0, c1 - c0 + 1, r1 - r0 + 1, c0 * T - ox, r0 * T - oy, (c1 - c0 + 1) * T, (r1 - r0 + 1) * T);
  gctx.globalCompositeOperation = 'lighter';
  const head = { x: (at.col + 0.5) * T - ox, y: (at.row + ROOM_VIEW.footAt - ROOM_VIEW.stickHeight * 0.85) * T - oy };
  const g = gctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, ROOM_VIEW.ember.radius * T);
  g.addColorStop(0, 'rgba(' + look.colours.glowRgb + ', ' + ROOM_VIEW.ember.level + ')');
  g.addColorStop(1, 'rgba(' + look.colours.glowRgb + ', 0)');
  gctx.fillStyle = g;
  gctx.fillRect(head.x - ROOM_VIEW.ember.radius * T, head.y - ROOM_VIEW.ember.radius * T, ROOM_VIEW.ember.radius * T * 2, ROOM_VIEW.ember.radius * T * 2);
  bctx.globalCompositeOperation = 'multiply';
  bctx.drawImage(glow, 0, 0);
  // What gives off its own light, over the lit picture.
  bctx.globalCompositeOperation = 'lighter';
  glows.forEach(draw => draw());
  drawMist(c0, r0, c1, r1, ox, oy);
  drawSounds(ox, oy);
  if (state.settings.gunCombat) drawReach(c0, r0, c1, r1, ox, oy);
  bctx.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, viewW, viewH, 0, 0, viewW * scale, viewH * scale);
  ctx.imageSmoothingEnabled = true;
  const ring = answerRingNow(look.now);
  if (ring) drawAnswerRing(ctx, ring, false);
  const formBoxes = drawForms(ctx, ox, oy, standing);
  drawGlyphs(ctx, ox, oy);
  tapBoxes = [...formBoxes, ...tapBoxes];
  if (ring) drawAnswerRing(ctx, ring, true);
  if (state.settings.gunCombat) {
    drawBrackets(ctx);
    drawLaser(ctx);
    drawShot(ctx);
  }
  drawDarkRing(ctx);
  drawEdgeMarks(ctx, ox, oy);
}

// The tile under a tap at (px, py) CSS pixels from the map's top-left: an
// enemy whose glyph is under it first, else the floor tile there; null
// before the first frame.
export function roomTileAt(px, py) {
  if (!shownCam) return null;
  const x = px * pageScale;
  const y = py * pageScale;
  const hit = tapBoxes.find(({ box }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]);
  if (hit) return { row: hit.tile.row, col: hit.tile.col };
  const at = roomGridAt(px, py);
  return at && { row: Math.round(at.row), col: Math.round(at.col) };
}

// The floor point under a tap at (px, py) CSS pixels, in grid terms with
// a tile's middle at whole numbers (as the shoulder view gives it), or
// null before the first frame.
export function roomGridAt(px, py) {
  if (!shownCam) return null;
  const x = px * pageScale / scale + Math.round(shownCam.x);
  const y = py * pageScale / scale + Math.round(shownCam.y);
  return { row: y / T - 0.5, col: x / T - 0.5 };
}

// ---- the floor's still picture ----

// The row and column of a tile key (state.js key).
function tileOf(k) {
  return k.split(',').map(Number);
}

function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

// The floor's walls, floors and rims drawn once, and its rooms' extents.
function buildFloor(f) {
  const world = document.createElement('canvas');
  world.width = world.height = f.GRID_SIZE * T;
  const ctx = world.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, world.width, world.height);
  const rooms = new Map();
  f.chamberAt.forEach((i, k) => {
    const [row, col] = tileOf(k);
    const r = rooms.get(i) || { r0: row, r1: row, c0: col, c1: col };
    rooms.set(i, { r0: Math.min(r.r0, row), r1: Math.max(r.r1, row), c0: Math.min(r.c0, col), c1: Math.max(r.c1, col) });
  });
  for (let row = 0; row < f.GRID_SIZE; row++) {
    for (let col = 0; col < f.GRID_SIZE; col++) {
      if (!isWall(row, col)) drawFloorTile(ctx, row, col, lookAt(row, col));
      else {
        const face = faceOf(row, col, isWall);
        if (face) drawFace(ctx, row, col, face, lookAt(row + (face === 'lower' ? 1 : 2), col));
      }
    }
  }
  for (let row = 0; row < f.GRID_SIZE; row++) {
    for (let col = 0; col < f.GRID_SIZE; col++) if (isWall(row, col) && !faceOf(row, col, isWall)) drawRim(ctx, row, col);
  }
  return { floor: f, entered: state.run.floorsEntered, walls: f.wallSet, pillars: f.pillarSet, world, rooms };
}

// A tile's own number from 0 to 1, the same every time, for the grain of
// wood and the scuffs on the lino. Never Math.random (the seeded tests own it).
function grain(row, col, n) {
  let h = (row * 374761393 + col * 668265263 + n * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The look of the floor at (row, col): its room's (ROOM_LOOKS by the
// room's name on a fixed plan), any other room's, or a hallway's.
function lookAt(row, col) {
  const room = state.floor.chamberAt.get(key(row, col));
  if (room === undefined) return HALL_LOOK;
  return ROOM_LOOKS[state.floor.chamberNames[room]] || ROOM_LOOK;
}

// One floor tile in its look's floor: planks of wood, lino in squares,
// carpet, small tiles or stone flags, each tile a little different.
function drawFloorTile(ctx, row, col, look) {
  const x = col * T, y = row * T;
  const floor = look.floor;
  if (floor === 'wood') {
    ctx.fillStyle = WOOD.base;
    ctx.fillRect(x, y, T, T);
    for (let p = 0; p < 4; p++) {
      const py = y + p * 4;
      ctx.fillStyle = grain(row, col, p) > 0.5 ? WOOD.light : WOOD.dark;
      ctx.fillRect(x, py, T, 3);
      ctx.fillStyle = WOOD.seam;
      ctx.fillRect(x, py + 3, T, 1);
      if (grain(row, col, p + 20) > 0.45) ctx.fillRect(x + Math.floor(grain(row, col, p + 9) * T), py, 1, 3);
      if (grain(row, col, p + 30) > 0.7) {
        ctx.fillStyle = WOOD.knot;
        ctx.fillRect(x + Math.floor(grain(row, col, p + 40) * 14), py + 1, 2, 1);
      }
    }
    return;
  }
  if (floor === 'carpet') {
    ctx.fillStyle = CARPET.base;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = CARPET.weave;
    for (let i = 0; i < T; i += 2) for (let j = (i / 2) % 2; j < T; j += 4) ctx.fillRect(x + j, y + i, 1, 1);
    return;
  }
  if (floor === 'tile') {
    ctx.fillStyle = TILE.grout;
    ctx.fillRect(x, y, T, T);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 ? TILE.a : TILE.b;
        ctx.fillRect(x + i * 4, y + j * 4, 3, 3);
      }
    }
    return;
  }
  if (floor === 'stone') {
    ctx.fillStyle = STONE.base;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = STONE.light;
    ctx.fillRect(x + 1, y + 1, 14, 1);
    ctx.fillStyle = STONE.crack;
    ctx.fillRect(x, y + T - 1, T, 1);
    ctx.fillRect(x + T - 1, y, 1, T);
    if (grain(row, col, 5) > 0.6) ctx.fillRect(x + 4 + Math.floor(grain(row, col, 6) * 6), y + 5, 3, 1);
    return;
  }
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? LINO.a : LINO.b;
      ctx.fillRect(x + i * 8, y + j * 8, 8, 8);
    }
  }
  if (grain(row, col, 1) > 0.6) {
    ctx.fillStyle = LINO.scuff;
    ctx.fillRect(x + Math.floor(grain(row, col, 2) * 12), y + Math.floor(grain(row, col, 3) * 12), 3, 1);
  }
}

// A wall's face: its room's wallpaper with a small diamond print, the moulding along
// the top of an upper face, the skirting board along the foot of a lower
// one, and a post where a doorway cuts through beside it.
function drawFace(ctx, row, col, face, look) {
  const x = col * T, y = row * T;
  const paper = look.paper;
  ctx.fillStyle = paper[0];
  ctx.fillRect(x, y, T, T);
  ctx.fillStyle = paper[1];
  for (let i = 2; i < T; i += 6) {
    for (let j = (i + (face === 'upper' ? 0 : 2)) % 12 < 6 ? 2 : 5; j < T; j += 6) {
      ctx.fillRect(x + j, y + i, 1, 1);
      ctx.fillRect(x + j - 1, y + i + 1, 3, 1);
      ctx.fillRect(x + j, y + i + 2, 1, 1);
    }
  }
  if (face === 'upper' || !isWall(row - 1, col)) {
    ctx.fillStyle = CROWN[0];
    ctx.fillRect(x, y, T, 3);
    ctx.fillStyle = CROWN[1];
    ctx.fillRect(x, y + 3, T, 1);
  }
  if (face === 'lower') {
    ctx.fillStyle = SKIRTING[0];
    ctx.fillRect(x, y + T - 3, T, 3);
    ctx.fillStyle = SKIRTING[1];
    ctx.fillRect(x, y + T - 3, T, 1);
  }
  for (const [dc, px] of [[-1, 0], [1, T - 2]]) {
    if (!isWall(row, col + dc)) {
      ctx.fillStyle = SKIRTING[0];
      ctx.fillRect(x + px, y, 2, T);
    }
  }
}

// The dark band round a room, as in the picture: along each side of this
// wall tile that touches floor or a face, and in a corner where only the
// diagonal does.
function drawRim(ctx, row, col) {
  const x = col * T, y = row * T, B = RIM_WIDTH;
  const open = (r, c) => !isWall(r, c) || faceOf(r, c, isWall) !== null;
  const band = (bx, by, bw, bh, lx, ly, lw, lh) => {
    ctx.fillStyle = RIM[0];
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = RIM[1];
    ctx.fillRect(lx, ly, lw, lh);
  };
  if (open(row - 1, col)) band(x, y, T, B, x, y, T, 1);
  if (open(row + 1, col)) band(x, y + T - B, T, B, x, y + T - (faceOf(row + 1, col, isWall) ? B : 1), T, 1);
  if (open(row, col - 1)) band(x, y, B, T, x, y, 1, T);
  if (open(row, col + 1)) band(x + T - B, y, B, T, x + T - 1, y, 1, T);
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    if (!open(row + dr, col + dc) || open(row + dr, col) || open(row, col + dc)) continue;
    const cx = x + (dc < 0 ? 0 : T - B), cy = y + (dr < 0 ? 0 : T - B);
    band(cx, cy, B, B, cx + (dc < 0 ? 0 : B - 1), cy + (dr < 0 ? 0 : B - 1), 1, 1);
  }
}

// ---- each frame ----

function sizeCanvases(w, h) {
  if (!buf) {
    buf = document.createElement('canvas');
    bctx = buf.getContext('2d');
    glow = document.createElement('canvas');
    gctx = glow.getContext('2d');
    lights = document.createElement('canvas');
    lctx = lights.getContext('2d');
  }
  if (buf.width !== w || buf.height !== h) {
    buf.width = glow.width = w;
    buf.height = glow.height = h;
  }
}

// The space the player is in: a room (its tiles from the floor's
// chamberAt, framed by its extent with its back wall's faces and the rim
// round it), or in a hallway the hallway floor up to ROOM_VIEW.hallReach
// steps away (no frame: the camera follows).
function spaceOf(row, col) {
  const f = state.floor;
  const room = f.chamberAt.get(key(row, col));
  if (room !== undefined && built.rooms.has(room)) {
    const r = built.rooms.get(room);
    const tiles = new Set();
    f.chamberAt.forEach((i, k) => { if (i === room) tiles.add(k); });
    return {
      tiles,
      bounds: { x0: (r.c0 - 1) * T, x1: (r.c1 + 2) * T, y0: (r.r0 - ROOM_VIEW.faceRows) * T, y1: (r.r1 + 2) * T },
    };
  }
  const tiles = new Set([key(row, col)]);
  let edge = [[row, col]];
  for (let step = 0; step < ROOM_VIEW.hallReach; step++) {
    const next = [];
    edge.forEach(([r, c]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const k = key(r + dr, c + dc);
      if (isWall(r + dr, c + dc) || tiles.has(k) || f.chamberAt.has(k)) return;
      tiles.add(k);
      next.push([r + dr, c + dc]);
    }));
    edge = next;
  }
  return { tiles, bounds: null };
}

// Glides the camera toward `goal` by the time since the last frame. A new
// floor, the first frame or reduced motion snaps it. Returns true while it
// moves.
function moveCamera(goal) {
  const now = look.now;
  const dt = Math.min(50, Math.max(0, now - lastFrameAt));
  lastFrameAt = now;
  if (!shownCam || look.still) {
    shownCam = { ...goal };
    return false;
  }
  const ease = 1 - Math.exp(-dt / ROOM_VIEW.glideMs);
  const settle = (from, to) => (Math.abs(to - from) < 0.25 ? to : from + (to - from) * ease);
  shownCam = { x: settle(shownCam.x, goal.x), y: settle(shownCam.y, goal.y) };
  return shownCam.x !== goal.x || shownCam.y !== goal.y;
}

// Fills the one-pixel-a-tile light canvas for the tiles from (c0, r0),
// `w` by `h`: each floor tile's level and tint, a wall face the level of
// the floor it stands over, a rim the brightest beside it, the dark 0.
function lightTiles(space, at, c0, r0, w, h) {
  if (lights.width < w || lights.height < h) {
    lights.width = Math.max(lights.width, w);
    lights.height = Math.max(lights.height, h);
  }
  const f = state.floor;
  const fog = state.settings.fogEnabled;
  const floorLight = (row, col) => {
    if (isWall(row, col)) return null;
    const k = key(row, col);
    if (!fog || f.visibleSet.has(k)) {
      const d = Math.hypot(row - at.row, col - at.col);
      const level = ROOM_VIEW.litNear + (ROOM_VIEW.litFar - ROOM_VIEW.litNear) * Math.min(1, d / PLAYER_CONE_RANGE);
      return [Math.max(level, space.tiles.has(k) ? ROOM_VIEW.room : 0), LIT_TINT];
    }
    if (space.tiles.has(k)) return [ROOM_VIEW.room, DIM_TINT];
    if (f.exploredSet.has(k)) return [ROOM_VIEW.remembered, DIM_TINT];
    return [0, DIM_TINT];
  };
  const tileLight = (row, col) => {
    const own = floorLight(row, col);
    if (own) return own;
    const face = faceOf(row, col, isWall);
    if (face) return floorLight(row + (face === 'lower' ? 1 : 2), col) || [0, DIM_TINT];
    return null;
  };
  const img = lctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const row = r0 + j, col = c0 + i;
      let light = tileLight(row, col);
      if (!light) {
        // A rim takes the brightest floor or face beside it.
        light = [0, DIM_TINT];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const near = (dr || dc) && tileLight(row + dr, col + dc);
            if (near && near[0] > light[0]) light = near;
          }
        }
      }
      const p = (j * w + i) * 4;
      img.data[p] = light[0] * light[1][0];
      img.data[p + 1] = light[0] * light[1][1];
      img.data[p + 2] = light[0] * light[1][2];
      img.data[p + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
}

// A pillar: a stone column standing up from its tile, lit from the front.
function drawPillar(row, col, ox, oy) {
  const x = col * T - ox + 2, w = T - 4;
  const foot = (row + 1) * T - oy - 2;
  const top = foot - Math.round(PILLAR.rise * T);
  bctx.fillStyle = PILLAR.dark;
  bctx.fillRect(x, top, w, foot - top);
  bctx.fillStyle = PILLAR.body;
  bctx.fillRect(x + 1, top + 3, w - 3, foot - top - 4);
  bctx.fillStyle = PILLAR.light;
  bctx.fillRect(x + 2, top + 3, 2, foot - top - 4);
  bctx.fillStyle = PILLAR.top;
  bctx.fillRect(x - 1, top, w + 2, 3);
  bctx.fillRect(x - 1, foot - 1, w + 2, 2);
}

// The player's stick man at `at` (tiles, between two while he walks),
// posed by playerform.js and turned the way the light points: white lines
// one picture pixel wide, and his ember head.
function drawStickMan(at, ox, oy) {
  if (!look.still) look.keepMoving();
  const angle = lookAngle();
  if (poseLook !== null && Math.abs(wrapAngle(angle - poseLook)) > 0.002) playerActive(look.now);
  poseLook = angle;
  const pose = playerPose(look.now, look.still, !!(state.battle.aim || state.battle.struggle));
  const h = ROOM_VIEW.stickHeight * T;
  const fx = (at.col + 0.5) * T - ox;
  const fy = (at.row + ROOM_VIEW.footAt) * T - oy;
  const ax = Math.sin(angle), ay = -Math.cos(angle);
  const onFloor = (along, side, up) => [
    fx + (ax * along - ay * side) * POSE_SCALE * T,
    fy + (ay * along + ax * side) * POSE_SCALE * T - up * POSE_SCALE * T,
  ];
  const lift = pose.rise * h;
  const sway = pose.sway * h;
  const headR = Math.max(2.5, h * HEAD_SHARE);
  const headY = fy - h + headR - lift;
  const neck = [fx + sway, headY + headR];
  const hip = [fx + sway * 0.4, fy - h * 0.42 + Math.max(0, -pose.rise) * h * 0.5];
  const shoulder = [neck[0], neck[1] + h * 0.08];
  const feet = pose.feet.map(p => onFloor(p.along, p.side, p.up));
  const gun = state.settings.gunCombat ? holdGun(fx, fy, ax, ay, h, pose.gunRise * h) : null;
  const hands = gun ? [gun.grip, gun.backHand] : [-1, 1].map(s => [shoulder[0] + s * h * 0.2, hip[1] - h * 0.02]);
  const px = v => Math.round(v) + 0.5;
  bctx.save();
  bctx.strokeStyle = look.colours.text;
  bctx.lineWidth = STICK_LINE;
  bctx.lineCap = 'square';
  bctx.beginPath();
  bctx.moveTo(px(feet[0][0]), px(feet[0][1]));
  bctx.lineTo(px(hip[0]), px(hip[1]));
  bctx.lineTo(px(feet[1][0]), px(feet[1][1]));
  bctx.moveTo(px(hip[0]), px(hip[1]));
  bctx.lineTo(px(neck[0]), px(neck[1]));
  bctx.moveTo(px(hands[0][0]), px(hands[0][1]));
  bctx.lineTo(px(shoulder[0]), px(shoulder[1]));
  bctx.lineTo(px(hands[1][0]), px(hands[1][1]));
  bctx.stroke();
  if (gun) {
    bctx.strokeStyle = GUN_COLOUR;
    bctx.beginPath();
    bctx.moveTo(px(gun.butt[0]), px(gun.butt[1]));
    bctx.lineTo(px(gun.muzzle[0]), px(gun.muzzle[1]));
    bctx.moveTo(px(gun.grip[0]), px(gun.grip[1]));
    bctx.lineTo(px(gun.grip[0]), px(gun.grip[1] + GUN.grip * h));
    bctx.stroke();
    bctx.strokeStyle = look.colours.text;
  }
  // The ember head: dark inside, a glow in the middle that breathes, and
  // the ring round it.
  const hx = neck[0] + pose.turn * PLAYER_GLANCE.turn * headR * 0.5;
  bctx.beginPath();
  bctx.arc(hx, headY, headR, 0, Math.PI * 2);
  bctx.fillStyle = look.colours.hidden;
  bctx.fill();
  const gx = hx + pose.turn * PLAYER_GLANCE.turn * headR * PLAYER_EMBER.lean;
  const ember = bctx.createRadialGradient(gx, headY, 0, gx, headY, headR * PLAYER_EMBER.reach);
  ember.addColorStop(0, 'rgba(' + look.colours.glowRgb + ', ' + emberGlow(pose.breath, look.still) + ')');
  ember.addColorStop(1, 'rgba(' + look.colours.glowRgb + ', 0)');
  bctx.fillStyle = ember;
  bctx.fill();
  bctx.stroke();
  bctx.restore();
}

// Every thing but the player as its glyph on its tile, over the lit
// picture at the canvas's own size (steps B to D draw them as pictures),
// never smaller than on the old isometric map. Enemies' boxes are kept for taps.
function drawGlyphs(ctx, ox, oy) {
  const tile = T * scale;
  const narrow = look && ctx.canvas.width / pageScale < ISO_NARROW_MAP_WIDTH;
  const isoTile = ctx.canvas.width / (narrow ? ISO_TILES_ACROSS_NARROW : ISO_TILES_ACROSS);
  const cell = Math.max(tile, Math.min(isoTile, tile * 1.6));
  const boxes = [];
  look.things.forEach(thing => {
    if (drawingOf(thing) !== 'glyph') return;
    const x = ((thing.at.col + 0.5) * T - ox) * scale;
    const y = ((thing.at.row + 0.5) * T - oy) * scale;
    if (x < -cell || y < -cell || x > ctx.canvas.width + cell || y > ctx.canvas.height + cell) return;
    look.paintGlyph(ctx, cell, x, y - (thing.look.lift || 0) * cell, thing.glyph, thing.look);
    if (ENEMY_KINDS.includes(thing.kind)) {
      const half = cell * (MAP_GLYPH_SIZES[thing.look.size] || 0.8) * 0.6;
      boxes.push({ box: [x - half, y - half * 1.4, x + half, y + half], tile: thing.tile });
    }
  });
  tapBoxes = boxes;
  // Letters a crawling stick man left (downed plan), only on lit floor, so
  // they never give one away in the dark. Simple enemies have none.
  if (state.settings.simpleEnemies) return;
  const centre = (row, col) => [((col + 0.5) * T - ox) * scale, ((row + 0.5) * T - oy) * scale];
  const lit = (row, col) => !state.settings.fogEnabled || state.floor.visibleSet.has(key(row, col));
  drawDroppedLetters(ctx, cell, centre, lit);
}

// How a map thing is drawn (ROOM_DRAWINGS), allowing for what isn't made
// out yet: its '?', except the stairs and a grate, which show as they are.
function drawingOf(thing) {
  const drawing = ROOM_DRAWINGS[thing.kind] || 'glyph';
  if (thing.glyph === null && thing.kind !== 'stairs' && thing.kind !== 'vent') return ENEMY_KINDS.includes(thing.kind) ? 'glyph' : 'unknown';
  if (drawing === 'form' && (state.settings.simpleEnemies || !minionOn(thing.tile) || !minionOn(thing.tile).minionKind)) return 'glyph';
  return drawing;
}

// A thing not made out yet: a small '?' standing on its tile, showing
// faintly over the dark it is in.
function drawUnknown(x, y, glows) {
  const paint = () => UNKNOWN.forEach((line, j) => [...line].forEach((ch, i) => {
    if (ch === '#') bctx.fillRect(x + 6 + i, y + 3 + j, 1, 1);
  }));
  bctx.fillStyle = look.colours.muted;
  paint();
  glows.push(() => {
    bctx.globalAlpha = UNKNOWN_GLOW;
    bctx.fillStyle = look.colours.muted;
    paint();
    bctx.globalAlpha = 1;
  });
}

// ---- stick men (step C) ----

// Draws every stick man in sight (and the killed ones still fading) over
// the scaled-up picture, back to front, each at the player's stick man's
// size times its kind's, turned toward the player, with what stands in
// front of it redrawn over it, its maim ring while a shot on it waits, its
// eye and heard '!'. Returns their boxes for taps.
function drawForms(ctx, ox, oy, standing) {
  const tw = T * scale;
  const height = ROOM_VIEW.stickHeight * T * scale;
  const lineWidth = STICK_LINE * scale;
  const centre = (row, col) => [((col + 0.5) * T - ox) * scale, ((row + ROOM_VIEW.footAt) * T - oy) * scale];
  const [px, py] = centre(look.walkAt.row, look.walkAt.col);
  const toward = [px, py - height * 0.6];
  const forms = look.things.filter(thing => drawingOf(thing) === 'form').map(thing => ({ m: minionOn(thing.tile), at: thing.at, thing }));
  dyingSticks(look.now).forEach(m => forms.push({ m, at: { row: m.row, col: m.col }, thing: null }));
  const boxes = [];
  forms.sort((a, b) => a.at.row - b.at.row).forEach(({ m, at, thing }) => {
    if (!look.still) look.keepMoving();
    const [sx, sy] = centre(at.row, at.col);
    const weak = drawStickForm(ctx, m, sx, sy, {
      tw, height, lineWidth, toward, now: look.now, still: look.still, centre,
      line: (path, level) => enemyLine(ctx, path, level, lineWidth),
      aiming: state.battle.aim !== null && state.battle.aim.target === m,
    });
    redrawInFront(ctx, at, standing);
    if (weak) {
      ctx.beginPath();
      ctx.arc(weak[0], weak[1], tw * WEAK_RING, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + look.colours.glowRgb + ', ' + WEAK_RING_LEVEL + ')';
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    if (!thing || !state.floor.minions.includes(m)) return;
    const top = sy - height * ((MINION_KINDS[m.minionKind] || {}).size || 1);
    const eyeY = top - EYE_LIFT * POSE_SCALE * tw;
    drawGazeEye(ctx, sx, eyeY, m, tw, lineWidth);
    if (thing.look.heard) {
      look.paintGlyph(ctx, tw, sx, eyeY - HEARD_LIFT * POSE_SCALE * tw, '!', { size: 'prop', colour: 'rgb(' + ENEMY_LIGHT.core + ')', alpha: thing.look.heard });
    }
    boxes.push({ box: stickBox(m, sx, sy, height), tile: thing.tile });
  });
  return boxes;
}

// Redraws, over a stick man standing at `at`, the furniture and pillars in
// front of it (lower on the screen and beside it), lit as in the picture:
// they are drawn again into `mask`, which then keeps only the picture's
// pixels under them.
function redrawInFront(ctx, at, standing) {
  const front = standing.filter(s => s.y > at.row + ROOM_VIEW.footAt + 0.01 && s.row - at.row <= 2 && Math.abs(s.col - at.col) <= 1);
  if (!front.length) return;
  if (!mask) {
    mask = document.createElement('canvas');
    mctx = mask.getContext('2d');
  }
  if (mask.width !== view.w || mask.height !== view.h) {
    mask.width = view.w;
    mask.height = view.h;
  }
  mctx.globalCompositeOperation = 'source-over';
  mctx.clearRect(0, 0, view.w, view.h);
  const picture = bctx;
  bctx = mctx;
  front.forEach(s => s.draw());
  bctx = picture;
  mctx.globalCompositeOperation = 'source-in';
  mctx.drawImage(buf, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mask, 0, 0, view.w, view.h, 0, 0, view.w * scale, view.h * scale);
  ctx.imageSmoothingEnabled = true;
}

// Strokes the path `path()` makes as a stick enemy's line, `w` wide, at
// strength `level`, in the enemies' cold blue (ENEMY_LIGHT) with its halo.
function enemyLine(ctx, path, level, w) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  HALO_LAYERS.forEach(l => {
    ctx.strokeStyle = 'rgba(' + ENEMY_LIGHT.halo + ', ' + Math.min(0.8, level) * l.strength + ')';
    ctx.lineWidth = w * l.width;
    ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + level + ')';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

// The eye over a stick man in the player's cone (gaze.js) at (x, y): shut,
// a line; the lids part slowly with its gaze, the pupil showing from a
// third open.
function drawGazeEye(ctx, x, y, m, tw, lineWidth) {
  const eye = eyeOf(m);
  if (!eye) return;
  const w = tw * EYE_WIDTH;
  const open = tw * eye.open;
  const lids = () => {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - open * 2, x + w, y);
    ctx.quadraticCurveTo(x, y + open * 2, x - w, y);
  };
  ctx.save();
  if (open > 1) {
    lids();
    ctx.fillStyle = '#000';
    ctx.fill();
  }
  if (eye.share > 1 / 3) {
    lids();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(x, y, w * (0.18 + 0.24 * eye.share), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + eye.level + ')';
    ctx.fill();
  }
  ctx.restore();
  enemyLine(ctx, lids, eye.level, lineWidth);
}

// A cold mark at the edge of the map pointing at each enemy in sight that
// the camera doesn't show (a long room or hallway), so one coming is never
// out of mind.
function drawEdgeMarks(ctx, ox, oy) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const r = EDGE_MARK * T * scale;
  look.things.filter(thing => ENEMY_KINDS.includes(thing.kind)).forEach(thing => {
    const x = ((thing.at.col + 0.5) * T - ox) * scale;
    const y = ((thing.at.row + 0.2) * T - oy) * scale;
    if (x >= 0 && x <= W && y >= 0 && y <= H) return;
    const mx = Math.min(Math.max(x, r * 1.5), W - r * 1.5);
    const my = Math.min(Math.max(y, r * 1.5), H - r * 1.5);
    const a = Math.atan2(y - my, x - mx);
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
    ctx.lineTo(mx + Math.cos(a + 2.4) * r, my + Math.sin(a + 2.4) * r);
    ctx.lineTo(mx + Math.cos(a - 2.4) * r, my + Math.sin(a - 2.4) * r);
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + ENEMY_LIGHT.core + ')';
    ctx.fill();
  });
}

// ---- things on the floor (step B) ----
// Each draws into the picture at (x, y), its tile's top-left in picture
// pixels, and may push what gives off light onto `glows`, drawn after the
// lighting.

// A paper lying on its tile with two lines of writing; dimmer once read.
function drawPaper(thing, x, y) {
  bctx.fillStyle = searched(thing.tile) ? SHEET.read : SHEET.fresh;
  bctx.fillRect(x + 4, y + 6, 8, 6);
  bctx.fillRect(x + 5, y + 5, 7, 1);
  bctx.fillStyle = SHEET.ink;
  bctx.fillRect(x + 5, y + 8, 5, 1);
  bctx.fillRect(x + 5, y + 10, 4, 1);
}

// A grate in the floor (vents.js): a dark frame with bars, shuddering side
// to side while something moves in the duct, crossed out when sealed.
function drawGrate(thing, x, y) {
  const r = thing.look.rattle;
  const dx = r === null || r === undefined ? 0 : Math.round(Math.sin(r * Math.PI * GRATE_RATTLE_SWAYS * 2) * (1 - r) * GRATE.sway);
  const gx = x + dx;
  bctx.fillStyle = GRATE.frame;
  bctx.fillRect(gx + 2, y + 3, 12, 10);
  bctx.fillStyle = '#000';
  bctx.fillRect(gx + 3, y + 4, 10, 8);
  bctx.fillStyle = GRATE.edge;
  bctx.fillRect(gx + 2, y + 3, 12, 1);
  bctx.fillStyle = GRATE.bar;
  [5, 8, 11].forEach(bx => bctx.fillRect(gx + bx, y + 4, 1, 8));
  if (!thing.look.sealed) return;
  bctx.fillStyle = GRATE.seal;
  for (let i = 0; i < 8; i++) {
    bctx.fillRect(gx + 3 + Math.round(i * 10 / 8), y + 4 + i, 1, 1);
    bctx.fillRect(gx + 12 - Math.round(i * 10 / 8), y + 4 + i, 1, 1);
  }
}

// The stairs down: steps sinking into the floor, darker each one, and the
// column of light rising out of them, pulsing (it shows in the dark: the
// stairs are never lost).
function drawStairs(thing, x, y, glows) {
  STAIRS.forEach((colour, i) => {
    bctx.fillStyle = colour;
    bctx.fillRect(x + 1 + i * 2, y + 2 + i * 2, 14 - i * 3, 12 - i * 3);
    bctx.fillStyle = STAIR_EDGE;
    bctx.fillRect(x + 1 + i * 2, y + 2 + i * 2, 14 - i * 3, 1);
  });
  glows.push(() => drawBeam(x + T / 2, y + T * 0.7));
}

// A column of light standing up from (fx, fy) in picture pixels: soft
// layers, widest and faintest first, fading toward the top, pulsing.
function drawBeam(fx, fy) {
  look.keepMoving();
  const strength = 0.82 + 0.18 * look.pulse(MAP_ANIMATION_MS.glow);
  const rgb = look.colours.glowRgb;
  const top = fy - BEAM_RISE * T;
  STAIR_BEAM_LAYERS.forEach(layer => {
    const a = layer.strength * strength;
    const fade = bctx.createLinearGradient(0, fy, 0, top);
    fade.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')');
    fade.addColorStop(STAIR_BEAM_FADE[0], 'rgba(' + rgb + ', ' + a * STAIR_BEAM_FADE[1] + ')');
    fade.addColorStop(1, 'rgba(' + rgb + ', 0)');
    const half = Math.max(1, Math.round(T * layer.width / 2));
    bctx.fillStyle = fade;
    bctx.fillRect(Math.round(fx - half), Math.round(top), half * 2, Math.round(fy - top));
  });
}

// A wooden crate; opened once searched, its lid leaning behind it.
function drawBox(thing, x, y) {
  const open = searched(thing.tile);
  if (open) {
    bctx.fillStyle = CRATE.top;
    bctx.fillRect(x + 3, y + 1, 10, 3);
  }
  bctx.fillStyle = open ? CRATE.inside : CRATE.top;
  bctx.fillRect(x + 2, y + 4, 12, 3);
  bctx.fillStyle = CRATE.front;
  bctx.fillRect(x + 2, y + 7, 12, 8);
  bctx.fillStyle = CRATE.plank;
  bctx.fillRect(x + 2, y + 10, 12, 1);
  bctx.fillRect(x + 2, y + 13, 12, 1);
  bctx.fillStyle = CRATE.post;
  bctx.fillRect(x + 2, y + 4, 1, 11);
  bctx.fillRect(x + 13, y + 4, 1, 11);
}

// An energy cell: a round case with bands and three ends on its lid,
// glowing while unused (with a faint breath of light round it); dark once used.
function drawCell(thing, x, y, glows) {
  const spent = searched(thing.tile);
  bctx.fillStyle = CELL.body;
  bctx.fillRect(x + 4, y + 5, 8, 10);
  bctx.fillStyle = CELL.light;
  bctx.fillRect(x + 5, y + 5, 1, 10);
  bctx.fillStyle = CELL.shade;
  bctx.fillRect(x + 11, y + 5, 1, 10);
  bctx.fillStyle = CELL.band;
  bctx.fillRect(x + 4, y + 8, 8, 1);
  bctx.fillRect(x + 4, y + 12, 8, 1);
  bctx.fillStyle = CELL.lid;
  bctx.fillRect(x + 5, y + 3, 6, 1);
  bctx.fillRect(x + 4, y + 4, 8, 1);
  const ends = [[6, 4], [9, 4], [8, 3]];
  bctx.fillStyle = CELL.dead;
  ends.forEach(([ex, ey]) => bctx.fillRect(x + ex, y + ey, 1, 1));
  if (spent) return;
  const breath = thing.look.breath;
  glows.push(() => {
    bctx.fillStyle = 'rgb(' + look.colours.glowRgb + ')';
    ends.forEach(([ex, ey]) => bctx.fillRect(x + ex, y + ey, 1, 1));
    if (breath === null || breath === undefined) return;
    look.keepMoving();
    const a = (DRUM_BREATH[0] + (DRUM_BREATH[1] - DRUM_BREATH[0]) * breath) * BREATH_GLOW;
    halo(x + T / 2, y + 9, DRUM_BREATH_REACH * T * 1.6, look.colours.glowRgb, a);
  });
}

// The reflective desk: a small desk with a mirror standing on it, in its
// pool of the kind voice's warm light while unused; spent, the glass is dull.
function drawDesk(thing, x, y, glows) {
  const unused = thing.look.deskGlow !== null && thing.look.deskGlow !== undefined;
  bctx.fillStyle = DESK.frame;
  bctx.fillRect(x + 4, y - 6, 8, 12);
  bctx.fillStyle = unused ? DESK.glass : DESK.dull;
  bctx.fillRect(x + 5, y - 5, 6, 10);
  if (unused) {
    bctx.fillStyle = DESK.shine;
    for (let i = 0; i < 4; i++) bctx.fillRect(x + 6 + i, y - 3 + i, 1, 1);
  }
  bctx.fillStyle = DESK.top;
  bctx.fillRect(x + 1, y + 6, 14, 3);
  bctx.fillStyle = DESK.front;
  bctx.fillRect(x + 1, y + 9, 14, 6);
  bctx.fillStyle = DESK.frame;
  bctx.fillRect(x + 4, y + 11, 8, 1);
  if (!unused) return;
  glows.push(() => {
    look.keepMoving();
    const a = (DESK_GLOW[0] + (DESK_GLOW[1] - DESK_GLOW[0]) * thing.look.deskGlow) * (thing.look.alpha === undefined ? 1 : thing.look.alpha);
    halo(x + T / 2, y + T * 0.7, DESK_GLOW_RADIUS * T, look.colours.kindRgb, a);
  });
}

// A relay (relays.js): a grey box on short legs with a small lamp, lit
// until it is used.
function drawRelay(thing, x, y, glows) {
  bctx.fillStyle = RELAY.leg;
  bctx.fillRect(x + 4, y + 13, 1, 2);
  bctx.fillRect(x + 11, y + 13, 1, 2);
  bctx.fillStyle = RELAY.body;
  bctx.fillRect(x + 3, y + 3, 10, 10);
  bctx.fillStyle = RELAY.seam;
  bctx.fillRect(x + 8, y + 4, 1, 8);
  bctx.fillRect(x + 3, y + 3, 10, 1);
  bctx.fillStyle = RELAY.dead;
  bctx.fillRect(x + 10, y + 5, 2, 2);
  if (searched(thing.tile)) return;
  glows.push(() => {
    bctx.fillStyle = 'rgb(' + look.colours.glowRgb + ')';
    bctx.fillRect(x + 10, y + 5, 2, 2);
  });
}

// The chest: a dark trunk with bands and a brass lock.
function drawChest(thing, x, y) {
  bctx.fillStyle = CHEST.lid;
  bctx.fillRect(x + 2, y + 5, 12, 4);
  bctx.fillRect(x + 3, y + 4, 10, 1);
  bctx.fillStyle = CHEST.lidLight;
  bctx.fillRect(x + 3, y + 5, 10, 1);
  bctx.fillStyle = CHEST.body;
  bctx.fillRect(x + 2, y + 9, 12, 6);
  bctx.fillStyle = CHEST.band;
  bctx.fillRect(x + 4, y + 4, 1, 11);
  bctx.fillRect(x + 11, y + 4, 1, 11);
  bctx.fillStyle = CHEST.lock;
  bctx.fillRect(x + 7, y + 8, 2, 3);
}

// The coin, bobbing over its tile with a faint gold glint.
function drawCoin(thing, x, y, glows) {
  const lift = Math.round((thing.look.lift || 0) * T);
  const cy = y + 8 - lift;
  bctx.fillStyle = COIN.face;
  bctx.fillRect(x + 6, cy, 4, 4);
  bctx.fillRect(x + 7, cy - 1, 2, 6);
  bctx.fillStyle = COIN.shine;
  bctx.fillRect(x + 7, cy, 1, 1);
  glows.push(() => halo(x + 8, cy + 2, T * 0.5, COIN.rgb, 0.18));
}

// A key lying on its tile: a ring, a shaft and two teeth, glowing as the
// stairs do so a lit one isn't missed.
function drawKey(thing, x, y, glows) {
  const paint = () => {
    bctx.fillStyle = KEY.metal;
    bctx.fillRect(x + 3, y + 7, 4, 1);
    bctx.fillRect(x + 3, y + 10, 4, 1);
    bctx.fillRect(x + 3, y + 7, 1, 4);
    bctx.fillRect(x + 6, y + 7, 1, 4);
    bctx.fillRect(x + 7, y + 9, 7, 1);
    bctx.fillRect(x + 11, y + 10, 1, 2);
    bctx.fillRect(x + 13, y + 10, 1, 2);
  };
  paint();
  const strength = thing.look.glow ? thing.look.glow[1] : 1;
  glows.push(() => {
    halo(x + 8, y + 9, T * 0.7, look.colours.glowRgb, strength * KEY.glow * 0.5);
    paint();
  });
}

// The boss's mist over the floor in view (mapview.js mistStrength: lit
// floor only, dimmed when remembered, drifting).
function drawMist(c0, r0, c1, r1, ox, oy) {
  const rgb = look.colours.bossFogRgb;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const mist = look.mistStrength(row, col);
      if (!mist) continue;
      bctx.fillStyle = 'rgba(' + rgb + ', ' + MIST_GLOW * mist + ')';
      bctx.fillRect(col * T - ox, row * T - oy, T, T);
    }
  }
}

// A mistake's sound spreading over the floor (mapview.js soundOnMap): a
// square outline on each tile it reaches, opening out and fading.
function drawSounds(ox, oy) {
  look.sounds.forEach(({ row, col, strength, spread }) => {
    const inset = Math.round((SOUND_INSET[0] + (SOUND_INSET[1] - SOUND_INSET[0]) * spread) * T);
    const x = col * T - ox + inset, y = row * T - oy + inset, w = T - inset * 2;
    if (w < 1) return;
    bctx.strokeStyle = 'rgba(' + look.colours.glowRgb + ', ' + SOUND_LEVEL * strength + ')';
    bctx.lineWidth = 1;
    bctx.strokeRect(x + 0.5, y + 0.5, w - 1, w - 1);
  });
}

// A soft round glow of `rgb` at (x, y) in picture pixels, `r` across, `a`
// strong in the middle.
function halo(x, y, r, rgb, a) {
  const g = bctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')');
  g.addColorStop(1, 'rgba(' + rgb + ', 0)');
  bctx.fillStyle = g;
  bctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const FLAT = { paper: drawPaper, vent: drawGrate, stairs: drawStairs };
const STAND = { box: drawBox, furniture: drawFurniture, cell: drawCell, desk: drawDesk, relay: drawRelay, chest: drawChest, coin: drawCoin, key: drawKey };

// ---- the gun on the map (step D) ----

// Where the player's stick man (feet at (fx, fy), `h` tall, picture
// pixels) holds the gun: ahead of him the way the light points (ax, ay),
// to his right, at hand height, `rise` higher as his body breathes, lifted
// while a shot waits, kicked back by a shot. Notes its muzzle for the
// laser and the shot.
function holdGun(fx, fy, ax, ay, h, rise) {
  const ahead = (GUN.ahead - recoilAt(look.now, look.still) * GUN.kick) * h;
  const up = (GUN.height + (state.battle.aim ? GUN.raise : 0)) * h + rise;
  const at = (along, side) => [fx + ax * along - ay * side, fy + ay * along + ax * side - up];
  const side = GUN.side * h;
  const gun = {
    grip: at(ahead, side),
    backHand: at(ahead - 0.06 * h, side - 0.08 * h),
    butt: at(ahead - 0.06 * h, side),
    muzzle: at(ahead + GUN.length * h, side),
  };
  muzzle = gun.muzzle;
  return gun;
}

// A point in picture pixels on the canvas.
function onCanvas([x, y]) {
  return [x * scale, y * scale];
}

// The floor's tile middle at its feet on the canvas, for a tile (row, col).
function footOnCanvas(row, col) {
  return [((col + 0.5) * T - frame.ox) * scale, ((row + ROOM_VIEW.footAt) * T - frame.oy) * scale];
}

// Where on stick man `m` standing on `at` a shot goes: its chest, by its size.
function chestOf(at, m) {
  const size = (m && MINION_KINDS[m.minionKind] || {}).size || 1;
  const [x, y] = footOnCanvas(at.row, at.col);
  return [x, y - ROOM_VIEW.stickHeight * T * scale * size * SHOT_AT];
}

// The tiles the gun reaches, lit faintly (over the lit picture).
function drawReach(c0, r0, c1, r1, ox, oy) {
  bctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + REACH_FILL * 0.5 + ')';
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) if (inReach(row, col)) bctx.fillRect(col * T - ox, row * T - oy, T, T);
  }
}

// A soft glowing line of the player's light along the path `path()`.
function glowStroke(ctx, path, level, w) {
  ctx.save();
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = 'rgba(' + look.colours.glowRgb + ', ' + level * 0.3 + ')';
  ctx.lineWidth = w * 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(' + look.colours.glowRgb + ', ' + level + ')';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

// Corner brackets round everything the gun can shoot right now, faint, and
// round the target, bright and slowly breathing, with its guard over it
// while it has one. The boxes are this frame's enemies' (tapBoxes).
function drawBrackets(ctx) {
  const target = liveTarget();
  const tw = T * scale;
  tapBoxes.forEach(({ box, tile }) => {
    const m = state.floor.minions.find(n => n.row === tile.row && n.col === tile.col);
    if (!m) return;
    const chosen = m === target;
    if (!chosen && !canShoot(m)) return;
    let breathe = 0;
    if (chosen && !look.still) {
      look.keepMoving();
      breathe = look.pulse(MAP_ANIMATION_MS.target) * tw * BRACKET_PULSE;
    }
    const half = Math.max((box[2] - box[0]) / 2, tw * BRACKET_HALF);
    const mid = (box[0] + box[2]) / 2;
    const [l, top, r, bottom] = [mid - half - breathe, box[1] - breathe, mid + half + breathe, box[3] + breathe];
    const arm = tw * BRACKET_ARM;
    const level = BRACKET_LEVEL[chosen ? 1 : 0];
    glowStroke(ctx, () => {
      ctx.beginPath();
      [[l, top, 1, 1], [r, top, -1, 1], [l, bottom, 1, -1], [r, bottom, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.moveTo(x + sx * arm, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * arm);
      });
    }, level, scale * (chosen ? 1.6 : 1));
    if (!chosen || !m.guard) return;
    ctx.save();
    ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + level + ')';
    ctx.font = Math.round(tw * BRACKET_TEXT_SIZE) + 'px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('stat.guard'), mid, top - tw * BRACKET_HP_GAP);
    ctx.restore();
  });
}

// The dashed laser from the gun's muzzle to the target's chest, while it
// can be shot; brighter while a landed shot waits for the dial.
function drawLaser(ctx) {
  const target = liveTarget();
  if (!target || !muzzle || !canShoot(target)) return;
  const thing = look.things.find(th => ENEMY_KINDS.includes(th.kind) && th.tile.row === target.row && th.tile.col === target.col);
  if (!thing) return;
  const from = onCanvas(muzzle);
  const to = chestOf(thing.at, target);
  ctx.save();
  ctx.setLineDash(LASER_DASH.map(n => n * scale));
  glowStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
  }, LASER_LEVEL[state.battle.aim ? 1 : 0], scale);
  ctx.restore();
}

// The last shot while it plays (mapshared.js lastShot): a flash from the
// gun to where it lands and a ring there (not under reduced motion), then
// MISS over a missed stick man, fading as it floats up (still under
// reduced motion).
function drawShot(ctx) {
  const shot = lastShot();
  if (!shot) return;
  const tw = T * scale;
  const age = look.now - shot.start;
  if (!look.still && muzzle && age < MAP_ANIMATION_MS.gunShot) {
    look.keepMoving();
    const done = age / MAP_ANIMATION_MS.gunShot;
    const from = onCanvas(muzzle);
    const end = chestOf(shot.to, state.floor.minions.find(m => m.row === shot.at.row && m.col === shot.at.col));
    glowStroke(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(end[0], end[1]);
    }, 1 - done, scale);
    glowStroke(ctx, () => {
      ctx.beginPath();
      ctx.arc(end[0], end[1], tw * (SHOT_RING[0] + SHOT_RING[1] * done), 0, Math.PI * 2);
    }, 1 - done, scale * 1.5);
  }
  if (!shot.missed || age >= MAP_ANIMATION_MS.gunMiss) return;
  const done = age / MAP_ANIMATION_MS.gunMiss;
  if (!look.still) look.keepMoving();
  const [x, foot] = footOnCanvas(shot.at.row, shot.at.col);
  const y = foot - (MISS_RISE[0] + (look.still ? 0 : MISS_RISE[1] * done)) * tw * POSE_SCALE;
  ctx.save();
  ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + (look.still ? 1 : 1 - done) + ')';
  ctx.font = Math.round(tw * MISS_TEXT_SIZE) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(t('gun.miss'), x, y);
  ctx.restore();
}

// One half of the answer ring (swirl.js): the right answer to a miss going
// round over what asked it (round the boss at its chest), as a flat
// ellipse seen from above, its front half lower on the screen. Only the
// `near` half or the far half is drawn, so what stands there can be
// between them. Letters never smaller than ANSWER_RING.minPx CSS pixels.
function drawAnswerRing(ctx, ring, near) {
  const { out, letters } = answerRingLetters(ring, look.now);
  const tw = T * scale;
  const h = ROOM_VIEW.stickHeight * T * scale;
  const radius = (ring.boss ? ANSWER_RING.bossRadius : ANSWER_RING.radius) * tw;
  const lift = ((ring.boss ? ANSWER_RING.bossLift : ANSWER_RING.lift) / ISO_STICK_HEIGHT + out * 0.2) * h;
  const [cx, foot] = footOnCanvas(ring.row, ring.col);
  const cy = foot - lift;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  letters.forEach(({ ch, angle, front, level, size: share }) => {
    if ((front >= 0) !== near) return;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + front * radius * ANSWER_RING.depth;
    const size = Math.max(ANSWER_RING.minPx * pageScale, tw * ANSWER_RING.size);
    const px = Math.max(6, Math.round(size * share));
    ctx.font = px + 'px VT323, monospace';
    if (ch !== ' ') {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + 0.8 * Math.min(1, level * 1.5) + ')';
      ctx.fillRect(x - px * 0.3, y - px * 0.46, px * 0.6, px * 0.92);
    }
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.halo + ', ' + 0.35 * level + ')';
    ctx.fillText(ch, x, y + px * 0.04);
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + level + ')';
    ctx.fillText(ch, x, y);
  });
  ctx.restore();
  if (!look.still) look.keepMoving();
}

// The tutorial's ring of dark (tutorial.js stage 'ring'): words in the
// stick men's cold light circling the player at the edge of their small
// light; when the light breaks it they scatter outward and fade (still
// under reduced motion and in Comfort mode, and simply gone when it breaks).
function drawDarkRing(ctx) {
  const ring = darkRingAt(look.now, look.still);
  if (!ring) return;
  if (ring.moving) look.keepMoving();
  const tw = T * scale;
  const [px, py] = [((look.walkAt.col + 0.5) * T - frame.ox) * scale, ((look.walkAt.row + 0.5) * T - frame.oy) * scale];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = ring.level;
  ctx.fillStyle = 'rgb(' + ENEMY_LIGHT.core + ')';
  ctx.shadowColor = 'rgba(' + ENEMY_LIGHT.halo + ', 0.6)';
  const size = tw * DARK_RING.size;
  ctx.font = Math.round(size) + 'px VT323, monospace';
  ctx.shadowBlur = size * 0.5;
  ring.words.forEach((word, i) => {
    const angle = ring.angles[i];
    ctx.fillText(word, px + ring.radius * Math.sin(angle) * tw, py + ring.radius * Math.cos(angle) * tw - DARK_RING.lift * tw);
  });
  ctx.restore();
}

// ---- furniture (step E) ----
// A fixed plan's furniture (plans.js `furniture`), one tile at a time:
// the map thing's `at` is the prop itself, with its `piece` and its `part`
// ('single', or 'left' / 'mid' / 'right' along a wider one), so a wide
// piece joins up across its tiles. Each stands on its tile like a box.

const WOODWORK = { top: '#7a5638', topLight: '#8c6644', front: '#5a3f29', dark: '#3f2c1e', leg: '#2f2016' };
const BOOKS = ['#6b3b34', '#3f4f5f', '#5c5a3a', '#4c3a52', '#7a6a4e', '#2f4a42', '#5e3a2c'];
const METAL = { top: '#7c8186', front: '#4e5358', seam: '#3a3e42', tap: '#a9b0b5' };
const PORCELAIN = { bowl: '#c9ccc8', shade: '#9fa29e', pipe: '#6a6e6c' };
const STALL = { door: '#5b6b73', edge: '#6f8089', gap: '#1c2124' };
const SOFA = { back: '#5a3b3e', seat: '#6b474a', arm: '#4a3033' };
const EASEL = { leg: '#5a3f29', board: '#b9ab8e', frame: '#8a7a5e' };

// Draws furniture prop `thing` on its tile at (x, y).
function drawFurniture(thing, x, y) {
  const { piece, part } = thing.at;
  const left = part === 'single' || part === 'left';
  const right = part === 'single' || part === 'right';
  (PIECES[piece] || PIECES.table)(x, y, left, right, thing.at);
}

// A pupil's desk with its chair behind it.
function drawSchoolDesk(x, y) {
  bctx.fillStyle = WOODWORK.dark;
  bctx.fillRect(x + 4, y - 1, 8, 5);
  bctx.fillStyle = WOODWORK.top;
  bctx.fillRect(x + 2, y + 4, 12, 7);
  bctx.fillStyle = WOODWORK.topLight;
  bctx.fillRect(x + 2, y + 4, 12, 1);
  bctx.fillStyle = WOODWORK.front;
  bctx.fillRect(x + 2, y + 11, 12, 2);
  bctx.fillStyle = WOODWORK.leg;
  bctx.fillRect(x + 3, y + 13, 1, 3);
  bctx.fillRect(x + 12, y + 13, 1, 3);
}

// The teacher's desk: a wide top and a solid front with drawers, papers on
// its left end and a book on its right.
function drawTeacherDesk(x, y, left, right) {
  const x0 = x + (left ? 1 : 0), x1 = x + (right ? T - 1 : T);
  bctx.fillStyle = WOODWORK.top;
  bctx.fillRect(x0, y + 1, x1 - x0, 8);
  bctx.fillStyle = WOODWORK.topLight;
  bctx.fillRect(x0, y + 1, x1 - x0, 1);
  bctx.fillStyle = WOODWORK.front;
  bctx.fillRect(x0, y + 9, x1 - x0, 7);
  bctx.fillStyle = WOODWORK.dark;
  bctx.fillRect(x + 4, y + 11, 8, 1);
  if (left) {
    bctx.fillStyle = SHEET.fresh;
    bctx.fillRect(x + 4, y + 3, 7, 4);
  }
  if (right) {
    bctx.fillStyle = BOOKS[1];
    bctx.fillRect(x + 6, y + 2, 5, 5);
  }
}

// A bookcase standing tall: posts at its ends, shelves of books whose
// colours are the same every time for the same tile.
function drawShelf(x, y, left, right, at) {
  const top = y - 12, h = 27;
  bctx.fillStyle = WOODWORK.dark;
  bctx.fillRect(x, top, T, h);
  for (let s = 0; s < 3; s++) {
    const base = top + 2 + (s + 1) * 8 - 1;
    let bx = x + (left ? 2 : 0);
    let k = 0;
    while (bx < x + T - (right ? 2 : 0)) {
      const bw = 2 + Math.floor(grain(at.row, at.col, s * 20 + k) * 2);
      const bh = 4 + Math.floor(grain(at.row, at.col, s * 20 + k + 50) * 3);
      if (grain(at.row, at.col, s * 20 + k + 90) > 0.12) {
        bctx.fillStyle = BOOKS[Math.floor(grain(at.row, at.col, s * 20 + k + 70) * BOOKS.length)];
        bctx.fillRect(bx, base - bh, Math.min(bw, x + T - (right ? 2 : 0) - bx), bh);
      }
      bx += bw;
      k++;
    }
    bctx.fillStyle = WOODWORK.leg;
    bctx.fillRect(x, base, T, 1);
  }
  bctx.fillStyle = WOODWORK.front;
  if (left) bctx.fillRect(x, top, 1, h);
  if (right) bctx.fillRect(x + T - 1, top, 1, h);
  bctx.fillRect(x, top, T, 1);
}

// A plain table: one top across its tiles, legs at its ends.
function drawTable(x, y, left, right) {
  const x0 = x + (left ? 1 : 0), x1 = x + (right ? T - 1 : T);
  bctx.fillStyle = WOODWORK.top;
  bctx.fillRect(x0, y + 3, x1 - x0, 8);
  bctx.fillStyle = WOODWORK.topLight;
  bctx.fillRect(x0, y + 3, x1 - x0, 1);
  bctx.fillStyle = WOODWORK.front;
  bctx.fillRect(x0, y + 11, x1 - x0, 2);
  bctx.fillStyle = WOODWORK.leg;
  if (left) bctx.fillRect(x + 2, y + 13, 1, 3);
  if (right) bctx.fillRect(x + T - 3, y + 13, 1, 3);
}

// A bench: a grey top over cupboards, a tap on each tile (the lab's, and
// the hall's seats share the shape).
function drawBench(x, y, left, right) {
  const x0 = x + (left ? 1 : 0), x1 = x + (right ? T - 1 : T);
  bctx.fillStyle = METAL.top;
  bctx.fillRect(x0, y + 3, x1 - x0, 4);
  bctx.fillStyle = METAL.front;
  bctx.fillRect(x0, y + 7, x1 - x0, 9);
  bctx.fillStyle = METAL.seam;
  bctx.fillRect(x + 8, y + 8, 1, 7);
  bctx.fillStyle = METAL.tap;
  bctx.fillRect(x + 7, y + 1, 2, 3);
}

// An easel, its canvas turned away: three legs and the board's back.
function drawEasel(x, y) {
  bctx.fillStyle = EASEL.leg;
  bctx.fillRect(x + 4, y + 2, 1, 14);
  bctx.fillRect(x + 11, y + 2, 1, 14);
  bctx.fillRect(x + 8, y - 2, 1, 15);
  bctx.fillStyle = EASEL.frame;
  bctx.fillRect(x + 3, y - 6, 10, 11);
  bctx.fillStyle = EASEL.board;
  bctx.fillRect(x + 4, y - 5, 8, 9);
}

// A sink on its pedestal, its tap above.
function drawSink(x, y) {
  bctx.fillStyle = PORCELAIN.pipe;
  bctx.fillRect(x + 7, y + 9, 2, 7);
  bctx.fillStyle = PORCELAIN.bowl;
  bctx.fillRect(x + 3, y + 4, 10, 5);
  bctx.fillStyle = PORCELAIN.shade;
  bctx.fillRect(x + 5, y + 5, 6, 2);
  bctx.fillStyle = METAL.tap;
  bctx.fillRect(x + 7, y + 2, 2, 2);
}

// A stall: a tall door, shut, with the gap under it.
function drawStall(x, y) {
  bctx.fillStyle = STALL.edge;
  bctx.fillRect(x + 1, y - 10, 14, 1);
  bctx.fillStyle = STALL.door;
  bctx.fillRect(x + 1, y - 9, 14, 22);
  bctx.fillStyle = STALL.edge;
  bctx.fillRect(x + 11, y + 2, 2, 1);
  bctx.fillStyle = STALL.gap;
  bctx.fillRect(x + 1, y + 13, 14, 3);
}

// A sofa: its back, its seat, an arm at each end.
function drawSofa(x, y, left, right) {
  bctx.fillStyle = SOFA.back;
  bctx.fillRect(x, y + 1, T, 6);
  bctx.fillStyle = SOFA.seat;
  bctx.fillRect(x, y + 7, T, 7);
  bctx.fillStyle = SOFA.arm;
  if (left) bctx.fillRect(x, y + 3, 3, 12);
  if (right) bctx.fillRect(x + T - 3, y + 3, 3, 12);
  bctx.fillRect(x, y + 14, T, 2);
}

const PIECES = {
  desk: drawSchoolDesk, teacher: drawTeacherDesk, shelf: drawShelf, table: drawTable, bench: drawBench,
  easel: drawEasel, sink: drawSink, stall: drawStall, sofa: drawSofa,
};
