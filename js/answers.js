// Settling an answer on the battle screen: hearts, haunts, the Gambler
// wager, then what the answer does to the target (boss HP, a cleared
// minion, a repelled hunter, a spent chest / rune / encounter / box).
// Changes state and returns an events list in the order things happened
// (one per encounter log line); main.js drawEvents() draws it and picks
// the wording. No DOM access here.

import { state } from './state.js';
import { BOSS_HP, DARK_MISS_COST, DIFFICULTY_COIN_REWARD, BATTLE_CHOICE_COUNT } from './config.js';
import { recordHauntAnswer } from './haunts.js';
import { extinguishLight } from './light.js';
import { computeVisibility } from './sight.js';
import { repelHunter } from './combat.js';
import { goldReward, openBox } from './moves.js';
import { pickQuestion, fightChoosable } from './quiz.js';

// One answer to the current question against state.battle.selectedTarget. The
// caller has already checked adjacency and counted the attempt; `given`
// is the player's answer, echoed back as answerGiven.
//
// One answer settles a minion, chest, rune, category challenge or box,
// right or wrong: it's cleared or spent. Only a boss fight goes on past an
// answer, until its HP runs out. A miss costs 1 heart (DARK_MISS_COST in
// the darkness); at 0 hearts the events end with signalLost.
export function settleAnswer(isCorrect, hadExtraSpace, given) {
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
    const cost = state.floor.darkness ? DARK_MISS_COST : 1;
    state.run.hearts -= cost;
    events.push({ type: 'rejected', cost, expected: q.meaning, source: q.source });
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
  events.push(...(target.kind === 'boss' ? resolveBossAnswer(isCorrect) : resolveOneShot(target, isCorrect, q)));
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

// Boss fights are the one encounter that outlasts an answer: a correct one
// takes 1 HP off the boss (bossHit), a miss doesn't (bossHeld), and either
// way the caller goes back to the category choice until the boss is
// cleared (bossDefeated, then darknessFell).
function resolveBossAnswer(isCorrect) {
  if (!isCorrect) return [{ type: 'bossHeld' }];
  state.floor.boss.hp--;
  if (state.floor.boss.hp > 0) return [{ type: 'bossHit', hp: state.floor.boss.hp, max: BOSS_HP }];
  const boss = state.floor.boss;
  state.floor.boss = null; // clears the doorway it was blocking
  // Its light dies with it, and the floor goes dark: explored tiles are
  // forgotten, the minions left start hunting, misses cost more and gold
  // pays more (DARK_* in config.js).
  extinguishLight();
  state.floor.darkness = true;
  state.floor.exploredSet = new Set();
  computeVisibility();
  return [{ type: 'bossDefeated', boss }, { type: 'darknessFell' }];
}

// Everything but the boss is settled by a single answer. Success pays out
// (gold for a chest, category challenge or trapped box, a hint for a
// rune); a miss has already cost its heart. Either way the target is
// cleared or spent.
function resolveOneShot(target, isCorrect, q) {
  // The hunter can't be cleared, only thrown off the trail for a while.
  if (target.kind === 'hunter') {
    repelHunter(target, isCorrect);
    return [{ type: 'hunterRepelled', hunter: target, right: isCorrect }];
  }
  if (target.kind === 'minion') {
    state.floor.minions = state.floor.minions.filter(m => m !== target);
    return [{ type: 'minionCleared', minion: target, right: isCorrect }];
  }

  const events = [{ type: 'targetSpent', target, right: isCorrect, category: target.category }];
  if (target.kind === 'box') {
    // A trapped box stays on the map (it's furniture), just spent.
    target.sprung = false;
    target.searched = true;
  } else if (target.kind === 'chest') state.floor.chest = null;
  else if (target.kind === 'rune') state.floor.rune = null;
  else if (target.kind === 'encounter') state.floor.encounters = state.floor.encounters.filter(e => e !== target);
  if (!isCorrect) return events;

  if (target.kind === 'box') {
    events.push({ type: 'goldGained', amount: openBox(target), from: 'box' });
  } else if (target.kind === 'chest') {
    const gold = goldReward(2);
    state.run.coinsTotal += gold;
    events.push({ type: 'goldGained', amount: gold, from: 'chest' });
  } else if (target.kind === 'encounter') {
    const gold = goldReward(DIFFICULTY_COIN_REWARD[q.difficulty] || DIFFICULTY_COIN_REWARD.medium);
    state.run.coinsTotal += gold;
    events.push({ type: 'goldGained', amount: gold, from: 'encounter', category: target.category });
  } else {
    // The hinted question stays in reserve until it's asked: the next
    // fight always offers its category (marked ◊), so the hint can't be
    // spent on a question the player never chooses.
    state.floor.runeHint = pickQuestion(q, fightChoosable(state.settings.activeData, BATTLE_CHOICE_COUNT));
    events.push({ type: 'runeDecoded', question: state.floor.runeHint });
  }
  return events;
}
