// The ship's questions on the ask screen (the record book), moved out of
// main.js (tech-debt item 4d): a breaker's question, a crew member's job
// and learning a role (rounds of their minigame), the final boss (Match),
// dressing a question with maybe a minigame (askQuestion, dressQuestion)
// and DEV -> Auto-win. The gun these once served went with combat
// (dungeon removal step C). Like devpanel.js it gets the main.js actions it
// calls passed in (initGunActions); main.js imports the rest from here.

import { state } from './state.js';
import { LETTER_POOL_FORM, SHIP_JOB } from './config.js';
import { pickQuestion } from './quiz.js';
import { settleBreaker } from './stations.js';
import { roleOf, settleRound, jobOn, settleLearning, learningOn, stopLearning, startBoss, settleBoss } from './roles.js';
import { showQuestionScreen, closeMapPanels, holdAskScreen, askHeld, closeHeldAsk, mapPanelShown } from './gunpanels.js';
import { t } from './text.js';
import { setQuestion, setMinigame, clearModifier, applyModifier, markAnswer, matchesAnswer, parkQuestionPanel } from './questionview.js';
import {
  rollMinigame, forcedQuestion, endMinigame, letterPoolSetup, sumLockSetup, modifiersFor, roleQuestions, roleGroups, matchGroups, matchSetup,
} from './minigames.js';
import { playMinigameOut } from './minigameview.js';

// The main.js actions these call, passed in by initGunActions.
let applyTurnOutcome, drawEvents, openCharger, showRoomNote;

// Hands over the main.js actions. main.js calls it once at load.
export function initGunActions(actions) {
  ({ applyTurnOutcome, drawEvents, openCharger, showRoomNote } = actions);
}

// What the question panel's input means on the ask screen, for the
// question that's open (DEV -> Auto-win answers through it).
let askAnswers = null;

// An option was picked (or the Timer ran out, `picked` null) on the ask
// screen: the book marks it (questionview.js markAnswer: struck, the right
// answer written beside it) and stays open until a tap or a key, then
// `settle` runs as before (record book plan step C). Nothing moves
// meanwhile: the clock is paused while the ask screen shows. A second
// answer while it waits does nothing. `reveal` writes the right answer
// beside a wrong one: the Reveal option, or always while learning a role.
function holdAnswer(picked, settle, reveal = state.settings.revealOnWrong) {
  if (askHeld()) return;
  clearModifier();
  markAnswer(picked, matchesAnswer, reveal);
  holdAskScreen(settle);
}

// A crew member's job started (roles.js jobStarted; crew roles plan):
// SHIP_JOB.rounds rounds of their minigame on the ask screen, one after
// another, each settled by roles.js settleRound (a miss is a crew failure).
// Between rounds the next is asked in place; after the last, or if the
// run ends, the ask screen closes and the turn's events play out. No Timer
// on a round (Timothy 2026-10-31: no timers on the ship).
export function openJob(role) {
  openRounds(role, {
    settle: settleRound, going: jobOn, title: 'ask.title.job', of: SHIP_JOB.rounds,
    round: () => state.run.ship.job.round + 1, modifiers: () => [], reveal: state.settings.revealOnWrong,
  });
}

// Learning a role at the console started (roles.js learningStarted; crew
// roles plan step B): rounds of its minigame, the same way as a job, but
// misses cost nothing and always show the right answer, and the first
// right one (or the last round) learns it (roles.js settleLearning). No
// Timer: learning is for learning. BACK (or Escape) before an answer is
// in drops the lesson (roles.js stopLearning) with no turn spent, and
// `onBack` (main.js: COMMAND.SYS again) lets the player pick another.
export function openLearning(role, onBack = () => {}) {
  const back = () => {
    endAsk();
    const note = drawEvents(stopLearning());
    if (note.text) showRoomNote(note.cls, note.text);
    onBack();
  };
  openRounds(role, {
    settle: settleLearning, going: learningOn, title: 'ask.title.learn', of: SHIP_JOB.learnRounds,
    round: () => state.run.ship.learning.round + 1, modifiers: () => [], reveal: true, back,
  });
}

// The final boss (ship minigames plan step G3; roles.js bossReady): Match
// on the ask screen, titled as the final challenge, with no BACK. Its
// stand-in question carries the board and the player's taught crew (one
// per charge meter). The board's result ends the run: won, the ship
// arrives; lost, the run is lost (roles.js settleBoss).
export function openBoss() {
  if (!state.run.ship || state.run.ship.boss || state.run.runEnded) return;
  state.run.turnLocked = true;
  startBoss();
  askAnswers = {
    onChoice: () => {},
    onTyped: () => {},
    onTimeout: () => {},
    onResult: result => endAsk(() => [...endMinigame(result), ...settleBoss(result.right)]),
    log: text => showRoomNote('', text),
  };
  clearModifier();
  showQuestionScreen(askAnswers, 'boss');
  const crew = state.run.ship.taught.slice(0, 3);
  setQuestion({ question: t('boss.q'), answer: '', match: { board: matchSetup(matchGroups()), crew } });
  state.battle.minigame = 'match';
  state.run.lastMinigame = 'match';
  setMinigame('match');
}

// Rounds of `role`'s minigame on the ask screen (a job or learning), each
// settled by `how.settle`; between rounds the next is asked in place while
// `how.going()` says there are more; after the last, or if the run ends,
// the ask screen closes and the turn's events play out.
function openRounds(role, how) {
  state.run.turnLocked = true;
  const settle = (isCorrect, scored = []) => {
    const events = [...scored, ...how.settle(isCorrect)];
    if (!how.going() || events.some(e => e.type === 'shipEnded')) {
      endAsk(() => events);
      return;
    }
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
    askRound(role, how);
  };
  askAnswers = {
    onChoice: choice => holdAnswer(choice, () => settle(matchesAnswer(choice)), how.reveal),
    onTyped: raw => { if (raw.trim()) settle(matchesAnswer(raw)); },
    onTimeout: () => holdAnswer(null, () => settle(false), how.reveal),
    onResult: result => settle(result.right, endMinigame(result)),
    log: text => showRoomNote('', text),
  };
  askRound(role, how);
}

