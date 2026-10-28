// Question modifiers: which one (if any) a fight's query category carries.
// No DOM access here — main.js shows the tag and applies the effect.
//
//   blind    the question vanishes after a few seconds
//   gambler  a wager of gold must be placed before answering
//   flip     some answers are upside down or mirrored
//   timer    a few seconds to answer, or it counts as a miss

import { state } from './state.js';
import { MODIFIER_CHANCE, MODIFIER_DARK_BONUS, FLIP_MAX_ANSWERS, HUNTER_MODIFIER_PAIRS, BLIND_BASE_MS, BLIND_MS_PER_WORD, BLIND_MAX_MS } from './config.js';
import { shuffle } from './random.js';
import { gateModifierCount } from './gate.js';

export const MODIFIERS = ['blind', 'gambler', 'flip', 'timer'];

// The chance a single category offered against `target` carries a
// modifier. Bosses always do.
export function modifierChance(target) {
  if (target && target.kind === 'boss') return 1;
  let chance = MODIFIER_CHANCE[Math.min(state.run.roomIndex, MODIFIER_CHANCE.length - 1)];
  if (state.floor.darkness) chance += MODIFIER_DARK_BONUS;
  return Math.min(1, chance);
}

function eligibleModifiers() {
  return MODIFIERS.filter(m => m !== 'gambler' || maxWager() >= 1);
}

// The most gold a Gambler wager can be right now: the floor number, but
// never more than the player holds. 0 means Gambler can't be offered.
export function maxWager() {
  return Math.min(state.run.roomIndex + 1, state.run.coinsTotal);
}

// Rolls one category's modifier: null (none) or one of MODIFIERS.
export function rollModifier(target) {
  if (Math.random() >= modifierChance(target)) return null;
  const eligible = eligibleModifiers();
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// Modifiers for a fight's `count` categories. Against the boss (the gate)
// each carries as many as the keys held say (gate.js gateModifierCount):
// two is one of HUNTER_MODIFIER_PAIRS per category, one is spread so the
// categories differ where possible (three categories get three different
// ones; Gambler only with gold for a wager), so which category to pick is
// still a real choice; none is none.
// Anything else rolls each category on its own. Each entry is one
// modifier, null, or a pair.
export function rollCategoryModifiers(target, count) {
  if (!target || target.kind !== 'boss') return Array.from({ length: count }, () => rollModifier(target));
  const perQuestion = gateModifierCount();
  if (perQuestion === 0) return Array.from({ length: count }, () => null);
  if (perQuestion >= 2) {
    const pairs = shuffle(HUNTER_MODIFIER_PAIRS);
    return Array.from({ length: count }, (_, i) => pairs[i % pairs.length]);
  }
  const eligible = shuffle(eligibleModifiers());
  return Array.from({ length: count }, (_, i) => eligible[i % eligible.length]);
}

// Blind: how long a question worded `text` shows before it goes blank,
// longer for more words (capped). The question panel and minigames that
// ask their own questions (Verdict) share it.
export function blindReadMs(text) {
  const words = String(text || '').trim().split(/\s+/).length;
  return Math.min(BLIND_MAX_MS, BLIND_BASE_MS + BLIND_MS_PER_WORD * words);
}

// For Flip: which answer slots to flip (1..FLIP_MAX_ANSWERS of them, never
// every answer) and whether they're turned upside down or mirrored.
export function rollFlip(answerCount) {
  const most = Math.max(1, Math.min(FLIP_MAX_ANSWERS, answerCount - 1));
  const count = 1 + Math.floor(Math.random() * most);
  const slots = shuffle([...Array(answerCount).keys()]).slice(0, count);
  return { slots: new Set(slots), mode: Math.random() < 0.5 ? 'upside' : 'mirror' };
}
