import { state, key } from './state.js';
import { buildShipFloor } from './floor.js';
import {
  initBattleScreen, attemptAnswerMC, chooseCategory, clearLog, flashHearts, leaveEncounter, logLine,
  mountBattleQuestion, syncBattleScreen, syncQuestionForTarget,
} from './battlescreen.js';
import {
  initGunActions, askQuestion, autoWinGun, devTestReload, devTestShot, dressQuestion,  endReload,
  letterPoolQuestion, lowerGun, pickReload, readyDial, stopDamageBar, stopStruggleBar,
  sumLockQuestion, openBreaker, openLearning, openBoss,
} from './gunactions.js';
import { initControls, syncLookStick, tapMap, walkHeld } from './controls.js';
import {
  MAX_HEARTS, ROOM_COUNT, ENERGY_START, ROOM_LOG_LINES, ROOM_LOG_DIM_MS,
  REALTIME_POLL_MS, TUTORIAL_WHISPER_MS, CHARGER, ONE_STICK, SHIP_RUN,
} from './config.js';
import { pickQuestion, escapeHtml } from './quiz.js';
import { shuffle } from './random.js';
import {
  initRender, showScreen, renderRoomHints, renderHud, renderCombatStatus, renderTargeting,
  formatTime, startTimer, stopTimer, showSensed, showWhisper, hideWhisper,
  showAnswerLine, fadeAnswerLine, renderShipHud
} from './render.js';
import { freshShipRun } from './ship.js';
import { initShipIntro, fillShipIntro, tragedyLines } from './shipview.js';
import {
  refreshTargetValidity, advanceMonsters, clockFrame,
} from './combat.js';
import { lightConsumed } from './light.js';
import { onStairs, stairsHere } from './moves.js';

import { initSetLoader, showWorkshop } from './setloader.js';
import { initSetPicker, showSetPicker } from './setpicker.js';
import { initPractice } from './practice.js';
import { initDevPanel, recordEvents, refreshInspector, syncDevOneStick } from './devpanel.js';
import { initMapView, requestMapDraw, slideOnMap, slidePlayerOnMap, bumpOnMap, shotOnMap, revealInFlash, hurtOnMap, deathOnMap, downOnMap, crawlOnMap, grabOnMap, finishOnMap, onMapPointer, answerRingOnMap, endAnswerRingOnMap, freeStepOnMap, playerHitOnMap } from './mapview.js';
import { chargerLine, chargeUp } from './charger.js';
import { turnWire } from './wires.js';
import { stationMode, stationDone, trainWires } from './stations.js';
import { consoleRoles, startLearning, noteOnDuty, taughtCount } from './roles.js';
import { initConsoleView, showConsole } from './consoleview.js';
import { shutterLine } from './saferoom.js';
import { initChargerView, showCharger, renderCharger, chargerShown } from './chargerview.js';
import { refreshGunTarget, rollWeaknesses, addRounds } from './gun.js';
import { initGunPanels, showStruggleBar, closeMapPanels, mapPanelShown, askHeld } from './gunpanels.js';
import { t, setTextArea, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';
import { SCREEN_WAYS } from './dpad.js';
import { toggleLight, turnsToFull, secondsToFull } from './battery.js';
import { computeVisibility } from './sight.js';
import { noteSigns, warningAtReach } from './warning.js';

import { resetWalk, walkTileMs } from './walk.js';
import { setQuestion, placeWager } from './questionview.js';
import { playMinigameOut } from './minigameview.js';
import { initMinimap, refreshMinimap } from './minimapview.js';
import { initSound } from './sound.js';
import { initTextSize } from './textsize.js';
import { showVersion } from './version.js';
import { initSfx } from './sfx.js';
import { initMusic } from './music.js';
import { initBook, bookReading, closeBook, refreshBook, refreshBookLog } from './bookview.js';

// The gun's actions get the main.js actions they call before anything runs.
initGunActions({ applyTurnOutcome, drawEvents, goDown, openCharger, showRoomNote });

const startScreen = document.getElementById('startScreen');

const revealToggle = document.getElementById('revealToggle');

const simpleEnemiesToggle = document.getElementById('simpleEnemiesToggle');

const playerNameInput = document.getElementById('playerName');
const roomScreen = document.getElementById('roomScreen');
const battleScreen = document.getElementById('battleScreen');

const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');
const shipIntroScreen = document.getElementById('shipIntroScreen');

const roomNumEl = document.getElementById('roomNum');
const roomTotalEl = document.getElementById('roomTotal');
const roomOfEl = document.getElementById('roomOf');
const combatStatusEl = document.getElementById('combatStatus');
const timerEl = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const statsEl = document.getElementById('statsBar');
const turnCountEl = document.getElementById('turnCount');
const coinsTotalEl = document.getElementById('coinsTotal');

const choiceListEl = document.getElementById('choiceList');
const targetLabelEl = document.getElementById('targetLabel');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const wagerRow = document.getElementById('wagerRow');
const continueBtn = document.getElementById('continueBtn');
const roomFeedback = document.getElementById('roomFeedback');
const roomLogEl = document.getElementById('roomLog');
const devPanel = document.getElementById('devPanel');

const winStats = document.getElementById('winStats');
const winTitle = document.getElementById('winTitle');
const loseStats = document.getElementById('loseStats');
const loseTitle = document.getElementById('loseTitle');
const lightHintEls = {
  n: document.getElementById('lightHintN'),
  s: document.getElementById('lightHintS'),
  e: document.getElementById('lightHintE'),
  w: document.getElementById('lightHintW'),
};

// The d-pad's arrows by where they point on screen (dpad.js SCREEN_WAYS),
// and its centre.
const dpadButtons = {
  ...Object.fromEntries(Object.keys(SCREEN_WAYS).map(way => [way, document.getElementById('btn' + way)])),
  Skip: document.getElementById('btnSkip'),
};
const btnSelect = document.getElementById('btnSelect');

initRender({
  startScreen, shipIntroScreen, roomScreen, battleScreen, winScreen, loseScreen,
  heartsEl, coinsTotalEl, turnCountEl, roomNumEl, roomOfEl, roomTotalEl, timerEl, combatStatusEl, targetLabelEl, attackBtn, statsEl,
  lightHintEls, dpadButtons,
  senseNote: document.getElementById('senseNote'),
  answerNote: document.getElementById('answerNote'),
  shipTaught: document.getElementById('shipTaught'),
  shipPanic: document.getElementById('shipPanic'),
  shipPanicMeter: document.getElementById('shipPanicMeter'),
  energyStat: document.getElementById('energyStat'),
  gunTargetStat: document.getElementById('gunTargetStat'),
  energyCount: document.getElementById('energyCount'),
  lightBattery: document.getElementById('lightBattery'),
  hudTube: document.getElementById('hudTube'),
  hudTubeWord: document.getElementById('hudTubeWord'),
  gunTarget: document.getElementById('gunTarget'),

  keysStat: document.getElementById('keysStat'),
  keysText: document.getElementById('keysText'),

  btnSelect,
});
initMapView(document.getElementById('mapCanvas'));
onMapPointer({ tap: tapMap });

initDataView({ backScreen: document.getElementById('workshopScreen') });

// TAKE COMMAND (the ship's opening): onto the ship, and its clock starts.
initShipIntro({ onBegin: () => { showScreen(roomScreen); startTimer(); } });
initConsoleView({ pick: pickRole, leave: () => closeConsole(t('console.left')) });
initGunPanels({ pickReload, cancelReload: () => endReload(), readyBar: readyDial, backBar: lowerGun, stopBar: stopDamageBar, stopStruggle: stopStruggleBar });
// LEAVE says what the player stepped back from: the charger, or a ship
// station (its term: the console or the board).
initChargerView({
  turnWire: turnChargerWire,
  leave: () => closeCharger('move-msg', t('room.charger.left', { thing: t('term.' + (openChargerProp ? openChargerProp.kind : 'charger')) })),
});
initMinimap();
// The top bar's SOUND button sets the volume of every sound in the game.
initSound(document.getElementById('soundBtn'), document.getElementById('soundMenu'));
initTextSize(document.getElementById('textSizeBtn'), document.getElementById('textSizeMenu'));
showVersion(document.getElementById('gameVersion'));
initSfx();
// The music: the ship's opening tune on its screen, and the safe room's
// tune while the player is in the safe room on the run's screens.
initMusic({
  intro: shipIntroScreen,
  run: [roomScreen, battleScreen],
});
initBook({ askHeld, mapPanelShown });

applyStaticText();

initSetLoader({ showSets: showSetPicker });
initSetPicker({ startGame, openWorkshop: showWorkshop });
initPractice({ letterPoolQuestion, sumLockQuestion, mountBattleQuestion });
initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, playMinigameOut, leaveEncounter, devTestShot, devTestReload, 
  autoWinGun, battleScreen, wagerRow,
});

