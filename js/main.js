import { state, key } from './state.js';
import { buildFloor } from './floor.js';
import {
  MAX_HEARTS, ROOM_COUNT, BOSS_HP,
  BATTLE_CHOICE_COUNT,
  BLIND_BASE_MS, BLIND_MS_PER_WORD, BLIND_MAX_MS, TIMER_SECONDS, ROOM_LOG_LINES
} from './config.js';
import { rollModifier, rollCategoryModifiers, rollFlip, maxWager } from './modifiers.js';
import { resetHaunts, pickHaunt } from './haunts.js';
import {
  shuffle, pickQuestion, escapeHtml,
  buildChoices, normalizeSpaces, buildHint, poolFor, fightChoiceLabel,
  resolveImageSrc, buildCategoryChoices, categoryLabel
} from './quiz.js';
import {
  initRender, showScreen, renderViewShape, renderRoomHints, renderHud, renderCombatStatus, renderTargeting,
  formatTime, startTimer, stopTimer, renderLightEye
} from './render.js';
import {
  isAdjacentToPlayer, refreshTargetValidity, advanceMonsters
} from './combat.js';
import { lightConsumed } from './light.js';
import { stepPlayer } from './moves.js';
import { settleAnswer } from './answers.js';
import { initSetLoader } from './setloader.js';
import { initDevPanel, recordEvents, refreshInspector } from './devpanel.js';
import { initMapView, requestMapDraw, slideOnMap, slidePlayerOnMap, bumpOnMap, glyphOf } from './mapview.js';
import { t, setTextArea, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';
import { initDpad } from './dpad.js';

const startScreen = document.getElementById('startScreen');
const introGlitch = document.getElementById('introGlitch');
const glitchCode = document.getElementById('glitchCode');
const revealToggle = document.getElementById('revealToggle');
const roomScreen = document.getElementById('roomScreen');
const battleScreen = document.getElementById('battleScreen');
const battleGlyphEl = document.getElementById('battleGlyph');
const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');

const roomNumEl = document.getElementById('roomNum');
const roomTotalEl = document.getElementById('roomTotal');
const combatStatusEl = document.getElementById('combatStatus');
const timerEl = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const statsEl = document.getElementById('statsBar');
const turnCountEl = document.getElementById('turnCount');
const coinsTotalEl = document.getElementById('coinsTotal');

const choicePanel = document.getElementById('choicePanel');
const choiceListEl = document.getElementById('choiceList');
const queryPanel = document.getElementById('queryPanel');
const enemyName = document.getElementById('enemyName');
const queryImage = document.getElementById('queryImage');
const targetLabelEl = document.getElementById('targetLabel');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const wagerRow = document.getElementById('wagerRow');
const wagerButtons = document.getElementById('wagerButtons');
const modTimerEl = document.getElementById('modTimer');
const encounterLogEl = document.getElementById('encounterLog');
const endPanel = document.getElementById('endPanel');
const continueBtn = document.getElementById('continueBtn');
const roomFeedback = document.getElementById('roomFeedback');

const winStats = document.getElementById('winStats');
const loseStats = document.getElementById('loseStats');
const loseTitle = document.getElementById('loseTitle');
const lightEyeEl = document.getElementById('lightEye');
const lightHintEls = {
  n: document.getElementById('lightHintN'),
  s: document.getElementById('lightHintS'),
  e: document.getElementById('lightHintE'),
  w: document.getElementById('lightHintW'),
};

const dpadButtons = {
  N: document.getElementById('btnN'),
  S: document.getElementById('btnS'),
  E: document.getElementById('btnE'),
  W: document.getElementById('btnW'),
  Skip: document.getElementById('btnSkip')
};

initRender({
  startScreen, introGlitch, roomScreen, battleScreen, winScreen, loseScreen,
  heartsEl, coinsTotalEl, turnCountEl, timerEl, combatStatusEl, targetLabelEl, attackBtn, statsEl,
  lightEyeEl, lightHintEls, dpadButtons,
  mapWrapEl: document.getElementById('mapWrap'), dpadEl: document.getElementById('dpad'),
});
renderViewShape();
initMapView(document.getElementById('mapCanvas'));

initDataView({ startScreen });

applyStaticText();

initSetLoader();
initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, leaveEncounter,
  battleScreen, wagerRow,
});

