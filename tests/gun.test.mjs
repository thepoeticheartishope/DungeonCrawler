// Unit tests for the gun's rules (js/gun.js): reload offers and answers,
// firing, the damage bar, a minion's strike, and staggering the hunter.
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as rules.test.mjs: a small open floor on the shared `state`,
// reset before each test. Math.random is swapped out where a roll decides
// the outcome.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshLight } from '../js/battery.js';
import { state, key } from '../js/state.js';
import {
  ENERGY_MAX, RELOAD_ENERGY, MATCH_KILL_SCALE, MINION_KINDS, DIAL_DEPTHS, DIAL_ZONE_GAP, DIAL_LAP_MS, DIAL_LAP_LIMIT_MS,
  HARM_KINDS, GUARD_STUN_MOVES, MINION_STRIKE_COST, MINION_STUN_MOVES,
  DARK_MISS_COST, DARK_GOLD_MULTIPLIER, HUNTER_REST_TURNS, MAX_HEARTS, STRUGGLE_PUSHBACK,
  STRUGGLE_ZONE_WIDTH, STRUGGLE_LAP_MS, STRUGGLE_SPEEDUP_MS, STRUGGLE_SHRINK, STRUGGLE_MIN_WIDTH,
} from '../js/config.js';
import { computeVisibility, seesEnemy } from '../js/sight.js';
import { spawnMinion, advanceMonsters, findAdjacentEnemies } from '../js/combat.js';
import { resetHaunts } from '../js/haunts.js';
import { stepPlayer } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { buildFloor } from '../js/floor.js';
import { aimLook } from '../js/look.js';
import {
  reloadCategory, reloadOffers, settleReload, pickTarget, refreshGunTarget, cycleTarget, fireBlock, fire, readyShot, cancelShot, settleShot,
  minionStrike, staggerHunter, readyStruggle, settleStruggle, dialZones, rollWeaknesses, addRounds, weaknessOf,
} from '../js/gun.js';

const SET = [
  { term: 'Who built the ark?', meaning: 'Noah', category: 'OT' },
  { term: 'Who led the exodus?', meaning: 'Moses', category: 'OT' },
  { term: 'Who was the first king?', meaning: 'Saul', category: 'OT' },
  { term: 'Who denied Jesus three times?', meaning: 'Peter', category: 'NT' },
  { term: 'Who wrote Romans?', meaning: 'Paul', category: 'NT' },
  { term: 'Who was a tax collector?', meaning: 'Matthew', category: 'NT' },
  { term: 'How many plagues?', meaning: '10', category: 'Numbers' },
  { term: 'How many tribes?', meaning: '12', category: 'Numbers' },
  { term: 'How many apostles?', meaning: '12 apostles', category: 'Numbers' },
];

// An open floor, player in the middle facing north, a full-ish run.
function resetFloor(size = 21) {
  state.floor.GRID_SIZE = size;
  state.run.roomIndex = 0;
  state.floor.playerRow = Math.floor(size / 2);
  state.floor.playerCol = Math.floor(size / 2);
  state.floor.facing = 'N';
  state.floor.look = null;
  state.settings.freeLook = false;
  state.settings.fogEnabled = true;
  state.settings.activeData = SET;
  state.settings.gunCombat = false;
  state.settings.downed = false; // downed.test.mjs checks stick men going down
  state.floor.darkness = false;
  state.floor.light = freshLight();
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.bossLitSet = new Set();
  state.floor.exploredSet = new Set();
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.minions = [];
  state.floor.chest = null;
  state.floor.props = [];
  state.run.coinsTotal = 0;
  state.run.correctTotal = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.energy = 1;
  state.run.rounds = [null];
  state.run.weakTo = {};
  state.run.weakKnown = new Set();
  state.run.reloadIndex = 0;
  state.battle.selectedTarget = null;
  state.floor.gunTarget = null;
  state.battle.aim = null;
  state.battle.struggle = null;
  state.floor.struggles = 0;
  state.battle.currentQuestion = SET[0];
  resetHaunts();
  computeVisibility();
}

// A minion `dr`, `dc` tiles from the player, with the light recomputed.
function minionAt(dr, dc, kind = 'SHARD') {
  const m = spawnMinion({ row: state.floor.playerRow + dr, col: state.floor.playerCol + dc }, kind);
  computeVisibility();
  return m;
}

// Runs `fn` with Math.random always returning `value`.
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

// --- reload ---

test('reload offers the next category with no, one and two modifiers', () => {
  resetFloor();
  const { block, category, offers } = reloadOffers();
  assert.equal(block, null);
  assert.deepEqual(category, reloadCategory());
  assert.deepEqual(offers.map(o => o.modifiers.length), [0, 1, 2]);
  assert.deepEqual(offers.map(o => o.energy), RELOAD_ENERGY);
  assert.equal(offers[2].energy, ENERGY_MAX, 'two modifiers fill the energy');
  const all = offers.flatMap(o => o.modifiers);
  assert.ok(!all.includes('gambler'));
  assert.equal(new Set(all).size, 3, 'the three modifiers are all different');
});