// Switches the light on or off (battery.js toggleLight; V, the LIGHT
// button). No turn, so
// the real-time clock doesn't matter. Locked after running empty, it stays
// off and says how long until it is full.
function switchLight() {
  if (!roomScreen.classList.contains('show') || mapPanelShown() || state.run.turnLocked || state.run.runEnded) return;
  const result = toggleLight();
  if (!result) return;
  if (result === 'locked' && state.floor.light.steady) {
    showRoomNote('block-msg', t('tut.light.none'));
    return;
  }
  if (result === 'locked') {
    showRoomNote('block-msg', state.settings.oneStick ? t('room.ownLight.locked.seconds', { seconds: secondsToFull() }) : t('room.ownLight.locked', { turns: turnsToFull() }));
    return;
  }
  computeVisibility();
  const note = drawEvents([{ type: 'lightSwitched', on: result === 'on' }, ...refreshGunTarget()]);
  showRoomNote(note.cls, note.text);
}
// The LIGHT button under the map (light button prototype, Timothy
// 2026-10-27: 3 taps on a stick, the way before, were too much in a tense
// moment).
document.getElementById('lightBattery').addEventListener('click', () => switchLight());

// A fresh run's numbers: the questions, hearts, energy (`energy` of it),
// gold, turns and story. startGame() sets them.
function resetRun(energy = ENERGY_START) {
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
  state.run.nextPath = null;
  state.run.turnCount = 0;
  state.run.coinsTotal = 0;
  state.run.energy = 0;
  state.run.rounds = [];
  addRounds(energy);
  state.run.reloadIndex = 0;
  state.run.chargerTold = false;
  state.run.shutterTold = false;
  state.run.trained = [];
  state.run.crewFailures = 0;
  state.run.ship = null;
  state.run.lastMinigame = null;
  rollWeaknesses();
  state.run.loreQueue = [];
}

