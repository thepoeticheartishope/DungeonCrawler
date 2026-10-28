// The gun (gun combat plan, step 3): reloading by answering a question,
// picking a target on the map, firing at a minion in the player's light,
// the dial (kill or maim plan: READY, then kill, maim or harmful zones), a
// minion's strike when it reaches the player, and a landed shot staggering
// the hunter. Played with DEV -> Combat on gun
// (state.settings.gunCombat): main.js runs reload and fire as turns, and
// combat.js advanceMonsters calls minionStrike. Each rule changes state and returns an events list
// in the order things happened, for main.js drawEvents() to draw.
// Spending the turn (minions move, the light spreads) is the caller's job.
// No DOM access here.

import { state, key } from './state.js';
import {
  BATTLE_CHOICE_COUNT, ENERGY_MAX, GUN_RELOAD_MODIFIERS, RELOAD_ENERGY, MATCH_KILL_SCALE, MINION_KIND_ORDER,
  DIAL_DEPTHS, DIAL_ZONE_GAP, DIAL_LAP_MS, DIAL_LAP_LIMIT_MS, HARM_KINDS, HARM_WIDTH, GUARD_STUN_MOVES, DARK_SWEEP_SCALE,
  MINION_KINDS, MINION_STRIKE_COST, MINION_STUN_MOVES, DARK_MISS_COST, HUNTER_REST_TURNS, STRUGGLE_PUSHBACK,
  STRUGGLE_ZONE_WIDTH, STRUGGLE_LAP_MS, STRUGGLE_SPEEDUP_MS, STRUGGLE_SHRINK, STRUGGLE_MIN_WIDTH,
  MINIGAME_TIER_PAY, PLAYER_CONE_RANGE, DARK_SHOT_STEP, STEADY_AIM,
} from './config.js';
import { fightGroups, shuffle } from './quiz.js';
import { recordHauntAnswer } from './haunts.js';
import { shootBlock, canShoot, seesEnemy, computeVisibility } from './sight.js';
import { aimLook, angleTo, lookAngle, wantsTurn, wrapAngle } from './look.js';
import { goldReward } from './moves.js';
import { tileOccupied, lockOn, lungeAt } from './combat.js';
import { canPassCorner } from './passage.js';
import { batteryInPlay, lightOn, lowBattery } from './battery.js';
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
  // One stick (one stick plan step E): the light swings round to it
  // (look.js swingLook), and the target follows the light as it comes
  // (refreshGunTarget), so outside the cone for now says nothing.
  if (reason === 'notInLight' && state.settings.oneStick) return [];
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

// Fires at `target`. A shot that can be taken always lands. On a minion
// it opens the dial (kill or maim plan) at READY (state.battle.aim, phase
// 'ready'): nothing is spent until the player presses READY (readyShot),
// so BACK (cancelShot) is free. The round it will spend is picked now, one
// from the group the target is weak to when one is held, so the player
// never wastes a match, and a match widens the kill zone. A shot on the
// hunter spends its round at once and staggers it, since it can't be hurt.
// A blocked shot spends nothing.
// Events: fireBlocked { target, reason }, or shotFired { target } then
// aimStarted { target, zones, matched, ... } or hunterStaggered { hunter }.
export function fire(target) {
  const reason = fireBlock(target);
  if (reason) return [{ type: 'fireBlocked', target, reason }];
  if (shootingDark()) return fireDark();
  // Combat with it has begun: its eye shuts (gaze.js).
  if (target) target.gaze = 0;
  const weak = weaknessOf(target.minionKind);
  const events = [{ type: 'shotFired', target }];
  if (target.kind === 'hunter') {
    spendRound(weak);
    events.push(...staggerHunter(target));
    return events;
  }
  const matched = !!weak && state.run.rounds.includes(weak);
  state.battle.aim = { target, ...dialFor(target.minionKind, { matched }), matched, prefer: weak, phase: 'ready' };
  events.push({ type: 'aimStarted', ...state.battle.aim });
  return events;
}

