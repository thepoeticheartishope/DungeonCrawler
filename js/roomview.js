// The room view (room view plan, `ideas/room-view-plan.md` outside the
// repo): a fixed camera looking down on one room at a time at the angle
// of the RPG Maker horror games, drawn as pixel art. Back walls show their
// face, the floor runs toward the player, and the dark round the room is
// black. The game's only map view since step G (the shoulder view it
// replaced is kept at ideas/reference/shoulder-view/ outside the repo).
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
// the tutorial's ring of words. Step F: windows on back walls that face
// the outside (windows.js), the warm light they throw on the floor (real
// light: a stick man in it is seen) with the frame's shadow across it, and the eye in the sky: while the player looks up (main.js
// holdLookUp -> lookUp), the room fades into the night sky and the eye
// hangs in it, drawn as pixel art like the rest. The picture is drawn at ROOM_VIEW.tilePx a tile into a small
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
// mapview.js calls drawRoomScene() from its drawScene, and roomTileAt() / roomGridAt() to turn a tap into a tile or a floor
// point. faceOf, viewScale, cameraGoal and ROOM_DRAWINGS are exported for
// the tests.
// Reads state and never changes it.

import { state, key, parseKey } from './state.js';
import { FOUR_STEPS } from './grid.js';
import {
  ROOM_VIEW, PLAYER_CONE_RANGE, MAP_GLYPH_SIZES, ISO_TILES_ACROSS, ISO_TILES_ACROSS_NARROW,
  ISO_NARROW_MAP_WIDTH, PLAYER_EMBER, FIGURE3D, ENEMY_LIGHT, MINION_KINDS, SHADOW,
} from './config.js';
import { lookAngle, wrapAngle } from './look.js';
import { playerPose, playerActive, resetPlayerForm, emberGlow } from './playerform.js';
import { figurePose, projectFigure, phiOfAngle, resetFigure, sampleMove } from './figure3d.js';
import { MOVE_JOINTS } from './moves3d.js';
import { drawDroppedLetters, drawStickForm, stickBox, dyingSticks } from './stickforms.js';
import { isWall, grain, ENEMY_KINDS, POSE_SCALE } from './mapshared.js';
import {
  minionOn, eyeOf, EYE_LIFT, EYE_WIDTH, HEARD_LIFT, WEAK_RING, WEAK_RING_LEVEL,
} from './mapshared.js';
import { lampsOn, lampPoolLit } from './lamps.js';
import { shadowsAt } from './shadows.js';
import { answerRingNow } from './swirl.js';
import {
  FLAT, STAND, HALL_LAMP, POOL, drawThingsWith, bulbAt, hallLampSpot, drawBeam, drawLamp, drawLampShade, drawMist,
  drawSounds, lampLevel, shadeAt,
} from './roomthings.js';
import {
  startGunFrame, gunTargets, holdBook, drawBook, drawReach, drawBrackets, drawLaser, drawShot, drawAnswerRing, drawDarkRing,
} from './roomgun.js';
import { startSkyFrame, drawWindow, drawPool, drawSky } from './roomsky.js';