test('reload offers say how much energy still fits, and none when energy is full', () => {
  resetFloor();
  state.run.energy = ENERGY_MAX - 1;
  assert.deepEqual(reloadOffers().offers.map(o => o.room), [1, 1, 1]);
  state.run.energy = ENERGY_MAX;
  assert.equal(reloadOffers().block, 'energyFull');
});

test('a right reload gives the offer\'s energy, up to ENERGY_MAX, and counts as right', () => {
  resetFloor();
  const events = settleReload(true, { modifiers: ['blind', 'flip'], energy: 3 });
  assert.equal(state.run.energy, ENERGY_MAX);
  assert.equal(state.run.correctTotal, 1);
  assert.deepEqual(events[0], { type: 'reloaded', energy: 3, total: ENERGY_MAX });
});

test('a right two-modifier reload fills empty energy', () => {
  resetFloor();
  state.run.energy = 0;
  state.run.rounds = [];
  settleReload(true, reloadOffers().offers[2]);
  assert.equal(state.run.energy, ENERGY_MAX);
});

test('a wrong reload jams: nothing loads, no heart is lost, the miss haunts', () => {
  resetFloor();
  const events = settleReload(false, { modifiers: [], energy: 1 });
  assert.equal(state.run.energy, 1);
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(events[0].type, 'jammed');
  assert.equal(events[0].expected, 'Noah');
  assert.ok(state.run.haunts.has(SET[0]));
});

test('a reload from an energy cell uses the drum up, right or wrong', () => {
  resetFloor();
  const right = { row: 1, col: 1, kind: 'cell', searched: false };
  const wrong = { row: 2, col: 2, kind: 'cell', searched: false };
  settleReload(true, { modifiers: [], energy: 1 }, right);
  settleReload(false, { modifiers: [], energy: 1 }, wrong);
  assert.ok(right.searched);
  assert.ok(wrong.searched);
});

test('an energy cell is solid; bumping it finds it without a turn, and a used one is just blocked', () => {
  resetFloor();
  const r = state.floor.playerRow - 1;
  const c = state.floor.playerCol;
  const drum = { row: r, col: c, kind: 'cell', identified: false, searched: false, sprung: false };
  state.floor.props.push(drum);
  assert.equal(whatBlocks(r, c).kind, 'prop');
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type), ['cellFound']);
  assert.ok(drum.identified);
  assert.ok(!drum.searched, 'the drum is used only once a reload answer settles');
  drum.searched = true;
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type), ['blocked']);
});

test('the reload category comes round in order, one step per settled reload', () => {
  resetFloor();
  const first = reloadCategory();
  settleReload(true, { modifiers: [], energy: 1 });
  const second = reloadCategory();
  assert.notEqual(second.category, first.category);
  settleReload(false, { modifiers: [], energy: 1 });
  settleReload(false, { modifiers: [], energy: 1 });
  assert.equal(reloadCategory().category, first.category, 'three categories, so the fourth reload is the first again');
});

test('a set with no categories reloads from the whole set', () => {
  resetFloor();
  state.settings.activeData = SET.map(({ term, meaning }) => ({ term, meaning }));
  const category = reloadCategory();
  assert.equal(category.label, null);
  assert.equal(category.pool, state.settings.activeData);
});

// --- fire ---

test('fire is blocked with no energy, at the boss, or out of the light', () => {
  resetFloor();
  const m = minionAt(-2, 0);
  state.run.energy = 0;
  assert.equal(fireBlock(m), 'noEnergy');
  state.run.energy = 1;
  assert.equal(fireBlock({ kind: 'boss', row: m.row, col: m.col + 1 }), 'notShootable');
  const behind = minionAt(3, 0);
  assert.equal(fireBlock(behind), 'notInLight');
  const events = fire(behind);
  assert.deepEqual(events, [{ type: 'fireBlocked', target: behind, reason: 'notInLight' }]);
  assert.equal(state.run.energy, 1, 'a blocked shot spends nothing');
});

test('a shot that can be taken always lands, however far; nothing is spent until READY', () => {
  resetFloor();
  const m = minionAt(-4, 0);
  const events = withRandom(0.99, () => fire(m));
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'aimStarted']);
  assert.equal(state.battle.aim.target, m);
  assert.equal(state.battle.aim.phase, 'ready');
  assert.equal(state.run.energy, 1, 'nothing spent before READY');
  assert.deepEqual(readyShot().map(e => e.type), ['shotReady']);
  assert.equal(state.battle.aim.phase, 'run');
  assert.equal(state.run.energy, 0);
  assert.deepEqual(readyShot(), [], 'READY only once');
});

