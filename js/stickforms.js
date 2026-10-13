// Minions drawn as stick men (stick enemies plan step B), in the player's
// style but glowing a cold blue (ENEMY_LIGHT) instead of the player's
// white, each in an odd body pose. Ported from the pose prototype
// (ideas/stick-pose-studies.html outside the repo). The look is new; the
// rules don't change.
//
// Every pose is data in STICK_POSES: its joints at rest and at the height
// of its tell, the bones between them, its heads, its core, its two limbs
// and its shadow, plus a slow idle movement. Each minion picks a pose the
// first time it is drawn, at random from all seven (DEV -> Look can force
// one), and the kind shows only by size (MINION_KINDS[kind].size).
//
// The calm rule (Timothy): everything moves slowly and nothing flashes. The
// tell eases into its pose and back out, a hit is a soft brightening and
// one small push, a lost limb's bones are gone, and a killed one's lines
// fade. With reduced motion everything holds still (the tell pose is shown
// still, so the warning isn't lost).
//
// isoview.js calls drawStickForm() for a minion it has made out, stickBox()
// for its brackets, taps and wall cuts, and dyingSticks() for killed ones
// still fading. mapview.js calls hurtStick() / loseStickLimb() /
// killStick() from their drawEvents cases. Those moments are view-only and
// kept here, not in state. Reads state and never changes it.

import { state } from './state.js';
import { stepsAway } from './passage.js';
import {
  MAP_ANIMATION_MS, FORM_TELL_STEPS, MINION_KINDS, ENEMY_LIGHT,
  TENDRIL_GROW_MS, TENDRIL_HOLD_MS, TENDRIL_BACK_MS, TENDRIL_STEP, TENDRIL_SIZE, TENDRIL_LOOKALIKES, TENDRIL_MIRRORABLE,
} from './config.js';

// Sizes are shares of the stick man's height unless they say otherwise.
const HIT_PUSH = 0.08;       // a hit's one small push, away from the player
const HIT_BRIGHTEN = 0.15;   // how much brighter a hit makes its lines
const REST_LEVEL = 0.85;     // its lines' strength at rest
const WEAK_PULSE = 0.25;     // how much the weak point limb brightens while a landed shot waits
const WEAK_PULSE_MS = 750;   // that brightening's slow cycle
const SHADOW_SIZE = [1.3, 0.5]; // its shadow's ellipse, as multiples of the pose's shadow half-width
const SHADOW_LEVEL = 0.85;   // the shadow's darkness, unless the pose says otherwise
const BOX_MARGIN = 0.08;     // room round its joints in stickBox(), for heads and glow

// Tendrils (step C), ported from the tendril prototype
// (ideas/stick-tendril-studies.html outside the repo). Lengths are in tile
// widths; angles in radians, as on the canvas (0 = right, down is positive).
const WOUND_REACH = [1.0, 1.0, 0.72]; // a hit's three tendrils from the wound: two reach for the player, one curls away
const WOUND_FAN = [-0.35, 0.25];      // where the two reaching ones point, either side of the player
const WOUND_AWAY = -0.5;              // where the third points, away from the player (then turned up to 0.4 either way)
const HEAD_REACH = [0.9, 0.25];       // a hit's three head tendrils: this long, plus up to this much more
const HEAD_FAN = 0.45;                // how far apart they spread from the head's top
const HEAD_GAP = 0.9;                 // how far the head opens where they come out, in radians each way
const LIMB_REACH = 1.1;               // the tendril where a lost limb was
const DEATH_REACH = [1.0, 0.4];       // a kill's six tendrils: this long, plus up to this much more
const DEATH_TENDRILS = 6;
const DEATH_FAN = 0.7;                // how far apart they spread, all round its top
const STAGGER_MS = { wound: 160, head: 200 }; // each of a hit's tendrils starts this much after the last
const PULL = { reach: 0.3, head: 0.15, limb: 0.4, unravel: 0.5, tell: 0.8 }; // how hard tendrils lean toward the player (more in its tell)
const UNRAVEL_SPACING = 0.058;        // letters along a line as it unravels, in tile widths
const UNRAVEL_LONGER = 2.5;           // peeled off, the line's tendril is this many times its letters
const UNRAVEL_AWAY = 0.8;             // a peeled line leaves this far off its own direction (sides alternate)
const SHRINK = 0.4;                   // letters get this much smaller toward a tendril's tip
const LETTER_BACKING = 0.85;          // the black behind each letter, so it reads over the floor
const MIN_LETTER_PX = 6;              // the smallest a letter is drawn

