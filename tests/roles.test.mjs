// Unit tests for the ship's crew roles (crew roles plan step A; roles.js,
// minigames.js roleCanRun, ship.js's boosts): every role has a crew member
// on the ship and wording; a role whose minigame can't run on the set sits
// out; a crew member not learned yet only speaks; a learned one starts a
// job of SHIP_JOB.rounds rounds; a miss is a crew failure; enough right
// gives the benefit, too few goes badly; a taught role isn't taught again;
// each benefit changes the run as it says.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { SHIP_ROLES, SHIP_JOB, SHIP_RUN } from '../js/config.js';
import { TEXT } from '../js/text.js';
import {
  roleOf, onDuty, rolesOnDuty, useCrew, settleRound, applyBenefit, consoleRoles, startLearning, settleLearning, learningOn,
  noteOnDuty, crewLook, taughtCount, teachTargets, stopLearning, crewFull,
} from '../js/roles.js';
import { roleCanRun } from '../js/minigames.js';
import { freshShipRun, crewMissed, crewRight, slipEveryMs } from '../js/ship.js';
import { useStation, trainWires } from '../js/stations.js';
import { buildShipFloor } from '../js/floor.js';
import { emptyFloor } from './helpers.mjs';

// Five number questions (Close Enough, Higher/Lower, Sum Lock) and five
// one-word names, enough for some roles and not others.
const SET = [
  ...[12, 40, 7, 99, 365].map((n, i) => ({ term: 'How many ' + i + '?', meaning: String(n), answerType: 'number', category: 'Numbers' })),
  ...['Moses', 'Aaron', 'Miriam', 'Joshua', 'Caleb'].map((name, i) => ({ term: 'Who was ' + i + '?', meaning: name, answerType: 'name', category: 'Names' })),
];

// A fresh ship run on SET, every role learned.
function crewRun(learned = true) {
  emptyFloor(10);
  state.settings.activeData = SET;
  freshShipRun();
  buildShipFloor();
  if (learned) state.run.trained = ['engineer', ...SHIP_ROLES.map(r => r.id)];
  return state.run.ship;
}

// A role on duty on SET (its minigame runs there).
const dutyRole = () => rolesOnDuty()[0];

test('every role has a crew member on the ship, a name and a benefit line', () => {
  crewRun();
  for (const role of SHIP_ROLES) {
    assert.ok(state.floor.props.some(p => p.kind === 'crew' && p.role === role.id), role.id + ' placed');
    assert.ok('role.' + role.id in TEXT, role.id + ' name');
    assert.ok('job.helped.' + role.benefit.kind in TEXT, role.benefit.kind + ' line');
  }
});

test('a role whose minigame can\'t run on the set sits out and says so', () => {
  crewRun();
  const out = SHIP_ROLES.find(r => !roleCanRun(r.minigame));
  assert.ok(out, 'some role sits out on this small set (Fog Reveal has no pictures)');
  assert.equal(onDuty(out.id), false);
  assert.deepEqual(useCrew(out.id), [{ type: 'crewSpoke', role: out.id, sitsOut: true }]);
  assert.ok(rolesOnDuty().length > 0, 'some roles are on duty');
  assert.ok(rolesOnDuty().every(id => roleCanRun(roleOf(id).minigame)));
});

test('a crew member not learned yet only speaks; a learned one starts a job', () => {
  crewRun(false);
  const role = dutyRole();
  assert.deepEqual(useCrew(role), [{ type: 'crewSpoke', role, trained: false }]);
  state.run.trained.push(role);
  const crew = state.floor.props.find(p => p.kind === 'crew' && p.role === role);
  assert.deepEqual(useStation(crew), [{ type: 'jobStarted', role, minigame: roleOf(role).minigame }]);
  assert.deepEqual(state.run.ship.job, { role, round: 0, right: 0 });
});

test('a miss in a job is a crew failure; the job ends after its rounds with the benefit', () => {
  const ship = crewRun();
  const role = 'navigator';
  assert.ok(onDuty(role), 'Close Enough runs on number answers');
  useCrew(role);
  const first = settleRound(false);
  assert.deepEqual(first.map(e => e.type), ['roundMissed', 'panicRose']);
  assert.equal(state.run.crewFailures, 1);
  settleRound(true);
  const last = settleRound(true);
  assert.equal(SHIP_JOB.rounds, 3);
  assert.deepEqual(last.map(e => e.type).slice(0, 2), ['roundRight', 'roleHelped']);
  assert.equal(roleOf(role).benefit.kind, 'panicDown', 'the Navigator calms the crew (no burns: step G1)');
  assert.equal(ship.panic, 0, 'the panic from the miss is eased');
  assert.deepEqual(ship.taught, [role]);
  assert.equal(ship.job, null);
  assert.deepEqual(useCrew(role), [{ type: 'crewSpoke', role, taught: true }]);
});