test('BACK before READY puts the gun down for free; once it runs there is no BACK', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  fire(m);
  assert.deepEqual(settleShot(0.5), [], 'a dial at READY can\'t be stopped');
  assert.deepEqual(cancelShot(), [{ type: 'shotCancelled' }]);
  assert.equal(state.battle.aim, null);
  assert.equal(state.run.energy, 1);
  fire(m);
  readyShot();
  assert.deepEqual(cancelShot(), []);
  assert.ok(state.battle.aim);
});

test('a landed shot waits on a dial sized by the kind, with its traits, and the depth\'s speed and lap limit', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'HUSK');
  withRandom(0.5, () => fire(m));
  const aim = state.battle.aim;
  const width = tier => aim.zones.filter(z => z.tier === tier).map(z => +(z.to - z.from).toFixed(6));
  assert.deepEqual(width('kill'), [MINION_KINDS.HUSK.killWidth]);
  assert.deepEqual(width('maim'), [MINION_KINDS.HUSK.maimWidth]);
  assert.deepEqual(width('harm'), [], 'no harmful zones on the first depth');
  assert.deepEqual(aim.traits, MINION_KINDS.HUSK.dial);
  assert.equal(aim.lapMs, DIAL_LAP_MS[DIAL_DEPTHS[0].speed]);
  assert.equal(aim.lapLimit, DIAL_DEPTHS[0].lapLimit);
  assert.equal(aim.darkArc, false);
});

test('in the tutorial room the dial is plain: no kind traits, no harmful zones, the first depth\'s speed', () => {
  resetFloor();
  state.run.roomIndex = DIAL_DEPTHS.length - 1;
  state.floor.tutorial = { stage: 'fight' };
  try {
    const m = minionAt(-1, 0, 'HUSK');
    withRandom(0.5, () => fire(m));
    const aim = state.battle.aim;
    assert.deepEqual(aim.traits, { spin: 'still', turnBack: false, surge: false });
    assert.deepEqual(aim.zones.map(z => z.tier).sort(), ['kill', 'maim']);
    assert.equal(aim.lapMs, DIAL_LAP_MS[DIAL_DEPTHS[0].speed]);
    assert.equal(aim.lapLimit, DIAL_DEPTHS[0].lapLimit);
    assert.equal(aim.darkArc, false);
  } finally {
    state.floor.tutorial = null;
    state.run.roomIndex = 0;
  }
});

test('dial zones: one kill, one maim and the depth\'s harmful ones, never touching, inside the circle, at new spots each shot', () => {
  resetFloor();
  const layouts = new Set();
  DIAL_DEPTHS.forEach((depth, i) => {
    state.run.roomIndex = i;
    for (let n = 0; n < 50; n++) {
      for (const [kind, stats] of Object.entries(MINION_KINDS)) {
        const zones = dialZones(kind);
        const count = tier => zones.filter(z => z.tier === tier).length;
        assert.deepEqual([count('kill'), count('maim'), count('harm')], [1, 1, depth.harms]);
        const size = tier => { const z = zones.find(x => x.tier === tier); return z.to - z.from; };
        assert.ok(Math.abs(size('kill') - stats.killWidth * depth.scale) < 1e-9);
        assert.ok(Math.abs(size('maim') - stats.maimWidth * depth.scale) < 1e-9);
        zones.filter(z => z.tier === 'harm').forEach(z => assert.ok(HARM_KINDS.includes(z.harm)));
        // The gap across the top of the circle counts too: from 0 to the first, the last to 1.
        assert.ok(zones[0].from >= DIAL_ZONE_GAP - 1e-9);
        assert.ok(zones[zones.length - 1].to <= 1 + 1e-9);
        zones.slice(1).forEach((z, j) => assert.ok(z.from - zones[j].to >= DIAL_ZONE_GAP - 1e-9));
        layouts.add(zones.map(z => z.tier + z.from.toFixed(3)).join());
      }
    }
  });
  state.run.roomIndex = DIAL_DEPTHS.length + 2;
  assert.equal(dialZones('SHARD').length, 2 + DIAL_DEPTHS.at(-1).harms, 'past the table, the last row');
  state.run.roomIndex = 0;
  assert.ok(layouts.size > 100, 'zones move from shot to shot');
});

test('every harmful kind turns up', () => {
  resetFloor();
  state.run.roomIndex = DIAL_DEPTHS.length - 1;
  const seen = new Set();
  for (let n = 0; n < 200; n++) dialZones('SHARD').forEach(z => z.harm && seen.add(z.harm));
  assert.deepEqual([...seen].sort(), [...HARM_KINDS].sort());
  state.run.roomIndex = 0;
});