// The poses. Joints are [x, y] as shares of the stick man's height: feet at
// y 0, up is negative, and toward the player is negative x (the pose is
// mirrored when the player is on its other side). `rest` and `tell` hold
// the same joints. `idle` moves joints slowly at rest: [joints, dx, dy,
// speed, phase], each joint moved by (dx, dy) times sin(t * speed + phase)
// (or only its upper half with `lift`, a step that lifts and sets down).
// `bones` join two joints; `heads` are [joint, radius]; `core` is the two
// joints whose middle hit tendrils will grow from (step C); `limbs` are the
// two the weak point takes, each its bones (indexes into `bones`), the
// joint it grows from and the angle its tendril leaves at (step C);
// `shadow` is the half-width of its shadow.
export const STICK_POSES = {
  // Upside down: floating, head down, arms hanging straight.
  upsideDown: {
    rest: {
      handF: [-0.14, -0.26], handB: [0.14, -0.26], shF: [-0.14, -0.6], shB: [0.14, -0.6],
      sh: [0, -0.7], neck: [0, -0.61], head: [0, -0.5],
      hip: [0, -1.0], kneeF: [-0.1, -1.2], kneeB: [0.1, -1.2], footF: [-0.1, -1.4], footB: [0.1, -1.4],
    },
    tell: {
      handF: [-0.22, -0.28], handB: [0.06, -0.27], shF: [-0.14, -0.6], shB: [0.14, -0.6],
      sh: [0, -0.7], neck: [0, -0.61], head: [-0.01, -0.5],
      hip: [0.05, -0.99], kneeF: [0.04, -1.34], kneeB: [0.14, -1.3], footF: [-0.34, -1.26], footB: [-0.24, -1.2],
    },
    idle: [
      [['handF', 'handB', 'shF', 'shB', 'sh', 'neck', 'head', 'hip', 'kneeF', 'kneeB', 'footF', 'footB'], 0, -0.03, 0.6, 0],
      [['hip'], 0.015, 0, 0.5, 0],
      [['kneeF', 'kneeB'], 0.03, 0, 0.5, 0],
      [['footF', 'footB'], 0.05, 0, 0.5, 0],
    ],
    bones: [['shF', 'handF'], ['shB', 'handB'], ['sh', 'shF'], ['sh', 'shB'], ['sh', 'neck'], ['sh', 'hip'],
      ['hip', 'kneeF'], ['kneeF', 'footF'], ['hip', 'kneeB'], ['kneeB', 'footB']],
    heads: [['head', 0.1]],
    core: ['sh', 'hip'],
    limbs: [{ bones: [6, 7], root: 'hip', angle: -2.3 }, { bones: [8, 9], root: 'hip', angle: -1.2 }],
    shadow: 0.14, shadowLevel: 0.45,
  },
  // Crawler: on all fours, hands and feet lifting in turn.
  crawler: {
    rest: {
      handF: [-0.4, 0], elbowF: [-0.47, -0.2], handB: [-0.3, 0], elbowB: [-0.38, -0.2],
      sh: [-0.28, -0.32], neck: [-0.36, -0.34], head: [-0.48, -0.33], hip: [0.16, -0.36],
      kneeF: [0.26, -0.52], footF: [0.34, 0], kneeB: [0.2, -0.5], footB: [0.28, 0],
    },
    tell: {
      handF: [-0.62, -0.5], elbowF: [-0.44, -0.6], handB: [-0.3, 0], elbowB: [-0.34, -0.25],
      sh: [-0.22, -0.5], neck: [-0.3, -0.58], head: [-0.4, -0.64], hip: [0.16, -0.38],
      kneeF: [0.26, -0.52], footF: [0.34, 0], kneeB: [0.2, -0.5], footB: [0.28, 0],
    },
    idle: [
      [['handF'], 0, -0.035, 0.8, 0, 'lift'],
      [['footF'], 0, -0.035, 0.8, 1.6, 'lift'],
      [['handB'], 0, -0.035, 0.8, 3.2, 'lift'],
      [['footB'], 0, -0.035, 0.8, 4.8, 'lift'],
      [['sh', 'neck', 'head'], 0, 0.01, 0.8, 0],
    ],
    bones: [['sh', 'elbowF'], ['elbowF', 'handF'], ['sh', 'elbowB'], ['elbowB', 'handB'], ['sh', 'hip'], ['hip', 'kneeF'],
      ['kneeF', 'footF'], ['hip', 'kneeB'], ['kneeB', 'footB'], ['sh', 'neck']],
    heads: [['head', 0.1]],
    core: ['sh', 'hip'],
    limbs: [{ bones: [0, 1], root: 'sh', angle: 2.6 }, { bones: [2, 3], root: 'sh', angle: 2.0 }],
    shadow: 0.42,
  },
  // Squat: crouched low, rocking.
  squat: {
    rest: {
      footF: [-0.12, 0], footB: [0.16, 0], kneeF: [-0.27, -0.3], kneeB: [0.31, -0.28], hip: [0.02, -0.22],
      sh: [-0.06, -0.48], neck: [-0.08, -0.52], head: [-0.13, -0.63],
      elbowF: [-0.13, -0.26], handF: [-0.08, -0.03], elbowB: [0.02, -0.26], handB: [0.05, -0.03],
    },
    tell: {
      footF: [-0.12, 0], footB: [0.16, 0], kneeF: [-0.3, -0.24], kneeB: [0.26, -0.24], hip: [-0.02, -0.16],
      sh: [-0.18, -0.42], neck: [-0.22, -0.45], head: [-0.3, -0.53],
      elbowF: [-0.3, -0.3], handF: [-0.36, -0.03], elbowB: [-0.14, -0.28], handB: [-0.22, -0.03],
    },
    idle: [
      [['hip', 'sh', 'neck', 'head'], 0.03, 0, 0.6, 0],
      [['elbowF', 'elbowB'], 0.015, 0, 0.6, 0],
    ],
    bones: [['footF', 'kneeF'], ['kneeF', 'hip'], ['footB', 'kneeB'], ['kneeB', 'hip'], ['hip', 'sh'], ['sh', 'neck'],
      ['sh', 'elbowF'], ['elbowF', 'handF'], ['sh', 'elbowB'], ['elbowB', 'handB']],
    heads: [['head', 0.12]],
    core: ['hip', 'sh'],
    limbs: [{ bones: [6, 7], root: 'sh', angle: 2.7 }, { bones: [8, 9], root: 'sh', angle: 2.1 }],
    shadow: 0.3,
  },
  // Bridge: bent over backwards on hands and feet.
  bridge: {
    rest: {
      handF: [-0.34, 0], elbowF: [-0.42, -0.18], handB: [-0.26, 0], elbowB: [-0.33, -0.17],
      sh: [-0.24, -0.36], neck: [-0.32, -0.32], head: [-0.38, -0.22], hip: [0.14, -0.4],
      kneeF: [0.34, -0.36], footF: [0.36, 0], kneeB: [0.28, -0.34], footB: [0.3, 0],
    },
    tell: {
      handF: [-0.34, 0], elbowF: [-0.42, -0.2], handB: [-0.26, 0], elbowB: [-0.33, -0.2],
      sh: [-0.2, -0.44], neck: [-0.32, -0.42], head: [-0.46, -0.4], hip: [0.16, -0.52],
      kneeF: [0.36, -0.4], footF: [0.36, 0], kneeB: [0.3, -0.38], footB: [0.3, 0],
    },
    idle: [
      [['sh', 'neck', 'head', 'hip'], 0, -0.015, 0.7, 0],
    ],
    bones: [['sh', 'elbowF'], ['elbowF', 'handF'], ['sh', 'elbowB'], ['elbowB', 'handB'], ['sh', 'hip'], ['hip', 'kneeF'],
      ['kneeF', 'footF'], ['hip', 'kneeB'], ['kneeB', 'footB'], ['sh', 'neck']],
    heads: [['head', 0.1]],
    core: ['sh', 'hip'],
    limbs: [{ bones: [0, 1], root: 'sh', angle: 2.4 }, { bones: [2, 3], root: 'sh', angle: 1.9 }],
    shadow: 0.42,
  },
  // Hunched: bent far forward, arms hanging to the floor.
  hunched: {
    rest: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [0, -0.46], sh: [-0.3, -0.52], neck: [-0.36, -0.5],
      head: [-0.42, -0.38], handF: [-0.34, -0.04], handB: [-0.25, -0.05],
    },
    tell: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [0, -0.47], sh: [-0.3, -0.55], neck: [-0.38, -0.56],
      head: [-0.5, -0.6], handF: [-0.62, -0.32], handB: [-0.3, -0.08],
    },
    idle: [
      [['handF'], 0.04, 0, 0.45, 0],
      [['handB'], -0.024, 0, 0.45, 0],
    ],
    bones: [['footF', 'hip'], ['footB', 'hip'], ['hip', 'sh'], ['sh', 'neck'], ['sh', 'handF'], ['sh', 'handB']],
    heads: [['head', 0.12]],
    core: ['hip', 'sh'],
    limbs: [{ bones: [4], root: 'sh', angle: 2.5 }, { bones: [5], root: 'sh', angle: 1.8 }],
    shadow: 0.3,
  },
  // Twin: one pair of legs, two bodies from the waist up.
  twin: {
    rest: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [0, -0.45], fork: [0, -0.6],
      shA: [-0.12, -0.8], neckA: [-0.14, -0.84], headA: [-0.19, -0.96], handA: [-0.28, -0.5],
      shB: [0.12, -0.78], neckB: [0.15, -0.82], headB: [0.21, -0.94], handB: [0.3, -0.48],
    },
    tell: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [0, -0.45], fork: [-0.02, -0.6],
      shA: [-0.24, -0.74], neckA: [-0.27, -0.78], headA: [-0.37, -0.86], handA: [-0.52, -0.62],
      shB: [-0.02, -0.8], neckB: [-0.04, -0.85], headB: [-0.09, -0.97], handB: [-0.28, -0.6],
    },
    idle: [
      [['shA', 'neckA', 'headA', 'handA'], 0, -0.015, 0.7, 0],
      [['shB', 'neckB', 'headB', 'handB'], 0, -0.015, 0.7, 2.2],
    ],
    bones: [['footF', 'hip'], ['footB', 'hip'], ['hip', 'fork'], ['fork', 'shA'], ['fork', 'shB'], ['shA', 'neckA'],
      ['shB', 'neckB'], ['shA', 'handA'], ['shB', 'handB']],
    heads: [['headA', 0.1], ['headB', 0.1]],
    core: ['hip', 'fork'],
    limbs: [{ bones: [7], root: 'shA', angle: 2.6 }, { bones: [8], root: 'shB', angle: -0.6 }],
    shadow: 0.2,
  },
  // Standing: plain, like the player, breathing; its tell leans in and reaches.
  standing: {
    rest: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [0, -0.45], sh: [0, -0.72], neck: [0, -0.78],
      head: [0, -0.92], handF: [-0.16, -0.42], handB: [0.16, -0.42],
    },
    tell: {
      footF: [-0.1, 0], footB: [0.1, 0], hip: [-0.02, -0.45], sh: [-0.11, -0.7], neck: [-0.13, -0.75],
      head: [-0.19, -0.88], handF: [-0.42, -0.62], handB: [0.06, -0.44],
    },
    idle: [
      [['sh', 'neck', 'head'], 0, -0.011, 0.5, 0],
      [['handF'], -0.012, 0, 0.5, 0],
      [['handB'], 0.012, 0, 0.5, 0],
    ],
    bones: [['footF', 'hip'], ['footB', 'hip'], ['hip', 'sh'], ['sh', 'neck'], ['sh', 'handF'], ['sh', 'handB']],
    heads: [['head', 0.12]],
    core: ['hip', 'sh'],
    limbs: [{ bones: [4], root: 'sh', angle: 2.5 }, { bones: [5], root: 'sh', angle: 0.6 }],
    shadow: 0.2,
  },
};
export const STICK_POSE_IDS = Object.keys(STICK_POSES);
// The tendril styles (Timothy liked all three): from the wound (the
// pose's core), from the head (which opens), or unravel (its lines turn
// to letters and peel off from their hip end).
export const TENDRIL_STYLES = ['wound', 'head', 'unravel'];

