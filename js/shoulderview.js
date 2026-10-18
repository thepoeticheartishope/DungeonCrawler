// The low shoulder view (shoulder view plan, `ideas/shoulder-view-plan.md`
// outside the repo): the floor in 3D from a close camera just behind and
// to the right of the player's stick man, below the wall tops, turning
// with the light. Walls hide what's past them, so only what is in sight
// shows. Built beside the isometric view behind a switch
// (state.settings.view, ?view=shoulder or DEV -> View) until it is ready.
//
// It draws the floor (lit, remembered, hidden, the boss's mist), walls,
// pillars, doorways, the stairs and their light, the player's stick man
// (step A), and everything on the floor (step C): boxes, energy cells,
// papers, grates, the desk's warm pool, stick men (stickforms.js) with
// their eyes and '!', letters they drop, the answer ring and the
// tutorial's ring; every other thing as its glyph, never smaller than on
// the isometric map. Simple enemies keep their still glyphs here too.
// With the gun on (step D) the stick man holds it, the tiles it reaches
// are lit faintly, brackets mark what can be shot, a dashed laser runs to
// the target, and the last shot (mapshared.js) plays as a flash or a MISS.
// Holding Space or pushing the look stick up (sky eye plan step A) tilts
// the camera up to the sky, where the eye hangs: the boss's light's time
// left, shut when a floor begins and opening as the light spreads (in
// Comfort mode, the turns left as a number).
//
// mapview.js calls drawShoulderScene() from its drawScene, with the same
// arguments as isoview.js drawIsoScene, and shoulderTileAt() /
// shoulderGridAt() to turn a tap on the map into a tile or a floor point
// (step B). The camera maths (shoulderCamera, toCamera, projectPoint,
// floorAt) are exported for the tests. main.js calls lookUp() while the
// player looks up; it is view-only, like the camera.
// Reads state and never changes it.

import { state, key } from './state.js';
import {
  SHOULDER_CAMERA, SHOULDER_WIDE_FOV, MAP_GLYPH_SIZES, MAP_ANIMATION_MS, ISO_TILES_ACROSS,
  ISO_TILES_ACROSS_NARROW, ISO_NARROW_MAP_WIDTH, ENEMY_LIGHT, MINION_KINDS, ANSWER_RING, SKY_EYE,
} from './config.js';
import { lookAngle, wrapAngle } from './look.js';
import { canShoot } from './sight.js';
import { t } from './text.js';
import { drawStickForm, stickBox, dyingSticks, drawDroppedLetters } from './stickforms.js';
import { answerRingNow } from './swirl.js';
import {
  WALL_MIN_LEVEL, SEARCHED_LEVEL, PILLAR_INSET, BOX_INSET, BOX_HEIGHT, DRUM_RADIUS, DRUM_HEIGHT,
  DRUM_HOOPS, DRUM_ENDS, DRUM_END_SIZE, DRUM_BREATH, DRUM_BREATH_REACH, DESK_GLOW, DESK_GLOW_RADIUS,
  GLYPH_CELL, GLYPH_RISE, STAIR_STEPS, STAIR_INSET, STAIR_BEAM_HEIGHT, STAIR_BEAM_LAYERS,
  STAIR_BEAM_FADE, DOOR_POST, DOOR_ARCH_RISE, DOOR_ARCH_THICK, DOOR_ARCH_STEPS, DOOR_MIN_LEVEL,
  PAPER_SHEET, PAPER_LINES, SOUND_INSET, SOUND_LEVEL, HEARD_LIFT, GRATE_RATTLE, GRATE_RATTLE_SWAYS,
  GRATE_BARS, EYE_LIFT, EYE_WIDTH, REACH_FILL, BRACKET_ARM, BRACKET_HALF, BRACKET_LEVEL,
  BRACKET_PULSE, BRACKET_TEXT_SIZE, BRACKET_HP_GAP, LASER_LEVEL, SHOT_RING, MISS_TEXT_SIZE,
  MISS_RISE, WEAK_RING, WEAK_RING_LEVEL, PAPER_SCALE, GRATE_SCALE, ISO_STICK_HEIGHT, floorLevelOf,
  wallShownBy, searched, minionOn, liveTarget, inReach, lastShot, recoilAt, darkRingAt,
  answerRingLetters, eyeOf, skyEyeOpen, skyTurnsLeft,
} from './mapshared.js';

// Far things fade toward this share of their brightness, losing
// 1 / DISTANCE_FADE of it per tile past DISTANCE_FADE_FROM.
const DISTANCE_FADE = 11;
const DISTANCE_FADE_FROM = 2.75;
const DISTANCE_FADE_MIN = 0.2;
const NEAR = 0.06;            // the camera's near plane, in tiles: anything closer is cut off
const CULL_BEHIND = -1;       // a tile whose middle is this far behind the camera isn't drawn at all
const CULL_SIDE = 1.5;        // nor one this many tiles outside the sides of the view
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
const ENEMY_KINDS = ['minion', 'hunter']; // what a tap on its glyph picks (gun.js pickTarget)
// Props and the rest (step C), sized in tiles, as in isoview.js unless
// said otherwise. Brightness: a block never darker than a remembered
// wall, and a searched box, cell or paper dimmer.
const DRUM_SIDES = 12;              // the round case is drawn with this many sides
const DIAMOND_TILES = 2;           // the shared paper and grate sizes are shares of the iso diamond: twice that in tiles
const POOL_SIDES = 20;              // the desk's pool is drawn as a circle of this many sides
const MIST_LEVEL = 0.13;            // the boss's mist over a floor tile at full strength
const DOOR_HAZE = 0.1;
const DOOR_DEPTH = 0.3;             // a doorway draws this much nearer than it is, over the walls beside it
const DARK_RING_LIFT = 0.5;         // the tutorial's ring of words floats this high
// The gun (step D), in tiles from the player's feet: held `ahead` toward
// the light, `side` right of the middle, `height` up; `length` grip to
// muzzle, `grip` hanging under it; `raise` while a landed shot waits,
// `kick` back on a shot; `line` its width as a share of the stick man's.
const GUN = { ahead: 0.24, side: 0.08, height: 0.42, length: 0.26, grip: 0.07, raise: 0.05, kick: 0.06, line: 1.2 };
const CHEST = 0.55;                 // a shot goes to this share of a stick man's height
const LASER_DASH = [5, 4];            // its dash and gap, in line widths
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
let lookingUp = false;  // the player is holding the look up (lookUp)
let shownPitch = null;  // the drawn camera's tilt (radians, down positive), easing toward its goal
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
  cam = cameraAt(at, shownLook, pulled.side, pulled.back, width, height, shoulderFov(), shownPitch);
  drawSky(ctx);
  drawFloor(ctx);
  muzzle = null;
  const boxes = [];
  const items = [...wallItems(ctx), ...thingItems(ctx, boxes)];
  items.sort((a, b) => b.d - a.d).forEach(item => item.draw());
  tapBoxes = boxes.sort((a, b) => a.d - b.d);
  if (state.settings.gunCombat) {
    drawBrackets(ctx, boxes);
    drawLaser(ctx);
    drawShot(ctx);
  }
  drawDarkRing(ctx);
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

