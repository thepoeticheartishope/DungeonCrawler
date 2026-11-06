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
// the boss's mist. The rest stay glyphs. Combat's stick men, the gun's
// brackets, laser and shot and the answer ring went in dungeon removal step C;
// the player still carries his book, shut (roomgun.js). Step F:// Step F: windows on back walls that face
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
  ROOM_VIEW, PLAYER_CONE_RANGE, FIGURE3D, SHIP_WINDOWS,
} from './config.js';
import { lookAngle, wrapAngle } from './look.js';
import { playerPose, playerActive, resetPlayerForm, emberGlow } from './playerform.js';
import { figurePose, projectFigure, phiOfAngle, resetFigure } from './figure3d.js';
import { isWall, grain } from './mapshared.js';
import {
  STAND, drawThingsWith, drawLamp, drawLampShade, drawEmberHead, STICK_LINE,
} from './roomthings.js';
import { startGunFrame, holdBook, drawBook, drawBookInto } from './roomgun.js';
import { startSkyFrame, drawWindow, drawSky, drawShipView } from './roomsky.js';

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
  // The ship (ship plan): deck plates and hull panels, each room a slightly
  // different cool grey so the rooms still read apart.
  'plan.ship.command': { floor: 'plate', panel: true, paper: ['#4e5763', '#5a6470'] },
  'plan.ship.airlock': { floor: 'grate', panel: true, paper: ['#4a5056', '#555c63'] },
  'plan.ship.medBay': { floor: 'plate', panel: true, paper: ['#5a6668', '#667374'] },
  'plan.ship.bridge': { floor: 'plate', panel: true, paper: ['#4b5566', '#566173'] },
  'plan.ship.hydroponics': { floor: 'plate', panel: true, paper: ['#4f5d55', '#5a695f'] },
  'plan.ship.engineRoom': { floor: 'grate', panel: true, paper: ['#57534d', '#625d56'] },
  'plan.ship.quarters': { floor: 'plate', panel: true, paper: ['#55525e', '#605c69'] },
  'plan.ship.washroom': { floor: 'plate', panel: true, paper: ['#526064', '#5d6b70'] },
  'plan.ship.galley': { floor: 'plate', panel: true, paper: ['#5a564f', '#655f57'] },
};
// The ship's corridors: grating between hull panels.
const SHIP_HALL_LOOK = { floor: 'grate', panel: true, paper: ['#454c55', '#50575f'] };
const PLATE = { base: '#4c535b', light: '#58606a', seam: '#353a41', rivet: '#666e78' };
const GRATE = { base: '#3a4048', slot: '#262a30', seam: '#2f343a' };
const HULL_TRIM = { crown: ['#2a3038', '#3b434d'], skirting: ['#2f353d', '#414952'], rim: ['#3a414b', '#4d5662'] };
const SHIP_TINT = [226, 236, 246]; // the ship's steady light, a cool white
const CROWN = ['#2b2230', '#3d3343'];          // the dark moulding along a wall's top, and its light edge
const SKIRTING = ['#3a2c26', '#4c3b32'];       // the board along a wall's foot, and its light edge
const RIM = ['#463c4f', '#5c516a'];            // the band round a room, and its light edge
const RIM_WIDTH = 4;                           // in the picture's pixels
const PILLAR = { body: '#4a4652', light: '#5a5662', dark: '#38343f', top: '#625d6b', rise: 1.5 };
// The tints of the light: the player's own light is the phosphor's cool
// white, the dim room and memory a touch violet.
const LIT_TINT = [228, 240, 244];
const DIM_TINT = [244, 236, 255];