// Each pose's box round every joint it can reach, at rest (with its idle
// movement at full stretch) and in its tell: [left, top, right, bottom].
// Worked out once, so the walls cut in front of a minion never move as it moves.
const POSE_BOXES = Object.fromEntries(STICK_POSE_IDS.map(id => [id, reachOf(STICK_POSES[id])]));

// Each minion's view-only moments: minion -> { seed, pose, style, hitAt,
// hits, limbsLost, deadAt, tellOn, tellFrom, tellAt, face, faceFrom, faceAt }.
const moments = new WeakMap();
let seedCount = 0;
// Killed minions still fading: [{ minion, floor }].
let dying = [];
// The font last set for a tendril letter, so it is set only when the size changes.
let font = '';
// Tendril letters by seed and count, and the set's words they come from,
// worked out again only when another set is loaded.
let tendrilSource = null;
let tendrilWords = [];
let tendrilCache = new Map();

// Draws `minion` as its stick man standing on (x, y), the middle of its tile
// in canvas pixels, with its tendrils. `view` is { tw, height, lineWidth,
// toward, now, still, line, aiming }: a tile's width, the player's stick
// man height in pixels, its line width, the player's place on screen (the
// pose leans toward it, tendrils reach for it), the frame time, reduced
// motion, line(path, level) to stroke a path in the enemies' light at
// strength `level`, and whether a landed shot on it waits for the damage
// bar (the weak point limb brightens). Returns the weak point's place as
// [x, y], or null.
export function drawStickForm(ctx, minion, x, y, view) {
  const fx = momentsOf(minion);
  const pose = STICK_POSES[poseOf(minion)];
  const { now, still, tw } = view;
  const dying = fx.deadAt === null ? 0 : Math.min(1, (now - fx.deadAt) / MAP_ANIMATION_MS.stickDeath);
  if (dying >= 1) return null;
  const h = view.height * sizeOf(minion);
  const face = facing(fx, view.toward[0] < x ? 1 : -1, now, still);
  const tellK = telling(fx, minion, now, still);
  const hitAge = now - fx.hitAt;
  const hitK = !still && hitAge < MAP_ANIMATION_MS.stickHit ? 1 - hitAge / MAP_ANIMATION_MS.stickHit : 0;
  const push = -face * Math.sin(Math.PI * hitK) * HIT_PUSH * h;
  const t = still ? 0 : now / 1000 + fx.seed;
  const rest = restAt(pose, t);
  const J = {};
  for (const k of Object.keys(rest)) {
    J[k] = [
      x + push + face * lerp(rest[k][0], pose.tell[k][0], tellK) * h,
      y + lerp(rest[k][1], pose.tell[k][1], tellK) * h,
    ];
  }
  const m = { now, still, t, tellK, dying, tw, side: face < 0 ? -1 : 1, toward: view.toward };
  const style = styleOf(minion);
  const unravel = style === 'unravel' ? unravelled(fx, pose, minion, m) : null;
  const head = headTop(pose, J, h);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, h * pose.shadow * SHADOW_SIZE[0], h * pose.shadow * SHADOW_SIZE[1], 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, ' + (pose.shadowLevel || SHADOW_LEVEL) * (1 - dying) + ')';
  ctx.fill();
  ctx.restore();

  // The bones, grouped by strength so each group is one stroke. A lost
  // limb's bones are gone (unravelled into letters in that style); the
  // weak point limb brightens slowly while a landed shot waits on it; a
  // line fades as it unravels.
  const level = (1 - dying) * (REST_LEVEL + HIT_BRIGHTEN * hitK);
  const weak = view.aiming ? weakLimb(minion) : -1;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / WEAK_PULSE_MS);
  const groups = new Map();
  pose.bones.forEach((bone, i) => {
    const limb = pose.limbs.findIndex(l => l.bones.includes(i));
    if (limb >= 0 && !hasLimb(minion, limb) && !unravel) return;
    let a = level * (limb >= 0 && limb === weak ? 1 + WEAK_PULSE * pulse : 1);
    if (unravel) a *= 1 - ease(unravel[i] * 3);
    a = Math.round(Math.min(1, a) * 100) / 100;
    if (a <= 0) return;
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(bone);
  });
  groups.forEach((bones, a) => view.line(() => {
    ctx.beginPath();
    bones.forEach(([p, q]) => {
      ctx.moveTo(J[p][0], J[p][1]);
      ctx.lineTo(J[q][0], J[q][1]);
    });
  }, a));
  // The heads. In the head style the first one opens where its tendrils come out.
  const open = style === 'head' ? headOpen(fx, m) * HEAD_GAP : 0;
  view.line(() => {
    ctx.beginPath();
    pose.heads.forEach(([c, r], i) => {
      const gap = i === 0 ? open : 0;
      const start = (i === 0 ? head.angle : 0) + gap;
      ctx.moveTo(J[c][0] + Math.cos(start) * r * h, J[c][1] + Math.sin(start) * r * h);
      ctx.arc(J[c][0], J[c][1], r * h, start, start + Math.PI * 2 - gap * 2);
    });
  }, level);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font = '';
  if (unravel) {
    drawUnravel(ctx, pose, J, unravel, fx, m);
  } else {
    drawHitTendrils(ctx, style === 'wound' ? coreOf(pose, J) : head.at, style, fx, m, head.angle);
    drawLimbTendrils(ctx, pose, J, fx, m);
    drawDeathTendrils(ctx, style === 'wound' ? coreOf(pose, J) : head.at, fx, m);
  }
  ctx.restore();
  if (weak < 0 || dying) return null;
  const [p, q] = pose.bones[pose.limbs[weak].bones[0]];
  return [lerp(J[p][0], J[q][0], 0.5), lerp(J[p][1], J[q][1], 0.5)];
}

