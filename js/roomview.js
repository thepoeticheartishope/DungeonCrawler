// The room view (room view plan, `ideas/room-view-plan.md` outside the
// repo): a fixed camera looking down on one room at a time at the angle
// of the RPG Maker horror games, drawn as pixel art. Back walls show their
// face, the floor runs toward the player, and the dark round the room is
// black. Built beside the shoulder view behind ?view=room until step G.
//
// Step A draws the walls (faces, the rim round each room), the floors, the
// light, the player's stick man, and every other thing as its glyph. The
// picture is drawn at ROOM_VIEW.tilePx a tile into a small canvas, lit
// there, and scaled up by a whole number with smoothing off.
//
// The light is the rules' light, not its own: lit tiles are the floor's
// visibleSet, remembered ones its exploredSet (sight.js). On top of that,
// the room the player is in shows dimly, so they see its shape. Each tile
// gets one level; a tiny canvas of those levels is scaled up smoothly and
// multiplied over the picture, so the light's edges are soft.
//
// mapview.js calls drawRoomScene() from its drawScene when roomViewWanted(),
// and roomTileAt() / roomGridAt() to turn a tap into a tile or a floor
// point. faceOf, viewScale and cameraGoal are exported for the tests.
// Reads state and never changes it.

import { state, key } from './state.js';
import {
  ROOM_VIEW, PLAYER_CONE_RANGE, MAP_GLYPH_SIZES, ISO_TILES_ACROSS, ISO_TILES_ACROSS_NARROW,
  ISO_NARROW_MAP_WIDTH, PLAYER_GLANCE, PLAYER_EMBER,
} from './config.js';
import { lookAngle, wrapAngle } from './look.js';
import { playerPose, playerActive, resetPlayerForm, emberGlow } from './playerform.js';

const T = ROOM_VIEW.tilePx;
const ENEMY_KINDS = ['minion', 'hunter']; // what a tap on its glyph picks (gun.js pickTarget)

// The picture's colours. Rooms and hallways only differ in floor and
// wallpaper for now; each room gets its own look in step E.
const WOOD = { base: '#4a3427', light: '#4f3829', dark: '#463124', seam: '#2f2118', knot: '#5a4130' };
const LINO = { a: '#4f5357', b: '#43474b', scuff: '#35383b' };
const PAPER = { room: ['#5f5560', '#685d69'], hall: ['#565b62', '#5e646b'] };
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

  const at = look.walkAt;
  const space = spaceOf(f.playerRow, f.playerCol);
  const goal = cameraGoal(space.bounds, { x: (at.col + 0.5) * T, y: (at.row + 0.5) * T }, viewW, viewH);
  if (moveCamera(goal) || at.row !== f.playerRow || at.col !== f.playerCol) look.showPlain();
  const ox = Math.round(shownCam.x);
  const oy = Math.round(shownCam.y);

  // The picture: the still floor, then what stands on it, back to front.
  bctx.globalCompositeOperation = 'source-over';
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, viewW, viewH);
  bctx.drawImage(built.world, ox, oy, viewW, viewH, 0, 0, viewW, viewH);
  const items = [];
  const c0 = Math.floor(ox / T) - 1, c1 = Math.ceil((ox + viewW) / T) + 1;
  const r0 = Math.floor(oy / T) - 1, r1 = Math.ceil((oy + viewH) / T) + 2;
  f.pillarSet.forEach(k => {
    const [row, col] = tileOf(k);
    if (row >= r0 && row <= r1 && col >= c0 && col <= c1) items.push({ y: row + 1, draw: () => drawPillar(row, col, ox, oy) });
  });
  items.push({ y: at.row + ROOM_VIEW.footAt + 0.01, draw: () => drawStickMan(at, ox, oy) });
  items.sort((a, b) => a.y - b.y).forEach(item => item.draw());

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
  bctx.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, viewW, viewH, 0, 0, viewW * scale, viewH * scale);
  ctx.imageSmoothingEnabled = true;
  drawGlyphs(ctx, ox, oy);
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
      if (!isWall(row, col)) drawFloorTile(ctx, row, col, f.chamberAt.has(key(row, col)));
      else {
        const face = faceOf(row, col, isWall);
        if (face) drawFace(ctx, row, col, face, f.chamberAt.has(key(row + (face === 'lower' ? 1 : 2), col)));
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

// Floor in a room is planks of wood; hallway floor is lino in squares.
function drawFloorTile(ctx, row, col, inRoom) {
  const x = col * T, y = row * T;
  if (inRoom) {
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

// A wall's face: wallpaper with a small diamond print, the moulding along
// the top of an upper face, the skirting board along the foot of a lower
// one, and a post where a doorway cuts through beside it.
function drawFace(ctx, row, col, face, inRoom) {
  const x = col * T, y = row * T;
  const paper = inRoom ? PAPER.room : PAPER.hall;
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
  const hands = [-1, 1].map(s => [shoulder[0] + s * h * 0.2, hip[1] - h * 0.02]);
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
    if (thing.kind === 'player') return;
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
}
