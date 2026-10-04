// The gun (gun combat plan, step 3): reloading by answering a question,
// picking a target on the map, firing at a minion in the player's light,
// the damage bar, a minion's strike when it reaches the player, and a
// landed shot staggering the hunter. Played with DEV -> Combat on gun
// (state.settings.gunCombat): main.js runs reload and fire as turns, and
// combat.js advanceMonsters calls minionStrike. Each rule changes state and returns an events list
// in the order things happened, for main.js drawEvents() to draw.
// Spending the turn (minions move, the light spreads) is the caller's job.
// No DOM access here.

import { state, key } from './state.js';
import {
  BATTLE_CHOICE_COUNT, GUN_CHAMBER, GUN_RELOAD_MODIFIERS, GUN_RELOAD_ROUNDS, GUN_HIT_HALF,
  MINION_KINDS, MINION_STRIKE_COST, DARK_MISS_COST, HUNTER_REST_TURNS,
} from './config.js';
import { fightGroups, shuffle } from './quiz.js';
import { recordHauntAnswer } from './haunts.js';
import { shootBlock, canShoot, aimChance } from './sight.js';
import { goldReward } from './moves.js';
import { tileOccupied } from './combat.js';

// The category the next reload asks from, as { label, category, pool }.
// Categories come round in a fixed order (the same groups the battle
// screen offers), so the player can see what's next and plan for it. A
// set with no categories gives one group, the whole set, with no label.
export function reloadCategory() {
  const pool = state.settings.activeData;
  const groups = fightGroups(pool, BATTLE_CHOICE_COUNT);
  if (!groups.length) return { label: null, category: null, pool };
  return groups[state.run.reloadIndex % groups.length];
}

// What a reload offers right now: null and why not ('chamberFull'), or
// the next category and three ways to answer it, plain to hardest:
// [{ modifiers, rounds, room }]. No modifier loads 1 round, one loads 2,
// two load 3 (GUN_RELOAD_ROUNDS). `room` is how many of those fit in the
// chamber, so the player can see when a hard reload would be wasted.
// Gambler is never offered: a reload has no gold at stake.
export function reloadOffers() {
  const room = GUN_CHAMBER - state.run.ammo;
  if (room <= 0) return { block: 'chamberFull', category: null, offers: [] };
  const [one, ...pair] = shuffle(GUN_RELOAD_MODIFIERS);
  const offers = [[], [one], pair.slice(0, 2)].map(modifiers => {
    const rounds = GUN_RELOAD_ROUNDS[modifiers.length];
    return { modifiers, rounds, room: Math.min(rounds, room) };
  });
  return { block: null, category: reloadCategory(), offers };
}

// The answer to a reload question (state.battle.currentQuestion) asked
// with `offer`. Right loads the offer's rounds (as many as fit) and counts
// toward state.run.correctTotal; wrong jams: nothing loads, and no heart
// is lost (the turn spent is the cost). A timed-out question is a wrong
// answer. Either way the haunt is recorded and the rotation moves on.
// Events: reloaded { rounds, ammo } or jammed { expected, source }, then
// hauntSilenced / hauntLingers.
export function settleReload(isCorrect, offer) {
  const q = state.battle.currentQuestion;
  const events = [];
  if (isCorrect) {
    const rounds = Math.min(offer.rounds, GUN_CHAMBER - state.run.ammo);
    state.run.ammo += rounds;
    state.run.correctTotal++;
    events.push({ type: 'reloaded', rounds, ammo: state.run.ammo });
  } else {
    events.push({ type: 'jammed', expected: q.meaning, source: q.source });
  }
  const haunt = recordHauntAnswer(q, isCorrect);
  if (haunt === 'silenced') events.push({ type: 'hauntSilenced' });
  else if (haunt === 'lingers') events.push({ type: 'hauntLingers' });
  state.run.reloadIndex++;
  return events;
}

// The player tapped `tile` on the map. A minion or the hunter standing
// there, in sight (visibleSet, so the map is showing it), becomes the gun's
// target, even if it can't be shot right now: the map then says why not.
// Anything else clears the target. Picking costs no turn.
// Events: targetPicked { target } or targetCleared.
export function pickTarget(tile) {
  const f = state.floor;
  const target = f.minions.find(m => m.row === tile.row && m.col === tile.col);
  const seen = target && (!state.settings.fogEnabled || f.visibleSet.has(key(target.row, target.col)));
  if (!seen) {
    f.gunTarget = null;
    return [{ type: 'targetCleared' }];
  }
  f.gunTarget = target;
  return [{ type: 'targetPicked', target }];
}

// What the gun can fire at right now: seen minions and the hunter that
// sight.js canShoot allows, best aim first (so the nearest comes first).
function shootable() {
  const f = state.floor;
  return f.minions
    .filter(m => !state.settings.fogEnabled || f.visibleSet.has(key(m.row, m.col)))
    .filter(canShoot)
    .sort((a, b) => aimChance(b) - aimChance(a));
}

// Keeps the gun's target up to date after a turn: a target that died,
// went out of sight or can no longer be shot is dropped, and with none,
// the best shootable thing is picked, so FIRE always has something to
// aim at when anything is in reach. A target the player tapped that
// can't be shot stays until the next turn, so the map can say why not.
// Events: targetPicked { target, auto: true } when it picks one.
export function refreshGunTarget() {
  const f = state.floor;
  if (f.gunTarget && (!f.minions.includes(f.gunTarget) || !canShoot(f.gunTarget))) f.gunTarget = null;
  if (f.gunTarget) return [];
  const best = shootable()[0];
  if (!best) return [];
  f.gunTarget = best;
  return [{ type: 'targetPicked', target: best, auto: true }];
}

