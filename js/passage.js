// What stops the player stepping onto a tile — shared by the move itself
// (main.js movePlayer) and the d-pad, which shows each direction as open,
// blocked, or something to examine (render.js renderMoveHints), so the two
// can never disagree. No DOM access here.

import { state, key } from './state.js';

// True if a step from (row, col) by (dRow, dCol) doesn't cut a corner: a
// diagonal step needs both tiles it passes between free of walls and
// pillars (eight ways plan, Timothy: no cutting corners). That also keeps a
// one-wide doorway shut from the side. A box, a chest or a minion beside it
// doesn't block. A straight step always passes. Shared by the player
// (moves.js) and the minions (combat.js), so the rule is the same for both.
export function canPassCorner(row, col, dRow, dCol) {
  if (dRow === 0 || dCol === 0) return true;
  const solid = (r, c) => state.floor.wallSet.has(key(r, c)) || state.floor.pillarSet.has(key(r, c));
  return !solid(row + dRow, col) && !solid(row, col + dCol);
}

// How many steps (row, col) is from the player on open floor, walls
// ignored: with 8 ways a diagonal is one step, so it is the larger of the
// two distances; with DEV -> 8 ways off, their sum, as before. The strike
// tells use it (one more step and it is next to them).
export function stepsAway(row, col) {
  const dRow = Math.abs(row - state.floor.playerRow);
  const dCol = Math.abs(col - state.floor.playerCol);
  return state.settings.eightWays ? Math.max(dRow, dCol) : dRow + dCol;
}

// null if (row, col) is open, otherwise { kind, thing }: kind is 'wall'
// (also the grid's edge), 'pillar', 'boss', 'hunter', 'minion', 'chest',
// 'exchange' (THE UNFOLDING on a rest floor; a bump opens its screen) or
// 'prop' (a box or an energy cell, which a bump examines — papers lie flat
// and never block); thing is the minion/prop itself where there is one.
export function whatBlocks(row, col) {
  if (row < 0 || row >= state.floor.GRID_SIZE || col < 0 || col >= state.floor.GRID_SIZE) return { kind: 'wall' };
  const k = key(row, col);
  const at = (p) => !!p && p.row === row && p.col === col;
  if (state.floor.wallSet.has(k)) return { kind: 'wall' };
  if (state.floor.pillarSet.has(k)) return { kind: 'pillar' };
  if (at(state.floor.boss)) return { kind: 'boss' };
  if (at(state.floor.hunter)) return { kind: 'hunter' };
  const minion = state.floor.minions.find(at);
  if (minion) return { kind: 'minion', thing: minion };
  if (at(state.floor.chest)) return { kind: 'chest' };
  if (at(state.floor.exchange)) return { kind: 'exchange', thing: state.floor.exchange };
  const prop = state.floor.props.find(p => p.kind !== 'paper' && at(p));
  if (prop) return { kind: 'prop', thing: prop };
  return null;
}
