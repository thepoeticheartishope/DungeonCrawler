// What the map view (roomview.js) draws that
// isn't about how it projects the floor: the light's levels, the sizes and
// strengths of the things on the floor, the gun's marks, and the rules for
// what a view shows that don't depend on how it projects the floor (how
// bright a tile is, which walls show, what the gun reaches and aims at, a
// shot's path, the tutorial's ring and the answer ring over time, a stick
// man's eye). Kept apart from the view since the isometric view shared it
// (removed 2026-10-18). Sizes are shares of a tile's width unless they say
// otherwise; the room view reads a tile's width as one tile. Reads
// state only.

import { state, key } from './state.js';
import {
  MAP_ANIMATION_MS, GAZE_MS, ANSWER_RING, ANSWER_RING_TURN_MS, ANSWER_RING_IN_MS, ANSWER_RING_OUT_MS,
  TUTORIAL_RING_RADIUS, TUTORIAL_RING_TURN_MS, TUTORIAL_RING_SCATTER_MS, SKY_EYE,
  REALTIME_STEP_MS,
} from './config.js';
import { canShoot } from './sight.js';
import { gazeInPlay, inCone } from './gaze.js';
import { t } from './text.js';
import { ringLetters } from './swirl.js';
import { lightProgress } from './light.js';

// How bright a lit tile is, by its steps from the player (0 = their own
// tile): the light fades over the five steps they can see.
const LIGHT_FALLOFF = [1, 1, 0.85, 0.7, 0.56, 0.44];
const BOSS_LIT_LEVEL = 0.5;  // floor only the boss's light shows
const REMEMBERED_LEVEL = 0.2; // floor explored but not lit now
export const WALL_MIN_LEVEL = 0.28; // a wall beside remembered floor: still a shape
export const SEARCHED_LEVEL = 0.6;  // a box or paper already searched is dimmer

// Sizes, as shares of a tile's width unless they say otherwise.
export const PILLAR_INSET = 0.24;     // a pillar is thinner than its tile, so it reads as a column
export const BOX_INSET = 0.3;
export const BOX_HEIGHT = 0.3;

// The energy cell (Timothy's pick from the ammo box mockup): round, so
// nothing else on the map shares its shape. Three round ends show on its lid.
export const DRUM_RADIUS = 0.24;      // its footprint's radius, in tiles
export const DRUM_HEIGHT = 0.32;
export const DRUM_HOOPS = [0.25, 0.7]; // the bands round it, as shares of its height
export const DRUM_ENDS = [[-0.38, 0.1], [0.38, 0.1], [0, -0.42]]; // the round ends on the lid, as shares of the lid's ellipse
export const DRUM_END_SIZE = 0.22;     // a round end's size, as a share of the lid
export const DRUM_BREATH = [0.05, 0.12]; // its breathing glow's strength, faintest and fullest
export const DRUM_BREATH_REACH = 0.55; // how far the glow reaches, in tiles
export const DESK_GLOW = [0.16, 0.26];  // the reflective desk's warm light pool, faintest and fullest
export const DESK_GLOW_RADIUS = 1.3;  // how far it reaches over the floor, in tiles
export const GLYPH_CELL = 0.85;       // the tile size glyphs are sized for (MAP_GLYPH_SIZES)
export const GLYPH_RISE = 0.45;       // a glyph's middle sits this share of its height above the floor

// The stairs down: nested diamonds sinking into the floor.
export const STAIR_STEPS = 4;
export const STAIR_INSET = [0.08, 0.09]; // the first step's inset, then each next one's

// The stairs' column of light, rising out of them above the walls so the
// way out shows even behind a wall. Soft layers, widest and faintest
// first: width a share of a tile's width, strength at the stairs.
export const STAIR_BEAM_HEIGHT = 2.1;    // as a share of a wall's height
export const STAIR_BEAM_LAYERS = [{ width: 0.55, strength: 0.16 }, { width: 0.32, strength: 0.26 }, { width: 0.12, strength: 0.5 }];
export const STAIR_BEAM_FADE = [0.75, 0.5]; // where up the column it has faded to this share of its strength

