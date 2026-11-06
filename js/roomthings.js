// The things on the room view's floor, drawn as pixel art (room view plan
// steps B and E, moved out of roomview.js): papers, grates, the stairs and
// their column of light, boxes, energy cells, the reflective desk, the
// charger, relays, the safe room's shutters, switch and lamp, a plan's hall
// lamps, the chest, the coin, keys, the boss's mist, a mistake's sound, and
// a fixed plan's furniture by piece (its PNG from sprites.js if it has one). roomview.js picks what to draw and
// where (STAND stands and is sorted with the stick men) and hands over the canvases it draws into each frame
// (drawThingsWith). Reads state and never changes it.

import { state, key, parseKey } from './state.js';

import { crewLook, crewHeadLook } from './roles.js';
import { figurePose, turnFigure, projectFigure, phiToward } from './figure3d.js';
import { emberGlow } from './playerform.js';
import {
  ROOM_VIEW, SAFE_ROOM, PLAYER_EMBER, FIGURE3D, CREW_LOOK, SHIP_ROLES, FURNITURE_SPRITES,
} from './config.js';
import { spriteFor } from './sprites.js';
import { isWall, grain } from './mapshared.js';

const T = ROOM_VIEW.tilePx;
// The warm light of a window's pool and of the lamp, as an rgb list
// (roomview.js draws the windows' pools in it too).
const POOL = { level: 0.85, rgb: '255, 196, 132', bars: 'rgb(150, 130, 120)', glass: 0.8 };
// The things' colours, in the picture's pixels.
const SHEET = { fresh: '#d2cbbb', read: '#a8a294', ink: '#8a8476' };
// The ship's stations (ship plan step B): grey metal like the hull, a dark
// screen, its light cool once a role is trained or warm while it waits,
// and the crew's plain white figure, a touch dimmer than the player's (grey
// when sitting out a trip, crew roles plan step C). warmRgb / coolRgb: the
// warm and cool lights as rgb lists, for a crew member's ember head.
const STATION_ART = {
  body: '#46505b', edge: '#5e6874', shade: '#323941', screen: '#141a1f', cool: '#8fd8e4', warm: '#e9c48a', crew: '#b9c4c8', crewOff: '#5c666b',
  warmRgb: '233, 196, 138', coolRgb: '143, 216, 228',
};
// The stick men (the player's in roomview.js, the crew's here): lines one
// picture pixel wide, and a head this share of the figure's height across
// its radius.
export const STICK_LINE = 1;
const HEAD_SHARE = 0.12;
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

// ---- the ship's stations (ship plan step B, stations.js) ----
// The training console in Command: a low desk with a screen tilted up, its
// screen lit cool once its role is trained, warm while there is still
// something to learn.
function drawConsole(thing, x, y, glows) {
  bctx.fillStyle = STATION_ART.body;
  bctx.fillRect(x + 2, y + 6, 12, 9);
  bctx.fillStyle = STATION_ART.edge;
  bctx.fillRect(x + 2, y + 6, 12, 1);
  bctx.fillStyle = STATION_ART.shade;
  bctx.fillRect(x + 3, y + 12, 10, 1);
  bctx.fillStyle = STATION_ART.body;
  bctx.fillRect(x + 3, y - 2, 10, 8);
  bctx.fillStyle = STATION_ART.screen;
  bctx.fillRect(x + 4, y - 1, 8, 5);
  const learned = state.run.trained.includes(thing.at.role);
  glows.push(() => {
    bctx.fillStyle = learned ? STATION_ART.cool : STATION_ART.warm;
    bctx.fillRect(x + 5, y, 6, 1);
    bctx.fillRect(x + 5, y + 2, 4, 1);
  });
}

