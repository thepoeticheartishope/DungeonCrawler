// The things on the room view's floor, drawn as pixel art (room view plan
// steps B and E, moved out of roomview.js): papers, grates, the stairs and
// their column of light, boxes, energy cells, the reflective desk, the
// charger, relays, the safe room's shutters, switch and lamp, a plan's hall
// lamps, the chest, the coin, keys, the boss's mist, a mistake's sound, and
// a fixed plan's furniture by piece. roomview.js picks what to draw and
// where (FLAT lies on the floor, STAND stands and is sorted with the stick
// men) and hands over the canvases it draws into each frame
// (drawThingsWith). Reads state and never changes it.

import { state, key, parseKey } from './state.js';
import { liveSpotAt } from './spots.js';
import { ROOM_VIEW, LAMP_LIGHT, MAP_ANIMATION_MS, SAFE_ROOM, ENEMY_LIGHT } from './config.js';
import {
  searched, isWall, grain, DESK_GLOW, DESK_GLOW_RADIUS, DRUM_BREATH, DRUM_BREATH_REACH, GRATE_RATTLE_SWAYS,
  SOUND_INSET, SOUND_LEVEL, STAIR_BEAM_FADE, STAIR_BEAM_LAYERS,
} from './mapshared.js';

const T = ROOM_VIEW.tilePx;
// A plan's lamps (lamps.js, presence cues plan step B): their pool is warm,
// `floor` bright under the lamp and fading to `edge` of that at its rim,
// steady (no flicker: Timothy's motion rule). Each hangs like the safe
// room's lamp (LAMP), its bulb `bulb` bright.
export const HALL_LAMP = { floor: 0.7, edge: 0.3, bulb: 0.4 };
// The warm light of a window's pool and of the lamps, as an rgb list
// (roomview.js draws the windows' pools in it too).
export const POOL = { level: 0.85, rgb: '255, 196, 132', bars: 'rgb(150, 130, 120)', glass: 0.8 };
// The things' colours, in the picture's pixels.
const CRATE = { top: '#86663f', front: '#6b4f36', plank: '#4a3524', post: '#55402b', inside: '#1c140e' };
const CELL = { body: '#3b4650', light: '#4d5a66', shade: '#2c353d', band: '#262d34', lid: '#5a6874', dead: '#1a1e22' };
const SHEET = { fresh: '#d2cbbb', read: '#a8a294', ink: '#8a8476' };
const GRATE = { frame: '#2a2e32', edge: '#5d656c', bar: '#50575d', seal: '#8b939a', sway: 2 }; // sway: how far it shudders, in picture pixels
const DESK = { top: '#6e4d33', front: '#523a27', frame: '#4a3a30', glass: '#8fa3ad', shine: '#c9d6dc', dull: '#3a4448' };
const CHARGER_ART = { body: '#3e4650', edge: '#56606b', shade: '#2b3138', window: '#1c2126', lit: '#e9c48a', cable: '#22272c', plug: '#6a737c' };
const RELAY = { body: '#4a5058', seam: '#33383e', dead: '#2a2e32', leg: '#2e3236' };
// The safe room (saferoom.js): its shutters' slats, posts and lintel box,
// the pull switch, and the lamp's warm light over the room.
const SHUTTER = { slat: '#5b6068', shade: '#454950', bar: '#8a9098', post: '#2f3338', box: '#3a3e44', rise: 1.5, slat_px: 2 };
const SWITCH_ART = { plate: '#4a4e55', cord: '#2a2d31', warm: '#e9c48a', dim: '#5a5650' };
// The lamp hangs from the ceiling over the room's middle: its shade
// `hang` tiles above the floor (the walls stand 2), its cord up out of
// sight to `ceiling`, a faint cone of light `beam` strong falling from it
// to the pool on the floor. reach: the pool's radius, a share of the
// room's longer side.
const LAMP = { level: 0.55, reach: 0.65, bulb: 0.45, hang: 1.3, ceiling: 2.6, beam: 0.16, shade: '#34383e', rim: '#5a6068' };
const CHEST = { lid: '#5a3d2c', lidLight: '#6e4b36', body: '#4a3224', band: '#2e211a', lock: '#b49a6a' };
const COIN = { face: '#d8b45a', shine: '#f3dc8e', rgb: '216, 180, 90' };
const KEY = { metal: '#dfe8ea', glow: 0.7 };   // glow: its light at the brightest of its pulse, as a share of the pulse's strength
const STAIRS = ['#3a3540', '#25212b', '#16131a', '#0a090c']; // each step down darker
const STAIR_EDGE = '#5a5464';
const BEAM_RISE = 2.6;          // the stairs' column of light, in tiles above the floor
const MIST_GLOW = 0.22;         // the boss's mist at full strength over a tile
const BREATH_GLOW = 2;          // a cell's breath is this many times its shoulder view strength (smaller here)

