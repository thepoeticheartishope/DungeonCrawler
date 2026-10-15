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
  MINION_KINDS, MINION_STRIKE_COST, MINION_STUN_MOVES, DARK_MISS_COST, HUNTER_REST_TURNS, STRUGGLE_HIT_HALF, STRUGGLE_PUSHBACK,
  STRUGGLE_SWEEP_MS, STRUGGLE_SPEEDUP_MS, STRUGGLE_SHRINK, STRUGGLE_MIN_SWEEP_MS, STRUGGLE_MIN_HIT_HALF,
  MINIGAME_TIER_PAY, PLAYER_CONE_RANGE, DARK_SHOT_STEP,
} from './config.js';
import { fightGroups, shuffle } from './quiz.js';
import { recordHauntAnswer } from './haunts.js';
import { shootBlock, canShoot, seesEnemy } from './sight.js';
import { aimLook, angleTo, lookAngle, wantsTurn, wrapAngle } from './look.js';
import { goldReward } from './moves.js';
import { tileOccupied, lockOn } from './combat.js';
import { canPassCorner } from './passage.js';
import { batteryInPlay, lightOn } from './battery.js';
import { makeNoise } from './noise.js';

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
// [{ modifiers, energy, room }]. No modifier gives 2 energy, one gives 3,
// two fill it (RELOAD_ENERGY). `room` is how much of that fits under
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
// more), except an offer that fills the energy (two modifiers), which
// fills it at any tier (Timothy); a plain question is '2'.
// Events: reloaded { energy, total } or jammed { expected, source } and
// its noise (noise.js makeNoise: a jam is loud), then hauntSilenced /
// hauntLingers.
export function settleReload(isCorrect, offer, box = null, tier = '2') {
  if (box) box.searched = true;
  const q = state.battle.currentQuestion;
  const events = [];
  if (isCorrect) {
    const earned = offer.energy >= ENERGY_MAX ? ENERGY_MAX : Math.max(1, offer.energy + MINIGAME_TIER_PAY[tier].energy);
    const energy = Math.min(earned, ENERGY_MAX - state.run.energy);
    addRounds(energy, reloadCategory().label);
    state.run.correctTotal++;
    events.push({ type: 'reloaded', energy, total: state.run.energy });
  } else {
    state.floor.misses++;
    events.push({ type: 'jammed', expected: q.meaning, source: q.source }, ...makeNoise('reload'));
  }
  const haunt = recordHauntAnswer(q, isCorrect);
  if (haunt === 'silenced') events.push({ type: 'hauntSilenced' });
  else if (haunt === 'lingers') events.push({ type: 'hauntLingers' });
  state.run.reloadIndex++;
  return events;
}

// The player tapped `tile` on the map. A minion or the hunter standing
// there, in sight (seesEnemy, so the map is showing it), draws the light:
// the aim goes to it (look.js aimLook), as far as the free arc allows, and
// the target follows the light. If it still can't be shot, the event says
// why ('needsTurn' when only turning the body would bring it into the
// cone). Anything else clears the target. Costs no turn.
// Events: targetPicked { target }, or targetBlocked { target, reason },
// or targetCleared.
export function pickTarget(tile) {
  const f = state.floor;
  const target = f.minions.find(m => m.row === tile.row && m.col === tile.col);
  const seen = target && seesEnemy(target);
  if (!seen) {
    f.gunTarget = null;
    return [{ type: 'targetCleared' }];
  }
  aimLook(angleTo(target.row, target.col));
  const reason = shootBlock(target);
  if (reason) {
    refreshGunTarget();
    return [{ type: 'targetBlocked', target, reason: reason === 'notInLight' && wantsTurn() ? 'needsTurn' : reason }];
  }
  // Free look off, the light can't move to it: a tap still picks it.
  f.gunTarget = target;
  return [{ type: 'targetPicked', target }];
}

// What the gun can fire at right now: seen minions and the hunter that
// sight.js canShoot allows (inside the cone), the one closest to where the
// player is aiming first, a nearer one breaking a tie (free look plan:
// sweeping the light switches targets).
function shootable() {
  const f = state.floor;
  const look = lookAngle();
  const offAim = m => Math.abs(wrapAngle(angleTo(m.row, m.col) - look));
  return f.minions
    .filter(m => seesEnemy(m) && canShoot(m))
    .sort((a, b) => (offAim(a) - offAim(b)) || (distanceTo(a) - distanceTo(b)));
}

// Straight-line distance from the player to `thing`, in tiles.
function distanceTo(thing) {
  return Math.hypot(thing.row - state.floor.playerRow, thing.col - state.floor.playerCol);
}

