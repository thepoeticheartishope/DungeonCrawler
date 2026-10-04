// Minions drawn as text forms (gun plan step 4b): faceless shapes made only
// of letters from the loaded question set's answers, so they feel unknown.
// Each kind has its own form, ported from the fight mockup
// (reload-fire-iso-mockup.html, "Text forms"):
// - SHARD, the mass: a lumpy, still body of letters with a black hollow
//   where a face would be, and tendrils of letters; the two reaching for
//   the player are its limbs.
// - HUSK, the turning mass: the same lumpy body as a ball turning slowly
//   on two axes, near side only, its hollow turning toward the player and
//   away; two tendrils reaching for the player are its limbs.
// - STALKER, the drain: three arms of letters spiralling slowly into a
//   ragged dark centre; arms two and three are its limbs.
//
// The calm rule (Timothy): letters never scroll, scramble, jitter or
// flash. Each letter becomes another about every MAP_ANIMATION_MS.formRewrite
// with a slow crossfade, staggered so they never change together, all
// movement is slow, a hit is a soft brightening and one small push, and
// with reduced motion everything holds still. No faces, no eyes, and no
// overlays on top of a form: every effect lives in the form's own shape.
//
// isoview.js calls drawTextForm() for a minion it has made out, and
// dyingForms() for killed minions still fading. mapview.js calls
// hurtForm() / loseLimb() / killForm() from their drawEvents cases. The
// moments those leave (when it was hurt, lost a limb, died) are view-only
// and kept here, not in state. Reads state and never changes it.

import { state } from './state.js';
import { MAP_ANIMATION_MS, FORM_TELL_STEPS } from './config.js';

// Sizes are shares of a tile's width, as in the mockup, whose tiles were
// MOCKUP_TILE pixels wide: its pixel sizes are scaled by tw / MOCKUP_TILE.
const MOCKUP_TILE = 96;
const PUSH_SCALE = 160;     // the mockup's push and drift distances were in tiles of this many pixels
const HIT_PUSH = 8;         // a hit's one small push, in those pixels
const LIMB_DRIFT = [40, 25, 55]; // a lost limb drifts away, spreads, and sinks this far
const DEATH_DRIFT = [100, 25, 60]; // a killed form's letters spread, then rise this far plus up to this much more
const TELL = 0.75;          // how far the strike tell goes (0..1)
const WEAK_PULSE_MS = 750;  // the weak point limb's slow brightening while a landed shot waits
const BACKING = 0.9;        // the black behind each letter, so the form blots out the floor
const SHADOW = 'rgba(0, 0, 0, 0.85)'; // the dark ellipse a form floats over
const MASS_LETTER = 16 / MOCKUP_TILE; // the mass's letters
// Each form's body, as shares of a tile's width: how high its middle
// floats, then half its width and its height above that middle.
const FORM_BOXES = {
  SHARD: { rise: 0.62, half: 0.5, up: 0.5 },
  HUSK: { rise: 0.74, half: 0.52, up: 0.52 },
  STALKER: { rise: 0.62, half: 0.5, up: 0.43 },
};
const BOB = 2 / MOCKUP_TILE; // how far a form rises and sinks as it floats

// The letters a form is made of: every answer in the loaded set, run
// together, worked out again only when another set is loaded.
let letterSource = null;
let letters = ' ';
// Each minion's view-only moments: minion -> { seed, hitAt, limbAt, deadAt }.
const moments = new WeakMap();
let seedCount = 0;
// Killed minions still floating apart: [{ minion, floor }].
let dying = [];
let ctx = null; // the canvas being drawn on, set by drawTextForm

// Draws `minion` as its kind's text form standing on (x, y), the middle of
// its tile in canvas pixels. `view` is { tw, toward, now, still, colour,
// outline, aiming }: a tile's width, the player's place on screen (the
// limbs reach for it), the frame time, reduced motion, the letters'
// colour, outline(path, strength) to stroke a glowing line, and whether a
// landed shot on it waits for the damage bar (its next limb, the weak
// point, brightens). Returns the weak point's place as [x, y], or null.
export function drawTextForm(canvasCtx, minion, x, y, view) {
  ctx = canvasCtx;
  const m = moment(minion, view);
  if (m.dying >= 1) return null;
  const draw = minion.minionKind === 'HUSK' ? drawTurningMass : minion.minionKind === 'STALKER' ? drawDrain : drawMass;
  return draw(m, x, y, view);
}

