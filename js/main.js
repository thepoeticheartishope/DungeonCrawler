import { state, key } from './state.js';
import { buildFloor, buildRestFloor } from './floor.js';
import { nextFloor } from './run.js';
import {
  MAX_HEARTS, ROOM_COUNT, BOSS_HP, GUN_START_ROUNDS, GUN_CHAMBER,
  BATTLE_CHOICE_COUNT,
  TIMER_SECONDS, ROOM_LOG_LINES, REALTIME_POLL_MS, REALTIME_WALK_MS
} from './config.js';
import { rollModifier, rollCategoryModifiers, maxWager } from './modifiers.js';
import { resetHaunts, pickHaunt } from './haunts.js';
import {
  shuffle, pickQuestion, escapeHtml,
  normalizeSpaces, buildHint, poolFor, fightChoiceLabel,
  buildCategoryChoices, categoryLabel
} from './quiz.js';
import {
  initRender, showScreen, renderRoomHints, renderHud, renderCombatStatus, renderTargeting,
  formatTime, startTimer, stopTimer, renderLightEye, renderClock
} from './render.js';
import {
  isAdjacentToPlayer, refreshTargetValidity, advanceMonsters
} from './combat.js';
import { lightConsumed } from './light.js';
import { stepPlayer } from './moves.js';
import { settleAnswer } from './answers.js';
import { initSetLoader } from './setloader.js';
import { initDevPanel, recordEvents, refreshInspector } from './devpanel.js';
import { initMapView, requestMapDraw, slideOnMap, slidePlayerOnMap, bumpOnMap, shotOnMap, hurtOnMap, limbOffOnMap, deathOnMap, onMapTap, glyphOf } from './mapview.js';
import { pickTarget, refreshGunTarget, cycleTarget, fire, settleShot, reloadCategory, reloadOffers, settleReload } from './gun.js';
import { initGunPanels, showReloadPanel, showQuestionOnMap, showDamageBar, closeMapPanels, mapPanelShown } from './gunpanels.js';
import { t, setTextArea, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';
import { initDpad } from './dpad.js';
import { buy } from './exchange.js';
import { initExchangeView, renderExchange } from './exchangeview.js';
import { pollClock, resetClock } from './realclock.js';
import { mountQuestionPanel, setQuestion, retypeQuestion, clearModifier, applyModifier, placeWager } from './questionview.js';

const startScreen = document.getElementById('startScreen');
const introGlitch = document.getElementById('introGlitch');
const glitchCode = document.getElementById('glitchCode');
const revealToggle = document.getElementById('revealToggle');
const realTimeToggle = document.getElementById('realTimeToggle');
const playerNameInput = document.getElementById('playerName');
const roomScreen = document.getElementById('roomScreen');
const battleScreen = document.getElementById('battleScreen');
const exchangeScreen = document.getElementById('exchangeScreen');
const battleGlyphEl = document.getElementById('battleGlyph');
const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');

const roomNumEl = document.getElementById('roomNum');
const roomTotalEl = document.getElementById('roomTotal');
const roomOfEl = document.getElementById('roomOf');
const combatStatusEl = document.getElementById('combatStatus');
const timerEl = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const statsEl = document.getElementById('statsBar');
const turnCountEl = document.getElementById('turnCount');
const coinsTotalEl = document.getElementById('coinsTotal');

const choicePanel = document.getElementById('choicePanel');
const choiceListEl = document.getElementById('choiceList');
const queryPanel = document.getElementById('queryPanel');
const battleQuestionSlot = document.getElementById('battleQuestionSlot');
const targetLabelEl = document.getElementById('targetLabel');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const wagerRow = document.getElementById('wagerRow');
const encounterLogEl = document.getElementById('encounterLog');
const endPanel = document.getElementById('endPanel');
const continueBtn = document.getElementById('continueBtn');
const roomFeedback = document.getElementById('roomFeedback');
const devPanel = document.getElementById('devPanel');

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
const btnReload = document.getElementById('btnReload');
const btnFire = document.getElementById('btnFire');

initRender({
  startScreen, introGlitch, roomScreen, battleScreen, exchangeScreen, winScreen, loseScreen,
  heartsEl, coinsTotalEl, turnCountEl, roomNumEl, roomOfEl, roomTotalEl, timerEl, combatStatusEl, targetLabelEl, attackBtn, statsEl,
  lightEyeEl, lightHintEls, dpadButtons,
  gunRoundsStat: document.getElementById('gunRoundsStat'),
  gunTargetStat: document.getElementById('gunTargetStat'),
  gunAimStat: document.getElementById('gunAimStat'),
  gunRounds: document.getElementById('gunRounds'),
  gunTarget: document.getElementById('gunTarget'),
  gunAim: document.getElementById('gunAim'),
  gunActions: document.getElementById('gunActions'),
  clockStat: document.getElementById('clockStat'),
  clockFill: document.getElementById('clockFill'),
  btnReload, btnFire,
});
initMapView(document.getElementById('mapCanvas'));
onMapTap(tapMap);

initDataView({ startScreen });
initExchangeView({ buyItem, leaveExchange });
initGunPanels({ pickReload, cancelReload: () => endReload(), stopBar: stopDamageBar });

applyStaticText();

initSetLoader();
initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, leaveEncounter, devTestShot, devTestReload, endGunTests,
  gunCombatChanged, autoWinGun, battleScreen, wagerRow,
});

