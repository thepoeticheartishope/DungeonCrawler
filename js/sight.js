// What the player can see on the ship (computeVisibility), whether a
// thing can be made out rather than shown as '?', and cover for a
// crouched player. Rules only — no DOM access here; mapview.js and
// roomview.js draw from what this writes.

import { state, key } from './state.js';
import { REVEAL_DISTANCE } from './config.js';
import { solidProp } from './passage.js';
import { shutterDownAt } from './saferoom.js';

// What the player can see. The ship has no dark areas (ship plan), so
// every open tile is seen from the start. Seen tiles are remembered (exploredSet), and
// a paper or box once made out keeps its real glyph from then on.
export function computeVisibility() {
  const f = state.floor;
  f.visibleSet = new Set();
  for (let r = 0; r < f.GRID_SIZE; r++) {
    for (let c = 0; c < f.GRID_SIZE; c++) {
      if (!f.wallSet.has(key(r, c))) f.visibleSet.add(key(r, c));
    }
  }
  f.visibleSet.forEach(k => f.exploredSet.add(k));
  f.props.forEach(p => { if (canMakeOut(p.row, p.col)) p.identified = true; });
}

// True if a straight line from (fromRow, fromCol) to (row, col) passes no
// wall, pillar or shutter that is down between them (the ends don't count). A stick man's view
// of the player's light uses it too (combat.js notice).
function clearLine(fromRow, fromCol, row, col) {
  const dr = row - fromRow;
  const dc = col - fromCol;
  const steps = Math.max(Math.abs(dr), Math.abs(dc)) * 4;
  for (let i = 1; i < steps; i++) {
    const r = Math.round(fromRow + (dr * i) / steps);
    const c = Math.round(fromCol + (dc * i) / steps);
    if ((r === row && c === col) || (r === fromRow && c === fromCol)) continue;
    const k = key(r, c);
    if (state.floor.wallSet.has(k) || state.floor.pillarSet.has(k) || shutterDownAt(k)) return false;
  }
  return true;
}

// ---- Cover (Timothy 2026-10-26) ----

// Whether the player is crouched: One stick, sneaking (X) or creeping (a
// small push on the stick, which stays crouched once let go until they
// walk again, so a phone can hide too; walk.js).
function crouching() {
  return state.floor.sneaking || state.floor.creeping;
}

// Whether (row, col) is cover: something solid that isn't wall, the
// player hides behind it (a pillar, furniture, a box, a cell, a relay,
// the desk, the charger, a shutter that is down). A paper lies
// flat, an up shutter is open floor; a stick man isn't cover.
function coverAt(row, col) {
  const f = state.floor;
  if (f.pillarSet.has(key(row, col))) return true;
  return f.props.some(p => solidProp(p) && p.row === row && p.col === col);
}

// Whether the player, crouched, has cover on one of the 8 tiles round
// them: their mistakes are quieter (noise.js, COVER.noiseShare).
export function besideCover() {
  if (!crouching()) return false;
  const f = state.floor;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && coverAt(f.playerRow + dr, f.playerCol + dc)) return true;
    }
  }
  return false;
}

// True if a straight line from the player's tile to (row, col) passes no
// wall or pillar — the light can creep a step around a corner, but seeing
// what something is takes a clear view of it.
function clearLineTo(row, col) {
  return clearLine(state.floor.playerRow, state.floor.playerCol, row, col);
}

// How many tiles (row, col) is from the player, any way, diagonals included.
function tilesAway(row, col) {
  return Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol));
}

// Whether the player can make out what's on (row, col), rather than a
// '?': within REVEAL_DISTANCE with nothing solid in between (DEV -> Fog
// off: always).
export function canMakeOut(row, col) {
  if (!state.settings.fogEnabled) return true;
  return tilesAway(row, col) <= REVEAL_DISTANCE && clearLineTo(row, col);
}