// The box round a `kind` form's body standing on (x, y), as [left, top,
// right, bottom] in pixels, for brackets, taps and the walls cut in front
// of it. From its shape's fixed sizes, never from where it last drew: the
// walls in front of it must not move as it floats.
export function formBox(kind, x, y, tw) {
  const { rise, half, up } = FORM_BOXES[kind] || FORM_BOXES.SHARD;
  return [x - half * tw, y - (rise + up) * tw, x + half * tw, y];
}

// Notes that `minion` was hurt: a soft brightening and one small push.
export function hurtForm(minion) {
  momentsOf(minion).hitAt = performance.now();
}

// Notes that `minion` just lost a limb (its limbs field has already gone
// down): the limb drifts off and fades.
export function loseLimb(minion) {
  momentsOf(minion).limbAt = performance.now();
}

// Notes that `minion` was killed. The rules have taken it off the floor,
// so it is kept here while its letters float apart. Under reduced motion
// it is simply gone.
export function killForm(minion, still) {
  if (still || !minion.minionKind) return;
  momentsOf(minion).deadAt = performance.now();
  dying.push({ minion, floor: state.run.floorsEntered });
}

// The killed minions still fading on this floor, for isoview.js to draw
// where they died.
export function dyingForms(now) {
  dying = dying.filter(d => d.floor === state.run.floorsEntered && now - momentsOf(d.minion).deadAt < MAP_ANIMATION_MS.formDeath);
  return dying.map(d => d.minion);
}

// A minion's moments, made the first time it is drawn. Its seed sets
// where it is in its slow cycles, so two of a kind don't move in step
// (counted, never Math.random: the seeded tests own it).
function momentsOf(minion) {
  let fx = moments.get(minion);
  if (!fx) {
    fx = { seed: (seedCount++ * 37.3) % 100, hitAt: -1e9, limbAt: null, deadAt: null };
    moments.set(minion, fx);
  }
  return fx;
}

// Everything a form needs to know this frame: its clock, how hurt, near,
// dying or torn it is, and which limbs it still shows.
function moment(minion, view) {
  const fx = momentsOf(minion);
  const { now, still } = view;
  const limbs = minion.limbs;
  const torn = fx.limbAt === null ? -1 : limbs === 1 ? 0 : 1;
  const limbAge = fx.limbAt === null || still ? Infinity : now - fx.limbAt;
  const has = i => limbs === 2 || (limbs === 1 && i === 1);
  const steps = Math.abs(minion.row - state.floor.playerRow) + Math.abs(minion.col - state.floor.playerCol);
  const hitAge = now - fx.hitAt;
  return {
    t: still ? 0 : now / 1000 + fx.seed,
    seed: fx.seed,
    scale: view.tw / PUSH_SCALE,
    still,
    hitK: !still && hitAge < MAP_ANIMATION_MS.formHit ? 1 - hitAge / MAP_ANIMATION_MS.formHit : 0,
    // The tell: one more step and it is next to the player.
    tellK: fx.deadAt === null && steps <= FORM_TELL_STEPS ? TELL : 0,
    dying: fx.deadAt === null ? 0 : Math.min(1, (now - fx.deadAt) / MAP_ANIMATION_MS.formDeath),
    torn, limbAge, has,
    shown: i => has(i) || (i === torn && limbAge < MAP_ANIMATION_MS.formLimb),
    weak: view.aiming ? (limbs === 2 ? 0 : limbs === 1 ? 1 : -1) : -1,
    pulse: still ? 0.5 : 0.5 + 0.5 * Math.sin(now / WEAK_PULSE_MS),
  };
}

// The letters run together from the loaded set's answers, upper case.
function letterPool() {
  const data = state.settings.activeData;
  if (data !== letterSource) {
    letterSource = data;
    const words = (data || []).map(d => String(d.meaning || '').toUpperCase().trim()).filter(Boolean);
    letters = words.length ? words.join(' ') + ' ' : 'NOESIS ';
  }
  return letters;
}

// A number from 0 to 1 that always comes out the same for the same `n`.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The letter in place `id` of a form during its rewrite cycle `slot`: a
// letter (never a space) picked from the pool by a hash, so it is the same
// every frame until the cycle moves on.
function letterAt(id, slot, seed) {
  const pool = letterPool();
  let i = Math.floor(hash(id * 7 + slot * 13 + seed) * pool.length);
  while (pool[i % pool.length] === ' ') i++;
  return pool[i % pool.length];
}