// The box round `minion`'s stick man standing on (x, y), as [left, top,
// right, bottom] in pixels, for brackets, taps and the walls cut in front
// of it. From its pose's fixed reach, never from where it last drew, so
// the walls in front of it don't move as it moves. Wide enough for the pose
// either way round, since it turns to face the player. Tendrils reach past it.
export function stickBox(minion, x, y, height) {
  const h = height * sizeOf(minion);
  const [left, top, right] = POSE_BOXES[poseOf(minion)];
  const half = Math.max(-left, right) + BOX_MARGIN;
  return [x - half * h, y + (top - BOX_MARGIN) * h, x + half * h, y];
}

// Notes that `minion` was hurt for `damage`: a soft brightening, one small
// push, and a hit's tendrils. A hit that does damage leaves one of them
// out for good (Timothy's call: from the first damaging hit on); a graze
// (0 damage) pulls them all back.
export function hurtStick(minion, damage) {
  const fx = momentsOf(minion);
  fx.hitAt = performance.now();
  fx.hits.push({ at: fx.hitAt, stays: damage > 0 });
}

// Notes that `minion` just lost a limb (its limbs field has already gone
// down: limb 0 goes first). Its bones are gone, and a tendril grows where
// it was and stays (in the unravel style, the limb itself unravels).
export function loseStickLimb(minion) {
  momentsOf(minion).limbsLost.push({ at: performance.now(), limb: minion.limbs === 1 ? 0 : 1 });
}

