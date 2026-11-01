// Unit tests for the light's battery (js/battery.js, light battery plan
// step A): it runs down with the light on and charges with it off, runs
// empty and stays locked off until full, can be switched back on any time
// when switched off by hand, is full on every floor, and is out of play in
// Comfort mode. With the light off only the small circle is lit.
// Step B: the stick men notice the light (combat.js notice). Step C: shots
// in the dark (gun.js fireDark). Step E: the eye (gaze.js).
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as look.test.mjs: a small open floor on the shared `state`,
// reset before each test.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, withRandom } from './helpers.mjs';
import { state, key, parseKey } from '../js/state.js';
import { LIGHT_BATTERY_MAX, PLAYER_LIGHT_RADIUS, MINION_TRACK_TURNS, GAZE_MS, DIAL_DEPTHS, DIAL_LAP_MS, DIAL_LAP_LIMIT_MS, DARK_SWEEP_SCALE, LOW_BATTERY_CHARGE } from '../js/config.js';
import { tickGaze } from '../js/gaze.js';
import { fire, fireBlock, readyShot, settleShot, darkShotPath } from '../js/gun.js';
import { freshLight, lightOn, tickLight, toggleLight, turnsToFull } from '../js/battery.js';
import { computeVisibility, inLookCone, shootBlock } from '../js/sight.js';
import { advanceMonsters, spawnMinion, lockOn } from '../js/combat.js';

// These are the turn game's rules (the start screen's Turns option): One
// stick, the default since one stick plan step G, has its own tests.
state.settings.oneStick = false;

function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { fogEnabled: true, lightBattery: true, simpleEnemies: false, gaze: true },
    floor: { look: 0 },
  });
}

const types = events => events.map(e => e.type);

test('the light runs down a charge a turn, then dies and locks', () => {
  resetFloor();
  for (let i = 1; i < LIGHT_BATTERY_MAX; i++) {
    assert.deepEqual(tickLight(), []);
    assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX - i);
    assert.ok(lightOn());
  }
  assert.deepEqual(types(tickLight()), ['lightDied']);
  assert.deepEqual(state.floor.light, { on: false, charge: 0, locked: true });
  assert.ok(!lightOn());
});

test('on the ship the battery is out of play: always lit, V does nothing, it never runs down (Timothy 2026-11-01)', () => {
  resetFloor();
  state.floor.ship = true;
  for (let i = 0; i < LIGHT_BATTERY_MAX + 2; i++) tickLight();
  assert.equal(toggleLight(), null);
  assert.equal(lightOn(), true);
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX);
  delete state.floor.ship; // the shared floor outlives this test
});

test('run empty, it stays locked off until full, then can come on', () => {
  resetFloor();
  state.floor.light = { on: false, charge: 0, locked: true };
  for (let i = 1; i < LIGHT_BATTERY_MAX; i++) {
    assert.deepEqual(tickLight(), []);
    assert.equal(toggleLight(), 'locked');
    assert.equal(turnsToFull(), LIGHT_BATTERY_MAX - i);
    assert.ok(!state.floor.light.on);
  }
  assert.deepEqual(types(tickLight()), ['lightCharged']);
  assert.equal(state.floor.light.locked, false);
  assert.equal(toggleLight(), 'on');
});

test('switched off by hand with charge left, it charges and comes back on any time', () => {
  resetFloor();
  tickLight();
  tickLight();
  assert.equal(toggleLight(), 'off');
  assert.deepEqual(tickLight(), []);
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX - 1);
  assert.equal(toggleLight(), 'on', 'not full, but not locked');
  assert.equal(toggleLight(), 'off');
  tickLight();
  assert.deepEqual(tickLight(), [], 'full again says nothing when it was never locked');
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX, 'never past full');
});

test('the battery ticks once per turn, before anything moves', () => {
  resetFloor();
  for (let i = 1; i < LIGHT_BATTERY_MAX; i++) advanceMonsters();
  const events = advanceMonsters();
  assert.equal(events[0].type, 'lightDied');
  assert.ok(!lightOn());
});

test('every floor starts with a full battery and the light on', () => {
  assert.deepEqual(freshLight(), { on: true, charge: LIGHT_BATTERY_MAX, locked: false });
});

test('with the light off only the small circle is lit, and nothing in the cone can be shot', () => {
  resetFloor();
  const ahead = { row: state.floor.playerRow - 3, col: state.floor.playerCol };
  assert.ok(state.floor.sightSet.has(key(ahead.row, ahead.col)));
  toggleLight();
  computeVisibility();
  const far = [...state.floor.sightSet].map(parseKey)
    .filter(({ row, col }) => Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol)) > PLAYER_LIGHT_RADIUS);
  assert.deepEqual(far, []);
  assert.ok(state.floor.sightSet.has(key(state.floor.playerRow - 1, state.floor.playerCol)));
  assert.ok(!inLookCone(ahead.row, ahead.col));
  assert.equal(shootBlock({ row: state.floor.playerRow - 1, col: state.floor.playerCol }), 'notInLight');
});

