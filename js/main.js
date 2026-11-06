import { state, key } from './state.js';
import { buildShipFloor } from './floor.js';
import { loadShipRooms } from './rooms.js';
import { loadSprites } from './sprites.js';
import {
  initGunActions, autoWinGun, endAsk, letterPoolQuestion, sumLockQuestion, openBreaker, openLearning, openBoss,
} from './gunactions.js';
import { initControls, tapMap } from './controls.js';
import {
  MAX_HEARTS, ROOM_LOG_LINES, ROOM_LOG_DIM_MS,
  REALTIME_POLL_MS, TUTORIAL_WHISPER_MS, CHARGER, SHIP_RUN,
} from './config.js';
import { pickQuestion, escapeHtml } from './quiz.js';
import {
  initRender, showScreen, renderHud,
  startTimer, stopTimer, showWhisper, hideWhisper,
  renderShipHud
} from './render.js';
import { freshShipRun } from './ship.js';
import { initShipIntro, fillShipIntro, tragedyLines } from './shipview.js';

import { initSetLoader, showWorkshop } from './setloader.js';
import { initSetPicker, showSetPicker } from './setpicker.js';
import { initPractice } from './practice.js';
import { initDevPanel, recordEvents, refreshInspector } from './devpanel.js';
import { initMapView, requestMapDraw, bumpOnMap, onMapPointer, freeStepOnMap } from './mapview.js';
import { turnWire } from './wires.js';
import { stationMode, stationDone, trainWires } from './stations.js';
import { consoleRoles, startLearning, noteOnDuty, taughtCount } from './roles.js';
import { initConsoleView, showConsole } from './consoleview.js';
import { initChargerView, showCharger, renderCharger, chargerShown } from './chargerview.js';
import { initGunPanels, closeMapPanels, mapPanelShown, askHeld } from './gunpanels.js';
import { t, hasText, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';

import { resetWalk, walkTileMs } from './walk.js';
import { setQuestion } from './questionview.js';
import { initMinimap, refreshMinimap } from './minimapview.js';
import { initSound } from './sound.js';
import { initTextSize } from './textsize.js';
import { showVersion } from './version.js';
import { initSfx } from './sfx.js';
import { initMusic } from './music.js';
import { initBook, bookReading, refreshBook, refreshBookLog } from './bookview.js';

// The ship's furniture from rooms/ship.json (rooms.js), before the ship is
// built; plans.js furniture if it can't be loaded. Its PNGs from
// sprites/sprites.json (sprites.js) at the same time; code art if not.
await Promise.all([loadShipRooms(), loadSprites()]);

// The gun's actions get the main.js actions they call before anything runs.
initGunActions({ applyTurnOutcome, drawEvents, openCharger, showRoomNote });

const startScreen = document.getElementById('startScreen');

const revealToggle = document.getElementById('revealToggle');

const playerNameInput = document.getElementById('playerName');
const roomScreen = document.getElementById('roomScreen');

const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');
const shipIntroScreen = document.getElementById('shipIntroScreen');

const timerEl = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const statsEl = document.getElementById('statsBar');
const turnCountEl = document.getElementById('turnCount');
const coinsTotalEl = document.getElementById('coinsTotal');

const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const roomFeedback = document.getElementById('roomFeedback');
const roomLogEl = document.getElementById('roomLog');
const devPanel = document.getElementById('devPanel');

const winStats = document.getElementById('winStats');
const winTitle = document.getElementById('winTitle');
const loseStats = document.getElementById('loseStats');
const loseTitle = document.getElementById('loseTitle');

initRender({
  startScreen, shipIntroScreen, roomScreen, winScreen, loseScreen,
  heartsEl, coinsTotalEl, turnCountEl, timerEl, statsEl,
  senseNote: document.getElementById('senseNote'),
  shipTaught: document.getElementById('shipTaught'),
  shipPanic: document.getElementById('shipPanic'),
  shipPanicMeter: document.getElementById('shipPanicMeter'),

});
initMapView(document.getElementById('mapCanvas'));
onMapPointer({ tap: tapMap });

initDataView({ backScreen: document.getElementById('workshopScreen') });

// TAKE COMMAND (the ship's opening): onto the ship, and its clock starts.
initShipIntro({ onBegin: () => { showScreen(roomScreen); startTimer(); } });
initConsoleView({ pick: pickRole, leave: () => closeConsole(t('console.left')) });
initGunPanels();
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
  run: [roomScreen],
});
initBook({ askHeld, mapPanelShown });

