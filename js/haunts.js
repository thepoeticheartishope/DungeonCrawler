// Haunts: questions the player has missed this run. A miss doesn't go
// away — it waits, and comes back in a later fight (spaced retrieval,
// dressed as the doubt coming back). Answering it right silences it;
// missing it again keeps it waiting. No DOM access here — main.js logs
// the lines and sets the question.
//
// state.run.haunts maps each missed question object to the attempt number it
// was last missed on, so a haunt can't return until HAUNT_MIN_GAP more
// questions have been answered.

import { state } from './state.js';
import { HAUNT_CHANCE, HAUNT_MIN_GAP } from './config.js';

export function resetHaunts() {
  state.run.haunts = new Map();
  state.run.hauntsTotal = 0;
  state.run.hauntsSilenced = 0;
}

// Silences the oldest haunt without asking it (THE UNFOLDING sells this).
// Oldest is the first in the Map: missing a haunt again sets it again, but
// Map.set keeps its first place, so first means "first missed". It counts
// as silenced on the end screen, like an answered one. Returns the
// question, or null with no haunts.
export function silenceOldestHaunt() {
  const oldest = state.run.haunts.keys().next();
  if (oldest.done) return null;
  state.run.haunts.delete(oldest.value);
  state.run.hauntsSilenced++;
  return oldest.value;
}

// A haunt from `pool` to ask instead of a random question, or null. Only
// haunts missed long enough ago are eligible, never the question just
// asked, and only HAUNT_CHANCE of the time.
export function pickHaunt(pool, exclude) {
  const ready = pool.filter(q =>
    q !== exclude && state.run.haunts.has(q) && state.run.attempts - state.run.haunts.get(q) >= HAUNT_MIN_GAP);
  if (!ready.length || Math.random() >= HAUNT_CHANCE) return null;
  return ready[Math.floor(Math.random() * ready.length)];
}

// Records an answer to `q`. Returns 'silenced' when a haunt was answered
// right, 'lingers' when a haunt was missed again, 'new' for a first miss,
// or null when nothing changed (a right answer that wasn't a haunt).
export function recordHauntAnswer(q, isCorrect) {
  const wasHaunt = state.run.haunts.has(q);
  if (isCorrect) {
    if (!wasHaunt) return null;
    state.run.haunts.delete(q);
    state.run.hauntsSilenced++;
    return 'silenced';
  }
  state.run.haunts.set(q, state.run.attempts);
  if (wasHaunt) return 'lingers';
  state.run.hauntsTotal++;
  return 'new';
}