test('speed is a lever with a limit: the deepest depth is fast with a lap limit, and no lap is under DIAL_LAP_LIMIT_MS', () => {
  resetFloor();
  state.run.roomIndex = DIAL_DEPTHS.length - 1;
  fire(minionAt(-1, 0));
  assert.equal(state.battle.aim.lapMs, DIAL_LAP_MS.fast);
  assert.equal(state.battle.aim.lapLimit, 3);
  Object.values(DIAL_LAP_MS).forEach(ms => assert.ok(ms >= DIAL_LAP_LIMIT_MS));
  state.run.roomIndex = 0;
});

test('a landed shot staggers the hunter where it stands', () => {
  resetFloor();
  const h = minionAt(-1, 0);
  h.kind = 'hunter';
  h.minionKind = null;
  const events = withRandom(0, () => fire(h));
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'hunterStaggered']);
  assert.equal(state.run.energy, 0, 'no dial: the round goes at once');
  assert.equal(h.rest, HUNTER_REST_TURNS);
  assert.equal(state.battle.aim, null);
  assert.equal(state.floor.minions.length, 1, 'the hunter never dies');
});

// --- pickTarget ---

test('tapping a shootable minion targets it; tapping anything else clears it', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(pickTarget({ row: m.row, col: m.col }), [{ type: 'targetPicked', target: m }]);
  assert.equal(state.floor.gunTarget, m);
  assert.deepEqual(pickTarget({ row: m.row + 1, col: m.col + 3 }), [{ type: 'targetCleared' }]);
  assert.equal(state.floor.gunTarget, null);
});

test('a minion the player can\'t see can\'t be picked', () => {
  resetFloor();
  const m = minionAt(3, 0); // behind the player, out of their light
  assert.deepEqual(pickTarget({ row: m.row, col: m.col }), [{ type: 'targetCleared' }]);
  assert.equal(state.floor.gunTarget, null);
});

test('a minion lit only by the boss isn\'t seen, so it can\'t be picked', () => {
  resetFloor();
  const m = minionAt(3, 0); // behind the player, out of their own light
  state.floor.bossLitSet = new Set([m.row + ',' + m.col]);
  computeVisibility();
  assert.ok(state.floor.visibleSet.has(m.row + ',' + m.col));
  assert.equal(seesEnemy(m), false);
  assert.deepEqual(pickTarget({ row: m.row, col: m.col }), [{ type: 'targetCleared' }]);
});

test('a minion lit only by standing beside the player can\'t be shot until they look at it', () => {
  resetFloor();
  state.settings.gunCombat = true;
  const beside = minionAt(0, 1);
  assert.ok(state.floor.sightSet.has(key(beside.row, beside.col)), 'it is lit');
  assert.equal(fireBlock(beside), 'notInLight');
  assert.deepEqual(refreshGunTarget(), [], 'never the target');
  assert.deepEqual(pickTarget(beside), [{ type: 'targetBlocked', target: beside, reason: 'notInLight' }],
    'free look off: the light can\'t go to it');
  state.settings.freeLook = true;
  assert.deepEqual(pickTarget(beside), [{ type: 'targetPicked', target: beside }],
    'free look on: aiming at it brings it into the cone (30° plus the slack reaches the tile beside)');
  const behind = minionAt(1, 0);
  const events = pickTarget(behind);
  assert.equal(events.at(-1).type, 'targetBlocked');
  assert.equal(events.at(-1).reason, 'needsTurn', 'behind is past the free arc');
});

test('with free look, tapping a minion swings the light to it and the target follows', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.settings.freeLook = true;
  const ahead = minionAt(-1, 0);
  const off = minionAt(-3, 2); // 34° east of north, further away
  refreshGunTarget();
  assert.equal(state.floor.gunTarget, ahead);
  assert.deepEqual(pickTarget(off), [{ type: 'targetPicked', target: off }]);
  assert.equal(state.floor.gunTarget, off);
  assert.ok(Math.abs(state.floor.look - Math.atan2(2, 3)) < 1e-9, 'the aim is on it');
});

test('with two in the cone, the one nearer the aim is the target even when further away', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.settings.freeLook = true;
  const near = minionAt(-1, 1);  // 45° east, close
  const far = minionAt(-4, 0);   // straight north, far
  refreshGunTarget();
  assert.equal(state.floor.gunTarget, far, 'looking north: the far one is on the aim');
  aimLook(Math.PI / 6);
  assert.equal(state.floor.gunTarget, near, 'sweeping the light east switches targets');
});

// --- settleShot ---

// Fires at `m` with Math.random at 0 (the zones packed from the top in a
// fixed order, so 0.995 is past them all) and presses READY.
function aimAt(m) {
  withRandom(0, () => fire(m));
  readyShot();
}

// The middle of the running aim's first zone of `tier` (and `harm`).
function zoneMiddle(tier, harm = null) {
  const zone = state.battle.aim.zones.find(z => z.tier === tier && (!harm || z.harm === harm));
  return (zone.from + zone.to) / 2;
}

