// The isometric map, the only map view: the floor drawn as phosphor-vector
// blocks on a diamond grid. Walls and pillars are glowing wireframe
// blocks, the floor dim diamond tiles, glyphs stand upright on their
// tiles, and light fades over the player's five steps. A wall standing
// between the camera and something the player can see is cut away, so
// nothing in sight is ever hidden. The camera rests while the player
// walks near the middle and glides after them past that.
//
// mapview.js calls drawIsoScene() from its drawScene and passes in what
// it owns: the colours, the list of things on the map, fog, glyph
// painting, the boss mist and the pulses; this file only decides where
// and how they stand. It reads state and
// never changes it. render.js reads isoScreenShare() / isoScreenOffset() so the edge glow
// points where this view shows things.
//
// With DEV -> Combat on gun (state.settings.gunCombat) it also draws the
// gun (gun plan step 4a): the stick man holds it (raised while a landed
// shot waits for the damage bar), the tiles it reaches are lit by the
// chance a shot there lands, corner brackets mark what can be shot, a
// dashed laser runs to the target, and showShot() plays a shot or a MISS.
// isoTileAt() turns a tap on the map back into a tile.
//
// A minion the player has made out stands as its kind's text form
// (textforms.js, gun plan step 4b) instead of a glyph; a killed one keeps
// floating apart where it died until it has faded.

import { state, key } from './state.js';
import { ISO_TILES_ACROSS, ISO_TILES_ACROSS_NARROW, ISO_NARROW_MAP_WIDTH, ISO_MAP_SHAPE, ISO_WALL_HEIGHT, ISO_CAMERA_BOX, ISO_CAMERA_GLIDE_MS, MAP_GLYPH_SIZES, MAP_ANIMATION_MS, PLAYER_CONE_RANGE } from './config.js';
import { FACING_VECTORS, canShoot, aimChance } from './sight.js';
import { t } from './text.js';
import { artAt, art } from './tileart.js';
import { drawTextForm, formBox, dyingForms } from './textforms.js';

// How bright a lit tile is, by its steps from the player (0 = their own
// tile): the light fades over the five steps they can see.
const LIGHT_FALLOFF = [1, 1, 0.85, 0.7, 0.56, 0.44];
const BOSS_LIT_LEVEL = 0.5;  // floor only the boss's light shows
const REMEMBERED_LEVEL = 0.2; // floor explored but not lit now
const WALL_MIN_LEVEL = 0.28; // a wall beside remembered floor: still a shape
const SEARCHED_LEVEL = 0.6;  // a box or paper already searched is dimmer

// Sizes, as shares of a tile's width unless they say otherwise.
const CAMERA_Y = 0.5;          // where the camera's tile stands, as a share of the map's height
const CAMERA_JUMP = 2;         // a player move longer than this many steps (a new floor, a new run) snaps the camera
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
// A line's glow is drawn as wider, fainter lines under it, not with the
// canvas's shadow blur: blur is the costliest thing a canvas can draw, and
// a phone redraws every wall each frame while the camera glides. Two
// layers, wide and faint then narrow and less faint, so it falls off
// softly like the blur did. Width is extra width per unit of blur above,
// strength a share of the line's own.
const HALO_LAYERS = [{ width: 0.9, strength: 0.07 }, { width: 0.4, strength: 0.14 }];
const POOL_RADIUS = 2.2;       // the player's light pool, in tiles
const MIST_WIDTH = 2;          // one tile's boss mist, in tiles across
const MIST_SQUASH = 0.62;      // the mist lies flat: its height over its width
const PILLAR_SHADOW = 2.7;     // how far a pillar's shadow reaches, in tiles
const PILLAR_SHADOW_WIDTH = 0.2; // its width at the pillar; it spreads to 1.8x at the end
// The stairs down: nested diamonds sinking into the floor.
const STAIR_STEPS = 4;
const STAIR_INSET = [0.08, 0.09]; // the first step's inset, then each next one's
const STAIR_DROP = 0.1;           // how far each step sinks, as a share of a tile's height
// The stairs' column of light, rising out of them above the walls so the
// way out shows even behind a wall. Soft layers, widest and faintest
// first: width a share of a tile's width, strength at the stairs.
const STAIR_BEAM_HEIGHT = 2.1;    // as a share of a wall's height
const STAIR_BEAM_LAYERS = [{ width: 0.55, strength: 0.16 }, { width: 0.32, strength: 0.26 }, { width: 0.12, strength: 0.5 }];
const STAIR_BEAM_FADE = [0.75, 0.5]; // where up the column it has faded to this share of its strength
const STAIR_BEAM_DEPTH = 0.5;     // the column draws among the standing things, with its own tile
// A doorway: two thin posts with an arch over them and a faint haze in the
// opening, so a way through reads from any side and its arch shows over a
// wall in front of it (Timothy picked this from the door frames mockup).
// It never cuts down with the walls beside it: it marks a way out.
const DOOR_POST = 0.07;          // half a post's width, in tiles
const DOOR_ARCH_RISE = 0.34;     // how far the arch rises above the walls, as a share of a wall's height
const DOOR_ARCH_THICK = 0.08;    // the arch's thickness, as a share of a wall's height
const DOOR_ARCH_STEPS = 16;      // straight pieces in each line of the arch
const DOOR_MIN_LEVEL = 0.5;      // a remembered doorway's arch is still this bright
const DOOR_HAZE = [0.2, 0.02];   // the haze's strength at the floor and at the arch
const DOOR_DEPTH = 0.6;          // draws after a thing standing in the doorway, before the wall past it
// The paper lying flat, in the tile's own two directions (-1..1 across it).
const PAPER_SHEET = [[-0.8, -0.55], [0.75, -0.7], [0.8, 0.55], [-0.75, 0.7]];
const PAPER_LINES = [-0.3, 0, 0.3];
const PAPER_SCALE = 0.2;
// The player, drawn as a stick man standing on their tile.
const STICK_HEIGHT = 0.62;     // feet to top of head
const STICK_LINE = 0.035;      // line width (never under 1.5px)
const STICK_BLUR = 0.12;       // its glow
const STICK_BREATH = 0.022;    // how far the chest lifts on a breath, as a share of its height
const STICK_ARM_SWAY = 0.012;  // how far the hands move with the breath
const STICK_STRIDE = 0.16;     // how far the feet swing apart on a step
const STICK_GLANCE = 0.8;      // how far the head turns on an idle glance, as a share of its radius
const TARGET_PULSE = [0.45, 1]; // the target diamond's strength at either end of its pulse
// The gun (gun plan), as shares of the stick man's height unless they say
// otherwise. Laid out as in the fight mockup (reload-fire-iso-mockup.html).
const GUN_REACH = 0.22;          // the gun hand, out from the shoulder toward where he faces
const GUN_DROP = 0.16;           // and down from the shoulder
const GUN_LENGTH = 0.3;          // grip to muzzle
const GUN_GRIP = 0.09;           // the grip, hanging under the gun hand
const GUN_RAISE = 0.08;          // how far the gun lifts while a landed shot waits for the damage bar
const GUN_KICK = 0.08;           // how far it kicks back on a shot
const GUN_LINE = 1.2;            // its line, as a share of the stick man's
const REACH_FILL = [0.03, 0.12]; // a reached tile's fill strength: plus this much more at 100% aim
const AIM_TEXT = [0.25, 0.4];    // a tile's aim % strength: plus this much more at 100% aim
const AIM_TEXT_SIZE = 0.2;       // its height, as a share of a tile's width
const BRACKET_ARM = 0.12;        // a corner bracket's arms, as a share of a tile's width
const BRACKET_HALF = 0.32;       // the narrowest a bracket box is, half its width as a share of a tile's
const BRACKET_LEVEL = [0.4, 0.95]; // a shootable thing's brackets, then the target's
const BRACKET_PULSE = 0.025;     // how far the target's brackets breathe out, as a share of a tile's width
const BRACKET_TEXT_SIZE = 0.26;  // the target's aim % over its brackets, as a share of a tile's width
const LASER_LEVEL = [0.45, 0.8]; // the laser's strength, then while a landed shot waits
const LASER_DASH = [0.06, 0.1];  // its dash and gap, in tile widths
const SHOT_RISE = 0.3;           // where a shot ends above its tile, as a share of a tile's width
const SHOT_RING = [0.06, 0.25];  // the ring where it lands: its first radius, then how much it grows, in tile widths
const MISS_PAST = 0.6;           // how far past the minion a missed shot goes, in tiles
const MISS_SIDE = 0.5;           // and how far to one side
const MISS_TEXT_SIZE = 0.36;     // MISS's height, as a share of a tile's width
const MISS_RISE = [1.15, 0.25];  // where MISS starts above its tile, then how far it floats up, in tile widths (slow: the calm rule)
const WEAK_RING = 0.12;          // the ring on a text form's weak point while a landed shot waits, its radius in tile widths
const WEAK_RING_LEVEL = 0.7;     // and its strength
// Walls in front of the camera, cut away (Timothy chose this over see-through glass).
const WALL_STUB = 0.22;          // a cut-away wall's stub, as a share of its height
const WALL_HOLD_STEPS = 2;       // a lowered wall stays down while the player is this many steps away or nearer
const WALL_COVER_WIDTH = 0.4;    // half the width of a wall that counts as covering something:
                                 // under half a tile, so a wall only touching it at a corner stays