let bctx = null;   // the picture being drawn into (roomview's, or its mask for what stands in front)
let gctx = null;   // the light added after the lighting
let look = null;   // what mapview.js hands roomview each frame

// roomview.js hands over the picture and glow canvases and this frame's
// look before anything here draws.
export function drawThingsWith(picture, glowCtx, shared) {
  bctx = picture;
  gctx = glowCtx;
  look = shared;
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
export function drawBeam(fx, fy) {
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

// The charger (charger.js): a tall grey cabinet with a cable down to the
// floor and a narrow cell window. While energy isn't full the window is lit
// and it breathes the kind voice's warm light, like the desk; at full it
// is dark (it has nothing to give).
function drawCharger(thing, x, y, glows) {
  const lit = thing.look.deskGlow !== null && thing.look.deskGlow !== undefined;
  bctx.fillStyle = CHARGER_ART.cable;
  bctx.fillRect(x + 13, y + 6, 1, 8);
  bctx.fillRect(x + 13, y + 14, 2, 1);
  bctx.fillStyle = CHARGER_ART.body;
  bctx.fillRect(x + 3, y - 4, 10, 19);
  bctx.fillStyle = CHARGER_ART.edge;
  bctx.fillRect(x + 3, y - 4, 10, 1);
  bctx.fillRect(x + 3, y - 4, 1, 19);
  bctx.fillStyle = CHARGER_ART.shade;
  bctx.fillRect(x + 12, y - 3, 1, 18);
  bctx.fillRect(x + 4, y + 9, 8, 1);
  bctx.fillStyle = CHARGER_ART.plug;
  bctx.fillRect(x + 12, y + 5, 2, 2);
  bctx.fillStyle = lit ? CHARGER_ART.lit : CHARGER_ART.window;
  bctx.fillRect(x + 7, y - 1, 2, 8);
  bctx.fillStyle = CHARGER_ART.shade;
  bctx.fillRect(x + 6, y + 11, 4, 1);
  bctx.fillRect(x + 6, y + 13, 4, 1);
  if (!lit) return;
  glows.push(() => {
    look.keepMoving();
    bctx.fillStyle = CHARGER_ART.lit;
    bctx.fillRect(x + 7, y - 1, 2, 8);
    const a = (DESK_GLOW[0] + (DESK_GLOW[1] - DESK_GLOW[0]) * thing.look.deskGlow) * (thing.look.alpha === undefined ? 1 : thing.look.alpha);
    halo(x + T / 2, y + 3, DESK_GLOW_RADIUS * T * 0.8, look.colours.kindRgb, a);
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

// When each shutter last went up or down (saferoom.js), by tile, so its
// slats can drop or roll up over SAFE_ROOM.dropMs: { down, at, floor }.
const shutterMoves = new Map();

// How far a shutter's slats are down, 0 (rolled up in the lintel) to 1
// (shut), in whole slats of `slats`: they drop one at a time, slowly, and
// go back the same way. Reduced motion: just up or down.
function shutterDrop(tile, down, slats) {
  const k = key(tile.row, tile.col);
  let move = shutterMoves.get(k);
  if (!move || move.floor !== state.run.floorsEntered) {
    move = { down, at: -Infinity, floor: state.run.floorsEntered };
    shutterMoves.set(k, move);
  }
  if (move.down !== down) {
    move.down = down;
    move.at = look.now;
  }
  const share = look.still ? 1 : Math.min(1, (look.now - move.at) / SAFE_ROOM.dropMs);
  if (share < 1) look.keepMoving();
  const drop = down ? share : 1 - share;
  return Math.round(drop * slats) / slats;
}

// A shutter on one of the safe room's doorways: its slats hang from a box
// over the doorway between two dark posts, rolled up into the box while it
// is open. A doorway in a side wall shows it edge on, a narrow strip. While
// the hunter lifts it, its cold blue hand is on the slats.
function drawShutter(thing, x, y, glows) {
  const { row, col } = thing.tile;
  const across = isWall(row, col - 1) && isWall(row, col + 1);
  const x0 = across ? x : x + T / 2 - 2, w = across ? T : 4;
  const foot = y + T - 1;
  const top = foot - Math.round(SHUTTER.rise * T);
  const slats = Math.floor((foot - top) / SHUTTER.slat_px);
  const f = state.floor;
  const down = !!f.safeRoom && f.safeRoom.shut;
  const bottom = top + Math.round(shutterDrop(thing.tile, down, slats) * slats) * SHUTTER.slat_px;
  for (let sy = top; sy < bottom; sy += SHUTTER.slat_px) {
    bctx.fillStyle = SHUTTER.slat;
    bctx.fillRect(x0, sy, w, 1);
    bctx.fillStyle = SHUTTER.shade;
    bctx.fillRect(x0, sy + 1, w, 1);
  }
  if (bottom > top) {
    bctx.fillStyle = SHUTTER.bar;
    bctx.fillRect(x0, bottom - 1, w, 1);
  }
  bctx.fillStyle = SHUTTER.post;
  if (across) {
    bctx.fillRect(x0, top, 1, foot - top + 1);
    bctx.fillRect(x0 + w - 1, top, 1, foot - top + 1);
  }
  bctx.fillStyle = SHUTTER.box;
  bctx.fillRect(x0 - (across ? 1 : 0), top - 3, w + (across ? 2 : 0), 3);
  const hunter = f.hunter;
  if (!hunter || !hunter.lifting || Math.max(Math.abs(hunter.row - row), Math.abs(hunter.col - col)) > 1) return;
  const hx = x0 + Math.floor(w / 2) - 1, hy = bottom - 3;
  const hand = () => {
    bctx.fillRect(hx, hy, 3, 2);
    bctx.fillRect(hx, hy - 2, 1, 2);
    bctx.fillRect(hx + 2, hy - 2, 1, 2);
  };
  bctx.fillStyle = 'rgb(' + ENEMY_LIGHT.core + ')';
  hand();
  glows.push(() => {
    bctx.fillStyle = 'rgb(' + ENEMY_LIGHT.halo + ')';
    hand();
  });
}

// The safe room's pull switch: a plate on the wall with a cord and a
// handle, warm while the shutter is up (pull it to be safe), dim once it
// is down.
function drawSwitch(thing, x, y, glows) {
  const f = state.floor;
  const up = !f.safeRoom || !f.safeRoom.shut;
  bctx.fillStyle = SWITCH_ART.plate;
  bctx.fillRect(x + 6, y - 8, 4, 6);
  bctx.fillStyle = SWITCH_ART.cord;
  bctx.fillRect(x + 8, y - 2, 1, up ? 8 : 11);
  const hy = up ? y + 6 : y + 9;
  bctx.fillStyle = up ? SWITCH_ART.warm : SWITCH_ART.dim;
  bctx.fillRect(x + 7, hy, 3, 2);
  if (!up) return;
  glows.push(() => {
    bctx.fillStyle = SWITCH_ART.warm;
    bctx.fillRect(x + 7, hy, 3, 2);
    halo(x + 8.5, hy + 1, T * 0.45, look.colours.kindRgb, DESK_GLOW[0]);
  });
}

// Where the safe room's lamp hangs, in picture pixels: over the middle of
// the room's floor (cx, cy), and how big the room is (`size`, tiles).
function lampSpot(ox, oy) {
  const cells = [...state.floor.safeRoom.cells].map(parseKey);
  const r0 = Math.min(...cells.map(p => p.row)), r1 = Math.max(...cells.map(p => p.row));
  const c0 = Math.min(...cells.map(p => p.col)), c1 = Math.max(...cells.map(p => p.col));
  return { cx: Math.round(((c0 + c1 + 1) / 2) * T - ox), cy: Math.round(((r0 + r1 + 1) / 2) * T - oy), size: Math.max(r1 - r0 + 1, c1 - c0 + 1) };
}

// The lamp's cord and shade, high over the room's middle, drawn over
// everything below it and lit by the room like the rest. It hangs there
// dark once the lamp is out.
export function drawLampShade(ox, oy) {
  const { cx, cy } = lampSpot(ox, oy);
  shadeAt(cx, cy);
}

// A lamp's cord and shade hanging over the floor point (cx, cy), in the
// picture's pixels: the safe room's lamp and a plan's lamps alike.
export function shadeAt(cx, cy) {
  const sy = Math.round(cy - LAMP.hang * T);
  const top = Math.round(cy - LAMP.ceiling * T);
  bctx.fillStyle = SWITCH_ART.cord;
  bctx.fillRect(cx, top, 1, sy - top - 2);
  bctx.fillStyle = LAMP.shade;
  bctx.fillRect(cx - 1, sy - 2, 3, 1);
  bctx.fillRect(cx - 2, sy - 1, 5, 1);
  bctx.fillRect(cx - 3, sy, 7, 1);
  bctx.fillStyle = LAMP.rim;
  bctx.fillRect(cx - 3, sy + 1, 7, 1);
}

// The safe room's lamp while it is on and the player is in the room: a
// warm pool of light on the floor under it, added to the light, and over
// the picture the bulb under its shade and a faint cone of light falling
// from it to the floor.
export function drawLamp(ox, oy, glows) {
  const { cx, cy, size } = lampSpot(ox, oy);
  const r = size * T * LAMP.reach;
  const g = gctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(' + POOL.rgb + ', ' + LAMP.level + ')');
  g.addColorStop(1, 'rgba(' + POOL.rgb + ', 0)');
  gctx.fillStyle = g;
  gctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  glows.push(() => bulbAt(cx, cy, LAMP.bulb));
}

// A lit lamp's bulb under its shade over the floor point (cx, cy), `bulb`
// bright, and a faint cone of light falling from it to the floor. Drawn
// over the lit picture, so it shows in the dark.
export function bulbAt(cx, cy, bulb) {
  const sy = Math.round(cy - LAMP.hang * T) + 2;
  const spread = T * 1.2;
  const cone = bctx.createLinearGradient(0, sy, 0, cy);
  cone.addColorStop(0, 'rgba(' + POOL.rgb + ', ' + LAMP.beam + ')');
  cone.addColorStop(1, 'rgba(' + POOL.rgb + ', 0)');
  bctx.fillStyle = cone;
  bctx.beginPath();
  bctx.moveTo(cx - 3, sy);
  bctx.lineTo(cx + 4, sy);
  bctx.lineTo(cx + spread, cy);
  bctx.lineTo(cx - spread, cy);
  bctx.closePath();
  bctx.fill();
  bctx.fillStyle = SWITCH_ART.warm;
  bctx.fillRect(cx - 1, sy, 3, 1);
  halo(cx + 0.5, sy, T * 0.5, POOL.rgb, bulb);
}

// Where a plan's lamp `l` hangs, as [cx, cy]: over its tile's middle, in
// the picture's pixels with the camera at (ox, oy).
export function hallLampSpot(l, ox, oy) {
  return [Math.round((l.col + 0.5) * T - ox), Math.round((l.row + 0.5) * T - oy)];
}

// How bright a plan's lamps light the tile (row, col): HALL_LAMP.floor
// under a lamp, down to HALL_LAMP.edge of that at LAMP_LIGHT.radius, the
// brightest lamp's.
export function lampLevel(row, col) {
  const near = Math.min(...state.floor.lamps.map(l => Math.hypot(row - l.row, col - l.col)));
  const share = 1 - (1 - HALL_LAMP.edge) * Math.min(1, near / LAMP_LIGHT.radius);
  return HALL_LAMP.floor * share;
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
export function drawMist(c0, r0, c1, r1, ox, oy) {
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
export function drawSounds(ox, oy) {
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

export const FLAT = { paper: drawPaper, vent: drawGrate, stairs: drawStairs };
export const STAND = { box: drawBox, furniture: drawFurniture, cell: drawCell, desk: drawDesk, charger: drawCharger, relay: drawRelay, chest: drawChest, coin: drawCoin, key: drawKey, shutter: drawShutter, switch: drawSwitch };

// ---- furniture (step E) ----
// A fixed plan's furniture (plans.js `furniture`), one tile at a time:
// the map thing's `at` is the prop itself, with its `piece` and its `part`
// ('single', or 'left' / 'mid' / 'right' along a wider one), so a wide
// piece joins up across its tiles. Each stands on its tile like a box.

const WOODWORK = { top: '#7a5638', topLight: '#8c6644', front: '#5a3f29', dark: '#3f2c1e', leg: '#2f2016' };
const BOOKS = ['#6b3b34', '#3f4f5f', '#5c5a3a', '#4c3a52', '#7a6a4e', '#2f4a42', '#5e3a2c'];
const METAL = { top: '#7c8186', front: '#4e5358', seam: '#3a3e42', tap: '#a9b0b5' };
const PORCELAIN = { bowl: '#c9ccc8', shade: '#9fa29e', pipe: '#6a6e6c', drop: '#8fa7b3', wet: '#2b3439' };
const STALL = { door: '#5b6b73', edge: '#6f8089', gap: '#1c2124' };
const SOFA = { back: '#5a3b3e', seat: '#6b474a', arm: '#4a3033' };
const EASEL = { leg: '#5a3f29', board: '#b9ab8e', frame: '#8a7a5e' };

// Draws furniture prop `thing` on its tile at (x, y), with its tell over
// it when it is a live room spot (room spots plan, spots.js).
function drawFurniture(thing, x, y) {
  const { piece, part } = thing.at;
  const left = part === 'single' || part === 'left';
  const right = part === 'single' || part === 'right';
  if (thing.at.fallen) {
    drawFallenShelf(x, y, left, right, thing.at);
    return;
  }
  (PIECES[piece] || PIECES.table)(x, y, left, right, thing.at);
  const here = s => s && s.row === thing.at.row && s.col === thing.at.col;
  const hide = liveSpotAt(thing.at.row, thing.at.col, 'hide');
  if (here(hide) && HIDE_TELLS[piece]) HIDE_TELLS[piece](x, y);
  const takedown = liveSpotAt(thing.at.row, thing.at.col, 'takedown');
  if (here(takedown) && piece === 'shelf') drawShelfLeaning(x, y);
  const lure = liveSpotAt(thing.at.row, thing.at.col, 'lure');
  if (here(lure) && piece === 'sink') drawSinkDripping(x, y);
}

// A live lure's tell (room spots plan step D): the sink's tap drips, a
// bead under it and a wet patch on the floor below. Still, not animated
// (slow and quiet on the eye, Timothy).
function drawSinkDripping(x, y) {
  bctx.fillStyle = PORCELAIN.drop;
  bctx.fillRect(x + 8, y + 4, 1, 2);
  bctx.fillStyle = PORCELAIN.wet;
  bctx.fillRect(x + 3, y + 15, 9, 1);
  bctx.fillRect(x + 5, y + 14, 5, 1);
}

// A live takedown's tell (room spots plan step C): the bookcase leans a
// little off the wall, its top showing a dark gap, and books slide off its
// shelves.
function drawShelfLeaning(x, y) {
  const top = y - 12;
  bctx.fillStyle = CRATE.inside;
  bctx.fillRect(x, top - 2, T, 2);
  bctx.fillStyle = BOOKS[0];
  bctx.fillRect(x + 4, top + 8, 5, 2);
  bctx.fillStyle = BOOKS[2];
  bctx.fillRect(x + 10, top + 14, 2, 5);
  bctx.fillRect(x + 11, top + 13, 2, 1);
}

// A bookcase that was pushed over (spots.js topple), lying on its face
// across the tile it fell onto, books spilled round it. `at.fallen` is
// the way it fell (1 toward the camera, -1 away).
function drawFallenShelf(x, y, left, right, at) {
  const x0 = x + (left ? 1 : 0), x1 = x + (right ? T - 1 : T);
  bctx.fillStyle = WOODWORK.dark;
  bctx.fillRect(x0, y + 4, x1 - x0, 9);
  bctx.fillStyle = WOODWORK.front;
  bctx.fillRect(x0, y + 4, x1 - x0, 1);
  bctx.fillRect(x0, y + 8, x1 - x0, 1);
  bctx.fillStyle = WOODWORK.leg;
  bctx.fillRect(x0, y + 12, x1 - x0, 1);
  if (left) bctx.fillRect(x0, y + 4, 1, 9);
  if (right) bctx.fillRect(x1 - 1, y + 4, 1, 9);
  // Spilled books, the same every time for the same tile.
  for (let k = 0; k < 3; k++) {
    const bx = x + 1 + Math.floor(grain(at.row, at.col, k + 200) * 12);
    const by = y + (grain(at.row, at.col, k + 210) > 0.5 ? 13 : 1) + Math.floor(grain(at.row, at.col, k + 220) * 2);
    bctx.fillStyle = BOOKS[Math.floor(grain(at.row, at.col, k + 230) * BOOKS.length)];
    bctx.fillRect(bx, by, 3, 2);
  }
}

// A live hide spot's tell (Timothy 2026-10-28: a live spot can be told
// from an empty one, so the player can plan): a little something left
// open, drawn over the piece on the spot's own tile.
const HIDE_TELLS = {
  // The stall's door left ajar: the dark of the inside down its edge.
  stall(x, y) {
    bctx.fillStyle = STALL.gap;
    bctx.fillRect(x + 12, y - 9, 3, 22);
    bctx.fillStyle = STALL.edge;
    bctx.fillRect(x + 11, y - 9, 1, 22);
  },
  // The teacher's desk's knee-hole open and dark, its chair pushed away.
  teacher(x, y) {
    bctx.fillStyle = CRATE.inside;
    bctx.fillRect(x + 5, y + 10, 8, 6);
  },
  // The sofa pulled out from the wall: a dark gap behind its back, a
  // cushion on the floor.
  sofa(x, y) {
    bctx.fillStyle = CRATE.inside;
    bctx.fillRect(x + 1, y - 1, T - 2, 2);
    bctx.fillStyle = SOFA.seat;
    bctx.fillRect(x + 4, y + 14, 8, 2);
  },
  // A cloth over the table, hanging to the floor.
  table(x, y) {
    bctx.fillStyle = SHEET.read;
    bctx.fillRect(x, y + 3, T, 13);
    bctx.fillStyle = SHEET.fresh;
    bctx.fillRect(x, y + 3, T, 1);
    bctx.fillStyle = SHEET.ink;
    bctx.fillRect(x + 5, y + 6, 1, 10);
    bctx.fillRect(x + 11, y + 7, 1, 9);
  },
};

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