// A harmful zone of kind `harm` put on the running aim, over its first gap.
function harmZone(harm) {
  const zone = { tier: 'harm', harm, from: 0.001, to: state.battle.aim.zones[0].from - 0.001 };
  state.battle.aim.zones.push(zone);
  return (zone.from + zone.to) / 2;
}

test('the dial: a miss outside the zones; a kill in the kill zone; a maim (DEV -> Downed off) only makes it reel', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'STALKER');
  state.run.energy = 3;
  aimAt(m);
  assert.deepEqual(settleShot(0.995), [{ type: 'shotMissed', minion: m }]);
  assert.ok(state.floor.minions.includes(m));

  aimAt(m);
  assert.deepEqual(settleShot(zoneMiddle('maim')).map(e => e.type), ['minionHit', 'minionReels']);
  assert.ok(state.floor.minions.includes(m));

  aimAt(m);
  const kill = settleShot(zoneMiddle('kill'));
  assert.deepEqual(kill[0], { type: 'minionHit', minion: m, tier: 'kill', matched: false });
  assert.deepEqual(kill.slice(1).map(e => e.type), ['minionKilled', 'goldGained']);
  assert.ok(!state.floor.minions.includes(m));
});

test('a HUSK\'s guard takes the first hit and breaks: stun 2 from the kill zone, 1 from the maim zone', () => {
  resetFloor();
  state.run.energy = 3;
  const a = minionAt(-1, 0, 'HUSK');
  assert.equal(a.guard, true);
  aimAt(a);
  assert.deepEqual(settleShot(zoneMiddle('kill')), [
    { type: 'minionHit', minion: a, tier: 'kill', matched: false },
    { type: 'guardBroken', minion: a, stun: GUARD_STUN_MOVES.kill },
  ]);
  assert.equal(a.guard, false);
  assert.equal(a.rest, GUARD_STUN_MOVES.kill);
  assert.ok(state.floor.minions.includes(a), 'the guard took it');

  aimAt(a);
  assert.deepEqual(settleShot(zoneMiddle('kill')).map(e => e.type), ['minionHit', 'minionKilled', 'goldGained'], 'then like any other');

  const b = minionAt(-1, 0, 'HUSK');
  aimAt(b);
  settleShot(zoneMiddle('maim'));
  assert.equal(b.guard, false);
  assert.equal(b.rest, Math.max(MINION_STUN_MOVES, GUARD_STUN_MOVES.maim));
});

test('a hit stuns the minion: it skips its next move, then comes on', () => {
  resetFloor();
  state.settings.gunCombat = true;
  const m = minionAt(-1, 0, 'SHARD');
  state.run.energy = 2;
  aimAt(m);
  settleShot(zoneMiddle('maim'));
  assert.equal(m.rest, MINION_STUN_MOVES);
  assert.deepEqual(advanceMonsters().filter(e => e.minion === m), [], 'stunned: no strike');
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(advanceMonsters()[0].type, 'minionStruck', 'then it strikes');
});

test('a miss does not stun', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'SHARD');
  aimAt(m);
  settleShot(0.995);
  assert.ok(!(m.rest > 0));
});

test('a slow minion\'s stun is spent on a turn it would have moved', () => {
  resetFloor();
  state.settings.gunCombat = true;
  const m = minionAt(-1, 0, 'HUSK');
  m.rest = 1;
  state.run.turnCount = 0; // the next turn (1) is an off turn for moveEvery 2
  assert.deepEqual(advanceMonsters().filter(e => e.minion === m), []);
  assert.equal(m.rest, 1, 'still stunned after its off turn');
  assert.deepEqual(advanceMonsters().filter(e => e.minion === m), [], 'the stun takes its move');
  assert.equal(m.rest, 0);
  assert.equal(state.run.hearts, MAX_HEARTS);
});

test('a jam zone loses one more round, and nothing else', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'SHARD');
  state.run.energy = 3;
  aimAt(m);
  assert.deepEqual(settleShot(harmZone('jam')), [{ type: 'shotJammed', minion: m, energyLost: 1 }]);
  assert.equal(state.run.energy, 1, 'the shot and the jam');
  assert.ok(state.floor.minions.includes(m));

  state.run.energy = 1;
  aimAt(m);
  assert.equal(settleShot(harmZone('jam'))[0].energyLost, 0, 'nothing left to lose');
  assert.equal(state.run.energy, 0);
});

test('a loud zone makes a noise', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'SHARD');
  aimAt(m);
  const events = settleShot(harmZone('loud'));
  assert.deepEqual(events[0], { type: 'shotLoud', minion: m });
  assert.equal(events[1].type, 'noiseMade', 'loud (noise.js)');
  assert.equal(events[1].kind, 'loud');
});

