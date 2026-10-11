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
  BATTLE_CHOICE_COUNT, ENERGY_MAX, GUN_RELOAD_MODIFIERS, RELOAD_ENERGY, WEAKNESS_DAMAGE_SCALE, MINION_KIND_ORDER,
  DAMAGE_BAR_DEPTHS, DAMAGE_PENALTY_WIDTH, DAMAGE_ZONE_GAP,
  MINION_KINDS, MINION_STRIKE_COST, DARK_MISS_COST, HUNTER_REST_TURNS, STRUGGLE_HIT_HALF, STRUGGLE_PUSHBACK,
  STRUGGLE_SWEEP_MS, STRUGGLE_SPEEDUP_MS, STRUGGLE_SHRINK, STRUGGLE_MIN_SWEEP_MS, STRUGGLE_MIN_HIT_HALF,
  MINIGAME_TIER_PAY,
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

// Rolls the run's weaknesses (strategy plan step D): each minion kind is
// weak to one of the set's reload groups, shuffled, round and round when
// there are fewer groups than kinds. A set with no groups has none.
// Nothing is known yet. Called by main.js startGame.
export function rollWeaknesses() {
  const groups = shuffle(fightGroups(state.settings.activeData, BATTLE_CHOICE_COUNT).filter(g => g.label));
  state.run.weakTo = {};
  state.run.weakKnown = new Set();
  if (!groups.length) return;
  MINION_KIND_ORDER.forEach((kind, i) => { state.run.weakTo[kind] = groups[i % groups.length].label; });
}

// Adds `count` rounds loaded from the group `label` (null: plain rounds).
// The one place energy goes up, so the rounds' labels keep in step.
export function addRounds(count, label = null) {
  state.run.energy += count;
  state.run.rounds.push(...Array(count).fill(label));
}

// Spends one round and returns the group it came from (null if plain):
// one from `prefer` if any is held, else the oldest. The one place energy
// goes down, so the rounds' labels keep in step.
function spendRound(prefer = null) {
  state.run.energy--;
  const rounds = state.run.rounds;
  const at = prefer ? rounds.indexOf(prefer) : -1;
  const [label] = rounds.splice(at === -1 ? 0 : at, 1);
  return label === undefined ? null : label;
}

// The group label `minionKind` is weak to, or null.
export function weaknessOf(minionKind) {
  return (minionKind && state.run.weakTo[minionKind]) || null;
}

// What a reload offers right now: null and why not ('energyFull'), or
// the next category and three ways to answer it, plain to hardest:
// [{ modifiers, energy, room }]. No modifier gives 1 energy, one gives 2,
// two give 3 (RELOAD_ENERGY). `room` is how much of that fits under
// ENERGY_MAX, so the player can see when a hard reload would be wasted.
// Gambler is never offered: a reload has no gold at stake.
export function reloadOffers() {
  const room = ENERGY_MAX - state.run.energy;
  if (room <= 0) return { block: 'energyFull', category: null, offers: [] };
  const [one, ...pair] = shuffle(GUN_RELOAD_MODIFIERS);
  const offers = [[], [one], pair.slice(0, 2)].map(modifiers => {
    const energy = RELOAD_ENERGY[modifiers.length];
    return { modifiers, energy, room: Math.min(energy, room) };
  });
  return { block: null, category: reloadCategory(), offers };
}