test('too few right and the job goes badly: taught, but no benefit', () => {
  const ship = crewRun();
  useCrew('navigator');
  settleRound(true);
  settleRound(false);
  const last = settleRound(false);
  assert.ok(last.some(e => e.type === 'jobWentBadly'));
  assert.ok(!last.some(e => e.type === 'roleHelped'));
  assert.equal(ship.panic, 2, 'two misses, and no calming from a job gone badly');
  assert.deepEqual(ship.taught, ['navigator']);
});

test('each benefit changes the run as it says', () => {
  const ship = crewRun();
  applyBenefit({ kind: 'shield' });
  assert.deepEqual(crewMissed(), [{ type: 'panicShielded' }]);
  assert.equal(ship.panic, 0);
  assert.deepEqual(crewMissed(), [{ type: 'panicRose', level: 1 }]);

  assert.deepEqual(applyBenefit({ kind: 'panicDown' }), [{ type: 'panicEased', level: 0 }]);
  assert.deepEqual(applyBenefit({ kind: 'panicDown' }), [], 'nothing to calm at 0');

  applyBenefit({ kind: 'calm', streak: 2 });
  crewMissed();
  crewRight();
  assert.deepEqual(crewRight(), [{ type: 'panicEased', level: 0 }]);

  ship.panic = 2;
  const every = slipEveryMs();
  applyBenefit({ kind: 'slips', factor: 2 });
  assert.equal(slipEveryMs(), every * 2);
  ship.panic = 0;
});

test('no benefit is about time or burns any more (timers gone 2026-10-31, burns 2026-11-01)', () => {
  const kinds = ['shield', 'panicDown', 'calm', 'slips'];
  SHIP_ROLES.forEach(r => assert.ok(kinds.includes(r.benefit.kind), r.id + ' ' + r.benefit.kind));
  SHIP_ROLES.forEach(r => assert.ok('job.helped.' + r.benefit.kind in TEXT, r.id));
});

test('the last crew member taught brings the ship in (until the final boss, step G3)', () => {
  const ship = crewRun();
  const others = rolesOnDuty();
  ship.taught = ['engineer', ...others.slice(1)];
  useCrew(others[0]);
  settleRound(true);
  settleRound(true);
  const last = settleRound(true);
  assert.deepEqual(last[last.length - 1], { type: 'shipEnded', how: 'arrived' });
});

// ---- learning at the console (crew roles plan step B) ----

test('the console opens its list of roles; the list says where each stands', () => {
  crewRun(false);
  const console = state.floor.props.find(p => p.kind === 'console');
  assert.deepEqual(useStation(console), [{ type: 'consoleOpened', station: console }]);
  const list = consoleRoles();
  assert.equal(list[0].role, 'engineer');
  assert.equal(list.length, SHIP_ROLES.length + 1);
  const out = list.find(r => r.status === 'sitsOut');
  assert.ok(out && !roleCanRun(out.minigame), 'a role sitting out on this set');
  assert.ok(list.filter(r => r.role !== 'engineer' && r.status !== 'sitsOut').every(r => r.status === 'new'));
  state.run.trained.push('navigator');
  state.run.ship.taught.push('pilot');
  const after = consoleRoles();
  assert.equal(after.find(r => r.role === 'navigator').status, 'learned');
  assert.equal(after.find(r => r.role === 'pilot').status, 'taught');
});

test('learning a role: misses are free, a right round learns it', () => {
  const ship = crewRun(false);
  assert.deepEqual(startLearning('navigator'), [{ type: 'learningStarted', role: 'navigator', minigame: 'starChart' }]);
  assert.deepEqual(settleLearning(false), [{ type: 'learnMissed', round: 1, of: SHIP_JOB.learnRounds }]);
  assert.equal(ship.panic, 0);
  assert.equal(state.run.crewFailures, 0);
  assert.ok(learningOn());
  assert.deepEqual(settleLearning(true), [{ type: 'roleLearned', role: 'navigator', shaky: false }]);
  assert.ok(!learningOn());
  assert.ok(state.run.trained.includes('navigator'));
  assert.deepEqual(startLearning('navigator'), [], 'already learned');
});

test('after the last learning round the role is learned anyway, shakily', () => {
  crewRun(false);
  startLearning('navigator');
  for (let i = 1; i < SHIP_JOB.learnRounds; i++) settleLearning(false);
  assert.deepEqual(settleLearning(false), [{ type: 'roleLearned', role: 'navigator', shaky: true }]);
  assert.ok(state.run.trained.includes('navigator'));
});

test('a role sitting out can\'t be learned', () => {
  crewRun(false);
  const out = SHIP_ROLES.find(r => !roleCanRun(r.minigame));
  assert.deepEqual(startLearning(out.id), []);
});

// ---- showing it (crew roles plan step C) ----

