// The shape of a run: which floor comes next. A run is
//   opening rest -> depth 1 -> rest -> depth 2 -> rest -> depth 3 -> epilogue rest -> win
// main.js advanceRoom() asks nextFloor() and builds what it says (or shows
// the win screen); startGame() starts on the opening rest.
// No DOM access here.

import { state } from './state.js';

// Moves the run on by one floor and says what the new one is:
//   { kind: 'depth' }                         a danger floor at state.run.roomIndex
//   { kind: 'rest', rest: 'between' | 'epilogue' }
//   { kind: 'win' }                           the epilogue is behind the player
// roomIndex counts danger depths only. It goes up as a depth is left, so a
// rest floor never changes which recipe, wording or odds the next depth
// gets, and the epilogue is the rest that comes once every depth is done.
export function nextFloor() {
  const run = state.run;
  if (run.resting) {
    if (run.roomIndex >= run.order.length) return { kind: 'win' };
    run.resting = false;
    return { kind: 'depth' };
  }
  run.roomIndex++;
  run.resting = true;
  return { kind: 'rest', rest: run.roomIndex >= run.order.length ? 'epilogue' : 'between' };
}
