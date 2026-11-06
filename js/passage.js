// What stops the player stepping onto a tile — shared by the move itself
// (main.js movePlayer) and the d-pad, which shows each direction as open,
// blocked, or something to examine (render.js renderMoveHints), so the two
// can never disagree. No DOM access here.

import { state, key } from './state.js';

// Whether a prop stops a step: everything but a paper (it lies flat) and a
// shutter that is up (saferoom.js: rolled up in the lintel, it is open
// floor). The one rule for the player, the stick men, sight and cover.
export function solidProp(p) {
  return p.kind !== 'paper' && !(p.kind === 'shutter' && p.up) && !p.fallen;
}

// null if (row, col) is open, otherwise { kind, thing }: kind is 'wall'
// (also the grid's edge), 'pillar',
// 'furniture' (a fixed plan's desks, shelves and the like: solid, but a bump
// only says what it is) or 'prop' (a box, an energy cell, the safe room's
// switch or a shutter that is down, which a bump examines — papers lie flat
// and an up shutter is open floor, so they never block); thing is the minion/prop
// itself where there is one.
export function whatBlocks(row, col) {
  if (row < 0 || row >= state.floor.GRID_SIZE || col < 0 || col >= state.floor.GRID_SIZE) return { kind: 'wall' };
  const k = key(row, col);
  const at = (p) => !!p && p.row === row && p.col === col;
  if (state.floor.wallSet.has(k)) return { kind: 'wall' };
  if (state.floor.pillarSet.has(k)) return { kind: 'pillar' };
  const prop = state.floor.props.find(p => solidProp(p) && at(p));
  if (prop) return { kind: prop.kind === 'furniture' ? 'furniture' : 'prop', thing: prop };
  return null;
}
