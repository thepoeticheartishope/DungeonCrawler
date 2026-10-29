// The gun on the room view (room view plan step D, moved out of
// roomview.js), drawn as a book (book plan, 2026-10-28): how the player's
// stick man holds it (holdBook, drawn by drawBook), the
// tiles it reaches lit faintly, corner brackets on what can be shot and
// the breathing target with its guard, the steady aim's mark, a dashed
// laser from the muzzle to the target's chest, the shot's flash and ring
// or MISS, the answer ring over what asked, and the tutorial's ring of
// words. roomview.js hands over its picture and this frame's look, camera
// and scales first (startGunFrame), then the enemies' tap boxes once it
// has them (gunTargets). Reads state and never changes it.

import { state } from './state.js';
import { ROOM_VIEW, ANSWER_RING, ENEMY_LIGHT, MAP_ANIMATION_MS, MINION_KINDS } from './config.js';
import {
  inReach, liveTarget, lastShot, darkRingAt, answerRingLetters, ENEMY_KINDS, POSE_SCALE, REACH_FILL,
  BRACKET_ARM, BRACKET_HALF, BRACKET_LEVEL, BRACKET_PULSE, BRACKET_TEXT_SIZE, BRACKET_HP_GAP, LASER_LEVEL,
  SHOT_RING, MISS_TEXT_SIZE, MISS_RISE, ISO_STICK_HEIGHT, STEADY_OPEN, STEADY_MARK, STEADY_SHAKE,
  STEADY_TEXT_SIZE,
} from './mapshared.js';
import { steadyChance, steadyShaking } from './gun.js';
import { canShoot } from './sight.js';
import { t } from './text.js';