function renderChoices() {
  const letters = ['A', 'B', 'C', 'D'];
  mcOptionsEl.innerHTML = '';
  state.battle.currentChoices.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option';
    btn.innerHTML = '<span class="letter">' + letters[i] + '</span><span class="opt-text">' + escapeHtml(opt) + '</span>';
    btn.addEventListener('click', () => attemptAnswerMC(opt));
    mcOptionsEl.appendChild(btn);
  });
}

// Sets the active question, and (in MC mode) its answer choices.
// Types `text` into `el` one character at a time, terminal-style, instead
// of setting it all at once. Cancels any typing already in progress on
// that element first, so rapid-fire question changes (a quick correct
// answer against the boss, say) never leave two runs racing each other.
const typewriterTimers = new WeakMap();
// A fixed per-character delay made short answers ("CPU") finish in ~50ms —
// too fast to read as typing at all. Instead, aim for a roughly constant
// total reveal time and derive the per-character delay from the string's
// length, clamped so short strings type slowly enough to notice and long
// ones don't drag.
function typeText(el, text, targetDurationMs = 450) {
  const speedMs = Math.min(140, Math.max(12, targetDurationMs / Math.max(text.length, 1)));
  const existing = typewriterTimers.get(el);
  if (existing) clearInterval(existing);
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(timer);
      typewriterTimers.delete(el);
    }
  }, speedMs);
  typewriterTimers.set(el, timer);
}

// ---- Question modifiers (see modifiers.js) ----
// A category offered in a fight may carry one; it applies to the question
// asked once that category is picked, and is cleared by the next question.
let blindTimer = null;
let countdownTimer = null;

function clearModifier() {
  clearTimeout(blindTimer);
  blindTimer = null;
  clearInterval(countdownTimer);
  countdownTimer = null;
  modTimerEl.hidden = true;
  modTimerEl.classList.remove('urgent');
  state.battle.wager = 0;
  mcOptionsEl.classList.remove('mod-blind');
  wagerRow.hidden = true;
  wagerButtons.innerHTML = '';
}

function applyModifier(modifier) {
  logLine(t('log.modifier', { name: t('mod.' + modifier) }), 'sys');
  const buttons = [...mcOptionsEl.querySelectorAll('.mc-option')];
  if (modifier === 'blind') {
    // Longer answers stay readable for longer.
    const words = state.battle.currentChoices.reduce((n, opt) => n + opt.trim().split(/\s+/).length, 0);
    const ms = Math.min(BLIND_MAX_MS, BLIND_BASE_MS + BLIND_MS_PER_WORD * words);
    blindTimer = setTimeout(() => mcOptionsEl.classList.add('mod-blind'), ms);
  } else if (modifier === 'flip') {
    const { slots, mode } = rollFlip(buttons.length);
    buttons.forEach((b, i) => { if (slots.has(i)) b.querySelector('.opt-text').classList.add('flip-' + mode); });
  } else if (modifier === 'gambler') {
    // Answers stay locked until a wager of 1..maxWager() is placed.
    buttons.forEach(b => { b.disabled = true; });
    wagerButtons.innerHTML = '';
    for (let n = 1; n <= maxWager(); n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wager-option';
      btn.textContent = String(n);
      btn.addEventListener('click', () => placeWager(n));
      wagerButtons.appendChild(btn);
    }
    wagerRow.hidden = false;
  } else if (modifier === 'timer') {
    startCountdown();
  }
}

// Timer modifier: TIMER_SECONDS to answer. Running out counts as a miss,
// through the same path as a wrong answer.
function startCountdown() {
  let left = TIMER_SECONDS;
  const q = state.battle.currentQuestion;
  const show = () => {
    modTimerEl.textContent = t('battle.timer', { s: left });
    modTimerEl.classList.toggle('urgent', left <= 3);
  };
  show();
  modTimerEl.hidden = false;
  countdownTimer = setInterval(() => {
    left--;
    show();
    if (left > 0) return;
    clearInterval(countdownTimer);
    countdownTimer = null;
    // Only if that same question is still waiting on an answer.
    if (state.battle.currentQuestion !== q || state.battle.battlePhase !== 'answering' || state.run.turnLocked || !state.battle.selectedTarget) return;
    state.run.turnLocked = true;
    state.run.attempts++;
    logLine(t('log.timeout'), 'alert');
    applyAnswerResult(false, false, t('battle.noAnswer'));
  }, 1000);
}