// A shot in the dark (light battery plan step C): it goes along the aim
// (darkShotPath) and the dial always opens, even with nothing there, so
// firing gives nothing away (mockup call 3). Its dial hides its dark arc
// and is one step harder, at random: `dark` 'fast' (a faster lap) or 'x'
// (one more harmful zone). Its zones and traits are a kind picked at
// random, not the target's, for the same reason. It will spend the oldest
// round, matched only by luck, and no weakness is found. On the hunter it
// spends the round at once and staggers it, as in the light.
// Events: shotFired { target, dark: true, end } then aimStarted, or
// hunterStaggered.
function fireDark() {
  const { target, end } = darkShotPath();
  if (target) target.gaze = 0;
  const events = [{ type: 'shotFired', target, dark: true, end }];
  if (target && target.kind === 'hunter') {
    spendRound();
    events.push(...staggerHunter(target));
    return events;
  }
  // The tutorial's dark shot is no harder (Timothy, 2026-10-16: a plain fight there).
  const dark = state.floor.tutorial ? 'plain' : Math.random() < 0.5 ? 'fast' : 'x';
  const kind = MINION_KIND_ORDER[Math.floor(Math.random() * MINION_KIND_ORDER.length)];
  const round = state.run.rounds[0];
  const matched = !!target && !!round && round === weaknessOf(target.minionKind);
  state.battle.aim = {
    target, end, dark,
    ...dialFor(kind, { matched, extraHarm: dark === 'x' ? 1 : 0, faster: dark === 'fast', darkArc: true }),
    matched, prefer: null, phase: 'ready',
  };
  events.push({ type: 'aimStarted', ...state.battle.aim });
  return events;
}

// The dial for a shot on a minion of `minionKind`: { zones, lapMs,
// lapLimit, traits, darkArc }. The depth (DIAL_DEPTHS) sets the speed and
// any lap limit, the kind its traits (MINION_KINDS dial). `faster` (a fast
// dark shot) takes DARK_SWEEP_SCALE off the lap; no lap is ever quicker
// than DIAL_LAP_LIMIT_MS. The dark arc shows on a dark shot or a low
// battery (battery.js lowBattery). In the tutorial room the dial is plain
// (Timothy, 2026-10-16): the first DIAL_DEPTHS row, none of the kind's
// traits, no extra harmful zone, no faster lap and no dark arc.
function dialFor(minionKind, { matched = false, extraHarm = 0, faster = false, darkArc = false } = {}) {
  const plain = !!state.floor.tutorial;
  const depth = dialDepth();
  const lap = DIAL_LAP_MS[depth.speed] * (faster && !plain ? DARK_SWEEP_SCALE : 1);
  return {
    zones: dialZones(minionKind, { matched, extraHarm: plain ? 0 : extraHarm }),
    lapMs: Math.max(DIAL_LAP_LIMIT_MS, Math.round(lap)),
    lapLimit: depth.lapLimit,
    traits: plain ? { ...PLAIN_DIAL_TRAITS } : { ...MINION_KINDS[minionKind].dial },
    darkArc: !plain && (darkArc || lowBattery()),
  };
}

// A dial with none of the kinds' traits (the tutorial's).
const PLAIN_DIAL_TRAITS = { spin: 'still', turnBack: false, surge: false };

// This danger depth's row of DIAL_DEPTHS (the last row carries on); the
// first row in the tutorial room.
function dialDepth() {
  if (state.floor.tutorial) return DIAL_DEPTHS[0];
  return DIAL_DEPTHS[Math.min(state.run.roomIndex, DIAL_DEPTHS.length - 1)];
}