const T = ROOM_VIEW.tilePx;
// The book in the player's hands (book plan, Timothy 2026-10-28: the gun
// drawn as a book, "weaponizing their knowledge"), as shares of his
// height: how far ahead of him he reads it and points it, how high he
// holds it and how far it lifts while a shot waits, and how far it leans
// back (degrees from upright) read and pointed. He reads it close while he
// aims and pushes it out at the enemy when he shoots.
export const BOOK = { read: 0.3, point: 0.5, height: 0.4, raise: 0.05, lift: 0.3, readLean: 45, pointLean: 70 };
// The open book flat, before it leans: a left page and a right page, the
// fold at column OPEN_MID, page edges and the cover along the bottom.
// P page, L line of words, S fold, E page edges, C cover.
const OPEN_BOOK = [
  '...PPPP.PPPP...',
  '.PPPPPPSPPPPPP.',
  'PLLLLPPSPLLLLLP',
  'PPPPPPPSPPPPPPP',
  'PLLLPPPSPLLLLPP',
  'PPPPPPPSPPPPPPP',
  'EEEEEEEEEEEEEEE',
  'CCCCCCCCCCCCCCC',
];
const OPEN_MID = 7;
const OPEN_DIP = 2;        // the pages bow into a V: the outer edges this many pixels above the fold
const OPEN_NARROW = 0.25;  // the top edge's narrowing at full lean, a share of its width (it is farther away)
const OPEN_FROM = 0.4;     // how wide it is as it starts to open, a share of open
// The shut book hanging from his hand: K spine, C cover, P page edges.
const SHUT_BOOK = ['KCCCC', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCC'];
const BOOK_COLOURS = { P: '#dde8ea', L: '#7f9396', S: '#4a5759', E: '#a3aeb0', C: '#8a6440', K: '#5a3e26' };
const BOOK_GLOW = { size: 8, level: 0.2 }; // the pages' glow while a shot waits: its reach in picture pixels and its level
const SHOT_AT = 0.55;            // a shot goes to this share of a stick man's height
const LASER_DASH = [5, 4];      // its dash and gap, in line widths
const DARK_RING = { lift: 0.5, size: 0.3 }; // the tutorial's ring of words: how high it floats and its letters' size, in tiles

let bctx = null;          // the picture being drawn into
let look = null;          // what mapview.js hands roomview each frame
let frame = { ox: 0, oy: 0 }; // the camera's top-left this frame, in picture pixels
let scale = 1;            // canvas pixels per picture pixel
let pageScale = 1;        // canvas pixels per CSS pixel
let tapBoxes = [];        // this frame's enemies: [{ box: [left, top, right, bottom], tile }]
let muzzle = null;        // the top of the open book's fold this frame in picture pixels (where the laser and the shot start), or null while it is shut
let bookOpenedAt = null;  // when the book last opened (frame time), or null while it is shut

// roomview.js starts each frame here, before the player's stick man is
// drawn: no book is held open yet, so no muzzle.
export function startGunFrame(picture, shared, camera, pixelScale, cssScale) {
  bctx = picture;
  look = shared;
  frame = camera;
  scale = pixelScale;
  pageScale = cssScale;
  muzzle = null;
}

// This frame's enemies' tap boxes, for the brackets, once roomview has them.
export function gunTargets(boxes) {
  tapBoxes = boxes;
}

// What the player's stick man (feet at (fx, fy), `h` tall, picture
// pixels, looking the way (ax, ay)) does with the book this frame. While
// nothing can be shot it is shut and hangs from `hand`. Once something can
// be shot (or a shot waits or has just gone) he lifts it and opens it
// over BOOK_OPEN_MS: read close, `rise` higher as his body breathes,
// lifted while a shot waits, pushed out at the enemy by a shot
// (pointedAt). Notes the top of its fold for the laser and the shot.
// Gives back { open: false, hand } or { open: true, spine, lean, spread,
// turn, behind, hands }: behind when he faces away, so the body is drawn
// over it.
export function holdBook(fx, fy, ax, ay, h, rise, hand) {
  const target = liveTarget();
  const shot = lastShot();
  const age = shot ? look.now - shot.start : Infinity;
  const pointing = age < MAP_ANIMATION_MS.bookPoint + MAP_ANIMATION_MS.bookBack;
  muzzle = null;
  if (!state.battle.aim && !(target && canShoot(target)) && !pointing) {
    bookOpenedAt = null;
    return { open: false, hand };
  }
  if (bookOpenedAt === null) bookOpenedAt = look.now;
  const opened = look.still ? 1 : ease((look.now - bookOpenedAt) / MAP_ANIMATION_MS.bookOpen);
  if (!look.still && (opened < 1 || pointing)) look.keepMoving();
  if (opened < 0.5) return { open: false, hand: [hand[0], hand[1] - opened * BOOK.lift * h] };
  const out = pointedAt(age, look.still);
  const ahead = (BOOK.read + (BOOK.point - BOOK.read) * out) * h;
  const up = (BOOK.height + (state.battle.aim ? BOOK.raise : 0) - (1 - opened) * BOOK.lift) * h + rise;
  const spine = [Math.round(fx + ax * ahead), Math.round(fy + ay * ahead - up)];
  const lean = BOOK.readLean + (BOOK.pointLean - BOOK.readLean) * out;
  const spread = OPEN_FROM + (1 - OPEN_FROM) * opened;
  const tall = openHeight(lean);
  muzzle = [spine[0] + 0.5, spine[1] - tall + 0.5];
  return {
    open: true, spine, lean, spread,
    turn: look.still ? 0 : age / MAP_ANIMATION_MS.bookTurn,
    behind: ay < 0,
    hands: [[spine[0] + OPEN_MID * spread, spine[1] - OPEN_DIP], [spine[0] - OPEN_MID * spread, spine[1] - OPEN_DIP]],
  };
}

// How far out the book is `age` ms after the last shot: 0 read close, 1
// pointed at the enemy. It goes out fast, stays while the shot plays and
// comes back slowly; under reduced motion (`still`) it is simply out
// while the shot plays.
function pointedAt(age, still) {
  const { bookPush, bookPoint, bookBack } = MAP_ANIMATION_MS;
  if (age < 0 || age >= bookPoint + bookBack) return 0;
  if (still) return age < bookPoint ? 1 : 0;
  return age < bookPoint ? ease(age / bookPush) : 1 - ease((age - bookPoint) / bookBack);
}

// A gentle start and stop for 0..1 (clamped).
function ease(p) {
  const q = Math.min(1, Math.max(0, p));
  return q * q * (3 - 2 * q);
}

// How many pixels tall the open book looks leaning `lean` degrees back.
function openHeight(lean) {
  return Math.max(5, Math.round(OPEN_BOOK.length * (0.6 + 0.4 * Math.cos(lean * Math.PI / 180))));
}

// Draws the book holdBook gave back into the picture: shut from its hand,
// or open with its left and right pages level so it reads left to right,
// leaning back (shorter, its top edge narrower), the pages bowed into a V,
// glowing while a shot waits, and a page turning from right to left after
// a shot. Each pixel takes the nearest pixel of the flat book, so it stays
// pixel art.
export function drawBook(book) {
  const dot = (x, y, ch) => {
    bctx.fillStyle = BOOK_COLOURS[ch];
    bctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  if (!book.open) {
    SHUT_BOOK.forEach((row, r) => [...row].forEach((ch, c) => dot(book.hand[0] - 1 + c, book.hand[1] + r, ch)));
    return;
  }
  const [cx, cy] = book.spine;
  const tall = openHeight(book.lean);
  const narrow = Math.sin(book.lean * Math.PI / 180) * OPEN_NARROW;
  const reach = OPEN_MID * book.spread;
  const lift = x => Math.round(OPEN_DIP * Math.min(1, Math.abs(x) / reach));
  if (state.battle.aim) {
    const [gx, gy] = [cx, cy - tall + 2];
    const glow = bctx.createRadialGradient(gx, gy, 0, gx, gy, BOOK_GLOW.size);
    glow.addColorStop(0, 'rgba(' + look.colours.glowRgb + ', ' + BOOK_GLOW.level + ')');
    glow.addColorStop(1, 'rgba(' + look.colours.glowRgb + ', 0)');
    bctx.fillStyle = glow;
    bctx.fillRect(gx - BOOK_GLOW.size, gy - BOOK_GLOW.size, BOOK_GLOW.size * 2, BOOK_GLOW.size * 2);
  }
  for (let r = 0; r < tall; r++) {
    const row = OPEN_BOOK[Math.min(OPEN_BOOK.length - 1, Math.floor((r + 0.5) / tall * OPEN_BOOK.length))];
    const across = book.spread * (1 - narrow * (1 - r / (tall - 1)));
    for (let x = -OPEN_MID - 1; x <= OPEN_MID + 1; x++) {
      const ch = row[Math.round(x / across) + OPEN_MID];
      if (ch && ch !== '.') dot(cx + x, cy - tall + 1 + r - lift(x), ch);
    }
  }
  if (book.turn <= 0 || book.turn >= 1) return;
  // A page lifts off the right side and lays itself down on the left.
  const s = Math.PI * book.turn;
  const x = Math.round(cx + (OPEN_MID - 1) * book.spread * Math.cos(s));
  const top = cy - tall + 1 - lift(x - cx) - Math.round(OPEN_DIP * Math.sin(s));
  for (let y = top; y <= cy - 2 - lift(x - cx); y++) dot(x, y, 'P');
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
export function drawReach(c0, r0, c1, r1, ox, oy) {
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
export function drawBrackets(ctx) {
  const target = liveTarget();
  const tw = T * scale;
  tapBoxes.forEach(({ box, tile }) => {
    const m = state.floor.minions.find(n => n.row === tile.row && n.col === tile.col);
    if (!m) return;
    const chosen = m === target;
    if (!chosen && !canShoot(m)) return;
    // Steady aim: a lit shot being steadied on this one. In the dark there
    // is no help at all (Timothy 2026-10-27: no spamming the gun to find them).
    const aim = state.battle.aim;
    const steady = aim && aim.phase === 'steady' && !aim.dark && aim.target === m ? aim : null;
    let breathe = 0;
    if (steady) breathe = (1 - steady.steady) * tw * STEADY_OPEN;
    else if (chosen && !look.still) {
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
    if (steady) drawSteadyMark(ctx, steady, [l, top, r, bottom], half, tw);
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

// Steady aim's mark inside the target's brackets (`box`, l top r bottom):
// a line across the body that climbs from the feet to the head as the aim
// steadies (shaking with the arm, not under reduced motion), and the
// chance to land by the top right bracket.
function drawSteadyMark(ctx, aim, [l, top, r, bottom], half, tw) {
  const shake = steadyShaking(aim) && !look.still ? (Math.random() - 0.5) * 2 * tw * STEADY_SHAKE : 0;
  const mid = (l + r) / 2 + shake;
  const y = bottom - aim.steady * (bottom - top) + shake;
  const level = BRACKET_LEVEL[1];
  glowStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(mid - half * STEADY_MARK, y);
    ctx.lineTo(mid + half * STEADY_MARK, y);
  }, level, scale * 1.4);
  ctx.save();
  ctx.fillStyle = 'rgba(' + look.colours.glowRgb + ', ' + level + ')';
  ctx.font = Math.round(tw * STEADY_TEXT_SIZE) + 'px VT323, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(Math.round(steadyChance(aim) * 100) + '%', r + tw * 0.04, top);
  ctx.restore();
}

// The dashed laser from the gun's muzzle to the target's chest, while it
// can be shot; brighter while a landed shot waits for the dial.
export function drawLaser(ctx) {
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
export function drawShot(ctx) {
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
export function drawAnswerRing(ctx, ring, near) {
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
export function drawDarkRing(ctx) {
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

