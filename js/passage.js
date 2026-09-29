// What stops the player stepping onto a tile — shared by the move itself
// (main.js movePlayer) and the d-pad, which shows each direction as open,
// blocked, or something to examine (render.js renderMoveHints), so the two
// can never disagree. No DOM access here.

import { state, key } from './state.js';

// null if (row, col) is open, otherwise { kind, thing }: kind is 'wall'
// (also the grid's edge), 'pillar', 'boss', 'hunter', 'minion', 'chest',
// 'rune', 'encounter' or 'prop' (a box, which a bump examines — papers lie
// flat and never block); thing is the minion/encounter/box itself where
// there is one.
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
  if (at(state.floor.rune)) return { kind: 'rune' };
  const encounter = state.floor.encounters.find(at);
  if (encounter) return { kind: 'encounter', thing: encounter };
  const prop = state.floor.props.find(p => p.kind === 'box' && at(p));
  if (prop) return { kind: 'prop', thing: prop };
  return null;
}
