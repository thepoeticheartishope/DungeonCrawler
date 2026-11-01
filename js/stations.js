// The ship's stations (ship plan step B, `ideas/ship-plan.md` outside the
// repo; Timothy 2026-10-30): where the player learns a crew role and then
// teaches it. Each role has a training console in Command (`console`), its
// board in its own room (`powerBoard` for the Engineer) and the crew member
// standing by it (`crew`). Console and board run the charger's wires
// (charger.js) with breakers on the path that close only on a right
// answer. At the console a wrong answer costs nothing; at the board it is a
// failure, and the crew's panic will feed on those (step C). The board
// opens only once the role is trained. floor.js buildShipFloor() calls
// placeStations(); moves.js calls useStation() on a bump; main.js runs the
// wires and gunactions.js asks a breaker's question. No DOM access here.

import { state } from './state.js';
import { makeWires, powered } from './charger.js';
import { SHIP_STATIONS } from './config.js';
import { crewMissed, crewRight } from './ship.js';
import { useCrew, arrivedIfAllTaught } from './roles.js';

// The plan's stations ([kind, row, col, role], plans.js `stations`) as
// solid props on the furniture's rules (placer.tryBlock), never on a
// `taken` tile. One that can't go down is left out. Returns
// [{ row, col, kind, role }].
export function placeStations(stations, placer, taken) {
  return (stations || [])
    .filter(([, row, col]) => !taken.some(p => p.row === row && p.col === col))
    .filter(([, row, col]) => placer.tryBlock([{ row, col }], true))
    .map(([kind, row, col, role]) => ({ row, col, kind, role }));
}

// What `prop` runs: 'train' at a console, 'teach' at a board.
export function stationMode(prop) {
  return prop.kind === 'console' ? 'train' : 'teach';
}

// Whether `prop` is one of the stations' props.
export function isStation(prop) {
  return prop.kind === 'console' || prop.kind === 'powerBoard' || prop.kind === 'crew';
}

// Bumping a station's prop. The crew member speaks: what they need, or
// that they are ready once the role is trained. The console opens its
// list of roles to learn (crew roles plan step B; main.js openConsole):
// the Engineer's wires come through trainWires. A board for a role not yet
// trained stays shut. Otherwise its wires open (openWires).
// Events: crewSpoke { role, trained }, consoleOpened { station },
// stationLocked { role }, or openWires's.
export function useStation(prop, rand = Math.random) {
  const trained = state.run.trained.includes(prop.role);
  // Any crew member but the Engineer has a minigame job (roles.js).
  if (prop.kind === 'crew' && prop.role !== 'engineer') return useCrew(prop.role);
  if (prop.kind === 'crew') return [{ type: 'crewSpoke', role: prop.role, trained }];
  if (prop.kind === 'console') return [{ type: 'consoleOpened', station: prop }];
  if (!trained) return [{ type: 'stationLocked', role: prop.role }];
  // Taught once, like any crew member (no burns to make: step G1).
  if (state.run.ship && state.run.ship.taught.includes(prop.role)) return [{ type: 'crewSpoke', role: prop.role, taught: true }];
  return openWires(prop, rand);
}

// The Engineer picked from the console's list: its training wires open.
// Events: openWires's.
export function trainWires(prop, rand = Math.random) {
  return openWires(prop, rand);
}

// A station's wires open: the ones left half done (`kept`), else new ones
// for its mode (SHIP_STATIONS). A board's wires wait, half done, while the
// player is away (Timothy 2026-10-31: no timers).
// Events: stationOpened { station, mode, kept }.
function openWires(prop, rand) {
  const mode = stationMode(prop);
  const kept = !!prop.puzzle;
  if (!kept) {
    prop.puzzle = makeWires(SHIP_STATIONS[mode].size, rand, SHIP_STATIONS[mode].breakers);
    if (mode === 'teach') prop.slipInMs = null;
  }
  return [{ type: 'stationOpened', station: prop, mode, kept }];
}

// A breaker's question answered at `prop`'s wires. Right closes breaker
// `index`; wrong leaves it open for another question. Wrong while teaching
// is a crew failure (state.run.crewFailures) and raises the panic
// (ship.js crewMissed); right while teaching counts toward calming it
// (crewRight). While training both are free.
// If the power then joins up, the station is done (stationDone).
// Events: breakerClosed { index } then crewRight's, or
// breakerSparked { index, teach } then crewMissed's; then stationDone's.
export function settleBreaker(prop, index, isCorrect) {
  const puzzle = prop.puzzle;
  if (!puzzle) return [];
  const teach = stationMode(prop) === 'teach';
  if (!isCorrect) {
    if (!teach) return [{ type: 'breakerSparked', index, teach }];
    state.run.crewFailures++;
    return [{ type: 'breakerSparked', index, teach }, ...crewMissed()];
  }
  if (!puzzle.closed.includes(index)) puzzle.closed.push(index);
  const events = [{ type: 'breakerClosed', index }, ...(teach ? crewRight() : [])];
  if (powered(puzzle).done) events.push(...stationDone(prop));
  return events;
}

// The power joined up at `prop` (charger.js turnWire's `finish`, or the last
// breaker closing): at the console the role is learned; at the board the
// Engineer is taught (no burns: ship minigames plan step G1), and if that
// was the last crew member the ship arrives. The wires clear.
// Events: stationTrained { role }, or stationTaught { role } then
// roles.js arrivedIfAllTaught's.
export function stationDone(prop) {
  prop.puzzle = null;
  if (stationMode(prop) === 'train') {
    if (!state.run.trained.includes(prop.role)) state.run.trained.push(prop.role);
    return [{ type: 'stationTrained', role: prop.role }];
  }
  const ship = state.run.ship;
  if (ship && !ship.taught.includes(prop.role)) ship.taught.push(prop.role);
  return [{ type: 'stationTaught', role: prop.role }, ...arrivedIfAllTaught()];
}
