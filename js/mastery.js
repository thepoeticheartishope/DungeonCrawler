// Mastery rules (mastery plan step A, ideas/mastery-plan.md outside the
// repo; Timothy 2026-11-12). Practice only, never in a run. Each question
// of the set is a fact that climbs tiers: 1 Practicing (pick it from the
// options), 2 Nearly mastered (tap the phrases of the question's
// `evidence` scenario that prove the answer; plan step B, and a fact with
// no scenario skips it), 3 Mastered check (type it), 4
// Mastered. A right answer earns the player's optional bet in credits (no
// bet counts as MASTERY.bets[0]); MASTERY.bar credits on a tier move the
// fact up, and then it rests: MASTERY.rests questions AND days must pass
// before it comes back. A miss drops it one tier. Every answer is logged
// with its bet, so later the game can tell the player where their
// learning stands. masteryview.js draws it and saves the record.
// No DOM access here.
import { MASTERY } from './config.js';
import { shuffle } from './random.js';

// An empty record: a set's facts, the running score (it may go below 0)
// and the answer log.
export function newMasteryRecord() {
  return { score: 0, last: null, facts: {}, log: [] };
}

// A question's key in the record: its wording and answer, case and extra
// spaces ignored. The answer is in it because picture questions share
// one wording ("Which tool is shown?").
export function masteryKey(q) {
  const plain = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return plain(q.question) + '|' + plain(q.answer);
}

// The day number of `date` in the player's own time, so a rest's days
// turn over at their midnight.
export function masteryDay(date) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

// The tier fact `q` is at: 1 until it has been asked.
export function masteryTier(record, q) {
  const entry = record.facts[masteryKey(q)];
  return entry ? entry.tier : 1;
}

// The task fact `q` is asked as: its tier, except a Mastered fact comes
// back as a typed check (tier 3).
export function masteryTask(record, q) {
  const tier = masteryTier(record, q);
  return tier === 4 ? 3 : tier;
}

// The credits fact `q` has on its tier.
export function masteryCredits(record, q) {
  const entry = record.facts[masteryKey(q)];
  return entry ? entry.credits : 0;
}

function isReady(entry, today) {
  return entry.restQuestions <= 0 && today >= entry.restDay;
}

// The question to ask next from `questions`, or null when every fact the
// player has met is resting and none is new. A new fact joins only while
// fewer than MASTERY.activeFacts unmastered facts are ready, so the player
// works a small group at a time; otherwise the weakest ready fact comes
// up (lowest tier, then fewest credits), never the one just asked when
// another is ready. When every fact rests only on its question count
// (the set is small), the one closest to back is asked rather than none.
export function masteryNext(record, questions, today) {
  const entryOf = q => record.facts[masteryKey(q)];
  const unseen = questions.filter(q => !entryOf(q));
  const ready = questions.filter(q => entryOf(q) && isReady(entryOf(q), today));
  const learning = ready.filter(q => entryOf(q).tier < 4);
  if (learning.length < MASTERY.activeFacts && unseen.length) return shuffle(unseen)[0];
  let pool = ready.length > 1 ? ready.filter(q => masteryKey(q) !== record.last) : ready;
  if (!pool.length) {
    const dayDone = questions.filter(q => entryOf(q) && today >= entryOf(q).restDay);
    if (!dayDone.length) return null;
    const least = Math.min(...dayDone.map(q => entryOf(q).restQuestions));
    pool = dayDone.filter(q => entryOf(q).restQuestions === least);
  }
  const tier = Math.min(...pool.map(q => entryOf(q).tier));
  const atTier = pool.filter(q => entryOf(q).tier === tier);
  const credits = Math.min(...atTier.map(q => entryOf(q).credits));
  return shuffle(atTier.filter(q => entryOf(q).credits === credits))[0];
}

// How many of `questions` are new, learning (ready, not mastered),
// resting and mastered, for the status line.
export function masteryCounts(record, questions, today) {
  const counts = { fresh: 0, learning: 0, resting: 0, mastered: 0 };
  questions.forEach(q => {
    const entry = record.facts[masteryKey(q)];
    if (!entry) counts.fresh++;
    else if (entry.tier === 4) counts.mastered++;
    else if (isReady(entry, today)) counts.learning++;
    else counts.resting++;
  });
  return counts;
}

