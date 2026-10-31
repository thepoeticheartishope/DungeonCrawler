// The gun's actions on the map (gun combat plan; moved out of main.js,
// tech-debt item 4d): SELECT and F (pressSelect, fireGun, the steady aim's
// hold and release), the dial's READY, stop and BACK, the Struggle's stop,
// reloads from energy cells and relays on the ask screen (the record book),
// the tutorial's name barrel, dressing a question with its modifiers and
// maybe a minigame (askQuestion, dressQuestion), and the DEV gun tests and
// Auto-win. Like devpanel.js it looks up its own elements and gets the
// main.js actions it calls passed in (initGunActions); main.js imports the
// rest from here.

import { state } from './state.js';
import { tutorialDial, tutorialSteady, settleName } from './tutorial.js';
import { matchesAnswer, mountBattleQuestion } from './battlescreen.js';
import { ENERGY_MAX, LETTER_POOL_FORM } from './config.js';
import { pickQuestion } from './quiz.js';
import { onStairs } from './moves.js';
import { settleRelay } from './relays.js';
import { settleBreaker } from './stations.js';
import { requestMapDraw } from './mapview.js';
import {
  cycleTarget, fire, readyShot, cancelShot, settleShot, startSteady, steadying, releaseSteady, cancelSteady,
  holdSteady, reloadCategory, reloadOffers, settleReload, readyStruggle, settleStruggle, addRounds,
} from './gun.js';
import {
  showReloadPanel, showQuestionScreen, showDamageBar, runDamageBar, runStruggleBar, closeMapPanels, fadeDial,
  mapPanelShown, pressBar, turnAskPage, holdAskScreen, askHeld, closeHeldAsk,
} from './gunpanels.js';
import { t } from './text.js';
import { setQuestion, setMinigame, clearModifier, applyModifier, markAnswer } from './questionview.js';
import { rollMinigame, forcedQuestion, endMinigame, letterPoolSetup, sumLockSetup } from './minigames.js';
import { playMinigameOut } from './minigameview.js';

const roomScreen = document.getElementById('roomScreen');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const mcOptionsEl = document.getElementById('mcOptions');

// The main.js actions these call, passed in by initGunActions.
let applyTurnOutcome, drawEvents, goDown, openCharger, showRoomNote;

// Hands over the main.js actions. main.js calls it once at load.
export function initGunActions(actions) {
  ({ applyTurnOutcome, drawEvents, goDown, openCharger, showRoomNote } = actions);
}

// Whether the gun can be used right now: the room screen up with no gun
// panel over it, and no turn in progress.
export function gunReady() {
  return !state.run.turnLocked && !state.run.runEnded &&
    roomScreen.classList.contains('show') && !mapPanelShown();
}

// True while the gun panel that's open came from a DEV test button, whose
// result is drawn without spending a turn.
let gunTest = false;

// What a reload or a shot comes to once its panel closes: a real one is
// a turn (minions move, the light spreads, a minion may strike); a DEV
// test only draws.
function finishGunAction(events) {
  if (!gunTest) { applyTurnOutcome(events); return; }
  const note = drawEvents(events);
  if (note.text) showRoomNote(note.cls, note.text);
}

// SELECT (button or F), the gun's one button: on a dial it presses READY,
// then stops it; otherwise it fires at the target. One button
// in one place, so the thumb stays put and the eyes stay on the marker.
// Energy comes only from energy cells: there is no reloading at will.
// Standing on the stairs, SELECT goes down instead of firing.
export function pressSelect() {
  if (steadying() && !mapPanelShown()) return;
  const shown = mapPanelShown();
  if (shown === 'aim' || shown === 'struggle') { pressBar(); return; }
  if (!shown && onStairs()) { goDown(); return; }
  fireGun();
}

// Fires (SELECT with no dial showing): shoots the gun's target
// (gun.js fire). A blocked shot only says why and costs nothing; a landed
// shot on the hunter is the turn; one on a minion opens the dial at READY
// first, and the turn is spent when it stops (BACK before READY spends
// nothing: lowerGun).
function fireGun() {
  if (!gunReady()) return;
  const events = fire(state.floor.gunTarget);
  if (events.some(e => e.type === 'fireBlocked')) {
    const note = drawEvents(events);
    showRoomNote(note.cls, note.text);
    return;
  }
  gunTest = false;
  // Steady aim (STEADY_AIM, steady aim plan): no dial; SELECT held steadies the
  // shot while the world goes on, and letting go fires (releaseSelect).
  if (state.battle.aim && steadyOn()) {
    startSteady();
    const note = drawEvents(events.concat(tutorialSteady(events)));
    if (note.text) showRoomNote(note.cls, note.text);
    requestMapDraw();
    return;
  }
  state.run.turnLocked = true;
  if (state.battle.aim) {
    const note = drawEvents(events.concat(tutorialDial(events)));
    if (note.text) showRoomNote(note.cls, note.text);
    showDamageBar(state.battle.aim);
    return;
  }
  applyTurnOutcome(events);
  state.run.turnLocked = false;
}