applyStaticText();

initSetLoader({ showSets: showSetPicker });
initSetPicker({ startGame, openWorkshop: showWorkshop });
initPractice({ letterPoolQuestion, sumLockQuestion });
initDevPanel({
  autoWinGun, openBoss,
});

// A fresh run's numbers: hearts, gold, turns and the ship's.
// startGame() sets them.
function resetRun() {
  state.run.roomIndex = 0;
  state.run.runEnded = false;
  state.run.correctTotal = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.maxHearts = MAX_HEARTS;
  state.run.turnCount = 0;
  state.run.coinsTotal = 0;
  state.run.trained = [];
  state.run.crewFailures = 0;
  state.run.ship = null;
  state.run.lastMinigame = null;
}

function startGame() {
  resetRun();
  state.settings.revealOnWrong = revealToggle.checked;
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
  renderHud();

  requestMapDraw();
  refreshMinimap();

  setQuestion(pickQuestion(null));
  roomFeedback.innerHTML = '';
  // The room the player wakes in announces itself like any other, after
  // the ship's name.
  const startChamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  const startName = state.floor.chamberNames[startChamber];
  if (startName) showRoomNote('move-msg', t('room.enter.plan', { floor: t(state.floor.plan.name), name: t(startName) }));

  answerInput.value = '';
  setControlsEnabled(true);
  answerInput.focus();
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  attackBtn.disabled = !enabled;
  if (enabled) renderHud();
  mcOptionsEl.querySelectorAll('button').forEach(b => b.disabled = !enabled);
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

// A spent turn: the player's events, drawn once, then the room note from
// all of them (or the ship's run ends).
// The world doesn't move on a turn: with One stick (always, on the ship)
// it runs on the clock (worldFrame), and the stick men that once moved
// here went with combat (dungeon removal step C). `worldMoves` is kept
// for the callers that still pass it.
function applyTurnOutcome(events) {
  const turn = [...events];
  const note = drawEvents(turn);
  // The ship's run is over: arrived, the clock out, or the crew broken.
  const shipEnd = turn.find(e => e.type === 'shipEnded');
  if (shipEnd) {
    endShip(shipEnd.how, note);
    return;
  }
  showRoomNote(note.cls, note.text);
}

// The run ended while the ask screen was open: it closes so nothing is
// answered on a lost run.
function closeAskOnRunEnd() {
  if (mapPanelShown()) endAsk();
}

// Whether the real-time clock may run: a run going, the
// room screen up with nothing paused over it. It stops for the ask screen
// (Timothy chose a screen of its own over the pressure of a clock running
// under the question), THE UNFOLDING, the DEV panel, the end screens and a hidden tab. It keeps running under
// CHARGE.SYS: the time is the charger's cost (Timothy 2026-10-26), and
// under the record book read for LOG or MAP.
function clockMayRun() {
  return !state.run.runEnded && !document.hidden &&
    roomScreen.classList.contains('show') && worldRunsUnder() &&
    !devPanel.classList.contains('show');
}

// The record book, open, is kept up to date every REALTIME_POLL_MS.
setInterval(() => { if (bookReading()) refreshBook(); }, REALTIME_POLL_MS);

// Draws a list of rule events, in order, then redraws the HUD, fog, eye
// and targeting once. Returns the room note the events add up to
// ({ cls, text }, text in event order); the caller decides whether to show it.
function drawEvents(events) {
  const parts = [];
  let cls = 'move-msg';
  for (const e of events) {
    switch (e.type) {
      case 'blocked':
        bumpOnMap();
        cls = 'block-msg';
        // A wall says nothing (Timothy 2026-11-01): the bump shows it.
        if (e.kind === 'wall') break;
        if (e.kind === 'furniture') parts.push(t(hasText('furniture.' + e.thing.piece) ? 'furniture.' + e.thing.piece : 'furniture.other'));
        else parts.push(e.kind === 'prop' ? t('room.' + e.thing.kind + '.done') : t('room.blocked.' + e.kind));
        break;
      // A step says nothing: the map already shows where the player went.
      case 'stepped':
        freeStepOnMap(walkTileMs());
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
      case 'turned':
      case 'boxSprung':
      case 'itemReached':
      case 'cellFound':
        break;
      // A line in the kind voice (the charger's and the safe room's).
      case 'whispered':
        showWhisper(t(e.line), e.tone, TUTORIAL_WHISPER_MS);
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
      case 'roomEntered':
        if (e.name) parts.push(t('room.enter.named', { name: t(e.name) }));
        break;
      case 'coverTaken':
        parts.push(t('room.cover'));
        break;
      // A minigame ended (minigames.js endMinigame): how close it came.
      case 'minigameScored': {
        parts.push(t('mg.' + e.minigame + '.scored.' + (e.tier || 'miss'), { name: t('mg.' + e.minigame), answer: e.answer, given: e.given }));
        break;
      }
    }
  }
  renderHud();
  requestMapDraw();
  refreshMinimap();
  recordEvents(events);
  return { cls, text: parts.join(' ') };
}

// The world's frame (one stick plan step C), after the player's frame of
// walking: the ship's HUD keeps up with the crew's panic.
function worldFrame() {
  if (state.run.turnLocked || state.run.runEnded || !clockMayRun()) return;
  if (state.floor.ship) renderShipHud();
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

// The ship station whose CHARGE.SYS is open, or null. View-side.
let openChargerProp = null;
// Closes CHARGE.SYS a moment after a charge (CHARGER.closeMs), so the
// joined-up wires and their line are seen.
let chargerCloseTimer = null;

// CHARGE.SYS opens over the map on a ship station's wires (stations.js
// useStation), named for its mode: training or teaching.
function openCharger(charger) {
  clearTimeout(chargerCloseTimer);
  openChargerProp = charger;
  showCharger(charger.puzzle, stationMode(charger));
}

// A wire turned (a tap, or F / Enter / Space on it): wires.js turnWire.
// Every second turn is a spent turn, the world's as for a step (with Real
// time on, the clock is the cost instead). Once the power joins up,
// CHARGE.SYS closes after CHARGER.closeMs: the role is learned or the
// Engineer taught (stations.js stationDone). A tap on
// an open breaker asks its question instead (gunactions.js openBreaker).
function turnChargerWire(index) {
  const charger = openChargerProp;
  if (!charger || state.run.turnLocked || state.run.runEnded || !chargerShown()) return;
  const wires = charger.puzzle;
  const events = turnWire(charger, index, stationDone);
  if (!events.length) return;
  if (events.some(e => e.type === 'breakerAsked')) {
    openBreaker(charger, index);
    return;
  }
  const charged = events.some(e => ['stationTrained', 'stationTaught'].includes(e.type));
  renderCharger(wires, charged);
  if (events.some(e => e.type === 'shipEnded')) {
    // The last crew member taught: applyTurnOutcome ends the ship's run.
    applyTurnOutcome(events);
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

initControls({
  applyTurnOutcome, clockMayRun, drawEvents, openCharger, openConsole,
  showRoomNote, worldFrame,
});

// The ship's run is over (ship.js shipEnded; ship plan step C): `how` is
// 'arrived' (the win screen) or 'panic' (the lose screen), each
// with its own title and the run's failures, then the crew the
// player taught (crew roles plan step C). Like a lost signal, the room's
// last line shows a moment first.
function endShip(how, note) {
  state.run.runEnded = true;
  closeAskOnRunEnd();
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
// main.js waits for rooms/ship.json and the sprites at the top, so the
// page's load event may already be over by now: register at once then.
if ('serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // Check for a newer service-worker.js right away, since browsers
      // don't always do this on their own before serving cached content.
      reg.update();
    }).catch(() => {
      // Offline support just won't be available; the game still works normally.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);

  // Once a new service worker takes over, reload so the page actually
  // picks up the files it just cached (skipWaiting alone doesn't do this).
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