function startGame() {
  resetRun();
  state.settings.revealOnWrong = revealToggle.checked;
  // Always One stick: free walking on the ship (the dungeon's Turns and
  // Real time options went with it).
  state.settings.oneStick = true;
  state.settings.realTime = false;
  syncDevOneStick();
  // Comfort mode is a dungeon option, shown only under ?dev: a player's
  // old saved pick, hidden now, must not change the ship.
  state.settings.simpleEnemies = simpleEnemiesToggle.checked && !simpleEnemiesToggle.closest('label').hidden;
  resetWalk();
  // Read on every start, so a retry keeps the name without asking again.
  state.settings.playerName = playerNameInput.value.trim();
  // Every run is multiple choice. The typing path (answerForm,
  // attemptAnswer, TYPING_SAMPLE_DATA) is parked, not deleted: it becomes a
  // per-question "type it in" modifier once question modifiers are designed.
  state.settings.mcMode = true;
  answerForm.style.display = state.settings.mcMode ? 'none' : 'flex';
  mcOptionsEl.classList.toggle('show', state.settings.mcMode);
  renderHud();

  // The ship, the game (Timothy 2026-11-01): its random tragedy told first
  // (shipview.js; step C), then the ship once the player takes command.
  // The ship is built now, behind the opening, so there is no wait after it.
  freshShipRun();
  noteOnDuty();
  loadRoom();
  fillShipIntro(tragedyLines(state.run.ship.tragedy), state.settings.playerName);
  showScreen(shipIntroScreen);
}

// The ship, new: make its data, then put it on the page.
function loadRoom() {
  buildShipFloor();
  hideWhisper();
  drawFloor();
  refreshInspector();
}

// Puts the floor buildShipFloor() made on the page: the map, hints, HUD,
// and a fresh room screen.
function drawFloor() {
  resetWalk();
  fadeAnswerLine(true);
  refreshGunTarget();
  renderHud();
  // Per-room wording overrides (text.js AREAS) apply from here on.
  setTextArea(state.run.roomIndex + 1);
  applyStaticText();

  renderRoomHints();
  syncLookStick();
  renderTargeting();
  requestMapDraw();
  refreshMinimap();
  syncBattleScreen(); // nothing's adjacent at spawn — makes sure we're back on the room screen

  setQuestion(pickQuestion(null));
  renderCombatStatus();
  clearLog();
  roomFeedback.innerHTML = '';
  // The room the player wakes in announces itself like any other, after
  // the ship's name.
  const startChamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  const startName = state.floor.chamberNames[startChamber];
  if (startName) {
    showRoomNote('move-msg', t('room.enter.plan', { floor: t(state.floor.plan.name), name: t(startName) }));
  } else if (startChamber !== undefined) {
    showRoomNote('move-msg', t('theme.' + state.floor.chamberThemes[startChamber] + '.enter'));
  }

  answerInput.value = '';
  setControlsEnabled(true);
  answerInput.focus();
}

// The dev skip button (and the stairs, goDown). The ship has no way on:
// it lays the ship out again.
function advanceRoom() {
  loadRoom();
}

// Going down the stairs, once the player says so (SELECT or Enter while
// standing on them). Costs no turn. The ship has no stairs.
function goDown() {
  if (state.run.turnLocked || state.run.runEnded || mapPanelShown() || !onStairs()) return;
  state.run.nextPath = stairsHere().path || null;
  advanceRoom();
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  attackBtn.disabled = !enabled;
  Object.values(dpadButtons).forEach(b => b.disabled = !enabled);
  // SELECT also depends on the run, which renderHud knows.
  if (enabled) renderHud();
  else btnSelect.disabled = true;
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
  // Over the map the newest notes stand out, then dim so the map reads.
  roomLogEl.classList.remove('log-dim');
  clearTimeout(roomLogDimTimer);
  roomLogDimTimer = setTimeout(() => roomLogEl.classList.add('log-dim'), ROOM_LOG_DIM_MS);
  refreshBookLog();
}

// The timer that dims the room log's newest notes. View-only, so not in
// state.
let roomLogDimTimer = null;

// The HUD: a tap (or Enter / Space on it) shows the rest of it, myelin,
// cycle and the goals' names, and hides it again.
function toggleHud() {
  const full = statsEl.classList.toggle('full');
  statsEl.setAttribute('aria-expanded', String(full));
}
statsEl.addEventListener('click', toggleHud);
statsEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  e.stopPropagation();
  toggleHud();
});

// What closes CHARGE.SYS, and the record book read from the map: a stick
// man reaching the player.
const CHARGER_BREAKERS = new Set(['minionStruck', 'struggleStarted', 'ankleGrabbed']);