const GHOST_LEVEL = 0.2;         // the dashed outline of a cut wall's full height
const GHOST_DASH = [0.03, 0.04]; // its dash and gap, in tile widths
const WALL_CUT_MAX_FRAME_MS = 50; // a wall's cut moves at most this much time per frame, so a long pause doesn't make it snap
const MIST_DEPTH = 0.25;         // the mist draws after its own tile's pillar, before what stands on it

// The faces of a block, darker than its top so it reads as standing up:
// the colour under the texture, then how much darker the texture is drawn
// (0..1). The light falls from the back left, so the south face is darkest.
const SOUTH_FACE = '#0a0e0f';
const EAST_FACE = '#0e1315';
const SOUTH_SHADE = 0.5;
const EAST_SHADE = 0.3;
// How strongly a floor or block texture shows, unlit (remembered) to fully lit.
const TEXTURE_STRENGTH = [0.3, 1];
// A floor diamond's edge, as phosphor strength: unlit, plus this much more
// fully lit. Fainter than before the textures: the stones show the tiles now.
const FLOOR_EDGE = [0.06, 0.3];
const FILL_PAD = 2; // spare pixels round a kept fill picture, so its soft edges aren't cut off

// This frame's layout, set by drawIsoScene.
let tw = 0;         // a tile's width on the canvas, in pixels
let th = 0;         // its height (half the width: the diamond)
let wallH = 0;      // a wall's height in pixels
let originX = 0;    // where the player's tile sits on the canvas (the light pool's middle)
let originY = 0;
let width = 0;      // the canvas's width and height, in pixels
let height = 0;
let across = ISO_TILES_ACROSS; // tile widths across the map this frame (fewer on a narrow map)
let look = null;    // what mapview.js passed in
let frontWalls = new Set(); // walls between the camera and something in sight, this frame
// How far each wall in view is cut down, 0 (full height) to 1 (a stub),
// easing toward whether it's in front now. Walls at full height aren't kept.
let wallCuts = new Map(); // key(row, col) -> 0..1
let lastCutAt = 0;          // the frame time wallCuts last moved
let halo = null;    // the glow strokeGlow set up for the next lines: [{ colour, width }] in pixels, or null
// Floor and block fills drawn once and copied (drawCachedFill): texture -> id -> picture.
const fillCache = new WeakMap();

// The camera: view-only, so it lives here and not in state. The tile the
// map centres on, fractional while it glides.
let camera = null;       // { row, col } shown this frame
let cameraGoal = null;   // { row, col } it is gliding to, or resting on
let glide = null;        // { from, start } while it glides to cameraGoal
let cameraFloor = -1;    // the floor (state.run.floorsEntered) the camera is on
let cameraPlayer = null; // the player's tile when the camera last looked
let stickSeen = null;    // the player's tile and facing when the stick man last stood still
let stickActiveAt = 0;   // when the player last moved, turned or bumped: idle time counts from here
// The gun's effects: view-only, like the camera.
let shot = null;         // the last shot, from showShot(): { start, to: { row, col }, missed }
let muzzle = null;       // where the gun's muzzle is this frame, in pixels (null with no gun drawn)
let tapBoxes = [];       // this frame's minions, front first, for isoTileAt: [{ box, tile }]
let pageScale = 1;       // canvas pixels per CSS pixel this frame
let shotsShown = 0;      // shots shown so far, so a miss goes to the left and right in turn

// Draws the whole isometric map as state has it now, in layer order:
// floor, things lying on it (stairs, papers, the facing wedge, pillar
// shadows), the player's light pool, then everything standing up and the
// boss mist back to front, so nearer things paint over farther ones. Walls
// in front of anything in sight are cut away.
// `canvasSize` is { width, height } in pixels and `pageWidth`, the map's
// width on the page. `shared` is { colours, things, fogOf, paintGlyph,
// mistSprite, mistStrength, pulse, keepMoving, showPlain, now, still }
// from mapview.js.
export function drawIsoScene(ctx, canvasSize, shared) {
  look = shared;
  width = canvasSize.width;
  height = canvasSize.height;
  across = isoTilesAcross(canvasSize.pageWidth);
  pageScale = canvasSize.pageWidth ? width / canvasSize.pageWidth : 1;
  tw = width / across;
  th = tw / 2;
  wallH = tw * ISO_WALL_HEIGHT;
  if (moveCamera(look.now, look.still)) look.showPlain();
  const player = look.things.find(thing => thing.kind === 'player');
  if (player.at.row !== state.floor.playerRow || player.at.col !== state.floor.playerCol) look.showPlain();
  [originX, originY] = centre(player.at.row, player.at.col);
  const tiles = tilesInView();
  findFrontWalls(tiles);
  easeWallCuts(tiles, look.now, look.still);
  tiles.forEach(({ row, col }) => {
    if (!isWall(row, col) && look.fogOf(row, col) !== 'hidden') drawFloor(ctx, row, col);
  });
  const standing = [];
  tiles.forEach(({ row, col }) => {
    if (isWall(row, col)) {
      if (wallShown(row, col)) standing.push({ depth: row + col, draw: () => drawWall(ctx, row, col) });
      return;
    }
    if (isPillar(row, col)) {
      standing.push({ depth: row + col, draw: () => drawPillar(ctx, row, col) });
    }
    const door = doorwayAt(row, col);
    if (door) standing.push({ depth: row + col + DOOR_DEPTH, draw: () => drawDoorway(ctx, door) });
    const mist = look.mistStrength(row, col);
    if (mist) standing.push({ depth: row + col + MIST_DEPTH, draw: () => drawMist(ctx, row, col, mist) });
  });
  drawPillarShadows(ctx, tiles);
  const gun = state.settings.gunCombat;
  if (gun) drawReach(ctx, tiles);
  muzzle = null;
  look.things.forEach(thing => {
    if (!onScreen(thing.at.row, thing.at.col)) return;
    if (thing.kind === 'stairs') {
      standing.push({ depth: thing.at.row + thing.at.col + STAIR_BEAM_DEPTH, draw: () => drawStairBeam(ctx, thing.at) });
      return drawStairs(ctx, thing.at);
    }
    if (thing.kind === 'paper' && thing.glyph !== null) return drawPaper(ctx, thing.at);
    if (thing.kind === 'player') drawFacing(ctx, thing.at);
    standing.push({ depth: thing.at.row + thing.at.col + 0.5, draw: () => drawStanding(ctx, thing) });
  });
  dyingForms(look.now).forEach(m => {
    if (!onScreen(m.row, m.col)) return;
    standing.push({ depth: m.row + m.col + 0.5, draw: () => drawForm(ctx, m, m) });
  });
  drawLightPool(ctx);
  standing.sort((a, b) => a.depth - b.depth).forEach(s => s.draw());
  noteTapBoxes();
  if (gun) {
    drawAimNumbers(ctx, tiles);
    drawBrackets(ctx);
    drawLaser(ctx);
    drawShot(ctx);
  }
  drawTarget(ctx);
}

