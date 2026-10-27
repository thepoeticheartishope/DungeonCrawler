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
// one small push, and a killed one's lines
// fade. With reduced motion everything holds still (the tell pose is shown
// still, so the warning isn't lost).
//
// roomview.js calls drawStickForm() for a minion it has made out, stickBox()
// for its brackets and taps, and dyingSticks() for killed ones
// still fading. mapview.js calls hurtStick() /
// killStick() from their drawEvents cases. Those moments are view-only and
// kept here, not in state. Reads state and never changes it.
//
// Downed stick men (downed plan step B, look A of the downed mockup,
// ideas/downed-crawler-mockup.html outside the repo): one the rules have
// knocked down (minion.downed) falls from its pose to DOWNED_POSE, propped
// on its arms, its legs come apart into a trail of letters behind it, and
// it crawls hand over hand (fallStick, crawlStick, grabStick, finishStick,
// via mapview.js). The letters it drops on the tiles it leaves
// (droppedLetters) fade over DOWNED_DROP_TURNS turns.

import { state } from './state.js';
import { stepsAway } from './passage.js';
import { figurePose, turnFigure, projectFigure, phiToward, moveFrames, sampleMove } from './figure3d.js';
import {
  FIGURE3D, MAP_ANIMATION_MS, FORM_TELL_STEPS, MINION_KINDS, ENEMY_LIGHT, CRAWL_REACH, DOWNED_DROP_TURNS,
  TENDRIL_GROW_MS, TENDRIL_HOLD_MS, TENDRIL_BACK_MS, TENDRIL_STEP, TENDRIL_SIZE, TENDRIL_LOOKALIKES, TENDRIL_MIRRORABLE,
} from './config.js';

// Sizes are shares of the stick man's height unless they say otherwise.
const HIT_PUSH = 0.08;       // a hit's one small push, away from the player
const HIT_BRIGHTEN = 0.15;   // how much brighter a hit makes its lines
const REST_LEVEL = 0.85;     // its lines' strength at rest
const WEAK_PULSE = 0.25;     // how much the maim point limb brightens while a landed shot waits
const MAIM_LIMB = 0;         // the limb that brightens: where a maim takes it down
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
const DEATH_REACH = [1.0, 0.4];       // a kill's six tendrils: this long, plus up to this much more
const DEATH_TENDRILS = 6;
const DEATH_FAN = 0.7;                // how far apart they spread, all round its top
const STAGGER_MS = { wound: 160, head: 200 }; // each of a hit's tendrils starts this much after the last
const PULL = { reach: 0.3, head: 0.15, unravel: 0.5, tell: 0.8 }; // how hard tendrils lean toward the player (more in its tell)
const UNRAVEL_SPACING = 0.058;        // letters along a line as it unravels, in tile widths
const UNRAVEL_LONGER = 2.5;           // peeled off, the line's tendril is this many times its letters
const UNRAVEL_AWAY = 0.8;             // a peeled line leaves this far off its own direction (sides alternate)
const SHRINK = 0.4;                   // letters get this much smaller toward a tendril's tip
const LETTER_BACKING = 0.85;          // the black behind each letter, so it reads over the floor
const MIN_LETTER_PX = 6;              // the smallest a letter is drawn

// The walker's joints, by the names its pose uses, from figure3d.js's.
const WALKER_JOINTS = {
  head: 'headMid', neck: 'neck', sh: 'chest', hip: 'pelvis',
  elbowF: 'elL', handF: 'haL', elbowB: 'elR', handB: 'haR',
  kneeF: 'knL', footF: 'ftL', kneeB: 'knR', footB: 'ftR',
};