function placeWager(n) {
  if (state.battle.wager || wagerRow.hidden) return;
  state.battle.wager = n;
  wagerRow.hidden = true;
  logLine(t('log.wager', { n }), 'sys');
  mcOptionsEl.querySelectorAll('.mc-option').forEach(b => { b.disabled = false; });
}

function setQuestion(q) {
  clearModifier();
  state.battle.currentQuestion = q;
  typeText(enemyName, q.term);
  answerInput.value = '';
  const imageSrc = resolveImageSrc(q.image);
  if (imageSrc) {
    queryImage.src = imageSrc;
    queryImage.hidden = false;
  } else {
    queryImage.hidden = true;
    queryImage.removeAttribute('src');
  }
  if (state.settings.mcMode) {
    state.battle.currentChoices = buildChoices(q);
    renderChoices();
  }
}

function nextQuestion() {
  setQuestion(pickQuestion(state.battle.currentQuestion, poolFor(state.battle.selectedTarget)));
}

// If the current target changed (a fresh click, or an auto-pick after a
// move/turn) and the showing question isn't from that target's pool — e.g.
// it's a leftover boss/global question but an encounter is now targeted, or
// vice versa — reroll it from the right pool. A no-op the rest of the time.
function syncQuestionForTarget() {
  const pool = poolFor(state.battle.selectedTarget);
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
  if (!isCorrect) {
    heartsEl.classList.remove('hit-flash');
    void heartsEl.offsetWidth;
    heartsEl.classList.add('hit-flash');
  }
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

function logLine(text, kind) {
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

function clearLog() {
  encounterLogEl.innerHTML = '';
}

// Opening lines for a new encounter: what it is and what's at stake.
// Wording is per target kind (boss / minion / chest / rune / encounter)
// under log.start.* and log.rules.* in text.js.
function logEncounterStart(target) {
  clearLog();
  const vars = { queries: BOSS_HP, category: target.category ? categoryLabel(target.category) : '' };
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
    const hinted = state.floor.runeHint && choice.pool.includes(state.floor.runeHint);
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span><span class="choice-label"></span>' +
      (hinted ? '<span class="choice-hint" title="' + escapeHtml(t('battle.runeHintMark')) + '">◊</span>' : '') +
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
// kind of question they face); chests, runes and category encounters are
// puzzles, not fights, and go straight to their question — as does any
// fight whose pool can't offer at least two distinct choices.
function startBattleTurn() {
  const target = state.battle.selectedTarget;
  const isFight = target.kind === 'boss' || target.kind === 'minion' || target.kind === 'hunter';
  state.battle.categoryChoices = isFight
    ? buildCategoryChoices(poolFor(target), BATTLE_CHOICE_COUNT, state.floor.runeHint, state.floor.lastChoiceType)
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
    const haunt = isFight && !state.floor.runeHint ? pickHaunt(poolFor(target), state.battle.currentQuestion) : null;
    // No choice to route the rune's hint through, so ask it directly if
    // this target's pool holds it.
    if (state.floor.runeHint && poolFor(target).includes(state.floor.runeHint)) {
      setQuestion(state.floor.runeHint);
      state.floor.runeHint = null;
    } else if (haunt) {
      logLine(t('log.haunt.returns'), 'alert');
      setQuestion(haunt);
    } else {
      syncQuestionForTarget();
    }
    // The question was very likely set well before this moment, off-screen
    // (loadRoom() sets one at room load), so re-type it fresh every time a
    // turn starts rather than letting the effect be skipped.
    typeText(enemyName, state.battle.currentQuestion.term);
    // A boss question always carries a modifier, even with no category
    // choice to show it on.
    if (target.kind === 'boss') {
      clearModifier();
      applyModifier(rollModifier(target));
    }
    if (!state.settings.mcMode) answerInput.focus();
  }
  showBattlePhase();
}

function chooseCategory(i) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'choosing') return;
  const choice = state.battle.categoryChoices[i];
  if (!choice) return;
  let q;
  let haunt = null;
  if (state.floor.runeHint && choice.pool.includes(state.floor.runeHint)) {
    q = state.floor.runeHint;
    state.floor.runeHint = null;
  } else {
    // A missed question from this category may come back instead.
    haunt = pickHaunt(choice.pool, state.battle.currentQuestion);
    q = haunt || pickQuestion(state.battle.currentQuestion, choice.pool);
  }
  logLine(t('log.vector', { n: i + 1, label: choice.label }), 'sys');
  if (haunt) logLine(t('log.haunt.returns'), 'alert');
  state.floor.lastChoiceType = choice.choiceType || null;
  state.battle.battlePhase = 'answering';
  setQuestion(q);
  choice.modifiers.forEach(applyModifier);
  showBattlePhase();
  if (!state.settings.mcMode) answerInput.focus();
}

