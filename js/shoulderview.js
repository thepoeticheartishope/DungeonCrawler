// The low shoulder view (shoulder view plan, `ideas/shoulder-view-plan.md`
// outside the repo): the floor in 3D from a close camera just behind and
// to the right of the player's stick man, below the wall tops, turning
// with the light. Walls hide what's past them, so only what is in sight
// shows. Built beside the isometric view behind a switch
// (state.settings.view, ?view=shoulder or DEV -> View) until it is ready.
//
// Step A, a test build: the floor (lit, remembered, hidden), walls,
// pillars, the stairs and the player's stick man. Everything else on the
// map stands in as a plain glyph for now (step C draws it properly).
//
// mapview.js calls drawShoulderScene() from its drawScene, with the same
// arguments as isoview.js drawIsoScene, and shoulderTileAt() /
// shoulderGridAt() to turn a tap on the map into a tile or a floor point
// (step B). The camera maths (shoulderCamera, toCamera, projectPoint,
// floorAt) are exported for the tests.
// Reads state and never changes it.

import { state, key } from './state.js';
import { SHOULDER_CAMERA, MAP_GLYPH_SIZES, MAP_ANIMATION_MS, ISO_TILES_ACROSS, ISO_TILES_ACROSS_NARROW, ISO_NARROW_MAP_WIDTH } from './config.js';
import { lookAngle, wrapAngle } from './look.js';

// Light, as in isoview.js: the player's own light fades over five steps,
// the boss's light shows floor at a middle level, remembered floor is dim.
const LIGHT_FALLOFF = [1, 1, 0.85, 0.7, 0.56, 0.44];
const BOSS_LIT_LEVEL = 0.5;
const REMEMBERED_LEVEL = 0.2;
// Far things fade toward this share of their brightness, losing
// 1 / DISTANCE_FADE of it per tile past DISTANCE_FADE_FROM.
const DISTANCE_FADE = 11;
const DISTANCE_FADE_FROM = 2.75;
const DISTANCE_FADE_MIN = 0.2;
const NEAR = 0.06;            // the camera's near plane, in tiles: anything closer is cut off
const CULL_BEHIND = -1;       // a tile whose middle is this far behind the camera isn't drawn at all
const CULL_SIDE = 1.5;        // nor one this many tiles outside the sides of the view
const PILLAR_INSET = 0.24;    // as in isoview.js: a pillar is thinner than its tile
const STAIR_STEPS = 4;
const STAIR_INSET = [0.08, 0.09]; // the first step's inset, then each next one's
const STAIR_DROP = 0.08;          // how far each step sinks, in tiles
// The camera never stands in a wall: it is pulled in, side first, then
// back, until a line of PULL_SAMPLES points from the player to it, each
// with PULL_MARGIN of room round it, is clear.
const PULL_SAMPLES = 6;
const PULL_MARGIN = 0.12;
const PULL_TRIES = 12;
const PULL_SIDE_KEEP = 0.6;   // each try keeps this share of the side offset...
const PULL_SIDE_MIN = 0.05;   // ...until it is this small, then drops it
const PULL_BACK_KEEP = 0.8;   // and then keeps this share of the distance back
// A wall standing between the camera and the player shows only as a
// faint outline, at this share of its brightness, within GHOST_WIDTH
// tiles of the line between them.
const GHOST_LEVEL = 0.3;
const GHOST_WIDTH = 0.95;
// Phosphor lines: a line's width as a share of the map's width on the
// page (never under LINE_MIN_PX), with the glow as two wider, fainter
// strokes under it (isoview.js HALO_LAYERS). Far, faint lines skip the
// glow, which costs most of a frame.
const LINE_SHARE = 0.0022;
const LINE_MIN_PX = 1.2;
const HALO_LAYERS = [{ width: 3.5, strength: 0.07 }, { width: 1.6, strength: 0.14 }];
const HALO_MIN_LEVEL = 0.25;
// The edges of a wall face as shares of its brightness: top, foot, corners.
const EDGE_TOP = 0.9;
const EDGE_FOOT = 0.35;
const EDGE_CORNER = 0.55;
// The player's stick man, in tiles and shares of its height.
const STICK_HEIGHT = 0.75;
const STICK_LINE = 0.05;
const STICK_BREATH = 0.02;
const STICK_STRIDE = 0.13;
// With the camera pulled in close (a wall behind), the stick man fades so
// he doesn't fill the screen: full at CLOSE_FADE.far tiles away, down to
// CLOSE_FADE.level at CLOSE_FADE.near.
const CLOSE_FADE = { near: 0.35, far: 0.8, level: 0.2 };
// The dark pressing in at the screen's edges, like a torch's edge.
const VIGNETTE = { inner: 0.25, outer: 0.75, dark: 0.5, middleY: 0.6 };
const GLYPH_CELL = 0.85;      // as in isoview.js: the tile size glyphs are sized for
const GLYPH_RISE = 0.45;      // a glyph's middle sits this share of its height above the floor
const ENEMY_KINDS = ['minion', 'hunter']; // what a tap on its glyph picks (gun.js pickTarget)
// The four sides of a tile: the way out (n), its two corners (a, b) and
// the way along it from a to b (t), on the grid with x = col, y = row.
const SIDES = [
  { n: [0, -1], a: [0, 0], b: [1, 0], t: [1, 0] },
  { n: [1, 0], a: [1, 0], b: [1, 1], t: [0, 1] },
  { n: [0, 1], a: [1, 1], b: [0, 1], t: [-1, 0] },
  { n: [-1, 0], a: [0, 1], b: [0, 0], t: [0, -1] },
];