test('a lunge zone brings it one step closer at once; next to the player, it strikes', () => {
  resetFloor();
  state.settings.gunCombat = true;
  const m = minionAt(-3, 0, 'SHARD');
  state.run.energy = 3; // energy left after both shots, so no Struggle
  aimAt(m);
  const events = settleShot(harmZone('lunge'));
  assert.deepEqual(events.map(e => e.type), ['shotLunged', 'minionMoved']);
  assert.equal(m.row, state.floor.playerRow - 2);

  m.row = state.floor.playerRow - 1;
  computeVisibility();
  aimAt(m);
  assert.deepEqual(settleShot(harmZone('lunge')).slice(0, 2).map(e => e.type), ['shotLunged', 'minionStruck']);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
});

test('a kill takes the minion off the floor and pays its gold, doubled in the darkness', () => {
  resetFloor();
  state.floor.darkness = true;
  const m = minionAt(-1, 0, 'SHARD');
  state.battle.selectedTarget = m;
  state.floor.gunTarget = m;
  aimAt(m);
  const events = settleShot(zoneMiddle('kill'));
  const gold = MINION_KINDS.SHARD.gold * DARK_GOLD_MULTIPLIER;
  assert.deepEqual(events.slice(-2), [{ type: 'minionKilled', minion: m }, { type: 'goldGained', amount: gold, from: 'kill' }]);
  assert.equal(state.floor.minions.length, 0);
  assert.equal(state.battle.selectedTarget, null);
  assert.equal(state.floor.gunTarget, null, 'a dead minion is no longer the target');
  assert.equal(state.run.coinsTotal, gold);
});

test('settleShot with no shot waiting does nothing', () => {
  resetFloor();
  assert.deepEqual(settleShot(0.5), []);
});

// --- minionStrike / staggerHunter ---

test('a strike costs stability and knocks the minion back along its trail', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  m.trail = [{ row: m.row - 3, col: m.col }, { row: m.row - 2, col: m.col }, { row: m.row - 1, col: m.col }];
  const start = { row: m.row, col: m.col };
  const events = minionStrike(m);
  assert.deepEqual(events, [
    { type: 'minionStruck', minion: m, cost: MINION_STRIKE_COST },
    { type: 'knockedBack', minion: m, from: start },
  ]);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
  assert.equal(m.row, start.row - 3);
  assert.deepEqual(m.trail, []);
});

test('a strike in the darkness costs as much as a miss, and can end the run', () => {
  resetFloor();
  state.floor.darkness = true;
  state.run.hearts = DARK_MISS_COST;
  const m = minionAt(-1, 0);
  const events = minionStrike(m);
  assert.equal(events[0].cost, DARK_MISS_COST);
  assert.equal(events.at(-1).type, 'signalLost');
});

test('a strike doesn\'t knock a minion onto a tile that is taken', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  const back = { row: m.row - 1, col: m.col };
  m.trail = [back];
  minionAt(-2, 0);
  const events = minionStrike(m);
  assert.deepEqual(events.map(e => e.type), ['minionStruck']);
  assert.equal(m.row, state.floor.playerRow - 1);
});

test('staggerHunter rests the hunter without moving it', () => {
  resetFloor();
  const h = { row: 1, col: 1, kind: 'hunter', rest: 0 };
  assert.deepEqual(staggerHunter(h), [{ type: 'hunterStaggered', hunter: h }]);
  assert.equal(h.rest, HUNTER_REST_TURNS);
  assert.equal(h.row, 1);
});

// --- gun combat in the turn (step 6) ---

test('fire with no target says so', () => {
  resetFloor();
  assert.equal(fireBlock(null), 'noTarget');
});

test('refreshGunTarget picks the best shootable minion and drops a dead one', () => {
  resetFloor();
  const far = minionAt(-3, 0);
  const near = minionAt(-1, 0);
  assert.deepEqual(refreshGunTarget(), [{ type: 'targetPicked', target: near, auto: true }], 'both on the aim: the nearer one');
  assert.equal(state.floor.gunTarget, near);
  assert.deepEqual(refreshGunTarget(), [], 'a target that is still the best stays');
  state.floor.minions = state.floor.minions.filter(m => m !== near);
  refreshGunTarget();
  assert.equal(state.floor.gunTarget, far);
});

test('refreshGunTarget drops a target that can no longer be shot', () => {
  resetFloor();
  const behind = minionAt(2, 0);
  state.floor.gunTarget = behind;
  assert.deepEqual(refreshGunTarget(), []);
  assert.equal(state.floor.gunTarget, null);
});

test('cycleTarget goes round the shootable minions, and says when there are none', () => {
  resetFloor();
  assert.deepEqual(cycleTarget(), [{ type: 'fireBlocked', target: null, reason: 'noTarget' }]);
  const near = minionAt(-1, 0);
  const far = minionAt(-3, 0);
  minionAt(3, 0); // behind the player: out of the light
  assert.equal(cycleTarget()[0].target, near);
  assert.equal(cycleTarget()[0].target, far);
  assert.equal(cycleTarget()[0].target, near);
});

