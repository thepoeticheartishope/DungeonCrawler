// The eye (light battery plan step E): an eye over a stick man opens while
// the player's light rests on it, in real seconds, not turns, so a free
// switch of the light can't buy a safe peek. Each one keeps a running total
// (`gaze`, ms) over every look; it never runs down by itself. At GAZE_MS
// the stick man steps one closer, outside the turns (no battery, no turn
// count, nothing else moves), and the eye shuts again; one already beside
// the player only stares, and locks on. Firing at it shuts the eye (gun.js
// fire). Only the cone counts, not the small circle round the player, and
// never the hunter. Comfort mode and DEV -> Gaze off leave it out.
// Rules only — no DOM access here; main.js runs the clock.

import { state, key } from './state.js';
import { GAZE_MS, MINION_TRAIL_LENGTH } from './config.js';
import { batteryInPlay } from './battery.js';
import { inLookCone } from './sight.js';
import { bfsPath, blockedTilesFor, lockOn } from './combat.js';

// Whether the eye is in play at all.
export function gazeInPlay() {
  return state.settings.gaze && batteryInPlay();
}

// Whether `m` stands in the player's cone right now: in their own light,
// inside the cone, not on their tile. The eye only shows while it does.
export function inCone(m) {
  const f = state.floor;
  if (m.row === f.playerRow && m.col === f.playerCol) return false;
  return f.sightSet.has(key(m.row, m.col)) && inLookCone(m.row, m.col);
}

// `dt` ms of the player's light pass. Each stick man in the cone adds them
// to its eye; a full one steps (or stares). Returns the events:
// gazeStep { minion, from } or gazeStare { minion }.
export function tickGaze(dt) {
  if (!gazeInPlay() || dt <= 0) return [];
  const events = [];
  for (const m of [...state.floor.minions]) {
    if (m.kind === 'hunter' || !inCone(m)) continue;
    m.gaze = (m.gaze || 0) + dt;
    if (m.gaze < GAZE_MS) continue;
    m.gaze = 0;
    events.push(gazeStep(m));
  }
  return events;
}

// The eye is full: one step along the shortest way to the player, never
// onto them. Beside them (or with no way through) it only stares. Either
// way it knows where they are now.
function gazeStep(m) {
  const f = state.floor;
  lockOn(m);
  const path = bfsPath({ row: m.row, col: m.col }, { row: f.playerRow, col: f.playerCol }, blockedTilesFor(m));
  const next = path && path[1];
  if (!next || (next.row === f.playerRow && next.col === f.playerCol)) return { type: 'gazeStare', minion: m };
  const from = { row: m.row, col: m.col };
  m.row = next.row;
  m.col = next.col;
  m.trail = [...m.trail, from].slice(-MINION_TRAIL_LENGTH);
  return { type: 'gazeStep', minion: m, from };
}
