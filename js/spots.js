// Room spots (room spots plan, `ideas/room-spots-plan.md` outside the
// repo; Timothy 2026-10-28): places in a plan's rooms that may hold
// something to help the player: somewhere to hide, a takedown, a lure, a
// scout. The building is the same every run; which spots are live is not.
// "I would like the ingenuity of the player to be how they take out
// threats, and doing that rewards them." Step A only rolls them; using
// them comes in later steps. floor.js buildFloor() calls rollSpots() once
// the furniture is down. No DOM access here.

import { key } from './state.js';
import { SPOT_EMPTY_CHANCE } from './config.js';

// This floor's spots from the plan's rooms (`layout.chambers[i].spots`):
// each holds nothing SPOT_EMPTY_CHANCE of the time, else one of its kinds
// at random. A spot whose furniture was left out (decor.js placeFurniture
// drops a piece that would cut a room in two) is left out too: there is
// nothing to use. `props` is the floor's props so far.
// Returns [{ row, col, kind, used }], kind null for nothing.
export function rollSpots(layout, props) {
  const pieces = new Set(props.filter(p => p.kind === 'furniture').map(p => key(p.row, p.col)));
  const spots = [];
  layout.chambers.forEach(chamber => (chamber.spots || []).forEach(([row, col, kinds]) => {
    if (!pieces.has(key(row, col))) return;
    const kind = Math.random() < SPOT_EMPTY_CHANCE ? null : kinds[Math.floor(Math.random() * kinds.length)];
    spots.push({ row, col, kind, used: false });
  }));
  return spots;
}
