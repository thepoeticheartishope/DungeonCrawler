// What the player's walk finds on the map: bumping into things, and what
// a new tile holds (the safe room, a new room). Changes state
// and returns an events list in the order things happened; main.js
// drawEvents() draws it and picks the wording. No DOM access here.

import { state, key } from './state.js';
import { isStation, useStation } from './stations.js';
import { enterSafeRoom, autoShutters } from './saferoom.js';

import { computeVisibility } from './sight.js';

// What a bump into `block` (passage.js whatBlocks) does: a prop is
// examined (examineProp), and anything else just stops the player.
// Used by free walking (walk.js). Events:
// blocked { kind, thing }, or examineProp's events.
export function bumpInto(block) {
  if (block.kind === 'prop') return examineProp(block.thing);
  return [{ type: 'blocked', kind: block.kind, thing: block.thing }];
}

// The player has just come onto the tile they now stand on
// (playerRow / playerCol, already set): the light is worked out again and
// whatever lies there counts. Called by free walking (walk.js). Events:
// stepped { facing }, then reachBroken from
// crossing into the safe room (saferoom.js enterSafeRoom) and
// roomEntered { name }.
export function enterTile(facing) {
  const events = [];
  const newRow = state.floor.playerRow;
  const newCol = state.floor.playerCol;
  // The ship's shutters open and shut by themselves (saferoom.js), before
  // the light is worked out, so a shut one casts its shadow.
  autoShutters();
  computeVisibility();
  events.push({ type: 'stepped', facing });


  events.push(...enterSafeRoom());
  // First step into a room: its name.
  const chamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  if (chamber !== undefined && !state.floor.visitedChambers.has(chamber)) {
    state.floor.visitedChambers.add(chamber);
    events.push({ type: 'roomEntered', name: state.floor.chamberNames[chamber] || null });
  }
  return events;
}

// Bumping a prop. A ship station's console, board or crew member opens
// its wires or speaks (stations.js useStation), no turn spent. Anything
// else (a shutter: they are automatic, saferoom.js autoShutters) just
// stops the player.
// Events: blocked, or crewSpoke, stationLocked, stationOpened
// (stations.js useStation).
function examineProp(prop) {
  if (prop.searched || !isStation(prop)) return [{ type: 'blocked', kind: 'prop', thing: prop }];
  prop.identified = true;
  return useStation(prop);
}