function syncBattleScreen() {
  if (state.battle.selectedTarget) {
    const target = state.battle.selectedTarget;
    battleGlyphEl.textContent = glyphOf(target);
    renderCombatStatus();
    const entering = !battleScreen.classList.contains('show');
    if (entering) {
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
function leaveEncounter() {
  if (state.battle.battlePhase !== 'ended') return;
  state.battle.battlePhase = 'answering';
  state.battle.battleTarget = null;
  refreshTargetValidity();
  renderTargeting();
  requestMapDraw();
  nextQuestion();
  syncBattleScreen();
}

const INTRO_GLITCH_DURATION_MS = 2000;
const GLITCH_CHARS = '01{}[]<>/\\;:=+*#$%&^~ABCDEF0123456789';

// Fills the intro glitch screen's backdrop with a block of random
// code-like garbage, tall enough that the CSS scroll animation (which
// moves it by a third of its own height) never runs out of content mid-loop.
function randomGlitchCode() {
  const lines = [];
  for (let i = 0; i < 90; i++) {
    let line = '';
    const len = 40 + Math.floor(Math.random() * 20);
    for (let j = 0; j < len; j++) {
      line += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function startGame() {
  state.run.order = shuffle(state.settings.activeData).slice(0, Math.min(ROOM_COUNT, state.settings.activeData.length));
  state.run.roomIndex = 0;
  state.run.runEnded = false;
  state.run.attempts = 0;
  state.run.extraSpaceCount = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.turnCount = 0;
  state.run.coinsTotal = 0;
  state.run.loreQueue = [];
  resetHaunts();
  state.settings.revealOnWrong = revealToggle.checked;
  // Every run is multiple choice. The typing path (answerForm,
  // attemptAnswer, TYPING_SAMPLE_DATA) is parked, not deleted: it becomes a
  // per-question "type it in" modifier once question modifiers are designed.
  state.settings.mcMode = true;
  answerForm.style.display = state.settings.mcMode ? 'none' : 'flex';
  mcOptionsEl.classList.toggle('show', state.settings.mcMode);
  renderHud();
  roomTotalEl.textContent = state.run.order.length;

  // Room setup happens immediately (invisibly, behind the glitch screen) so
  // there's no added real loading time — only a deliberate dramatic pause
  // before the player actually sees the room. The elapsed-time clock starts
  // once that pause ends, not before, so it isn't charged against the player.
  loadRoom();
  glitchCode.textContent = randomGlitchCode();
  showScreen(introGlitch);
  setTimeout(() => {
    showScreen(roomScreen);
    startTimer();
  }, INTRO_GLITCH_DURATION_MS);
}

// A new floor: make the new floor's data, then put it on the page.
function loadRoom() {
  buildFloor();
  drawFloor();
  refreshInspector();
}

// Puts the floor buildFloor() made on the page: the map, hints, HUD, and
// a fresh room screen.
function drawFloor() {
  roomNumEl.textContent = state.run.roomIndex + 1;
  // Per-room wording overrides (text.js AREAS) apply from here on.
  setTextArea(state.run.roomIndex + 1);
  applyStaticText();

  renderRoomHints();
  renderLightEye();
  renderTargeting();
  requestMapDraw();
  syncBattleScreen(); // nothing's adjacent at spawn — makes sure we're back on the room screen

  setQuestion(pickQuestion(null));
  renderCombatStatus();
  clearLog();
  roomFeedback.innerHTML = '';
  // The room the player wakes in announces itself like any other.
  const startChamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  if (startChamber !== undefined) {
    showRoomNote('move-msg', t('theme.' + state.floor.chamberThemes[startChamber] + '.enter'));
  }
  answerInput.value = '';
  setControlsEnabled(true);
  answerInput.focus();
}

// Shared by the stairs (reaching them mid-move) and the dev skip button.
function advanceRoom() {
  state.run.roomIndex++;
  if (state.run.roomIndex >= state.run.order.length) {
    endWin();
  } else {
    loadRoom();
  }
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  attackBtn.disabled = !enabled;
  Object.values(dpadButtons).forEach(b => b.disabled = !enabled);
  mcOptionsEl.querySelectorAll('button').forEach(b => b.disabled = !enabled);
  choiceListEl.querySelectorAll('button').forEach(b => b.disabled = !enabled);
  continueBtn.disabled = !enabled;
}

// Adds a note to the room log beside the d-pad, newest at the bottom, and
// keeps only the last ROOM_LOG_LINES. The same note twice in a row (walking a
// hallway) counts up on one line instead of pushing the older notes out.
// Escaped, since some wording carries values from custom lists (category names).
function showRoomNote(cls, text) {
  if (!text) return;
  const last = roomFeedback.lastElementChild;
  if (last && last.dataset.text === text) {
    last.dataset.count = String(Number(last.dataset.count) + 1);
    last.innerHTML = escapeHtml(text) + ' <span class="note-count">x' + last.dataset.count + '</span>';
  } else {
    const line = document.createElement('div');
    line.className = 'room-note ' + cls;
    line.dataset.text = text;
    line.dataset.count = '1';
    line.textContent = text;
    roomFeedback.appendChild(line);
    while (roomFeedback.children.length > ROOM_LOG_LINES) roomFeedback.firstChild.remove();
  }
  [...roomFeedback.children].forEach((line, i, all) => line.classList.toggle('note-old', i < all.length - 1));
}

// A spent turn: the player's events plus the monsters' turn, drawn once,
// then the room note from all of them (or the run ends in the light).
function applyTurnOutcome(events) {
  const note = drawEvents(events.concat(advanceMonsters()));
  if (lightConsumed()) {
    loseToLight();
    return;
  }
  syncQuestionForTarget();
  syncBattleScreen();
  showRoomNote(note.cls, note.text);
}

// Draws a list of rule events, in order, then redraws the HUD, fog, eye
// and targeting once. Returns the room note the events add up to
// ({ cls, text }, text in event order); the caller decides whether to show it.
function drawEvents(events) {
  const parts = [];
  let cls = 'move-msg';
  let engaged = false;
  for (const e of events) {
    switch (e.type) {
      case 'blocked':
        bumpOnMap(state.floor.facing);
        cls = 'block-msg';
        parts.push(e.kind === 'prop' ? t('room.' + e.thing.kind + '.done')
          : e.kind === 'encounter' ? t('room.blocked.encounter', { category: categoryLabel(e.thing.category) })
          : t('room.blocked.' + e.kind));
        break;
      // A step says nothing: the map already shows where the player went.
      case 'stepped':
        slidePlayerOnMap(e.facing);
        break;
      case 'waited':
        parts.push(t('room.wait'));
        break;
      case 'turned':
      case 'stairsReached':
      case 'boxSprung':
      case 'propSearched':
        break;
      case 'coinTaken':
        parts.push(t('room.coin'));
        break;
      case 'paperRead':
        if (e.loot === 'story') parts.push(t('room.paper.lore', { lore: t(e.story) }));
        else if (e.loot === 'lore') parts.push(t('room.paper.lore', { lore: t('theme.' + e.paper.theme + '.lore') }));
        else parts.push(t('room.paper.junk'));
        break;
      case 'roomEntered':
        parts.push(t('theme.' + e.theme + '.enter'));
        break;
      case 'boxOpened':
        parts.push(e.gold ? t('room.box.gold', { gold: e.gold }) : t('room.box.junk'));
        break;
      case 'hunterWoke':
        parts.push(t('room.hunter.wakes'));
        cls = 'warn-msg';
        break;
      case 'minionMoved':
        slideOnMap(e.minion, e.from);
        break;
      case 'minionEngaged':
        if (!engaged) parts.push(t('room.engage'));
        engaged = true;
        cls = 'warn-msg';
        break;
      // Answer events (answers.js): one encounter log line each.
      case 'answerGiven':
        logLine(t('log.input', { answer: e.given }));
        break;
      case 'accepted':
        logLine(t('log.accepted'), 'bright');
        break;
      case 'extraSpaces':
        logLine(t('log.extraSpaces'), 'sys');
        break;
      case 'rejected':
        logLine(t('log.rejected', { cost: e.cost }), 'alert');
        if (state.settings.revealOnWrong) {
          logLine(t('log.expected', { answer: e.expected }), 'sys');
          if (e.source) logLine(t('log.source', { source: e.source }), 'sys');
        }
        break;
      case 'hauntSilenced':
        logLine(t('log.haunt.silenced'), 'bright');
        break;
      case 'hauntLingers':
        logLine(t('log.haunt.lingers'));
        break;
      case 'wagerSettled':
        logLine(t(e.won ? 'log.wager.won' : 'log.wager.lost', { n: e.n }), e.won ? 'bright' : 'alert');
        break;
      case 'signalLost':
        logLine(t('log.signalLost'), 'alert');
        break;
      case 'bossHit':
        logLine(t('log.boss.integrity', { hp: e.hp, max: e.max }));
        break;
      case 'bossHeld':
        logLine(t('log.boss.holds'));
        break;
      case 'bossDefeated':
        logLine(t('log.boss.cleared'), 'bright');
        break;
      case 'darknessFell':
        logLine(t('log.darkness'), 'alert');
        break;
      case 'hunterRepelled':
        logLine(t(e.right ? 'log.hunter.repelled' : 'log.hunter.retreats'), e.right ? 'bright' : undefined);
        break;
      case 'minionCleared':
        logLine(t(e.right ? 'log.minion.cleared' : 'log.minion.disperses'), e.right ? 'bright' : undefined);
        break;
      case 'targetSpent':
        if (!e.right) {
          logLine(t('log.' + e.target.kind + '.trapped', { category: e.category ? categoryLabel(e.category) : '' }));
        }
        break;
      case 'goldGained':
        logLine(e.from === 'encounter'
          ? t('log.encounter.mastered', { category: e.category ? categoryLabel(e.category) : '', gold: e.amount })
          : t(e.from === 'chest' ? 'log.chest.opened' : 'log.box.gold', { gold: e.amount }), 'bright');
        break;
      case 'runeDecoded': {
        const hint = buildHint(e.question);
        const choiceLabel = fightChoiceLabel(e.question, state.settings.activeData, BATTLE_CHOICE_COUNT);
        logLine(choiceLabel
          ? t('log.rune.decoded', { category: choiceLabel, hint })
          : t('log.rune.decodedUncategorized', { hint }), 'bright');
        break;
      }
    }
  }
  renderHud();
  renderCombatStatus();
  renderRoomHints();
  renderLightEye();
  renderTargeting();
  requestMapDraw();
  recordEvents(events);
  return { cls, text: parts.join(' ') };
}

// The floor's turns have run out and the boss light has won: the run
// ends where the player stands, after a beat to see it.
function loseToLight() {
  state.run.runEnded = true;
  showRoomNote('warn-msg', t('room.light.consumed'));
  setControlsEnabled(false);
  stopTimer();
  setTimeout(() => endLose('light'), 1400);
}

// One arrow press (stepPlayer in moves.js). A step or a first look in a
// box spends a turn; stairs load the next floor; a trapped box opens the
// battle screen; a bump or a turn toward a wall only draws.
function movePlayer(dRow, dCol) {
  if (state.run.turnLocked || state.run.runEnded) return;
  state.run.turnLocked = true;
  const events = stepPlayer(dRow, dCol);
  const has = (type) => events.some(e => e.type === type);
  if (has('stairsReached')) {
    drawEvents(events);
    state.run.turnLocked = false;
    advanceRoom();
    return;
  }
  if (has('stepped') || has('propSearched')) {
    applyTurnOutcome(events);
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
    if (has('boxSprung')) syncBattleScreen();
  }
  state.run.turnLocked = false;
}

function skipTurn() {
  if (state.run.turnLocked || state.run.runEnded) return;
  state.run.turnLocked = true;
  applyTurnOutcome([{ type: 'waited' }]);
  state.run.turnLocked = false;
}

// Shared outcome handler for both typed answers and multiple-choice taps.
// Assumes the caller already confirmed adjacency, set turnLocked = true,
// and counted the attempt. `given` is the player's answer, echoed to the log.
// settleAnswer (answers.js) changes state; this draws its events and picks
// what comes next: the run ends at 0 hearts, a boss fight goes on to its
// next question, anything else is settled.
function applyAnswerResult(isCorrect, hadExtraSpace, given) {
  const events = settleAnswer(isCorrect, hadExtraSpace, given);
  const has = (type) => events.some(e => e.type === type);
  drawEvents(events);
  flashBattleResult(isCorrect);
  if (has('signalLost')) {
    setControlsEnabled(false);
    stopTimer();
    setTimeout(endLose, 900);
  } else if (has('bossHit') || has('bossHeld')) {
    nextQuestion();
    startBattleTurn();
  } else {
    endEncounter();
  }
  state.run.turnLocked = false;
}

function attemptAnswer() {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  const raw = answerInput.value;
  if (!raw.trim()) return;

  state.run.turnLocked = true;
  state.run.attempts++;
  const hadExtraSpace = raw !== raw.trim() || /\s{2,}/.test(raw);
  const cleanInput = normalizeSpaces(raw).toLowerCase();
  const cleanAnswer = normalizeSpaces(state.battle.currentQuestion.meaning).toLowerCase();
  applyAnswerResult(cleanInput === cleanAnswer, hadExtraSpace, normalizeSpaces(raw));
}

function attemptAnswerMC(choice) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  state.run.turnLocked = true;
  state.run.attempts++;
  const isCorrect = normalizeSpaces(choice).toLowerCase() === normalizeSpaces(state.battle.currentQuestion.meaning).toLowerCase();
  applyAnswerResult(isCorrect, false, choice);
}

attackBtn.addEventListener('click', attemptAnswer);
continueBtn.addEventListener('click', leaveEncounter);

answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptAnswer();
  }
});

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  attemptAnswer();
});