const T = ROOM_VIEW.tilePx;

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
const LAMP_TINT = [255, 214, 170];
// The player's stick man, drawn in the picture's pixels.
const STICK_LINE = 1;
const SPOT_MARK_COLOUR = '#ffd36b'; // DEV -> Spots' letters (drawSpotMarks)
const HEAD_SHARE = 0.12;         // the head's radius, a share of his height
const HIDDEN_HEAD = 0.45;        // hidden in a room spot, how high his head shows, a share of his height

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
  box: 'stand', furniture: 'stand', cell: 'stand', desk: 'stand', charger: 'stand', relay: 'stand', chest: 'stand', coin: 'stand', key: 'stand',
  shutter: 'stand', switch: 'stand',
  minion: 'form', exchange: 'glyph', boss: 'glyph', hunter: 'glyph', player: 'player',
};
// The '?' of a thing not made out yet, as rows of picture pixels.
const UNKNOWN = [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '];
const UNKNOWN_GLOW = 0.5;       // it shows this strongly over the dark, so a lit one reads
// The stick men's glowing lines: halo layers (width a share of the line,
// strength) under the core line, as in the shoulder view.
const HALO_LAYERS = [{ width: 3.5, strength: 0.07 }, { width: 1.6, strength: 0.14 }];
const EDGE_MARK = 0.22;         // the cold mark for a stick man off screen, as a share of a tile

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
let frame = { ox: 0, oy: 0 }; // the camera's top-left this frame, in picture pixels

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

// The player's figure in figure3d.js (its owner key), and his neck's
// height standing, so a crouch can lower the gun with it.
export const PLAYER_FIGURE = {};
const NECK_Y = MOVE_JOINTS.indexOf('neck') * 3 + 1;
const STANDING_NECK = sampleMove('Idle_Loop', 0, true)[NECK_Y];

// Where the player was drawn last (one stick: their free spot), and
// whether they have moved since. While they walk the scene shows plainly
// each frame, with no afterglow, as during a step's slide.
let drawnAt = null;
function walkedSince(at) {
  const moved = !drawnAt || drawnAt.row !== at.row || drawnAt.col !== at.col;
  drawnAt = { row: at.row, col: at.col };
  return moved;
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
    resetFigure(PLAYER_FIGURE);
    shownCam = null;
    shadowFeet.clear();
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
  const sliding = state.settings.oneStick ? walkedSince(at) : at.row !== f.playerRow || at.col !== f.playerCol;
  if (moveCamera(goal) || sliding) look.showPlain();
  const ox = Math.round(shownCam.x);
  const oy = Math.round(shownCam.y);
  frame = { ox, oy };
  drawThingsWith(bctx, gctx, look);
  startGunFrame(bctx, look, frame, scale, pageScale);
  startSkyFrame(gctx, look, scale);

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
    const { row, col } = parseKey(k);
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
  // Hidden in a room spot, the player is drawn after its piece (only his
  // ember head shows).
  items.push({ y: at.row + (f.hidden ? 1.01 : ROOM_VIEW.footAt + 0.01), draw: () => drawStickMan(at, ox, oy) });
  // The safe room's lamp hangs from the ceiling, over all of it.
  if (f.safeRoom && space.room === f.safeRoom.chamber) items.push({ y: Infinity, draw: () => drawLampShade(ox, oy) });
  // A plan's lamps hang the same way, in the halls as well as rooms.
  const lamps = f.lamps.filter(l => inView(l.row, l.col));
  lamps.forEach(l => items.push({ y: Infinity, draw: () => shadeAt(...hallLampSpot(l, ox, oy)) }));
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
  const lit = built.windows.filter(w => w.room === space.room);
  lit.forEach(w => drawPool(w, ox, oy));
  const safe = f.safeRoom;
  if (safe && safe.lamp && space.room === safe.chamber) drawLamp(ox, oy, glows);
  if (lampsOn()) lamps.filter(l => !state.settings.fogEnabled || f.visibleSet.has(key(l.row, l.col))).forEach(l => glows.push(() => bulbAt(...hallLampSpot(l, ox, oy), HALL_LAMP.bulb)));
  drawShadows(ox, oy, inView);
  bctx.globalCompositeOperation = 'multiply';
  bctx.drawImage(glow, 0, 0);
  // The windows' glass glows from outside.
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = POOL.glass;
  lit.forEach(w => bctx.drawImage(built.world, w.col * T, (w.row - 1) * T, 2 * T, 2 * T, w.col * T - ox, (w.row - 1) * T - oy, 2 * T, 2 * T));
  bctx.globalAlpha = 1;
  // What gives off its own light, over the lit picture.
  bctx.globalCompositeOperation = 'lighter';
  glows.forEach(draw => draw());
  drawMist(c0, r0, c1, r1, ox, oy);
  drawSounds(ox, oy);
  drawReach(c0, r0, c1, r1, ox, oy);
  bctx.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, viewW, viewH, 0, 0, viewW * scale, viewH * scale);
  ctx.imageSmoothingEnabled = true;
  const ring = answerRingNow(look.now);
  if (ring) drawAnswerRing(ctx, ring, false);
  const formBoxes = drawForms(ctx, ox, oy, standing);
  drawGlyphs(ctx, ox, oy);
  tapBoxes = [...formBoxes, ...tapBoxes];
  gunTargets(tapBoxes);
  if (ring) drawAnswerRing(ctx, ring, true);
  drawBrackets(ctx);
  drawLaser(ctx);
  drawShot(ctx);
  drawDarkRing(ctx);
  drawEdgeMarks(ctx, ox, oy);
  if (state.settings.showSpots) drawSpotMarks(ctx, ox, oy);
  drawSky(ctx, viewW, viewH, at, ox, oy);
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
// a tile's middle at whole numbers (as main.js aimAtPoint takes it), or
// null before the first frame.
export function roomGridAt(px, py) {
  if (!shownCam) return null;
  const x = px * pageScale / scale + Math.round(shownCam.x);
  const y = py * pageScale / scale + Math.round(shownCam.y);
  return { row: y / T - 0.5, col: x / T - 0.5 };
}

// ---- the floor's still picture ----

// The floor's walls, floors and rims drawn once, and its rooms' extents.
function buildFloor(f) {
  const world = document.createElement('canvas');
  world.width = world.height = f.GRID_SIZE * T;
  const ctx = world.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, world.width, world.height);
  const rooms = new Map();
  f.chamberAt.forEach((i, k) => {
    const { row, col } = parseKey(k);
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
  f.windows.forEach(w => drawWindow(ctx, w));
  return { floor: f, entered: state.run.floorsEntered, walls: f.wallSet, pillars: f.pillarSet, world, rooms, windows: f.windows };
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
      room,
    };
  }
  const tiles = new Set([key(row, col)]);
  let edge = [[row, col]];
  for (let step = 0; step < ROOM_VIEW.hallReach; step++) {
    const next = [];
    edge.forEach(([r, c]) => FOUR_STEPS.forEach(([dr, dc]) => {
      const k = key(r + dr, c + dc);
      if (isWall(r + dr, c + dc) || tiles.has(k) || f.chamberAt.has(k)) return;
      tiles.add(k);
      next.push([r + dr, c + dc]);
    }));
    edge = next;
  }
  return { tiles, bounds: null, room: null };
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
// Where each stick man's shadow is cast from (view-only): it glides
// toward his tile, or the spot he is drawn at while seen, so a shadow seen
// before he is never jumps a tile at a time. Keyed by the stick man.
const shadowFeet = new Map();
let shadowClock = null;

// The stick men's shadows (shadows.js), darkening the light itself and
// only on floor that is lit (visibleSet, not the dim room shape or memory:
// Timothy, they showed where there was no light): a faint wedge from his
// feet, widening to SHADOW.width at its tip and fading a little along it.
function drawShadows(ox, oy, inView) {
  const f = state.floor;
  const dt = shadowClock === null ? 0 : look.now - shadowClock;
  shadowClock = look.now;
  const seenAt = new Map(look.things.filter(thing => drawingOf(thing) === 'form').map(thing => [minionOn(thing.tile), thing.at]));
  [...shadowFeet.keys()].forEach(m => { if (!f.minions.includes(m)) shadowFeet.delete(m); });
  gctx.globalCompositeOperation = 'source-over';
  gctx.save();
  gctx.beginPath();
  f.visibleSet.forEach(k => {
    const { row, col } = parseKey(k);
    if (inView(row, col) && !isWall(row, col)) gctx.rect(col * T - ox, row * T - oy, T, T);
  });
  gctx.clip();
  f.minions.forEach(m => {
    const goal = seenAt.get(m) || { row: m.row, col: m.col };
    const feet = glideFeet(m, goal, dt);
    if (!inView(Math.round(feet.row), Math.round(feet.col))) return;
    shadowsAt(feet).forEach(s => {
      const fx = (feet.col + 0.5) * T - ox, fy = (feet.row + ROOM_VIEW.footAt) * T - oy;
      const tx = fx + s.dir[1] * s.length * T, ty = fy + s.dir[0] * s.length * T;
      const [nx, ny] = [-s.dir[0] * T, s.dir[1] * T];
      const half = SHADOW.width / 2;
      const g = gctx.createLinearGradient(fx, fy, tx, ty);
      g.addColorStop(0, 'rgba(0, 0, 0, ' + SHADOW.dark + ')');
      g.addColorStop(1, 'rgba(0, 0, 0, ' + SHADOW.tipDark + ')');
      gctx.fillStyle = g;
      gctx.beginPath();
      gctx.moveTo(fx + nx * half * 0.4, fy + ny * half * 0.4);
      gctx.lineTo(tx + nx * half, ty + ny * half);
      gctx.lineTo(tx - nx * half, ty - ny * half);
      gctx.lineTo(fx - nx * half * 0.4, fy - ny * half * 0.4);
      gctx.closePath();
      gctx.fill();
    });
  });
  gctx.restore();
}

// Moves stick man m's shadow's feet toward `goal` by `dt` ms of gliding
// (SHADOW.glideMs a tile), or at once under reduced motion or when far
// off (a duct drop, a knockback); returns where they are.
function glideFeet(m, goal, dt) {
  const was = shadowFeet.get(m);
  const gap = was ? Math.hypot(goal.row - was.row, goal.col - was.col) : Infinity;
  if (look.still || gap > 2 || gap <= dt / SHADOW.glideMs) {
    shadowFeet.set(m, { row: goal.row, col: goal.col });
    return goal;
  }
  const share = dt / SHADOW.glideMs / gap;
  const feet = { row: was.row + (goal.row - was.row) * share, col: was.col + (goal.col - was.col) * share };
  shadowFeet.set(m, feet);
  look.keepMoving();
  return feet;
}

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
    if (fog && f.visibleSet.has(k) && !f.sightSet.has(k) && lampPoolLit(row, col)) {
      return [Math.max(lampLevel(row, col), space.tiles.has(k) ? ROOM_VIEW.room : 0), LAMP_TINT];
    }
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
  // Hidden in a room spot (spots.js): only his ember head, low, peering
  // out from the piece; no body and no book.
  if (state.floor.hidden) {
    drawEmberHead(fx, fy - h * HIDDEN_HEAD, h, ax, pose);
    return;
  }
  // The body is the 3D moves' (figure3d.js, one stick plan step F): it
  // walks as far as he goes, crouches while he sneaks, and faces his light.
  const f = state.floor;
  const crouch = state.settings.oneStick && (f.sneaking || f.creeping);
  const pxPerM = h / FIGURE3D.heightM;
  const joints = figurePose(PLAYER_FIGURE, { at: [at.col, at.row], metres: FIGURE3D.heightM / ROOM_VIEW.stickHeight, crouch }, look.now, look.still);
  const J = projectFigure(joints, phiOfAngle(angle), fx, fy, pxPerM);
  // A crouch lowers the book with his shoulders.
  const drop = (STANDING_NECK - joints[NECK_Y]) * pxPerM;
  const book = holdBook(fx, fy, ax, ay, h, pose.gunRise * h - drop, J.elR, J.haR);
  const px = v => Math.round(v) + 0.5;
  const path = (points) => points.forEach(([x, y], i) => (i ? bctx.lineTo(px(x), px(y)) : bctx.moveTo(px(x), px(y))));
  bctx.save();
  // The shut book is under his arm, so the arm is drawn over it; facing
  // away, the open book is beyond him, so his body is drawn over it.
  if (!book.open || book.behind) drawBook(book);
  bctx.strokeStyle = look.colours.text;
  bctx.lineWidth = STICK_LINE;
  bctx.lineCap = 'square';
  bctx.beginPath();
  path([J.ftL, J.knL, J.pelvis, J.knR, J.ftR]);
  path([J.pelvis, J.chest, J.neck]);
  path(book.open ? [book.hands[0], J.neck, book.hands[1]] : [J.haL, J.elL, J.neck, J.elR, book.hand]);
  bctx.stroke();
  if (book.open && !book.behind) drawBook(book);
  drawEmberHead(J.headMid[0], J.headMid[1], h, ax, pose);
  bctx.restore();
}