test('with the gun on, a minion that reaches the player strikes instead of engaging', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.run.turnCount = 0;
  const m = minionAt(-1, 0);
  m.trail = [{ row: m.row - 3, col: m.col }];
  const events = advanceMonsters();
  assert.deepEqual(events.map(e => e.type), ['minionStruck', 'knockedBack']);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
  assert.equal(state.battle.selectedTarget, null, 'no battle screen');
  assert.deepEqual(findAdjacentEnemies(), []);
});

test('with the gun on, the hunter strikes like a minion and never opens the battle screen', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.floor.darkness = true;
  state.floor.darkTurns = 0;
  const hunter = minionAt(-1, 0, null);
  hunter.kind = 'hunter';
  hunter.rest = 0;
  state.floor.hunter = hunter;
  hunter.trail = [{ row: hunter.row - 3, col: hunter.col }];
  assert.deepEqual(findAdjacentEnemies(), []);
  const events = advanceMonsters();
  assert.deepEqual(events.map(e => e.type), ['minionStruck', 'knockedBack']);
  assert.equal(events[0].minion, hunter);
  assert.equal(state.run.hearts, MAX_HEARTS - DARK_MISS_COST, 'the hunter only walks in the darkness');
  assert.equal(state.battle.selectedTarget, null, 'no battle screen');
});

test('with the gun on, a staggered hunter stands still for HUNTER_REST_TURNS turns, then hunts again', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.floor.darkness = true;
  state.floor.darkTurns = 0;
  const hunter = minionAt(-3, 0, null);
  hunter.kind = 'hunter';
  hunter.rest = 0;
  state.floor.hunter = hunter;
  staggerHunter(hunter);
  const start = { row: hunter.row, col: hunter.col };
  for (let i = 0; i < HUNTER_REST_TURNS; i++) advanceMonsters();
  assert.deepEqual({ row: hunter.row, col: hunter.col }, start);
  assert.ok(advanceMonsters().some(e => e.type === 'minionMoved' && e.minion === hunter));
});

test('with the gun on, a slow kind moves only every moveEvery turns', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.run.turnCount = 0;
  const husk = minionAt(-3, 0, 'HUSK');
  const moves = [];
  for (let i = 0; i < 4; i++) {
    moves.push(advanceMonsters().some(e => e.type === 'minionMoved' && e.minion === husk));
  }
  assert.equal(MINION_KINDS.HUSK.moveEvery, 2);
  assert.deepEqual(moves, [false, true, false, true]);
});

// A minion one step north of the player, the gun on, no energy, on
// a turn every kind moves.
function struggleSetUp() {
  resetFloor();
  state.settings.gunCombat = true;
  state.run.turnCount = 0;
  state.run.energy = 0;
  return minionAt(-1, 0);
}

test('with no energy, a minion that reaches the player starts a Struggle instead of striking', () => {
  const m = struggleSetUp();
  const events = advanceMonsters();
  assert.deepEqual(events.map(e => e.type), ['struggleStarted']);
  assert.equal(state.run.hearts, MAX_HEARTS, 'nothing is lost until the dial stops');
  assert.equal(state.battle.struggle.minion, m);
});

test('with a reload open over the map, a minion strikes even with no energy', () => {
  struggleSetUp();
  assert.equal(advanceMonsters({ canStruggle: false })[0].type, 'minionStruck');
  assert.equal(state.battle.struggle, null);
});

// The middle of the waiting Struggle's zone, after READY.
function struggleMiddle() {
  readyStruggle();
  const { from, to } = state.battle.struggle.zone;
  return (from + to) / 2;
}

test('a Struggle waits for READY (no BACK), then a win pushes the minion STRUGGLE_PUSHBACK tiles straight away', () => {
  const m = struggleSetUp();
  advanceMonsters();
  assert.equal(state.battle.struggle.phase, 'ready');
  assert.deepEqual(readyStruggle(), [{ type: 'struggleReady' }]);
  assert.equal(state.battle.struggle.phase, 'run');
  const before = m.row;
  const { from, to } = state.battle.struggle.zone;
  const events = settleStruggle((from + to) / 2);
  assert.deepEqual(events.map(e => e.type), ['struggleWon', 'knockedBack']);
  assert.equal(m.row, before - STRUGGLE_PUSHBACK);
  assert.equal(m.col, state.floor.playerCol);
  assert.ok(state.floor.minions.includes(m));
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(state.battle.struggle, null);
});

test('a Struggle push stops at a wall', () => {
  const m = struggleSetUp();
  advanceMonsters();
  state.floor.wallSet.add(key(m.row - 2, m.col));
  settleStruggle(struggleMiddle());
  assert.equal(m.row, state.floor.playerRow - 2, 'one tile back, then the wall');
});