// A crew member's board (the Engineer's power board): a wide cabinet
// against the wall with a row of small lights, lit while the role is
// trained and waiting to be taught.
function drawPowerBoard(thing, x, y, glows) {
  bctx.fillStyle = STATION_ART.body;
  bctx.fillRect(x + 1, y - 5, 14, 20);
  bctx.fillStyle = STATION_ART.edge;
  bctx.fillRect(x + 1, y - 5, 14, 1);
  bctx.fillRect(x + 1, y - 5, 1, 20);
  bctx.fillStyle = STATION_ART.shade;
  bctx.fillRect(x + 14, y - 4, 1, 19);
  bctx.fillRect(x + 3, y + 8, 10, 1);
  bctx.fillStyle = STATION_ART.screen;
  for (let i = 0; i < 4; i++) bctx.fillRect(x + 3 + i * 3, y - 2, 2, 2);
  bctx.fillRect(x + 3, y + 2, 10, 3);
  if (!state.run.trained.includes(thing.at.role)) return;
  glows.push(() => {
    bctx.fillStyle = STATION_ART.cool;
    for (let i = 0; i < 4; i++) bctx.fillRect(x + 3 + i * 3, y - 2, 2, 2);
  });
}

// An ember head (player figure plan step B) at (hx, hy) in `ctx`, for a
// stick man `h` tall: dark inside, its ring in `ring`, and a glow in the
// middle `level` strong (0: none) in the light `rgb`, leaning `lean` (-1..1,
// the way the figure looks) across the head. The player's and the crew's
// heads both draw here, so they stay alike. Gives back the head's radius.
export function drawEmberHead(ctx, hx, hy, h, { lean, ring, rgb, level }) {
  const headR = Math.max(2.5, h * HEAD_SHARE);
  ctx.save();
  ctx.strokeStyle = ring;
  ctx.lineWidth = STICK_LINE;
  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, Math.PI * 2);
  ctx.fillStyle = look.colours.hidden;
  ctx.fill();
  if (level > 0) {
    const gx = hx + lean * headR * PLAYER_EMBER.lean;
    const ember = ctx.createRadialGradient(gx, hy, 0, gx, hy, headR * PLAYER_EMBER.reach);
    ember.addColorStop(0, 'rgba(' + rgb + ', ' + level + ')');
    ember.addColorStop(1, 'rgba(' + rgb + ', 0)');
    ctx.fillStyle = ember;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
  return headR;
}

// Each crew member's figure for figure3d.js, by role: it keeps figures by
// object, so each role gets its own small one.
const crewFigures = new Map();

// The figure object for crew member `role`, made the first time it is asked for.
function crewFigure(role) {
  if (!crewFigures.has(role)) crewFigures.set(role, {});
  return crewFigures.get(role);
}

// How far through their idle and their breath crew member `role` is
// started, 0..1, from their place in SHIP_ROLES (the Engineer first), so
// no two move in step.
function crewOffset(role) {
  const place = SHIP_ROLES.findIndex(r => r.id === role) + 1;
  return (place * CREW_LOOK.stagger) % 1;
}