test('Comfort mode and DEV -> Light battery off: always on, no battery', () => {
  for (const flip of [() => { state.settings.simpleEnemies = true; }, () => { state.settings.lightBattery = false; }]) {
    resetFloor();
    flip();
    for (let i = 0; i < LIGHT_BATTERY_MAX + 2; i++) assert.deepEqual(tickLight(), []);
    assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX);
    assert.equal(toggleLight(), null);
    assert.ok(lightOn());
    state.floor.light.on = false; // even a light left off before the switch
    assert.ok(lightOn());
  }
});

// --- Step B: the stick men notice the light ---

const at = m => ({ row: m.row, col: m.col });

test('a stick man that sees a lit tile is drawn, even with the player out of its sight', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  // 9 tiles ahead: the player is past MINION_LIGHT_SIGHT, the cone's far
  // tiles aren't.
  const m = spawnMinion({ row: pr - 9, col: pc });
  advanceMonsters();
  assert.equal(m.drawn, true);
  assert.equal(m.track, MINION_TRACK_TURNS);
  assert.deepEqual(at(m), { row: pr - 8, col: pc }, 'it comes for the light');
});

test('with the light off, one that never saw the player does not notice them', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  toggleLight();
  computeVisibility();
  const m = spawnMinion({ row: pr, col: pc + 2 });
  for (let i = 0; i < 3; i++) {
    m.row = pr; m.col = pc + 2;
    advanceMonsters();
    assert.equal(m.drawn, false);
    assert.equal(m.track, 0);
  }
});

test('out of view it walks to where it last saw the player, not where they are', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  toggleLight();
  computeVisibility();
  const m = spawnMinion({ row: pr - 10, col: pc - 10 });
  // It saw the player 4 tiles up and 6 left of them; they moved on since.
  state.floor.playerRow = pr - 4; state.floor.playerCol = pc - 6;
  lockOn(m);
  state.floor.playerRow = pr; state.floor.playerCol = pc;
  for (let i = 0; i < 6; i++) {
    advanceMonsters();
    assert.equal(m.track, MINION_TRACK_TURNS, 'on its way, it does not forget');
  }
  assert.deepEqual(at(m), { row: pr - 4, col: pc - 6 }, 'it reached the spot');
  assert.equal(m.lastSeen, null, 'now it searches');
});

test('once at the spot it searches, runs down, and loses them; sight refreshes it', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  toggleLight();
  computeVisibility();
  const m = spawnMinion({ row: pr - 10, col: pc - 10 });
  m.track = MINION_TRACK_TURNS;
  advanceMonsters();
  assert.equal(m.track, MINION_TRACK_TURNS - 1, 'searching, one turn less');
  m.row = pr; m.col = pc + 3;
  advanceMonsters();
  assert.equal(m.track, MINION_TRACK_TURNS, 'sees the player: refreshed');
  assert.deepEqual(m.lastSeen, { row: pr, col: pc }, 'and remembers where');
  assert.equal(m.drawn, false, 'no light to be drawn by');
  m.row = pr - 10; m.col = pc - 10;
  m.lastSeen = null;
  for (let i = 0; i < MINION_TRACK_TURNS; i++) advanceMonsters();
  assert.equal(m.track, 0, 'lost them');
});

test('one that never saw the player can still blunder into them in the dark, and then knows them', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  toggleLight();
  const c = pc + 1;
  // Boxed in: the only way out is the player's tile.
  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, -1], [1, 0], [1, 1]]) state.floor.wallSet.add(key(pr + dr, c + dc));
  computeVisibility();
  const m = spawnMinion({ row: pr, col: c });
  const events = advanceMonsters();
  assert.ok(events.some(e => (e.type === 'minionStruck' || e.type === 'struggleStarted') && e.minion === m), 'it reached them');
  assert.equal(m.track, MINION_TRACK_TURNS);
});

test('the hunter and the boss darkness keep their rules: every one chases, light or not', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  toggleLight();
  computeVisibility();
  state.floor.darkness = true;
  const m = spawnMinion({ row: pr - 10, col: pc });
  const hunter = spawnMinion({ row: pr + 10, col: pc }, null);
  hunter.kind = 'hunter';
  hunter.rest = 0;
  state.floor.hunter = hunter;
  advanceMonsters();
  assert.equal(m.row, pr - 9, 'a minion chases in the darkness');
  assert.equal(hunter.row, pr + 9, 'so does the hunter');
  assert.equal(hunter.track, 0, 'the hunter is never drawn by the light');
  assert.equal(hunter.drawn, false);
});

