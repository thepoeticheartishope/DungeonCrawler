// Noise (vents and noise plan step B, `ideas/vents-noise-plan.md` outside
// the repo; Timothy 2026-10-15). Mistakes are loud: a wrong reload or
// relay answer, a backfire, a lost Struggle or a wrong answer at the gate
// makes a sound on the player's tile. It spreads a set number of walking
// steps (NOISE_RANGES): walls stop it, doorways and halls carry it, and a
// grate it reaches passes it to its pair for free. Stick men it reaches go
// to where it was made and search there (combat.js hearNoise). The rules
// that make the mistakes call makeNoise(), so main.js only draws.
// No DOM access here.

import { state, key } from './state.js';
import { NOISE_RANGES } from './config.js';
import { ventIndexAt, ductOpen } from './vents.js';
import { hearNoise } from './combat.js';

const STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

// Where a sound made at `origin` reaches within `range` walking steps:
// 8 ways, never cutting a wall's corner (the way stick men walk), so it
// never goes through a wall, not even muffled. A grate it reaches passes
// it on to its pair at the same step, unless either end is sealed (a held
// room). Returns [{ row, col, d, through }]: `d` the steps it took,
// `through` the indexes of the grates it went into to get there (the map
// doesn't draw what came out of a pair the player doesn't know).
export function spreadSound(origin, range) {
  const f = state.floor;
  const walled = (row, col) => f.wallSet.has(key(row, col)) ||
    row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE;
  const out = new Map();
  let next = [];
  const reach = (row, col, d, through) => {
    const k = key(row, col);
    if (out.has(k)) return;
    const tile = { row, col, d, through };
    out.set(k, tile);
    next.push(tile);
    const v = ventIndexAt(row, col);
    if (v === -1 || !ductOpen(v)) return;
    const far = f.vents[f.vents[v].pair];
    reach(far.row, far.col, d, [...through, v]);
  };
  reach(origin.row, origin.col, 0, []);
  for (let d = 1; d <= range; d++) {
    const frontier = next;
    next = [];
    for (const t of frontier) {
      for (const [dr, dc] of STEPS) {
        const row = t.row + dr, col = t.col + dc;
        if (walled(row, col)) continue;
        if (dr && dc && (walled(t.row + dr, t.col) || walled(t.row, t.col + dc))) continue;
        reach(row, col, d, t.through);
      }
    }
  }
  return [...out.values()];
}

// The player made a mistake of `kind` (a NOISE_RANGES key): its sound
// spreads from their tile, and every stick man it reaches that doesn't
// have them in view hears it (combat.js hearNoise). Nothing with
// DEV -> Noise off. Events: noiseMade { kind, tiles } (spreadSound's
// tiles), then noiseHeard { minion } for each one that heard it.
export function makeNoise(kind) {
  if (!state.settings.noise) return [];
  const f = state.floor;
  const origin = { row: f.playerRow, col: f.playerCol };
  const tiles = spreadSound(origin, NOISE_RANGES[kind]);
  const reached = new Set(tiles.map(t => key(t.row, t.col)));
  const events = [{ type: 'noiseMade', kind, tiles }];
  for (const m of f.minions) {
    if (reached.has(key(m.row, m.col)) && hearNoise(m, origin)) events.push({ type: 'noiseHeard', minion: m });
  }
  return events;
}