// Whether SELECT is held to steady a shot instead of opening the dial:
// DEV -> Steady aim, with One stick on (the world runs while it is held).
export function steadyOn() {
  return state.settings.steadyAim && state.settings.oneStick;
}

// SELECT let go while steadying (gun.js releaseSteady): the shot fires and
// settles as a stopped dial's would. `cancel` (slid off SELECT, Escape)
// lowers the gun for nothing (cancelSteady).
export function releaseSelect(cancel = false) {
  if (!steadying()) return;
  if (cancel) {
    const note = drawEvents(cancelSteady());
    if (note.text) showRoomNote(note.cls, note.text);
    requestMapDraw();
    return;
  }
  const events = releaseSteady();
  state.run.turnLocked = true;
  finishGunAction(events);
  state.run.turnLocked = false;
}

// T: the gun's next target in reach. Costs no turn.
export function nextGunTarget() {
  if (!gunReady()) return;
  const note = drawEvents(cycleTarget());
  if (note.text) showRoomNote(note.cls, note.text);
}

// The energy cell the open reload panel came from (bumped on the map), or
// null for the RELOAD button and DEV -> Test reload.
let reloadBox = null;

// Opens the reload panel, or says why not (full energy: a bumped cell
// then stays as it is, for later).
export function openReload(test, box = null) {
  const offered = reloadOffers();
  if (offered.block) { showRoomNote('block-msg', t('gun.block.' + offered.block)); return; }
  gunTest = test;
  reloadBox = box;
  state.run.turnLocked = true;
  showReloadPanel(offered);
}

// DEV -> Test shot: fires at the gun's target through the real rules
// (gun.js), without spending a turn: minions don't move and the light
// doesn't spread. Fills empty energy first.
export function devTestShot() {
  if (!gunReady()) return;
  if (state.run.energy <= 0) addRounds(ENERGY_MAX);
  const target = state.floor.minions.includes(state.floor.gunTarget) ? state.floor.gunTarget : null;
  const note = drawEvents(fire(target));
  if (note.text) showRoomNote(note.cls, note.text);
  if (!state.battle.aim) return;
  gunTest = true;
  state.run.turnLocked = true;
  showDamageBar(state.battle.aim);
}

// READY on the dial showing for `mode` ('aim' or 'struggle'): the rule
// starts it (gun.js readyShot spends the shot's round and may find a
// weakness; readyStruggle), then the dial runs.
export function readyDial(mode) {
  if (mode === 'struggle') {
    if (!readyStruggle().length) return;
    runStruggleBar(state.battle.struggle);
    return;
  }
  const events = readyShot();
  if (!events.length) return;
  const note = drawEvents(events.concat(tutorialDial(events)));
  if (note.text) showRoomNote(note.cls, note.text);
  runDamageBar(state.battle.aim);
}

// BACK (Escape) before READY (gun.js cancelShot): the gun goes down,
// nothing is spent and it is no turn.
export function lowerGun() {
  const events = cancelShot();
  if (!events.length) return;
  fadeDial(null);
  gunTest = false;
  state.run.turnLocked = false;
  const note = drawEvents(events);
  if (note.text) showRoomNote(note.cls, note.text);
}

// The player stopped the dial at `barPosition`: what the shot did, shown
// in the dial's middle while it fades out.
export function stopDamageBar(barPosition) {
  const events = settleShot(barPosition);
  fadeDial(dialResult(events));
  finishGunAction(events);
  state.run.turnLocked = false;
}

// The word a stopped dial shows for what happened (the first event that
// says), or '' if none does.
const DIAL_RESULTS = {
  minionFinished: 'finished', minionKilled: 'kill', minionDowned: 'down', guardBroken: 'guard',
  minionReels: 'hit', shotMissed: 'miss', shotIntoDark: 'miss', shotJammed: 'jam', shotLoud: 'loud',
  shotLunged: 'lunge', struggleWon: 'shoved', struggleLost: 'lost',
};
function dialResult(events) {
  const found = events.find(e => DIAL_RESULTS[e.type]);
  return found ? t('gun.dial.result.' + DIAL_RESULTS[found.type]) : '';
}