// The poses. Joints are [x, y] as shares of the stick man's height: feet at
// y 0, up is negative, and toward the player is negative x (the pose is
// mirrored when the player is on its other side). `rest` and `tell` hold
// the same joints. `idle` moves joints slowly at rest: [joints, dx, dy,
// speed, phase], each joint moved by (dx, dy) times sin(t * speed + phase)
// (or only its upper half with `lift`, a step that lifts and sets down).
// `bones` join two joints; `heads` are [joint, radius]; `core` is the two
// joints whose middle hit tendrils will grow from (step C); `limbs` are the
// two arms or legs (the first brightens as the maim point), each its bones (indexes into `bones`), the
// joint it grows from and the angle its tendril leaves at (step C);
// `shadow` is the half-width of its shadow.
//
// The walker (one stick plan step F) is the one every stick man shows now:
// a human body moved by the 3D moves (figure3d.js), standing, walking as
// far as it goes, reaching (the reach's punch), hit and dying. Its `rest`
// and `tell` are only its stand and its reach seen from the side, worked
// out from the moves, for its box and the tendrils' anchors; drawUpright
// takes its joints from the moves each frame. The seven odd poses stay
// for DEV -> Look.
export const STICK_POSES = {
  walker: {
    rest: walkerShares(sampleMove('Idle_Loop', 0, true)),
    tell: walkerShares(sampleMove('Punch_Cross', FIGURE3D.punchPeak, false)),
    idle: [],
    bones: [['hip', 'kneeF'], ['kneeF', 'footF'], ['hip', 'kneeB'], ['kneeB', 'footB'], ['neck', 'sh'], ['sh', 'hip'],
      ['neck', 'elbowF'], ['elbowF', 'handF'], ['neck', 'elbowB'], ['elbowB', 'handB']],
    heads: [['head', 0.12]],
    core: ['sh', 'hip'],
    limbs: [{ bones: [0, 1], root: 'hip', angle: -2.3 }, { bones: [6, 7], root: 'neck', angle: -1.2 }],
    shadow: 0.12,
  },
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

// The downed pose (downed plan, look A): propped on two arms, reaching
// toward the player, its legs gone into a trail of letters from the hip.
// Joints as in STICK_POSES (toward the player is negative x); the hands'
// y sets them either side of the body on the floor.
export const DOWNED_POSE = {
  hip: [0.05, -0.07], sh: [-0.36, -0.3], neck: [-0.4, -0.33], head: [-0.52, -0.45],
  handF: [-0.62, 0.08], handB: [-0.52, -0.08],
  heads: [['head', 0.12]],
  core: ['hip', 'sh'],
};
// Where each downed joint starts its fall: the first of these the pose has
// (a twin falls from its first body), else the hip.
const FALL_FROM = { hip: ['hip', 'fork'], sh: ['sh', 'shA'], neck: ['neck', 'neckA'], head: ['head', 'headA'], handF: ['handF', 'handA'], handB: ['handB'] };
const DOWNED_JOINTS = ['hip', 'sh', 'neck', 'head', 'handF', 'handB'];
const DOWNED_ARM = 0.23;          // upper arm and forearm, for where the elbows bend
const TRAIL_LETTERS = 9;          // letters in the trail behind the hips
const TRAIL_STEP = 0.055;         // their spacing
const TRAIL_SIZE = [0.17, 0.06];  // the first letter's size, and how much smaller the last is
const TRAIL_SWAY = 0.006;         // how far each letter sways, times its place in the trail
const CRAWL_PUSH = 0.7;           // share of a crawl when the trailing hand lifts to catch up
const CRAWL_CATCH = 0.8;          // share of a crawl when the leading hand moves on with the body
const CRAWL_LIFT = [0.1, 0.06, 0.08]; // how high a hand lifts: reaching, moving on, catching up
const CRAWL_SAG = 0.035;          // how far the body sinks as it drags itself up
const FINISH_SPACING = 0.11;      // letters along a line as a finished one comes apart
const FINISH_SIZE = 0.15;
const FINISH_SINK = 0.12;         // how far they settle toward the floor
const DROP_LETTERS = 2;           // letters left on the tile a crawl leaves
const DROP_SPREAD = [0.4, 0.2];   // where on the tile, in tile widths across and down
const DROP_LEVEL = 0.55;          // how bright they start

// Each pose's box round every joint it can reach, at rest (with its idle
// movement at full stretch) and in its tell: [left, top, right, bottom].
// Worked out once, so the walls cut in front of a minion never move as it moves.
const POSE_BOXES = Object.fromEntries(STICK_POSE_IDS.map(id => [id, reachOf(STICK_POSES[id])]));
// The downed pose's box, its trail and its reach for the player included.
const DOWNED_BOX = downedReach();

// Each minion's view-only moments: minion -> { seed, pose, style, hitAt,
// hits, deadAt, tellOn, tellFrom, tellAt, face, faceFrom, faceAt }.
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
// Letters dropped by crawling stick men: [{ row, col, letters, turn, floor }].
let drops = [];
let dropCount = 0;

// Draws `minion` as its stick man standing on (x, y), the middle of its tile
// in canvas pixels, with its tendrils. `view` is { tw, height, lineWidth,
// toward, now, still, line, aiming, player, pixel }: a tile's width, the player's stick
// man height in pixels, its line width, the player's place on screen (the
// pose leans toward it, tendrils reach for it), the frame time, reduced
// motion, line(path, level) to stroke a path in the enemies' light at
// strength `level`, and whether a landed shot on it waits for the dial
// (its maim point limb brightens), and centre(row, col), a tile's
// middle on the canvas (a downed one's crawl reaches across tiles), the
// player's feet, and a room pixel's size on the canvas (the walker's
// joints sit on them). A
// downed one is drawn by drawDowned. Returns the maim point's place as
// [x, y], or null.
export function drawStickForm(ctx, minion, x, y, view) {
  const fx = momentsOf(minion);
  if (minion.downed || fx.downAt !== null) return drawDowned(ctx, minion, x, y, view);
  return drawUpright(ctx, minion, x, y, view);
}

// Draws `minion` in its own pose (drawStickForm). `fade` (0..1) dims it all,
// and `bodyOnly` leaves its tendrils out: while it falls, its pose fades
// out under the downed one taking its place.
function drawUpright(ctx, minion, x, y, view, fade = 1, bodyOnly = false) {
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
  const J = poseOf(minion) === 'walker' ? walkerNow(minion, fx, x, y, h, view, { push, tellK, hitK, dying }) : {};
  if (poseOf(minion) !== 'walker') {
    const rest = restAt(pose, t);
    for (const k of Object.keys(rest)) {
      J[k] = [
        x + push + face * lerp(rest[k][0], pose.tell[k][0], tellK) * h,
        y + lerp(rest[k][1], pose.tell[k][1], tellK) * h,
      ];
    }
  }
  const m = { now, still, t, tellK, dying, tw, side: face < 0 ? -1 : 1, toward: view.toward };
  const style = styleOf(minion);
  const unravel = style === 'unravel' ? unravelled(fx, pose, minion, m) : null;
  const head = headTop(pose, J, h);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, h * pose.shadow * SHADOW_SIZE[0], h * pose.shadow * SHADOW_SIZE[1], 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, ' + (pose.shadowLevel || SHADOW_LEVEL) * (1 - dying) * fade + ')';
  ctx.fill();
  ctx.restore();

  // The bones, grouped by strength so each group is one stroke. The maim
  // point limb brightens slowly while a landed shot waits on it; a line
  // fades as it unravels.
  const level = fade * (1 - dying) * (REST_LEVEL + HIT_BRIGHTEN * hitK);
  const weak = view.aiming ? MAIM_LIMB : -1;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / WEAK_PULSE_MS);
  const groups = new Map();
  pose.bones.forEach((bone, i) => {
    const limb = pose.limbs.findIndex(l => l.bones.includes(i));
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
  if (bodyOnly) return null;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font = '';
  if (unravel) {
    drawUnravel(ctx, pose, J, unravel, fx, m);
  } else {
    drawHitTendrils(ctx, style === 'wound' ? coreOf(pose, J) : head.at, style, fx, m, head.angle);
    drawDeathTendrils(ctx, style === 'wound' ? coreOf(pose, J) : head.at, fx, m);
  }
  ctx.restore();
  if (weak < 0 || dying) return null;
  const [p, q] = pose.bones[pose.limbs[weak].bones[0]];
  return [lerp(J[p][0], J[q][0], 0.5), lerp(J[p][1], J[q][1], 0.5)];
}

// Draws a downed `minion` on (x, y) (drawStickForm): falling from its own
// pose (MAP_ANIMATION_MS.downedFall: the pose fades out as the downed body
// takes its place from the same joints, and the trail of letters comes in),
// then propped on its arms. A crawl (crawlStick) reaches a hand half a
// tile, plants it, drags the body up, and brings the other hand after. Its
// grab (grabStick) holds its front hand on the player's foot. Its hit and
// lost limb tendrils stay as in its style (unravel grows them from the
// wound). Dying, a finished one's lines turn into letters that settle and
// fade (MAP_ANIMATION_MS.downedFinish); a shot one fades with a kill's
// tendrils. Under reduced motion it is down at once and holds still.
function drawDowned(ctx, minion, x, y, view) {
  const fx = momentsOf(minion);
  const { now, still, tw } = view;
  const finishMs = fx.finished ? MAP_ANIMATION_MS.downedFinish : MAP_ANIMATION_MS.stickDeath;
  const dying = fx.deadAt === null ? 0 : Math.min(1, (now - fx.deadAt) / finishMs);
  if (dying >= 1) return null;
  const fall = still || fx.downAt === null ? 1 : ease((now - fx.downAt) / MAP_ANIMATION_MS.downedFall);
  if (fall < 1) drawUpright(ctx, minion, x, y, view, 1 - ease(fall * 2), true);
  const h = view.height * sizeOf(minion);
  const face = facing(fx, view.toward[0] < x ? 1 : -1, now, still);
  const hitAge = now - fx.hitAt;
  const hitK = !still && hitAge < MAP_ANIMATION_MS.stickHit ? 1 - hitAge / MAP_ANIMATION_MS.stickHit : 0;
  const t = still ? 0 : now / 1000 + fx.seed;

  // The crawl, once it is down: how far through (1 when still), and how
  // hard the body is pulling (0 to 1 and back) while it drags.
  const crawl = fx.crawl && fall >= 1 && !still ? Math.min(1, (now - fx.crawl.at) / MAP_ANIMATION_MS.crawl) : 1;
  const drag = crawl < 1 ? ease((crawl - CRAWL_REACH) / (1 - CRAWL_REACH)) : 1;
  const pull = crawl < 1 ? Math.sin(Math.PI * drag) : 0;

  const from = STICK_POSES[poseOf(minion)].rest;
  const at = (jx, jy) => [x + face * jx * h, y + jy * h];
  const J = {};
  DOWNED_JOINTS.forEach(k => {
    const start = (FALL_FROM[k].map(n => from[n]).find(Boolean)) || from.hip || [0, -0.45];
    let [jx, jy] = [lerp(start[0], DOWNED_POSE[k][0], fall), lerp(start[1], DOWNED_POSE[k][1], fall)];
    if (k === 'sh' || k === 'neck' || k === 'head') {
      jx -= 0.03 * pull;
      jy += CRAWL_SAG * pull;
    }
    J[k] = at(jx, jy);
  });
  if (crawl < 1) placeCrawlHands(J, fx, x, y, crawl, view.centre);
  if (minion.grabbing && fx.grabAt !== null) {
    const k = still ? 1 : ease((now - fx.grabAt) / MAP_ANIMATION_MS.grab);
    J.handF = [lerp(J.handF[0], view.toward[0], k), lerp(J.handF[1], view.toward[1], k)];
  }
  J.elbowF = elbowOf(J.sh, J.handF, h, fall);
  J.elbowB = elbowOf(J.sh, J.handB, h, fall);

  // Its shadow: long under its body once it is down.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x - face * 0.22 * fall * h, y, h * (0.22 + 0.32 * fall), h * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, ' + SHADOW_LEVEL * (1 - dying) + ')';
  ctx.fill();
  ctx.restore();

  const glow = REST_LEVEL + HIT_BRIGHTEN * hitK;
  const lines = glow * ease(fall * 2) * (1 - ease(dying / (fx.finished ? 0.4 : 1)));
  if (lines > 0.005) {
    view.line(() => {
      ctx.beginPath();
      ctx.moveTo(J.hip[0], J.hip[1]);
      ctx.lineTo(J.neck[0], J.neck[1]);
      [['elbowF', 'handF'], ['elbowB', 'handB']].forEach(([e, hand]) => {
        ctx.moveTo(J.sh[0], J.sh[1]);
        ctx.lineTo(J[e][0], J[e][1]);
        ctx.lineTo(J[hand][0], J[hand][1]);
      });
      const r = DOWNED_POSE.heads[0][1] * h;
      ctx.moveTo(J.head[0] + r, J.head[1]);
      ctx.arc(J.head[0], J.head[1], r, 0, Math.PI * 2);
    }, lines);
  }

  const m = { now, still, t, tellK: 0, dying, tw, side: face < 0 ? -1 : 1, toward: view.toward };
  const style = styleOf(minion);
  const head = { at: J.head, angle: angleTo(J.neck, J.head) };
  head.at = [J.head[0] + Math.cos(head.angle) * DOWNED_POSE.heads[0][1] * h, J.head[1] + Math.sin(head.angle) * DOWNED_POSE.heads[0][1] * h];
  const core = coreOf(DOWNED_POSE, J);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font = '';
  // The trail: letters from the hip, lying back along the floor away from
  // the player, stretching as the body drags.
  const trail = glow * fall * (1 - ease(dying / 0.5));
  const letters = tendrilLetters(fx.seed * 100 + 20, TRAIL_LETTERS);
  const stretch = 0.35 * pull;
  for (let i = 1; i <= TRAIL_LETTERS; i++) {
    const s = i / TRAIL_LETTERS;
    const jx = DOWNED_POSE.hip[0] + i * TRAIL_STEP * (1 + stretch * s);
    const jy = DOWNED_POSE.hip[1] * Math.max(0, 1 - i / 3) + Math.sin(t * 0.7 + i * 0.6 + fx.seed) * TRAIL_SWAY * i;
    const [lx, ly] = [J.hip[0] + face * (jx - DOWNED_POSE.hip[0]) * h, J.hip[1] + (jy - DOWNED_POSE.hip[1]) * h];
    drawLetter(ctx, letters[i - 1], lx, ly, h * (TRAIL_SIZE[0] - TRAIL_SIZE[1] * s), trail * (1 - 0.6 * s));
  }
  if (fx.finished && dying > 0) {
    drawFinish(ctx, J, fx, h, dying, still);
  } else {
    drawHitTendrils(ctx, style === 'head' ? head.at : core, style === 'head' ? 'head' : 'wound', fx, m, head.angle);
    drawDeathTendrils(ctx, style === 'head' ? head.at : core, fx, m);
  }
  ctx.restore();
  if (!view.aiming || dying) return null;
  return [lerp(J.sh[0], J.elbowF[0], 0.5), lerp(J.sh[1], J.elbowF[1], 0.5)];
}

// Moves a crawling one's hands, `p` (0..1) through its crawl from tile
// fx.crawl.from to fx.crawl.to, its body at (x, y) (mapview.js holds the
// body back until the leading hand plants, CRAWL_REACH in). The leading
// hand reaches half a tile and plants, waits while the body drags up, then
// moves on with it; the trailing hand pushes off and catches up last.
function placeCrawlHands(J, fx, x, y, p, centre) {
  const [ax, ay] = centre(fx.crawl.from.row, fx.crawl.from.col);
  const [bx, by] = centre(fx.crawl.to.row, fx.crawl.to.col);
  const lead = fx.lead ? 'handB' : 'handF';
  const trail = lead === 'handF' ? 'handB' : 'handF';
  const hands = crawlHands(p, [ax, ay], [bx, by], [J[lead][0] - x, J[lead][1] - y], [J[trail][0] - x, J[trail][1] - y]);
  const h = Math.hypot(bx - ax, by - ay);
  J[lead] = [hands.lead[0], hands.lead[1] - hands.leadLift * h];
  J[trail] = [hands.trail[0], hands.trail[1] - hands.trailLift * h];
}

// Where the two hands are `p` (0..1) through a crawl from the tile middle
// `a` to `b`, each hand held at its offset from the body (`lead`, `trail`).
// Returns { lead, trail } on the floor and how high each is lifted, as a
// share of the step (`leadLift`, `trailLift`). An arm reaches only half a
// tile: reach, plant, pull, then reach again. Exported for the tests.
export function crawlHands(p, a, b, lead, trail) {
  const plant = [a[0] + lead[0] + (b[0] - a[0]) / 2, a[1] + lead[1] + (b[1] - a[1]) / 2];
  const startLead = [a[0] + lead[0], a[1] + lead[1]];
  const endLead = [b[0] + lead[0], b[1] + lead[1]];
  let leadAt = plant;
  let leadLift = 0;
  if (p < CRAWL_REACH) {
    const k = ease(p / CRAWL_REACH);
    leadAt = lerp2(startLead, plant, k);
    leadLift = Math.sin(Math.PI * p / CRAWL_REACH) * CRAWL_LIFT[0];
  } else if (p >= CRAWL_CATCH) {
    const k = ease((p - CRAWL_CATCH) / (1 - CRAWL_CATCH));
    leadAt = lerp2(plant, endLead, k);
    leadLift = Math.sin(Math.PI * k) * CRAWL_LIFT[1];
  }
  const startTrail = [a[0] + trail[0], a[1] + trail[1]];
  let trailAt = startTrail;
  let trailLift = 0;
  if (p >= CRAWL_PUSH) {
    const k = ease((p - CRAWL_PUSH) / (1 - CRAWL_PUSH));
    trailAt = lerp2(startTrail, [b[0] + trail[0], b[1] + trail[1]], k);
    trailLift = Math.sin(Math.PI * k) * CRAWL_LIFT[2];
  }
  return { lead: leadAt, trail: trailAt, leadLift, trailLift };
}

// A finished one comes apart (drawDowned): each line becomes a row of
// letters, which brighten as the lines go, then settle toward the floor
// and fade.
function drawFinish(ctx, J, fx, h, dying, still) {
  const a = dying < 0.4 ? ease(dying / 0.4) : 1 - ease((dying - 0.4) / 0.6);
  const sink = still ? 0 : ease(dying) * FINISH_SINK * h;
  const parts = [['hip', 'neck'], ['sh', 'elbowF'], ['elbowF', 'handF'], ['sh', 'elbowB'], ['elbowB', 'handB']];
  let n0 = 0;
  parts.forEach(([p, q]) => {
    const n = Math.max(2, Math.round(dist(J[p], J[q]) / (h * FINISH_SPACING)));
    const letters = tendrilLetters(fx.seed * 100 + 7 + n0, n);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      drawLetter(ctx, letters[i], lerp(J[p][0], J[q][0], k), lerp(J[p][1], J[q][1], k) + sink, h * FINISH_SIZE, a * 0.9);
    }
    n0 += n;
  });
}