// The dial's zones for a shot on a minion of `minionKind`: [{ tier, from,
// to }] round the circle (0 to 1, none crossing 1), tier 'kill', 'maim' or
// 'harm' (with `harm`, one of HARM_KINDS). One kill zone and one maim zone
// sized by the kind (MINION_KINDS killWidth / maimWidth) and the depth
// (DIAL_DEPTHS scale), the kill zone MATCH_KILL_SCALE wider for a
// `matched` round; the depth's harmful zones, plus `extraHarm` (a dark
// shot's 'x'). They land in a new order at new spots each shot, so the
// player reads the dial instead of learning one timing: the spare room is
// shared out at random between the gaps, each at least DIAL_ZONE_GAP, so
// zones never touch.
export function dialZones(minionKind, { matched = false, extraHarm = 0 } = {}) {
  const depth = dialDepth();
  const kind = MINION_KINDS[minionKind];
  const harms = Array.from({ length: depth.harms + extraHarm }, () =>
    ({ tier: 'harm', harm: HARM_KINDS[Math.floor(Math.random() * HARM_KINDS.length)], width: HARM_WIDTH }));
  const zones = shuffle([
    { tier: 'kill', width: kind.killWidth * depth.scale * (matched ? MATCH_KILL_SCALE : 1) },
    { tier: 'maim', width: kind.maimWidth * depth.scale },
    ...harms,
  ]);
  const spare = 1 - zones.reduce((sum, z) => sum + z.width, 0) - DIAL_ZONE_GAP * zones.length;
  const shares = zones.map(() => Math.random());
  const total = shares.reduce((sum, x) => sum + x, 0) || 1;
  let at = 0;
  return zones.map((z, i) => {
    const from = at + DIAL_ZONE_GAP + Math.max(0, spare) * shares[i] / total;
    at = from + z.width;
    return { tier: z.tier, ...(z.harm ? { harm: z.harm } : {}), from, to: at };
  });
}

// The player pressed READY on the dial waiting in state.battle.aim: its
// round is spent and the marker starts (the view runs it). A lit shot on a
// kind whose weakness isn't known yet shows it, for the rest of the run
// (Timothy: a landed shot shows the kind's weakness).
// Events: shotReady, then maybe weaknessFound { minionKind, label }.
export function readyShot() {
  const aim = state.battle.aim;
  if (!aim || aim.phase !== 'ready') return [];
  spendRound(aim.prefer);
  aim.phase = 'run';
  const events = [{ type: 'shotReady' }];
  const kind = aim.target && !aim.dark ? aim.target.minionKind : null;
  const weak = weaknessOf(kind);
  if (weak && !state.run.weakKnown.has(kind)) {
    state.run.weakKnown.add(kind);
    events.push({ type: 'weaknessFound', minionKind: kind, label: weak });
  }
  return events;
}

// BACK before READY: the gun goes down. Nothing was spent, and it is no
// turn. Events: shotCancelled.
export function cancelShot() {
  const aim = state.battle.aim;
  if (!aim || aim.phase !== 'ready') return [];
  state.battle.aim = null;
  return [{ type: 'shotCancelled' }];
}

// Steady aim (STEADY_AIM, steady aim plan): SELECT held on a shot waiting at
// READY steadies it instead of opening the dial. aim.steady runs 0 to 1,
// aim.heldMs counts time held at full (the shake). Nothing is spent yet.
// Events: none (the view shows the aim).
export function startSteady() {
  const aim = state.battle.aim;
  if (!aim || aim.phase !== 'ready') return [];
  aim.phase = 'steady';
  aim.steady = 0;
  aim.heldMs = 0;
  return [];
}

// Whether a shot is being steadied now.
export function steadying() {
  return !!state.battle.aim && state.battle.aim.phase === 'steady';
}

