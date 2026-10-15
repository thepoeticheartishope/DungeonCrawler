// The answer ring (answer swirl plan step B, ideas/answer-swirl-plan.md
// outside the repo): after a wrong answer, with Reveal on, a short right
// answer circles slowly over the thing that asked it, in the enemies' cold
// blue, until the player's next move. A long one shows as the line across
// the top of the map instead (render.js showAnswerLine), and so does every
// answer under reduced motion or with Simple enemies on (Timothy: the
// comfort version is the still line).
//
// main.js asks mapview.js answerRingOnMap() first and falls back to the
// line when it says no; a move ends it (endAnswerRingOnMap). isoview.js
// draws it with answerRingNow() and ringLetters(). The ring's moments are
// view-only and kept here, not in state. Reads state and never changes it.

import { state } from './state.js';
import { ANSWER_RING_MAX_LETTERS, ANSWER_RING_MIN_CHARS, ANSWER_RING_OUT_MS } from './config.js';

// The ring up now: { text, row, col, boss, floor, at, endAt }, or null.
let ring = null;

// How many letters and digits `text` has: spaces, colons and dots are free,
// so "GEN 6:14" counts 6.
export function letterCount(text) {
  return String(text).replace(/[^\p{L}\p{N}]/gu, '').length;
}

// Whether `text` is short enough to read going round a ring.
export function ringFits(text) {
  const n = letterCount(text);
  return n > 0 && n <= ANSWER_RING_MAX_LETTERS;
}

// The characters going round the ring: the answer repeated with " · "
// between until there are at least ANSWER_RING_MIN_CHARS, so one copy is
// always passing along the front.
export function ringLetters(text) {
  const one = String(text).trim() + ' · ';
  let out = one;
  while (out.length < ANSWER_RING_MIN_CHARS) out += one;
  return [...out];
}

// Puts `text` up as the ring over tile `at` ({ row, col }), round the boss
// itself when `boss`. Returns false when it should be the line instead:
// too long, no tile, reduced motion (`still`) or Simple enemies. A new
// miss replaces the ring that is up.
export function startAnswerRing(text, at, boss, still, now) {
  if (still || state.settings.simpleEnemies || !at || !ringFits(text)) return false;
  ring = { text, row: at.row, col: at.col, boss: !!boss, floor: state.run.floorsEntered, at: now, endAt: null };
  return true;
}

// The player moved: the ring starts fading (over ANSWER_RING_OUT_MS).
export function endAnswerRing(now) {
  if (ring && ring.endAt === null) ring.endAt = now;
}

// The ring to draw at `now`, or null once it has faded or the floor has
// changed: { text, row, col, boss, since, fading } (ms since it came up,
// and since the move that ends it, or null).
export function answerRingNow(now) {
  if (!ring) return null;
  if (ring.floor !== state.run.floorsEntered || (ring.endAt !== null && now - ring.endAt >= ANSWER_RING_OUT_MS)) {
    ring = null;
    return null;
  }
  return { text: ring.text, row: ring.row, col: ring.col, boss: ring.boss, since: now - ring.at, fading: ring.endAt === null ? null : now - ring.endAt };
}