// Where an arm's elbow is from shoulder `sh` to `hand`: bent up and out
// when the hand is nearer than a full arm, by `bend` (0: straight, as it
// was standing, while it falls).
function elbowOf(sh, hand, h, bend) {
  const d = dist(sh, hand);
  const arm = DOWNED_ARM * h;
  const out = d < 2 * arm ? Math.sqrt(arm * arm - (d / 2) ** 2) : 0;
  let px = -(hand[1] - sh[1]) / (d || 1);
  let py = (hand[0] - sh[0]) / (d || 1);
  if (py > 0) {
    px = -px;
    py = -py;
  }
  return [(sh[0] + hand[0]) / 2 + px * out * bend, (sh[1] + hand[1]) / 2 + py * out * bend];
}

// The letters crawling stick men dropped on this floor that still show,
// for roomview.js: [{ row, col, letters: [{ letter, dx, dy }], level }],
// dx and dy in tile widths from the tile's middle. Each fades over
// DOWNED_DROP_TURNS of the player's turns.
export function droppedLetters() {
  const turn = state.run.turnCount;
  drops = drops.filter(d => d.floor === state.run.floorsEntered && turn - d.turn < DOWNED_DROP_TURNS);
  return drops.map(d => ({ ...d, level: DROP_LEVEL * (1 - (turn - d.turn) / DOWNED_DROP_TURNS) }));
}