// A spent turn: the player's events plus the monsters' turn, drawn once,
// then the room note from all of them (or the run ends in the light, or,
// with the gun on, to a minion's strike). With the gun on, its target
// catches up with where everything is now. With Real time on, the
// player's own actions don't move the world (`worldMoves` false): the clock
// does (clockTick), so here only the targets catch up with the player.
function applyTurnOutcome(events, worldMoves = !realTimeOn()) {
  const turn = worldMoves ? events.concat(advanceMonsters({ canStruggle: worldRunsUnder(), minions: !state.settings.oneStick })) : events;
  if (!worldMoves) refreshTargetValidity();
  // A stick man that reaches the player closes CHARGE.SYS before its
  // strike (or Struggle) is drawn; the wires stay as they were.
  if (chargerShown() && turn.some(e => CHARGER_BREAKERS.has(e.type))) {
    closeCharger();
    turn.push({ type: 'chargerBroken' });
  }
  if (bookReading() && turn.some(e => CHARGER_BREAKERS.has(e.type))) closeBook();
  turn.push(...chargerLine());
  turn.push(...shutterLine(turn));
  turn.push(...refreshGunTarget());
  const note = drawEvents(turn);
  if (lightConsumed()) {
    loseToLight();
    return;
  }
  // The ship's run is over: arrived, the clock out, or the crew broken.
  const shipEnd = turn.find(e => e.type === 'shipEnded');
  if (shipEnd) {
    endShip(shipEnd.how, note);
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
  // A reload or relay open on the ask screen keeps its question as it is.
  if (!mapPanelShown()) syncQuestionForTarget();
  syncBattleScreen();
  showRoomNote(note.cls, note.text);
}

// The run ended while a gun panel was open (a minion's strike after a
// Struggle, say): the panels close so nothing is answered on a lost run.
function closeReloadOnRunEnd() {
  if (mapPanelShown()) endReload();
}

// Whether the world runs on the real-time clock: Real time on, or One
// stick (one stick plan: free walking is real time).
function realTimeOn() {
  return state.settings.realTime || state.settings.oneStick;
}

// Whether the real-time clock may run: Real time on, a run going, the
// room screen up with nothing paused over it. It stops for the ask screen
// (a reload or a relay: Timothy chose a screen of its own over the
// pressure of a clock running under the question), the dial (the
// shot's timing is the player's), the battle screen, THE UNFOLDING, the
// DEV panel, the end screens and a hidden tab. It keeps running under
// CHARGE.SYS: the time is the charger's cost (Timothy 2026-10-26), and
// under the record book read for LOG or MAP.
function clockMayRun() {
  return realTimeOn() && !state.run.runEnded && !document.hidden &&
    roomScreen.classList.contains('show') && worldRunsUnder() &&
    !devPanel.classList.contains('show');
}

// The record book, open, is kept up to date every REALTIME_POLL_MS.
setInterval(() => { if (bookReading()) refreshBook(); }, REALTIME_POLL_MS);

// Draws a list of rule events, in order, then redraws the HUD, fog, eye
// and targeting once. Returns the room note the events add up to
// ({ cls, text }, text in event order); the caller decides whether to show it.
// The events that mean the player moved: they put the answer (line or ring) away.
const PLAYER_MOVES = new Set(['stepped', 'waited', 'bodyTurned', 'blocked', 'propSearched', 'minionFinished', 'heldFast']);

function drawEvents(events) {
  const parts = [];
  let cls = 'move-msg';
  // The player's own move (a step, a turn, a wait, a bump) puts away the
  // answer a miss left on the map (answer swirl). The world's turn alone
  // (Real time) and looking around with the light don't.
  if (events.some(e => PLAYER_MOVES.has(e.type))) {
    fadeAnswerLine();
    endAnswerRingOnMap();
  }
  for (const e of events) {
    switch (e.type) {
      case 'blocked':
        bumpOnMap(state.floor.facing);
        cls = 'block-msg';
        // A wall says nothing (Timothy 2026-11-01): the bump shows it.
        if (e.kind === 'wall') break;
        if (e.kind === 'furniture') parts.push(t('furniture.' + e.thing.piece));
        else parts.push(e.kind === 'prop' ? t('room.' + e.thing.kind + '.done') : t('room.blocked.' + e.kind));
        break;
      // A step says nothing: the map already shows where the player went.
      case 'stepped':
        if (e.free) freeStepOnMap(walkTileMs());
        else slidePlayerOnMap(e.facing);
        break;
      case 'waited':
        parts.push(t('room.wait'));
        break;
      case 'sneakSwitched':
        parts.push(t(e.on ? 'room.sneak.on' : 'room.sneak.off'));
        break;
      // A bump that turned the body says only what it bumped.
      case 'bodyTurned':
        if (!e.bumped) parts.push(t('room.turn'));
        break;
      // On the map itself, not in the room log: a whisper, not a report.
      case 'presenceSensed':
        showSensed();
        break;
      case 'stairsReached':
        if (e.hidden) parts.push(t('room.stairs.hidden'));
        else if (e.path) parts.push(t('room.stairs.path', { path: t('path.' + e.path) }));
        parts.push(t('room.stairs.ask'));
        break;
      case 'turned':
      case 'boxSprung':
      case 'itemReached':
      case 'cellFound':
        break;
      // A line in the kind voice (the charger's and the safe room's).
      case 'whispered':
        showWhisper(t(e.line), e.tone, TUTORIAL_WHISPER_MS);
        break;
      case 'propSearched':
        break;
      case 'deskHealed':
        parts.push(t('room.desk.healed'));
        break;
      case 'deskUntouched':
        parts.push(t('room.desk.full'));
        break;
      case 'chargerFull':
        parts.push(t('room.charger.full'));
        break;
      // The safe room (saferoom.js): the shutters, the lamp, and what waits
      // outside. Several shut out at once are said once.
      case 'shutterDown':
        parts.push(t('room.shutter.down'));
        break;
      case 'shutterUp':
        parts.push(t('room.shutter.up'));
        break;
      case 'shutterBlocked':
        parts.push(t('room.shutter.blocked'));
        cls = 'block-msg';
        break;
      case 'shutterWaited':
        if (!parts.includes(t('room.shutter.waits'))) parts.push(t('room.shutter.waits'));
        break;
      case 'shutterGaveUp':
        if (!parts.includes(t('room.shutter.gone'))) parts.push(t('room.shutter.gone'));
        break;
      case 'shutterLifting':
        parts.push(t('room.shutter.hunter'));
        cls = 'warn-msg';
        break;
      case 'shutterLifted':
        parts.push(t('room.shutter.lifted'));
        cls = 'warn-msg';
        break;
      case 'lightSwitchedForLamp':
        parts.push(t('room.lamp.ownOff'));
        break;
      case 'lampWentOut':
        logLine(t('room.lamp.out'), 'alert');
        break;
      case 'chargerOpened':
        parts.push(t(e.kept ? 'room.charger.kept' : 'room.charger.loose'));
        break;
      case 'charged':
        parts.push(t(e.light ? 'room.charger.doneLight' : 'room.charger.done'));
        break;
      case 'chargerBroken':
        parts.push(t('room.charger.found'));
        cls = 'warn-msg';
        break;
      // The ship's stations (stations.js; ship plan step B).
      case 'crewSpoke':
        // Taught, or not on the player's crew (step G2), reads the same for
        // the Engineer as for anyone.
        if (e.taught || e.notCrew) parts.push(t(e.taught ? 'crew.taught' : 'crew.notCrew', { role: t('role.' + e.role) }));
        else if (e.role === 'engineer') parts.push(t('crew.' + e.role + (e.trained ? '.ready' : '.waiting')));
        else parts.push(t(e.sitsOut ? 'crew.sitsOut' : 'crew.waiting', { role: t('role.' + e.role) }));
        break;
      // The crew roles' jobs (roles.js; crew roles plan).
      case 'jobStarted':
        parts.push(t('job.started', { role: t('role.' + e.role) }));
        break;
      case 'roundRight':
        parts.push(t('job.right', { round: e.round, of: e.of }));
        break;
      case 'roundMissed':
        parts.push(t('job.missed', { round: e.round, of: e.of }));
        cls = 'warn-msg';
        break;
      case 'roleHelped':
        parts.push(t('job.helped.' + e.benefit, { role: t('role.' + e.role) }));
        renderShipHud();
        break;
      case 'jobWentBadly':
        parts.push(t('job.badly', { role: t('role.' + e.role) }));
        cls = 'warn-msg';
        break;
      case 'panicShielded':
        parts.push(t('ship.panicShielded'));
        break;
      // Learning a role at the console (roles.js; crew roles plan step B).
      case 'consoleOpened':
        parts.push(t('console.opened'));
        break;
      case 'learningStarted':
        parts.push(t('learn.started', { role: t('role.' + e.role) }));
        break;
      case 'learningStopped':
        parts.push(t('learn.stopped'));
        break;
      case 'learnMissed':
        parts.push(t('learn.missed', { round: e.round, of: e.of }));
        break;
      case 'roleLearned':
        parts.push(t(e.shaky ? 'learn.shaky' : 'learn.done', { role: t('role.' + e.role) }));
        break;
      case 'stationLocked':
        parts.push(t('station.locked'));
        break;
      case 'stationOpened':
        parts.push(t(e.kept ? 'room.charger.kept' : 'station.opened.' + e.mode));
        break;
      case 'breakerClosed':
        parts.push(t('station.breaker.closed'));
        break;
      case 'breakerSparked':
        parts.push(t(e.teach ? 'station.breaker.failed' : 'station.breaker.free'));
        if (e.teach) cls = 'warn-msg';
        break;
      case 'stationTrained':
        parts.push(t('station.trained.' + e.role));
        break;
      // The player's last crew member taught (step G3): the final boss
      // opens once this turn's screens have closed.
      case 'bossReady':
        parts.push(t('boss.ready'));
        setTimeout(() => openBoss(), SHIP_RUN.endDelayMs);
        break;
      case 'stationTaught':
        parts.push(t('station.taught', { role: t('role.' + e.role) }));
        break;
      // The ship's run (ship.js; ship plan step C).
      case 'panicRose':
        parts.push(t('ship.panicRose', { level: t('panic.' + e.level).toLowerCase() }));
        cls = 'warn-msg';
        renderShipHud();
        break;
      case 'panicEased':
        parts.push(t('ship.panicEased', { level: t('panic.' + e.level).toLowerCase() }));
        renderShipHud();
        break;
      case 'keyTaken':
        parts.push(t('room.key', { held: e.held, total: e.total }));
        if (e.unsealed) parts.push(t('room.gate.unsealed'));
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
        // On a fixed plan the room's own name says where you are; a random
        // theme line ("A crypt.") would argue with it.
        parts.push(e.name ? t('room.enter.named', { name: t(e.name) }) : t('theme.' + e.theme + '.enter'));
        break;
      case 'boxOpened':
        parts.push(e.gold ? t('room.box.gold', { gold: e.gold }) : t('room.box.junk'));
        break;
      case 'hunterWoke':
        parts.push(t('room.hunter.wakes'));
        cls = 'warn-msg';
        break;
      // The player's light (battery.js).
      case 'lightSwitched':
        parts.push(t(e.on ? 'room.ownLight.on' : 'room.ownLight.off'));
        break;
      case 'lightDied':
        parts.push(t('room.ownLight.died'));
        cls = 'warn-msg';
        break;
      case 'lightCharged':
        parts.push(t('room.ownLight.charged'));
        break;
      // A downed one crawls (downed plan step B).
      case 'minionMoved':
        if (e.minion.downed) crawlOnMap(e.minion, e.from);
        else slideOnMap(e.minion, e.from, e.ms);
        break;
      // One stick: the stick man's reach is its tell (it stands, near);
      // only a miss is said.
      case 'reachStarted':
        if (state.settings.warningTimer) parts.push(warningNote(e.minion));
        break;
      case 'reachBroken':
        break;
      case 'coverTaken':
        parts.push(t('room.cover'));
        break;
      case 'reachMissed':
        parts.push(t('room.reach.missed'));
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
        logLine(t(e.cost ? 'log.rejected' : 'log.rejected.free', { cost: e.cost }), 'alert');
        if (state.settings.revealOnWrong) {
          // A short answer circles over what asked it; a long one (or the
          // comfort version) is the line across the top of the map.
          if (answerRingOnMap(e.expected, e.at, e.boss)) fadeAnswerLine(true);
          else {
            endAnswerRingOnMap();
            showAnswerLine(e.expected);
          }
          logLine(t('log.expected', { answer: e.expected }), 'sys');
          if (e.source) logLine(t('log.source', { source: e.source }), 'sys');
        }
        break;
      case 'wagerSettled':
        logLine(t(e.won ? 'log.wager.won' : 'log.wager.lost', { n: e.n }), e.won ? 'bright' : 'alert');
        break;
      case 'signalLost':
        playerHitOnMap(true);
        logLine(t('log.signalLost'), 'alert');
        break;
      case 'bossHit':
        logLine(t('log.boss.integrity', { hp: e.hp, max: e.max }));
        break;
      case 'bossHeld':
        logLine(t('log.boss.holds'));
        break;
      case 'gateSealed':
        logLine(t('log.gate.sealed', { turns: e.turns }), 'alert');
        break;
      case 'gateOpened':
        logLine(t('log.gate.opened'), 'bright');
        break;
      case 'gateReached':
        break;
      case 'bossDefeated':
        logLine(t('log.boss.cleared'), 'bright');
        break;
      case 'darknessFell':
        logLine(t('log.darkness'), 'alert');
        break;
      case 'targetSpent':
        if (!e.right) {
          logLine(t('log.' + e.target.kind + '.trapped'));
        }
        break;
      case 'goldGained':
        if (e.from === 'kill') { parts.push(t('gun.killed', { gold: e.amount })); break; }
        if (e.from === 'takedown') { parts.push(t('room.takedown.killed', { gold: e.amount })); break; }
        logLine(t(e.from === 'chest' ? 'log.chest.opened' : 'log.box.gold', { gold: e.amount }), 'bright');
        break;
      // The gun (gun plan): room notes, and the map's effects. A landed
      // shot flies once the dial stops.
      case 'fireBlocked':
      case 'targetBlocked':
        cls = 'block-msg';
        parts.push(t('gun.block.' + e.reason));
        break;
      // The dial (kill or maim plan): BACK before READY, then what a
      // stopped dial did.
      case 'shotCancelled':
        parts.push(t('gun.lowered'));
        break;
      // Steady aim: the stick man left the aim, or the arm tired.
      case 'steadyLost':
        parts.push(t('gun.steady.lost'));
        break;
      case 'steadyDropped':
        cls = 'warn-msg';
        parts.push(t('gun.steady.dropped'));
        break;
      case 'shotMissed':
        shotOnMap(e.minion, false);
        if (e.dark) revealInFlash(e.minion);
        hurtOnMap(e.minion, false);
        parts.push(t('gun.missed'));
        break;
      case 'shotJammed':
        cls = 'warn-msg';
        shotOnMap(e.minion || e.end, true);
        parts.push(t(e.energyLost ? 'gun.shotJammed' : 'gun.shotJammedEmpty'));
        break;
      case 'shotLoud':
        cls = 'warn-msg';
        shotOnMap(e.minion || e.end, true);
        parts.push(t('gun.shotLoud'));
        break;
      case 'shotLunged':
        cls = 'warn-msg';
        shotOnMap(e.minion, true);
        if (e.dark) revealInFlash(e.minion);
        parts.push(t('gun.shotLunged'));
        break;
      // A shot in the dark with nothing there (light battery plan step C).
      case 'shotIntoDark':
        shotOnMap(e.end, false);
        parts.push(t('gun.dark.nothing'));
        break;
      case 'minionHit':
        shotOnMap(e.minion, false);
        // In the dark, the shot's flash shows it for a moment.
        if (e.dark) revealInFlash(e.minion);
        hurtOnMap(e.minion, true);
        if (e.matched) parts.push(t('gun.matched'));
        if (e.tier === 'kill' && !e.minion.downed && !state.floor.minions.includes(e.minion)) parts.push(t('gun.cleanKill'));
        break;
      case 'guardBroken':
        parts.push(t('gun.guardBroken'));
        break;
      case 'minionReels':
        parts.push(t('gun.stunned'));
        break;
      // Downed stick men (downed plan): it falls, crawls, grabs, and a bump
      // finishes it (its death, minionKilled next, comes apart into letters).
      case 'minionDowned':
        downOnMap(e.minion);
        parts.push(t('gun.downed'));
        break;
      case 'minionFinished':
        finishOnMap(e.minion);
        parts.push(t('gun.finished'));
        break;
      case 'ankleGrabbed':
        grabOnMap(e.minion);
        cls = 'warn-msg';
        parts.push(t('gun.grabbed'));
        break;
      case 'heldFast':
        bumpOnMap(state.floor.facing);
        cls = 'block-msg';
        parts.push(t('gun.heldFast'));
        break;
      case 'weaknessFound':
        parts.push(t('gun.weakFound', { kind: t('minionKind.' + e.minionKind), group: e.label }));
        break;
      case 'minionKilled':
        deathOnMap(e.minion);
        break;
      case 'hunterStaggered':
        shotOnMap(e.hunter, false);
        parts.push(t('gun.hunterStaggered'));
        break;
      case 'minionStruck':
        playerHitOnMap(false);
        flashHearts();
        cls = 'warn-msg';
        parts.push(t(e.minion.kind === 'hunter' ? 'gun.hunterStruck' : 'gun.struck', { cost: e.cost }));
        break;
      case 'knockedBack':
        slideOnMap(e.minion, e.from);
        break;
      // A minigame ended (minigames.js endMinigame): how close it came.
      case 'minigameScored': {
        const line = t('mg.' + e.minigame + '.scored.' + (e.tier || 'miss'), { name: t('mg.' + e.minigame), answer: e.answer, given: e.given });
        logLine(line, e.tier ? 'bright' : 'alert');
        parts.push(line);
        break;
      }
      case 'reloaded':
        parts.push(t('gun.reloaded', { energy: e.energy }));
        break;
      case 'jammed':
        cls = 'block-msg';
        if (state.settings.revealOnWrong) showAnswerLine(e.expected);
        parts.push(t('gun.jammed'));
        break;
      // No energy and a minion on the player: the Struggle dial opens over
      // the map at READY. Moving, waiting and the real-time clock all hold
      // until SELECT starts it and stops it (readyDial, stopStruggleBar).
      case 'struggleStarted':
        cls = 'warn-msg';
        parts.push(t('gun.struggle.start'));
        showStruggleBar(e);
        break;
      case 'struggleWon':
        parts.push(t('gun.struggle.won'));
        break;
      case 'struggleLost':
        cls = 'warn-msg';
        parts.push(t('gun.struggle.lost'));
        break;
    }
  }
  renderHud();
  renderCombatStatus();
  renderRoomHints();
  syncLookStick();
  renderTargeting();
  requestMapDraw();
  refreshMinimap();
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

// DEV -> Warning timer's room log line for stick man m's reach: how long
// before it he first gave himself away, and by what (warning.js).
function warningNote(m) {
  const { kind, ms } = warningAtReach(m, performance.now());
  if (!kind) return t('room.dev.warning.none');
  return t('room.dev.warning', { s: (ms / 1000).toFixed(1), kind: t('room.dev.warning.' + kind) });
}

// The world's frame with One stick on (combat.js clockFrame, one stick
// plan steps C and D), after the player's frame of walking: the battery
// runs by time and the stick men walk on their own clocks. What they did
// is drawn like the world's turn in real time (applyTurnOutcome, the
// world not moved again), so a strike can still end the run. The HUD's
// battery is redrawn whenever a # of it is spent or back.
function worldFrame(dt) {
  if (state.run.turnLocked || state.run.runEnded || !clockMayRun()) return;
  const cells = Math.ceil(state.floor.light.charge);
  const frameMs = Math.min(dt, ONE_STICK.frameMs);
  const events = clockFrame(frameMs, { canStruggle: worldRunsUnder() });
  if (state.floor.ship) renderShipHud();
  if (state.settings.warningTimer) noteSigns(performance.now());
  if (Math.ceil(state.floor.light.charge) !== cells) renderHud();
  if (!events.length) return;
  state.run.turnLocked = true;
  applyTurnOutcome(events, false);
  state.run.turnLocked = false;
}

// Whether the world may go on with a panel up: none, CHARGE.SYS (it sits
// over the map, and Timothy 2026-10-26: with Real time on the running clock
// is its cost), COMMAND.SYS (the ship's console: choosing costs time too),
// or the record book read from the map for LOG or MAP
// (record book plan open call 1: reading costs time, as it did over the
// map).
function worldRunsUnder() {
  const shown = mapPanelShown();
  return !shown || shown === 'charger' || shown === 'console' || shown === 'book';
}

// The charger whose CHARGE.SYS is open, or null. View-side, like reloadBox.
let openChargerProp = null;
// Closes CHARGE.SYS a moment after a charge (CHARGER.closeMs), so the
// joined-up wires and their line are seen.
let chargerCloseTimer = null;

// CHARGE.SYS opens over the map on the charger's wires (charger.js
// useCharger already made them, or kept them as they were left). A ship
// station's wires (stations.js useStation) open the same panel, named for
// its mode: training or teaching.
function openCharger(charger) {
  clearTimeout(chargerCloseTimer);
  openChargerProp = charger;
  showCharger(charger.puzzle, realTimeOn(), charger.kind === 'charger' ? null : stationMode(charger));
}

// A wire turned (a tap, or F / Enter / Space on it): wires.js turnWire.
// Every second turn is a spent turn, the world's as for a step (with Real
// time on, the clock is the cost instead). Once the power joins up, energy
// is full and CHARGE.SYS closes after CHARGER.closeMs; on a ship station
// the role is learned or the Engineer taught (stations.js stationDone). A tap on
// an open breaker asks its question instead (gunactions.js openBreaker).
function turnChargerWire(index) {
  const charger = openChargerProp;
  if (!charger || state.run.turnLocked || state.run.runEnded || !chargerShown()) return;
  const wires = charger.puzzle;
  const events = turnWire(charger, index, charger.kind === 'charger' ? chargeUp : stationDone);
  if (!events.length) return;
  if (events.some(e => e.type === 'breakerAsked')) {
    openBreaker(charger, index);
    return;
  }
  const charged = events.some(e => ['charged', 'stationTrained', 'stationTaught'].includes(e.type));
  renderCharger(wires, charged);
  if (events.some(e => e.type === 'turnSpent') && !realTimeOn()) {
    state.run.turnLocked = true;
    applyTurnOutcome(events);
    state.run.turnLocked = false;
  } else if (events.some(e => e.type === 'shipEnded')) {
    // The last crew member taught: applyTurnOutcome ends the ship's run.
    applyTurnOutcome(events, false);
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
  }
  if (charged && chargerShown()) chargerCloseTimer = setTimeout(() => closeCharger(), CHARGER.closeMs);
}

// Closes CHARGE.SYS (the wires stay on the charger as they were), with a
// room note if one is given.
// The ship's console whose COMMAND.SYS is open, or null. View-side, like
// openChargerProp.
let openConsoleProp = null;

// COMMAND.SYS opens over the map on the roles to learn (crew roles plan
// step B; roles.js consoleRoles).
function openConsole(station) {
  openConsoleProp = station;
  showConsole(consoleRoles());
}

// Closes COMMAND.SYS, with a room note if one is given.
function closeConsole(text) {
  openConsoleProp = null;
  closeMapPanels();
  if (text) showRoomNote('move-msg', text);
}

// A role picked on COMMAND.SYS: the Engineer's training wires open
// (stations.js trainWires); any other role's learning rounds start on the
// ask screen (roles.js startLearning, gunactions.js openLearning).
function pickRole(role) {
  const station = openConsoleProp;
  if (!station || state.run.turnLocked || state.run.runEnded) return;
  closeConsole();
  const events = role === 'engineer' ? trainWires(station) : startLearning(role);
  const note = drawEvents(events);
  if (note.text) showRoomNote(note.cls, note.text);
  if (events.some(e => e.type === 'stationOpened')) openCharger(station);
  if (events.some(e => e.type === 'learningStarted')) openLearning(role, () => openConsole(station));
}

function closeCharger(cls, text) {
  clearTimeout(chargerCloseTimer);
  openChargerProp = null;
  closeMapPanels();
  if (text) showRoomNote(cls, text);
}

function skipTurn() {
  if (state.run.turnLocked || state.run.runEnded || walkHeld()) return;
  state.run.turnLocked = true;
  applyTurnOutcome([{ type: 'waited' }]);
  state.run.turnLocked = false;
}

initBattleScreen({ drawEvents, askQuestion, dressQuestion, endLose, loseToLight, setControlsEnabled });
initControls({
  applyTurnOutcome, clockMayRun, drawEvents, goDown, openCharger, openConsole,
  realTimeOn, showRoomNote, skipTurn, switchLight, worldFrame,
});

// `reason` is 'light' when the boss light consumed the floor; anything else
// (running out of hearts) keeps the usual title.
function endLose(reason) {
  loseTitle.textContent = t(reason === 'light' ? 'end.lose.light.title' : 'end.lose.title');
  loseStats.textContent = t('end.lose.stats', {
    room: state.run.roomIndex + 1, rooms: state.run.order.length, time: formatTime(state.run.seconds),
    turns: state.run.turnCount, coins: state.run.coinsTotal,
  });
  showScreen(loseScreen);
}

// The ship's run is over (ship.js shipEnded; ship plan step C): `how` is
// 'arrived' (the win screen) or 'panic' (the lose screen), each
// with its own title and the run's failures, then the crew the
// player taught (crew roles plan step C). Like a lost signal, the room's
// last line shows a moment first.
function endShip(how, note) {
  state.run.runEnded = true;
  closeReloadOnRunEnd();
  closeCharger();
  showRoomNote(how === 'arrived' ? note.cls : 'warn-msg', note.text);
  setControlsEnabled(false);
  stopTimer();
  const ship = state.run.ship;
  const vars = {
    ship: t('tragedy.ship.' + ship.tragedy.ship), planet: t('tragedy.planet.' + ship.tragedy.planet),
    failures: state.run.crewFailures,
  };
  const crew = taughtCount();
  const names = ship.taught.map(role => t('role.' + role)).join(', ');
  const crewLine = crew.taught ? t('end.ship.crew', { names, taught: crew.taught, of: crew.of }) : t('end.ship.noCrew');
  setTimeout(() => {
    const won = how === 'arrived';
    (won ? winTitle : loseTitle).textContent = t('end.ship.' + how + '.title');
    (won ? winStats : loseStats).textContent = t('end.ship.' + how + '.stats', vars) + ' ' + crewLine;
    showScreen(won ? winScreen : loseScreen);
  }, SHIP_RUN.endDelayMs);
}

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