// Notes that `minion` was killed. The rules have taken it off the floor,
// so it is kept here while its lines fade. Under reduced motion (`still`)
// it is simply gone.
export function killStick(minion, still) {
  if (still || !minion.minionKind) return;
  momentsOf(minion).deadAt = performance.now();
  dying.push({ minion, floor: state.run.floorsEntered });
}

// The killed minions still fading on this floor, for isoview.js to draw
// where they died.
export function dyingSticks(now) {
  dying = dying.filter(d => d.floor === state.run.floorsEntered && now - momentsOf(d.minion).deadAt < MAP_ANIMATION_MS.stickDeath);
  return dying.map(d => d.minion);
}

// The tendril style `minion` uses: DEV -> Tendrils' forced style, else the
// one it picked the first time it was drawn ("pure random for now", not
// tied to its kind).
function styleOf(minion) {
  const forced = state.settings.enemyTendrils;
  return TENDRIL_STYLES.includes(forced) ? forced : momentsOf(minion).style;
}

// The pose `minion` shows: DEV -> Look's forced pose, else the one it
// picked the first time it was drawn.
function poseOf(minion) {
  const forced = state.settings.enemyPose;
  return STICK_POSES[forced] ? forced : momentsOf(minion).pose;
}

// A minion's moments, made the first time it is drawn. Its seed picks its
// pose and tendril style and sets where it is in its idle movement, so two of a pose don't
// move in step (counted, never Math.random: the seeded tests own it).
function momentsOf(minion) {
  let fx = moments.get(minion);
  if (!fx) {
    const n = seedCount++;
    fx = {
      seed: (n * 37.3) % 100,
      pose: STICK_POSE_IDS[Math.floor(hash(n) * STICK_POSE_IDS.length)],
      style: TENDRIL_STYLES[Math.floor(hash(n * 7.3 + 11) * TENDRIL_STYLES.length)],
      hitAt: -1e9, hits: [], limbsLost: [], deadAt: null,
      tellOn: false, tellFrom: 0, tellAt: -1e9,
      face: null, faceFrom: 0, faceAt: -1e9,
    };
    moments.set(minion, fx);
  }
  return fx;
}

// How far into its tell pose `minion` is (0..1). The tell shows within
// FORM_TELL_STEPS of the player (one more step and it is next to them),
// easing in and back out over MAP_ANIMATION_MS.stickTell from wherever it
// was; held still under reduced motion.
function telling(fx, minion, now, still) {
  const steps = stepsAway(minion.row, minion.col);
  const on = fx.deadAt === null && steps <= FORM_TELL_STEPS;
  if (on !== fx.tellOn) {
    fx.tellFrom = eased(fx.tellFrom, fx.tellOn ? 1 : 0, now - fx.tellAt, MAP_ANIMATION_MS.stickTell);
    fx.tellOn = on;
    fx.tellAt = now;
  }
  if (still) return on ? 1 : 0;
  return eased(fx.tellFrom, on ? 1 : 0, now - fx.tellAt, MAP_ANIMATION_MS.stickTell);
}

// Which way it faces across the screen (1: toward screen left, -1: right),
// turning slowly to `side`, the player's side, over MAP_ANIMATION_MS.stickTurn.
function facing(fx, side, now, still) {
  if (fx.face === null) {
    fx.face = side;
    fx.faceFrom = side;
  }
  if (side !== fx.face) {
    fx.faceFrom = eased(fx.faceFrom, fx.face, now - fx.faceAt, MAP_ANIMATION_MS.stickTurn);
    fx.face = side;
    fx.faceAt = now;
  }
  if (still) return side;
  return eased(fx.faceFrom, side, now - fx.faceAt, MAP_ANIMATION_MS.stickTurn);
}