// Draws a form's letters, each on its own black backing: pushed by a hit,
// drifting off if its limb was just lost, floating apart if the form is
// dying, brighter on the weak point's limb, and crossfading slowly from
// its last letter to its next. `list` is [{ id, x, y, size, a, part }],
// part 'body' or 'limb0' / 'limb1'.
function drawLetters(list, m, seed, colour) {
  const { formRewrite, formFade, formLimb } = MAP_ANIMATION_MS;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let font = 0;
  for (const L of list) {
    let dx = Math.sin(Math.PI * m.hitK) * HIT_PUSH * m.scale;
    let dy = 0;
    let alpha = L.a;
    if (L.part === 'limb' + m.torn && !m.has(m.torn)) {
      const d = Math.min(1, m.limbAge / formLimb);
      dx += (m.torn === 0 ? -1 : 1) * d * LIMB_DRIFT[0] * m.scale + (hash(L.id) - 0.5) * d * LIMB_DRIFT[1] * m.scale;
      dy += d * d * LIMB_DRIFT[2] * m.scale;
      alpha *= 1 - d;
    }
    if (m.dying) {
      dx += (hash(L.id * 5 + seed) - 0.5) * m.dying * DEATH_DRIFT[0] * m.scale;
      dy -= m.dying * (DEATH_DRIFT[1] + DEATH_DRIFT[2] * hash(L.id * 9 + seed)) * m.scale;
      alpha *= 1 - m.dying;
    }
    if (L.part === 'limb' + m.weak) alpha += 0.35 * m.pulse * alpha;
    alpha = Math.min(1, alpha + m.hitK * 0.3 + m.tellK * 0.2);
    if (alpha <= 0.01) continue;
    const x = L.x + dx;
    const y = L.y + dy;
    const size = Math.max(1, Math.round(L.size));
    if (size !== font) {
      font = size;
      ctx.font = size + 'px VT323, monospace';
    }
    ctx.globalAlpha = BACKING * Math.min(1, alpha * 1.5);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - L.size * 0.32, y - L.size * 0.48, L.size * 0.64, L.size * 0.96);
    const phase = hash(L.id * 3 + seed) * formRewrite;
    const cycle = (m.t * 1000 + phase) / formRewrite;
    const slot = Math.floor(cycle);
    const fade = Math.min(1, (cycle - slot) * formRewrite / formFade);
    ctx.fillStyle = colour;
    ctx.globalAlpha = alpha * fade;
    ctx.fillText(letterAt(L.id, slot, seed), x, y);
    if (fade < 1) {
      ctx.globalAlpha = alpha * (1 - fade);
      ctx.fillText(letterAt(L.id, slot - 1, seed), x, y);
    }
  }
  ctx.restore();
}

// The dark ellipse a form floats over, shrinking as it dies.
function drawShadow(x, y, tw, m, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, tw * w * (1 - m.dying), tw * h * (1 - m.dying), 0, 0, Math.PI * 2);
  ctx.fillStyle = SHADOW;
  ctx.fill();
}

// Tendrils of letters out of a body of radius R round (cx, cy), thinning
// and dimming toward their tips and swaying slowly. Those with a `limb`
// are limbs: they stretch toward the player on the tell and are left out
// once lost. `perLength` letters per unit of length, `size` the letters'
// size at the root. Pushes the letters onto `list` and returns where each
// limb's root is (its weak point).
function addTendrils(list, tendrils, m, cx, cy, R, perLength, size, z) {
  const roots = [];
  tendrils.forEach((T, k) => {
    const isLimb = T.limb !== undefined;
    if (isLimb) roots[T.limb] = [cx + Math.cos(T.a) * R * 0.9, cy + Math.sin(T.a) * R * 0.7];
    if (isLimb && !m.shown(T.limb)) return;
    const len = T.len * (1 + (isLimb ? 0.3 * m.tellK : 0));
    const n = Math.round(len * perLength);
    for (let i = 0; i < n; i++) {
      const s = i / n;
      const ang = T.a + 0.35 * Math.sin(m.t * 0.3 + s * 3 + k * 1.7) * s * (1 - (isLimb ? m.tellK * 0.7 : 0));
      const r = R * (0.85 + s * len);
      list.push({
        id: 1000 + k * 50 + i, z,
        x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r * 0.75 + s * s * R * 0.45,
        size: size * (1 - s * 0.45), a: 0.75 * (1 - s * 0.7), part: isLimb ? 'limb' + T.limb : 'body',
      });
    }
  });
  return roots;
}

