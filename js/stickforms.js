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
import { MAP_ANIMATION_MS, FORM_TELL_STEPS, MINION_KINDS, ENEMY_LIGHT } from './config.js';

// Sizes are shares of the stick man's height unless they say otherwise.
const HIT_PUSH = 0.08;       // a hit's one small push, away from the player
const HIT_BRIGHTEN = 0.15;   // how much brighter a hit makes its lines
const REST_LEVEL = 0.85;     // its lines' strength at rest
const WEAK_PULSE = 0.25;     // how much the weak point limb brightens while a landed shot waits
const WEAK_PULSE_MS = 750;   // that brightening's slow cycle
const SHADOW_SIZE = [1.3, 0.5]; // its shadow's ellipse, as multiples of the pose's shadow half-width
const SHADOW_LEVEL = 0.85;   // the shadow's darkness, unless the pose says otherwise
const BOX_MARGIN = 0.08;     // room round its joints in stickBox(), for heads and glow

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

// Each pose's box round every joint it can reach, at rest (with its idle
// movement at full stretch) and in its tell: [left, top, right, bottom].
// Worked out once, so the walls cut in front of a minion never move as it moves.
const POSE_BOXES = Object.fromEntries(STICK_POSE_IDS.map(id => [id, reachOf(STICK_POSES[id])]));

// Each minion's view-only moments: minion -> { seed, pose, hitAt, deadAt,
// tellOn, tellFrom, tellAt, face, faceFrom, faceAt }.
const moments = new WeakMap();
let seedCount = 0;
// Killed minions still fading: [{ minion, floor }].
let dying = [];

// Draws `minion` as its stick man standing on (x, y), the middle of its tile
// in canvas pixels. `view` is { tw, height, lineWidth, toward, now, still,
// line, aiming }: a tile's width, the player's stick man height in pixels,
// its line width, the player's place on screen (the pose leans toward it),
// the frame time, reduced motion, line(path, level) to stroke a path in the
// enemies' light at strength `level`, and whether a landed shot on it waits
// for the damage bar (the weak point limb brightens). Returns the weak
// point's place as [x, y], or null.
export function drawStickForm(ctx, minion, x, y, view) {
  const fx = momentsOf(minion);
  const pose = STICK_POSES[poseOf(minion)];
  const { now, still } = view;
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

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, h * pose.shadow * SHADOW_SIZE[0], h * pose.shadow * SHADOW_SIZE[1], 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, ' + (pose.shadowLevel || SHADOW_LEVEL) * (1 - dying) + ')';
  ctx.fill();
  ctx.restore();

  // The body (every bone that isn't a limb, and the heads), then each limb
  // it still has. A lost limb's bones are gone; the weak point limb
  // brightens slowly while a landed shot waits on it.
  const level = (1 - dying) * (REST_LEVEL + HIT_BRIGHTEN * hitK);
  const limbBones = new Set(pose.limbs.flatMap(l => l.bones));
  view.line(() => {
    ctx.beginPath();
    pose.bones.forEach(([a, b], i) => {
      if (limbBones.has(i)) return;
      ctx.moveTo(J[a][0], J[a][1]);
      ctx.lineTo(J[b][0], J[b][1]);
    });
    pose.heads.forEach(([c, r]) => {
      ctx.moveTo(J[c][0] + r * h, J[c][1]);
      ctx.arc(J[c][0], J[c][1], r * h, 0, Math.PI * 2);
    });
  }, level);
  const weak = view.aiming ? weakLimb(minion) : -1;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / WEAK_PULSE_MS);
  pose.limbs.forEach((limb, i) => {
    if (!hasLimb(minion, i)) return;
    view.line(() => {
      ctx.beginPath();
      limb.bones.forEach(b => {
        const [p, q] = pose.bones[b];
        ctx.moveTo(J[p][0], J[p][1]);
        ctx.lineTo(J[q][0], J[q][1]);
      });
    }, Math.min(1, level * (i === weak ? 1 + WEAK_PULSE * pulse : 1)));
  });
  if (weak < 0 || dying) return null;
  const [p, q] = pose.bones[pose.limbs[weak].bones[0]];
  return [lerp(J[p][0], J[q][0], 0.5), lerp(J[p][1], J[q][1], 0.5)];
}

// The box round `minion`'s stick man standing on (x, y), as [left, top,
// right, bottom] in pixels, for brackets, taps and the walls cut in front
// of it. From its pose's fixed reach, never from where it last drew, so
// the walls in front of it don't move as it moves. Wide enough for the pose
// either way round, since it turns to face the player.
export function stickBox(minion, x, y, height) {
  const h = height * sizeOf(minion);
  const [left, top, right] = POSE_BOXES[poseOf(minion)];
  const half = Math.max(-left, right) + BOX_MARGIN;
  return [x - half * h, y + (top - BOX_MARGIN) * h, x + half * h, y];
}

// Notes that `minion` was hurt: a soft brightening and one small push.
export function hurtStick(minion) {
  momentsOf(minion).hitAt = performance.now();
}

// Notes that `minion` just lost a limb (its limbs field has already gone
// down). Its bones are simply gone; step C grows a tendril where it was.
export function loseStickLimb(minion) {
  momentsOf(minion);
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

// The pose `minion` shows: DEV -> Look's forced pose, else the one it
// picked the first time it was drawn.
function poseOf(minion) {
  const forced = state.settings.enemyPose;
  return STICK_POSES[forced] ? forced : momentsOf(minion).pose;
}

// A minion's moments, made the first time it is drawn. Its seed picks its
// pose and sets where it is in its idle movement, so two of a pose don't
// move in step (counted, never Math.random: the seeded tests own it).
function momentsOf(minion) {
  let fx = moments.get(minion);
  if (!fx) {
    const n = seedCount++;
    fx = {
      seed: (n * 37.3) % 100,
      pose: STICK_POSE_IDS[Math.floor(hash(n) * STICK_POSE_IDS.length)],
      hitAt: -1e9, deadAt: null,
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
  const steps = Math.abs(minion.row - state.floor.playerRow) + Math.abs(minion.col - state.floor.playerCol);
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