// A doorway: two thin posts with an arch over them and a faint haze in the
// opening, so a way through reads from any side and its arch shows over a
// wall in front of it (Timothy picked this from the door frames mockup).
// It never cuts down with the walls beside it: it marks a way out.
export const DOOR_POST = 0.07;          // half a post's width, in tiles
export const DOOR_ARCH_RISE = 0.34;     // how far the arch rises above the walls, as a share of a wall's height
export const DOOR_ARCH_THICK = 0.08;    // the arch's thickness, as a share of a wall's height
export const DOOR_ARCH_STEPS = 16;      // straight pieces in each line of the arch
export const DOOR_MIN_LEVEL = 0.5;      // a remembered doorway's arch is still this bright

// The paper lying flat, in the tile's own two directions (-1..1 across it).
export const PAPER_SHEET = [[-0.8, -0.55], [0.75, -0.7], [0.8, 0.55], [-0.75, 0.7]];
export const PAPER_LINES = [-0.3, 0, 0.3];
export const PAPER_SCALE = 0.2;           // half the paper's size, as a share of the diamond's width (the shoulder view: twice this, in tiles)
export const SOUND_INSET = [0.4, 0.1];   // a tile of a mistake's sound opens from this inset to this one (shares of a tile)
export const SOUND_LEVEL = 0.55;         // how bright a tile of the sound is when it first lights
export const HEARD_LIFT = 0.18;          // the '!' over a stick man that heard a sound sits this share of a tile above its eye
export const GRATE_RATTLE = 0.03;   // how far a shuddering grate sways, as a share of a tile
export const GRATE_RATTLE_SWAYS = 3; // side to side this many times while it shudders
export const GRATE_SCALE = 0.19;     // a grate's frame: its corners sit this share of a tile in from the middle (it lies flat, inside its tile)
export const GRATE_BARS = [-0.5, -0.17, 0.17, 0.5]; // where its bars cross it, from -1 to 1

// The old isometric view's stick man height, feet to top of head (the
// shoulder view measures the answer ring's lift against it), and the eye
// over a stick man in the player's light (gaze.js).
export const ISO_STICK_HEIGHT = 0.62;
export const EYE_LIFT = 0.22;         // the eye over a stick man in the light (drawGazeEye): its height over the head
export const EYE_WIDTH = 0.16;        // half its width
const EYE_OPEN = 0.07;         // how far the lids part when it is full
const EYE_LEVEL = [0.45, 1];   // its strength, shut to full

// The gun's marks on the map (gun plan): the tiles it reaches, the
// brackets, the laser, a shot and its MISS, the maim point's ring.
export const REACH_FILL = 0.15;         // a reached tile's fill strength
export const BRACKET_ARM = 0.12;        // a corner bracket's arms, as a share of a tile's width
export const BRACKET_HALF = 0.32;       // the narrowest a bracket box is, half its width as a share of a tile's
export const BRACKET_LEVEL = [0.4, 0.95]; // a shootable thing's brackets, then the target's
export const BRACKET_PULSE = 0.025;     // how far the target's brackets breathe out, as a share of a tile's width
export const BRACKET_TEXT_SIZE = 0.26;  // the target's guard over its brackets, as a share of a tile's width
export const BRACKET_HP_GAP = 0.1;      // the target's guard sits this far over its brackets, as a share of a tile's height
// Steady aim (steady aim plan): the target's brackets start STEADY_OPEN tile
// widths further out and close in as the aim steadies; a mark across the
// body climbs from the feet to the head (STEADY_MARK of the box's width)
// and shakes STEADY_SHAKE tile widths when the arm does; the chance to land
// sits by the top right bracket, STEADY_TEXT_SIZE of a tile's width high.
export const STEADY_OPEN = 0.35;
export const STEADY_MARK = 0.7;
export const STEADY_SHAKE = 0.03;
export const STEADY_TEXT_SIZE = 0.26;
export const LASER_LEVEL = [0.45, 0.8]; // the laser's strength, then while a landed shot waits
export const SHOT_RING = [0.06, 0.25];  // the ring where it lands: its first radius, then how much it grows, in tile widths
const MISS_PAST = 0.6;           // how far past the minion a missed shot goes, in tiles
const MISS_SIDE = 0.5;           // and how far to one side
export const MISS_TEXT_SIZE = 0.36;     // MISS's height, as a share of a tile's width
export const MISS_RISE = [1.15, 0.25];  // where MISS starts above its tile, then how far it floats up, in tile widths (slow: the calm rule)
export const WEAK_RING = 0.12;          // the ring on a stick enemy's maim point while a landed shot waits, its radius in tile widths
export const WEAK_RING_LEVEL = 0.7;     // and its strength