// The angle from (cx, cy) toward the player, aimed a little above their feet.
function angleToPlayer(view, cx, cy) {
  return Math.atan2(view.toward[1] - view.tw * 0.4 - cy, view.toward[0] - cx);
}

// SHARD, the mass: a lumpy body of letters on a grid inside a slowly
// shifting edge, a black hollow where a face would be, and five tendrils;
// the two reaching for the player are its limbs.
function drawMass(m, x, y, view) {
  const { tw } = view;
  const R = tw * 0.5;
  const cx = x;
  const cy = y - tw * FORM_BOXES.SHARD.rise + (m.still ? 0 : Math.sin(m.t * 0.5) * BOB * tw);
  drawShadow(x, y, tw, m, 0.24, 0.1);
  const size = tw * MASS_LETTER;
  const gx = size * 0.58;
  const gy = size * 0.85;
  const list = [];
  let id = 0;
  const vx = cx - R * 0.12;
  const vy = cy - R * 0.08;
  const vr = R * 0.34 * (1 + (m.still ? 0 : 0.08 * Math.sin(m.t * 0.3)));
  for (let yy = cy - R * 1.3; yy < cy + R * 1.3; yy += gy) {
    for (let xx = cx - R * 1.4; xx < cx + R * 1.4; xx += gx) {
      const dx = xx - cx;
      const dy = (yy - cy) / 0.8;
      const d = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      const edge = R * (1 + 0.14 * Math.sin(th * 3 + m.t * 0.22) + 0.09 * Math.sin(th * 5 - m.t * 0.17) + 0.05 * Math.sin(th * 9 + 1.3));
      id++;
      if (d > edge || Math.hypot(xx - vx, (yy - vy) / 0.8) < vr) continue;
      const rim = 1 - Math.max(0, (d - edge * 0.75) / (edge * 0.25));
      list.push({ id, x: xx, y: yy, size, a: (0.5 + 0.45 * hash(id * 1.3)) * (0.5 + 0.5 * rim), part: 'body' });
    }
  }
  const toYou = angleToPlayer(view, cx, cy);
  const roots = addTendrils(list, [
    { a: toYou - 0.4, len: 1.8, limb: 0 }, { a: toYou + 0.4, len: 1.6, limb: 1 },
    { a: toYou + Math.PI - 0.5, len: 1.2 }, { a: toYou + Math.PI + 0.6, len: 1.0 }, { a: toYou + Math.PI, len: 0.9 },
  ], m, cx, cy, R, 9, size, 0);
  ctx.beginPath();
  ctx.ellipse(vx, vy, vr * (1 - m.dying), vr * 0.8 * (1 - m.dying), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  drawLetters(list, m, 11 + m.seed, view.colour);
  return m.weak >= 0 ? roots[m.weak] : null;
}

// HUSK, the turning mass: the mass's lumpy body as a ball of letters
// turning slowly on two axes, near side only, nearer letters bigger and
// brighter. Its hollow is part of the body, so it turns toward the player
// and away; it shows as a black gap only while it faces them. Four
// tendrils; the two reaching for the player are its limbs.
function drawTurningMass(m, x, y, view) {
  const { tw } = view;
  const R = tw * 0.52 * (1 + 0.1 * m.tellK);
  const cx = x;
  const cy = y - tw * FORM_BOXES.HUSK.rise + (m.still ? 0 : Math.sin(m.t * 0.4) * BOB * tw);
  drawShadow(x, y, tw, m, 0.28, 0.11);
  const A = m.still ? 0.3 : m.t * 0.05;
  const B = m.still ? 0.6 : m.t * 0.13;
  const ca = Math.cos(A);
  const sa = Math.sin(A);
  const cb = Math.cos(B);
  const sb = Math.sin(B);
  const turn = (px, py, pz) => {
    const y1 = py * ca - pz * sa;
    const z1 = py * sa + pz * ca;
    return [cx + px * cb + z1 * sb, cy + y1 * 0.9, -px * sb + z1 * cb];
  };
  const list = [];
  const N = 90;
  const hole = [0.3, -0.2, 0.93];
  for (let i = 0; i < N; i++) {
    const yv = 1 - 2 * (i + 0.5) / N;
    const rr = Math.sqrt(1 - yv * yv);
    const th = i * 2.39996;
    const dir = [Math.cos(th) * rr, yv, Math.sin(th) * rr];
    if (dir[0] * hole[0] + dir[1] * hole[1] + dir[2] * hole[2] > 0.86) continue;
    const lump = 1 + 0.16 * Math.sin(th * 3 + 1) * Math.cos(yv * 4) + 0.08 * Math.sin(th * 5 + yv * 3);
    const [lx, ly, z] = turn(dir[0] * R * lump, dir[1] * R * 0.85 * lump, dir[2] * R * lump);
    if (z < -R * 0.25) continue;
    const front = (z / R + 1) / 2;
    list.push({ id: i, x: lx, y: ly, z, size: tw * (0.13 + 0.08 * front), a: 0.25 + 0.75 * front, part: 'body' });
  }
  const toYou = angleToPlayer(view, cx, cy);
  const roots = addTendrils(list, [
    { a: toYou - 0.4, len: 1.5, limb: 0 }, { a: toYou + 0.4, len: 1.3, limb: 1 },
    { a: toYou + Math.PI - 0.5, len: 0.9 }, { a: toYou + Math.PI + 0.6, len: 0.7 },
  ], m, cx, cy, R, 8, tw * 0.15, Infinity);
  list.sort((a, b) => a.z - b.z);
  drawLetters(list, m, 41 + m.seed, view.colour);
  const [hx, hy, hz] = turn(hole[0] * R * 0.95, hole[1] * R * 0.85 * 0.95, hole[2] * R * 0.95);
  if (hz > 0) {
    const f = hz / R * (1 - m.dying);
    ctx.beginPath();
    ctx.ellipse(hx, hy, R * 0.3 * f, R * 0.24 * f, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
  }
  return m.weak >= 0 ? roots[m.weak] : null;
}

// STALKER, the drain: three arms of letters spiralling very slowly into a
// ragged dark centre, smaller and dimmer as they go in. Arms two and three
// are its limbs. On the tell the centre widens and pulls the arms in.
function drawDrain(m, x, y, view) {
  const { tw } = view;
  const Rv = tw * 0.62;
  const cx = x;
  const cy = y - tw * FORM_BOXES.STALKER.rise + (m.still ? 0 : Math.sin(m.t * 0.4) * BOB * tw);
  drawShadow(x, y, tw, m, 0.28, 0.11);
  const spin = m.still ? 0.4 : m.t * 0.18;
  const pull = 1 - 0.25 * m.tellK;
  const list = [];
  const mids = [];
  [0, 1, 2].forEach(k => {
    const limb = k === 0 ? undefined : k - 1;
    const part = limb === undefined ? 'body' : 'limb' + limb;
    if (limb !== undefined) {
      const r = Rv * 0.65 * pull;
      const ang = k * Math.PI * 2 / 3 + 0.45 * 2.6 + spin;
      mids[limb] = [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.62];
      if (!m.shown(limb)) return;
    }
    const n = 26;
    for (let i = 0; i < n; i++) {
      const s = i / n;
      const r = Rv * (0.2 + s * 0.95) * pull;
      const ang = k * Math.PI * 2 / 3 + s * 2.6 + spin;
      list.push({ id: k * 100 + i, x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r * 0.62, size: tw * (0.08 + 0.11 * s), a: 0.15 + 0.8 * s, part });
      if (i % 2 === 0) {
        const r2 = r * 0.84;
        const a2 = ang - 0.2;
        list.push({ id: k * 100 + 50 + i, x: cx + Math.cos(a2) * r2, y: cy + Math.sin(a2) * r2 * 0.62, size: tw * (0.07 + 0.07 * s), a: 0.1 + 0.45 * s, part });
      }
    }
  });
  drawLetters(list, m, 33 + m.seed, view.colour);
  const core = Rv * (0.2 + 0.12 * m.tellK) * (1 - m.dying) * (1 + (m.still ? 0 : 0.05 * Math.sin(m.t * 0.35)));
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const r = core * (1 + 0.1 * Math.sin(a * 5 + m.t * 0.3) + 0.06 * Math.sin(a * 3 - m.t * 0.2));
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.62;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  path();
  ctx.fillStyle = '#000';
  ctx.fill();
  view.outline(path, 0.18 + 0.2 * m.tellK);
  return m.weak >= 0 ? mids[m.weak] : null;
}
