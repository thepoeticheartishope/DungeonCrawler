// The ship's crew roles (crew roles plan, `ideas/crew-roles-plan.md`
// outside the repo; Timothy 2026-10-30: a role for each minigame). Each
// role (SHIP_ROLES) is a crew member in a room whose job is
// SHIP_JOB.rounds rounds of one minigame. A miss is a crew failure (ship.js
// crewMissed); after the last round the role is taught, and SHIP_JOB.passAt
// right or more gives the run its benefit for good. Each role is taught
// once a run. A role whose minigame can't run on the loaded set sits out
// (minigames.js roleCanRun). Learning a role comes first
// (state.run.trained). The Engineer is the wires (stations.js), not one of
// these. stations.js calls useCrew() on a bump; gunactions.js asks each
// round and settles it here (settleRound). No DOM access here.

import { state } from './state.js';
import { SHIP_ROLES, SHIP_JOB } from './config.js';
import { roleCanRun } from './minigames.js';
import { crewMissed, crewRight } from './ship.js';

// The role `id` (SHIP_ROLES), or null for the Engineer or an unknown one.
export function roleOf(id) {
  return SHIP_ROLES.find(r => r.id === id) || null;
}

// Whether role `id` is on duty this run: its minigame can run on the set.
export function onDuty(id) {
  const role = roleOf(id);
  return Boolean(role) && roleCanRun(role.minigame);
}

// The roles on duty this run, in SHIP_ROLES order.
export function rolesOnDuty() {
  return SHIP_ROLES.filter(r => roleCanRun(r.minigame)).map(r => r.id);
}

// Bumping crew member `role` (not the Engineer). Sitting out, already
// taught, or not yet learned, they only speak; otherwise their job starts
// (`state.run.ship.job`), its first round asked by gunactions.js.
// Events: crewSpoke { role, sitsOut | taught | trained }, or
// jobStarted { role, minigame }.
export function useCrew(role) {
  const ship = state.run.ship;
  const def = roleOf(role);
  if (!def || !ship) return [];
  if (!onDuty(role)) return [{ type: 'crewSpoke', role, sitsOut: true }];
  if (ship.taught.includes(role)) return [{ type: 'crewSpoke', role, taught: true }];
  if (!state.run.trained.includes(role)) return [{ type: 'crewSpoke', role, trained: false }];
  ship.job = { role, round: 0, right: 0 };
  return [{ type: 'jobStarted', role, minigame: def.minigame }];
}

// One round of the job answered: right counts toward the benefit (and
// calming, ship.js crewRight); a miss is a crew failure. After the last
// round the role is taught: SHIP_JOB.passAt right or more and its benefit
// helps the run (applyBenefit), fewer and the job went badly.
// Events: roundRight or roundMissed { round, of } then crewRight's /
// crewMissed's; after the last round roleHelped { role, benefit } then
// applyBenefit's, or jobWentBadly { role, right }.
export function settleRound(isCorrect) {
  const ship = state.run.ship;
  const job = ship && ship.job;
  if (!job) return [];
  job.round++;
  const of = SHIP_JOB.rounds;
  const events = isCorrect
    ? [{ type: 'roundRight', round: job.round, of }, ...crewRight()]
    : [{ type: 'roundMissed', round: job.round, of }, ...crewMissed()];
  if (isCorrect) job.right++;
  else state.run.crewFailures++;
  if (job.round < of) return events;
  ship.job = null;
  ship.taught.push(job.role);
  if (job.right < SHIP_JOB.passAt) return [...events, { type: 'jobWentBadly', role: job.role, right: job.right }];
  const { benefit } = roleOf(job.role);
  return [...events, { type: 'roleHelped', role: job.role, benefit: benefit.kind }, ...applyBenefit(benefit)];
}

// Whether a job is under way (its rounds still being asked).
export function jobOn() {
  return Boolean(state.run.ship && state.run.ship.job);
}

// A taught role's benefit, for good (SHIP_ROLES `benefit`): more clock, a
// burn fewer, a shield, panic down, quicker calming, rarer slips, longer
// burn windows, or a shield for a missed window. The run's burns already
// made may now be enough: then the ship arrives.
// Events: panicEased { level } for panicDown with any panic, or
// shipEnded { how: 'arrived' } when a burn fewer is already reached.
export function applyBenefit(benefit) {
  const ship = state.run.ship;
  switch (benefit.kind) {
    case 'clock': ship.clockMs += benefit.ms; return [];
    case 'burns':
      ship.burnsNeeded = Math.max(1, ship.burnsNeeded - 1);
      return state.run.burns >= ship.burnsNeeded ? [{ type: 'shipEnded', how: 'arrived' }] : [];
    case 'shield': ship.shields++; return [];
    case 'panicDown':
      if (ship.panic === 0) return [];
      ship.panic--;
      return [{ type: 'panicEased', level: ship.panic }];
    case 'calm': ship.calmStreak = Math.min(ship.calmStreak, benefit.streak); return [];
    case 'slips': ship.slipFactor *= benefit.factor; return [];
    case 'burnWindow': ship.burnBonusMs += benefit.ms; return [];
    case 'windowShield': ship.windowShields++; return [];
    default: return [];
  }
}