// One frame of holding, `dtMs` long. A lit shot whose stick man can't be
// shot any more (gone, out of the light or reach) is lowered: steadyLost.
// A shot into the dark never says so (it would give away what is there).
// Past dropAtMs on the head the arm drops back: steadyDropped. The light
// narrows to a beam as it steadies and follows a lit stick man (step B). A weaving
// kind (STEADY_AIM.kindSlow, the STALKER) steadies slower, but only in the
// light: in the dark the aim can't tell what it is on.
export function tickSteady(dtMs) {
  const aim = state.battle.aim;
  if (!steadying()) return [];
  const m = aim.target;
  const lit = !aim.dark && m && state.floor.minions.includes(m);
  if (lit) followTarget(m);
  if (!aim.dark && m && (!lit || shootBlock(m))) {
    state.battle.aim = null;
    computeVisibility();
    return [{ type: 'steadyLost' }];
  }
  const events = [];
  if (aim.steady < 1) {
    const kind = lit ? STEADY_AIM.kindSlow[m.minionKind] || 1 : 1;
    const slow = (aim.dark ? STEADY_AIM.dark : lowBattery() ? STEADY_AIM.lowBattery : 1) * kind;
    aim.steady = Math.min(1, aim.steady + dtMs * slow / STEADY_AIM.fullMs);
  } else {
    aim.heldMs += dtMs;
    if (aim.heldMs >= STEADY_AIM.dropAtMs) {
      aim.steady = STEADY_AIM.dropTo;
      aim.heldMs = 0;
      events.push({ type: 'steadyDropped' });
    }
  }
  computeVisibility();
  return events;
}

// While a lit shot steadies, the light stays on its stick man: the beam it
// narrows to (sight.js coneShape) would lose him at his first step aside.
function followTarget(m) {
  const angle = angleTo(m.row, m.col);
  state.floor.look = angle;
  state.floor.lookWant = angle;
  computeVisibility();
}

// The chance a steadied shot lands (0 to 1): up from minChance with the
// steadiness, 1 at full hold, then down toward shakeFloor while the arm
// shakes.
export function steadyChance(aim) {
  if (aim.steady < 1) return Math.max(STEADY_AIM.minChance, aim.steady);
  const shake = Math.max(0, aim.heldMs - STEADY_AIM.shakeAfterMs) / (STEADY_AIM.dropAtMs - STEADY_AIM.shakeAfterMs);
  return 1 - shake * (1 - STEADY_AIM.shakeFloor);
}

// Whether the aim is shaking (held on the head past shakeAfterMs).
export function steadyShaking(aim) {
  return aim.steady >= 1 && aim.heldMs > STEADY_AIM.shakeAfterMs;
}

// SELECT let go: the round is spent (readyShot), the shot rolls against
// steadyChance, and it settles as a stopped dial would: on the head (full
// hold) a kill, below it a maim, a miss in the first wildBelow a harm (not
// in the tutorial room: a plain fight there), any other miss a miss.
// The light opens out of its beam again. Events: readyShot's, then
// settleShot's.
export function releaseSteady() {
  const aim = state.battle.aim;
  if (!steadying()) return [];
  const chance = steadyChance(aim);
  aim.phase = 'ready';
  const events = readyShot();
  let zone = null;
  if (Math.random() < chance) zone = { tier: aim.steady >= 1 ? 'kill' : 'maim' };
  else if (aim.steady < STEADY_AIM.wildBelow && !state.floor.tutorial) {
    zone = { tier: 'harm', harm: HARM_KINDS[Math.floor(Math.random() * HARM_KINDS.length)] };
  }
  const settled = settleZone(aim, zone);
  computeVisibility();
  return [...events, ...settled];
}

// DEV -> Auto-win while steadying: the aim at full hold, the arm not yet
// shaking, so letting go kills. Events: none.
export function holdSteady() {
  if (!steadying()) return [];
  state.battle.aim.steady = 1;
  state.battle.aim.heldMs = 0;
  return [];
}

// The gun lowered while steadying (SELECT slid off, Escape): nothing was
// spent. Events: shotCancelled.
export function cancelSteady() {
  if (!steadying()) return [];
  state.battle.aim = null;
  computeVisibility();
  return [{ type: 'shotCancelled' }];
}

