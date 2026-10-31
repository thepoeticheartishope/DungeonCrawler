// The ship's run (ship plan step C, `ideas/ship-plan.md` outside the repo;
// Timothy 2026-10-30): "There's Been a Tragedy". The captain is dead, the
// player takes command, and the ship must reach the planet. No timers
// (Timothy 2026-10-31: time pressure goes against teaching): the tension is
// the crew's panic, not monsters or a clock. Each failure while teaching (a
// wrong breaker answer, a failed round of a crew member's minigame) raises
// the panic a step, a run of right answers calms it, and the higher it is
// the harder the crew's work gets (wires that slip). Broken, the run is
// lost. Learning at the console stays free. The
// tragedy that starts it is random and only flavor. main.js startGame
// calls freshShipRun(); worldFrame runs shipFrame() each frame; stations.js
// reports misses and right answers (crewMissed, crewRight) and burns
// (burnMade). No DOM access here.

import { state } from './state.js';
import { SHIP_RUN, TRAGEDY_PARTS } from './config.js';
import { rotated, powered } from './charger.js';

// A new ship run: the clock full, the crew calm, nothing trained, and a
// tragedy rolled (rollTragedy).
// What the crew roles have given the run (roles.js; crew roles plan) starts
// at the plain numbers: the burns needed, the right answers that calm, how
// much rarer slips are, extra burn window, and shields against panic.
export function freshShipRun(rand = Math.random) {
  state.run.ship = {
    panic: 0, streak: 0, tragedy: rollTragedy(rand),
    burnsNeeded: SHIP_RUN.burnsNeeded, calmStreak: SHIP_RUN.calmStreak, slipFactor: 1,
    shields: 0, taught: [], job: null, learning: null, onDuty: null,
  };
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
// broken. At Broken the run is lost. A shield (the Comms officer's)
// takes the step instead, once.
// Events: panicShielded, or panicRose { level }, then
// shipEnded { how: 'panic' } at Broken.
export function crewMissed() {
  const ship = state.run.ship;
  if (!ship) return [];
  ship.streak = 0;
  if (ship.shields > 0) {
    ship.shields--;
    return [{ type: 'panicShielded' }];
  }
  ship.panic = Math.min(ship.panic + 1, SHIP_RUN.brokenAt);
  const events = [{ type: 'panicRose', level: ship.panic }];
  if (ship.panic >= SHIP_RUN.brokenAt) events.push({ type: 'shipEnded', how: 'panic' });
  return events;
}

// A right answer while teaching: the run's calmStreak in a row
// (SHIP_RUN.calmStreak, fewer once the Cook is taught) bring the panic
// down a step and start the count again.
// Events: panicEased { level }, or nothing.
export function crewRight() {
  const ship = state.run.ship;
  if (!ship) return [];
  ship.streak++;
  if (ship.panic === 0 || ship.streak < ship.calmStreak) return [];
  ship.panic--;
  ship.streak = 0;
  return [{ type: 'panicEased', level: ship.panic }];
}

// The burns this run needs: SHIP_RUN.burnsNeeded, fewer once the Pilot is
// taught.
export function burnsNeeded() {
  return state.run.ship ? state.run.ship.burnsNeeded : SHIP_RUN.burnsNeeded;
}

// A full burn: with burnsNeeded() of them the ship arrives.
// Events: shipEnded { how: 'arrived' }, or nothing.
export function burnMade() {
  return state.run.burns >= burnsNeeded() ? [{ type: 'shipEnded', how: 'arrived' }] : [];
}

// How often a wire slips while teaching, by the panic now (0: never),
// rarer once the Systems tech is taught.
export function slipEveryMs() {
  const every = SHIP_RUN.slipEveryMs[Math.min(panicLevel(), SHIP_RUN.slipEveryMs.length - 1)] || 0;
  return every * (state.run.ship ? state.run.ship.slipFactor : 1);
}

// The ship's world, `dtMs` on (main.js worldFrame, only while the world
// runs: the ask screen pauses it). No clocks run down (Timothy
// 2026-10-31). While a burn is under way at a board, a Shaken or worse crew
// slips a wire it has powered every slipEveryMs: panic makes the work
// harder, not shorter. Events: wireSlipped { prop, index }.
export function shipFrame(dtMs, rand = Math.random) {
  const ship = state.run.ship;
  if (!ship || !state.floor.ship || state.run.runEnded) return [];
  const events = [];
  state.floor.props.filter(p => p.puzzle && p.kind === 'powerBoard').forEach(prop => {
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