// View-only, so it lives here and not in state.
let shownLook = null;   // the drawn light's angle (radians on the grid), easing toward lookAngle()
let pulled = null;      // { side, back }: the camera's offsets now, easing toward what the walls allow
let lastFrameAt = 0;    // the last frame's time
let shownFloor = -1;    // the floor (state.run.floorsEntered) last drawn: a new floor snaps the camera
// This frame's drawing, set by drawShoulderScene.
let look = null;        // what mapview.js passed in
let cam = null;         // the camera (shoulderCamera)
let width = 0;
let height = 0;
let lineWidth = 1;
let pageWidth = 0;      // the map's width on the page, in CSS pixels
let pageScale = 1;      // canvas pixels per CSS pixel
let tapBoxes = [];      // this frame's stick men and other enemies, nearest first, for taps: [{ box: [left, top, right, bottom], tile }]

// Draws the whole map from the shoulder camera: the floor, then the walls,
// pillars, glyphs and the player, far to near, then the dark at the edges.
// `canvasSize` is { width, height, pageWidth }; `shared` is what
// mapview.js hands the isometric view (colours, things, fogOf, paintGlyph,
// pulse, keepMoving, showPlain, now, still, walkAt).
export function drawShoulderScene(ctx, canvasSize, shared) {
  look = shared;
  width = canvasSize.width;
  height = canvasSize.height;
  pageWidth = canvasSize.pageWidth;
  pageScale = canvasSize.pageWidth ? width / canvasSize.pageWidth : 1;
  lineWidth = Math.max(LINE_MIN_PX, canvasSize.pageWidth * LINE_SHARE) * pageScale;
  const at = { x: look.walkAt.col + 0.5, y: look.walkAt.row + 0.5 };
  const moving = moveCamera(at);
  if (moving || look.walkAt.row !== state.floor.playerRow || look.walkAt.col !== state.floor.playerCol) look.showPlain();
  cam = cameraAt(at, shownLook, pulled.side, pulled.back, width, height);
  drawFloor(ctx);
  const boxes = [];
  const items = [...wallItems(ctx), ...thingItems(ctx, boxes)];
  items.sort((a, b) => b.d - a.d).forEach(item => item.draw());
  tapBoxes = boxes.sort((a, b) => a.d - b.d);
  drawVignette(ctx);
}

// The tile under a tap at (px, py) CSS pixels from the map's top-left: an
// enemy whose glyph is under it first (nearest first: it stands up over
// the floor behind it), else the floor tile the tap's ray meets; null
// before the first frame or above the horizon.
export function shoulderTileAt(px, py) {
  if (!cam) return null;
  const x = px * pageScale;
  const y = py * pageScale;
  const hit = tapBoxes.find(({ box }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]);
  if (hit) return { row: hit.tile.row, col: hit.tile.col };
  const at = shoulderGridAt(px, py);
  return at && { row: Math.floor(at.row), col: Math.floor(at.col) };
}