// DEV -> Test reload: the real reload through the ask screen,
// without spending a turn, like Test shot.
export function devTestReload() {
  if (!gunReady()) return;
  openReload(true);
}

// What the question panel's input means on the ask screen, for the
// reload or relay that's open (set by pickReload; DEV -> Auto-win answers through it).
let askAnswers = null;

// A reload offer was picked: its question (or a minigame), with its
// modifiers, on the ask screen. Any answer (or the Timer running out) settles
// the reload; a minigame's tier changes the energy.
export function pickReload(offer, category) {
  const box = reloadBox;
  const settle = (isCorrect, tier, scored = []) => endReload(() => [...scored, ...settleReload(isCorrect, offer, box, tier)]);
  askAnswers = {
    onChoice: choice => holdAnswer(choice, () => settle(matchesAnswer(choice))),
    onTyped: raw => { if (raw.trim()) settle(matchesAnswer(raw)); },
    onTimeout: () => holdAnswer(null, () => settle(false)),
    onResult: result => settle(result.right, result.tier || '2', endMinigame(result)),
    log: text => showRoomNote('', text),
  };
  // The book's page turns from the offers to the question (record book plan step B).
  turnAskPage(() => {
    showQuestionScreen(askAnswers, 'reload');
    askQuestion(pickQuestion(state.battle.currentQuestion, category.pool), offer.modifiers, category.pool, category);
  });
}

// An option was picked (or the Timer ran out, `picked` null) on the ask
// screen: the book marks it (questionview.js markAnswer: struck, the right
// answer written beside it) and stays open until a tap or a key, then
// `settle` runs as before (record book plan step C). Nothing moves
// meanwhile: the clock is paused while the ask screen shows. A second
// answer while it waits does nothing.
function holdAnswer(picked, settle) {
  if (askHeld()) return;
  clearModifier();
  markAnswer(picked, matchesAnswer, state.settings.revealOnWrong);
  holdAskScreen(settle);
}

// A relay was bumped (moves.js relayFound): its question on the ask screen,
// like a reload's, with no offers to pick and no modifiers. Any answer
// (relays.js settleRelay) is the turn.
export function openRelay(relay) {
  gunTest = false;
  state.run.turnLocked = true;
  const settle = (isCorrect, scored = []) => endReload(() => [...scored, ...settleRelay(isCorrect, relay)]);
  askAnswers = {
    onChoice: choice => holdAnswer(choice, () => settle(matchesAnswer(choice))),
    onTyped: raw => { if (raw.trim()) settle(matchesAnswer(raw)); },
    onTimeout: () => holdAnswer(null, () => settle(false)),
    onResult: result => settle(result.right, endMinigame(result)),
    log: text => showRoomNote('', text),
  };
  showQuestionScreen(askAnswers, 'relay');
  askQuestion(pickQuestion(state.battle.currentQuestion), []);
}

