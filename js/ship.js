// The ship's run (ship plan step C, `ideas/ship-plan.md` outside the repo;
// Timothy 2026-10-30): "There's Been a Tragedy". The captain is dead, the
// player takes command, and the ship must reach the planet. No timers
// (Timothy 2026-10-31: time pressure goes against teaching): the tension is
// the crew's panic, not monsters or a clock. Each failure while teaching (a
// wrong breaker answer, a failed round of a crew member's minigame) raises
// the panic a step, a run of right answers calms it. Panic is only the
// crew's health: it makes nothing harder (Timothy 2026-11-01). Broken, the
// run is lost. Learning at the console stays free. The
// tragedy that starts it is random and only flavor. main.js startGame
// calls freshShipRun(); stations.js reports misses and right answers (crewMissed, crewRight). No burns
// (ship minigames plan step G1). No DOM access here.

import { state } from './state.js';
import { SHIP_RUN, TRAGEDY_PARTS } from './config.js';

// A new ship run: the clock full, the crew calm, nothing trained, and a
// tragedy rolled (rollTragedy).
// What the crew roles have given the run (roles.js; crew roles plan) starts
// at the plain numbers: the right answers that calm, and shields against
// panic.
export function freshShipRun(rand = Math.random) {
  state.run.ship = {
    panic: 0, streak: 0, tragedy: rollTragedy(rand),
    calmStreak: SHIP_RUN.calmStreak,
    shields: 0, taught: [], job: null, learning: null, onDuty: null,
    perfect: {}, // minigame -> perfect solves this run: each game gets harder with them (minigames.js minigameLevel, inferenceLevel)
  };
  state.run.trained = [];
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