// The floor point under a tap at (px, py) CSS pixels, in grid terms with
// a tile's middle at whole numbers (as isoview.js isoGridAt), or null.
export function shoulderGridAt(px, py) {
  if (!cam) return null;
  const at = floorAt(cam, px * pageScale, py * pageScale);
  return at && { row: at[1] - 0.5, col: at[0] - 0.5 };
}

// Where the ray from camera `c` through canvas pixel (sx, sy) meets the
// floor, as [x, y] (x = col, y = row, tile middles at .5), or null when
// it points level or up (at or above the horizon).
export function floorAt(c, sx, sy) {
  const right = (sx - c.w / 2) / c.focal;
  const up = (c.h / 2 - sy) / c.focal;
  const ray = [0, 1, 2].map(i => c.F[i] + c.R[i] * right + c.U[i] * up);
  if (ray[2] >= -1e-6) return null;
  const s = -c.z / ray[2];
  return [c.x + ray[0] * s, c.y + ray[1] * s];
}

// Eases the drawn light toward the real one and the camera's offsets
// toward what the walls allow, by the time since the last frame. A new
// floor, or reduced motion, snaps both. Returns true while either moves.
function moveCamera(at) {
  const now = look.now;
  const goal = lookAngle();
  const pull = pulledIn(at, goal);
  const snap = look.still || shownLook === null || shownFloor !== state.run.floorsEntered;
  const dt = Math.min(50, Math.max(0, now - lastFrameAt));
  lastFrameAt = now;
  shownFloor = state.run.floorsEntered;
  if (snap) {
    shownLook = goal;
    pulled = pull;
    return false;
  }
  const turnLeft = wrapAngle(goal - shownLook);
  shownLook = Math.abs(turnLeft) < 0.002 ? goal : shownLook + turnLeft * (1 - Math.exp(-dt / SHOULDER_CAMERA.turnMs));
  const ease = 1 - Math.exp(-dt / SHOULDER_CAMERA.pullMs);
  const settle = (from, to) => (Math.abs(to - from) < 0.002 ? to : from + (to - from) * ease);
  pulled = { side: settle(pulled.side, pull.side), back: settle(pulled.back, pull.back) };
  return shownLook !== goal || pulled.side !== pull.side || pulled.back !== pull.back;
}

// How far right and back the camera can stand behind the player at `at`
// looking at `angle` without being in a wall (pulled in side first, then
// back), from SHOULDER_CAMERA's side and back.
export function pulledIn(at, angle, solid = isSolid) {
  const [fx, fy] = forwardOf(angle);
  const [rx, ry] = [-fy, fx];
  const clear = (side, back) => {
    for (let i = 1; i <= PULL_SAMPLES; i++) {
      const q = i / PULL_SAMPLES;
      const x = at.x + (-fx * back + rx * side) * q;
      const y = at.y + (-fy * back + ry * side) * q;
      for (const [ox, oy] of [[PULL_MARGIN, 0], [-PULL_MARGIN, 0], [0, PULL_MARGIN], [0, -PULL_MARGIN]]) {
        if (solid(Math.floor(y + oy), Math.floor(x + ox))) return false;
      }
    }
    return true;
  };
  let side = SHOULDER_CAMERA.side;
  let back = SHOULDER_CAMERA.back;
  for (let i = 0; i < PULL_TRIES && !clear(side, back); i++) {
    if (side > PULL_SIDE_MIN) side *= PULL_SIDE_KEEP;
    else {
      side = 0;
      back *= PULL_BACK_KEEP;
    }
  }
  return { side, back };
}

// The camera for a player at `at` ({ x: col, y: row }, tile middles at
// .5) looking at `angle`, `side` right of them and `back` behind, on a
// canvas `w` by `h` pixels: its place, its axes (F ahead, R right, U up)
// and its focal length in pixels (from the field of view across `w`).
export function cameraAt(at, angle, side, back, w, h) {
  const [fx, fy] = forwardOf(angle);
  const [rx, ry] = [-fy, fx];
  const z = SHOULDER_CAMERA.height;
  const pitch = Math.atan2(z - SHOULDER_CAMERA.aimHeight, back + SHOULDER_CAMERA.aimAhead);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: at.x - fx * back + rx * side, y: at.y - fy * back + ry * side, z,
    F: [fx * cp, fy * cp, -sp], R: [rx, ry, 0], U: [fx * sp, fy * sp, cp],
    focal: (w / 2) / Math.tan(SHOULDER_CAMERA.fov * Math.PI / 360), w, h,
  };
}