// ---- Tendrils ----

// Draws a hit's tendrils from `from` (the wound or the head's top): three
// per hit, staggered. From the wound two reach for the player and one curls
// away; from the head all three fan out of its top (`up`, the way it
// faces). A hit that stays leaves its first one out.
function drawHitTendrils(ctx, from, style, fx, m, up) {
  const toYou = angleTo(from, m.toward);
  fx.hits.forEach((hit, k) => {
    const n = fx.seed * 100 + k * 10;
    [0, 1, 2].forEach(j => {
      const out = reach(m, hit.at + j * STAGGER_MS[style], hit.stays && j === 0) * (1 - m.dying);
      if (style === 'wound') {
        const angle = j < 2 ? toYou + WOUND_FAN[j] : mirror(WOUND_AWAY + (hash(n) - 0.5) * 0.8, m.side);
        drawTendril(ctx, from, angle + (hash(n * 3 + j) - 0.5) * 0.4, WOUND_REACH[j], out, n + j, m, toYou, j < 2 ? PULL.reach : 0);
      } else {
        const angle = up + (j - 1) * HEAD_FAN + (hash(n * 5 + j) - 0.5) * 0.3;
        drawTendril(ctx, from, angle, HEAD_REACH[0] + HEAD_REACH[1] * hash(n + j), out, n + 300 + j, m, toYou, PULL.head);
      }
    });
  });
}

// Draws a tendril from where each lost limb grew. It grows and stays.
function drawLimbTendrils(ctx, pose, J, fx, m) {
  fx.limbsLost.forEach(lost => {
    const limb = pose.limbs[lost.limb];
    const from = J[limb.root];
    const out = reach(m, lost.at, true) * (1 - m.dying);
    drawTendril(ctx, from, mirror(limb.angle, m.side), LIMB_REACH, out, fx.seed * 100 + 70 + lost.limb, m, angleTo(from, m.toward), PULL.limb);
  });
}

// A kill's six tendrils from `from`, all round its top: they grow, go limp
// and fade with the lines.
function drawDeathTendrils(ctx, from, fx, m) {
  if (!m.dying) return;
  const out = ease(m.dying * 2.2);
  const fade = 1 - ease((m.dying - 0.55) / 0.45);
  const limp = ease((m.dying - 0.4) / 0.6);
  const toYou = angleTo(from, m.toward);
  for (let i = 0; i < DEATH_TENDRILS; i++) {
    const angle = -Math.PI / 2 + (i - (DEATH_TENDRILS - 1) / 2) * DEATH_FAN;
    drawTendril(ctx, from, angle, DEATH_REACH[0] + DEATH_REACH[1] * hash(i + 90), out, fx.seed * 100 + 90 + i, m, toYou, 0, { limp, alpha: fade });
  }
}

// How far each of the pose's bones is unravelled (0..1), by bone. Each
// hit unravels the next of its body's bones (not its limbs) in turn; a
// lost limb's bones unravel and stay; a kill unravels everything.
function unravelled(fx, pose, minion, m) {
  const u = pose.bones.map(() => 0);
  const body = pose.bones.map((bone, i) => i).filter(i => !pose.limbs.some(l => l.bones.includes(i)));
  fx.hits.forEach((hit, k) => {
    const i = body[k % body.length];
    u[i] = Math.max(u[i], reach(m, hit.at, hit.stays));
  });
  pose.limbs.forEach((limb, l) => {
    if (hasLimb(minion, l)) return;
    const lost = fx.limbsLost.find(x => x.limb === l);
    const k = lost ? reach(m, lost.at, true) : 1;
    limb.bones.forEach(i => { u[i] = Math.max(u[i], k); });
  });
  if (m.dying) u.forEach((k, i) => { u[i] = Math.max(k, ease(m.dying * 2.2)); });
  return u;
}

// The unravel style: each unravelling bone's line turns into letters,
// which peel off from its far end, leaving the end nearest the hip last,
// into a tendril from that end leaning toward the player; the extra
// letters grow out past the line's end.
function drawUnravel(ctx, pose, J, u, fx, m) {
  const fadeOut = m.dying ? ease((m.dying - 0.55) / 0.45) : 0;
  pose.bones.forEach((bone, i) => {
    if (u[i] <= 0.001) return;
    const [p, q] = hipEnd(pose, bone).map(k => J[k]);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n0 = Math.max(3, Math.round(len / (UNRAVEL_SPACING * m.tw)));
    const n = Math.round(n0 * UNRAVEL_LONGER);
    const seed = fx.seed * 100 + 50 + i;
    const letters = tendrilLetters(seed, n);
    const away = angleTo(p, q) + (i % 2 ? UNRAVEL_AWAY : -UNRAVEL_AWAY) * m.side;
    const curve = tendrilPath(p, away, n, seed, m, angleTo(p, m.toward), PULL.unravel + PULL.tell * m.tellK, 0);
    const peel = ease((u[i] - 0.25) / 0.75);
    const appear = ease(u[i] * 3) * (1 - fadeOut);
    for (let k = 0; k < n; k++) {
      const along = Math.min(1, (k + 0.5) / n0);
      const lx = p[0] + (q[0] - p[0]) * along;
      const ly = p[1] + (q[1] - p[1]) * along;
      // Letters near the hip end peel last, so it comes away from the tip first.
      const pk = ease(peel * 1.6 - (1 - along) * 0.6);
      const s = k / n;
      const alpha = appear * (0.95 - 0.5 * s * pk) * (k >= n0 ? pk : 1);
      drawLetter(ctx, letters[k], lerp(lx, curve[k][0], pk), lerp(ly, curve[k][1], pk), TENDRIL_SIZE * m.tw * (1 - SHRINK * s * pk), alpha);
    }
  });
}