// Draws dropped letters (droppedLetters) on the canvas: `centre(row, col)`
// is a tile's middle, `shown(row, col)` whether its floor is lit.
export function drawDroppedLetters(ctx, tw, centre, shown) {
  const list = droppedLetters().filter(d => shown(d.row, d.col));
  if (!list.length) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font = '';
  list.forEach(d => {
    const [cx, cy] = centre(d.row, d.col);
    d.letters.forEach(({ letter, dx, dy }) => drawLetter(ctx, letter, cx + dx * tw, cy + dy * tw, TENDRIL_SIZE * tw, d.level));
  });
  ctx.restore();
}

// The box round `minion`'s stick man standing on (x, y), as [left, top,
// right, bottom] in pixels, for brackets, taps and the walls cut in front
// of it. From its pose's fixed reach, never from where it last drew, so
// the walls in front of it don't move as it moves. Wide enough for the pose
// either way round, since it turns to face the player. Tendrils reach past it.
export function stickBox(minion, x, y, height) {
  const h = height * sizeOf(minion);
  const [left, top, right] = minion.downed ? DOWNED_BOX : POSE_BOXES[poseOf(minion)];
  const half = Math.max(-left, right) + BOX_MARGIN;
  return [x - half * h, y + (top - BOX_MARGIN) * h, x + half * h, y];
}

