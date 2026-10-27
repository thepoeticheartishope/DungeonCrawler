// The locked core's gate (locked core plan, step B). The boss stands in
// the core's one doorway and is the gate: bumping it opens the fight, and
// the keys held set how hard it is (GATE_QUESTIONS right answers, each
// with GATE_MODIFIERS modifiers). With every key it falls with no
// questions at all. A wrong answer feeds the light GATE_WRONG_TURNS and
// seals the gate until another key is taken (moves.js takeKey).
// moves.js opens the fight (reachGate), answers.js settles its answers,
// modifiers.js asks gateModifierCount().
// No DOM access here.

import { state } from './state.js';
import { GATE_QUESTIONS, GATE_MODIFIERS, GATE_WRONG_TURNS } from './config.js';
import { extinguishLight, updateBossLit, lightTurnsFor } from './light.js';
import { computeVisibility } from './sight.js';

// Right answers the gate asks with the keys held now.
export function gateQuestions() {
  return GATE_QUESTIONS[Math.min(state.floor.keysHeld, GATE_QUESTIONS.length - 1)];
}

// Modifiers on each of the gate's questions with the keys held now.
export function gateModifierCount() {
  return GATE_MODIFIERS[Math.min(state.floor.keysHeld, GATE_MODIFIERS.length - 1)];
}

// The player bumped the boss. Sealed (a wrong answer since the last key):
// nothing happens but the bump. Otherwise the boss becomes the target and
// its hp is the questions the keys held ask for, so a fight always starts
// fresh at the current keys. Events: blocked { kind: 'gate' } or
// gateReached { questions }.
export function reachGate() {
  const boss = state.floor.boss;
  if (state.floor.gateSealed) return { type: 'blocked', kind: 'gate' };
  boss.hp = gateQuestions();
  boss.max = boss.hp;
  state.battle.selectedTarget = boss;
  return { type: 'gateReached', questions: boss.hp };
}

// Every key held: the gate gives with no questions. Events: gateOpened,
// then breakGate's.
export function openGateFree() {
  return [{ type: 'gateOpened' }, ...breakGate()];
}

// A wrong answer at the gate: the light gains GATE_WRONG_TURNS and the gate
// seals until the next key. Event: gateSealed { turns }.
export function sealGate() {
  state.floor.gateSealed = true;
  state.floor.lightTurns += lightTurnsFor(GATE_WRONG_TURNS);
  updateBossLit();
  return { type: 'gateSealed', turns: GATE_WRONG_TURNS };
}

// The boss falls: it leaves the doorway, so the stairs behind it can be
// reached. Its light dies with it, and the floor goes dark: explored
// tiles are forgotten, the minions left start hunting, misses cost more
// and gold pays more (DARK_* in config.js). Events: bossDefeated { boss },
// darknessFell.
export function breakGate() {
  const boss = state.floor.boss;
  state.floor.boss = null;
  state.floor.gateSealed = false;
  extinguishLight();
  state.floor.darkness = true;
  state.floor.exploredSet = new Set();
  computeVisibility();
  return [{ type: 'bossDefeated', boss }, { type: 'darknessFell' }];
}