initDpad({
  buttons: dpadButtons, movePlayer, skipTurn,
  canWalk: () => roomScreen.classList.contains('show') && !state.run.runEnded,
});

// Arrow-key support on desktop, ignored while typing in the answer box.
document.addEventListener('keydown', (e) => {
  if (document.activeElement === answerInput) return;
  if (!roomScreen.classList.contains('show')) return;
  if (e.key === 'ArrowUp') { e.preventDefault(); movePlayer(-1, 0); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); movePlayer(1, 0); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); movePlayer(0, -1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); movePlayer(0, 1); }
  else if (state.settings.mcMode && ['1', '2', '3', '4', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(e.key)) {
    const idxMap = { 1: 0, a: 0, 2: 1, b: 1, 3: 2, c: 2, 4: 3, d: 3 };
    const idx = idxMap[e.key.toLowerCase()];
    const btn = mcOptionsEl.children[idx];
    if (btn && !btn.disabled) btn.click();
  }
});

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

function endWin() {
  stopTimer();
  let msg = t('end.win.stats', {
    bosses: state.run.order.length, time: formatTime(state.run.seconds), turns: state.run.turnCount,
    attempts: state.run.attempts, hearts: state.run.hearts, coins: state.run.coinsTotal,
  });
  if (state.run.extraSpaceCount > 0) {
    msg += ' ' + t('end.win.spacing', { count: state.run.extraSpaceCount });
  }
  winStats.textContent = msg + hauntStats();
  showScreen(winScreen);
}

