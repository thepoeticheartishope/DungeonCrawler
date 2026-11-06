// Smooth walk: every way the player walks feels the same (Timothy). Tuned
// on the old isometric map (removed 2026-10-18), where a grid step (N/E/S/W) moves the stick man about half a
// tile across and a quarter down, ↑ / ↓ (grid NW / SE) half a tile, and
// ← / → (grid SW / NE) a whole tile. With one step time for all of them,
// ← and → lunged twice as fast as the rest. Here a step's slide takes as
// long as its length on screen needs, so all eight move at the same speed.
// Rules only — no DOM access here.

import { MAP_ANIMATION_MS } from './config.js';

// How far a step of (dRow, dCol) moves on screen, in tile widths. The same
// sums as the old isometric map's isoScreenOffset (x = (dc - dr) / 2, y = (dc + dr) / 4).
function screenLength(dRow, dCol) {
  return Math.hypot((dCol - dRow) / 2, (dCol + dRow) / 4);
}

// A grid step's length on screen, the one MAP_ANIMATION_MS.step was tuned for.
const GRID_STEP = screenLength(1, 0);

// How long the slide of one step (dRow, dCol) takes, in ms.
export function stepMs(dRow, dCol) {
  return Math.round(MAP_ANIMATION_MS.step * screenLength(dRow, dCol) / GRID_STEP);
}