// Eases the drawn light toward the real one, the camera's offsets toward
// what the walls allow and its tilt toward looking up or ahead, by the
// time since the last frame. A new floor, or reduced motion, snaps them.
// Returns true while any moves.
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
    shownPitch = pitchGoal(pull.back);
    return false;
  }
  const turnLeft = wrapAngle(goal - shownLook);
  shownLook = Math.abs(turnLeft) < 0.002 ? goal : shownLook + turnLeft * (1 - Math.exp(-dt / SHOULDER_CAMERA.turnMs));
  const ease = 1 - Math.exp(-dt / SHOULDER_CAMERA.pullMs);
  const settle = (from, to) => (Math.abs(to - from) < 0.002 ? to : from + (to - from) * ease);
  pulled = { side: settle(pulled.side, pull.side), back: settle(pulled.back, pull.back) };
  const tilt = pitchGoal(pulled.back);
  const tiltEase = 1 - Math.exp(-dt / SHOULDER_CAMERA.lookUpMs);
  shownPitch = Math.abs(tilt - shownPitch) < 0.002 ? tilt : shownPitch + (tilt - shownPitch) * tiltEase;
  return shownLook !== goal || pulled.side !== pull.side || pulled.back !== pull.back || shownPitch !== tilt;
}

// The tilt the camera is heading for: up at the sky while the player
// looks up, else its usual few degrees down for a camera `back` behind.
function pitchGoal(back) {
  return lookingUp ? -SHOULDER_CAMERA.lookUpPitch : restPitch(back);
}

// The camera's usual tilt, a little down: at a point SHOULDER_CAMERA
// .aimAhead tiles ahead of the player, aimHeight up, from `back` behind.
function restPitch(back) {
  return Math.atan2(SHOULDER_CAMERA.height - SHOULDER_CAMERA.aimHeight, back + SHOULDER_CAMERA.aimAhead);
}

// Looks up at the sky (on) or back down (sky eye plan step A): main.js
// calls it while Space is held or the look stick is pushed up. View-only:
// looking up costs nothing and changes no state. The camera eases there.
export function lookUp(on) {
  lookingUp = on;
}

// The drawn camera's tilt in radians, down positive (up while looking
// up), for the smoke test; null before the first frame.
export function shoulderPitch() {
  return shownPitch;
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
// and its focal length in pixels (from the field of view `fov` across `w`,
// in degrees), tilted `pitch` radians down (its usual tilt unless given;
// negative looks up).
export function cameraAt(at, angle, side, back, w, h, fov = SHOULDER_CAMERA.fov, pitch = restPitch(back)) {
  const [fx, fy] = forwardOf(angle);
  const [rx, ry] = [-fy, fx];
  const z = SHOULDER_CAMERA.height;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: at.x - fx * back + rx * side, y: at.y - fy * back + ry * side, z,
    F: [fx * cp, fy * cp, -sp], R: [rx, ry, 0], U: [fx * sp, fy * sp, cp],
    focal: (w / 2) / Math.tan(fov * Math.PI / 360), w, h,
  };
}

