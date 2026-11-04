// What the map view (roomview.js) draws that
// isn't about how it projects the floor: the light's levels, the sizes and
// strengths of the things on the floor, and the rules for what a view
// shows that don't depend on how it projects the floor (how bright a tile
// is, which walls show). Kept apart from the view since the isometric view shared it
// (removed 2026-10-18). Sizes are shares of a tile's width unless they say
// otherwise; the room view reads a tile's width as one tile. Reads
// state only.

import { state, key } from './state.js';
import { REALTIME_STEP_MS } from './config.js';
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
export const GRATE_RATTLE = 0.03;   // how far a shuddering grate sways, as a share of a tile
export const GRATE_SCALE = 0.19;     // a grate's frame: its corners sit this share of a tile in from the middle (it lies flat, inside its tile)
export const GRATE_BARS = [-0.5, -0.17, 0.17, 0.5]; // where its bars cross it, from -1 to 1

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

// Eases `x` (0..1, held there) in and out.
export function smooth(x) {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
}

// How open the eye in the sky is, 0 (shut) to 1 (wide open): the boss's
// light's progress, eased so it opens slowly at first and settles at the
// end. Shut with no boss (a rest floor, after the boss falls): light.js
// lightProgress() is 0 then.
export function skyEyeOpen() {
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