// The player stopped the running dial at `position` (0 to 1, in the
// zones' own frame: the view takes off any drift) for the shot in
// state.battle.aim. No health (kill or maim plan):
// - kill zone: it dies and pays its kind's gold (goldReward, so it doubles
//   in the darkness);
// - maim zone: it goes down (downed plan: it crawls at half speed and a
//   bump finishes it; with DEV -> Downed off it only reels);
// - a guard (the HUSK's) takes the first hit of either kind instead and
//   breaks, stunning it GUARD_STUN_MOVES (more for a kill-zone hit);
// - a downed one dies from either;
// - a harmful zone: jam (1 more energy lost), loud (a noise) or lunge (it
//   steps closer at once, combat.js lungeAt);
// - anywhere else misses.
// Any hit stuns it for MINION_STUN_MOVES of its moves (m.rest), so a
// minion one step away can't walk straight in.
// Events: shotMissed { minion }; shotJammed { minion, energyLost },
// shotLoud { minion } and its noise (noise.js makeNoise), or shotLunged
// { minion } and lungeAt's; or minionHit { minion, tier, matched } (with
// One stick, reachBroken { minion } if it was reaching) then
// guardBroken { minion, stun }, minionReels { minion }, minionDowned
// { minion }, or the kill's (minionFinished for a downed one, then
// minionKilled, goldGained). A shot in the dark (aim.dark) with nothing
// there: shotIntoDark { end }, unless it jams or is loud (with no minion,
// `end` where it went). One that hits a stick man in the dark locks it on
// (combat.js lockOn): it knows where the shot came from (`dark` on the
// event).
export function settleShot(position) {
  const aim = state.battle.aim;
  if (!aim || aim.phase !== 'run') return [];
  return settleZone(aim, aim.zones.find(z => position >= z.from && position <= z.to));
}

// What a shot does once it is known where it went: `zone` ({ tier, harm? })
// or none (a miss). The dial's stop and steady aim's roll both come here.
function settleZone(aim, zone) {
  state.battle.aim = null;
  const m = aim.target;
  const dark = aim.dark ? { dark: true } : {};
  if (zone && zone.tier === 'harm') return settleHarm(zone.harm, aim);
  if (!m) return [{ type: 'shotIntoDark', end: aim.end }];
  if (!zone) return [{ type: 'shotMissed', minion: m, ...dark }];

  m.rest = Math.max(m.rest || 0, MINION_STUN_MOVES);
  if (aim.dark) lockOn(m);
  const events = [{ type: 'minionHit', minion: m, tier: zone.tier, matched: aim.matched, ...dark }];
  // One stick (one stick plan step E): a landed shot stops a reach.
  if (m.reaching) {
    m.reaching = null;
    events.push({ type: 'reachBroken', minion: m });
  }
  if (m.guard) {
    const stun = GUARD_STUN_MOVES[zone.tier];
    m.guard = false;
    m.rest = Math.max(m.rest, stun);
    return [...events, { type: 'guardBroken', minion: m, stun }];
  }
  if (m.downed) return [...events, ...finishDowned(m)];
  if (zone.tier === 'kill') return [...events, ...killMinion(m)];
  if (!state.settings.downed) return [...events, { type: 'minionReels', minion: m }];
  m.downed = true;
  return [...events, { type: 'minionDowned', minion: m }];
}

// A dial stopped in a harmful zone of kind `harm` (HARM_KINDS) for `aim`.
// Jam: 1 more energy lost, if there is any. Loud: a noise (noise.js
// makeNoise), as loud as the old backfire. Lunge: the minion takes a step
// toward the player at once (combat.js lungeAt), which can bring it onto
// them; a lunge in the dark with nothing there is just a shot into the dark.
// Events: shotJammed { minion, energyLost }, shotLoud { minion } then
// noiseMade / noiseHeard, shotLunged { minion } then lungeAt's, or
// shotIntoDark { end }. In the dark the first carries `end`, where the shot went.
function settleHarm(harm, aim) {
  const m = aim.target;
  const at = aim.dark ? { end: aim.end } : {};
  if (harm === 'jam') {
    const energyLost = Math.min(1, state.run.energy);
    if (energyLost) spendRound();
    return [{ type: 'shotJammed', minion: m, energyLost, ...at }];
  }
  if (harm === 'loud') return [{ type: 'shotLoud', minion: m, ...at }, ...makeNoise('loud')];
  if (!m) return [{ type: 'shotIntoDark', end: aim.end }];
  return [{ type: 'shotLunged', minion: m, ...(aim.dark ? { dark: true } : {}) }, ...lungeAt(m)];
}