// The next shootable thing after the current target, best aim first,
// round and round (T on the keyboard). Costs no turn.
// Events: targetPicked { target }, or fireBlocked { reason: 'noTarget' }
// when nothing is in reach.
export function cycleTarget() {
  const list = shootable();
  if (!list.length) return [{ type: 'fireBlocked', target: null, reason: 'noTarget' }];
  const target = list[(list.indexOf(state.floor.gunTarget) + 1) % list.length];
  state.floor.gunTarget = target;
  return [{ type: 'targetPicked', target }];
}

// Why `target` can't be fired at right now, or null if it can: an empty
// chamber ('chamberEmpty'), no target ('noTarget'), something that isn't
// a minion or the hunter ('notShootable': the boss and items stay on the
// battle screen), or a sight.js shootBlock reason.
export function fireBlock(target) {
  if (state.run.ammo <= 0) return 'chamberEmpty';
  if (!target) return 'noTarget';
  if (target.kind !== 'minion' && target.kind !== 'hunter') return 'notShootable';
  return shootBlock(target);
}

// Fires one round at `target`. The aim chance (sight.js aimChance) decides
// whether it lands. A miss is the end of it. A landed shot on a minion
// waits for the damage bar (state.battle.aim; settleShot finishes it); one
// on the hunter staggers it, since it can't be hurt. A blocked shot spends
// nothing.
// Events: fireBlocked { target, reason }, or shotFired { target, chance }
// then shotMissed { target }, aimStarted { target, hitHalf, weakWidth }
// or hunterStaggered { hunter }.
export function fire(target) {
  const reason = fireBlock(target);
  if (reason) return [{ type: 'fireBlocked', target, reason }];
  state.run.ammo--;
  const chance = aimChance(target);
  const events = [{ type: 'shotFired', target, chance }];
  if (Math.random() >= chance) {
    events.push({ type: 'shotMissed', target });
    return events;
  }
  if (target.kind === 'hunter') {
    events.push(...staggerHunter(target));
    return events;
  }
  state.battle.aim = { target, hitHalf: GUN_HIT_HALF, weakWidth: MINION_KINDS[target.minionKind].weakWidth };
  events.push({ type: 'aimStarted', ...state.battle.aim });
  return events;
}

// The player stopped the damage bar at `barPosition` (0 to 1, centre 0.5)
// for the shot in state.battle.aim. Inside the weak point: 2 damage and a
// limb comes off, if any are left. Inside the hit zone: 1. Anything else
// grazes for 0. A minion with no hp left dies and pays its kind's gold
// (goldReward, so it doubles in the darkness).
// Events: shotGrazed { minion }, or minionHurt { minion, damage, hpLeft,
// weakPoint } and maybe limbLost { minion, limbsLeft }; then, on a kill,
// minionKilled { minion } and goldGained { amount, from: 'kill' }.
export function settleShot(barPosition) {
  const aim = state.battle.aim;
  if (!aim) return [];
  state.battle.aim = null;
  const m = aim.target;
  const off = Math.abs(barPosition - 0.5);
  const damage = off <= aim.weakWidth ? 2 : off <= aim.hitHalf ? 1 : 0;
  if (damage === 0) return [{ type: 'shotGrazed', minion: m }];

  m.hpLeft = Math.max(0, m.hpLeft - damage);
  const events = [{ type: 'minionHurt', minion: m, damage, hpLeft: m.hpLeft, weakPoint: damage === 2 }];
  if (damage === 2 && m.limbs > 0) {
    m.limbs--;
    events.push({ type: 'limbLost', minion: m, limbsLeft: m.limbs });
  }
  if (m.hpLeft > 0) return events;

  state.floor.minions = state.floor.minions.filter(x => x !== m);
  if (state.battle.selectedTarget === m) state.battle.selectedTarget = null;
  if (state.floor.gunTarget === m) state.floor.gunTarget = null;
  const gold = goldReward(MINION_KINDS[m.minionKind].gold);
  state.run.coinsTotal += gold;
  events.push({ type: 'minionKilled', minion: m }, { type: 'goldGained', amount: gold, from: 'kill' });
  return events;
}

// A minion that reached the player strikes: MINION_STRIKE_COST stability,
// DARK_MISS_COST in the darkness (the same as a miss there). Then it is
// knocked back to the oldest tile on its trail, the way it came, unless
// something stands there now; its trail is spent either way, so a second
// strike from the same spot doesn't push it further.
// Events: minionStruck { minion, cost }, knockedBack { minion, from },
// then signalLost at 0 hearts.
export function minionStrike(m) {
  const cost = state.floor.darkness ? DARK_MISS_COST : MINION_STRIKE_COST;
  state.run.hearts -= cost;
  const events = [{ type: 'minionStruck', minion: m, cost }];
  const back = m.trail[0];
  m.trail = [];
  if (back && !tileOccupied(back.row, back.col, m)) {
    const from = { row: m.row, col: m.col };
    m.row = back.row;
    m.col = back.col;
    events.push({ type: 'knockedBack', minion: m, from });
  }
  if (state.run.hearts <= 0) events.push({ type: 'signalLost' });
  return events;
}

// A landed shot can't hurt the hunter, but it stops it where it stands
// for HUNTER_REST_TURNS turns, long enough for the player to get away.
// Unlike a question (combat.js repelHunter) it isn't thrown to the far side.
// Events: hunterStaggered { hunter }.
export function staggerHunter(hunter) {
  hunter.rest = HUNTER_REST_TURNS;
  return [{ type: 'hunterStaggered', hunter }];
}