// How each kind of thing is drawn (step B; tests/roomview.test.mjs checks
// every kind the game puts on the map has one): 'stand' stands on its tile
// and is sorted with the player, 'player' is the player's stick man. A
// thing not made out yet is a pixel '?' that stands like a prop, except a
// shutter (drawn as it is).
export const ROOM_DRAWINGS = {
  furniture: 'stand', shutter: 'stand', console: 'stand', powerBoard: 'stand', crew: 'stand',
  player: 'player',
};
// The '?' of a thing not made out yet, as rows of picture pixels.
const UNKNOWN = [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '];
const UNKNOWN_GLOW = 0.5;       // it shows this strongly over the dark, so a lit one reads
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
let mask = null;          // what stands in front of a window, cut out of its glass (glassBehind)
let mctx = null;
let glass = null;         // the windows' bright glass, with what stands in front cut out (glassBehind)
let glctx = null;
let view = { w: 0, h: 0 }; // the picture's size this frame

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

// How many canvas pixels each picture pixel takes on a canvas `w` by `h`,
// a whole number, at least 1: on a map wider than tall (desktop) the
// biggest that still shows ROOM_VIEW.minAcross tiles across and minDown
// down; on a taller one (a phone) the nearest to aimAcrossTall across, so
// a phone sees about as far round the player as desktop does.
export function viewScale(w, h) {
  if (h > w) return Math.max(1, Math.round(w / (T * ROOM_VIEW.aimAcrossTall)));
  return Math.max(1, Math.floor(Math.min(w / (T * ROOM_VIEW.minAcross), h / (T * ROOM_VIEW.minDown))));
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

// The player's figure in figure3d.js (its owner key).
const PLAYER_FIGURE = {};

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
// things, fogOf, keepMoving, showPlain, now, still, walkAt).
export function drawRoomScene(ctx, canvasSize, shared) {
  look = shared;
  const f = state.floor;
  if (!built || built.floor !== f || built.entered !== state.run.floorsEntered || built.walls !== f.wallSet || built.pillars !== f.pillarSet) built = buildFloor(f);
  if (shownFloor !== state.run.floorsEntered) {
    resetPlayerForm();
    resetFigure(PLAYER_FIGURE);
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
  const sliding = walkedSince(at);
  if (moveCamera(goal) || sliding) look.showPlain();
  const ox = Math.round(shownCam.x);
  const oy = Math.round(shownCam.y);
  drawThingsWith(bctx, gctx, look);
  startGunFrame(bctx);
  startSkyFrame(look, scale);

  // The picture: the still floor, then what stands on it, back to front.
  bctx.globalCompositeOperation = 'source-over';
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, viewW, viewH);
  bctx.drawImage(built.world, ox, oy, viewW, viewH, 0, 0, viewW, viewH);
  const items = [];
  const c0 = Math.floor(ox / T) - 1, c1 = Math.ceil((ox + viewW) / T) + 1;
  const r0 = Math.floor(oy / T) - 1, r1 = Math.ceil((oy + viewH) / T) + 2;
  const inView = (row, col) => row >= r0 && row <= r1 && col >= c0 && col <= c1;
  // Every ship window on screen shows the same scrolling space, not just
  // the ones in the player's room (Timothy 2026-11-03: a window in the next
  // room showed the still picture, then jumped on walking in). Drawn under
  // the light, so a window in another room is as dim as its room.
  built.windows.filter(w => w.view && inView(w.row, w.col)).forEach(w => drawShipView(bctx, w, ox, oy, look.still ? null : look.now, 1));
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
    const { row, col } = thing.tile;
    if (drawing === 'stand') items.push({ y: thing.at.row + 1, row, col, draw: () => STAND[thing.kind](thing, x, y, glows) });
    if (drawing === 'unknown') items.push({ y: thing.at.row + 1, row, col, draw: () => drawUnknown(x, y, glows) });
  });
  items.push({ y: at.row + ROOM_VIEW.footAt + 0.01, draw: () => drawStickMan(at, ox, oy) });
  // The safe room's lamp hangs from the ceiling, over all of it.
  if (f.safeRoom && space.room === f.safeRoom.chamber) items.push({ y: Infinity, draw: () => drawLampShade(ox, oy) });
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
  const lit = built.windows.filter(w => w.room === space.room);
  const safe = f.safeRoom;
  if (safe && space.room === safe.chamber) drawLamp(ox, oy, glows);
  bctx.globalCompositeOperation = 'multiply';
  bctx.drawImage(glow, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
  // A ship window's view of space stays near its own brightness (only the
  // glass, so its frame takes the ship's light like the wall), scrolling
  // slowly as the ship flies (still under reduced motion).
  const ship = lit.filter(w => w.view);
  glassBehind(ship, items, glows, SHIP_WINDOWS.glass, c => ship.forEach(w => drawShipView(c, w, ox, oy, look.still ? null : look.now, 1)));
  // What gives off its own light, over the lit picture.
  bctx.globalCompositeOperation = 'lighter';
  glows.forEach(draw => draw());
  bctx.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, viewW, viewH, 0, 0, viewW * scale, viewH * scale);
  ctx.imageSmoothingEnabled = true;
  drawSky(ctx, viewW, viewH, at, ox, oy);
}

