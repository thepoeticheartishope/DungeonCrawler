// The step tables for walking the grid one tile at a time: four ways
// (no diagonals) and eight. One copy, so every search over the floor tries
// the ways in the same order. Data only — no DOM access here.

// North, south, east and west as [dRow, dCol], in the order every
// four-way search has always used.
export const FOUR_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// The four ways plus the four diagonals, as noise.js and vents.js spread.
export const EIGHT_STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