// The camera for a player at `at` looking at `angle`, pulled in from the
// walls by `solid(row, col)`: the whole set-up in one call, for the tests.
export function shoulderCamera(at, angle, w, h, solid = isSolid) {
  const { side, back } = pulledIn(at, angle, solid);
  return cameraAt(at, angle, side, back, w, h);
}

// The way a grid angle points as [x, y] (x = col, y = row): 0 is north
// (row -1), +π/2 east (col +1), as in look.js.
function forwardOf(angle) {
  return [Math.sin(angle), -Math.cos(angle)];
}

// A world point [x, y, z] (x = col, y = row, z up, in tiles) in the
// camera's own terms: [right, up, ahead].
export function toCamera(c, [x, y, z]) {
  const dx = x - c.x;
  const dy = y - c.y;
  const dz = z - c.z;
  return [
    dx * c.R[0] + dy * c.R[1] + dz * c.R[2],
    dx * c.U[0] + dy * c.U[1] + dz * c.U[2],
    dx * c.F[0] + dy * c.F[1] + dz * c.F[2],
  ];
}

// Where a point in the camera's terms lands on the canvas, in pixels.
function toScreen(c, [x, y, z]) {
  return [c.w / 2 + c.focal * x / z, c.h / 2 - c.focal * y / z];
}

// Where a world point lands on the canvas, or null when it is behind the
// near plane.
export function projectPoint(c, point) {
  const p = toCamera(c, point);
  return p[2] < NEAR ? null : toScreen(c, p);
}

// A polygon in the camera's terms with the part behind the near plane
// cut off.
function clipNear(points) {
  const out = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const aIn = a[2] >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== (b[2] >= NEAR)) {
      const s = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, NEAR]);
    }
  });
  return out;
}

// Traces a world polygon on the canvas, cut at the near plane. Returns
// false when none of it is in front of the camera.
function tracePolygon(ctx, points) {
  const clipped = clipNear(points.map(p => toCamera(cam, p)));
  if (clipped.length < 3) return false;
  ctx.beginPath();
  clipped.forEach((p, i) => {
    const [sx, sy] = toScreen(cam, p);
    if (i) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
  });
  ctx.closePath();
  return true;
}

// A phosphor line between two world points at strength `level`, cut at
// the near plane, with the glow under it unless it is faint.
function line3(ctx, a, b, level) {
  if (level <= 0.005) return;
  let p = toCamera(cam, a);
  let q = toCamera(cam, b);
  if (p[2] < NEAR && q[2] < NEAR) return;
  const cut = (from, to) => {
    const s = (NEAR - from[2]) / (to[2] - from[2]);
    return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s, NEAR];
  };
  if (p[2] < NEAR) p = cut(p, q);
  if (q[2] < NEAR) q = cut(q, p);
  const [px, py] = toScreen(cam, p);
  const [qx, qy] = toScreen(cam, q);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(qx, qy);
  glowStroke(ctx, level, lineWidth);
}

// Strokes the current path as a phosphor line at strength `level` and
// `w` pixels wide: the halo layers first, then the line.
function glowStroke(ctx, level, w, rgb = look.colours.glowRgb) {
  const colour = a => 'rgba(' + rgb + ', ' + a + ')';
  if (level >= HALO_MIN_LEVEL) {
    HALO_LAYERS.forEach(l => {
      ctx.strokeStyle = colour(Math.min(0.8, level) * l.strength);
      ctx.lineWidth = w * l.width;
      ctx.stroke();
    });
  }
  ctx.strokeStyle = colour(level);
  ctx.lineWidth = w;
  ctx.stroke();
}

