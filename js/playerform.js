// The player's stick man as a body (player figure plan,
// `ideas/player-figure-plan.md` outside the repo): how he stands, breathes,
// walks and looks round this frame. A person feeling their way through a
// dark place, never quite even (Timothy): every step a little different,
// the first after standing short and slow, the lifted foot quick up and
// careful down, the weight settling after each step, the back foot
// stepping up beside the front one when he stops, a hunch and a head that
// scans while walking and for a while after, quicker breath that calms,
// and glances at odd times when he stands still.
//
// The scaffolding for later moves (flinch, struggle, reload, look up ...):
// each returns the same pose shape from playerPose, in the world's terms,
// so the view only projects it.
//
// mapview.js calls playerStepped() when a step's slide starts and
// playerBumped() on a bump; roomview.js calls playerPose() each frame
// and draws it. View-only: nothing here is game state, nothing changes
// state. Each step's and each glance's variation comes from a counted
// seed, never Math.random (the seeded tests own it).

import {
  PLAYER_WALK, PLAYER_BREATH, PLAYER_GLANCE, PLAYER_EMBER, MAP_ANIMATION_MS,
} from './config.js';

// The feet standing still: together under him, a stance apart.
const STANDING = { along: [0, 0], side: [-PLAYER_WALK.stance, PLAYER_WALK.stance] };

// View-only, so it lives here and not in state.
let gait = null;        // the feet's move now: { from, to, fromSide, toSide, start, ms, lift, liftFoot, gather }
let steps = 0;          // steps taken, the seed for each step's variation
let movedAt = -Infinity;  // the last step's start
let activeAt = -Infinity; // the last step, bump or turn: glances wait PLAYER_GLANCE after it
let breathPhase = 0;    // radians, run on by a breath rate that changes
let lastPoseAt = null;
let gunRise = 0;        // the gun's height off its place, following the body a moment late
let glance = null;      // { start, ms, side, size, twice } while a glance plays
let glances = 0;        // glances so far, the seed for each one
let nextGlanceAt = 0;