// Draws a tendril from `from`, heading `angle`, `length` tile widths long
// when grown, `out` (0..1) of the way grown. Letters show from the root
// outward, so growing and pulling back add and take away letters at the
// tip; none slide along it. `o` may give `limp` (0..1, it sags) and `alpha`.
function drawTendril(ctx, from, angle, length, out, seed, m, toYou, pull, o = {}) {
  if (out <= 0.001) return;
  const count = Math.max(2, Math.round(length / TENDRIL_STEP));
  const shown = count * Math.min(1, out);
  const letters = tendrilLetters(seed, count);
  const points = tendrilPath(from, angle, Math.ceil(shown), seed, m, toYou, pull + PULL.tell * m.tellK, o.limp || 0);
  points.forEach(([x, y], i) => {
    const tip = Math.min(1, shown - i);
    const alpha = (o.alpha === undefined ? 1 : o.alpha) * (0.95 - 0.55 * (i / count)) * tip;
    drawLetter(ctx, letters[i], x, y, TENDRIL_SIZE * m.tw * (1 - SHRINK * (i / count)), alpha);
  });
}

// The places along a tendril from `from`, heading `angle`, `count` letters
// long: it sways slowly, curls one way, leans toward the player (`toYou`)
// by `pull`, and sags downward as it goes `limp` (0..1).
function tendrilPath(from, angle, count, seed, m, toYou, pull, limp) {
  const points = [];
  let [x, y] = from;
  let a = angle;
  const curl = (hash(seed * 2.3) - 0.5) * 0.14;
  for (let i = 0; i < count; i++) {
    const s = i / Math.max(1, count - 1);
    const step = TENDRIL_STEP * m.tw * (1 - 0.35 * s);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    points.push([x, y]);
    let turn = curl + 0.07 * Math.sin(m.t * 0.5 + i * 0.45 + seed * 7);
    if (pull) turn += Math.atan2(Math.sin(toYou - a), Math.cos(toYou - a)) * 0.08 * pull;
    if (limp) turn += Math.atan2(Math.sin(Math.PI / 2 - a), Math.cos(Math.PI / 2 - a)) * 0.12 * limp;
    a += turn;
  }
  return points;
}

// Draws one tendril letter on a black backing, in the enemies' core blue,
// drawn backwards when it is a mirrored one.
function drawLetter(ctx, letter, x, y, size, alpha) {
  if (alpha <= 0.01) return;
  const px = Math.max(MIN_LETTER_PX, Math.round(size));
  const want = px + 'px VT323, monospace';
  if (want !== font) {
    font = want;
    ctx.font = want;
  }
  ctx.fillStyle = 'rgba(0, 0, 0, ' + LETTER_BACKING * Math.min(1, alpha * 1.5) + ')';
  ctx.fillRect(x - px * 0.32, y - px * 0.48, px * 0.64, px * 0.96);
  if (letter.ch === ' ') return;
  ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', ' + alpha + ')';
  if (!letter.mirror) return ctx.fillText(letter.ch, x, y);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  ctx.fillText(letter.ch, 0, 0);
  ctx.restore();
}

// How far out a tendril born at `at` is (0..1): it grows, holds, then
// pulls back, unless it `stays`. Under reduced motion nothing grows: a
// tendril that stays shows at full length, held still, and the rest never show.
function reach(m, at, stays) {
  if (m.still) return stays ? 1 : 0;
  const u = m.now - at;
  if (u < 0) return 0;
  if (u < TENDRIL_GROW_MS) return ease(u / TENDRIL_GROW_MS);
  if (stays || u < TENDRIL_GROW_MS + TENDRIL_HOLD_MS) return 1;
  return 1 - ease((u - TENDRIL_GROW_MS - TENDRIL_HOLD_MS) / TENDRIL_BACK_MS);
}

// How far the head is open (0..1): as far as its furthest-out tendril.
function headOpen(fx, m) {
  let open = 0;
  fx.hits.forEach(hit => {
    [0, 1, 2].forEach(j => { open = Math.max(open, reach(m, hit.at + j * STAGGER_MS.head, hit.stays && j === 0)); });
  });
  if (m.dying) open = Math.max(open, ease(m.dying * 2.2));
  return open * (1 - m.dying);
}

// The top of the pose's first head (the side away from its neck, the
// joint nearest it), and the way it faces, for the head style.
function headTop(pose, J, h) {
  const [c, r] = pose.heads[0];
  const neck = Object.keys(pose.rest).filter(k => k !== c)
    .reduce((best, k) => (dist(pose.rest[k], pose.rest[c]) < dist(pose.rest[best], pose.rest[c]) ? k : best));
  const angle = angleTo(J[neck], J[c]);
  return { at: [J[c][0] + Math.cos(angle) * r * h, J[c][1] + Math.sin(angle) * r * h], angle };
}

// The middle of the pose's core, where the wound style's tendrils grow.
function coreOf(pose, J) {
  const [a, b] = pose.core;
  return [lerp(J[a][0], J[b][0], 0.5), lerp(J[a][1], J[b][1], 0.5)];
}