// " Doubts silenced: X of Y." for the end screens, or nothing if the
// player never missed.
function hauntStats() {
  if (!state.run.hauntsTotal) return '';
  return ' ' + t('end.haunts', { silenced: state.run.hauntsSilenced, total: state.run.hauntsTotal });
}

// `reason` is 'light' when the boss light consumed the floor; anything else
// (running out of hearts) keeps the usual title.
function endLose(reason) {
  loseTitle.textContent = t(reason === 'light' ? 'end.lose.light.title' : 'end.lose.title');
  loseStats.textContent = t('end.lose.stats', {
    room: state.run.roomIndex + 1, rooms: state.run.order.length, time: formatTime(state.run.seconds),
    turns: state.run.turnCount, coins: state.run.coinsTotal,
  }) + hauntStats();
  showScreen(loseScreen);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);

// PWA: register the service worker so the game caches for offline use.
// Runs only over HTTPS (or localhost) — browsers block service workers
// on plain http:// or file:// for security reasons.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // Check for a newer service-worker.js right away, since browsers
      // don't always do this on their own before serving cached content.
      reg.update();
    }).catch(() => {
      // Offline support just won't be available; the game still works normally.
    });
  });

  // Once a new service worker takes over, reload so the page actually
  // picks up the files it just cached (skipWaiting alone doesn't do this).
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