// The camera's field of view across the map, in degrees: the Wider view
// comfort setting (step F) or Timothy's own.
export function shoulderFov() {
  return state.settings.shoulderWide ? SHOULDER_WIDE_FOV : SHOULDER_CAMERA.fov;
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

// How bright a floor tile is this frame, from 0 (hidden, or a wall) to 1
// (mapshared.js floorLevelOf).
function floorLevel(row, col) {
  return isWall(row, col) ? 0 : floorLevelOf(row, col, look.fogOf);
}

// How far through its kick the gun is (mapshared.js recoilAt), keeping
// frames going while it kicks.
function recoil() {
  const kick = recoilAt(look.now, look.still);
  if (kick) look.keepMoving();
  return kick;
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
  const gun = state.settings.gunCombat;
  ctx.lineWidth = 1;
  tilesInView().forEach(({ row, col }) => {
    const base = floorLevel(row, col);
    if (!base) return;
    const level = base * fadeAt(distance(col + 0.5, row + 0.5, 0));
    if (!tracePolygon(ctx, [[col, row, 0], [col + 1, row, 0], [col + 1, row + 1, 0], [col, row + 1, 0]])) return;
    ctx.fillStyle = 'rgba(' + rgb + ', ' + (0.02 + 0.09 * level) + ')';
    ctx.fill();
    const mist = look.mistStrength(row, col);
    if (mist) {
      ctx.fillStyle = 'rgba(' + look.colours.bossFogRgb + ', ' + MIST_LEVEL * mist + ')';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(' + rgb + ', ' + (0.03 + 0.14 * level) + ')';
    ctx.stroke();
    // The tiles the gun reaches (step D), lit faintly.
    if (gun && inReach(row, col)) {
      ctx.fillStyle = 'rgba(' + rgb + ', ' + REACH_FILL * fadeAt(distance(col + 0.5, row + 0.5, 0)) + ')';
      ctx.fill();
    }
  });
  look.things.filter(thing => thing.kind === 'stairs').forEach(thing => drawStairs(ctx, thing.at));
  drawFlatThings(ctx);
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

// Whether a wall shows yet (mapshared.js wallShownBy).
function wallShown(row, col) {
  return wallShownBy(row, col, look.fogOf);
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

// How each kind of map thing is drawn in this view (step C): a small
// block, a drum, flat on the floor, a stick man, or its glyph upright on
// its tile. tests/shoulderview.test.mjs checks every prop kind the game
// places has one.
export const SHOULDER_DRAWINGS = {
  box: 'block', cell: 'drum', paper: 'flat', vent: 'flat', stairs: 'flat',
  desk: 'glyph', relay: 'glyph', chest: 'glyph', coin: 'glyph', key: 'glyph', exchange: 'glyph', boss: 'glyph', hunter: 'glyph',
  minion: 'form', player: 'player',
};

// The standing things on the map, each as { d, draw } to sort far to near
// with the walls: the player's stick man, enemies as stick men (or their
// glyphs: the hunter, a '?', Simple enemies), boxes, energy cells, the
// other props as glyphs, doorways, the stairs' column of light, killed
// stick men fading and the answer ring. Enemies' boxes go into `boxes` as
// they are drawn, for taps. Things lying flat are drawn with the floor.
function thingItems(ctx, boxes) {
  const items = [];
  const player = look.things.find(thing => thing.kind === 'player');
  const toward = projectPoint(cam, [player.at.col + 0.5, player.at.row + 0.5, STICK_HEIGHT * 0.6]) || [width / 2, height];
  look.things.forEach(thing => {
    const drawing = drawingOf(thing);
    if (drawing === 'flat') return;
    const x = thing.at.col + 0.5;
    const y = thing.at.row + 0.5;
    if (!inView(x, y)) return;
    const d = distance(x, y, 0.35);
    if (drawing === 'player') return items.push({ d, draw: () => drawStickMan(ctx, x, y) });
    if (drawing === 'block') return items.push({ d, draw: () => drawBox(ctx, thing) });
    if (drawing === 'drum') return items.push({ d, draw: () => drawDrum(ctx, thing) });
    if (drawing === 'form') {
      const m = minionOn(thing.tile);
      return items.push({ d, draw: () => {
        const box = drawForm(ctx, m, x, y, toward);
        if (box) boxes.push({ d, box, tile: thing.tile });
      } });
    }
    items.push({ d, draw: () => {
      const box = drawGlyph(ctx, thing, x, y);
      if (box && ENEMY_KINDS.includes(thing.kind)) boxes.push({ d, box, tile: thing.tile });
      if (thing.kind === 'minion') drawHeardMark(ctx, x, y, thing.look.heard, 1);
    } });
  });
  dyingSticks(look.now).forEach(m => {
    const x = m.col + 0.5;
    const y = m.row + 0.5;
    if (inView(x, y)) items.push({ d: distance(x, y, 0.35), draw: () => drawForm(ctx, m, x, y, toward) });
  });
  look.things.filter(thing => thing.kind === 'stairs').forEach(thing => {
    if (inView(thing.at.col + 0.5, thing.at.row + 0.5)) items.push({ d: distance(thing.at.col + 0.5, thing.at.row + 0.5, 0.5), draw: () => drawBeam(ctx, thing.at) });
  });
  // The tutorial's light from above falls in a column like the stairs' light.
  const tut = state.floor.tutorial;
  if (tut && state.floor.spotSet.size && inView(tut.spot.col + 0.5, tut.spot.row + 0.5)) {
    items.push({ d: distance(tut.spot.col + 0.5, tut.spot.row + 0.5, 0.5), draw: () => drawBeam(ctx, tut.spot) });
  }
  doorItems(ctx).forEach(item => items.push(item));
  // The answer ring (swirl.js): its far half just behind what stands on
  // its tile, its near half just in front, so it goes round the boss.
  const ring = answerRingNow(look.now);
  if (ring && inView(ring.col + 0.5, ring.row + 0.5)) {
    if (!look.still) look.keepMoving();
    const d = distance(ring.col + 0.5, ring.row + 0.5, 0.35);
    items.push({ d: d + 0.01, draw: () => drawAnswerRing(ctx, ring, false) });
    items.push({ d: d - 0.01, draw: () => drawAnswerRing(ctx, ring, true) });
  }
  return items;
}

// How a map thing is drawn (SHOULDER_DRAWINGS), allowing for what isn't
// made out yet: an unknown box or cell is its '?', a paper its '?' until
// made out, and a minion is a glyph without a form (Simple enemies, no kind).
function drawingOf(thing) {
  const drawing = SHOULDER_DRAWINGS[thing.kind] || 'glyph';
  if (thing.glyph === null && thing.kind !== 'stairs' && thing.kind !== 'vent') return 'glyph';
  if (drawing === 'form' && (state.settings.simpleEnemies || !minionOn(thing.tile) || !minionOn(thing.tile).minionKind)) return 'glyph';
  return drawing;
}

// A tile's width on the isometric map, in canvas pixels: text in the world
// is never drawn smaller than there (shoulder view plan, call 7).
function isoTileWidth() {
  return width / (pageWidth < ISO_NARROW_MAP_WIDTH ? ISO_TILES_ACROSS_NARROW : ISO_TILES_ACROSS);
}

// A tile's width in pixels at a point `ahead` tiles in front of the camera.
function tileAt(ahead) {
  return cam.focal / ahead;
}

// A world point on the canvas as [x, y, ahead], or null behind the camera.
function screenOf(x, y, z) {
  const p = toCamera(cam, [x, y, z]);
  if (p[2] < NEAR) return null;
  const [sx, sy] = toScreen(cam, p);
  return [sx, sy, p[2]];
}

// A thing's glyph upright on its tile, never smaller than the isometric
// map draws it (shoulder view plan, call 7), dimmer with distance.
// Returns the box it covers on the canvas, feet included, or null.
function drawGlyph(ctx, thing, x, y) {
  const ground = screenOf(x, y, 0);
  if (!ground) return null;
  const [sx, sy, ahead] = ground;
  const cell = Math.max(isoTileWidth(), tileAt(ahead)) * GLYPH_CELL;
  const rise = cell * MAP_GLYPH_SIZES[thing.look.size] * GLYPH_RISE + (thing.look.lift || 0) * cell / GLYPH_CELL;
  const alpha = (thing.look.alpha === undefined ? 1 : thing.look.alpha) * fadeAt(distance(x, y, 0));
  look.paintGlyph(ctx, cell, sx, sy - rise, thing.glyph, { ...thing.look, alpha });
  const half = cell * MAP_GLYPH_SIZES[thing.look.size] / 2;
  return [sx - half, sy - rise - half, sx + half, sy];
}

// Minion `m` as its stick man (stickforms.js) standing at (x, y), at its
// real size for the distance, turned toward the player (`toward`, their
// place on the canvas). While a landed shot on it waits for the dial its
// maim point gets a glowing ring. The eye over it and its heard '!' come
// after. Returns its box on the canvas, for taps, or null.
function drawForm(ctx, m, x, y, toward) {
  const foot = screenOf(x, y, 0);
  if (!foot) return null;
  const [sx, sy, ahead] = foot;
  const tw = tileAt(ahead);
  const h = tw * STICK_HEIGHT;
  if (!look.still) look.keepMoving();
  const lineWidth = Math.max(1.5, tw * STICK_LINE * STICK_HEIGHT);
  const centre = (row, col) => (screenOf(col + 0.5, row + 0.5, 0) || [sx, sy]).slice(0, 2);
  const weak = drawStickForm(ctx, m, sx, sy, {
    tw, height: h, lineWidth, toward, now: look.now, still: look.still, centre,
    line: (path, level) => enemyLine(ctx, path, level * fadeAt(distance(x, y, 0)), lineWidth),
    aiming: state.battle.aim !== null && state.battle.aim.target === m,
  });
  if (weak) {
    ctx.beginPath();
    ctx.arc(weak[0], weak[1], tw * WEAK_RING, 0, Math.PI * 2);
    glowStroke(ctx, WEAK_RING_LEVEL, lineWidth);
  }
  if (!state.floor.minions.includes(m)) return null;
  drawGazeEye(ctx, x, y, m);
  drawHeardMark(ctx, x, y, headrMark(m), (MINION_KINDS[m.minionKind] || {}).size || 1);
  return stickBox(m, sx, sy, h);
}

// The strength of the '!' over minion `m` this frame (mapview.js passes
// it with its map thing), 0 when none.
function headrMark(m) {
  const thing = look.things.find(t => t.kind === 'minion' && t.tile.row === m.row && t.tile.col === m.col);
  return thing ? thing.look.heard || 0 : 0;
}

// Strokes the path `path()` makes as a stick enemy's line, `w` wide, at
// strength `level`, in the enemies' cold blue (ENEMY_LIGHT) with its halo.
function enemyLine(ctx, path, level, w) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  const halo = a => 'rgba(' + ENEMY_LIGHT.halo + ', ' + a + ')';
  HALO_LAYERS.forEach(l => {
    ctx.strokeStyle = halo(Math.min(0.8, level) * l.strength);
    ctx.lineWidth = w * l.width;
    ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + level + ')';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

// The eye over a stick man in the player's cone (gaze.js), as in
// isoview.js: shut, a line; the lids part slowly with its gaze, the pupil
// showing from a third open. Sized for the distance, never smaller than
// on the isometric map.
function drawGazeEye(ctx, x, y, m) {
  const eye = eyeOf(m);
  if (!eye) return;
  const size = (MINION_KINDS[m.minionKind] || {}).size || 1;
  const at = screenOf(x, y, STICK_HEIGHT * size + EYE_LIFT);
  if (!at) return;
  const tw = Math.max(isoTileWidth(), tileAt(at[2]));
  const [ex, ey] = at;
  const { share, level } = eye;
  const w = tw * EYE_WIDTH;
  const open = tw * eye.open;
  const lids = () => {
    ctx.beginPath();
    ctx.moveTo(ex - w, ey);
    ctx.quadraticCurveTo(ex, ey - open * 2, ex + w, ey);
    ctx.quadraticCurveTo(ex, ey + open * 2, ex - w, ey);
  };
  ctx.save();
  if (open > 1) {
    lids();
    ctx.fillStyle = '#000';
    ctx.fill();
  }
  if (share > 1 / 3) {
    lids();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(ex, ey, w * (0.18 + 0.24 * share), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + level + ')';
    ctx.fill();
  }
  ctx.restore();
  enemyLine(ctx, lids, level, Math.max(1.2, tw * STICK_LINE * STICK_HEIGHT));
}

// The '!' over a stick man that heard a mistake (mapview.js heardOnMap),
// above its head, never smaller than on the isometric map.
function drawHeardMark(ctx, x, y, strength, size) {
  if (!strength) return;
  const at = screenOf(x, y, STICK_HEIGHT * size + EYE_LIFT + HEARD_LIFT);
  if (!at) return;
  const cell = Math.max(isoTileWidth(), tileAt(at[2])) * GLYPH_CELL;
  look.paintGlyph(ctx, cell, at[0], at[1], '!', { size: 'prop', colour: 'rgb(' + ENEMY_LIGHT.core + ')', alpha: strength });
}

// The box's level: lit like its floor, never darker than a remembered
// wall, dimmer once searched.
function propLevel(thing) {
  const level = Math.max(WALL_MIN_LEVEL, floorLevel(thing.at.row, thing.at.col) * (searched(thing.tile) ? SEARCHED_LEVEL : 1));
  return level * (thing.look.alpha === undefined ? 1 : thing.look.alpha) * fadeAt(distance(thing.at.col + 0.5, thing.at.row + 0.5, 0));
}

// A box the player has made out: a small block on its tile.
function drawBox(ctx, thing) {
  const { row, col } = thing.at;
  drawBlock(ctx, col + BOX_INSET, row + BOX_INSET, col + 1 - BOX_INSET, row + 1 - BOX_INSET, BOX_HEIGHT, propLevel(thing));
}

// An upright block from (x0, y0) to (x1, y1) on the floor, `h` tall, at
// brightness `level`: its faces turned toward the camera, far ones first,
// then its top when the camera is above it, each filled and edged.
function drawBlock(ctx, x0, y0, x1, y1, h, level) {
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const faces = SIDES.map((side, i) => ({ side, a: corners[i], b: corners[(i + 1) % 4] }))
    .filter(({ side, a, b }) => ((a[0] + b[0]) / 2 - cam.x) * side.n[0] + ((a[1] + b[1]) / 2 - cam.y) * side.n[1] < 0)
    .map(face => ({ ...face, d: distance((face.a[0] + face.b[0]) / 2, (face.a[1] + face.b[1]) / 2, h / 2) }))
    .sort((p, q) => q.d - p.d);
  faces.forEach(({ a, b }) => {
    const quad = [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], h], [a[0], a[1], h]];
    if (tracePolygon(ctx, quad)) {
      ctx.fillStyle = faceColour(level);
      ctx.fill();
    }
    line3(ctx, quad[0], quad[1], EDGE_FOOT * level);
    line3(ctx, quad[0], quad[3], EDGE_CORNER * level);
    line3(ctx, quad[1], quad[2], EDGE_CORNER * level);
  });
  if (cam.z <= h) {
    faces.forEach(({ a, b }) => line3(ctx, [a[0], a[1], h], [b[0], b[1], h], EDGE_TOP * level));
    return;
  }
  const top = corners.map(([x, y]) => [x, y, h]);
  if (tracePolygon(ctx, top)) {
    ctx.fillStyle = topColour(level);
    ctx.fill();
  }
  top.forEach((p, i) => line3(ctx, p, top[(i + 1) % 4], EDGE_TOP * level));
}

function faceColour(level) {
  return 'rgb(' + Math.round(5 + 14 * level) + ', ' + Math.round(6 + 16 * level) + ', ' + Math.round(7 + 16 * level) + ')';
}

function topColour(level) {
  return 'rgb(' + Math.round(12 + 26 * level) + ', ' + Math.round(14 + 29 * level) + ', ' + Math.round(15 + 29 * level) + ')';
}

// A point on a circle round (x, y) on the grid, `r` tiles out, at `z`.
function round(x, y, r, angle, z) {
  return [x + Math.cos(angle) * r, y + Math.sin(angle) * r, z];
}

// An energy cell: a round case with bands and three round ends on its
// lid, as in isoview.js. Unused, a faint glow breathes round it
// (mapview.js gives `look.breath`); used, it is dimmer and its ends dark.
function drawDrum(ctx, thing) {
  const x = thing.at.col + 0.5;
  const y = thing.at.row + 0.5;
  const level = propLevel(thing);
  const spent = searched(thing.tile);
  const rgb = look.colours.glowRgb;
  if (thing.look.breath !== null && thing.look.breath !== undefined) {
    const mid = screenOf(x, y, DRUM_HEIGHT / 2);
    if (mid) {
      look.keepMoving();
      const a = DRUM_BREATH[0] + (DRUM_BREATH[1] - DRUM_BREATH[0]) * thing.look.breath;
      const reach = tileAt(mid[2]) * DRUM_BREATH_REACH;
      const halo = ctx.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], reach);
      halo.addColorStop(0, 'rgba(' + rgb + ', ' + a * level + ')');
      halo.addColorStop(1, 'rgba(' + rgb + ', 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mid[0] - reach, mid[1] - reach, reach * 2, reach * 2);
    }
  }
  const step = Math.PI * 2 / DRUM_SIDES;
  const sides = [];
  for (let i = 0; i < DRUM_SIDES; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const mid = round(x, y, DRUM_RADIUS, a0 + step / 2, 0);
    const facing = (mid[0] - cam.x) * Math.cos(a0 + step / 2) + (mid[1] - cam.y) * Math.sin(a0 + step / 2) < 0;
    if (facing) sides.push([a0, a1]);
  }
  sides.forEach(([a0, a1]) => {
    const quad = [round(x, y, DRUM_RADIUS, a0, 0), round(x, y, DRUM_RADIUS, a1, 0), round(x, y, DRUM_RADIUS, a1, DRUM_HEIGHT), round(x, y, DRUM_RADIUS, a0, DRUM_HEIGHT)];
    if (tracePolygon(ctx, quad)) {
      ctx.fillStyle = faceColour(level);
      ctx.fill();
    }
    line3(ctx, quad[0], quad[1], 0.7 * level);
    DRUM_HOOPS.forEach(hoop => line3(ctx, round(x, y, DRUM_RADIUS, a0, DRUM_HEIGHT * hoop), round(x, y, DRUM_RADIUS, a1, DRUM_HEIGHT * hoop), 0.45 * level));
  });
  const lid = [];
  for (let i = 0; i < DRUM_SIDES; i++) lid.push(round(x, y, DRUM_RADIUS, i * step, DRUM_HEIGHT));
  if (tracePolygon(ctx, lid)) {
    ctx.fillStyle = 'rgba(' + rgb + ', ' + 0.26 * level + ')';
    ctx.fill();
  }
  lid.forEach((p, i) => line3(ctx, p, lid[(i + 1) % lid.length], 0.8 * level));
  DRUM_ENDS.forEach(([ex, ey]) => {
    const end = [];
    for (let i = 0; i < 6; i++) end.push(round(x + ex * DRUM_RADIUS, y + ey * DRUM_RADIUS, DRUM_RADIUS * DRUM_END_SIZE, i * Math.PI / 3, DRUM_HEIGHT + 0.002));
    if (!tracePolygon(ctx, end)) return;
    ctx.fillStyle = spent ? 'rgba(0, 0, 0, 0.6)' : 'rgba(' + rgb + ', ' + 0.92 * level + ')';
    ctx.fill();
  });
}

// Things lying flat on the seen floor, drawn over it before anything
// stands up: the boss's mist, the desk's warm pool, papers, grates, a
// mistake's sound, letters a crawling stick man dropped.
function drawFlatThings(ctx) {
  look.things.forEach(thing => {
    if (thing.look.deskGlow != null) drawDeskPool(ctx, thing);
    if (!inView(thing.at.col + 0.5, thing.at.row + 0.5) || thing.glyph === null) return;
    if (thing.kind === 'paper') drawPaper(ctx, thing);
    if (thing.kind === 'vent') drawGrate(ctx, thing);
  });
  look.sounds.forEach(({ row, col, strength, spread }) => {
    const inset = SOUND_INSET[0] + (SOUND_INSET[1] - SOUND_INSET[0]) * spread;
    const z = 0.004;
    const square = [[col + inset, row + inset, z], [col + 1 - inset, row + inset, z], [col + 1 - inset, row + 1 - inset, z], [col + inset, row + 1 - inset, z]];
    square.forEach((p, i) => line3(ctx, p, square[(i + 1) % 4], SOUND_LEVEL * strength));
  });
  // Letters a crawling stick man left (downed plan), only on lit floor, so
  // they never give one away in the dark. Simple enemies have none.
  if (!state.settings.simpleEnemies) {
    const centre = (row, col) => (screenOf(col + 0.5, row + 0.5, 0) || [-1e4, -1e4]).slice(0, 2);
    const lit = (row, col) => inView(col + 0.5, row + 0.5) && (!state.settings.fogEnabled || state.floor.visibleSet.has(key(row, col)));
    drawDroppedLetters(ctx, isoTileWidth(), centre, lit);
  }
}

// A flat shape on the floor of tile (row, col): points (u, v) from -1 to 1
// across it, `scale` tiles from its middle to an edge, lifted off the
// floor a hair so it draws over it.
function onTile(row, col, scale, [u, v], dx = 0) {
  return [col + 0.5 + dx + u * scale, row + 0.5 + v * scale, 0.003];
}

// A paper the player has made out: a sheet lying on its tile with three
// lines of writing.
function drawPaper(ctx, thing) {
  const { row, col } = thing.at;
  const level = propLevel(thing);
  const scale = PAPER_SCALE * DIAMOND_TILES;
  const sheet = PAPER_SHEET.map(p => onTile(row, col, scale, p));
  if (tracePolygon(ctx, sheet)) {
    ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + 0.16 * level + ')';
    ctx.fill();
  }
  sheet.forEach((p, i) => line3(ctx, p, sheet[(i + 1) % sheet.length], 0.8 * level));
  PAPER_LINES.forEach(v => line3(ctx, onTile(row, col, scale, [-0.5, v - 0.05]), onTile(row, col, scale, [0.5, v - 0.15]), 0.45 * level));
}

// A grate in the floor (vents.js): a dark square frame with bars across
// it, lit like the floor round it; crossed out when sealed (its room held
// by a relay); swaying side to side while it shudders.
function drawGrate(ctx, thing) {
  const { row, col } = thing.at;
  const r = thing.look.rattle;
  const dx = r === null || r === undefined ? 0 : Math.sin(r * Math.PI * GRATE_RATTLE_SWAYS * 2) * (1 - r) * GRATE_RATTLE;
  const level = floorLevel(row, col) * (thing.look.alpha === undefined ? 1 : thing.look.alpha) * fadeAt(distance(col + 0.5, row + 0.5, 0));
  const p = uv => onTile(row, col, GRATE_SCALE * DIAMOND_TILES, uv, dx);
  const frame = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(p);
  if (tracePolygon(ctx, frame)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fill();
  }
  frame.forEach((q, i) => line3(ctx, q, frame[(i + 1) % 4], 0.75 * level));
  GRATE_BARS.forEach(u => line3(ctx, p([u, -1]), p([u, 1]), 0.5 * level));
  if (thing.look.sealed) {
    line3(ctx, p([-1, -1]), p([1, 1]), 0.9 * level);
    line3(ctx, p([1, -1]), p([-1, 1]), 0.9 * level);
  }
}

// The unused reflective desk's pool of warm light on the floor round it
// (as in isoview.js drawDeskGlow), breathing slowly.
function drawDeskPool(ctx, thing) {
  const x = thing.at.col + 0.5;
  const y = thing.at.row + 0.5;
  const mid = screenOf(x, y, 0);
  if (!mid) return;
  look.keepMoving();
  const a = (DESK_GLOW[0] + (DESK_GLOW[1] - DESK_GLOW[0]) * thing.look.deskGlow) * (thing.look.alpha === undefined ? 1 : thing.look.alpha);
  const rim = [];
  for (let i = 0; i < POOL_SIDES; i++) rim.push(round(x, y, DESK_GLOW_RADIUS, i * Math.PI * 2 / POOL_SIDES, 0.002));
  const reach = Math.max(...rim.map(p => screenOf(...p)).filter(Boolean).map(([sx, sy]) => Math.hypot(sx - mid[0], sy - mid[1])), 1);
  if (!tracePolygon(ctx, rim)) return;
  const kind = v => 'rgba(' + look.colours.kindRgb + ', ' + v + ')';
  const g = ctx.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], reach);
  g.addColorStop(0, kind(a));
  g.addColorStop(0.5, kind(a * 0.45));
  g.addColorStop(1, kind(0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// The stairs' column of light (or the tutorial's light from above):
// soft upright layers rising from the tile, pulsing, fading toward the top.
function drawBeam(ctx, at) {
  const x = at.col + 0.5;
  const y = at.row + 0.5;
  const foot = screenOf(x, y, 0);
  const top = screenOf(x, y, SHOULDER_CAMERA.wallHeight * STAIR_BEAM_HEIGHT);
  if (!foot || !top) return;
  look.keepMoving();
  const strength = (0.82 + 0.18 * look.pulse(MAP_ANIMATION_MS.glow)) * fadeAt(distance(x, y, 0));
  const tw = tileAt(foot[2]);
  const rgb = look.colours.glowRgb;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  STAIR_BEAM_LAYERS.forEach(layer => {
    const a = layer.strength * strength;
    const fade = ctx.createLinearGradient(foot[0], foot[1], top[0], top[1]);
    fade.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')');
    fade.addColorStop(STAIR_BEAM_FADE[0], 'rgba(' + rgb + ', ' + a * STAIR_BEAM_FADE[1] + ')');
    fade.addColorStop(1, 'rgba(' + rgb + ', 0)');
    const half = tw * layer.width / 2;
    const topHalf = half * foot[2] / top[2];
    ctx.beginPath();
    ctx.moveTo(foot[0] - half, foot[1]);
    ctx.lineTo(foot[0] + half, foot[1]);
    ctx.lineTo(top[0] + topHalf, top[1]);
    ctx.lineTo(top[0] - topHalf, top[1]);
    ctx.closePath();
    ctx.fillStyle = fade;
    ctx.fill();
  });
  ctx.restore();
}

// The doorways in view, each as { d, draw }: two posts as tall as the
// walls and an arch over them, with a faint haze in the opening (as in
// isoview.js drawDoorway). Drawn just in front of the walls beside them.
function doorItems(ctx) {
  const items = [];
  state.floor.doorSet.forEach(k => {
    const [row, col] = k.split(',').map(Number);
    if (look.fogOf(row, col) === 'hidden') return;
    const across = isWall(row, col - 1) && isWall(row, col + 1);
    if (!across && !(isWall(row - 1, col) && isWall(row + 1, col))) return;
    if (!inView(col + 0.5, row + 0.5)) return;
    const d = distance(col + 0.5, row + 0.5, SHOULDER_CAMERA.wallHeight / 2) - DOOR_DEPTH;
    items.push({ d, draw: () => drawDoorway(ctx, row, col, across) });
  });
  return items;
}

// One doorway on (row, col); `across` says its walls are west and east.
function drawDoorway(ctx, row, col, across) {
  const level = Math.max(DOOR_MIN_LEVEL, floorLevel(row, col)) * fadeAt(distance(col + 0.5, row + 0.5, 0));
  const wallH = SHOULDER_CAMERA.wallHeight;
  // A point on the doorway's line, from one post (t = 0) to the other, `z` up.
  const at = (t, z) => {
    const s = DOOR_POST + t * (1 - 2 * DOOR_POST);
    return across ? [col + s, row + 0.5, z] : [col + 0.5, row + s, z];
  };
  const arch = (base, rise) => {
    const points = [];
    for (let i = 0; i <= DOOR_ARCH_STEPS; i++) points.push(at(i / DOOR_ARCH_STEPS, base + rise * Math.sin(Math.PI * i / DOOR_ARCH_STEPS)));
    return points;
  };
  const rise = wallH * DOOR_ARCH_RISE;
  const thick = wallH * DOOR_ARCH_THICK;
  const outer = arch(wallH, rise);
  const inner = arch(wallH - thick, rise - thick);
  if (tracePolygon(ctx, [at(0, 0), at(1, 0), ...inner.slice().reverse()])) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + DOOR_HAZE * level + ')';
    ctx.fill();
    ctx.restore();
  }
  [0, 1].forEach(end => {
    const [px, py] = at(end, 0);
    drawBlock(ctx, px - DOOR_POST, py - DOOR_POST, px + DOOR_POST, py + DOOR_POST, wallH, level);
  });
  if (tracePolygon(ctx, [...outer, ...inner.slice().reverse()])) {
    ctx.fillStyle = faceColour(level);
    ctx.fill();
  }
  [outer, inner].forEach(points => points.slice(1).forEach((p, i) => line3(ctx, points[i], p, Math.min(1, level * 1.1))));
}

// One half of the answer ring (swirl.js): the right answer to a miss going
// round over its tile (round the boss at its chest), turned to face the
// camera so its front always reads left to right, as on the isometric
// map. Only the `near` half or the far half is drawn, so what stands on
// the tile can be between them. Letters never smaller than the iso map's.
function drawAnswerRing(ctx, ring, near) {
  const { out, letters } = answerRingLetters(ring, look.now);
  const x = ring.col + 0.5;
  const y = ring.row + 0.5;
  const radius = ring.boss ? ANSWER_RING.bossRadius : ANSWER_RING.radius;
  const lift = (ring.boss ? ANSWER_RING.bossLift : ANSWER_RING.lift) * STICK_HEIGHT / ISO_STICK_HEIGHT + out * 0.2;
  // Across the screen (the camera's right) and toward the camera, flat on the floor.
  const across = [cam.R[0], cam.R[1]];
  const toward = [-cam.F[0], -cam.F[1]];
  const flat = Math.hypot(...toward) || 1;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  letters.forEach(({ ch, angle, front, level, size: share }) => {
    if ((front >= 0) !== near) return;
    const wx = x + (across[0] * Math.cos(angle) + toward[0] / flat * front) * radius;
    const wy = y + (across[1] * Math.cos(angle) + toward[1] / flat * front) * radius;
    const at = screenOf(wx, wy, lift);
    if (!at) return;
    const size = Math.max(isoTileWidth() * ANSWER_RING.size, ANSWER_RING.minPx * pageScale, tileAt(at[2]) * ANSWER_RING.size);
    const px = Math.max(6, Math.round(size * share));
    ctx.font = px + 'px VT323, monospace';
    if (ch !== ' ') {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + 0.8 * Math.min(1, level * 1.5) + ')';
      ctx.fillRect(at[0] - px * 0.3, at[1] - px * 0.46, px * 0.6, px * 0.92);
    }
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.halo + ', ' + 0.35 * level + ')';
    ctx.fillText(ch, at[0], at[1] + px * 0.04);
    ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + level + ')';
    ctx.fillText(ch, at[0], at[1]);
  });
  ctx.restore();
}

// The tutorial's ring of dark (tutorial.js stage 'ring'), as in
// isoview.js: words in the stick men's cold light circling the player at
// the edge of their small light; when the light breaks it they scatter
// outward and fade. Still under reduced motion and in Comfort mode, and
// simply gone when it breaks. Never smaller than on the isometric map.
function drawDarkRing(ctx) {
  const ring = darkRingAt(look.now, look.still);
  if (!ring) return;
  if (ring.moving) look.keepMoving();
  const px = look.walkAt.col + 0.5;
  const py = look.walkAt.row + 0.5;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = ring.level;
  ctx.fillStyle = 'rgb(' + ENEMY_LIGHT.core + ')';
  ctx.shadowColor = 'rgba(' + ENEMY_LIGHT.halo + ', 0.6)';
  ring.words.forEach((word, i) => {
    const angle = ring.angles[i];
    const at = screenOf(px + ring.radius * Math.sin(angle), py + ring.radius * Math.cos(angle), DARK_RING_LIFT);
    if (!at) return;
    const size = Math.max(isoTileWidth(), tileAt(at[2])) * 0.3;
    ctx.font = Math.round(size) + 'px VT323, monospace';
    ctx.shadowBlur = size * 0.5;
    ctx.fillText(word, at[0], at[1]);
  });
  ctx.restore();
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
  const gun = state.settings.gunCombat ? holdGun(x, y) : null;
  const hands = gun && [screenOf(...gun.grip), screenOf(...gun.backHand)];
  if (hands && hands[0] && hands[1]) {
    ctx.moveTo(hands[1][0], hands[1][1]);
    ctx.lineTo(shoulder[0], shoulder[1]);
    ctx.lineTo(hands[0][0], hands[0][1]);
  } else {
    ctx.moveTo(fx - h * 0.2, hip[1] + breath);
    ctx.lineTo(shoulder[0], shoulder[1]);
    ctx.lineTo(fx + h * 0.2, hip[1] + breath);
  }
  ctx.moveTo(fx + headR, headY);
  ctx.arc(fx, headY, headR, 0, Math.PI * 2);
  const lineW = Math.max(1.5, h * STICK_LINE);
  glowStroke(ctx, 1, lineW);
  if (gun) drawGun(ctx, gun, lineW);
  ctx.restore();
}

// Where the player's gun is (step D), held out ahead of the stick man at
// (x, y) toward where the light points, a little right of the middle:
// raised while a landed shot waits for the dial, kicked back on a shot.
// World points [x, y, z]: { grip, backHand, butt, muzzle, gripFoot }.
// The muzzle is noted for the laser and the shot.
function holdGun(x, y) {
  const [fx, fy] = forwardOf(shownLook);
  const [rx, ry] = [-fy, fx];
  const ahead = GUN.ahead - recoil() * GUN.kick;
  const z = GUN.height + (state.battle.aim ? GUN.raise : 0);
  const at = (along, side, up) => [x + fx * along + rx * side, y + fy * along + ry * side, z + up];
  const gun = {
    grip: at(ahead, GUN.side, 0),
    backHand: at(ahead - 0.04, GUN.side - 0.07, -0.03),
    butt: at(ahead - 0.06, GUN.side, 0.01),
    muzzle: at(ahead + GUN.length, GUN.side, 0.02),
    gripFoot: at(ahead - 0.02, GUN.side, -GUN.grip),
  };
  muzzle = gun.muzzle;
  return gun;
}

// The gun as two phosphor lines, butt to muzzle and the grip under it.
function drawGun(ctx, gun, lineW) {
  [[gun.butt, gun.muzzle], [gun.grip, gun.gripFoot]].forEach(([a, b]) => {
    const p = screenOf(...a);
    const q = screenOf(...b);
    if (!p || !q) return;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    glowStroke(ctx, 1, lineW * GUN.line);
  });
}

// Corner brackets round everything the gun can shoot right now, faint, and
// round the target, bright and slowly breathing, with its guard over it
// while it has one (as in isoview.js). `boxes` are this frame's enemies'
// boxes on the canvas.
function drawBrackets(ctx, boxes) {
  const target = liveTarget();
  boxes.forEach(({ box, tile, d }) => {
    const m = state.floor.minions.find(n => n.row === tile.row && n.col === tile.col);
    if (!m) return;
    const chosen = m === target;
    if (!chosen && !canShoot(m)) return;
    const tw = Math.max(isoTileWidth(), tileAt(Math.max(NEAR, d)));
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
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    [[l, top, 1, 1], [r, top, -1, 1], [l, bottom, 1, -1], [r, bottom, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.moveTo(x + sx * arm, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * arm);
    });
    glowStroke(ctx, level, lineWidth * (chosen ? 1.6 : 1));
    if (chosen && m.guard) {
      ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + level + ')';
      ctx.font = Math.round(tw * BRACKET_TEXT_SIZE) + 'px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('stat.guard'), mid, top - tw * BRACKET_HP_GAP);
    }
    ctx.restore();
  });
}

// Where on a minion a shot goes: its chest, by its size.
function chestOf(at, m) {
  const size = (m && MINION_KINDS[m.minionKind] || {}).size || 1;
  return [at.col + 0.5, at.row + 0.5, STICK_HEIGHT * size * CHEST];
}

// The dashed laser from the gun's muzzle to the target, while it can be
// shot; brighter while a landed shot waits for the dial.
function drawLaser(ctx) {
  const target = liveTarget();
  if (!target || !muzzle || !canShoot(target)) return;
  const thing = look.things.find(th => (th.kind === 'minion' || th.kind === 'hunter') && th.tile.row === target.row && th.tile.col === target.col);
  if (!thing) return;
  // Seen from behind, the laser runs nearly straight away from the camera
  // and shows short, so its dashes are sized by the line, not the tile.
  ctx.save();
  ctx.setLineDash(LASER_DASH.map(n => n * lineWidth));
  line3(ctx, muzzle, chestOf(thing.at, target), LASER_LEVEL[state.battle.aim ? 1 : 0]);
  ctx.restore();
}

// Plays a shot (mapview.js shotOnMap calls it with isoview.js's): a flash
// from the gun to `target`, or past it when it `missed`, with MISS
// floating up over it. A miss goes to one side, then the other (never
// Math.random: the seeded tests own it).
let muzzle = null;     // the gun's muzzle this frame, a world point, or null with no gun drawn

// The last shot while it plays: the flash and a ring where it lands (not
// under reduced motion), then MISS over a missed minion, fading as it
// floats up (still under reduced motion). Frames show plain meanwhile, so
// the afterglow leaves no trail.
function drawShot(ctx) {
  const shot = lastShot();
  if (!shot) return;
  const age = look.now - shot.start;
  if (!look.still && age < Math.max(MAP_ANIMATION_MS.gunShot, shot.missed ? MAP_ANIMATION_MS.gunMiss : 0)) look.showPlain();
  if (!look.still && muzzle && age < MAP_ANIMATION_MS.gunShot) {
    look.keepMoving();
    const done = age / MAP_ANIMATION_MS.gunShot;
    const end = chestOf(shot.to, state.floor.minions.find(m => m.row === shot.at.row && m.col === shot.at.col));
    line3(ctx, muzzle, end, 1 - done);
    const at = screenOf(...end);
    if (at) {
      ctx.beginPath();
      ctx.arc(at[0], at[1], tileAt(at[2]) * (SHOT_RING[0] + SHOT_RING[1] * done), 0, Math.PI * 2);
      glowStroke(ctx, 1 - done, lineWidth * 1.5);
    }
  }
  if (shot.missed && age < MAP_ANIMATION_MS.gunMiss) {
    const done = age / MAP_ANIMATION_MS.gunMiss;
    if (!look.still) look.keepMoving();
    const at = screenOf(shot.at.col + 0.5, shot.at.row + 0.5, MISS_RISE[0] + (look.still ? 0 : MISS_RISE[1] * done));
    if (!at) return;
    const size = Math.max(isoTileWidth(), tileAt(at[2])) * MISS_TEXT_SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + (look.still ? 1 : 1 - done) + ')';
    ctx.font = Math.round(size) + 'px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('gun.miss'), at[0], at[1]);
    ctx.restore();
  }
}

// The sky (sky eye plan step A): over the walls, paling faintly blue as
// the boss's light nears the end, and the eye straight overhead, seen
// only by looking up. Drawn before the floor, so a wall in the way still
// covers it. In Comfort mode the sky stays dark and holds the turns left
// as plain words instead of an eye.
function drawSky(ctx) {
  const open = skyEyeOpen();
  const plain = state.settings.simpleEnemies;
  if (!plain) drawPaleSky(ctx, open);
  const at = skyPoint();
  if (!at) return;
  if (plain) drawTurnsLeft(ctx, at);
  else drawSkyEye(ctx, at, open);
}

// Where something infinitely far away in direction `d` ([x, y, z] on the
// grid, z up) shows on the canvas, or null when it is behind the camera.
function screenOfWay(d) {
  const p = toCamera({ x: 0, y: 0, z: 0, R: cam.R, U: cam.U, F: cam.F }, d);
  return p[2] > NEAR ? toScreen(cam, p) : null;
}

// Where the eye is on the canvas this frame: SKY_EYE.elevation above
// level, the way the drawn light points; null while it is off screen.
function skyPoint() {
  const [fx, fy] = forwardOf(shownLook);
  const e = SKY_EYE.elevation;
  const at = screenOfWay([fx * Math.cos(e), fy * Math.cos(e), Math.sin(e)]);
  const r = width * SKY_EYE.size * SKY_EYE.halo;
  if (!at || at[0] < -r || at[0] > width + r || at[1] < -r || at[1] > height + r) return null;
  return at;
}

// The dark above the horizon, paling a little in the boss's blue once the
// eye is more than SKY_EYE.paleFrom open. Only while the camera tilts up
// (lookUpShare), and fading to nothing at the horizon: drawn in the usual
// view it showed as a flat grey slab over the dark (Timothy noticed it).
function drawPaleSky(ctx, open) {
  const pale = Math.max(0, (open - SKY_EYE.paleFrom) / (1 - SKY_EYE.paleFrom)) * lookUpShare();
  if (!(pale > 0)) return;
  const [fx, fy] = forwardOf(shownLook);
  const horizon = screenOfWay([fx, fy, 0]);
  const bottom = Math.min(height, horizon ? horizon[1] : height);
  if (bottom <= 0) return;
  const sky = ctx.createLinearGradient(0, 0, 0, bottom);
  sky.addColorStop(0, 'rgba(' + look.colours.bossLightRgb + ', ' + (0.1 * pale) + ')');
  sky.addColorStop(1, 'rgba(' + look.colours.bossLightRgb + ', 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, bottom);
}

// How far the camera is tilted up toward the sky: 0 at its usual tilt,
// 1 looking up.
function lookUpShare() {
  const rest = restPitch(pulled.back);
  return Math.max(0, Math.min(1, (rest - shownPitch) / (rest + SHOULDER_CAMERA.lookUpPitch)));
}

// The eye at `at`: its glow, the dark between its lids, the iris and the
// slit pupil turned toward the player, then the lids. Shut it is one line;
// `open` (skyEyeOpen) parts the lids. Near the end it twitches slowly
// (never under reduced motion: the calm rule).
function drawSkyEye(ctx, [x0, y], open) {
  const r = width * SKY_EYE.size;
  let x = x0;
  if (open >= SKY_EYE.twitchAt && !look.still) {
    look.keepMoving();
    const phase = (look.now % SKY_EYE.twitchMs) / SKY_EYE.twitchMs;
    if (phase > 0.86 && phase < 0.9) x -= r * SKY_EYE.twitch;
    else if (phase >= 0.9 && phase < 0.94) x += r * SKY_EYE.twitch;
  }
  const blue = look.colours.bossLightRgb;
  const pale = look.colours.bossFogRgb;
  const lid = r * SKY_EYE.lid * open;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y - lid * 2, x + r, y);
    ctx.quadraticCurveTo(x, y + lid * 2, x - r, y);
    ctx.closePath();
  };
  const reach = r * SKY_EYE.halo;
  const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, reach);
  halo.addColorStop(0, 'rgba(' + blue + ', ' + (0.05 + 0.18 * open) + ')');
  halo.addColorStop(1, 'rgba(' + blue + ', 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  if (lid > 1) {
    ctx.save();
    shape();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();
    const [ix, iy] = pupilAt(x, y, r, lid);
    const ir = r * SKY_EYE.iris;
    const iris = ctx.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
    iris.addColorStop(0, 'rgba(' + pale + ', 0.95)');
    iris.addColorStop(1, 'rgba(' + blue + ', 0.55)');
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, Math.PI * 2);
    ctx.fillStyle = iris;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ix, iy, ir * 0.18, ir * (0.35 + 0.45 * open), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }
  ctx.lineJoin = 'round';
  [[lineWidth * 5, 0.15], [lineWidth * 1.6, 0.95]].forEach(([w, a]) => {
    shape();
    ctx.strokeStyle = 'rgba(' + pale + ', ' + a + ')';
    ctx.lineWidth = w;
    ctx.stroke();
  });
}