// A crew member (crew look plan step A): the player's 3D body standing in
// its idle at their station, arms down and no book, in the crew colour.
// Not an enemy: no tendrils, no tells. The ember head shows where they
// stand (roles.js crewLook, crewHeadLook): a faint steady glow while new,
// breathing warm with a small steady warm mark over the head when learned
// and waiting to be taught (so the player sees who to go to next),
// breathing cool once taught, and dark on a dim body when sitting out
// this trip. They face the camera and turn slowly to the player when the
// player comes within CREW_LOOK.turnReach tiles. Reduced motion: a still
// pose, a steady glow and turns at once.
function drawCrew(thing, x, y, glows) {
  const { role } = thing.at;
  const seen = crewHeadLook(crewLook(role));
  const figure = crewFigure(role);
  const offset = crewOffset(role);
  if (!look.still) look.keepMoving();
  const h = ROOM_VIEW.stickHeight * T;
  const fx = x + T / 2, fy = y + ROOM_VIEW.footAt * T;
  const dx = look.walkAt.col - thing.at.col, dy = look.walkAt.row - thing.at.row;
  const near = Math.hypot(dx, dy) <= CREW_LOOK.turnReach;
  const phi = turnFigure(figure, near ? phiToward(dx, dy) : 0, look.now, look.still);
  const joints = figurePose(figure, { at: [thing.at.col, thing.at.row], metres: FIGURE3D.heightM / ROOM_VIEW.stickHeight, offset }, look.now, look.still);
  const J = projectFigure(joints, phi, fx, fy, h / FIGURE3D.heightM);
  const colour = STATION_ART[seen.body];
  const px = v => Math.round(v) + 0.5;
  const path = (points) => points.forEach(([px0, py0], i) => (i ? bctx.lineTo(px(px0), px(py0)) : bctx.moveTo(px(px0), px(py0))));
  bctx.save();
  bctx.strokeStyle = colour;
  bctx.lineWidth = STICK_LINE;
  bctx.lineCap = 'square';
  bctx.beginPath();
  path([J.ftL, J.knL, J.pelvis, J.knR, J.ftR]);
  path([J.pelvis, J.chest, J.neck]);
  path([J.haL, J.elL, J.neck, J.elR, J.haR]);
  bctx.stroke();
  bctx.restore();
  const breath = Math.sin(2 * Math.PI * (look.now / CREW_LOOK.breathMs + offset));
  const level = !seen.glow ? 0 : seen.breathes ? emberGlow(breath, look.still) : CREW_LOOK.faint;
  const rgb = seen.glow === 'warm' ? STATION_ART.warmRgb : seen.glow === 'cool' ? STATION_ART.coolRgb : look.colours.glowRgb;
  const [hx, hy] = J.headMid;
  const headR = drawEmberHead(bctx, hx, hy, h, { lean: Math.sin(phi), ring: colour, rgb, level });
  if (!seen.mark) return;
  glows.push(() => {
    bctx.fillStyle = STATION_ART.warm;
    bctx.fillRect(Math.round(hx) - 1, Math.round(hy - headR) - 4, 2, 2);
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
// is open. A doorway in a side wall shows it edge on, a narrow strip.
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
function shadeAt(cx, cy) {
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
function bulbAt(cx, cy, bulb) {
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

// A soft round glow of `rgb` at (x, y) in picture pixels, `r` across, `a`
// strong in the middle.
function halo(x, y, r, rgb, a) {
  const g = bctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')');
  g.addColorStop(1, 'rgba(' + rgb + ', 0)');
  bctx.fillStyle = g;
  bctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export const STAND = {
  furniture: drawFurniture, shutter: drawShutter, console: drawConsole, powerBoard: drawPowerBoard, crew: drawCrew,
};

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

// Draws furniture prop `thing` on its tile at (x, y): its PNG when
// sprites.json gives it one (room sprites plan step B), else its code art,
// else a table. The PNG goes in the same picture as the code art would, so
// the room's light, the window cut-out and the sorting with the stick men
// treat it the same.
function drawFurniture(thing, x, y) {
  const { piece, part } = thing.at;
  const sprite = spriteFor(piece);
  if (sprite) { drawSprite(sprite, part, x, y); return; }
  const left = part === 'single' || part === 'left';
  const right = part === 'single' || part === 'right';
  (PIECES[piece] || PIECES.table)(x, y, left, right, thing.at);
}

// One tile of a sprite: its bottom T px on the tile at (x, y), anything
// taller rising above it. A sprite with parts picks this tile's frame
// (single / left / mid / right); one without is the same on every tile.
function drawSprite(sprite, part, x, y) {
  const frame = sprite.parts ? Math.max(0, FURNITURE_SPRITES.frames.indexOf(part)) : 0;
  const smooth = bctx.imageSmoothingEnabled;
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(sprite.image, frame * T, 0, T, sprite.tall, x, y + T - sprite.tall, T, sprite.tall);
  bctx.imageSmoothingEnabled = smooth;
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
