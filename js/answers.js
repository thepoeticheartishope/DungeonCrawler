// Settling an answer on the battle screen: hearts, haunts, the Gambler
// wager, then what the answer does to the target (boss HP, a spent chest
// or box).
// Changes state and returns an events list in the order things happened
// (one per encounter log line); main.js drawEvents() draws it and picks
// the wording. No DOM access here.

import { state } from './state.js';
import { DARK_MISS_COST, MINIGAME_TIER_PAY } from './config.js';
import { recordHauntAnswer } from './haunts.js';
import { sealGate, breakGate } from './gate.js';
import { makeNoise } from './noise.js';
import { goldReward, openBox } from './moves.js';

// One answer to the current question against state.battle.selectedTarget. The
// caller has already checked adjacency and counted the attempt; `given`
// is the player's answer, echoed back as answerGiven.
//
// One answer settles the chest or a box, right or wrong: it's spent. Only the boss (the gate) goes on
// past a right answer, until its HP runs out; a wrong one seals it. A
// miss costs 1 heart (DARK_MISS_COST in the darkness), except at the gate,
// where the seal and the light's turns are the cost (Timothy); at 0
// hearts the events end with signalLost.
// `tier` is a minigame's tier for a right answer ('1', '2' or 'X',
// MINIGAME_TIER_PAY); a plain question is '2'. X takes more off a boss
// and pays more gold.
export function settleAnswer(isCorrect, hadExtraSpace, given, tier = '2') {
  const target = state.battle.selectedTarget;
  const q = state.battle.currentQuestion;
  const events = [{ type: 'answerGiven', given }];

  if (isCorrect) {
    state.run.correctTotal++;
    events.push({ type: 'accepted' });
    if (hadExtraSpace) {
      state.run.extraSpaceCount++;
      events.push({ type: 'extraSpaces' });
    }
  } else {
    const cost = target.kind === 'boss' ? 0 : state.floor.darkness ? DARK_MISS_COST : 1;
    state.run.hearts -= cost;
    state.floor.misses++;
    events.push({ type: 'rejected', cost, expected: q.meaning, source: q.source, at: { row: target.row, col: target.col }, boss: target.kind === 'boss' });
  }
  const haunt = recordHauntAnswer(q, isCorrect);
  if (haunt === 'silenced') events.push({ type: 'hauntSilenced' });
  else if (haunt === 'lingers') events.push({ type: 'hauntLingers' });
  const wager = settleWager(isCorrect);
  if (wager) events.push(wager);

  if (state.run.hearts <= 0) {
    events.push({ type: 'signalLost' });
    return events;
  }
  const pay = MINIGAME_TIER_PAY[tier];
  events.push(...(target.kind === 'boss' ? resolveBossAnswer(isCorrect, pay) : resolveOneShot(target, isCorrect, q, pay)));
  return events;
}

// Settles a Gambler wager once the answer is in: right wins it, wrong
// loses it (gold never goes below 0). The fourth place gold changes.
function settleWager(isCorrect) {
  const n = state.battle.wager;
  if (!n) return null;
  state.run.coinsTotal = Math.max(0, state.run.coinsTotal + (isCorrect ? n : -n));
  state.battle.wager = 0;
  return { type: 'wagerSettled', won: isCorrect, n };
}

// The boss is the gate (gate.js), the one encounter that outlasts an
// answer: a correct one takes the tier's `bossDamage` HP off it (1 for a
// plain answer; bossHit) and the caller asks the next, until it falls
// (gate.js breakGate: bossDefeated, then darknessFell). A miss ends the
// fight: the gate seals until the next key and the light gains turns
// (bossHeld, then gate.js sealGate's gateSealed), and the gate booms
// (noise.js makeNoise).
function resolveBossAnswer(isCorrect, pay) {
  const boss = state.floor.boss;
  if (!isCorrect) return [{ type: 'bossHeld' }, sealGate(), ...makeNoise('gate')];
  boss.hp = Math.max(0, boss.hp - pay.bossDamage);
  if (boss.hp > 0) return [{ type: 'bossHit', hp: boss.hp, max: boss.max }];
  return breakGate();
}

// The chest and a trapped box are settled by a single answer. Success pays
// out gold; a miss has already cost its heart. Either way the target is
// spent. Gold is scaled by the tier's `goldScale`.
function resolveOneShot(target, isCorrect, q, pay) {
  const events = [{ type: 'targetSpent', target, right: isCorrect }];
  if (target.kind === 'box') {
    // A trapped box stays on the map (it's furniture), just spent.
    target.sprung = false;
    target.searched = true;
  } else if (target.kind === 'chest') state.floor.chest = null;
  if (!isCorrect) return events;

  if (target.kind === 'box') {
    const gold = openBox(target);
    const bonus = gold * (pay.goldScale - 1);
    state.run.coinsTotal += bonus;
    events.push({ type: 'goldGained', amount: gold + bonus, from: 'box' });
  } else if (target.kind === 'chest') {
    const gold = goldReward(2) * pay.goldScale;
    state.run.coinsTotal += gold;
    events.push({ type: 'goldGained', amount: gold, from: 'chest' });
  }
  return events;
}