test('Comfort mode keeps the old chase range and nothing is noticed', () => {
  resetFloor();
  state.settings.simpleEnemies = true;
  const { playerRow: pr, playerCol: pc } = state.floor;
  // Behind the player, 4 steps: the old rule chases.
  const near = spawnMinion({ row: pr + 4, col: pc });
  advanceMonsters();
  assert.equal(near.row, pr + 3);
  assert.equal(near.track, 0);
  assert.equal(near.drawn, false);
});

// --- Step C: shots in the dark ---

// The battery's light off, the gun on with `energy` plain rounds.
function darkWithGun(energy = 2) {
  resetFloor();
  state.run.energy = energy;
  state.run.rounds = Array(energy).fill(null);
  state.run.weakTo = {};
  state.run.weakKnown = new Set();
  state.battle.aim = null;
  toggleLight();
  computeVisibility();
}

test('a dark shot goes along the aim to the first stick man in the way, and stops at a wall', () => {
  darkWithGun();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const near = spawnMinion({ row: pr - 2, col: pc });
  spawnMinion({ row: pr - 4, col: pc });
  spawnMinion({ row: pr, col: pc + 1 }); // beside the player, off the aim
  assert.equal(darkShotPath().target, near);
  state.floor.wallSet.add(key(pr - 1, pc));
  assert.deepEqual(darkShotPath(), { target: null, end: { row: pr, col: pc } });
});

test('a dark shot with nothing there still costs 1 energy at READY and opens the dial', () => {
  darkWithGun();
  assert.equal(fireBlock(null), null, 'no target needed in the dark');
  const events = fire(null);
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'aimStarted']);
  assert.equal(state.run.energy, 2, 'nothing spent before READY');
  assert.equal(state.battle.aim.target, null);
  assert.ok(['fast', 'x'].includes(state.battle.aim.dark));
  assert.equal(state.battle.aim.darkArc, true, 'a dark shot hides its dark arc');
  readyShot();
  assert.equal(state.run.energy, 1);
  const gap = state.battle.aim.zones[0].from / 2;
  assert.deepEqual(settleShot(gap).map(e => e.type), ['shotIntoDark']);
  state.run.energy = 0;
  assert.equal(fireBlock(null), 'noEnergy');
});

test('a dark shot in the tutorial room is no harder: plain dial, no dark arc', () => {
  darkWithGun();
  state.floor.tutorial = { stage: 'fight' };
  try {
    for (const r of [0.1, 0.9]) {
      state.battle.aim = null;
      withRandom(r, () => fire(null));
      const aim = state.battle.aim;
      assert.equal(aim.dark, 'plain');
      assert.deepEqual(aim.traits, { spin: 'still', turnBack: false, surge: false });
      assert.deepEqual(aim.zones.map(z => z.tier).sort(), ['kill', 'maim']);
      assert.equal(aim.lapMs, DIAL_LAP_MS[DIAL_DEPTHS[0].speed]);
      assert.equal(aim.darkArc, false);
    }
  } finally {
    state.floor.tutorial = null;
  }
});

test('the dark dial is one step harder: one more harmful zone, or faster (never past the limit)', () => {
  darkWithGun();
  const depth = DIAL_DEPTHS[0];
  withRandom(0.9, () => fire(null));
  assert.equal(state.battle.aim.dark, 'x');
  assert.equal(state.battle.aim.zones.filter(z => z.tier === 'harm').length, depth.harms + 1);
  assert.equal(state.battle.aim.lapMs, DIAL_LAP_MS[depth.speed]);
  state.battle.aim = null;
  withRandom(0.1, () => fire(null));
  assert.equal(state.battle.aim.dark, 'fast');
  assert.equal(state.battle.aim.zones.filter(z => z.tier === 'harm').length, depth.harms);
  assert.equal(state.battle.aim.lapMs, Math.max(DIAL_LAP_LIMIT_MS, Math.round(DIAL_LAP_MS[depth.speed] * DARK_SWEEP_SCALE)));
});

test('a low battery hides the dark arc on a lit shot too', () => {
  darkWithGun();
  toggleLight();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const m = spawnMinion({ row: pr - 1, col: pc });
  state.floor.facing = 'N';
  computeVisibility();
  state.floor.light.charge = LOW_BATTERY_CHARGE + 1;
  fire(m);
  assert.equal(state.battle.aim.darkArc, false);
  state.battle.aim = null;
  state.floor.light.charge = LOW_BATTERY_CHARGE;
  fire(m);
  assert.equal(state.battle.aim.darkArc, true);
});

