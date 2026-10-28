// The battle screen: the boss (the gate), the chest and trapped boxes are
// met here, off the map; minions and the hunter are fought on the map. It owns the encounter log,
// the category choices, a turn of questions, settling an answer
// (answers.js settleAnswer) and leaving the encounter. Moved out of main.js
// (tech-debt item 4c). Like devpanel.js it looks up its own elements and
// gets the main.js actions it calls passed in (initBattleScreen); main.js
// imports what it needs from here.

import { state } from './state.js';
import { BATTLE_CHOICE_COUNT, TIMER_SECONDS } from './config.js';
import { rollCategoryModifiers, maxWager } from './modifiers.js';
import { pickHaunt } from './haunts.js';
import { pickQuestion, escapeHtml, normalizeSpaces, buildCategoryChoices } from './quiz.js';
import { showScreen, renderCombatStatus, renderTargeting, stopTimer } from './render.js';
import { isAdjacentToPlayer, refreshTargetValidity } from './combat.js';
import { lightConsumed } from './light.js';
import { openGateFree } from './gate.js';
import { settleAnswer } from './answers.js';
import { requestMapDraw, glyphOf } from './mapview.js';
import { t } from './text.js';
import { mountQuestionPanel, setQuestion, retypeQuestion, clearModifier } from './questionview.js';
import { forcedQuestion, endMinigame } from './minigames.js';

const roomScreen = document.getElementById('roomScreen');
const battleScreen = document.getElementById('battleScreen');
const battleGlyphEl = document.getElementById('battleGlyph');
const heartsEl = document.getElementById('hearts');
const choicePanel = document.getElementById('choicePanel');
const choiceListEl = document.getElementById('choiceList');
const queryPanel = document.getElementById('queryPanel');
const battleQuestionSlot = document.getElementById('battleQuestionSlot');
const answerInput = document.getElementById('answerInput');
const encounterLogEl = document.getElementById('encounterLog');
const endPanel = document.getElementById('endPanel');
const continueBtn = document.getElementById('continueBtn');

// The main.js actions this screen calls, passed in by initBattleScreen.
let drawEvents, askQuestion, dressQuestion, endLose, loseToLight, setControlsEnabled;

// Hands over the main.js actions, puts the question panel on the battle
// screen and wires up its keys and the continue button. main.js calls it
// once at load.
export function initBattleScreen(actions) {
  ({ drawEvents, askQuestion, dressQuestion, endLose, loseToLight, setControlsEnabled } = actions);
  mountBattleQuestion();
  continueBtn.addEventListener('click', leaveEncounter);
  // Number keys pick a category while the battle screen is offering a choice;
  // Enter or Space moves on from a settled encounter even if the continue
  // button lost focus.
  document.addEventListener('keydown', (e) => {
    if (!battleScreen.classList.contains('show')) return;
    if (state.battle.battlePhase === 'ended' && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== continueBtn) {
      e.preventDefault();
      if (!continueBtn.disabled) leaveEncounter();
      return;
    }
    if (state.battle.battlePhase !== 'choosing') return;
    const idx = ['1', '2', '3'].indexOf(e.key);
    const btn = idx === -1 ? null : choiceListEl.children[idx];
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });
}

function nextQuestion() {
  setQuestion(pickQuestion(state.battle.currentQuestion));
}

// If the showing question isn't from the set being played (a leftover
// from an earlier set), reroll it from the set. A no-op the rest of the time.
export function syncQuestionForTarget() {
  const pool = state.settings.activeData;
  if (!pool.includes(state.battle.currentQuestion)) {
    setQuestion(pickQuestion(state.battle.currentQuestion, pool));
  }
}

// Switches between the room/map view and the battle screen to match whether
// something is currently targeted — battle screen while state.battle.selectedTarget
// is set (an encounter is engaged), room screen once it's null (nothing left
// adjacent). Call this anywhere state.battle.selectedTarget might have just changed;
// it's a no-op if the right screen is already showing. Also refreshes the
// battle screen's opponent glyph/HP display for whichever target is current,
// so resolving one adjacent thing and chaining straight into the next (e.g.
// boxed in by two minions) updates in place without a spurious round trip
// through the room screen.
// Clear correct/wrong signal on the battle screen itself. The map sits
// behind (and is invisible during) the battle screen, so a fight needs
// its own visible feedback distinct from the feedback text alone.
function flashBattleResult(isCorrect) {
  const cls = isCorrect ? 'flash-correct' : 'flash-wrong';
  battleGlyphEl.classList.remove('flash-correct', 'flash-wrong');
  void battleGlyphEl.offsetWidth;
  battleGlyphEl.classList.add(cls);
  if (!isCorrect) flashHearts();
}