// A tap on the map. With the gun on (DEV -> Combat), it picks the gun's
// target: the minion on that tile, or none. Costs no turn. Tapping the
// target again fires at it.
function tapMap(tile) {
  if (!gunReady()) return;
  const target = state.floor.gunTarget;
  if (target && target.row === tile.row && target.col === tile.col) { fireGun(); return; }
  drawEvents(pickTarget(tile));
}

// Whether the gun can be used right now: gun combat on, the room screen
// up with no gun panel over it, and no turn in progress.
function gunReady() {
  return state.settings.gunCombat && !state.run.turnLocked && !state.run.runEnded &&
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

// FIRE (button, F, or tapping the target again): shoots the gun's target
// (gun.js fire). A blocked shot only says why and costs nothing; a miss,
// or a landed shot on the hunter, is the turn; a landed shot on a minion
// opens the damage bar first, and the turn is spent when it stops.
function fireGun() {
  if (!gunReady()) return;
  const events = fire(state.floor.gunTarget);
  if (events.some(e => e.type === 'fireBlocked')) {
    const note = drawEvents(events);
    showRoomNote(note.cls, note.text);
    return;
  }
  gunTest = false;
  state.run.turnLocked = true;
  if (state.battle.aim) {
    drawEvents(events);
    showDamageBar(state.battle.aim);
    return;
  }
  applyTurnOutcome(events);
  state.run.turnLocked = false;
}

// T: the gun's next target in reach. Costs no turn.
function nextGunTarget() {
  if (!gunReady()) return;
  const note = drawEvents(cycleTarget());
  if (note.text) showRoomNote(note.cls, note.text);
}

// RELOAD (button or R): the reload panel over the map (gun.js
// reloadOffers). Picking an offer asks its question; the answer is the
// turn. Cancelling costs nothing.
function reloadGun() {
  if (!gunReady()) return;
  openReload(false);
}

// Opens the reload panel, or says why not (a full chamber).
function openReload(test) {
  const offered = reloadOffers();
  if (offered.block) { showRoomNote('block-msg', t('gun.block.' + offered.block)); return; }
  gunTest = test;
  state.run.turnLocked = true;
  showReloadPanel(offered);
}

// DEV -> Test shot: fires at the gun's target through the real rules
// (gun.js), without spending a turn: minions don't move and the light
// doesn't spread. Fills an empty chamber first.
function devTestShot() {
  if (!gunReady()) return;
  if (state.run.ammo <= 0) state.run.ammo = GUN_CHAMBER;
  const target = state.floor.minions.includes(state.floor.gunTarget) ? state.floor.gunTarget : null;
  const note = drawEvents(fire(target));
  if (note.text) showRoomNote(note.cls, note.text);
  if (!state.battle.aim) return;
  gunTest = true;
  state.run.turnLocked = true;
  showDamageBar(state.battle.aim);
}

// The player stopped the damage bar at `barPosition`: the shot's damage.
function stopDamageBar(barPosition) {
  closeMapPanels();
  finishGunAction(settleShot(barPosition));
  state.run.turnLocked = false;
}

// DEV -> Test reload: the real reload through the panels over the map,
// without spending a turn, like Test shot.
function devTestReload() {
  if (!gunReady()) return;
  openReload(true);
}

// What the question panel's input means over the map, for the reload
// that's open (set by pickReload; DEV -> Auto-win answers through it).
let mapAnswers = null;

// A reload offer was picked: its question, with its modifiers, over the
// map. Any answer (or the Timer running out) settles the reload.
function pickReload(offer, category) {
  const settle = (isCorrect) => endReload(() => settleReload(isCorrect, offer));
  mapAnswers = {
    onChoice: choice => settle(matchesAnswer(choice)),
    onTyped: raw => { if (raw.trim()) settle(matchesAnswer(raw)); },
    onTimeout: () => settle(false),
    log: text => showRoomNote('', text),
  };
  showQuestionOnMap(mapAnswers);
  setQuestion(pickQuestion(state.battle.currentQuestion, category.pool));
  offer.modifiers.forEach(applyModifier);
}

// Closes the gun's panels, hands the question panel back to the battle
// screen and frees the turn; `settle` (if given) is the rule that ends it.
function endReload(settle) {
  clearModifier();
  closeMapPanels();
  mountBattleQuestion();
  mapAnswers = null;
  if (settle) finishGunAction(settle());
  state.run.turnLocked = false;
}

// DEV -> Combat back to classic: close whatever gun panel is open, and
// drop a shot waiting for the damage bar.
function endGunTests() {
  if (!mapPanelShown()) return;
  endReload();
}

// DEV -> Combat switched: the gun's target and the HUD catch up.
function gunCombatChanged() {
  drawEvents(state.settings.gunCombat ? refreshGunTarget() : []);
}

// DEV -> Auto-win, with a gun panel open: picks the first reload, answers
// its question right, and stops the damage bar on the weak point.
// Walking, reloading and firing stay the player's.
function autoWinGun() {
  const shown = mapPanelShown();
  if (shown === 'reload') pickReload(reloadOffers().offers[0], reloadCategory());
  else if (shown === 'question' && mapAnswers) mapAnswers.onChoice(state.battle.currentQuestion.meaning);
  else if (shown === 'aim') stopDamageBar(0.5);
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
  if (!isCorrect) flashHearts();
}

// The stability count flashes when it drops: a miss, or a minion's strike.
function flashHearts() {
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
    retypeQuestion();
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
  state.run.resting = true; // every run opens on a rest floor
  state.run.runEnded = false;
  state.run.attempts = 0;
  state.run.correctTotal = 0;
  state.run.extraSpaceCount = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.maxHearts = MAX_HEARTS;
  state.run.bonusSlack = 0;
  state.run.turnCount = 0;
  state.run.coinsTotal = 0;
  state.run.ammo = GUN_START_ROUNDS;
  state.run.reloadIndex = 0;
  state.run.loreQueue = [];
  resetHaunts();
  state.settings.revealOnWrong = revealToggle.checked;
  state.settings.realTime = realTimeToggle.checked;
  resetClock();
  // Read on every start, so a retry keeps the name without asking again.
  state.settings.playerName = playerNameInput.value.trim();
  // Every run is multiple choice. The typing path (answerForm,
  // attemptAnswer, TYPING_SAMPLE_DATA) is parked, not deleted: it becomes a
  // per-question "type it in" modifier once question modifiers are designed.
  state.settings.mcMode = true;
  answerForm.style.display = state.settings.mcMode ? 'none' : 'flex';
  mcOptionsEl.classList.toggle('show', state.settings.mcMode);
  renderHud();

  // Room setup happens immediately (invisibly, behind the glitch screen) so
  // there's no added real loading time — only a deliberate dramatic pause
  // before the player actually sees the room. The elapsed-time clock starts
  // once that pause ends, not before, so it isn't charged against the player.
  loadRoom('opening');
  glitchCode.textContent = randomGlitchCode();
  showScreen(introGlitch);
  setTimeout(() => {
    showScreen(roomScreen);
    startTimer();
  }, INTRO_GLITCH_DURATION_MS);
}

// A new floor: make the new floor's data, then put it on the page.
// `restKind` ('opening' / 'between' / 'epilogue') builds a rest floor;
// none builds the danger floor at the current depth.
function loadRoom(restKind) {
  if (restKind) buildRestFloor(restKind);
  else buildFloor();
  drawFloor();
  refreshInspector();
}

// Puts the floor buildFloor() made on the page: the map, hints, HUD, and
// a fresh room screen.
function drawFloor() {
  resetClock();
  if (state.settings.gunCombat) refreshGunTarget();
  renderHud();
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
// run.js decides what comes next: a depth, a rest floor, or the win.
function advanceRoom() {
  const next = nextFloor();
  if (next.kind === 'win') endWin();
  else loadRoom(next.kind === 'rest' ? next.rest : null);
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  attackBtn.disabled = !enabled;
  Object.values(dpadButtons).forEach(b => b.disabled = !enabled);
  // RELOAD and FIRE also depend on the chamber, which renderHud knows.
  if (enabled) renderHud();
  else { btnReload.disabled = true; btnFire.disabled = true; }
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
// then the room note from all of them (or the run ends in the light, or,
// with the gun on, to a minion's strike). With the gun on, its target
// catches up with where everything is now. With Real time on, the
// player's own actions don't move the world (`worldMoves` false): the clock
// does (clockTick), so here only the targets catch up with the player.
function applyTurnOutcome(events, worldMoves = !state.settings.realTime) {
  const turn = worldMoves ? events.concat(advanceMonsters()) : events;
  if (!worldMoves) refreshTargetValidity();
  if (state.settings.gunCombat) turn.push(...refreshGunTarget());
  const note = drawEvents(turn);
  if (lightConsumed()) {
    loseToLight();
    return;
  }
  if (turn.some(e => e.type === 'signalLost')) {
    state.run.runEnded = true;
    closeReloadOnRunEnd();
    showRoomNote('warn-msg', note.text);
    setControlsEnabled(false);
    stopTimer();
    setTimeout(endLose, 900);
    return;
  }
  // A reload's question may be open over the map while the clock moves
  // the world: it stays as it is.
  if (!mapPanelShown()) syncQuestionForTarget();
  syncBattleScreen();
  showRoomNote(note.cls, note.text);
}

// The run ended while a reload was open over the map (with Real time on,
// the clock can take the last stability or the last light mid-question):
// the panels close so nothing is answered on a lost run.
function closeReloadOnRunEnd() {
  if (mapPanelShown()) endReload();
}

// Whether the real-time clock may run: Real time on, a run going, the
// room screen up with nothing paused over it. It keeps running while a
// reload is picked and answered over the map (that's the pressure); it
// stops for the damage bar (the shot's timing is the player's), the battle
// screen, THE UNFOLDING, the DEV panel, the end screens and a hidden tab.
function clockMayRun() {
  return state.settings.realTime && !state.run.runEnded && !document.hidden &&
    roomScreen.classList.contains('show') && mapPanelShown() !== 'aim' &&
    !devPanel.classList.contains('show');
}

// One poll of the real-time clock; when the world's turn is due, the
// minions, the hunter and the light take it, as after a step in turn mode.
// The HUD's NEXT meter follows each poll.
function clockTick() {
  const running = clockMayRun();
  const due = pollClock(performance.now(), running);
  renderClock(running);
  if (due) applyTurnOutcome([], true);
}
setInterval(clockTick, REALTIME_POLL_MS);

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
      case 'exchangeOpened':
        parts.push(t('room.exchange.opened'));
        break;
      case 'itemBought':
        parts.push(t('exchange.bought'));
        break;
      case 'cannotAfford':
        parts.push(t('exchange.cannotAfford'));
        break;
      case 'notOffered':
        parts.push(t('exchange.why.' + e.reason));
        break;
      case 'hauntSilenced':
        break;
      case 'coinTaken':
        parts.push(t('room.coin'));
        break;
      case 'paperRead':
        if (e.loot === 'story') {
          const story = t(e.story, { name: state.settings.playerName || t('story.nameless'), answered: state.run.correctTotal });
          parts.push(t('room.paper.lore', { lore: story }));
        }
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
        deathOnMap(e.minion);
        logLine(t(e.right ? 'log.minion.cleared' : 'log.minion.disperses'), e.right ? 'bright' : undefined);
        break;
      case 'targetSpent':
        if (!e.right) {
          logLine(t('log.' + e.target.kind + '.trapped', { category: e.category ? categoryLabel(e.category) : '' }));
        }
        break;
      case 'goldGained':
        if (e.from === 'kill') { parts.push(t('gun.killed', { gold: e.amount })); break; }
        logLine(e.from === 'encounter'
          ? t('log.encounter.mastered', { category: e.category ? categoryLabel(e.category) : '', gold: e.amount })
          : t(e.from === 'chest' ? 'log.chest.opened' : 'log.box.gold', { gold: e.amount }), 'bright');
        break;
      // The gun (gun plan): room notes, and the map's effects. A landed
      // shot flies once the damage bar stops.
      case 'fireBlocked':
        cls = 'block-msg';
        parts.push(t('gun.block.' + e.reason));
        break;
      case 'shotMissed':
        shotOnMap(e.target, true);
        parts.push(t('gun.missed'));
        break;
      case 'shotGrazed':
        shotOnMap(e.minion, false);
        parts.push(t('gun.grazed'));
        break;
      case 'minionHurt':
        shotOnMap(e.minion, false);
        hurtOnMap(e.minion);
        parts.push(t(e.weakPoint ? 'gun.weakPoint' : 'gun.hit'));
        break;
      case 'limbLost':
        limbOffOnMap(e.minion);
        parts.push(t('gun.limbLost'));
        break;
      case 'minionKilled':
        deathOnMap(e.minion);
        break;
      case 'hunterStaggered':
        shotOnMap(e.hunter, false);
        parts.push(t('gun.hunterStaggered'));
        break;
      case 'minionStruck':
        flashHearts();
        cls = 'warn-msg';
        parts.push(t(e.minion.kind === 'hunter' ? 'gun.hunterStruck' : 'gun.struck', { cost: e.cost }));
        break;
      case 'knockedBack':
        slideOnMap(e.minion, e.from);
        break;
      case 'reloaded':
        parts.push(t('gun.reloaded', { rounds: e.rounds }));
        break;
      case 'jammed':
        cls = 'block-msg';
        parts.push(t('gun.jammed'));
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
  closeReloadOnRunEnd();
  showRoomNote('warn-msg', t('room.light.consumed'));
  setControlsEnabled(false);
  stopTimer();
  setTimeout(() => endLose('light'), 1400);
}

// When the player last took a step, for Real time's REALTIME_WALK_MS.
// View-side timing, so a module var rather than state.
let lastWalkAt = -Infinity;

// One arrow press (stepPlayer in moves.js). A step or a first look in a
// box spends a turn; stairs load the next floor; a trapped box opens the
// battle screen; a turn to a new direction or a bump only draws. With Real time
// on, a press too soon after the last step is ignored (REALTIME_WALK_MS).
function movePlayer(dRow, dCol) {
  if (state.run.turnLocked || state.run.runEnded) return;
  if (state.settings.realTime && performance.now() - lastWalkAt < REALTIME_WALK_MS) return;
  state.run.turnLocked = true;
  const events = stepPlayer(dRow, dCol);
  const has = (type) => events.some(e => e.type === type);
  if (has('stepped')) lastWalkAt = performance.now();
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
    if (has('exchangeOpened')) openExchange();
  }
  state.run.turnLocked = false;
}

// THE UNFOLDING's screen (exchangeview.js), opened by bumping it on a rest
// floor. The room stays as it was underneath: nothing moves while it's up.
function openExchange() {
  renderExchange('');
  showScreen(exchangeScreen);
}

// One trade at THE UNFOLDING (exchange.js buy()): draws its events (myelin
// and stability in the HUD), then the screen again with what it added up to.
function buyItem(itemId) {
  const note = drawEvents(buy(itemId));
  renderExchange(note.text);
}

// Back to the room from THE UNFOLDING's screen.
function leaveExchange() {
  showScreen(roomScreen);
  showRoomNote('move-msg', t('room.exchange.left'));
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

function attemptAnswerMC(choice) {
  if (state.run.turnLocked || state.battle.battlePhase !== 'answering') return;
  if (!state.battle.selectedTarget || !isAdjacentToPlayer(state.battle.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  state.run.turnLocked = true;
  state.run.attempts++;
  applyAnswerResult(matchesAnswer(choice), false, choice);
}

// Whether `given` is the current question's answer, ignoring case and
// extra spaces.
function matchesAnswer(given) {
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
  onChoice: attemptAnswerMC, onTyped: attemptAnswer, onTimeout: answerTimedOut, log: logLine,
};

// Puts the question panel back on the battle screen (it may have been
// over the map for a reload).
function mountBattleQuestion() {
  mountQuestionPanel(battleQuestionSlot, battleAnswers);
}
mountBattleQuestion();

continueBtn.addEventListener('click', leaveEncounter);
btnReload.addEventListener('click', reloadGun);
btnFire.addEventListener('click', fireGun);

initDpad({
  buttons: dpadButtons, movePlayer, skipTurn,
  canWalk: () => roomScreen.classList.contains('show') && !state.run.runEnded,
});

// Arrow-key support on desktop, ignored while typing in the answer box.
// With the gun on: R reloads, F fires, T picks the next target, . waits.
// Letter and number keys answer a question shown over the map, unless the
// gun panels already used the key (picking a reload with 1-3, or F / Space
// stopping the damage bar).
document.addEventListener('keydown', (e) => {
  if (document.activeElement === answerInput || e.defaultPrevented) return;
  if (!roomScreen.classList.contains('show')) return;
  if (e.key === 'ArrowUp') { e.preventDefault(); movePlayer(-1, 0); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); movePlayer(1, 0); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); movePlayer(0, -1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); movePlayer(0, 1); }
  else if (gunReady() && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); reloadGun(); }
  else if (gunReady() && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); fireGun(); }
  else if (gunReady() && (e.key === 't' || e.key === 'T')) { e.preventDefault(); nextGunTarget(); }
  else if (gunReady() && e.key === '.') { e.preventDefault(); skipTurn(); }
  else if (mapPanelShown() === 'question' && state.settings.mcMode && ['1', '2', '3', '4', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(e.key)) {
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