// The tile under a tap at (px, py) CSS pixels from the map's top-left;
// null before the first frame.
export function roomTileAt(px, py) {
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
  if (room === undefined) return state.floor.ship ? SHIP_HALL_LOOK : HALL_LOOK;
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
  if (floor === 'plate') {
    ctx.fillStyle = PLATE.base;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = PLATE.light;
    ctx.fillRect(x + 1, y + 1, T - 2, 1);
    ctx.fillStyle = PLATE.seam;
    ctx.fillRect(x, y + T - 1, T, 1);
    ctx.fillRect(x + T - 1, y, 1, T);
    ctx.fillStyle = PLATE.rivet;
    for (const [rx, ry] of [[2, 3], [T - 4, 3], [2, T - 4], [T - 4, T - 4]]) ctx.fillRect(x + rx, y + ry, 1, 1);
    if (grain(row, col, 7) > 0.7) ctx.fillRect(x + 5 + Math.floor(grain(row, col, 8) * 5), y + 7, 2, 1);
    return;
  }
  if (floor === 'grate') {
    ctx.fillStyle = GRATE.base;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = GRATE.slot;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 3 + i * 4, T - 6, 2);
    ctx.fillStyle = GRATE.seam;
    ctx.fillRect(x, y + T - 1, T, 1);
    ctx.fillRect(x + T - 1, y, 1, T);
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
  const crown = look.panel ? HULL_TRIM.crown : CROWN;
  const skirting = look.panel ? HULL_TRIM.skirting : SKIRTING;
  ctx.fillStyle = paper[0];
  ctx.fillRect(x, y, T, T);
  ctx.fillStyle = paper[1];
  if (look.panel) drawPanel(ctx, x, y, row, col, face);
  else {
    for (let i = 2; i < T; i += 6) {
      for (let j = (i + (face === 'upper' ? 0 : 2)) % 12 < 6 ? 2 : 5; j < T; j += 6) {
        ctx.fillRect(x + j, y + i, 1, 1);
        ctx.fillRect(x + j - 1, y + i + 1, 3, 1);
        ctx.fillRect(x + j, y + i + 2, 1, 1);
      }
    }
  }
  if (face === 'upper' || !isWall(row - 1, col)) {
    ctx.fillStyle = crown[0];
    ctx.fillRect(x, y, T, 3);
    ctx.fillStyle = crown[1];
    ctx.fillRect(x, y + 3, T, 1);
  }
  if (face === 'lower') {
    ctx.fillStyle = skirting[0];
    ctx.fillRect(x, y + T - 3, T, 3);
    ctx.fillStyle = skirting[1];
    ctx.fillRect(x, y + T - 3, T, 1);
  }
  for (const [dc, px] of [[-1, 0], [1, T - 2]]) {
    if (!isWall(row, col + dc)) {
      ctx.fillStyle = skirting[0];
      ctx.fillRect(x + px, y, 2, T);
    }
  }
}

// A hull panel on a ship wall's face, in the face's light colour (already
// the fill style): a seam every second tile, a light line across the
// lower face, and now and then a small vent with slats. Low detail on
// purpose: the panels should read as metal, not draw the eye.
function drawPanel(ctx, x, y, row, col, face) {
  ctx.fillRect(x, y + (face === 'upper' ? 9 : 5), T, 1);
  if (col % 2) ctx.fillRect(x + T - 1, y, 1, T);
  if (face !== 'lower' || grain(row, col, 11) < 0.8) return;
  ctx.fillStyle = PLATE.seam;
  ctx.fillRect(x + 4, y + 8, 8, 4);
  ctx.fillStyle = PLATE.light;
  for (let i = 0; i < 2; i++) ctx.fillRect(x + 5, y + 9 + i * 2, 6, 1);
}