// The stability count flashes when it drops: a miss, or a minion's strike.
export function flashHearts() {
  heartsEl.classList.remove('hit-flash');
  void heartsEl.offsetWidth;
  heartsEl.classList.add('hit-flash');
}

// Scrambles `text` into glitch characters, then resolves it left to right —
// the category-choice labels "decode" into place rather than just appearing.
// Spaces stay put so the label's shape is readable from the first frame.
const decodeTimers = new WeakMap();
const DECODE_CHARS = '01{}[]<>/\\;:=+*#$%&^~ABCDEF';
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function decodeText(el, text, durationMs = 520) {
  const existing = decodeTimers.get(el);
  if (existing) clearInterval(existing);
  if (reduceMotion) { el.textContent = text; return; }
  const frameMs = 35;
  const frames = Math.max(1, Math.round(durationMs / frameMs));
  let frame = 0;
  const render = () => {
    const settled = Math.floor((frame / frames) * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      out += i < settled || text[i] === ' '
        ? text[i]
        : DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];
    }
    el.textContent = out;
  };
  render();
  const timer = setInterval(() => {
    frame++;
    if (frame >= frames) {
      clearInterval(timer);
      decodeTimers.delete(el);
      el.textContent = text;
      return;
    }
    render();
  }, frameMs);
  decodeTimers.set(el, timer);
}

// ---- Encounter log ----
// The battle screen's transcript of the current encounter: what it is,
// its rules, each query vector chosen, each input and its outcome. It is
// the battle screen's only feedback channel — cleared when a new encounter
// starts, kept across every round of a boss fight. Line kinds map onto the
// phosphor's intensities: 'sys' (dim), normal, 'bright', and 'alert'
// (inverse video, reserved for a miss or the end of the run).
const LOG_MAX_LINES = 40;

export function logLine(text, kind) {
  const line = document.createElement('div');
  line.className = 'log-line' + (kind ? ' log-' + kind : '');
  line.textContent = text;
  encounterLogEl.appendChild(line);
  while (encounterLogEl.children.length > LOG_MAX_LINES) encounterLogEl.firstChild.remove();
  ageLog();
  encounterLogEl.scrollTop = encounterLogEl.scrollHeight;
}

// Transcript aging: the newest few lines keep their own intensity; older
// ones drop to dim and fade a step per line, so history recedes behind the
// current prompt instead of competing with it.
const LOG_FRESH_LINES = 3;

function ageLog() {
  const lines = encounterLogEl.children;
  for (let i = 0; i < lines.length; i++) {
    const age = lines.length - 1 - i;
    lines[i].classList.toggle('log-old', age >= LOG_FRESH_LINES);
    // Floor kept high enough that the oldest (small, dim) line stays readable.
    lines[i].style.opacity = String(Math.max(0.45, 1 - age * 0.07));
  }
}

export function clearLog() {
  encounterLogEl.innerHTML = '';
}

// Opening lines for a new encounter: what it is and what's at stake.
// Wording is per target kind (boss / minion / hunter / chest / box)
// under log.start.* and log.rules.* in text.js.
function logEncounterStart(target) {
  clearLog();
  const vars = { queries: target.max || 0 };
  logLine(t('log.start.' + target.kind, vars), 'bright');
  logLine(t('log.rules.' + target.kind, vars), 'sys');
}

// Shows whichever part of the battle screen matches state.battle.battlePhase: the
// category choices, the question and its answer input, or (once the
// encounter is settled) the prompt to continue.
function showBattlePhase() {
  choicePanel.hidden = state.battle.battlePhase !== 'choosing';
  queryPanel.hidden = state.battle.battlePhase !== 'answering';
  endPanel.hidden = state.battle.battlePhase !== 'ended';
}