// How bright a floor tile is, from 0 to 1: fading over the player's own
// light, a middle level where only the boss's light shows it, dim where
// only remembered. `fogOf(row, col)` is mapview.js's ('lit' / 'dim' /
// 'hidden').
export function floorLevelOf(row, col, fogOf) {
  const fog = fogOf(row, col);
  if (fog === 'hidden') return 0;
  if (fog === 'dim') return REMEMBERED_LEVEL;
  if (!state.settings.fogEnabled) return 1;
  if (!state.floor.sightSet.has(key(row, col))) return BOSS_LIT_LEVEL;
  const steps = Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol));
  return LIGHT_FALLOFF[Math.min(steps, LIGHT_FALLOFF.length - 1)];
}

// Walls are never lit themselves (the light stops at them), so a wall
// shows once any floor beside it, corners included, has been seen.
export function wallShownBy(row, col, fogOf) {
  const f = state.floor;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= f.GRID_SIZE || c >= f.GRID_SIZE) continue;
      if (!f.wallSet.has(key(r, c)) && fogOf(r, c) !== 'hidden') return true;
    }
  }
  return false;
}

// Whether the paper or box on a tile has already been searched.
export function searched(at) {
  const prop = state.floor.props.find(p => p.row === at.row && p.col === at.col);
  return Boolean(prop && prop.searched);
}

// The minion (or hunter) on a tile, if any.
export function minionOn(tile) {
  return state.floor.minions.find(m => m.row === tile.row && m.col === tile.col);
}

// The gun's target, if it is still on the floor (a fight on the battle
// screen can clear a minion the gun was aimed at).
export function liveTarget() {
  const target = state.floor.gunTarget;
  return target && state.floor.minions.includes(target) ? target : null;
}

// Whether the gun reaches a floor tile: one the player could shoot at
// (sight.js canShoot: in their own light, in range, a clear line), not
// their own tile and not a wall or pillar.
export function inReach(row, col) {
  const f = state.floor;
  if (row === f.playerRow && col === f.playerCol) return false;
  if (f.wallSet.has(key(row, col)) || f.pillarSet.has(key(row, col))) return false;
  return canShoot({ row, col });
}

// Eases `x` (0..1, held there) in and out.
export function smooth(x) {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
}

// How open the eye in the sky is, 0 (shut) to 1 (wide open): the boss's
// light's progress, eased so it opens slowly at first and settles at the
// end. Shut with no boss (a rest floor, after the boss falls): light.js
// lightProgress() is 0 then. In the tutorial room it is wide open
// (SKY_EYE.tutorial), with no boss: the kind voice's "It's watching you."
// sends the player up to see it, so they learn an open eye is bad.
export function skyEyeOpen() {
  if (state.floor.tutorial) return SKY_EYE.tutorial;
  return smooth(lightProgress());
}

// The turns left before the light takes the floor, for Comfort mode's
// number in the sky (with One stick, seconds: the world's beats left);
// null with no boss's light on this floor.
export function skyTurnsLeft() {
  if (!state.floor.boss) return null;
  const left = Math.max(0, state.floor.lightTurnBudget - state.floor.lightTurns);
  return state.settings.oneStick ? Math.round(left * REALTIME_STEP_MS / 1000) : left;
}

// The last shot (mapview.js shotOnMap -> showShot): { start, at, to,
// missed }, or null. One for both views, so switching view mid-shot keeps it.
let shot = null;
let shotsShown = 0;      // shots shown so far, so a miss goes to the left and right in turn

// Plays a shot on the map: a flash from the gun to `target`, or past it
// when it `missed`, with MISS floating up over it. A miss goes to one
// side, then the other, so two misses in a row don't look the same (never
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

// The last shot, or null before any.
export function lastShot() {
  return shot;
}

// How far through its kick the gun is at `now`, 1 just fired to 0
// settled; 0 under reduced motion (`still`). The view keeps frames going
// while it is above 0.
export function recoilAt(now, still) {
  if (!shot || still) return 0;
  const age = now - shot.start;
  if (age >= MAP_ANIMATION_MS.gunRecoil) return 0;
  return 1 - age / MAP_ANIMATION_MS.gunRecoil;
}

