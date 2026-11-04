// The charger (charger plan, `ideas/charger-plan.md` outside the repo;
// Timothy 2026-10-19): a machine in the start room that fills energy to
// full for free. Its puzzle, CHARGE.SYS, is a square of wires to turn until
// power runs from PWR (the left edge) to the CELL (the right edge). There is
// no wrong move and no fail state; the cost is time, a turn every
// CHARGER.wireTurnsPerTurn wire turns. Half-done wires stay as they were
// left; a charge clears them, so the next use gets new ones. No limit on
// uses. floor.js buildFloor() calls placeCharger(). The wire puzzle
// itself lives in wires.js (the ship uses it too). No DOM access here.

import { state } from './state.js';
import { CHARGER, ENERGY_MAX, LIGHT_BATTERY_MAX } from './config.js';
import { batteryInPlay } from './battery.js';
import { startRoom } from './desk.js';
import { addRounds } from './gun.js';
import { makeWires } from './wires.js';

// The wires' size on this depth (CHARGER.sizes, the last for any deeper).
export function wireSize() {
  const sizes = CHARGER.sizes;
  return sizes[Math.min(state.run.roomIndex, sizes.length - 1)];
}

// The floor's one charger, in the room holding `layout.start`, on the
// furniture's rules, never on a `taken` tile (the desk's among them). Null
// if the room has no spot for it. Returns { row, col, kind: 'charger' } or null.
export function placeCharger(layout, placer, taken) {
  const room = startRoom(layout);
  if (!room) return null;
  const free = room.floorCells.filter(p => !taken.some(q => q.row === p.row && q.col === p.col));
  const spot = placer.pick(free, true);
  return spot ? { ...spot, kind: 'charger' } : null;
}

// The kind voice's line the first time in a run the player makes out a
// charger (its tile in their light: sight.js marks it `identified`), so they
// learn it is safe and what it is for (Timothy's rule: every new mechanic
// gets a tutorial beat). Once a run.
// Returns whispered { line: 'tut.charger', tone: 'kind' }, or nothing.
export function chargerLine() {
  if (state.run.chargerTold) return [];
  if (!state.floor.props.some(p => p.kind === 'charger' && p.identified)) return [];
  state.run.chargerTold = true;
  return [{ type: 'whispered', line: 'tut.charger', tone: 'kind' }];
}

// Bumping the charger. At full energy nothing opens (Timothy 2026-10-26).
// Otherwise CHARGE.SYS opens on its wires: the ones left half done
// (`kept`), else new ones for this depth. No turn is spent.
// Events: chargerFull, or chargerOpened { charger, kept }.
export function useCharger(charger, rand = Math.random) {
  if (!chargerHasMore()) return [{ type: 'chargerFull' }];
  const kept = !!charger.puzzle;
  if (!kept) charger.puzzle = makeWires(wireSize(), rand);
  return [{ type: 'chargerOpened', charger, kept }];
}

// Whether a charger has something to give: energy short of ENERGY_MAX, or
// (Timothy 2026-10-26) the light's battery short of full while it is in
// play. Its cell window glows while it does (mapview.js).
export function chargerHasMore() {
  if (state.run.energy < ENERGY_MAX) return true;
  return batteryInPlay() && state.floor.light.charge < LIGHT_BATTERY_MAX;
}

// The light's battery to full, unlocked, as a charge leaves it (Timothy
// 2026-10-26). The tutorial's steady light is left alone. Returns whether
// it gave the light anything.
function chargeLight() {
  const light = state.floor.light;
  if (!batteryInPlay() || light.steady || light.charge >= LIGHT_BATTERY_MAX) return false;
  light.charge = LIGHT_BATTERY_MAX;
  light.locked = false;
  return true;
}

// The charger's power joined up (wires.js turnWire's `finish`): energy to
// full with plain rounds, the light's battery too, and the wires cleared
// for next time.
// Events: charged { gained, light }.
export function chargeUp(charger) {
  const gained = Math.max(ENERGY_MAX - state.run.energy, 0);
  addRounds(gained);
  const light = chargeLight();
  charger.puzzle = null;
  return [{ type: 'charged', gained, light }];
}