test('a Struggle lost outside the zone is a strike', () => {
  struggleSetUp();
  advanceMonsters();
  readyStruggle();
  const { from, to } = state.battle.struggle.zone;
  const outside = from > 0.05 ? from / 2 : (to + 1) / 2;
  const events = settleStruggle(outside);
  assert.deepEqual(events.slice(0, 3).map(e => e.type), ['struggleLost', 'noiseMade', 'minionStruck']);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
});

test('each Struggle on a floor is faster with a smaller zone, never past the speed limit or under the smallest zone', () => {
  const dials = [];
  for (let i = 0; i < 10; i++) {
    struggleSetUp();
    state.floor.struggles = i;
    advanceMonsters();
    dials.push(state.battle.struggle);
  }
  const width = d => d.zone.to - d.zone.from;
  assert.deepEqual(dials.slice(0, 2).map(d => d.count), [1, 2]);
  assert.ok(Math.abs(width(dials[0]) - STRUGGLE_ZONE_WIDTH) < 1e-9);
  assert.equal(dials[0].lapMs, STRUGGLE_LAP_MS);
  assert.ok(Math.abs(width(dials[1]) - (STRUGGLE_ZONE_WIDTH - STRUGGLE_SHRINK)) < 1e-9);
  assert.equal(dials[1].lapMs, STRUGGLE_LAP_MS - STRUGGLE_SPEEDUP_MS);
  assert.ok(Math.abs(width(dials[9]) - STRUGGLE_MIN_WIDTH) < 1e-9);
  assert.equal(dials[9].lapMs, DIAL_LAP_LIMIT_MS);
  dials.forEach(d => assert.ok(d.zone.from >= 0 && d.zone.to <= 1));
});

test('a new floor resets the Struggle count', () => {
  struggleSetUp();
  advanceMonsters();
  advanceMonsters();
  assert.ok(state.floor.struggles > 0);
  buildFloor();
  assert.equal(state.floor.struggles, 0);
});

test('only the first minion to reach an empty-handed player struggles; others strike', () => {
  struggleSetUp();
  minionAt(0, 1);
  const types = advanceMonsters().map(e => e.type);
  assert.equal(types.filter(t => t === 'struggleStarted').length, 1);
  assert.ok(types.includes('minionStruck'));
});

test('in classic combat a minion that reaches the player engages, as before', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(advanceMonsters().map(e => e.type), ['minionEngaged']);
  assert.equal(state.battle.selectedTarget, m);
  assert.equal(state.run.hearts, MAX_HEARTS);
});

// --- Category weaknesses (strategy plan step D) ---

test('each minion kind is weak to one of the set\'s reload groups', () => {
  state.settings.activeData = SET;
  rollWeaknesses();
  const labels = ['SHARD', 'STALKER', 'HUSK'].map(weaknessOf);
  labels.forEach(l => assert.ok(l, 'every kind has one'));
  assert.equal(new Set(labels).size, 3, 'three groups, three different weaknesses');
  assert.equal(state.run.weakKnown.size, 0, 'none known yet');
});

test('a reload\'s rounds keep its group; firing spends a matching round first', () => {
  resetFloor();
  state.settings.activeData = SET;
  state.run.energy = 0;
  state.run.rounds = [];
  const group = reloadCategory().label;
  settleReload(true, { energy: 2 });
  assert.deepEqual(state.run.rounds, [group, group]);
  addRounds(1, 'other');
  const m = minionAt(-1, 0, 'HUSK');
  state.run.weakTo = { HUSK: 'other' };
  withRandom(0, () => fire(m));
  readyShot();
  assert.deepEqual(state.run.rounds, [group, group], 'the matching round went first');
  assert.equal(state.run.energy, 2);
  assert.ok(state.battle.aim.matched);
});

test('a matched round widens the kill zone, and READY on a landed shot reveals the weakness once', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'STALKER');
  state.run.weakTo = { STALKER: 'OT' };
  state.run.rounds = ['OT'];
  const fired = withRandom(0, () => fire(m));
  assert.ok(!fired.some(e => e.type === 'weaknessFound'), 'not before READY');
  assert.ok(state.battle.aim.matched);
  const kill = state.battle.aim.zones.find(z => z.tier === 'kill');
  assert.ok(Math.abs(kill.to - kill.from - MINION_KINDS.STALKER.killWidth * MATCH_KILL_SCALE) < 1e-9);
  assert.deepEqual(readyShot().filter(e => e.type === 'weaknessFound'), [{ type: 'weaknessFound', minionKind: 'STALKER', label: 'OT' }]);
  const hit = settleShot(zoneMiddle('maim'));
  assert.ok(hit[0].matched);

  state.run.energy = 1;
  state.run.rounds = ['NT'];
  withRandom(0, () => fire(m));
  assert.ok(!state.battle.aim.matched, 'a round from another group is plain');
  assert.ok(!readyShot().some(e => e.type === 'weaknessFound'), 'already known');
});