// The answer to a reload question (state.battle.currentQuestion) asked
// with `offer`. Right gives the offer's energy (as much as fits) and counts
// toward state.run.correctTotal; wrong jams: no energy, and no heart
// is lost (the turn spent is the cost). A timed-out question is a wrong
// answer. Either way the haunt is recorded and the rotation moves on.
// A reload from an energy cell (`box`) uses the cell up, right or wrong, so
// every cell is one question. A minigame's `tier` changes the energy by
// its MINIGAME_TIER_PAY `energy` (tier 1 one less, never below 1; X one
// more); a plain question is '2'.
// Events: reloaded { energy, total } or jammed { expected, source }, then
// hauntSilenced / hauntLingers.
export function settleReload(isCorrect, offer, box = null, tier = '2') {
  if (box) box.searched = true;
  const q = state.battle.currentQuestion;
  const events = [];
  if (isCorrect) {
    const earned = Math.max(1, offer.energy + MINIGAME_TIER_PAY[tier].energy);
    const energy = Math.min(earned, ENERGY_MAX - state.run.energy);
    addRounds(energy, reloadCategory().label);
    state.run.correctTotal++;
    events.push({ type: 'reloaded', energy, total: state.run.energy });
  } else {
    state.floor.misses++;
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

// Why `target` can't be fired at right now, or null if it can: no energy
// ('noEnergy'), no target ('noTarget'), something that isn't
// a minion or the hunter ('notShootable': the boss and items stay on the
// battle screen), or a sight.js shootBlock reason.
export function fireBlock(target) {
  if (state.run.energy <= 0) return 'noEnergy';
  if (!target) return 'noTarget';
  if (target.kind !== 'minion' && target.kind !== 'hunter') return 'notShootable';
  return shootBlock(target);
}

// Fires at `target`, for 1 energy: a round from the group the target is
// weak to when one is held, so the player never wastes a match. The aim
// chance (sight.js aimChance) decides whether it lands. A miss is the end
// of it. A landed shot on a minion waits for the damage bar
// (state.battle.aim; settleShot finishes it); one on the hunter staggers
// it, since it can't be hurt. A blocked shot spends nothing.
// Events: fireBlocked { target, reason }, or shotFired { target, chance }
// then shotMissed { target }, aimStarted { target, zones, matched } or
// hunterStaggered { hunter }; a landed shot on a minion whose kind's
// weakness wasn't known yet adds weaknessFound { minionKind, label }.
export function fire(target) {
  const reason = fireBlock(target);
  if (reason) return [{ type: 'fireBlocked', target, reason }];
  const weak = weaknessOf(target.minionKind);
  const round = spendRound(weak);
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
  state.battle.aim = { target, zones: damageZones(target.minionKind), matched: !!weak && round === weak };
  events.push({ type: 'aimStarted', ...state.battle.aim });
  // Timothy: a landed shot shows the kind's weakness, for the rest of the run.
  if (weak && !state.run.weakKnown.has(target.minionKind)) {
    state.run.weakKnown.add(target.minionKind);
    events.push({ type: 'weaknessFound', minionKind: target.minionKind, label: weak });
  }
  return events;
}

// The damage bar's zones for a landed shot on a minion of `minionKind`:
// [{ tier, from, to }], left to right, tier 'hit', 'weak' or 'penalty'.
// How many of each comes from the depth (DAMAGE_BAR_DEPTHS), how wide
// from the kind (hit and weak) or DAMAGE_PENALTY_WIDTH. They land in a new
// order at new spots each shot, so the player reads the bar instead of
// learning one timing: the spare room is shared out at random between the
// gaps, each at least DAMAGE_ZONE_GAP, so zones never touch.
export function damageZones(minionKind) {
  const counts = DAMAGE_BAR_DEPTHS[Math.min(state.run.roomIndex, DAMAGE_BAR_DEPTHS.length - 1)];
  const kind = MINION_KINDS[minionKind];
  const zones = shuffle([
    ...Array(counts.hits).fill({ tier: 'hit', width: kind.hitWidth }),
    ...Array(counts.weaks).fill({ tier: 'weak', width: kind.weakWidth }),
    ...Array(counts.penalties).fill({ tier: 'penalty', width: DAMAGE_PENALTY_WIDTH }),
  ]);
  const spare = 1 - zones.reduce((sum, z) => sum + z.width, 0) - DAMAGE_ZONE_GAP * (zones.length + 1);
  const shares = [...zones, null].map(() => Math.random());
  const total = shares.reduce((sum, s) => sum + s, 0) || 1;
  let at = 0;
  return zones.map((z, i) => {
    const from = at + DAMAGE_ZONE_GAP + Math.max(0, spare) * shares[i] / total;
    at = from + z.width;
    return { tier: z.tier, from, to: at };
  });
}

// The player stopped the damage bar at `barPosition` (0 to 1) for the
// shot in state.battle.aim. Inside a weak point: 2 damage and a limb comes
// off, if any are left. Inside a hit zone: 1. Inside a penalty zone the
// shot backfires: no damage, and 1 more energy is lost, if there is any
// left. Anywhere else grazes for 0. A round from the group the minion is
// weak to (aim.matched) does WEAKNESS_DAMAGE_SCALE times the damage. A
// minion with no hp left dies and pays its kind's gold (goldReward, so it
// doubles in the darkness).
// Events: shotGrazed { minion }, shotBackfired { minion, energyLost }, or
// minionHurt { minion, damage, hpLeft, weakPoint, matched } and maybe limbLost
// { minion, limbsLeft }; then, on a kill, minionKilled { minion } and
// goldGained { amount, from: 'kill' }.
export function settleShot(barPosition) {
  const aim = state.battle.aim;
  if (!aim) return [];
  state.battle.aim = null;
  const m = aim.target;
  const zone = aim.zones.find(z => barPosition >= z.from && barPosition <= z.to);
  if (zone && zone.tier === 'penalty') {
    const energyLost = Math.min(1, state.run.energy);
    if (energyLost) spendRound();
    return [{ type: 'shotBackfired', minion: m, energyLost }];
  }
  const weakPoint = !!zone && zone.tier === 'weak';
  const base = !zone ? 0 : weakPoint ? 2 : 1;
  if (base === 0) return [{ type: 'shotGrazed', minion: m }];

  const damage = aim.matched ? base * WEAKNESS_DAMAGE_SCALE : base;
  m.hpLeft = Math.max(0, m.hpLeft - damage);
  const events = [{ type: 'minionHurt', minion: m, damage, hpLeft: m.hpLeft, weakPoint, matched: aim.matched }];
  if (weakPoint && m.limbs > 0) {
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

// The Struggle dial for the floor's next Struggle: { hitHalf, sweepMs,
// count }, count being which Struggle on this floor it is (1 for the
// first). Each one after the first sweeps STRUGGLE_SPEEDUP_MS faster with
// a zone STRUGGLE_SHRINK narrower, down to STRUGGLE_MIN_SWEEP_MS and
// STRUGGLE_MIN_HIT_HALF, so leaning on it gets harder. Counts the Struggle
// (state.floor.struggles); a new floor resets it (floor.js).
export function struggleDial() {
  const before = state.floor.struggles++;
  return {
    hitHalf: Math.max(STRUGGLE_MIN_HIT_HALF, STRUGGLE_HIT_HALF - before * STRUGGLE_SHRINK),
    sweepMs: Math.max(STRUGGLE_MIN_SWEEP_MS, STRUGGLE_SWEEP_MS - before * STRUGGLE_SPEEDUP_MS),
    count: before + 1,
  };
}

// The Struggle dial stopped at `barPosition` (0 to 1, centre 0.5) for the
// minion waiting in state.battle.struggle. Inside the dial's hitHalf
// (struggleDial) of the centre the player shoves it away:
// STRUGGLE_PUSHBACK tiles, no damage to either. Anything else and it
// strikes, as it would have with energy left.
// Events: struggleWon { minion } then knockedBack { minion, from } if it
// had room to go; or struggleLost { minion } then minionStrike's events.
export function settleStruggle(barPosition) {
  const struggle = state.battle.struggle;
  if (!struggle) return [];
  state.battle.struggle = null;
  const m = struggle.minion;
  if (!state.floor.minions.includes(m)) return [];
  if (Math.abs(barPosition - 0.5) > struggle.hitHalf) return [{ type: 'struggleLost', minion: m }, ...minionStrike(m)];
  const events = [{ type: 'struggleWon', minion: m }];
  const from = { row: m.row, col: m.col };
  if (pushBack(m, STRUGGLE_PUSHBACK)) events.push({ type: 'knockedBack', minion: m, from });
  return events;
}

// Shoves `m` up to `tiles` tiles straight away from the player, stopping
// at the first wall or occupied tile. If it can't go that way at all, it
// goes back along its trail like a strike's knockback. Its trail is spent
// either way. Returns whether it moved.
function pushBack(m, tiles) {
  const dRow = Math.sign(m.row - state.floor.playerRow);
  const dCol = Math.sign(m.col - state.floor.playerCol);
  const size = state.floor.GRID_SIZE;
  const open = (row, col) => row >= 0 && col >= 0 && row < size && col < size &&
    !state.floor.wallSet.has(key(row, col)) && !tileOccupied(row, col, m);
  const start = { row: m.row, col: m.col };
  for (let i = 0; i < tiles && open(m.row + dRow, m.col + dCol); i++) {
    m.row += dRow;
    m.col += dCol;
  }
  const back = m.trail[0];
  m.trail = [];
  if (m.row !== start.row || m.col !== start.col) return true;
  if (!back || !open(back.row, back.col)) return false;
  m.row = back.row;
  m.col = back.col;
  return true;
}

// A landed shot can't hurt the hunter, but it stops it where it stands
// for HUNTER_REST_TURNS turns, long enough for the player to get away.
// Unlike a question (combat.js repelHunter) it isn't thrown to the far side.
// Events: hunterStaggered { hunter }.
export function staggerHunter(hunter) {
  hunter.rest = HUNTER_REST_TURNS;
  return [{ type: 'hunterStaggered', hunter }];
}