// Whether a world point near the floor is worth drawing: not well behind
// the camera, not far outside the sides of the view, and within reach.
function inView(x, y, z = 0) {
  if (Math.hypot(x - cam.x, y - cam.y) > SHOULDER_CAMERA.reach + 1) return false;
  const [rx, , ahead] = toCamera(cam, [x, y, z]);
  if (ahead < CULL_BEHIND) return false;
  const halfWidth = Math.max(0, ahead) * (cam.w / 2) / cam.focal;
  return Math.abs(rx) <= halfWidth + CULL_SIDE;
}

// How much further things fade, 1 near the camera to DISTANCE_FADE_MIN.
function fadeAt(d) {
  return Math.max(DISTANCE_FADE_MIN, Math.min(1, 1 - (d - DISTANCE_FADE_FROM) / DISTANCE_FADE));
}

function distance(x, y, z) {
  return Math.hypot(x - cam.x, y - cam.y, z - cam.z);
}

// Off the floor's edge counts as wall.
function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

function isSolid(row, col) {
  return isWall(row, col) || state.floor.pillarSet.has(key(row, col));
}

// How bright a floor tile is, from 0 (hidden) to 1, as in isoview.js.
function floorLevel(row, col) {
  if (isWall(row, col)) return 0;
  const fog = look.fogOf(row, col);
  if (fog === 'hidden') return 0;
  if (fog === 'dim') return REMEMBERED_LEVEL;
  if (!state.settings.fogEnabled) return 1;
  if (!state.floor.sightSet.has(key(row, col))) return BOSS_LIT_LEVEL;
  const steps = Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol));
  return LIGHT_FALLOFF[Math.min(steps, LIGHT_FALLOFF.length - 1)];
}

// Every tile within reach of the camera worth drawing, as { row, col }.
function tilesInView() {
  const tiles = [];
  const reach = SHOULDER_CAMERA.reach;
  const cr = Math.floor(cam.y);
  const cc = Math.floor(cam.x);
  for (let row = cr - reach; row <= cr + reach; row++) {
    for (let col = cc - reach; col <= cc + reach; col++) {
      if (inView(col + 0.5, row + 0.5)) tiles.push({ row, col });
    }
  }
  return tiles;
}

// The floor the player has seen, each tile filled and outlined by how
// bright it is, and the stairs sinking into theirs. Flat tiles never
// overlap, so they need no order.
function drawFloor(ctx) {
  const rgb = look.colours.glowRgb;
  ctx.lineWidth = 1;
  tilesInView().forEach(({ row, col }) => {
    const base = floorLevel(row, col);
    if (!base) return;
    const level = base * fadeAt(distance(col + 0.5, row + 0.5, 0));
    if (!tracePolygon(ctx, [[col, row, 0], [col + 1, row, 0], [col + 1, row + 1, 0], [col, row + 1, 0]])) return;
    ctx.fillStyle = 'rgba(' + rgb + ', ' + (0.02 + 0.09 * level) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + rgb + ', ' + (0.03 + 0.14 * level) + ')';
    ctx.stroke();
  });
  look.things.filter(thing => thing.kind === 'stairs').forEach(thing => drawStairs(ctx, thing.at));
}

// The stairs down: squares sinking into the floor, pulsing. Drawn even on
// floor the player hasn't seen: they're the way out.
function drawStairs(ctx, at) {
  if (!inView(at.col + 0.5, at.row + 0.5)) return;
  look.keepMoving();
  const strength = (0.7 + 0.3 * look.pulse(MAP_ANIMATION_MS.glow)) * fadeAt(distance(at.col + 0.5, at.row + 0.5, 0));
  for (let i = 0; i < STAIR_STEPS; i++) {
    const inset = STAIR_INSET[0] + STAIR_INSET[1] * i;
    const z = -STAIR_DROP * i;
    const [x0, y0, x1, y1] = [at.col + inset, at.row + inset, at.col + 1 - inset, at.row + 1 - inset];
    const square = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
    square.forEach((p, j) => line3(ctx, p, square[(j + 1) % 4], (0.95 - i * 0.18) * strength));
  }
}

// Walls are never lit themselves (the light stops at them), so a wall
// shows once any floor beside it, corners included, has been seen.
function wallShown(row, col) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!isWall(row + dr, col + dc) && look.fogOf(row + dr, col + dc) !== 'hidden') return true;
    }
  }
  return false;
}