// A breaker was tapped on a ship station's wires (charger.js breakerAsked;
// ship plan step B): its question on the ask screen, like a relay's, with
// no modifiers; it may run as a minigame. The answer settles it
// (stations.js settleBreaker: closed, or a spark), then the wires open
// again where they were, unless that answer joined the power up.
export function openBreaker(station, index) {
  gunTest = false;
  state.run.turnLocked = true;
  const settle = (isCorrect, scored = []) => {
    endReload(() => [...scored, ...settleBreaker(station, index, isCorrect)]);
    if (station.puzzle) openCharger(station);
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

// The tutorial's barrel was bumped (moves.js nameAsked): it asks the
// player's name on the ask screen, typed, with no options, no modifiers
// and no minigame. Any name that isn't blank settles it (tutorial.js
// settleName), and that is the turn.
export function openNameBarrel() {
  gunTest = false;
  state.run.turnLocked = true;
  const none = () => {};
  askAnswers = {
    onChoice: none,
    onTyped: raw => {
      if (!raw.trim()) return;
      showTypedAnswer(false);
      endReload(() => settleName(raw));
    },
    onTimeout: none,
    onResult: none,
    log: text => showRoomNote('', text),
  };
  showQuestionScreen(askAnswers, 'barrel');
  setQuestion({ term: t('tut.name.q'), meaning: '' });
  showTypedAnswer(true);
}

// Shows the typed answer box in place of the options (`on`), or puts the
// options back: every other question is multiple choice (startGame).
function showTypedAnswer(on) {
  answerForm.style.display = on ? 'flex' : 'none';
  mcOptionsEl.classList.toggle('show', !on);
  if (on) answerInput.focus();
}

// Sets question `q` and puts `modifiers` on it; it may run as a minigame
// (dressQuestion). Wherever a question is asked goes through here or
// dressQuestion, so any of them can roll a minigame. `pool` is where `q`
// came from, for DEV -> Minigame forcing one (minigames.js forcedQuestion).
// `group` is the category the player picked it from, if any, which a
// Letter Pool can run instead.
export function askQuestion(q, modifiers, pool, group = null) {
  setQuestion(forcedQuestion(q, pool));
  dressQuestion(modifiers, group);
}

// Rolls whether the question showing runs as a minigame (minigames.js
// rollMinigame: only one that can carry all of `modifiers`), then puts
// the modifiers on it. A Letter Pool swaps the question for its stand-in.
export function dressQuestion(modifiers, group = null) {
  const list = modifiers.filter(Boolean);
  const minigame = rollMinigame(state.battle.currentQuestion, list, group);
  if (minigame === 'letterPool') setQuestion(letterPoolQuestion(group));
  if (minigame === 'sumLock') setQuestion(sumLockQuestion());
  setMinigame(minigame);
  list.forEach(applyModifier);
}

// A Sum Lock's stand-in for a trapped box's question (minigames.js
// sumLockSetup): its answer is the total with both answers, for the log
// on a miss ("47 (40 + 7)"). It never comes back as a haunt; its two
// questions do when the total is wrong (endMinigame).
export function sumLockQuestion() {
  const lock = sumLockSetup();
  return {
    term: t('mg.sumLock.term'),
    meaning: t('mg.sumLock.reveal', { a: lock.a, b: lock.b, total: lock.total }),
    source: [lock.first.source, lock.second.source].filter(Boolean).join(' · '),
    sumLock: lock,
  };
}

// A Letter Pool's stand-in for a question (minigames.js letterPoolSetup):
// it asks for the category's answers ("BOOKS: FORM 3"), and its answer is
// the hidden ones, for the log on a miss. It never comes back as a haunt
// (haunts.js).
export function letterPoolQuestion(group) {
  const pool = letterPoolSetup(group);
  const meaning = pool.hidden.map(w => w[0] + w.slice(1).toLowerCase()).join(', ');
  return { term: t('mg.letterPool.term', { label: group.label, n: LETTER_POOL_FORM }), meaning, letterPool: pool };
}

// Closes the gun's panels, hands the question panel back to the battle
// screen and frees the turn; `settle` (if given) is the rule that ends it.
export function endReload(settle) {
  clearModifier();
  closeMapPanels();
  mountBattleQuestion();
  askAnswers = null;
  reloadBox = null;
  state.battle.struggle = null;
  if (settle) finishGunAction(settle());
  state.run.turnLocked = false;
}

// DEV -> Auto-win, with a gun panel open: picks the first reload, answers
// its question right (a minigame at X) and closes the book held after it, and starts and stops the dial in its
// kill zone (a Struggle's in its zone). Walking, reloading and firing stay the player's.
export function autoWinGun() {
  if (askHeld()) { closeHeldAsk(); return; }
  if (steadying()) { holdSteady(); releaseSelect(); return; }
  const shown = mapPanelShown();
  if (shown === 'reload') pickReload(reloadOffers().offers[0], reloadCategory());
  else if (shown === 'question' && askAnswers && state.battle.minigame) playMinigameOut();
  else if (shown === 'question' && askAnswers) askAnswers.onChoice(state.battle.currentQuestion.meaning);
  else if (shown === 'aim') {
    if (state.battle.aim.phase === 'ready') readyDial('aim');
    stopDamageBar(bestSpot(state.battle.aim));
  } else if (shown === 'struggle') {
    if (state.battle.struggle.phase === 'ready') readyDial('struggle');
    const zone = state.battle.struggle.zone;
    stopStruggleBar((zone.from + zone.to) / 2);
  }
}

// The middle of the aim's kill zone (its best zone, for Auto-win), or its
// maim zone with no kill zone (the smoke test takes it away).
function bestSpot(aim) {
  const zone = aim.zones.find(z => z.tier === 'kill') || aim.zones.find(z => z.tier === 'maim');
  return (zone.from + zone.to) / 2;
}

// The Struggle dial stopped at `barPosition` (gun.js settleStruggle): the
// minion is shoved away or strikes. The world's turn that brought it here
// already happened, so this only draws and checks the run.
export function stopStruggleBar(barPosition) {
  const events = settleStruggle(barPosition);
  fadeDial(dialResult(events));
  applyTurnOutcome(events, false);
}
