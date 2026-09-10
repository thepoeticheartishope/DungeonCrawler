// Shared foundation used across modules.
//
// This file starts small on purpose — it currently holds only the one
// helper nearly every other module needs. The shared mutable game state
// (hearts, boss, minions, grid size, and so on) will move here in a later
// step, once the modules that touch it are ready to be split out too.

// Turns a (row, col) pair into the string key used everywhere tiles are
// stored in a Set or looked up by position.
export function key(r, c) {
  return r + ',' + c;
}