// Every grid tile whose diamond (or a wall standing on it) falls on the
// canvas, back to front.
function tilesInView() {
  const reach = across + 2;
  const midRow = Math.round(camera.row);
  const midCol = Math.round(camera.col);
  const tiles = [];
  for (let row = midRow - reach; row <= midRow + reach; row++) {
    for (let col = midCol - reach; col <= midCol + reach; col++) {
      if (row < 0 || col < 0 || row >= state.floor.GRID_SIZE || col >= state.floor.GRID_SIZE) continue;
      if (onScreen(row, col)) tiles.push({ row, col });
    }
  }
  return tiles.sort((a, b) => (a.row + a.col) - (b.row + b.col) || a.row - b.row);
}

// How far a tile's middle sits from the player's on the isometric map,
// in tile widths: x right, y down. A grid step is half a tile across and
// a quarter down, so whole steps give exact numbers, which render.js's
// edge glow needs: a grid direction lies right on its two-edge cutoff.
export function isoScreenOffset(dr, dc) {
  return { x: (dc - dr) / 2, y: (dc + dr) / 4 };
}

// Where a tile's middle falls on the isometric map, as shares of the
// map's width and height (0..1 is on the map). The camera's tile is at
// the middle across, CAMERA_Y down (the player's tile before the first
// frame). Rows and columns may be fractional while something slides or the
// camera glides. The drawing and render.js's edge glow both place things
// with it, so they agree.
export function isoScreenShare(row, col) {
  const mid = camera || { row: state.floor.playerRow, col: state.floor.playerCol };
  const { x, y } = isoScreenOffset(row - mid.row, col - mid.col);
  return { x: 0.5 + x / across, y: CAMERA_Y + y * ISO_MAP_SHAPE / across };
}

// Moves the camera for this frame. It rests while the player is inside
// ISO_CAMERA_BOX and glides after them (easing out) when they step past
// its edge, just far enough to bring them back to the edge, so walking
// doesn't shift the whole scene every step. A new floor or run, a long
// jump, the locked DEV setting and reduced motion put it straight where
// it should be. Returns true while it glides, so mapview keeps drawing
// frames and shows them without afterglow (a smeared scene is the
// disorientation this is here to stop).
function moveCamera(now, still) {
  const player = { row: state.floor.playerRow, col: state.floor.playerCol };
  const jumped = !cameraPlayer ||
    Math.abs(player.row - cameraPlayer.row) + Math.abs(player.col - cameraPlayer.col) > CAMERA_JUMP;
  cameraPlayer = player;
  if (jumped || !state.settings.isoCameraGlide || cameraFloor !== state.run.floorsEntered) {
    if (jumped || cameraFloor !== state.run.floorsEntered) wallCuts.clear();
    cameraFloor = state.run.floorsEntered;
    camera = cameraGoal = player;
    glide = null;
    return false;
  }
  const goal = keepInBox(cameraGoal, player);
  if (goal.row !== cameraGoal.row || goal.col !== cameraGoal.col) {
    glide = still ? null : { from: camera, start: now };
    cameraGoal = goal;
  }
  if (!glide) {
    camera = cameraGoal;
    return false;
  }
  const done = Math.min(1, (now - glide.start) / ISO_CAMERA_GLIDE_MS);
  const eased = 1 - Math.pow(1 - done, 3);
  camera = {
    row: glide.from.row + (cameraGoal.row - glide.from.row) * eased,
    col: glide.from.col + (cameraGoal.col - glide.from.col) * eased,
  };
  if (done === 1) glide = null;
  return true;
}

// Where the camera should rest so the player stands inside its box: the
// same place if they already do, else moved by how far past the box's
// edge they are, on screen. The screen shift goes back to grid steps by
// undoing isoScreenOffset (x = (dc - dr) / 2, y = (dc + dr) / 4).
function keepInBox(goal, player) {
  const { x, y } = isoScreenOffset(player.row - goal.row, player.col - goal.col);
  const past = (v, edge) => (v > edge ? v - edge : v < -edge ? v + edge : 0);
  const sx = past(x, ISO_CAMERA_BOX.x);
  const sy = past(y, ISO_CAMERA_BOX.y);
  if (!sx && !sy) return goal;
  return { row: goal.row + 2 * sy - sx, col: goal.col + sx + 2 * sy };
}

// How many tile widths fit across the isometric map, given its width on
// the page in CSS pixels: fewer on a narrow phone, so tiles and glyphs
// stay big enough to read. The player's five steps of sight still fit.
function isoTilesAcross(pageWidth) {
  return pageWidth < ISO_NARROW_MAP_WIDTH ? ISO_TILES_ACROSS_NARROW : ISO_TILES_ACROSS;
}

// The middle of a tile on the canvas, in pixels.
function centre(row, col) {
  const { x, y } = isoScreenShare(row, col);
  return [x * width, y * height];
}

