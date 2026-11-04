// Question modifiers: the Gambler's most, Blind's reading time and Flip's
// roll. Which modifiers a question carries is minigames.js modifiersFor.
// No DOM access here.
//
//   blind    the question vanishes after a few seconds
//   gambler  a wager of gold must be placed before answering
//   flip     some answers are upside down or mirrored
//   timer    a few seconds to answer, or it counts as a miss

import { state } from './state.js';
import { FLIP_MAX_ANSWERS, BLIND_BASE_MS, BLIND_MS_PER_WORD, BLIND_MAX_MS } from './config.js';
import { shuffle } from './random.js';

// The most gold a Gambler wager can be right now: the floor number, but
// never more than the player holds. 0 means Gambler can't be offered.
export function maxWager() {
  return Math.min(state.run.roomIndex + 1, state.run.coinsTotal);
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