// The next round: a question the role's minigame can run (or the Cook's
// Letter Pool, Life support's Sum Lock), shown as that minigame, titled
// with the role and the round, with the modifiers `how` gives that it can
// carry.
function askRound(role, how) {
  const { minigame } = roleOf(role);
  clearModifier();
  showQuestionScreen(askAnswers, 'job', t(how.title, { role: t('role.' + role).toUpperCase(), round: how.round(), of: how.of }), how.back);
  setQuestion(jobQuestion(minigame));
  state.battle.minigame = minigame;
  state.run.lastMinigame = minigame;
  setMinigame(minigame);
  (modifiersFor(minigame, how.modifiers()) || []).forEach(applyModifier);
}

// A question for a round of `minigame`: a Letter Pool over a category it
// can run, a fresh Sum Lock, or a question of the set it fits.
function jobQuestion(minigame) {
  if (minigame === 'letterPool') {
    const groups = roleGroups();
    return letterPoolQuestion(groups[Math.floor(Math.random() * groups.length)]);
  }
  if (minigame === 'sumLock') return sumLockQuestion();
  return pickQuestion(state.battle.currentQuestion, roleQuestions(minigame));
}

// A breaker was tapped on a ship station's wires (charger.js breakerAsked;
// ship plan step B): its question on the ask screen; it
// may run as a minigame, with no modifiers (no Timer on the ship). The
// answer settles it
// (stations.js settleBreaker: closed, or a spark), then the wires open
// again where they were, unless that answer joined the power up.
export function openBreaker(station, index) {
  state.run.turnLocked = true;
  const settle = (isCorrect, scored = []) => {
    endAsk(() => [...scored, ...settleBreaker(station, index, isCorrect)]);
    if (station.puzzle && !state.run.runEnded) openCharger(station);
  };
  askAnswers = {
    onChoice: choice => holdAnswer(choice, () => settle(matchesAnswer(choice))),
    onTyped: raw => { if (raw.trim()) settle(matchesAnswer(raw)); },
    onTimeout: () => holdAnswer(null, () => settle(false)),
    onResult: result => settle(result.right, endMinigame(result)),
    log: text => showRoomNote('', text),
  };
  showQuestionScreen(askAnswers, 'breaker');
  askQuestion(pickQuestion(state.battle.currentQuestion), []);
}

// Sets question `q` and puts `modifiers` on it; it may run as a minigame
// (dressQuestion). Wherever a question is asked goes through here or
// dressQuestion, so any of them can roll a minigame. `pool` is where `q`
// came from, for DEV -> Minigame forcing one (minigames.js forcedQuestion).
// `group` is the category the player picked it from, if any, which a
// Letter Pool can run instead.
function askQuestion(q, modifiers, pool, group = null) {
  setQuestion(forcedQuestion(q, pool));
  dressQuestion(modifiers, group);
}

// Rolls whether the question showing runs as a minigame (minigames.js
// rollMinigame: only one that can carry all of `modifiers`), then puts
// the modifiers on it. A Letter Pool swaps the question for its stand-in.
function dressQuestion(modifiers, group = null) {
  const list = modifiers.filter(Boolean);
  const minigame = rollMinigame(state.battle.currentQuestion, list, group);
  if (minigame === 'letterPool') setQuestion(letterPoolQuestion(group));
  if (minigame === 'sumLock') setQuestion(sumLockQuestion());
  setMinigame(minigame);
  list.forEach(applyModifier);
}

// A Sum Lock's stand-in for a trapped box's question (minigames.js
// sumLockSetup): its answer is the total with both answers, for the log
// on a miss ("47 (40 + 7)").
export function sumLockQuestion() {
  const lock = sumLockSetup();
  return {
    question: t('mg.sumLock.term'),
    answer: t('mg.sumLock.reveal', { a: lock.a, b: lock.b, total: lock.total }),
    source: [lock.first.source, lock.second.source].filter(Boolean).join(' · '),
    sumLock: lock,
  };
}

// A Letter Pool's stand-in for a question (minigames.js letterPoolSetup):
// it asks for the category's answers ("BOOKS: FORM 3"), and its answer is
// the hidden ones, for the log on a miss.
export function letterPoolQuestion(group) {
  const pool = letterPoolSetup(group);
  const answer = pool.hidden.map(w => w[0] + w.slice(1).toLowerCase()).join(', ');
  return { question: t('mg.letterPool.term', { label: group.label, n: LETTER_POOL_FORM }), answer, letterPool: pool };
}

// Closes the ask screen, parks the question panel and frees the turn;
// `settle` (if given) is the rule that ends it, and its events are the turn.
export function endAsk(settle) {
  clearModifier();
  closeMapPanels();
  parkQuestionPanel();
  askAnswers = null;
  if (settle) applyTurnOutcome(settle());
  state.run.turnLocked = false;
}

// DEV -> Auto-win, with the ask screen open: plays a minigame out at X or
// answers the question right, and closes the book held after it.
export function autoWinGun() {
  if (askHeld()) { closeHeldAsk(); return; }
  if (mapPanelShown() !== 'question' || !askAnswers) return;
  if (state.battle.minigame) playMinigameOut();
  else askAnswers.onChoice(state.battle.currentQuestion.answer);
}