// Keeps the gun's target up to date after a turn or a look: the target is
// always the shootable thing closest to the aim, so it follows the light,
// and with nothing in reach there is none. Events: targetPicked
// { target, auto: true } when it changes to a new one.
export function refreshGunTarget() {
  const f = state.floor;
  const best = shootable()[0] || null;
  if (best === f.gunTarget) return [];
  f.gunTarget = best;
  return best ? [{ type: 'targetPicked', target: best, auto: true }] : [];
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

// Whether a shot now goes into the dark (light battery plan step C): the
// battery in play and the light off.
export function shootingDark() {
  return batteryInPlay() && !lightOn();
}

// Where a shot in the dark goes: straight along the aim (look.js
// lookAngle) up to PLAYER_CONE_RANGE tiles, stopped by the first wall or
// pillar. { target, end }: the first minion or hunter in the way (or
// null), and the tile the shot reaches (the target's, or the last open
// one).
export function darkShotPath() {
  const f = state.floor;
  const a = lookAngle();
  const [dr, dc] = [-Math.cos(a), Math.sin(a)];
  let end = { row: f.playerRow, col: f.playerCol };
  for (let d = DARK_SHOT_STEP; d <= PLAYER_CONE_RANGE + 1e-9; d += DARK_SHOT_STEP) {
    const row = Math.round(f.playerRow + dr * d);
    const col = Math.round(f.playerCol + dc * d);
    if (row === end.row && col === end.col) continue;
    const k = key(row, col);
    if (row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(k) || f.pillarSet.has(k)) break;
    end = { row, col };
    const target = f.minions.find(m => m.row === row && m.col === col);
    if (target) return { target, end };
  }
  return { target: null, end };
}

// Why `target` can't be fired at right now, or null if it can: no energy
// ('noEnergy'), no target ('noTarget'), something that isn't
// a minion or the hunter ('notShootable': the boss and items stay on the
// battle screen), or a sight.js shootBlock reason. In the dark only energy
// matters: the shot goes where the player aims (fireDark).
export function fireBlock(target) {
  if (state.run.energy <= 0) return 'noEnergy';
  if (shootingDark()) return null;
  if (!target) return 'noTarget';
  if (target.kind !== 'minion' && target.kind !== 'hunter') return 'notShootable';
  return shootBlock(target);
}

// Fires at `target`, for 1 energy: a round from the group the target is
// weak to when one is held, so the player never wastes a match. A shot
// that can be taken always lands. On a minion it waits for the damage bar
// (state.battle.aim; settleShot finishes it); one on the hunter staggers
// it, since it can't be hurt. A blocked shot spends nothing.
// Events: fireBlocked { target, reason }, or shotFired { target } then
// aimStarted { target, zones, matched } or
// hunterStaggered { hunter }; a landed shot on a minion whose kind's
// weakness wasn't known yet adds weaknessFound { minionKind, label }.
export function fire(target) {
  const reason = fireBlock(target);
  if (reason) return [{ type: 'fireBlocked', target, reason }];
  if (shootingDark()) return fireDark();
  // Combat with it has begun: its eye shuts (gaze.js).
  if (target) target.gaze = 0;
  const weak = weaknessOf(target.minionKind);
  const round = spendRound(weak);
  const events = [{ type: 'shotFired', target }];
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

// A shot in the dark (light battery plan step C), for 1 energy: it goes
// along the aim (darkShotPath) and the damage bar always opens, even with
// nothing there, so firing gives nothing away (mockup call 3). The bar is
// one step harder, at random: `dark` 'fast' (it sweeps faster,
// gunpanels.js) or 'x' (one more penalty zone). Its zones are sized for a
// kind picked at random, not the target's, for the same reason. The
// oldest round goes, matched only by luck, and no weakness is found. On
// the hunter it staggers it, as in the light.
// Events: shotFired { target, dark: true, end } then aimStarted, or
// hunterStaggered.
function fireDark() {
  const { target, end } = darkShotPath();
  if (target) target.gaze = 0;
  const round = spendRound();
  const events = [{ type: 'shotFired', target, dark: true, end }];
  if (target && target.kind === 'hunter') {
    events.push(...staggerHunter(target));
    return events;
  }
  const dark = Math.random() < 0.5 ? 'fast' : 'x';
  const kind = MINION_KIND_ORDER[Math.floor(Math.random() * MINION_KIND_ORDER.length)];
  state.battle.aim = {
    target, end, dark,
    zones: damageZones(kind, { extraPenalty: dark === 'x' ? 1 : 0 }),
    matched: !!target && !!round && round === weaknessOf(target.minionKind),
  };
  events.push({ type: 'aimStarted', ...state.battle.aim });
  return events;
}

// The damage bar's zones for a landed shot on a minion of `minionKind`:
// [{ tier, from, to }], left to right, tier 'hit', 'weak' or 'penalty'.
// How many of each comes from the depth (DAMAGE_BAR_DEPTHS), how wide
// from the kind (hit and weak) or DAMAGE_PENALTY_WIDTH. They land in a new
// order at new spots each shot, so the player reads the bar instead of
// learning one timing: the spare room is shared out at random between the
// gaps, each at least DAMAGE_ZONE_GAP, so zones never touch.
// A dark shot's 'x' asks for `extraPenalty` more penalty zones.
export function damageZones(minionKind, { extraPenalty = 0 } = {}) {
  const counts = DAMAGE_BAR_DEPTHS[Math.min(state.run.roomIndex, DAMAGE_BAR_DEPTHS.length - 1)];
  const kind = MINION_KINDS[minionKind];
  const zones = shuffle([
    ...Array(counts.hits).fill({ tier: 'hit', width: kind.hitWidth }),
    ...Array(counts.weaks).fill({ tier: 'weak', width: kind.weakWidth }),
    ...Array(counts.penalties + extraPenalty).fill({ tier: 'penalty', width: DAMAGE_PENALTY_WIDTH }),
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
// doubles in the darkness). Any damage stuns it for MINION_STUN_MOVES of
// its moves (m.rest), so a minion one step away can't walk straight in.
// Events: shotGrazed { minion }, shotBackfired { minion, energyLost } and
// its noise (noise.js makeNoise), or
// minionHurt { minion, damage, hpLeft, weakPoint, matched } and maybe limbLost
// { minion, limbsLeft }; then, on a kill, minionKilled { minion } and
// goldGained { amount, from: 'kill' }.
// A shot in the dark (aim.dark) with nothing there: shotIntoDark { end }
// unless it backfires (shotBackfired with no minion, `end` where it went).
// One that hurts a stick man in the dark locks it on (combat.js lockOn): it
// knows where the shot came from (minionHurt's `dark`).
export function settleShot(barPosition) {
  const aim = state.battle.aim;
  if (!aim) return [];
  state.battle.aim = null;
  const m = aim.target;
  const zone = aim.zones.find(z => barPosition >= z.from && barPosition <= z.to);
  if (zone && zone.tier === 'penalty') {
    const energyLost = Math.min(1, state.run.energy);
    if (energyLost) spendRound();
    return [{ type: 'shotBackfired', minion: m, energyLost, ...(aim.dark ? { end: aim.end } : {}) }, ...makeNoise('backfire')];
  }
  if (!m) return [{ type: 'shotIntoDark', end: aim.end }];
  const weakPoint = !!zone && zone.tier === 'weak';
  const base = !zone ? 0 : weakPoint ? 2 : 1;
  if (base === 0) return [{ type: 'shotGrazed', minion: m, ...(aim.dark ? { dark: true } : {}) }];

  const damage = aim.matched ? base * WEAKNESS_DAMAGE_SCALE : base;
  m.hpLeft = Math.max(0, m.hpLeft - damage);
  m.rest = Math.max(m.rest || 0, MINION_STUN_MOVES);
  if (aim.dark) lockOn(m);
  const events = [{ type: 'minionHurt', minion: m, damage, hpLeft: m.hpLeft, weakPoint, matched: aim.matched, ...(aim.dark ? { dark: true } : {}) }];
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
// had room to go; or struggleLost { minion }, its noise (noise.js
// makeNoise), then minionStrike's events.
export function settleStruggle(barPosition) {
  const struggle = state.battle.struggle;
  if (!struggle) return [];
  state.battle.struggle = null;
  const m = struggle.minion;
  if (!state.floor.minions.includes(m)) return [];
  if (Math.abs(barPosition - 0.5) > struggle.hitHalf) return [{ type: 'struggleLost', minion: m }, ...makeNoise('struggle'), ...minionStrike(m)];
  const events = [{ type: 'struggleWon', minion: m }];
  const from = { row: m.row, col: m.col };
  if (pushBack(m, STRUGGLE_PUSHBACK)) events.push({ type: 'knockedBack', minion: m, from });
  return events;
}

// Shoves `m` up to `tiles` tiles straight away from the player, stopping
// at the first wall or occupied tile (a diagonal push stops at a corner,
// passage.js canPassCorner, like a diagonal step). If it can't go that way at all, it
// goes back along its trail like a strike's knockback. Its trail is spent
// either way. Returns whether it moved.
function pushBack(m, tiles) {
  const dRow = Math.sign(m.row - state.floor.playerRow);
  const dCol = Math.sign(m.col - state.floor.playerCol);
  const size = state.floor.GRID_SIZE;
  const open = (row, col) => row >= 0 && col >= 0 && row < size && col < size &&
    !state.floor.wallSet.has(key(row, col)) && !tileOccupied(row, col, m);
  const start = { row: m.row, col: m.col };
  for (let i = 0; i < tiles && open(m.row + dRow, m.col + dCol) && canPassCorner(m.row, m.col, dRow, dCol); i++) {
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