// Notes that a shot reached `minion`: a soft brightening, one small push,
// and a hit's tendrils. A hit (`stays`: the kill or maim zone, or its
// guard) leaves one of them out for good (Timothy's call: from the first
// hit on); a miss pulls them all back.
export function hurtStick(minion, stays) {
  const fx = momentsOf(minion);
  fx.hitAt = performance.now();
  fx.hits.push({ at: fx.hitAt, stays });
}

// Notes that `minion` was killed. The rules have taken it off the floor,
// so it is kept here while its lines fade. Under reduced motion (`still`)
// it is simply gone.
export function killStick(minion, still) {
  if (still || !minion.minionKind) return;
  momentsOf(minion).deadAt = performance.now();
  dying.push({ minion, floor: state.run.floorsEntered });
}

// Notes that `minion` just went down: it falls from its pose over
// MAP_ANIMATION_MS.downedFall (at once under reduced motion, `still`).
export function fallStick(minion, still) {
  momentsOf(minion).downAt = still ? -1e9 : performance.now();
}

// Notes that downed `minion` just crawled from tile `from` to where it is
// now. Its hands take turns leading. It drops DROP_LETTERS letters on the
// tile it left, under reduced motion too (they only fade); with `still`
// the crawl itself isn't played: it is simply on its new tile.
export function crawlStick(minion, from, still) {
  const fx = momentsOf(minion);
  if (!still) fx.crawl = { at: performance.now(), from: { row: from.row, col: from.col }, to: { row: minion.row, col: minion.col } };
  fx.lead ^= 1;
  const n = dropCount++;
  const letters = tendrilLetters(fx.seed * 100 + 400 + n, DROP_LETTERS + 1).filter(l => l.ch !== ' ').slice(0, DROP_LETTERS)
    .map((letter, i) => ({ letter, dx: (hash(n * 3.7 + i) - 0.5) * DROP_SPREAD[0], dy: (hash(n * 5.1 + i) - 0.5) * DROP_SPREAD[1] }));
  drops.push({ row: from.row, col: from.col, letters, turn: state.run.turnCount, floor: state.run.floorsEntered });
}