function renderCategoryChoices() {
  choiceListEl.innerHTML = '';
  state.battle.categoryChoices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span><span class="choice-label"></span>' +
      choice.modifiers.map(mod =>
        '<span class="mod-tag" title="' + escapeHtml(t('mod.' + mod) + ': ' + t('mod.' + mod + '.tip', { max: maxWager(), secs: TIMER_SECONDS })) + '">' +
          escapeHtml(t('mod.' + mod + '.tag')) + '</span>').join('');
    decodeText(btn.querySelector('.choice-label'), choice.label);
    btn.addEventListener('click', () => chooseCategory(i));
    choiceListEl.appendChild(btn);
  });
}

// Sets up one turn of whatever's on the battle screen. A boss or minion
// fight opens with a choice of query categories (the player picks what
// kind of question they face); the chest and trapped boxes are
// puzzles, not fights, and go straight to their question — as does any
// fight whose pool can't offer at least two distinct choices.
function startBattleTurn() {
  const target = state.battle.selectedTarget;
  // Every key held: the gate gives with no question (gate.js).
  if (target.kind === 'boss' && target.hp === 0) {
    drawEvents(openGateFree());
    endEncounter();
    return;
  }
  const isFight = target.kind === 'boss';
  state.battle.categoryChoices = isFight
    ? buildCategoryChoices(state.settings.activeData, BATTLE_CHOICE_COUNT, state.floor.lastChoiceType)
    : [];
  const modifiers = rollCategoryModifiers(target, state.battle.categoryChoices.length);
  // Each choice's modifiers as a list: none, one, or the hunter's pair.
  state.battle.categoryChoices.forEach((choice, i) => { choice.modifiers = [].concat(modifiers[i] || []); });

  if (state.battle.categoryChoices.length >= 2) {
    state.battle.battlePhase = 'choosing';
    renderCategoryChoices();
  } else {
    state.battle.battlePhase = 'answering';
    // A fight may bring back a missed question (js/haunts.js).
    const haunt = isFight ? pickHaunt(state.settings.activeData, state.battle.currentQuestion) : null;
    if (haunt) {
      logLine(t('log.haunt.returns'), 'alert');
      setQuestion(haunt);
    } else {
      syncQuestionForTarget();
    }
    const forced = forcedQuestion(state.battle.currentQuestion, state.settings.activeData);
    if (forced !== state.battle.currentQuestion) setQuestion(forced);
    // The question was very likely set well before this moment, off-screen
    // (loadRoom() sets one at room load), so re-type it fresh every time a
    // turn starts rather than letting the effect be skipped.
    retypeQuestion();
    // A boss question always carries a modifier, even with no category
    // choice to show it on. Any question may run as a minigame.
    clearModifier();
    dressQuestion(target.kind === 'boss' ? [].concat(rollCategoryModifiers(target, 1)[0] || []) : []);
    if (!state.settings.mcMode) answerInput.focus();
  }
  showBattlePhase();
}

export function chooseCategory(i) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'choosing') return;
  const choice = state.battle.categoryChoices[i];
  if (!choice) return;
  // A missed question from this category may come back instead.
  const haunt = pickHaunt(choice.pool, state.battle.currentQuestion);
  const q = haunt || pickQuestion(state.battle.currentQuestion, choice.pool);
  logLine(t('log.vector', { n: i + 1, label: choice.label }), 'sys');
  if (haunt) logLine(t('log.haunt.returns'), 'alert');
  state.floor.lastChoiceType = choice.choiceType || null;
  state.battle.battlePhase = 'answering';
  askQuestion(q, choice.modifiers, choice.pool, choice);
  showBattlePhase();
  if (!state.settings.mcMode) answerInput.focus();
}

export function syncBattleScreen() {
  if (state.battle.selectedTarget) {
    const target = state.battle.selectedTarget;
    battleGlyphEl.textContent = glyphOf(target);
    renderCombatStatus();
    const entering = !battleScreen.classList.contains('show');
    if (entering) {
      mountBattleQuestion();
      showScreen(battleScreen);
      battleScreen.classList.remove('glitch-in');
      void battleScreen.offsetWidth;
      battleScreen.classList.add('glitch-in');
    }
    // A new encounter starts on entering, and whenever the player moves
    // on from a settled one straight into another adjacent target.
    if (entering || state.battle.battleTarget !== target) {
      state.battle.battleTarget = target;
      logEncounterStart(target);
      startBattleTurn();
    }
  } else {
    state.battle.battleTarget = null;
    if (battleScreen.classList.contains('show')) showScreen(roomScreen);
  }
}