// The dark band round a room, as in the picture: along each side of this
// wall tile that touches floor or a face, and in a corner where only the
// diagonal does.
function drawRim(ctx, row, col) {
  const x = col * T, y = row * T, B = RIM_WIDTH;
  const open = (r, c) => !isWall(r, c) || faceOf(r, c, isWall) !== null;
  const rim = state.floor.ship ? HULL_TRIM.rim : RIM;
  const band = (bx, by, bw, bh, lx, ly, lw, lh) => {
    ctx.fillStyle = rim[0];
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = rim[1];
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
    // The ship has no dark areas: a steady light everywhere, a little
    // brighter round the player (ship plan).
    if (f.ship) {
      const d = Math.hypot(row - at.row, col - at.col);
      const near = ROOM_VIEW.litNear + (ROOM_VIEW.litFar - ROOM_VIEW.litNear) * Math.min(1, d / PLAYER_CONE_RANGE);
      return [Math.max(near, ROOM_VIEW.shipLit), SHIP_TINT];
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
  const pose = playerPose(look.now, look.still, false);
  const h = ROOM_VIEW.stickHeight * T;
  const fx = (at.col + 0.5) * T - ox;
  const fy = (at.row + ROOM_VIEW.footAt) * T - oy;
  const ax = Math.sin(angle), ay = -Math.cos(angle);
  // The body is the 3D moves' (figure3d.js, one stick plan step F): it
  // walks as far as he goes, crouches while he sneaks, and faces his light.
  const f = state.floor;
  const crouch = f.sneaking || f.creeping;
  const pxPerM = h / FIGURE3D.heightM;
  const joints = figurePose(PLAYER_FIGURE, { at: [at.col, at.row], metres: FIGURE3D.heightM / ROOM_VIEW.stickHeight, crouch }, look.now, look.still);
  const J = projectFigure(joints, phiOfAngle(angle), fx, fy, pxPerM);
  const book = holdBook(ax, J.elR, J.haR);
  const px = v => Math.round(v) + 0.5;
  const path = (points) => points.forEach(([x, y], i) => (i ? bctx.lineTo(px(x), px(y)) : bctx.moveTo(px(x), px(y))));
  bctx.save();
  // The book is under his arm, so the arm is drawn over it.
  drawBook(book);
  bctx.strokeStyle = look.colours.text;
  bctx.lineWidth = STICK_LINE;
  bctx.lineCap = 'square';
  bctx.beginPath();
  path([J.ftL, J.knL, J.pelvis, J.knR, J.ftR]);
  path([J.pelvis, J.chest, J.neck]);
  path([J.haL, J.elL, J.neck, J.elR, book.hand]);
  bctx.stroke();
  drawEmberHead(bctx, J.headMid[0], J.headMid[1], h, playerHead(ax, pose));
  bctx.restore();
}

// The player's ember head (roomthings.js drawEmberHead) looking along
// `ax`: his own white ring and light, glowing with his breath.
function playerHead(ax, pose) {
  return { lean: ax, ring: look.colours.text, rgb: look.colours.glowRgb, level: emberGlow(pose.breath, look.still) };
}

// How a map thing is drawn (ROOM_DRAWINGS), allowing for what isn't made
// out yet: its '?', except a shutter, which shows as it is.
function drawingOf(thing) {
  const drawing = ROOM_DRAWINGS[thing.kind];
  if (thing.glyph === null && thing.kind !== 'shutter') return 'unknown';
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

// Lays the bright glass of the windows `ws` (drawn by `drawGlass(c)` into
// a layer) over the lit picture at `alpha`, with everything that stands in
// front of their back wall (the player, the crew, furniture, lamps) cut out
// of it, so no one in front of a window fades into it (Timothy 2026-11-03).
// Redrawing the items pushes their glows again; those copies are dropped.
function glassBehind(ws, items, glows, alpha, drawGlass) {
  if (!ws.length) return;
  const wall = Math.min(...ws.map(w => w.row)) + 0.5;
  const front = items.filter(item => item.y > wall);
  if (!glass) {
    glass = document.createElement('canvas');
    glctx = glass.getContext('2d');
  }
  if (glass.width !== view.w || glass.height !== view.h) {
    glass.width = view.w;
    glass.height = view.h;
  }
  glctx.globalCompositeOperation = 'source-over';
  glctx.clearRect(0, 0, view.w, view.h);
  drawGlass(glctx);
  if (front.length) {
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
    const picture = bctx, glowCount = glows.length;
    bctx = mctx;
    drawThingsWith(mctx, gctx, look);
    drawBookInto(mctx);
    front.forEach(item => item.draw());
    bctx = picture;
    drawThingsWith(picture, gctx, look);
    drawBookInto(picture);
    glows.length = glowCount;
    glctx.globalCompositeOperation = 'destination-out';
    glctx.drawImage(mask, 0, 0);
    glctx.globalCompositeOperation = 'source-over';
  }
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = alpha;
  bctx.drawImage(glass, 0, 0);
  bctx.globalAlpha = 1;
}