// Where the eye's iris sits: turned from the middle (x, y) toward the
// player on the canvas, as far as SKY_EYE.look of the half width `r`
// sideways and no further up or down than the lids `lid` allow.
function pupilAt(x, y, r, lid) {
  const player = toCamera(cam, [look.walkAt.col + 0.5, look.walkAt.row + 0.5, STICK_HEIGHT * 0.8]);
  if (player[2] < NEAR) return [x, y];
  const [px, py] = toScreen(cam, player);
  const length = Math.hypot(px - x, py - y) || 1;
  return [x + (px - x) / length * r * SKY_EYE.look, y + (py - y) / length * Math.min(lid * 0.6, r * SKY_EYE.look)];
}

// Comfort mode's sky: the turns left before the light takes the floor, as
// plain words where the eye would be ("no light here" with no boss's
// light; in the tutorial, where the eye is open, "it is watching").
function drawTurnsLeft(ctx, [x, y]) {
  const left = skyTurnsLeft();
  const words = state.floor.tutorial ? t('sky.watching') : left === null ? t('sky.noLight') : t('sky.turnsLeft', { count: left });
  ctx.font = Math.round(width * SKY_EYE.size * 0.5) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgb(' + look.colours.glowRgb + ')';
  ctx.fillText(words, x, y);
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