test('the roles on duty are noted once a run and read from there', () => {
  const ship = crewRun(false);
  const live = rolesOnDuty();
  noteOnDuty();
  assert.deepEqual(ship.onDuty, live);
  // The set changing under a run doesn't change who is on duty.
  state.settings.activeData = [];
  assert.deepEqual(rolesOnDuty(), live);
  assert.equal(onDuty(live[0]), true);
});

test('each crew member looks as they stand: sitting out, new, ready, taught', () => {
  crewRun(false);
  noteOnDuty();
  const out = SHIP_ROLES.find(r => !roleCanRun(r.minigame)).id;
  assert.equal(crewLook(out), 'sitsOut');
  assert.equal(crewLook('navigator'), 'new');
  state.run.trained.push('navigator');
  assert.equal(crewLook('navigator'), 'ready');
  state.run.ship.taught.push('navigator');
  assert.equal(crewLook('navigator'), 'taught');
  assert.equal(crewLook('engineer'), 'new');
  state.run.trained.push('engineer');
  assert.equal(crewLook('engineer'), 'ready', 'the Engineer is never sitting out');
});

test('the count of crew taught is out of the player\'s crew of SHIP_JOB.crew', () => {
  const ship = crewRun();
  noteOnDuty();
  assert.deepEqual(taughtCount(), { taught: 0, of: Math.min(SHIP_JOB.crew, ship.onDuty.length + 1) });
  useCrew('navigator');
  settleRound(true);
  settleRound(true);
  settleRound(true);
  assert.deepEqual(taughtCount(), { taught: 1, of: Math.min(SHIP_JOB.crew, ship.onDuty.length + 1) });
});

test('teachTargets: a learned role not yet taught is marked on the map; taught or unlearned is not', () => {
  crewRun(false);
  assert.deepEqual(teachTargets(), []);
  state.run.trained = ['navigator', 'engineer'];
  const marks = teachTargets();
  const nav = state.floor.props.find(p => p.kind === 'crew' && p.role === 'navigator');
  const board = state.floor.props.find(p => p.kind === 'powerBoard');
  assert.deepEqual(marks.find(m => m.role === 'navigator'), { row: nav.row, col: nav.col, role: 'navigator' });
  // The Engineer is taught at the board, so the board is marked.
  assert.deepEqual(marks.find(m => m.role === 'engineer'), { row: board.row, col: board.col, role: 'engineer' });
  assert.equal(marks.length, 2);
  state.run.ship.taught.push('navigator');
  assert.deepEqual(teachTargets().map(m => m.role), ['engineer']);
});

test('stopLearning: BACK drops the lesson, nothing learned, and the role can be started again', () => {
  crewRun(false);
  startLearning('navigator');
  settleLearning(false);
  assert.deepEqual(stopLearning(), [{ type: 'learningStopped', role: 'navigator' }]);
  assert.equal(learningOn(), false);
  assert.ok(!state.run.trained.includes('navigator'));
  assert.deepEqual(stopLearning(), []);
  assert.equal(startLearning('pilot')[0].type, 'learningStarted');
  assert.equal(state.run.ship.learning.round, 0);
});

// ---- the player's crew of 3 (ship minigames plan step G2) ----

test('the player picks SHIP_JOB.crew crew: once that many are learned, the rest can\'t be', () => {
  crewRun(false);
  noteOnDuty();
  const duty = rolesOnDuty();
  assert.equal(SHIP_JOB.crew, 3);
  state.run.trained = ['engineer', duty[0]];
  assert.ok(!crewFull());
  assert.equal(consoleRoles().find(r => r.role === duty[1]).status, 'new', 'room for one more');
  state.run.trained.push(duty[1]);
  assert.ok(crewFull());
  const list = consoleRoles();
  assert.equal(list.find(r => r.role === duty[2]).status, 'full', 'not picked, and the crew is full');
  assert.equal(list.find(r => r.role === duty[0]).status, 'learned');
  assert.deepEqual(startLearning(duty[2]), [], 'no fourth lesson');
  assert.deepEqual(useCrew(duty[2]), [{ type: 'crewSpoke', role: duty[2], notCrew: true }]);
  assert.equal(crewLook(duty[2]), 'sitsOut', 'dim, like sitting out');
  assert.equal(crewLook(duty[0]), 'ready');
  assert.deepEqual(taughtCount(), { taught: 0, of: 3 });
});

test('the Engineer is one of the choices: picked, it counts; not picked once full, its wires stay shut', () => {
  crewRun(false);
  noteOnDuty();
  const duty = rolesOnDuty();
  state.run.trained = duty.slice(0, 3);
  const console = state.floor.props.find(p => p.kind === 'console');
  assert.deepEqual(trainWires(console), [], 'the crew is full without the Engineer');
  assert.equal(consoleRoles().find(r => r.role === 'engineer').status, 'full');
  const engineer = state.floor.props.find(p => p.kind === 'crew' && p.role === 'engineer');
  assert.deepEqual(useStation(engineer), [{ type: 'crewSpoke', role: 'engineer', notCrew: true }]);
});