// The encounter is settled: its target is gone (or opened/spent), and the
// battle screen holds on the log until the player continues, so the
// outcome is read rather than flashing past as the screen switches back.
function endEncounter() {
  state.battle.selectedTarget = null;
  state.battle.battlePhase = 'ended';
  showBattlePhase();
  continueBtn.focus();
}

// Leaves a settled encounter: straight into the next one if something
// else is adjacent, otherwise back to the room.
export function leaveEncounter() {
  if (state.battle.battlePhase !== 'ended') return;
  state.battle.battlePhase = 'answering';
  state.battle.battleTarget = null;
  refreshTargetValidity();
  renderTargeting();
  requestMapDraw();
  nextQuestion();
  syncBattleScreen();
}

// Shared outcome handler for both typed answers and multiple-choice taps.
// Assumes the caller already confirmed adjacency, set turnLocked = true,
// and counted the attempt. `given` is the player's answer, echoed to the log.
// settleAnswer (answers.js) changes state; this draws its events and picks
// what comes next: the run ends at 0 hearts, a boss fight goes on to its
// next question, anything else is settled. A minigame passes its `tier`
// and the events that scored it (`scored`), drawn first.
function applyAnswerResult(isCorrect, hadExtraSpace, given, tier = '2', scored = []) {
  const events = [...scored, ...settleAnswer(isCorrect, hadExtraSpace, given, tier)];
  const has = (type) => events.some(e => e.type === type);
  drawEvents(events);
  flashBattleResult(isCorrect);
  if (has('signalLost')) {
    setControlsEnabled(false);
    stopTimer();
    setTimeout(endLose, 900);
  } else if (has('gateSealed') && lightConsumed()) {
    // The turns a wrong answer gave the light were its last.
    endEncounter();
    loseToLight();
  } else if (has('bossHit')) {
    nextQuestion();
    startBattleTurn();
  } else {
    endEncounter();
  }
  state.run.turnLocked = false;
}

function attemptAnswer(raw) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  if (!raw.trim()) return;

  state.run.turnLocked = true;
  state.run.attempts++;
  const hadExtraSpace = raw !== raw.trim() || /\s{2,}/.test(raw);
  applyAnswerResult(matchesAnswer(raw), hadExtraSpace, normalizeSpaces(raw));
}

export function attemptAnswerMC(choice) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  state.run.turnLocked = true;
  state.run.attempts++;
  applyAnswerResult(matchesAnswer(choice), false, choice);
}

// A minigame on the battle screen ended (minigameview.js): settled like an
// answer, at its tier.
function attemptMinigame(result) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  state.run.turnLocked = true;
  state.run.attempts++;
  applyAnswerResult(result.right, false, result.given, result.tier || '2', endMinigame(result));
}

// Whether `given` is the current question's answer, ignoring case and
// extra spaces.
export function matchesAnswer(given) {
  return normalizeSpaces(given).toLowerCase() === normalizeSpaces(state.battle.currentQuestion.meaning).toLowerCase();
}

// Timer modifier on the battle screen: running out counts as a miss,
// through the same path as a wrong answer, if the fight is still waiting.
function answerTimedOut() {
  if (state.battle.battlePhase !== 'answering' || state.run.turnLocked || !state.battle.selectedTarget) return;
  state.run.turnLocked = true;
  state.run.attempts++;
  logLine(t('log.timeout'), 'alert');
  applyAnswerResult(false, false, t('battle.noAnswer'));
}

// What the question panel's input means on the battle screen.
const battleAnswers = {
  onChoice: attemptAnswerMC, onTyped: attemptAnswer, onTimeout: answerTimedOut, onResult: attemptMinigame, log: logLine,
};

// Puts the question panel back on the battle screen (it may have been
// on the ask screen for a reload or a relay).
export function mountBattleQuestion() {
  mountQuestionPanel(battleQuestionSlot, battleAnswers);
}