// The ember head at (hx, headY), for a stick man `h` tall looking along
// `ax`: dark inside, a glow in the middle that breathes and leans the way
// he looks, and the ring round it.
function drawEmberHead(hx, headY, h, ax, pose) {
  const headR = Math.max(2.5, h * HEAD_SHARE);
  bctx.save();
  bctx.strokeStyle = look.colours.text;
  bctx.lineWidth = STICK_LINE;
  bctx.beginPath();
  bctx.arc(hx, headY, headR, 0, Math.PI * 2);
  bctx.fillStyle = look.colours.hidden;
  bctx.fill();
  const gx = hx + ax * headR * PLAYER_EMBER.lean;
  const ember = bctx.createRadialGradient(gx, headY, 0, gx, headY, headR * PLAYER_EMBER.reach);
  ember.addColorStop(0, 'rgba(' + look.colours.glowRgb + ', ' + emberGlow(pose.breath, look.still) + ')');
  ember.addColorStop(1, 'rgba(' + look.colours.glowRgb + ', 0)');
  bctx.fillStyle = ember;
  bctx.fill();
  bctx.stroke();
  bctx.restore();
}

// DEV -> Spots (room spots plan step A): each room spot's letter in its
// tile's top-left corner, over everything: H hide, T takedown, L lure,
// S scout, - nothing this run.
function drawSpotMarks(ctx, ox, oy) {
  const tile = T * scale;
  ctx.save();
  ctx.font = Math.round(tile * 0.45) + 'px VT323, monospace';
  ctx.textBaseline = 'top';
  state.floor.roomSpots.forEach(s => {
    const x = (s.col * T - ox) * scale + 2, y = (s.row * T - oy) * scale + 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 1, y, tile * 0.32, tile * 0.45);
    ctx.fillStyle = SPOT_MARK_COLOUR;
    ctx.fillText(s.kind ? s.kind[0].toUpperCase() : '-', x, y);
  });
  ctx.restore();
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
// out yet: its '?', except the stairs, a grate and a shutter, which show
// as they are.
function drawingOf(thing) {
  const drawing = ROOM_DRAWINGS[thing.kind] || 'glyph';
  if (thing.glyph === null && !['stairs', 'vent', 'shutter'].includes(thing.kind)) return ENEMY_KINDS.includes(thing.kind) ? 'glyph' : 'unknown';
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
      tw, height, lineWidth, toward, now: look.now, still: look.still, centre, player: [px, py], pixel: scale,
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
  drawThingsWith(mctx, gctx, look);
  front.forEach(s => s.draw());
  bctx = picture;
  drawThingsWith(picture, gctx, look);
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