// A bone's two joints, the one nearer the hip first (at rest).
function hipEnd(pose, [a, b]) {
  const hip = pose.rest.hip || [0, 0];
  return dist(pose.rest[a], hip) <= dist(pose.rest[b], hip) ? [a, b] : [b, a];
}

// ---- Tendril letters ----

// `word` with one of its letters A-Z wrong (picked by `seed`): a lookalike
// from TENDRIL_LOOKALIKES, or, for a letter in TENDRIL_MIRRORABLE half the
// time, itself drawn backwards. Spaces, digits and marks are left alone,
// and a word with no letters comes back unchanged. Returns [{ ch, mirror }].
export function almostWord(word, seed) {
  const chars = [...word];
  const spots = chars.map((c, i) => (/[A-Z]/.test(c) ? i : -1)).filter(i => i >= 0);
  const bad = spots.length ? spots[Math.floor(hash(seed * 3.1) * spots.length)] : -1;
  const mirrored = bad >= 0 && TENDRIL_MIRRORABLE.includes(chars[bad]) && hash(seed * 1.7) < 0.5;
  return chars.map((c, i) => {
    if (i !== bad) return { ch: c };
    return mirrored ? { ch: c, mirror: true } : { ch: TENDRIL_LOOKALIKES[c] || c };
  });
}

// `count` tendril letters for `seed`: the loaded set's answers a word at a
// time, from a place the seed picks, each with one letter wrong, a space
// after each. The same seed always gives the same letters, so a tendril's
// letters never change as it grows.
export function tendrilLetters(seed, count) {
  const pool = letterPool();
  if (pool !== tendrilSource) {
    tendrilSource = pool;
    tendrilWords = pool.split(' ').filter(Boolean);
    tendrilCache = new Map();
  }
  const key = seed + ':' + count;
  if (tendrilCache.has(key)) return tendrilCache.get(key);
  const out = [];
  let w = Math.floor(hash(seed) * tendrilWords.length);
  while (out.length < count) {
    const word = tendrilWords[w % tendrilWords.length];
    w++;
    out.push(...almostWord(word, w + seed), { ch: ' ' });
  }
  const letters = out.slice(0, count);
  tendrilCache.set(key, letters);
  return letters;
}

// ---- Small helpers ----

// An angle as it points once the pose is mirrored to face screen right
// (`side` -1); unchanged facing left (1), the way the poses are drawn.
function mirror(angle, side) {
  return side === 1 ? angle : Math.PI - angle;
}

// The angle from point `from` to point `to`.
function angleTo(from, to) {
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

// The distance between two points.
function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Its rest joints at idle time `t`, each moved by the pose's idle entries.
function restAt(pose, t) {
  const J = {};
  for (const [k, [jx, jy]] of Object.entries(pose.rest)) J[k] = [jx, jy];
  pose.idle.forEach(([joints, dx, dy, speed, phase, lift]) => {
    const wave = Math.sin(t * speed + phase);
    const k = lift ? Math.max(0, wave) : wave;
    joints.forEach(j => {
      J[j][0] += dx * k;
      J[j][1] += dy * k;
    });
  });
  return J;
}

// A pose's reach for POSE_BOXES: the box round its joints at rest (pushed
// both ways by its idle movement) and in its tell, heads included.
function reachOf(pose) {
  const room = {};
  pose.idle.forEach(([joints, dx, dy]) => joints.forEach(j => {
    room[j] = [(room[j] || [0, 0])[0] + Math.abs(dx), (room[j] || [0, 0])[1] + Math.abs(dy)];
  }));
  const radius = Object.fromEntries(pose.heads);
  let box = [0, 0, 0, 0];
  const take = (k, [jx, jy], [rx, ry]) => {
    const r = radius[k] || 0;
    box = [Math.min(box[0], jx - rx - r), Math.min(box[1], jy - ry - r), Math.max(box[2], jx + rx + r), Math.max(box[3], jy + ry + r)];
  };
  Object.keys(pose.rest).forEach(k => {
    take(k, pose.rest[k], room[k] || [0, 0]);
    take(k, pose.tell[k], [0, 0]);
  });
  return box;
}

// How big a minion of its kind stands, as a share of the player's height.
function sizeOf(minion) {
  return (MINION_KINDS[minion.minionKind] || {}).size || 1;
}

// Whether `minion` still has limb `i`: the weak point takes limb 0 first, then limb 1.
function hasLimb(minion, i) {
  return minion.limbs === 2 || (minion.limbs === 1 && i === 1);
}

// The limb a weak point hit would take next, or -1 with none left.
function weakLimb(minion) {
  return minion.limbs === 2 ? 0 : minion.limbs === 1 ? 1 : -1;
}

// From `from` toward `to`, `age` ms into an ease of `ms`.
function eased(from, to, age, ms) {
  return lerp(from, to, ease(age / ms));
}

// A smooth start and stop from 0 to 1.
function ease(x) {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
}

// The point `k` of the way from `a` to `b`.
function lerp(a, b, k) {
  return a + (b - a) * k;
}

// A number from 0 to 1 that always comes out the same for the same `n`.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The letters a form is made of: every answer in the loaded set, run
// together, worked out again only when another set is loaded.
let letterSource = null;
let letters = ' ';

// The letters run together from the loaded set's answers, upper case.
export function letterPool() {
  const data = state.settings.activeData;
  if (data !== letterSource) {
    letterSource = data;
    const words = (data || []).map(d => String(d.meaning || '').toUpperCase().trim()).filter(Boolean);
    letters = words.length ? words.join(' ') + ' ' : 'NOESIS ';
  }
  return letters;
}