// Whether a tile, or a wall standing on it, shows anywhere on the canvas.
function onScreen(row, col) {
  const [x, y] = centre(row, col);
  return x > -tw && x < width + tw && y > -th && y < height + wallH + th;
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

// Sets a glowing line style at strength `a`, with a glow `blur` wide (a
// share of a tile; 0 for a plain line). glowStroke() draws with it.
function strokeGlow(ctx, a, blur) {
  ctx.strokeStyle = glow(a);
  halo = blur > 0 ? haloOf(glow, Math.min(0.8, a), blur) : null;
}

// The halo layers for a glow `blur` wide (a share of a tile), in the
// colour `tint` gives at a strength.
function haloOf(tint, a, blur) {
  return HALO_LAYERS.map(l => ({ colour: tint(a * l.strength), width: blur * tw * l.width }));
}

// Strokes the current path as a phosphor line: the halo strokeGlow set up
// first, wide and faint, then the line itself on top.
function glowStroke(ctx) {
  if (halo) {
    const width = ctx.lineWidth;
    const style = ctx.strokeStyle;
    halo.forEach(l => {
      ctx.lineWidth = width + l.width;
      ctx.strokeStyle = l.colour;
      ctx.stroke();
    });
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
  }
  ctx.stroke();
}

// The four corners of a tile's diamond, shrunk by `inset` (0..0.5).
function diamond(row, col, inset = 0) {
  const [cx, cy] = centre(row, col);
  return diamondAt(cx, cy, tw / 2 * (1 - 2 * inset), th / 2 * (1 - 2 * inset));
}

// A diamond's corners round the middle (cx, cy), `hw` and `hh` pixels
// out across and down.
function diamondAt(cx, cy, hw, hh) {
  return { T: [cx, cy - hh], R: [cx + hw, cy], B: [cx, cy + hh], L: [cx - hw, cy], cx, cy };
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

// One straight phosphor line from a to b, with the glow strokeGlow set up.
function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  glowStroke(ctx);
}

// A point raised `h` pixels straight up the screen.
function up(p, h) {
  return [p[0], p[1] - h];
}

// One floor diamond: its room's floor texture (tileart.js) lying flat, as
// bright as the light on it, and a faint phosphor edge, blue where the
// boss's light lies on it.
function drawFloor(ctx, row, col) {
  const level = floorLevel(row, col);
  const texture = artAt(row, col, tw);
  drawCachedFill(ctx, texture, String(level), diamond(row, col), 0, (c, d) => {
    c.globalAlpha = textureStrength(level);
    // The texture's across runs along the tile's columns, its down along
    // its rows.
    drawArt(c, texture, d.T, [tw / 2, th / 2], [-tw / 2, th / 2]);
  });
  const e = diamond(row, col, 0.02);
  poly(ctx, [e.T, e.R, e.B, e.L]);
  const bossLit = state.floor.bossLitSet.has(key(row, col));
  ctx.strokeStyle = bossLit
    ? 'rgba(' + look.colours.bossLightRgb + ', ' + (0.25 + 0.35 * level) + ')'
    : glow(FLOOR_EDGE[0] + FLOOR_EDGE[1] * level);
  ctx.lineWidth = EDGE_WIDTH * tw * 0.8;
  ctx.stroke();
}

// How strongly a texture shows at a light level (0..1): never quite gone,
// so remembered floor and walls keep their look.
function textureStrength(level) {
  return TEXTURE_STRENGTH[0] + (TEXTURE_STRENGTH[1] - TEXTURE_STRENGTH[0]) * level;
}

// Draws a square texture onto a flat shape on the canvas: its top-left
// corner at `origin`, its top edge running along `across` and its left
// edge along `down` (both in pixels). A floor diamond, a block's top or a
// wall's face is the square bent this way.
function drawArt(ctx, sprite, origin, across, down) {
  const s = sprite.width;
  ctx.save();
  ctx.transform(across[0] / s, across[1] / s, down[0] / s, down[1] / s, origin[0], origin[1]);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}

// Finds the walls and pillars standing between the camera and something
// the player can see now (themselves, an enemy, a lit item, the stairs in
// sight): nearer the camera than it, with a full-height shape covering it
// on screen. Only those are cut away, so the rest of the room keeps its
// height. Pillars count too: one tile in front of the player hid them
// completely. Each thing counts on the tile the rules have it on, not
// where it shows mid-slide: the light moves to the new tile at once, so
// counting the sliding glyph made a wall stop covering anything for a few
// frames, start rising and lower again (it shook).
function findFrontWalls(tiles) {
  frontWalls = new Set();
  const blocks = [];
  tiles.forEach(({ row, col }) => {
    if (isWall(row, col) && wallShown(row, col)) blocks.push({ row, col, box: wallBox(row, col) });
    else if (isPillar(row, col)) blocks.push({ row, col, box: pillarBox(row, col) });
  });
  look.things.forEach(shown => {
    const thing = { ...shown, at: shown.tile };
    if (look.fogOf(thing.at.row, thing.at.col) !== 'lit') return;
    const box = thingBox(thing);
    const depth = thing.at.row + thing.at.col;
    blocks.forEach(b => {
      if (b.row + b.col > depth && overlaps(b.box, box)) frontWalls.add(key(b.row, b.col));
    });
  });
}

// Moves each wall's cut toward its target this frame, over
// MAP_ANIMATION_MS.wallCut, so walls lower and rise instead of snapping:
// down to a stub if it is in front of something in sight, and it stays
// down while the player is within WALL_HOLD_STEPS of it. Without the hold,
// walking along a wall lowered the block ahead and raised the one just
// passed on every step, so the walls beside the player bobbed (Timothy
// saw it as shaking). Straight there under reduced motion. While any is
// moving, frames go on and are shown plain (no afterglow).
function easeWallCuts(tiles, now, still) {
  const step = Math.min(now - lastCutAt, WALL_CUT_MAX_FRAME_MS) / MAP_ANIMATION_MS.wallCut;
  lastCutAt = now;
  const kept = new Map();
  tiles.forEach(({ row, col }) => {
    const k = key(row, col);
    const cut = wallCuts.get(k) || 0;
    const held = cut > 0 && nearPlayer(row, col);
    const target = frontWalls.has(k) || held ? 1 : 0;
    const next = still ? target : target > cut ? Math.min(target, cut + step) : Math.max(target, cut - step);
    if (next > 0) kept.set(k, next);
    if (next !== target) look.showPlain();
  });
  wallCuts = kept;
}

// Whether a tile is within WALL_HOLD_STEPS steps of the player's tile, in
// any direction (diagonals count as one step).
function nearPlayer(row, col) {
  const f = state.floor;
  return Math.max(Math.abs(row - f.playerRow), Math.abs(col - f.playerCol)) <= WALL_HOLD_STEPS;
}

// How far a wall is cut down this frame, eased: 0 (full height) to 1 (a stub).
function cutOf(row, col) {
  const cut = wallCuts.get(key(row, col)) || 0;
  return cut * cut * (3 - 2 * cut);
}

// A thing's outline on the canvas, as [left, top, right, bottom]: a flat
// thing's diamond, a box's block, or an upright glyph down to its tile.
function thingBox(thing) {
  const { row, col } = thing.at;
  const d = diamond(row, col);
  if (lyingFlat(thing)) return [d.L[0], d.T[1], d.R[0], d.B[1]];
  if (isBlock(thing)) {
    const b = diamond(row, col, BOX_INSET);
    return [b.L[0], b.T[1] - tw * BOX_HEIGHT, b.R[0], b.B[1]];
  }
  const form = formOf(thing);
  if (form) return formBox(form.minionKind, d.cx, d.cy, tw);
  const glyphSize = tw * GLYPH_CELL * MAP_GLYPH_SIZES[thing.look.size];
  const [x, y] = glyphPlace(thing);
  return [x - glyphSize * 0.3, y - glyphSize / 2, x + glyphSize * 0.3, d.cy + th * CONTACT_SHADOW];
}

// Whether a tile holds a pillar the player knows about (drawn on the map).
function isPillar(row, col) {
  return state.floor.pillarSet.has(key(row, col)) && look.fogOf(row, col) !== 'hidden';
}

// A pillar's full-height outline on the canvas, as [left, top, right,
// bottom]: thinner than a wall and a little taller.
function pillarBox(row, col) {
  const [cx, cy] = centre(row, col);
  const half = tw * (0.5 - PILLAR_INSET);
  return [cx - half, cy - th / 2 - wallH * PILLAR_HEIGHT, cx + half, cy + th / 2];
}

// A wall's full-height outline on the canvas, as [left, top, right, bottom].
function wallBox(row, col) {
  const [cx, cy] = centre(row, col);
  return [cx - tw * WALL_COVER_WIDTH, cy - th / 2 - wallH, cx + tw * WALL_COVER_WIDTH, cy + th / 2];
}

function overlaps(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

// The stairs and a made-out paper lie flat on the floor; a made-out box
// is a small block; everything else stands up as a glyph.
function lyingFlat(thing) {
  return thing.kind === 'stairs' || (thing.kind === 'paper' && thing.glyph !== null);
}

function isBlock(thing) {
  return thing.kind === 'box' && thing.glyph !== null;
}

// A wall block. Its top edges shared with a neighbouring wall of the same
// height are left out, so a run of wall reads as one ridge, and a face
// with a wall at least as tall in front of it isn't drawn. A wall in front
// of something in sight is cut toward a stub (cutOf), with a dashed
// outline of its full height that shows as it lowers.
function drawWall(ctx, row, col) {
  const cut = cutOf(row, col);
  const joined = (dr, dc) => isWall(row + dr, col + dc) && wallShown(row + dr, col + dc);
  const sameHeight = (dr, dc) => joined(dr, dc) && cutOf(row + dr, col + dc) === cut;
  const coversFace = (dr, dc) => joined(dr, dc) && cut >= cutOf(row + dr, col + dc);
  const ridge = { n: !sameHeight(-1, 0), e: !sameHeight(0, 1), s: !sameHeight(1, 0), w: !sameHeight(0, -1) };
  const height = wallH * (1 - cut * (1 - WALL_STUB));
  drawBlock(ctx, row, col, {
    inset: 0, height, level: wallLevel(row, col),
    southHidden: coversFace(1, 0), eastHidden: coversFace(0, 1), ridge,
    skin: { side: 'wall', top: 'wallTop', full: wallH },
  });
  if (cut > 0) drawGhost(ctx, row, col, ridge, height, cut);
}

// The dashed outline of a cut-away wall's or pillar's full height: its top
// edges (not those shared with the next cut wall) and its outer corners
// from its top (`stub` pixels up) to full height (`full` pixels), so the
// room's shape still reads where it was lowered. As strong as it is cut
// (`cut`). `inset` shrinks the outline for a pillar, like drawBlock's.
function drawGhost(ctx, row, col, ridge, stub, cut, { inset = 0, full = wallH } = {}) {
  const d = diamond(row, col, inset);
  const [T, R, B, L] = [d.T, d.R, d.B, d.L].map(p => up(p, full));
  ctx.save();
  halo = null;
  ctx.setLineDash(GHOST_DASH.map(n => n * tw));
  ctx.lineWidth = EDGE_WIDTH * tw * 0.8;
  ctx.strokeStyle = glow(GHOST_LEVEL * cut);
  if (ridge.n) line(ctx, T, R);
  if (ridge.e) line(ctx, R, B);
  if (ridge.s) line(ctx, B, L);
  if (ridge.w) line(ctx, L, T);
  if (ridge.s && ridge.e) line(ctx, up(d.B, stub), B);
  if (ridge.s && ridge.w) line(ctx, up(d.L, stub), L);
  if (ridge.n && ridge.e) line(ctx, up(d.R, stub), R);
  ctx.restore();
}

// A pillar: a thin block a little taller than the walls. Cut down like a
// wall when it stands in front of something in sight (cutOf).
function drawPillar(ctx, row, col) {
  const cut = cutOf(row, col);
  const full = wallH * PILLAR_HEIGHT;
  const height = full * (1 - cut * (1 - WALL_STUB));
  drawBlock(ctx, row, col, {
    inset: PILLAR_INSET, height, level: Math.max(WALL_MIN_LEVEL, floorLevel(row, col)),
    skin: { side: 'pillarSide', top: 'wallTop', full },
  });
  if (cut > 0) drawGhost(ctx, row, col, { n: true, e: true, s: true, w: true }, height, cut, { inset: PILLAR_INSET, full });
}

// A block standing on a tile: a wall, pillar or box. Its faces are
// opaque, so whatever stands behind it is hidden; they carry its texture
// (tileart.js), the south face darkest, and its edges glow.
// Options: inset (0..0.5), height in pixels, level (0..1), southHidden /
// eastHidden (a face with a wall in front of it), ridge (which top edges
// to draw: n, e, s, w; all by default), skin ({ side, top } TILE_ART parts
// and `full`, the block's full height in pixels: a cut wall shows the
// bottom of its texture, so its bricks stay put as it lowers).
function drawBlock(ctx, row, col, { inset, height, level, southHidden = false, eastHidden = false, ridge, skin }) {
  const d = diamond(row, col, inset);
  const T = up(d.T, height);
  const R = up(d.R, height);
  const B = up(d.B, height);
  const L = up(d.L, height);
  const edges = ridge || { n: true, e: true, s: true, w: true };
  const paint = (c, at) => paintBlockFill(c, row, col, at, height, skin, level, southHidden, eastHidden);
  if (height === skin.full) {
    // A full-height block looks the same wherever it stands, so it is drawn once and copied.
    const id = [skin.side, skin.top, level, southHidden, eastHidden, inset].join(':');
    drawCachedFill(ctx, art(skin.side, row, col, tw), id, d, height, paint);
  } else {
    paint(ctx, d);
  }
  ctx.save();
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

// The filled part of a block standing on diamond `d` (the canvas's own, or
// the same diamond in a cached picture's pixels): its textured faces,
// `height` pixels tall, and its textured top. drawBlock adds the glowing
// edges.
function paintBlockFill(ctx, row, col, d, height, skin, level, southHidden, eastHidden) {
  const [T, R, B, L] = [d.T, d.R, d.B, d.L].map(p => up(p, height));
  const strength = textureStrength(level);
  if (!southHidden) {
    poly(ctx, [d.L, d.B, B, L]);
    ctx.fillStyle = SOUTH_FACE;
    ctx.fill();
    drawFace(ctx, art(skin.side, row, col, tw, SOUTH_SHADE), d.L, d.B, skin.full, height, strength);
  }
  if (!eastHidden) {
    poly(ctx, [d.B, d.R, R, B]);
    ctx.fillStyle = EAST_FACE;
    ctx.fill();
    drawFace(ctx, art(skin.side, row, col, tw, EAST_SHADE), d.B, d.R, skin.full, height, strength);
  }
  poly(ctx, [T, R, B, L]);
  ctx.fillStyle = 'rgb(' + Math.round(14 + 10 * level) + ', ' + Math.round(18 + 12 * level) + ', ' + Math.round(19 + 12 * level) + ')';
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = strength;
  drawArt(ctx, art(skin.top, row, col, tw), T, [R[0] - T[0], R[1] - T[1]], [L[0] - T[0], L[1] - T[1]]);
  ctx.restore();
}

// Draws a fill (a floor diamond's or a block's textures) onto diamond `d`
// from a picture drawn once and kept, painting it the first time:
// `paint(ctx, local)` draws onto `local`, the same diamond in the
// picture's own pixels, and `rise` is how far it reaches above the
// diamond, in pixels. The picture is kept per texture (`texture`, which
// tileart.js renews when the tile size changes) and `id`, what else it
// shows. Copying one flat picture is several times cheaper than bending
// textures onto every diamond and face: a phone redraws every tile each
// frame while the camera glides.
function drawCachedFill(ctx, texture, id, d, rise, paint) {
  const hw = d.R[0] - d.cx;
  const hh = d.B[1] - d.cy;
  if (!fillCache.has(texture)) fillCache.set(texture, new Map());
  const kept = fillCache.get(texture);
  let picture = kept.get(id);
  if (!picture) {
    picture = document.createElement('canvas');
    picture.width = Math.ceil(hw * 2 + FILL_PAD * 2);
    picture.height = Math.ceil(hh * 2 + rise + FILL_PAD * 2);
    paint(picture.getContext('2d'), diamondAt(FILL_PAD + hw, FILL_PAD + rise + hh, hw, hh));
    kept.set(id, picture);
  }
  ctx.drawImage(picture, d.cx - hw - FILL_PAD, d.cy - hh - rise - FILL_PAD);
}

// One upright face of a block, from foot corner `a` to foot corner `b`,
// `height` pixels tall, filled with its (already shaded) texture at
// `strength`. The texture spans the block's full height, `full` pixels; a
// cut wall shows only its bottom part, so its bricks stay put as it
// lowers. Drawn as a slice of the texture, not clipped: a clip per face
// made every frame several times slower.
function drawFace(ctx, sprite, a, b, full, height, strength) {
  const s = sprite.width;
  const shown = Math.min(1, height / full);
  const top = up(a, height);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.transform((b[0] - a[0]) / s, (b[1] - a[1]) / s, 0, height / s, top[0], top[1]);
  ctx.drawImage(sprite, 0, s * (1 - shown), s, s * shown, 0, 0, s, s);
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
    glowStroke(ctx);
  }
  ctx.restore();
}

// The stairs' column of light: soft upright layers rising from the stairs,
// pulsing with them and fading toward the top. Drawn among the standing
// things, so a wall in front hides its foot and the rest rises above it.
function drawStairBeam(ctx, at) {
  const [x, y] = centre(at.row, at.col);
  const strength = 0.82 + 0.18 * look.pulse(MAP_ANIMATION_MS.glow);
  const top = y - wallH * STAIR_BEAM_HEIGHT;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  STAIR_BEAM_LAYERS.forEach(layer => {
    const a = layer.strength * strength;
    const fade = ctx.createLinearGradient(0, y, 0, top);
    fade.addColorStop(0, glow(a));
    fade.addColorStop(STAIR_BEAM_FADE[0], glow(a * STAIR_BEAM_FADE[1]));
    fade.addColorStop(1, glow(0));
    ctx.fillStyle = fade;
    const half = tw * layer.width / 2;
    ctx.beginPath();
    ctx.ellipse(x, y, half, half / 2, 0, 0, Math.PI);
    ctx.lineTo(x - half, top);
    ctx.lineTo(x + half, top);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

// The doorway on a tile, if it is one the player has seen with a wall on
// either side: { row, col, across }, where `across` says the walls beside
// it are west and east (true) or north and south (false). Null otherwise.
function doorwayAt(row, col) {
  if (!state.floor.doorSet.has(key(row, col))) return null;
  if (look.fogOf(row, col) === 'hidden') return null;
  if (isWall(row, col - 1) && isWall(row, col + 1)) return { row, col, across: true };
  if (isWall(row - 1, col) && isWall(row + 1, col)) return { row, col, across: false };
  return null;
}

// A point on the doorway's wall line, from one post (t = 0) to the other
// (t = 1), `h` pixels up.
function doorPoint(door, t, h) {
  const span = 1 - 2 * DOOR_POST;
  const at = door.across
    ? centre(door.row, door.col - 0.5 + DOOR_POST + t * span)
    : centre(door.row - 0.5 + DOOR_POST + t * span, door.col);
  return up(at, h);
}

// One line of the arch, from post top to post top: `base` pixels up at
// the posts, rising `rise` pixels more at the middle.
function archLine(door, base, rise) {
  const points = [];
  for (let i = 0; i <= DOOR_ARCH_STEPS; i++) {
    const t = i / DOOR_ARCH_STEPS;
    points.push(doorPoint(door, t, base + rise * Math.sin(Math.PI * t)));
  }
  return points;
}

function strokeLine(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  glowStroke(ctx);
}

// A doorway: the haze in the opening, two posts as tall as the walls and
// the arch over them. It always stands at full height, even when the
// walls beside it are cut: it is how the player sees a way out of the
// room (Timothy's call after playing it).
function drawDoorway(ctx, door) {
  const level = Math.max(DOOR_MIN_LEVEL, floorLevel(door.row, door.col));
  const rise = wallH * DOOR_ARCH_RISE;
  const thick = wallH * DOOR_ARCH_THICK;
  const outer = archLine(door, wallH, rise);
  const inner = archLine(door, wallH - thick, rise - thick);
  drawDoorHaze(ctx, door, inner, wallH, level);
  drawPost(ctx, door, 0, wallH, level);
  ctx.save();
  poly(ctx, [...outer, ...inner.slice().reverse()]);
  ctx.fillStyle = EAST_FACE;
  ctx.fill();
  ctx.lineWidth = EDGE_WIDTH * tw * 1.2;
  strokeGlow(ctx, Math.min(1, level * 1.1), RIDGE_BLUR * 1.4 * level);
  strokeLine(ctx, outer);
  strokeLine(ctx, inner);
  ctx.restore();
  drawPost(ctx, door, 1, wallH, level);
}

// The faint glow filling a doorway, from its floor up to the arch's inner
// line, brightest at the floor.
function drawDoorHaze(ctx, door, inner, height, level) {
  const [, floorY] = centre(door.row, door.col);
  const fade = ctx.createLinearGradient(0, floorY + th / 2, 0, floorY - height - wallH * DOOR_ARCH_RISE);
  fade.addColorStop(0, glow(DOOR_HAZE[0] * level));
  fade.addColorStop(1, glow(DOOR_HAZE[1]));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  poly(ctx, [doorPoint(door, 0, 0), doorPoint(door, 1, 0), ...inner.slice().reverse()]);
  ctx.fillStyle = fade;
  ctx.fill();
  ctx.restore();
}

// One of a doorway's posts (`end` 0 or 1): a thin plain block, `height`
// pixels tall, with glowing edges. Too thin to need a texture.
function drawPost(ctx, door, end, height, level) {
  const foot = doorPoint(door, end, 0);
  const d = diamondAt(foot[0], foot[1], tw * DOOR_POST, th * DOOR_POST);
  const [T, R, B, L] = [d.T, d.R, d.B, d.L].map(p => up(p, height));
  poly(ctx, [d.L, d.B, B, L]);
  ctx.fillStyle = SOUTH_FACE;
  ctx.fill();
  poly(ctx, [d.B, d.R, R, B]);
  ctx.fillStyle = EAST_FACE;
  ctx.fill();
  ctx.save();
  ctx.lineWidth = EDGE_WIDTH * tw;
  strokeGlow(ctx, Math.min(1, level * 1.05), RIDGE_BLUR * level);
  poly(ctx, [T, R, B, L]);
  glowStroke(ctx);
  line(ctx, d.L, L);
  line(ctx, d.B, B);
  line(ctx, d.R, R);
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
  glowStroke(ctx);
  strokeGlow(ctx, 0.45 * level, 0);
  PAPER_LINES.forEach(v => line(ctx, p([-0.5, v - 0.05]), p([0.5, v - 0.15])));
  ctx.restore();
}

// Whether the paper or box on a tile has already been searched.
function searched(at) {
  const prop = state.floor.props.find(p => p.row === at.row && p.col === at.col);
  return Boolean(prop && prop.searched);
}

// The wedge on the floor pointing where the player faces. Arrow glyphs
// (^ v < >) would point the wrong way on a diamond.
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

// Light added over the floor: a pale pool round the player.
function drawLightPool(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(originX, originY);
  ctx.scale(1, th / tw);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, tw * POOL_RADIUS);
  g.addColorStop(0, glow(0.2));
  g.addColorStop(0.5, glow(0.08));
  g.addColorStop(1, glow(0));
  ctx.fillStyle = g;
  ctx.fillRect(-tw * POOL_RADIUS, -tw * POOL_RADIUS, tw * POOL_RADIUS * 2, tw * POOL_RADIUS * 2);
  ctx.restore();
}

// One tile's boss mist lying on the floor, added as light (`lighter`).
// It is its own layer in the back-to-front order, not part of the floor:
// so it spills over the foot of the wall behind its tile and stays under
// the wall in front, instead of stopping in a hard line at every wall.
function drawMist(ctx, row, col, strength) {
  const w = tw * MIST_WIDTH;
  const h = w * MIST_SQUASH;
  const [cx, cy] = centre(row, col);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.drawImage(look.mistSprite, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// Where a standing glyph's middle goes above its tile, in pixels.
function glyphPlace(thing) {
  const [cx, cy] = centre(thing.at.row, thing.at.col);
  const glyphSize = tw * GLYPH_CELL * MAP_GLYPH_SIZES[thing.look.size];
  return [cx, cy - glyphSize * GLYPH_RISE - (thing.look.lift || 0) * tw];
}

// Something standing on the floor: a box the player has made out, a
// glyph upright on a small contact shadow, or the player as a stick man
// (the facing wedge on the floor says which way they face).
function drawStanding(ctx, thing) {
  const { at } = thing;
  if (isBlock(thing)) {
    const level = floorLevel(at.row, at.col) * (searched(at) ? SEARCHED_LEVEL : 1);
    drawBlock(ctx, at.row, at.col, {
      inset: BOX_INSET, height: tw * BOX_HEIGHT, level: Math.max(WALL_MIN_LEVEL, level),
      skin: { side: 'box', top: 'box', full: tw * BOX_HEIGHT },
    });
    return;
  }
  const form = formOf(thing);
  if (form) return drawForm(ctx, at, form);
  const [cx, cy] = centre(at.row, at.col);
  ctx.save();
  ctx.globalAlpha = thing.look.alpha === undefined ? 1 : thing.look.alpha;
  ctx.beginPath();
  ctx.ellipse(cx, cy, tw / 2 * CONTACT_SHADOW * 2, th / 2 * CONTACT_SHADOW * 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();
  if (thing.kind === 'player') return drawStickMan(ctx, thing.at, cx, cy);
  const [x, y] = glyphPlace(thing);
  look.paintGlyph(ctx, tw * GLYPH_CELL, x, y, thing.glyph, thing.look);
}

// The minion a map thing shows as a text form: a minion with a kind that
// the player has made out. A '?' stays a glyph (everything past three
// tiles is a '?', enemies included), and so does the hunter, which has no kind.
function formOf(thing) {
  if (thing.kind !== 'minion' || thing.glyph === null) return null;
  const m = minionOn(thing.tile);
  return m && m.minionKind ? m : null;
}

// Draws minion `m` as its text form standing at `at` (its tile, or part
// way through a slide), its limbs reaching for the player. While a landed
// shot on it waits for the damage bar, its weak point gets a glowing ring.
// Forms never stop moving, so frames go on (not under reduced motion).
function drawForm(ctx, at, m) {
  const [x, y] = centre(at.row, at.col);
  if (!look.still) look.keepMoving();
  const weak = drawTextForm(ctx, m, x, y, {
    tw, toward: [originX, originY], now: look.now, still: look.still, colour: look.colours.text,
    outline: (path, level) => outline(ctx, path, level),
    aiming: state.battle.aim !== null && state.battle.aim.target === m,
  });
  if (!weak) return;
  outline(ctx, () => {
    ctx.beginPath();
    ctx.arc(weak[0], weak[1], tw * WEAK_RING, 0, Math.PI * 2);
  }, WEAK_RING_LEVEL);
}

// Strokes the path `path()` makes as a phosphor line at strength `level`.
function outline(ctx, path, level) {
  ctx.save();
  ctx.lineWidth = EDGE_WIDTH * tw * 1.5;
  strokeGlow(ctx, level, RIDGE_BLUR);
  path();
  glowStroke(ctx);
  ctx.restore();
}

// The player as a stick man, feet at (fx, fy). It breathes while it
// stands; after MAP_ANIMATION_MS.playerIdle with no move, turn or bump it
// also glances to the side now and then. The feet swing on a step. A dot
// on the face shows which way it looks, hidden when it faces away. With
// the gun on, both hands hold it pointing where it faces (behind the body
// when it faces away), and the muzzle is noted for the laser and shots.
function drawStickMan(ctx, at, fx, fy) {
  const f = state.floor;
  const h = tw * STICK_HEIGHT;
  const [fr, fc] = FACING_VECTORS[f.facing];
  const side = fc - fr;          // which way it faces across the screen
  const away = fr + fc < 0;      // north and west face up the screen
  // How far through a step or bump it is: 0 standing on its tile.
  const off = Math.max(Math.abs(at.row - f.playerRow), Math.abs(at.col - f.playerCol));
  const now = look.now;
  if (off || !stickSeen || stickSeen.row !== f.playerRow || stickSeen.col !== f.playerCol || stickSeen.facing !== f.facing) {
    stickSeen = { row: f.playerRow, col: f.playerCol, facing: f.facing };
    stickActiveAt = now;
  }
  let breath = 0;  // 0..1 through a breath
  let sway = 0;    // -1..1, the hands following it
  let glance = 0;
  if (!look.still) {
    look.keepMoving();
    const b = (now % MAP_ANIMATION_MS.playerBreath) / MAP_ANIMATION_MS.playerBreath * Math.PI * 2;
    breath = 0.5 - 0.5 * Math.cos(b);
    sway = Math.sin(b);
    const idle = now - stickActiveAt - MAP_ANIMATION_MS.playerIdle;
    if (idle > 0) {
      const glances = idle / MAP_ANIMATION_MS.playerGlance;
      const part = glances % 1;
      // A glance takes the first 30% of each cycle, to one side then the other.
      if (part < 0.3) glance = Math.sin(part / 0.3 * Math.PI) * (Math.floor(glances) % 2 ? 1 : -1);
    }
  }
  const lift = breath * STICK_BREATH * h;
  const swing = Math.sin(Math.min(off, 1) * Math.PI);
  const hip = [fx, fy - h * 0.45];
  const neck = [fx, fy - h * 0.78 - lift];
  const headR = h * 0.12;
  const turn = glance * STICK_GLANCE + side * 0.35;
  const head = [neck[0] + turn * headR * 0.5, neck[1] - headR * 1.15];
  const stride = swing * STICK_STRIDE * h;
  const shoulder = [neck[0], neck[1] + (hip[1] - neck[1]) * 0.18];
  const arm = sway * STICK_ARM_SWAY * h + swing * h * 0.1;
  const handY = shoulder[1] + h * 0.3 - lift * 0.4;
  const lineWidth = Math.max(1.5, tw * STICK_LINE);
  const gun = state.settings.gunCombat ? holdGun(shoulder, h, side) : null;
  if (gun) muzzle = gun.muzzle;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeGlow(ctx, 1, STICK_BLUR);
  ctx.strokeStyle = look.colours.text;
  if (gun && away) drawGun(ctx, gun, lineWidth);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(fx - h * 0.1 + stride, fy);
  ctx.lineTo(hip[0], hip[1]);
  ctx.lineTo(fx + h * 0.1 - stride, fy);
  ctx.moveTo(hip[0], hip[1]);
  ctx.lineTo(neck[0], neck[1]);
  if (gun) {
    ctx.moveTo(gun.backHand[0], gun.backHand[1]);
    ctx.lineTo(shoulder[0], shoulder[1]);
    ctx.lineTo(gun.grip[0], gun.grip[1]);
  } else {
    ctx.moveTo(shoulder[0] - h * 0.2 - arm, handY);
    ctx.lineTo(shoulder[0], shoulder[1]);
    ctx.lineTo(shoulder[0] + h * 0.2 + arm, handY);
  }
  ctx.moveTo(head[0] + headR, head[1]);
  ctx.arc(head[0], head[1], headR, 0, Math.PI * 2);
  glowStroke(ctx);
  if (gun && !away) drawGun(ctx, gun, lineWidth);
  if (!away) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(head[0] + turn * headR * 0.45, head[1] + headR * 0.1, lineWidth * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
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
  halo = haloOf(glow, 0.5, RIDGE_BLUR);
  poly(ctx, [d.T, d.R, d.B, d.L]);
  glowStroke(ctx);
  ctx.restore();
}

// Where the stick man's hands and gun go, from its shoulder: the gun hand
// out toward where it faces (on screen), the other hand under it, the gun
// raised while a landed shot waits for the damage bar (state.battle.aim)
// and kicked back for a moment after a shot. `h` is the stick man's
// height and `side` which way it faces across the screen.
// Returns { grip, backHand, butt, muzzle, gripFoot }, in pixels.
function holdGun(shoulder, h, side) {
  const [fr, fc] = FACING_VECTORS[state.floor.facing];
  const screenX = fc - fr;
  const screenY = (fc + fr) / 2;
  const length = Math.hypot(screenX, screenY);
  const dx = screenX / length;
  const dy = screenY / length;
  const raise = state.battle.aim ? h * GUN_RAISE : 0;
  const kick = recoil() * h * GUN_KICK;
  const grip = [shoulder[0] + dx * (h * GUN_REACH - kick), shoulder[1] + h * GUN_DROP + dy * h * 0.12 - raise];
  return {
    grip,
    backHand: [grip[0] - dx * h * 0.02 - side * h * 0.04, grip[1] + h * 0.04],
    butt: [grip[0] - dx * h * 0.06, grip[1] - dy * h * 0.03],
    muzzle: [grip[0] + dx * h * GUN_LENGTH, grip[1] + dy * h * GUN_LENGTH / 2 - h * 0.02],
    gripFoot: [grip[0] - dx * h * 0.02, grip[1] + h * GUN_GRIP],
  };
}

// How far through its kick the gun is, 1 just fired to 0 settled. Still
// under reduced motion.
function recoil() {
  if (!shot || look.still) return 0;
  const age = look.now - shot.start;
  if (age >= MAP_ANIMATION_MS.gunRecoil) return 0;
  look.keepMoving();
  return 1 - age / MAP_ANIMATION_MS.gunRecoil;
}

// The gun as two phosphor lines, butt to muzzle and the grip under it,
// a little thicker than the stick man's lines. Uses the glow already set.
function drawGun(ctx, gun, lineWidth) {
  ctx.lineWidth = lineWidth * GUN_LINE;
  ctx.beginPath();
  ctx.moveTo(gun.butt[0], gun.butt[1]);
  ctx.lineTo(gun.muzzle[0], gun.muzzle[1]);
  ctx.moveTo(gun.grip[0], gun.grip[1]);
  ctx.lineTo(gun.gripFoot[0], gun.gripFoot[1]);
  glowStroke(ctx);
}

// Whether the gun reaches a floor tile: one the player could shoot at
// (sight.js canShoot: in their own light, in range, a clear line), not
// their own tile and not a pillar.
function inReach(row, col) {
  const f = state.floor;
  if (row === f.playerRow && col === f.playerCol) return false;
  if (isWall(row, col) || f.pillarSet.has(key(row, col))) return false;
  return canShoot({ row, col });
}

// The tiles the gun reaches, lit faintly over the floor by the chance a
// shot there lands, so the drop in aim shows as the area fading out.
function drawReach(ctx, tiles) {
  tiles.forEach(({ row, col }) => {
    if (!inReach(row, col)) return;
    const d = diamond(row, col, 0.04);
    poly(ctx, [d.T, d.R, d.B, d.L]);
    ctx.fillStyle = glow(REACH_FILL[0] + REACH_FILL[1] * aimChance({ row, col }));
    ctx.fill();
  });
}

// The aim % on each tile the gun reaches with nothing standing on it
// (a minion, a box, an item: only flat things like papers let it show),
// drawn after the walls so a wall in front doesn't hide it.
function drawAimNumbers(ctx, tiles) {
  const taken = new Set(look.things.filter(thing => !lyingFlat(thing)).map(thing => key(thing.tile.row, thing.tile.col)));
  ctx.save();
  ctx.font = Math.round(tw * AIM_TEXT_SIZE) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  tiles.forEach(({ row, col }) => {
    if (!inReach(row, col) || taken.has(key(row, col))) return;
    const chance = aimChance({ row, col });
    const [x, y] = centre(row, col);
    ctx.fillStyle = glow(AIM_TEXT[0] + AIM_TEXT[1] * chance);
    ctx.fillText(t('gun.aimChance', { chance: Math.round(chance * 100) }), x, y);
  });
  ctx.restore();
}

// The minion (or hunter) on a tile, if any.
function minionOn(tile) {
  return state.floor.minions.find(m => m.row === tile.row && m.col === tile.col);
}

// The gun's target, if it is still on the floor (a fight on the battle
// screen can clear a minion the gun was aimed at).
function liveTarget() {
  const target = state.floor.gunTarget;
  return target && state.floor.minions.includes(target) ? target : null;
}

// The map things that are minions or the hunter, as shown this frame.
function shownMinions() {
  return look.things.filter(thing => thing.kind === 'minion' || thing.kind === 'hunter');
}

// The box a bracket frame (and a tap) takes round a standing thing, as
// [left, top, right, bottom] in pixels: its glyph down to its tile, never
// narrower than BRACKET_HALF a tile each side.
function bracketBox(thing) {
  const box = thingBox(thing);
  const [cx, cy] = centre(thing.at.row, thing.at.col);
  const half = Math.max((box[2] - box[0]) / 2, tw * BRACKET_HALF);
  return [cx - half, box[1] - tw * 0.06, cx + half, cy + th * 0.3];
}

// Notes where each minion stands on screen this frame, front first, so a
// tap on its glyph picks it even though the glyph rises over the tiles
// behind it.
function noteTapBoxes() {
  tapBoxes = shownMinions()
    .sort((a, b) => (b.at.row + b.at.col) - (a.at.row + a.at.col))
    .map(thing => ({ box: bracketBox(thing), tile: thing.tile }));
}

// Corner brackets round everything the gun can shoot right now, faint,
// and round the target, bright and slowly breathing, with its aim % over
// it. A target that can't be shot keeps bright brackets but no aim %.
function drawBrackets(ctx) {
  const target = liveTarget();
  shownMinions().forEach(thing => {
    const m = minionOn(thing.tile);
    if (!m) return;
    const chosen = m === target;
    const shootable = canShoot(m);
    if (!chosen && !shootable) return;
    let breathe = 0;
    if (chosen && !look.still) {
      look.keepMoving();
      breathe = look.pulse(MAP_ANIMATION_MS.target) * tw * BRACKET_PULSE;
    }
    const [l, top, r, bottom] = bracketBox(thing);
    const arm = tw * BRACKET_ARM;
    const level = BRACKET_LEVEL[chosen ? 1 : 0];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = EDGE_WIDTH * tw * (chosen ? 1.6 : 1);
    strokeGlow(ctx, level, RIDGE_BLUR);
    ctx.beginPath();
    [[l - breathe, top - breathe, 1, 1], [r + breathe, top - breathe, -1, 1],
      [l - breathe, bottom + breathe, 1, -1], [r + breathe, bottom + breathe, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.moveTo(x + sx * arm, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * arm);
    });
    glowStroke(ctx);
    if (chosen && shootable) {
      ctx.fillStyle = glow(level);
      ctx.font = Math.round(tw * BRACKET_TEXT_SIZE) + 'px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('gun.aimChance', { chance: Math.round(aimChance(m) * 100) }), (l + r) / 2, top - breathe - th * 0.1);
    }
    ctx.restore();
  });
}

// The dashed laser from the gun's muzzle to the target, while it can be
// shot; brighter while a landed shot waits for the damage bar.
function drawLaser(ctx) {
  const target = liveTarget();
  if (!target || !muzzle || !canShoot(target)) return;
  const thing = shownMinions().find(th => th.tile.row === target.row && th.tile.col === target.col);
  if (!thing) return;
  ctx.save();
  ctx.setLineDash(LASER_DASH.map(n => n * tw));
  ctx.lineWidth = EDGE_WIDTH * tw * 1.2;
  strokeGlow(ctx, LASER_LEVEL[state.battle.aim ? 1 : 0], 0);
  line(ctx, muzzle, glyphPlace(thing));
  ctx.restore();
}

// Plays a shot on the map (mapview.js shotOnMap calls it from main.js
// drawEvents): a flash from the gun to `target`, or past it when it
// `missed`, with MISS floating up over it. A miss goes to one side, then
// the other, so two misses in a row don't look the same (never
// Math.random: the seeded tests own it).
export function showShot(target, missed) {
  const at = { row: target.row, col: target.col };
  let to = at;
  if (missed) {
    const dr = Math.sign(target.row - state.floor.playerRow);
    const dc = Math.sign(target.col - state.floor.playerCol);
    const side = shotsShown % 2 ? MISS_SIDE : -MISS_SIDE;
    to = { row: at.row + dr * MISS_PAST + (dc ? side : 0), col: at.col + dc * MISS_PAST + (dr ? side : 0) };
  }
  shotsShown++;
  shot = { start: performance.now(), at, to, missed };
}

// The last shot while it plays: the flash and the ring where it lands
// (not under reduced motion), then MISS over a missed minion, fading as
// it floats up (held still under reduced motion). Frames are shown plain
// while it plays: the afterglow left a trail of MISSes under the rising
// one, which read as the word shaking.
function drawShot(ctx) {
  if (!shot) return;
  const age = look.now - shot.start;
  if (!look.still && age < Math.max(MAP_ANIMATION_MS.gunShot, shot.missed ? MAP_ANIMATION_MS.gunMiss : 0)) look.showPlain();
  ctx.save();
  if (!look.still && muzzle && age < MAP_ANIMATION_MS.gunShot) {
    look.keepMoving();
    const done = age / MAP_ANIMATION_MS.gunShot;
    const end = up(centre(shot.to.row, shot.to.col), tw * SHOT_RISE);
    ctx.lineCap = 'round';
    ctx.lineWidth = EDGE_WIDTH * tw * 2;
    strokeGlow(ctx, 1 - done, RIDGE_BLUR);
    line(ctx, muzzle, end);
    ctx.lineWidth = EDGE_WIDTH * tw * 1.5;
    ctx.beginPath();
    ctx.arc(end[0], end[1], tw * (SHOT_RING[0] + SHOT_RING[1] * done), 0, Math.PI * 2);
    glowStroke(ctx);
  }
  if (shot.missed && age < MAP_ANIMATION_MS.gunMiss) {
    const done = age / MAP_ANIMATION_MS.gunMiss;
    if (!look.still) look.keepMoving();
    const [x, y] = centre(shot.at.row, shot.at.col);
    ctx.fillStyle = glow(look.still ? 1 : 1 - done);
    ctx.font = Math.round(tw * MISS_TEXT_SIZE) + 'px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('gun.miss'), x, y - tw * (MISS_RISE[0] + (look.still ? 0 : MISS_RISE[1] * done)));
  }
  ctx.restore();
}

// The tile under a tap on the map, at (px, py) CSS pixels from the map's
// top-left, or null before the first frame. A tap on a minion's glyph
// picks its tile (its glyph rises over the tiles behind it); anywhere else
// undoes isoScreenShare: across = (dc - dr) / 2 and down = (dc + dr) / 4
// tile widths from the camera's tile, and each tile's diamond is a whole
// row and column, so rounding each gives the tile.
export function isoTileAt(px, py) {
  if (!camera || !width) return null;
  const x = px * pageScale;
  const y = py * pageScale;
  const hit = tapBoxes.find(({ box }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]);
  if (hit) return { row: hit.tile.row, col: hit.tile.col };
  const sx = (x / width - 0.5) * across;
  const sy = (y / height - CAMERA_Y) * across / ISO_MAP_SHAPE;
  return { row: Math.round(camera.row + 2 * sy - sx), col: Math.round(camera.col + sx + 2 * sy) };
}
