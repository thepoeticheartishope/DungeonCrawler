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
// that they are ready once the role is trained. A board for a role not yet
// trained stays shut. Otherwise the wires open: the ones left half done
// (`kept`), else new ones for the mode (SHIP_STATIONS).
// Events: crewSpoke { role, trained }, stationLocked { role }, or
// stationOpened { station, mode, kept }.
export function useStation(prop, rand = Math.random) {
  const trained = state.run.trained.includes(prop.role);
  if (prop.kind === 'crew') return [{ type: 'crewSpoke', role: prop.role, trained }];
  const mode = stationMode(prop);
  if (mode === 'teach' && !trained) return [{ type: 'stationLocked', role: prop.role }];
  const kept = !!prop.puzzle;
  if (!kept) prop.puzzle = makeWires(SHIP_STATIONS[mode].size, rand, SHIP_STATIONS[mode].breakers);
  return [{ type: 'stationOpened', station: prop, mode, kept }];
}

// A breaker's question answered at `prop`'s wires. Right closes breaker
// `index`; wrong leaves it open for another question. Wrong while teaching
// is a crew failure (state.run.crewFailures); while training it is free.
// If the power then joins up, the station is done (stationDone).
// Events: breakerClosed { index }, or breakerSparked { index, teach },
// then stationDone's.
export function settleBreaker(prop, index, isCorrect) {
  const puzzle = prop.puzzle;
  if (!puzzle) return [];
  const teach = stationMode(prop) === 'teach';
  if (!isCorrect) {
    if (teach) state.run.crewFailures++;
    return [{ type: 'breakerSparked', index, teach }];
  }
  if (!puzzle.closed.includes(index)) puzzle.closed.push(index);
  const events = [{ type: 'breakerClosed', index }];
  if (powered(puzzle).done) events.push(...stationDone(prop));
  return events;
}

// The power joined up at `prop` (charger.js turnWire's `finish`, or the last
// breaker closing): at the console the role is learned; at the board the
// crew member makes a full burn. The wires clear for next time.
// Events: stationTrained { role }, or burnDone { role, burns }.
export function stationDone(prop) {
  prop.puzzle = null;
  if (stationMode(prop) === 'train') {
    if (!state.run.trained.includes(prop.role)) state.run.trained.push(prop.role);
    return [{ type: 'stationTrained', role: prop.role }];
  }
  state.run.burns++;
  return [{ type: 'burnDone', role: prop.role, burns: state.run.burns }];
}
