// Room spots (room spots plan, `ideas/room-spots-plan.md` outside the
// repo; Timothy 2026-10-28): places in a plan's rooms that may hold
// something to help the player: somewhere to hide, a takedown, a lure, a
// scout. The building is the same every run; which spots are live is not.
// "I would like the ingenuity of the player to be how they take out
// threats, and doing that rewards them." floor.js buildFloor() calls
// rollSpots() once the furniture is down. Step B: a live hide spot is
// somewhere to hide (hideIn, leaveHiding): moves.js calls them on a bump
// and a step, walk.js on a push; combat.js, gaze.js and sight.js ask
// `state.floor.hidden`. Step C: a live takedown is pushed over (topple),
// from moves.js's bump. No DOM access here.

import { state, key } from './state.js';
import { SPOT_EMPTY_CHANCE, TAKEDOWN_GOLD_TIMES } from './config.js';
import { computeVisibility } from './sight.js';
import { followBody } from './look.js';
import { whatBlocks } from './passage.js';
import { FOUR_STEPS } from './grid.js';
import { killMinion } from './gun.js';

// This floor's spots from the plan's rooms (`layout.chambers[i].spots`):
// each holds nothing SPOT_EMPTY_CHANCE of the time, else one of its kinds
// at random. A spot whose furniture was left out (decor.js placeFurniture
// drops a piece that would cut a room in two) is left out too: there is
// nothing to use. `props` is the floor's props so far.
// Returns [{ row, col, kind, used, tiles }], kind null for nothing, tiles
// every tile of the piece it is on (a bump on any of them uses it).
export function rollSpots(layout, props) {
  const pieces = new Set(props.filter(p => p.kind === 'furniture').map(p => key(p.row, p.col)));
  const spots = [];
  layout.chambers.forEach(chamber => (chamber.spots || []).forEach(([row, col, kinds]) => {
    if (!pieces.has(key(row, col))) return;
    const kind = Math.random() < SPOT_EMPTY_CHANCE ? null : kinds[Math.floor(Math.random() * kinds.length)];
    const [, , c0, width = 1] = chamber.furniture.find(([, r, c, w = 1]) => r === row && col >= c && col < c + w);
    const tiles = Array.from({ length: width }, (_, i) => ({ row, col: c0 + i }));
    spots.push({ row, col, kind, used: false, tiles });
  }));
  return spots;
}

// The live spot of `kind` on the piece at (row, col), or null.
export function liveSpotAt(row, col, kind) {
  return state.floor.roomSpots.find(s => s.kind === kind && !s.used && s.tiles.some(p => p.row === row && p.col === col)) || null;
}

// The player hides in the piece at (row, col), a live hide spot: they go
// onto its tile, out of sight. While hidden no stick man, and not the
// hunter either (Timothy 2026-10-28: "he can't get you for now"), can
// see them, reach them or be drawn to them, and they can't use the book;
// the light and the clock go on. As long as they like ("for now you can
// hide as long as you like"). Event: hid { piece }.
export function hideIn(row, col, piece) {
  const f = state.floor;
  f.hidden = { row, col, from: { row: f.playerRow, col: f.playerCol } };
  f.playerRow = row;
  f.playerCol = col;
  f.playerAt = null;
  f.sneaking = false;
  f.creeping = false;
  followBody();
  computeVisibility();
  return [{ type: 'hid', piece }];
}

// The player comes out of hiding: back to the tile they went in from, or,
// with something standing there, the first free tile beside the piece.
// With none free they stay hidden. Events: hideLeft, or blocked
// { kind: 'hideBlocked' }.
export function leaveHiding() {
  const f = state.floor;
  const { row, col, from } = f.hidden;
  const out = [from, ...FOUR_STEPS.map(([dr, dc]) => ({ row: row + dr, col: col + dc }))]
    .find(p => !whatBlocks(p.row, p.col));
  if (!out) return [{ type: 'blocked', kind: 'hideBlocked' }];
  f.hidden = null;
  f.playerRow = out.row;
  f.playerCol = out.col;
  f.playerAt = null;
  followBody();
  computeVisibility();
  return [{ type: 'hideLeft' }];
}

// The player pushes over the piece at (row, col), a live takedown spot,
// from where they stand: it falls away from them, one tile the way they
// push, the whole piece at once. Every stick man under it dies and pays
// its gold TAKEDOWN_GOLD_TIMES over (gun.js killMinion), for no energy and
// no dial; the hunter can't be killed, so it stands. It falls even with
// nobody under it (Timothy 2026-10-28: timing is the skill), and is spent:
// it lies on the floor where it fell and no longer blocks walking. A
// bookcase only tips forward or back: pushed from the side, or with
// nowhere to fall (a wall, a pillar, the chest, other furniture), nothing
// happens.
// Events: toppled { piece }, then minionKilled { minion } and goldGained
// { amount, from: 'takedown' } for each one under it; or blocked { kind:
// 'wontTip' } or { kind: 'noRoom' }.
export function topple(spot, row, col, piece) {
  const f = state.floor;
  const dr = Math.sign(row - f.playerRow);
  if (!dr) return [{ type: 'blocked', kind: 'wontTip' }];
  const lands = spot.tiles.map(p => ({ row: p.row + dr, col: p.col }));
  const at = (thing, p) => !!thing && thing.row === p.row && thing.col === p.col;
  const clear = p => !f.wallSet.has(key(p.row, p.col)) && !f.pillarSet.has(key(p.row, p.col)) &&
    !at(f.chest, p) && !at(f.boss, p) && !at(f.exchange, p) &&
    !f.props.some(q => at(q, p) && q.kind !== 'paper' && !q.fallen);
  if (!lands.every(clear)) return [{ type: 'blocked', kind: 'noRoom' }];
  spot.used = true;
  const own = new Set(spot.tiles.map(p => key(p.row, p.col)));
  f.props.forEach(p => {
    if (p.kind !== 'furniture' || !own.has(key(p.row, p.col))) return;
    p.row += dr;
    p.fallen = dr;
  });
  const events = [{ type: 'toppled', piece }];
  const under = f.minions.filter(m => lands.some(p => p.row === m.row && p.col === m.col));
  under.forEach(m => events.push(...killMinion(m, 'takedown', TAKEDOWN_GOLD_TIMES)));
  computeVisibility();
  return events;
}