// A number from 0 to 1, fixed for seed `n` and `salt`, so a step never
// jitters while it plays and the same steps come out the same.
export function seeded(n, salt) {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// A number between `range`'s two ends, by seed.
function within([low, high], n, salt) {
  return low + (high - low) * seeded(n, salt);
}

function clamp01(k) {
  return Math.max(0, Math.min(1, k));
}

function ease(k) {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
}

// Back to standing still, feet together (a new floor, a new run).
export function resetPlayerForm() {
  gait = { from: STANDING.along, to: STANDING.along, fromSide: STANDING.side, toSide: STANDING.side, start: -Infinity, ms: 1, lift: 0, liftFoot: 0, gather: true };
  steps = 0;
  movedAt = -Infinity;
  activeAt = -Infinity;
  breathPhase = 0;
  lastPoseAt = null;
  gunRise = 0;
  glance = null;
  glances = 0;
  nextGlanceAt = 0;
}
resetPlayerForm();

// Where the feet are at `now`, by the move in hand: each foot's place
// along and across the way he walks, and its lift. The lifted foot moves
// quickly and sets down carefully; the planted one goes back steadily as
// the body passes over it.
export function feetAt(now) {
  const t = clamp01((now - gait.start) / gait.ms);
  const lifted = 1 - Math.pow(1 - t, 2.2);
  const along = [0, 1].map(i => gait.from[i] + (gait.to[i] - gait.from[i]) * (i === gait.liftFoot ? lifted : t));
  const side = [0, 1].map(i => gait.fromSide[i] + (gait.toSide[i] - gait.fromSide[i]) * lifted);
  const up = [0, 1].map(i => (i === gait.liftFoot ? Math.pow(Math.sin(Math.PI * t), 1.3) * gait.lift : 0));
  return { t, along, side, up };
}

// A step's slide started at `now`, taking `ms` (mapview.js
// slidePlayerOnMap). The foot that is further back lifts and goes ahead;
// the first step after standing a while is shorter and slower. `scale`
// shortens it (a bump's half step).
export function playerStepped(now, ms, scale = 1) {
  const cur = feetAt(now);
  const n = steps++;
  const first = gait.gather && now - (gait.start + gait.ms) > PLAYER_WALK.restMs;
  const length = PLAYER_WALK.stride * within(PLAYER_WALK.strideRange, n, 1) * (first ? PLAYER_WALK.firstScale : 1) * scale;
  const lead = cur.along[0] < cur.along[1] - 1e-3 ? 0 : cur.along[1] < cur.along[0] - 1e-3 ? 1 : n % 2;
  const to = [0, 0];
  to[lead] = length;
  to[1 - lead] = -length * within(PLAYER_WALK.backShare, n, 2);
  const jitter = salt => (seeded(n, salt) - 0.5) * PLAYER_WALK.sideJitter;
  gait = {
    from: cur.along, to, fromSide: cur.side,
    toSide: [-PLAYER_WALK.stance + jitter(3), PLAYER_WALK.stance + jitter(4)],
    start: now, ms: ms * within(PLAYER_WALK.timeRange, n, 6) * (first ? PLAYER_WALK.firstSlow : 1),
    lift: PLAYER_WALK.lift * within(PLAYER_WALK.liftRange, n, 5), liftFoot: lead, gather: false,
  };
  movedAt = now;
  activeAt = now;
}

// Walked into something (mapview.js bumpOnMap): a half step, and the foot
// comes back down beside the other.
export function playerBumped(now, ms) {
  playerStepped(now, ms, PLAYER_WALK.bumpScale);
}

// He turned or swept the light: glances wait again.
export function playerActive(now) {
  activeAt = now;
}

// Once he has stopped, the back foot steps up beside the front one.
function gatherFeet(now) {
  if (gait.gather || now - (gait.start + gait.ms) < PLAYER_WALK.gatherWaitMs) return;
  const cur = feetAt(now);
  gait = {
    from: cur.along, to: STANDING.along, fromSide: cur.side, toSide: STANDING.side,
    start: now, ms: PLAYER_WALK.gatherMs, lift: PLAYER_WALK.lift * 0.6, liftFoot: cur.along[0] < cur.along[1] ? 0 : 1, gather: true,
  };
}

// The head's glance standing still, -1..1 (a share of PLAYER_GLANCE.turn):
// none until MAP_ANIMATION_MS.playerIdle after the last move, then one at
// odd times, to a seeded side and size, sometimes looking back twice.
function glanceAt(now) {
  if (now - activeAt < MAP_ANIMATION_MS.playerIdle) {
    glance = null;
    nextGlanceAt = 0;
    return 0;
  }
  if (!glance && now >= nextGlanceAt) {
    const n = glances++;
    const twice = seeded(n, 7) < PLAYER_GLANCE.twiceShare;
    glance = { start: now, ms: within(twice ? PLAYER_GLANCE.twiceMs : PLAYER_GLANCE.onceMs, n, 8), side: seeded(n, 9) < 0.5 ? -1 : 1, size: within(PLAYER_GLANCE.size, n, 10), twice, n };
  }
  if (!glance) return 0;
  const t = (now - glance.start) / glance.ms;
  if (t >= 1) {
    nextGlanceAt = now + within(PLAYER_GLANCE.gapMs, glance.n, 11);
    glance = null;
    return 0;
  }
  let v = t < 0.3 ? ease(t / 0.3) : t < 0.6 ? 1 : 1 - ease((t - 0.6) / 0.4);
  if (glance.twice && t >= 0.6) {
    v = t < 0.72 ? 1 - 0.6 * ease((t - 0.6) / 0.12) : t < 0.84 ? 0.4 + 0.5 * ease((t - 0.72) / 0.12) : 0.9 * (1 - ease((t - 0.84) / 0.16));
  }
  return v * glance.side * glance.size;
}

// How bright the ember in his head glows, 0..1: from PLAYER_EMBER.low to
// .high and back with his `breath` (-1..1), steady at .mid when `still`.
export function emberGlow(breath, still = false) {
  if (still) return PLAYER_EMBER.mid;
  return PLAYER_EMBER.low + (PLAYER_EMBER.high - PLAYER_EMBER.low) * (breath + 1) / 2;
}

// His pose at `now`, for the view to draw:
//   feet  [{ along, side, up }, ...] in tiles from his middle, along and
//         across the way he walks (the left foot first)
//   rise  how far his upper body is lifted, a share of his height
//         (breath up, hunch and settling down)
//   sway  how far his upper body leans sideways, a share of his height
//   breath -1..1 through a breath (the ember head's glow follows it)
//   turn  his head's turn, -1 (left) .. 1, a share of PLAYER_GLANCE.turn
//   gunRise how far the gun is lifted, a share of his height, following
//         `rise` a moment late
// `still` (reduced motion) holds him standing still, feet together, mid
// breath. `steady` (a shot waits, a dial is up) keeps his head on the
// target: no scan or glance.
export function playerPose(now, still = false, steady = false) {
  const dt = lastPoseAt === null ? 0 : Math.min(50, Math.max(0, now - lastPoseAt));
  lastPoseAt = now;
  if (still) {
    gunRise = 0;
    return { feet: [0, 1].map(i => ({ along: 0, side: STANDING.side[i], up: 0 })), rise: 0, sway: 0, breath: 0, turn: 0, gunRise: 0 };
  }
  gatherFeet(now);
  const calm = clamp01((now - movedAt) / PLAYER_BREATH.calmMs);
  breathPhase += dt / (PLAYER_BREATH.fastMs + (MAP_ANIMATION_MS.playerBreath - PLAYER_BREATH.fastMs) * calm) * Math.PI * 2;
  const breath = Math.sin(breathPhase);
  const feet = feetAt(now);
  const alert = 1 - clamp01((now - movedAt) / PLAYER_WALK.alertMs);
  const spread = Math.abs(feet.along[0] - feet.along[1]) / (2 * PLAYER_WALK.stride);
  const landed = now - (gait.start + gait.ms);
  const settle = landed > 0 && landed < PLAYER_WALK.settleMs ? Math.sin(Math.PI * landed / PLAYER_WALK.settleMs) * (gait.gather ? 1.2 : 0.7) : 0;
  const scan = steady ? 0 : alert * PLAYER_WALK.scan * (Math.sin(now / 1900) + 0.6 * Math.sin(now / 3100 + 1.3)) / 1.6;
  const look = steady ? 0 : glanceAt(now);
  const rise = breath * PLAYER_BREATH.lift - spread * PLAYER_WALK.spreadDrop - settle * PLAYER_WALK.settle - alert * PLAYER_WALK.hunch;
  gunRise += (rise - gunRise) * PLAYER_WALK.gunLag;
  return {
    feet: [0, 1].map(i => ({ along: feet.along[i], side: feet.side[i], up: feet.up[i] })),
    rise,
    sway: gait.gather ? 0 : Math.sin(Math.PI * feet.t) * PLAYER_WALK.sway * (gait.liftFoot ? -1 : 1),
    breath, turn: look + scan, gunRise,
  };
}