// Whether a wall at (row, col) stands between the camera and the player,
// so it shows only as a faint outline.
function hidesPlayer(row, col, player) {
  const [tx, ty] = [player.x - cam.x, player.y - cam.y];
  const span = Math.hypot(tx, ty);
  if (span < 1e-6) return false;
  const [vx, vy] = [col + 0.5 - cam.x, row + 0.5 - cam.y];
  const along = (vx * tx + vy * ty) / (span * span);
  if (along <= 0 || along >= 1) return false;
  return Math.abs(vx * ty - vy * tx) / span < GHOST_WIDTH;
}

// The standing faces of the walls and pillars in view, each as
// { d, draw } to sort far to near: only faces turned toward the camera,
// none between two walls (joined walls show no seam), lit by the floor in
// front of them.
function wallItems(ctx) {
  const items = [];
  const player = { x: look.walkAt.col + 0.5, y: look.walkAt.row + 0.5 };
  const wallH = SHOULDER_CAMERA.wallHeight;
  tilesInView().forEach(({ row, col }) => {
    if (isWall(row, col)) {
      if (!wallShown(row, col)) return;
      const ghost = hidesPlayer(row, col, player);
      SIDES.forEach(side => {
        const front = floorLevel(row + side.n[1], col + side.n[0]);
        if (isWall(row + side.n[1], col + side.n[0]) || !front) return;
        const item = faceItem(ctx, row, col, side, 0, wallH, front, ghost);
        if (item) items.push(item);
      });
      return;
    }
    if (!state.floor.pillarSet.has(key(row, col))) return;
    const level = Math.max(floorLevel(row, col), ...SIDES.map(s => floorLevel(row + s.n[1], col + s.n[0])));
    if (!level) return;
    SIDES.forEach(side => {
      const item = faceItem(ctx, row, col, side, PILLAR_INSET, wallH * SHOULDER_CAMERA.pillarHeight, level, false);
      if (item) items.push(item);
    });
  });
  return items;
}

// One upright face of the block on (row, col) on `side`, `inset` in from
// the tile's edge and `h` tall, at brightness `base`, or null when it
// faces away from the camera. A wall's face draws its corner edges only
// where its run ends or turns.
function faceItem(ctx, row, col, side, inset, h, base, ghost) {
  const span = 1 - 2 * inset;
  const ax = col + inset + side.a[0] * span;
  const ay = row + inset + side.a[1] * span;
  const bx = col + inset + side.b[0] * span;
  const by = row + inset + side.b[1] * span;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  if ((mx - cam.x) * side.n[0] + (my - cam.y) * side.n[1] >= 0) return null;
  const d = distance(mx, my, h / 2);
  const level = base * fadeAt(d);
  const wall = !inset;
  return {
    d, draw: () => {
      const quad = [[ax, ay, 0], [bx, by, 0], [bx, by, h], [ax, ay, h]];
      if (!ghost && tracePolygon(ctx, quad)) {
        ctx.fillStyle = 'rgb(' + Math.round(5 + 14 * level) + ', ' + Math.round(6 + 16 * level) + ', ' + Math.round(7 + 16 * level) + ')';
        ctx.fill();
      }
      const shown = level * (ghost ? GHOST_LEVEL : 1);
      line3(ctx, quad[2], quad[3], EDGE_TOP * shown);
      line3(ctx, quad[0], quad[1], EDGE_FOOT * shown);
      [[1, 1], [0, -1]].forEach(([end, way]) => {
        const nr = row + side.t[1] * way;
        const nc = col + side.t[0] * way;
        const runGoesOn = isWall(nr, nc) && !isWall(nr + side.n[1], nc + side.n[0]);
        if (wall && runGoesOn) return;
        line3(ctx, quad[end], quad[end === 1 ? 2 : 3], EDGE_CORNER * shown);
      });
    },
  };
}

// The player's stick man and, until step C, every other thing on the map
// as its plain glyph standing on its tile, each as { d, draw }. Enemies'
// glyph boxes go into `boxes` as they are drawn, for taps.
function thingItems(ctx, boxes) {
  const items = [];
  look.things.forEach(thing => {
    if (thing.kind === 'stairs') return;
    const x = thing.at.col + 0.5;
    const y = thing.at.row + 0.5;
    if (!inView(x, y)) return;
    const d = distance(x, y, 0.35);
    if (thing.kind === 'player') items.push({ d, draw: () => drawStickMan(ctx, x, y) });
    else items.push({ d, draw: () => {
      const box = drawGlyph(ctx, thing, x, y);
      if (box && ENEMY_KINDS.includes(thing.kind)) boxes.push({ d, box, tile: thing.tile });
    } });
  });
  return items;
}