// The tutorial's ring of dark (tutorial.js stage 'ring') at `now`: words
// in the stick men's cold light circling at the edge of the player's
// small light, slowly; when the light breaks the ring they scatter
// outward and fade over TUTORIAL_RING_SCATTER_MS. Under reduced motion
// (`still`), and in Comfort mode, they stand still and are simply gone
// when it breaks. Returns null when there is no ring to draw, else
// { words, angles (one per word, radians round the player), radius (in
// tiles), level (0..1), moving }.
let ringShown = false;   // the ring was drawn closed on the last frame
let ringBrokeAt = null;  // the frame time it broke (its words scatter), or null
export function darkRingAt(now, still) {
  const tut = state.floor.tutorial;
  const closed = !!tut && tut.stage === 'ring';
  const calm = still || state.settings.simpleEnemies;
  if (closed) {
    ringShown = true;
    ringBrokeAt = null;
  } else if (ringShown) {
    ringShown = false;
    ringBrokeAt = calm ? null : now;
  }
  if (!closed && ringBrokeAt === null) return null;
  const gone = closed ? 0 : (now - ringBrokeAt) / TUTORIAL_RING_SCATTER_MS;
  if (gone >= 1) {
    ringBrokeAt = null;
    return null;
  }
  const words = t('tut.ring.words').split(' ');
  const spin = calm ? 0 : (now / TUTORIAL_RING_TURN_MS) * Math.PI * 2;
  return {
    words,
    angles: words.map((word, i) => spin + (i / words.length) * Math.PI * 2),
    radius: TUTORIAL_RING_RADIUS * (1 + gone * 1.5),
    level: 0.75 * (1 - gone),
    moving: !calm,
  };
}

// The answer ring (swirl.js answerRingNow `ring`) at `now`, the part both
// views share: how far it has faded out after a move (0..1, `out`), and
// each letter's place round it and look, in order: { ch, angle, front
// (1 nearest the viewer, -1 the far side), level (0..1), size (a share of
// the ring's letter size) }. Going down the angle reads left to right
// across the front. Letters too faint to draw are left out.
export function answerRingLetters(ring, now) {
  const letters = ringLetters(ring.text);
  const n = letters.length;
  const out = ring.fading === null ? 0 : smooth(ring.fading / ANSWER_RING_OUT_MS);
  const spin = (now % ANSWER_RING_TURN_MS) / ANSWER_RING_TURN_MS * Math.PI * 2;
  const shown = [];
  letters.forEach((ch, i) => {
    const angle = Math.PI * 0.95 - i * (Math.PI * 2 / n) + spin;
    const front = Math.sin(angle);
    const k = (front + 1) / 2;
    const comeIn = smooth((ring.since - (i / n) * ANSWER_RING_IN_MS * 0.6) / (ANSWER_RING_IN_MS * 0.4));
    const level = comeIn * (1 - out) * (ANSWER_RING.backLevel + (1 - ANSWER_RING.backLevel) * Math.pow(k, 1.4));
    if (level <= 0.01) return;
    shown.push({ ch, angle, front, level, size: ANSWER_RING.backSize + (1 - ANSWER_RING.backSize) * k });
  });
  return { out, letters: shown };
}

// The eye over minion `m` while it is in the player's cone (gaze.js):
// null when it isn't shown; else { share (0..1 of GAZE_MS), open (how far
// the lids part, in tile widths), level (its strength) }. The pupil shows
// from a third open. No blink, and it only moves as the gaze grows.
export function eyeOf(m) {
  if (!m || !m.gaze || !gazeInPlay() || !inCone(m)) return null;
  const share = Math.min(1, m.gaze / GAZE_MS);
  return {
    share,
    open: EYE_OPEN * share * share * (3 - 2 * share),
    level: EYE_LEVEL[0] + (EYE_LEVEL[1] - EYE_LEVEL[0]) * share,
  };
}

// Whether (row, col) is wall or off the grid.
export function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

// A tile's own number from 0 to 1, the same every time, for the grain of
// wood and the scuffs on the lino. Never Math.random (the seeded tests own it).
export function grain(row, col, n) {
  let h = (row * 374761393 + col * 668265263 + n * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