// The player walked into a downed stick man (moves.js), or shot one: it
// dies, for no energy and no dial when bumped, and pays its kind's gold as a kill. The caller
// spends the turn, like a step.
// Events: minionFinished { minion }, minionKilled { minion },
// goldGained { amount, from: 'kill' }.
export function finishDowned(m) {
  return [{ type: 'minionFinished', minion: m }, ...killMinion(m)];
}

// Takes a dead minion off the floor, drops it as a target, and pays its
// kind's gold (goldReward, so it doubles in the darkness). A shot's kill
// and a finish both end here.
// Events: minionKilled { minion }, goldGained { amount, from: 'kill' }.
function killMinion(m) {
  state.floor.minions = state.floor.minions.filter(x => x !== m);
  if (state.battle.selectedTarget === m) state.battle.selectedTarget = null;
  if (state.floor.gunTarget === m) state.floor.gunTarget = null;
  const gold = goldReward(MINION_KINDS[m.minionKind].gold);
  state.run.coinsTotal += gold;
  return [{ type: 'minionKilled', minion: m }, { type: 'goldGained', amount: gold, from: 'kill' }];
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

// The Struggle dial for the floor's next Struggle (kill or maim plan: the
// same dial as a shot): { zone: { from, to }, lapMs, count, phase }, one
// zone at a random spot round the circle, count being which Struggle on
// this floor it is (1 for the first), phase 'ready' until READY
// (readyStruggle). Each one after the first goes round STRUGGLE_SPEEDUP_MS
// faster, never past DIAL_LAP_LIMIT_MS, with a zone STRUGGLE_SHRINK
// narrower, never under STRUGGLE_MIN_WIDTH, so leaning on it gets harder.
// Counts the Struggle (state.floor.struggles); a new floor resets it
// (floor.js).
export function struggleDial() {
  const before = state.floor.struggles++;
  const width = Math.max(STRUGGLE_MIN_WIDTH, STRUGGLE_ZONE_WIDTH - before * STRUGGLE_SHRINK);
  const from = Math.random() * (1 - width);
  return {
    zone: { from, to: from + width },
    lapMs: Math.max(DIAL_LAP_LIMIT_MS, STRUGGLE_LAP_MS - before * STRUGGLE_SPEEDUP_MS),
    count: before + 1,
    phase: 'ready',
  };
}

// The player pressed READY on the Struggle dial: the marker starts. There
// is no BACK: it already has them. Events: struggleReady.
export function readyStruggle() {
  const struggle = state.battle.struggle;
  if (!struggle || struggle.phase !== 'ready') return [];
  struggle.phase = 'run';
  return [{ type: 'struggleReady' }];
}

// The Struggle dial stopped at `position` (0 to 1 round the circle) for
// the minion waiting in state.battle.struggle. Inside its zone the player
// shoves it away: STRUGGLE_PUSHBACK tiles, no damage to either. Anything
// else and it strikes, as it would have with energy left.
// Events: struggleWon { minion } then knockedBack { minion, from } if it
// had room to go; or struggleLost { minion }, its noise (noise.js
// makeNoise), then minionStrike's events.
export function settleStruggle(position) {
  const struggle = state.battle.struggle;
  if (!struggle) return [];
  state.battle.struggle = null;
  const m = struggle.minion;
  if (!state.floor.minions.includes(m)) return [];
  const { from: start, to: end } = struggle.zone;
  if (position < start || position > end) return [{ type: 'struggleLost', minion: m }, ...makeNoise('struggle'), ...minionStrike(m)];
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
  hunter.reaching = null;
  return [{ type: 'hunterStaggered', hunter }];
}
