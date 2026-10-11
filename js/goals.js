// Floor goals (strategy plan step A): side goals a danger depth asks for,
// paid in myelin as the player goes down the stairs. They reward a careful
// floor without making it required. floor.js buildFloor() calls
// rollGoals(); render.js shows goalMark() for each; main.js calls
// scoreGoals() on the way down. No DOM access here.

import { state } from './state.js';
import { FLOOR_GOALS, GOALS_PER_FLOOR, GOAL_PAPERS_MIN, GOAL_SWIFT_SHARE } from './config.js';

const papers = () => state.floor.props.filter(p => p.kind === 'paper');

// Whether a goal can be asked for on this floor: no paper goal on a floor
// with few papers, no Struggle goal with the gun off.
function fits(id) {
  if (id === 'allPapers') return papers().length >= GOAL_PAPERS_MIN;
  if (id === 'noStruggle') return state.settings.gunCombat;
  if (id === 'swift' || id === 'noHunter') return !!state.floor.boss;
  return true;
}

// Picks this floor's goals at random from the ones that fit. Called once
// the floor's props and boss are in place. Rest floors have none.
export function rollGoals() {
  const pool = FLOOR_GOALS.filter(g => fits(g.id));
  const goals = [];
  while (goals.length < GOALS_PER_FLOOR && pool.length) {
    goals.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  state.floor.goals = goals;
}

// Where a goal stands right now: 'met' (it can't be lost any more),
// 'failed' (it can't be met any more) or 'open' (it's met if the player
// went down now, unless it waits on something still to do).
export function goalState(id) {
  const f = state.floor;
  if (id === 'noMiss') return f.misses ? 'failed' : 'open';
  if (id === 'allPapers') return papers().every(p => p.searched) ? 'met' : 'open';
  if (id === 'noStruggle') return f.struggles ? 'failed' : 'open';
  if (id === 'noHunter') return f.hunter ? 'failed' : 'open';
  // The light stops when the boss falls, so its turns then are the score.
  if (id === 'swift') {
    if (f.lightTurns >= f.lightTurnBudget * GOAL_SWIFT_SHARE) return 'failed';
    return f.boss ? 'open' : 'met';
  }
  return 'open';
}

// Goals that ask for something done (every paper read, the boss down in
// time), not something avoided: open isn't enough for these.
const NEEDS_DOING = ['allPapers', 'swift'];

// Whether a goal pays if the player goes down now: a goal that asks to
// avoid something is kept by leaving now; one that asks for something done
// needs it done.
function paysNow(id) {
  const now = goalState(id);
  if (now === 'failed') return false;
  return !NEEDS_DOING.includes(id) || now === 'met';
}

// Scores the floor's goals as the player goes down the stairs. Each goal
// kept pays its `pay` in myelin, flat: not through goldReward, since the
// player nearly always leaves in the darkness, which would just double
// every goal. Events, one per goal in the HUD's order: goalMet { id, gold } or goalMissed { id }.
export function scoreGoals() {
  return state.floor.goals.map(g => {
    if (!paysNow(g.id)) return { type: 'goalMissed', id: g.id };
    const gold = g.pay;
    state.run.coinsTotal += gold;
    return { type: 'goalMet', id: g.id, gold };
  });
}

// The HUD's mark for a goal: kept if the player went down now, lost, or
// not there yet.
export function goalMark(id) {
  if (goalState(id) === 'failed') return 'failed';
  return paysNow(id) ? 'kept' : 'open';
}