// DEV only (Timothy 2026-11-12): moves fact `q` one tier up (`step` 1) or
// down (-1), to see a question at every tier without earning it. Skips
// tier 2 when the fact has no evidence task; stays within 1–4. Clears its
// credits and rest so it can show at once. Returns the new tier.
export function shiftMasteryTier(record, q, step, today, hasEvidence = false) {
  const key = masteryKey(q);
  if (!record.facts[key]) record.facts[key] = { tier: 1, credits: 0, restQuestions: 0, restDay: today, kept: 0 };
  const entry = record.facts[key];
  let tier = Math.min(4, Math.max(1, entry.tier + step));
  if (tier === 2 && !hasEvidence) tier = step > 0 ? 3 : 1;
  Object.assign(entry, { tier, credits: 0, restQuestions: 0, restDay: today });
  return tier;
}

// Checks the phrases picked in a fact's evidence scenario: `parts` is the
// question's `evidence` and `picked` the indexes of the parts tapped.
// Returns how many clues there are, the indexes found, missed and wrongly
// marked, and whether it was perfect (every clue, no false mark), which is
// what counts as right on tier 2.
export function evidenceCheck(parts, picked) {
  const clues = parts.map((p, i) => (p && p.clue ? i : -1)).filter(i => i >= 0);
  const found = clues.filter(i => picked.has(i));
  const missed = clues.filter(i => !picked.has(i));
  const falseMarks = [...picked].filter(i => parts[i] && parts[i].tap).sort((a, b) => a - b);
  return { clues: clues.length, found, missed, falseMarks, perfect: !missed.length && !falseMarks.length };
}

// Sets `entry` resting for `rest` (MASTERY.rests row) times `times`, from
// `today`, and returns the questions and days it waits.
function startRest(entry, rest, times, today) {
  const questions = rest.questions * times;
  const days = rest.days * times;
  entry.restQuestions = questions;
  entry.restDay = today + days;
  return { questions, days };
}

// Settles an answer to `q`: `bet` (1–3, or 0 for none) and whether it was
// `right`, on day `today`. `hasEvidence` says whether the fact has an
// evidence task (tier 2); without one it moves from 1 straight to 3 and
// drops from 3 straight to 1. Other facts' question rests count down by
// one. Events, in order:
//   masteryAnswered { right, credits (+ or -), score, factCredits }
//   masteryMovedUp { tier, questions, days }  (reached MASTERY.bar)
//   masteryKept { questions, days }           (a Mastered fact passed its check; rests longer each time)
//   masteryDropped { tier }                   (a miss above tier 1)
export function settleMastery(record, q, { bet, right }, today, hasEvidence = false) {
  const key = masteryKey(q);
  if (!record.facts[key]) record.facts[key] = { tier: 1, credits: 0, restQuestions: 0, restDay: today, kept: 0 };
  const entry = record.facts[key];
  const task = entry.tier === 4 ? 3 : entry.tier;
  const worth = bet || MASTERY.bets[0];
  Object.keys(record.facts).forEach(k => {
    if (k !== key && record.facts[k].restQuestions > 0) record.facts[k].restQuestions--;
  });
  record.last = key;
  record.score += right ? worth : -worth;
  record.log.push({ key, tier: task, bet: bet || null, right, day: today });
  if (record.log.length > MASTERY.logMax) record.log.splice(0, record.log.length - MASTERY.logMax);
  const events = [];
  if (!right) {
    entry.credits = 0;
    if (entry.tier > 1) {
      entry.tier = entry.tier === 3 && !hasEvidence ? 1 : entry.tier - 1;
      events.push({ type: 'masteryDropped', tier: entry.tier });
    }
  } else if (entry.tier === 4) {
    entry.kept++;
    events.push({ type: 'masteryKept', ...startRest(entry, MASTERY.rests[4], entry.kept + 1, today) });
  } else {
    entry.credits += worth;
    if (entry.credits >= MASTERY.bar) {
      entry.credits = 0;
      entry.tier = entry.tier === 1 && !hasEvidence ? 3 : entry.tier + 1;
      if (entry.tier === 4) entry.kept = 0;
      events.push({ type: 'masteryMovedUp', tier: entry.tier, ...startRest(entry, MASTERY.rests[entry.tier], 1, today) });
    }
  }
  events.unshift({ type: 'masteryAnswered', right, credits: right ? worth : -worth, score: record.score, factCredits: entry.credits });
  return events;
}