test('a dark shot that hits a stick man sets it tracking the player', () => {
  darkWithGun();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const m = spawnMinion({ row: pr - 3, col: pc });
  fire(null);
  assert.equal(state.battle.aim.target, m);
  readyShot();
  const hit = state.battle.aim.zones.find(z => z.tier === 'maim');
  const events = settleShot((hit.from + hit.to) / 2);
  const hurt = events.find(e => e.type === 'minionHit');
  assert.equal(hurt.dark, true);
  assert.equal(m.track, MINION_TRACK_TURNS);
});

test('with the light on, a shot still needs a target in the cone', () => {
  darkWithGun();
  toggleLight();
  computeVisibility();
  assert.deepEqual(fire(null).map(e => [e.type, e.reason]), [['fireBlocked', 'noTarget']]);
  assert.equal(state.run.energy, 2);
});

// --- Step E: the eye (gaze.js) ---

test('the eye adds up over every look, never runs down, and at 3 s the stick man steps closer', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const m = spawnMinion({ row: pr - 3, col: pc });
  const turns = state.run.turnCount;
  const charge = state.floor.light.charge;
  assert.deepEqual(tickGaze(GAZE_MS / 2), []);
  assert.equal(m.gaze, GAZE_MS / 2);
  state.floor.facing = 'S'; // turn away
  state.floor.look = Math.PI;
  computeVisibility();
  tickGaze(GAZE_MS * 2);
  assert.equal(m.gaze, GAZE_MS / 2, 'out of the light it holds, not runs down');
  state.floor.facing = 'N';
  state.floor.look = 0;
  computeVisibility();
  const events = tickGaze(GAZE_MS / 2);
  assert.deepEqual(events.map(e => e.type), ['gazeStep']);
  assert.deepEqual(at(m), { row: pr - 2, col: pc });
  assert.deepEqual(events[0].from, { row: pr - 3, col: pc });
  assert.equal(m.gaze, 0, 'the eye shuts again');
  assert.equal(m.track, MINION_TRACK_TURNS);
  assert.equal(state.run.turnCount, turns, 'not a turn');
  assert.equal(state.floor.light.charge, charge, 'no battery spent');
});

test('only the cone counts, not the small circle; the light off counts nothing', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const behind = spawnMinion({ row: pr + 1, col: pc });
  const ahead = spawnMinion({ row: pr - 3, col: pc });
  tickGaze(1000);
  assert.equal(behind.gaze, 0);
  assert.equal(ahead.gaze, 1000);
  toggleLight();
  computeVisibility();
  tickGaze(1000);
  assert.equal(ahead.gaze, 1000);
});

test('a full eye beside the player only stares, and never steps onto them', () => {
  resetFloor();
  const { playerRow: pr, playerCol: pc } = state.floor;
  const m = spawnMinion({ row: pr - 1, col: pc });
  const events = tickGaze(GAZE_MS);
  assert.deepEqual(events.map(e => e.type), ['gazeStare']);
  assert.deepEqual(at(m), { row: pr - 1, col: pc });
  assert.equal(m.track, MINION_TRACK_TURNS);
});

test('firing at a stick man shuts its eye, in the light or the dark', () => {
  resetFloor();
  state.run.energy = 2;
  state.run.rounds = [null, null];
  state.run.weakTo = {};
  state.battle.aim = null;
  const { playerRow: pr, playerCol: pc } = state.floor;
  const m = spawnMinion({ row: pr - 2, col: pc });
  m.gaze = 2000;
  fire(m);
  assert.equal(m.gaze, 0);
  state.battle.aim = null;
  m.gaze = 2000;
  toggleLight();
  computeVisibility();
  fire(null);
  assert.equal(m.gaze, 0);
});

test('no eye in Comfort mode, with DEV -> Gaze off, or on the hunter', () => {
  for (const flip of [() => { state.settings.simpleEnemies = true; }, () => { state.settings.gaze = false; }]) {
    resetFloor();
    const m = spawnMinion({ row: state.floor.playerRow - 3, col: state.floor.playerCol });
    flip();
    assert.deepEqual(tickGaze(GAZE_MS * 2), []);
    assert.equal(m.gaze, 0);
    state.settings.gaze = true;
  }
  resetFloor();
  const hunter = spawnMinion({ row: state.floor.playerRow - 3, col: state.floor.playerCol }, null);
  hunter.kind = 'hunter';
  tickGaze(GAZE_MS * 2);
  assert.equal(hunter.gaze, 0);
});
