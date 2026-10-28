// The gun on the room view (room view plan step D, moved out of
// roomview.js): where the player's stick man holds it (holdGun), the
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
  inReach, liveTarget, lastShot, recoilAt, darkRingAt, answerRingLetters, ENEMY_KINDS, POSE_SCALE, REACH_FILL,
  BRACKET_ARM, BRACKET_HALF, BRACKET_LEVEL, BRACKET_PULSE, BRACKET_TEXT_SIZE, BRACKET_HP_GAP, LASER_LEVEL,
  SHOT_RING, MISS_TEXT_SIZE, MISS_RISE, ISO_STICK_HEIGHT, STEADY_OPEN, STEADY_MARK, STEADY_SHAKE,
  STEADY_TEXT_SIZE,
} from './mapshared.js';
import { steadyChance, steadyShaking } from './gun.js';
import { canShoot } from './sight.js';
import { t } from './text.js';

const T = ROOM_VIEW.tilePx;
// The gun in the player's hand (step D), as shares of his height: how far
// ahead and to his right his hand holds it, how high, its length, its
// grip, how far it lifts while a shot waits and kicks back on a shot.
export const GUN = { ahead: 0.2, side: 0.08, height: 0.5, length: 0.3, grip: 0.08, raise: 0.06, kick: 0.08 };
const SHOT_AT = 0.55;            // a shot goes to this share of a stick man's height
const LASER_DASH = [5, 4];      // its dash and gap, in line widths
const DARK_RING = { lift: 0.5, size: 0.3 }; // the tutorial's ring of words: how high it floats and its letters' size, in tiles

let bctx = null;          // the picture being drawn into
let look = null;          // what mapview.js hands roomview each frame
let frame = { ox: 0, oy: 0 }; // the camera's top-left this frame, in picture pixels
let scale = 1;            // canvas pixels per picture pixel
let pageScale = 1;        // canvas pixels per CSS pixel
let tapBoxes = [];        // this frame's enemies: [{ box: [left, top, right, bottom], tile }]
let muzzle = null;        // the gun's muzzle this frame in picture pixels, or null with no gun drawn

// roomview.js starts each frame here, before the player's stick man is
// drawn: no gun is held yet, so no muzzle.
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

// Where the player's stick man (feet at (fx, fy), `h` tall, picture
// pixels) holds the gun: ahead of him the way the light points (ax, ay),
// to his right, at hand height, `rise` higher as his body breathes, lifted
// while a shot waits, kicked back by a shot. Notes its muzzle for the
// laser and the shot.
export function holdGun(fx, fy, ax, ay, h, rise) {
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