// Notes that downed `minion` just grabbed the player's ankle: its front
// hand reaches for their foot over MAP_ANIMATION_MS.grab and stays.
export function grabStick(minion) {
  momentsOf(minion).grabAt = performance.now();
}

// Notes that the player finished downed `minion`: when its kill is drawn
// (killStick), it comes apart into letters instead of a kill's tendrils.
export function finishStick(minion) {
  momentsOf(minion).finished = true;
}

// The killed minions still fading on this floor, for roomview.js to draw
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

// The pose `minion` shows: DEV -> Look's forced pose, else the walker
// (one stick plan step F).
function poseOf(minion) {
  const forced = state.settings.enemyPose;
  return STICK_POSES[forced] ? forced : 'walker';
}

// 3D joints seen from the side, facing toward the player (negative x), as
// shares of the walker's height: its pose's rest and tell.
function walkerShares(joints) {
  const P = projectFigure(joints, phiToward(-1, 0), 0, 0, 1 / FIGURE3D.heightM);
  return Object.fromEntries(Object.entries(WALKER_JOINTS).map(([k, j]) => [k, P[j]]));
}

// The walker `minion`'s joints on the canvas this frame, standing on (x, y)
// at height `h` (drawUpright): dying, it falls (Death01) as its lines fade;
// just hit, it takes it (Hit_Chest); reaching (combat.js, One stick) its
// punch winds up to FIGURE3D.punchPeak as the reach runs, and in turns its
// tell does the same; else it stands or walks as far as it goes. It faces
// the way it walks, else the player, turning at FIGURE3D.turnRate. Its
// joints sit on the room's own pixels (`view.pixel`).
function walkerNow(minion, fx, x, y, h, view, { push, tellK, hitK, dying }) {
  const { now, still, tw } = view;
  const reach = minion.reaching;
  const pick = dying > 0 ? { move: 'Death01', frame: dying * (moveFrames('Death01') - 1) }
    : hitK > 0 ? { move: 'Hit_Chest', frame: (1 - hitK) * (moveFrames('Hit_Chest') - 1) }
    : reach ? { move: 'Punch_Cross', frame: (1 - reach.left / reach.ms) * FIGURE3D.punchPeak }
    : tellK > 0 && !state.settings.oneStick ? { move: 'Punch_Cross', frame: tellK * FIGURE3D.punchPeak }
    : null;
  if (fx.at && (fx.at[0] !== x || fx.at[1] !== y)) {
    fx.way = [x - fx.at[0], y - fx.at[1]];
    fx.movedAt = now;
  }
  fx.at = [x, y];
  const walking = fx.way && now - fx.movedAt < FIGURE3D.stopMs && !reach;
  const [dx, dy] = walking ? fx.way : [view.player[0] - x, view.player[1] - y];
  const phi = turnFigure(minion, phiToward(dx, dy), now, still);
  const joints = figurePose(minion, { at: [x / tw, y / tw], metres: FIGURE3D.heightM * tw / h, pick, offset: fx.seed / 100 }, now, still);
  const P = projectFigure(joints, phi, x + push, y, h / FIGURE3D.heightM);
  const snap = v => Math.round(v / view.pixel) * view.pixel;
  return Object.fromEntries(Object.entries(WALKER_JOINTS).map(([k, j]) => [k, [snap(P[j][0]), snap(P[j][1])]]));
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
      at: null, way: null, movedAt: -1e9, // the walker's last place, the way it last moved and when (walkerNow)
      style: TENDRIL_STYLES[Math.floor(hash(n * 7.3 + 11) * TENDRIL_STYLES.length)],
      hitAt: -1e9, hits: [], deadAt: null,
      tellOn: false, tellFrom: 0, tellAt: -1e9,
      face: null, faceFrom: 0, faceAt: -1e9,
      downAt: null,   // when it started to fall (fallStick); null while it stands
      crawl: null,    // its last crawl: { at, from, to } tiles (crawlStick)
      lead: 0,        // which hand leads the next crawl: they take turns
      grabAt: null,   // when its hand started for the player's ankle (grabStick)
      finished: false, // the player finished it (finishStick): it dies into letters
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
// kill unravels everything.
function unravelled(fx, pose, minion, m) {
  const u = pose.bones.map(() => 0);
  const body = pose.bones.map((bone, i) => i).filter(i => !pose.limbs.some(l => l.bones.includes(i)));
  fx.hits.forEach((hit, k) => {
    const i = body[k % body.length];
    u[i] = Math.max(u[i], reach(m, hit.at, hit.stays));
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

// The downed pose's reach for DOWNED_BOX: its joints and head, its hand
// stretched a crawl's half tile further is left to the tendrils' rule
// (they reach past the box), and its trail of letters behind it.
function downedReach() {
  const xs = DOWNED_JOINTS.map(k => DOWNED_POSE[k][0]);
  const ys = DOWNED_JOINTS.map(k => DOWNED_POSE[k][1]);
  const [hx, hy] = DOWNED_POSE.head;
  const r = DOWNED_POSE.heads[0][1];
  const tail = DOWNED_POSE.hip[0] + TRAIL_LETTERS * TRAIL_STEP * 1.35 + TRAIL_SIZE[0] / 2;
  return [Math.min(...xs, hx - r), Math.min(...ys, hy - r), Math.max(...xs, tail), Math.max(...ys)];
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

// The point `k` of the way from point `a` to point `b`.
function lerp2(a, b, k) {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
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
