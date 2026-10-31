// The ship's run (ship plan step C, `ideas/ship-plan.md` outside the repo;
// Timothy 2026-10-30): "There's Been a Tragedy". The captain is dead, the
// player takes command, and the ship must reach the planet before the
// arrival clock runs out. The tension is the clock and the crew's panic,
// not monsters: each failure while teaching (a wrong breaker answer, a burn
// window missed) raises the panic a step, a run of right answers calms it,
// and the higher it is the harder the crew's game gets (shorter burns,
// wires that slip, questions on a timer). Broken, the run is lost. The
// tragedy that starts it is random and only flavor. main.js startGame
// calls freshShipRun(); worldFrame runs shipFrame() each frame; stations.js
// reports misses and right answers (crewMissed, crewRight) and burns
// (burnMade). No DOM access here.

import { state } from './state.js';
import { SHIP_RUN, TRAGEDY_PARTS } from './config.js';
import { rotated, powered } from './charger.js';

// A new ship run: the clock full, the crew calm, nothing trained, and a
// tragedy rolled (rollTragedy).
export function freshShipRun(rand = Math.random) {
  state.run.ship = { clockMs: SHIP_RUN.missionMs, panic: 0, streak: 0, training: null, tragedy: rollTragedy(rand) };
  state.run.trained = [];
  state.run.burns = 0;
  state.run.crewFailures = 0;
}

// The run's tragedy, as numbers into text.js's lists (TRAGEDY_PARTS):
// which captain, how they died, the ship's name and the planet, and the
// day of the crossing. Flavor only: nothing in play reads it.
export function rollTragedy(rand = Math.random) {
  const pick = n => 1 + Math.floor(rand() * n);
  return {
    day: 30 + Math.floor(rand() * 60),
    captain: pick(TRAGEDY_PARTS.captain), cause: pick(TRAGEDY_PARTS.cause),
    ship: pick(TRAGEDY_PARTS.ship), planet: pick(TRAGEDY_PARTS.planet),
  };
}

// The crew's panic now: 0 Calm to SHIP_RUN.brokenAt Broken.
export function panicLevel() {
  return state.run.ship ? state.run.ship.panic : 0;
}

// A failure while teaching: panic up a step and the run of right answers
// broken. At Broken the run is lost.
// Events: panicRose { level }, then shipEnded { how: 'panic' } at Broken.
export function crewMissed() {
  const ship = state.run.ship;
  if (!ship) return [];
  ship.streak = 0;
  ship.panic = Math.min(ship.panic + 1, SHIP_RUN.brokenAt);
  const events = [{ type: 'panicRose', level: ship.panic }];
  if (ship.panic >= SHIP_RUN.brokenAt) events.push({ type: 'shipEnded', how: 'panic' });
  return events;
}

// A right answer while teaching: SHIP_RUN.calmStreak in a row bring the
// panic down a step and start the count again.
// Events: panicEased { level }, or nothing.
export function crewRight() {
  const ship = state.run.ship;
  if (!ship) return [];
  ship.streak++;
  if (ship.panic === 0 || ship.streak < SHIP_RUN.calmStreak) return [];
  ship.panic--;
  ship.streak = 0;
  return [{ type: 'panicEased', level: ship.panic }];
}

// A full burn: with SHIP_RUN.burnsNeeded of them the ship arrives.
// Events: shipEnded { how: 'arrived' }, or nothing.
export function burnMade() {
  return state.run.burns >= SHIP_RUN.burnsNeeded ? [{ type: 'shipEnded', how: 'arrived' }] : [];
}

// How long a new burn may take, by the panic now: Uneasy or worse cuts it.
export function burnMs() {
  return SHIP_RUN.burnMs - (panicLevel() >= 1 ? SHIP_RUN.uneasyCutMs : 0);
}

// How often a wire slips while teaching, by the panic now (0: never).
export function slipEveryMs() {
  return SHIP_RUN.slipEveryMs[Math.min(panicLevel(), SHIP_RUN.slipEveryMs.length - 1)] || 0;
}

// The modifiers a breaker's question carries: the Timer once the crew is
// Panicking (SHIP_RUN.timerAt), none before.
export function breakerModifiers() {
  return panicLevel() >= SHIP_RUN.timerAt ? ['timer'] : [];
}

// Starts the training period for `role` at the console (SHIP_RUN.trainMs),
// once: a role already trained or in training is left alone.
export function startTraining(role) {
  const ship = state.run.ship;
  if (!ship || ship.training || state.run.trained.includes(role)) return;
  ship.training = { role, leftMs: SHIP_RUN.trainMs };
}

// The ship's clocks, `dtMs` on (main.js worldFrame, only while the world
// runs: the ask screen pauses them). The arrival clock runs down; at 0 the
// run is lost. A training period ends and the role is learned. A board's
// burn window (stations.js `burnLeftMs`) runs down; missed, its wires clear
// and it counts as a failure. While a burn is on, a Shaken or worse crew
// slips a wire it has powered every slipEveryMs.
// Events: shipEnded { how: 'clock' }, trainingOver { role },
// burnMissed { prop } then crewMissed's, wireSlipped { prop, index }.
export function shipFrame(dtMs, rand = Math.random) {
  const ship = state.run.ship;
  if (!ship || !state.floor.ship || state.run.runEnded) return [];
  ship.clockMs = Math.max(ship.clockMs - dtMs, 0);
  if (ship.clockMs === 0) return [{ type: 'shipEnded', how: 'clock' }];
  const events = [];
  if (ship.training) {
    ship.training.leftMs -= dtMs;
    if (ship.training.leftMs <= 0) {
      const { role } = ship.training;
      ship.training = null;
      if (!state.run.trained.includes(role)) state.run.trained.push(role);
      events.push({ type: 'trainingOver', role });
    }
  }
  state.floor.props.filter(p => p.puzzle && p.burnLeftMs != null).forEach(prop => {
    prop.burnLeftMs -= dtMs;
    if (prop.burnLeftMs <= 0) {
      prop.puzzle = null;
      prop.burnLeftMs = null;
      events.push({ type: 'burnMissed', prop }, ...crewMissed());
      return;
    }
    const every = slipEveryMs();
    if (!every) return;
    prop.slipInMs = (prop.slipInMs ?? every) - dtMs;
    if (prop.slipInMs > 0) return;
    prop.slipInMs = every;
    const live = [...powered(prop.puzzle).on].filter(i => !(prop.puzzle.breakers || []).includes(i));
    if (!live.length) return;
    const index = live[Math.floor(rand() * live.length)];
    prop.puzzle.wires[index] = rotated(prop.puzzle.wires[index]);
    events.push({ type: 'wireSlipped', prop, index });
  });
  return events;
}