// A thing's glyph upright on its tile, never smaller than the isometric
// map draws it (shoulder view plan, call 7), dimmer with distance.
// Returns the box it covers on the canvas, feet included, or null.
function drawGlyph(ctx, thing, x, y) {
  const ground = toCamera(cam, [x, y, 0]);
  if (ground[2] < NEAR) return null;
  const across = pageWidth < ISO_NARROW_MAP_WIDTH ? ISO_TILES_ACROSS_NARROW : ISO_TILES_ACROSS;
  const cell = Math.max(width / across, cam.focal / ground[2]) * GLYPH_CELL;
  const [sx, sy] = toScreen(cam, ground);
  const rise = cell * MAP_GLYPH_SIZES[thing.look.size] * GLYPH_RISE + (thing.look.lift || 0) * cell / GLYPH_CELL;
  const alpha = (thing.look.alpha === undefined ? 1 : thing.look.alpha) * fadeAt(distance(x, y, 0));
  look.paintGlyph(ctx, cell, sx, sy - rise, thing.glyph, { ...thing.look, alpha });
  const half = cell * MAP_GLYPH_SIZES[thing.look.size] / 2;
  return [sx - half, sy - rise - half, sx + half, sy];
}

// The player as a stick man seen from behind, standing at (x, y): breathes
// standing still, feet swing apart on a step, and fades with the camera
// pulled in close.
function drawStickMan(ctx, x, y) {
  const foot = toCamera(cam, [x, y, 0]);
  const top = toCamera(cam, [x, y, STICK_HEIGHT]);
  if (foot[2] < NEAR || top[2] < NEAR) return;
  const [fx, fy] = toScreen(cam, foot);
  const h = fy - toScreen(cam, top)[1];
  if (h < 2) return;
  const f = state.floor;
  const off = Math.max(Math.abs(look.walkAt.row - f.playerRow), Math.abs(look.walkAt.col - f.playerCol));
  let breath = 0;
  if (!look.still) {
    look.keepMoving();
    breath = Math.sin(look.now / MAP_ANIMATION_MS.playerBreath * Math.PI * 2) * h * STICK_BREATH;
  }
  const stride = Math.sin(Math.min(off, 1) * Math.PI) * h * STICK_STRIDE;
  const headR = h * 0.12;
  const headY = fy - h + headR - breath;
  const neck = [fx, headY + headR];
  const hip = [fx, fy - h * 0.42];
  const shoulder = [fx, neck[1] + h * 0.08];
  const near = (Math.hypot(x - cam.x, y - cam.y) - CLOSE_FADE.near) / (CLOSE_FADE.far - CLOSE_FADE.near);
  ctx.save();
  ctx.globalAlpha = CLOSE_FADE.level + (1 - CLOSE_FADE.level) * Math.max(0, Math.min(1, near));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(fx - h * 0.13 + stride, fy);
  ctx.lineTo(hip[0], hip[1]);
  ctx.lineTo(fx + h * 0.13 - stride, fy);
  ctx.moveTo(hip[0], hip[1]);
  ctx.lineTo(neck[0], neck[1]);
  ctx.moveTo(fx - h * 0.2, hip[1] + breath);
  ctx.lineTo(shoulder[0], shoulder[1]);
  ctx.lineTo(fx + h * 0.2, hip[1] + breath);
  ctx.moveTo(fx + headR, headY);
  ctx.arc(fx, headY, headR, 0, Math.PI * 2);
  glowStroke(ctx, 1, Math.max(1.5, h * STICK_LINE));
  ctx.restore();
}

// The dark pressing in at the edges of the screen.
function drawVignette(ctx) {
  const cx = width / 2;
  const cy = height * VIGNETTE.middleY;
  const g = ctx.createRadialGradient(cx, cy, Math.min(width, height) * VIGNETTE.inner, cx, cy, Math.max(width, height) * VIGNETTE.outer);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, ' + VIGNETTE.dark + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}
