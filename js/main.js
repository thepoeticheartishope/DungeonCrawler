import { state, key } from './state.js';
import { buildFloor, buildRestFloor, buildTutorialFloor } from './floor.js';
import { tutorialTurn, tutorialDial, settleName, breakRing } from './tutorial.js';
import { nextFloor } from './run.js';
import {
  MAX_HEARTS, ROOM_COUNT, ENERGY_START, ENERGY_MAX, TUTORIAL_EXIT_ENERGY,
  BATTLE_CHOICE_COUNT,
  TIMER_SECONDS, ROOM_LOG_LINES, ROOM_LOG_DIM_MS, REALTIME_POLL_MS, REALTIME_WALK_MS, LETTER_POOL_FORM,
  LOOK_POINTER_DEAD, LOOK_STICK_KNOB_PX, LOOK_UP_STICK,
  LOOK_SWEEP_SPEED, GAZE_POLL_MS, GAZE_STEP_MS, TUTORIAL_WHISPER_MS,
  TUTORIAL_KIND_DELAY_MS, TUTORIAL_COMFORT_BREAK_MS, TUTORIAL_STUCK_MS, MAP_ANIMATION_MS, CHARGER,
  ONE_STICK,
} from './config.js';
import { rollCategoryModifiers, maxWager } from './modifiers.js';
import { resetHaunts, pickHaunt } from './haunts.js';
import {
  shuffle, pickQuestion, escapeHtml,
  normalizeSpaces,
  buildCategoryChoices, buildChoices
} from './quiz.js';
import {
  initRender, showScreen, renderRoomHints, renderHud, renderCombatStatus, renderTargeting,
  formatTime, startTimer, stopTimer, renderClock, showSensed, showWhisper,
  showAnswerLine, fadeAnswerLine
} from './render.js';
import {
  isAdjacentToPlayer, refreshTargetValidity, advanceMonsters, clockFrame
} from './combat.js';
import { lightConsumed } from './light.js';
import { openGateFree } from './gate.js';
import { stepPlayer, onStairs, stairsHere } from './moves.js';
import { scoreGoals } from './goals.js';
import { settleRelay } from './relays.js';
import { playIntro } from './introview.js';
import { settleAnswer } from './answers.js';
import { initSetLoader, showWorkshop } from './setloader.js';
import { initSetPicker, showSetPicker } from './setpicker.js';
import { initPractice } from './practice.js';
import { initDevPanel, recordEvents, refreshInspector, syncDevOneStick } from './devpanel.js';
import { initMapView, requestMapDraw, slideOnMap, slidePlayerOnMap, bumpOnMap, shotOnMap, revealInFlash, hurtOnMap, deathOnMap, downOnMap, crawlOnMap, grabOnMap, finishOnMap, onMapPointer, glyphOf, answerRingOnMap, endAnswerRingOnMap, soundOnMap, heardOnMap, rattleOnMap, freeStepOnMap, playerHitOnMap } from './mapview.js';
import { turnWire, chargerLine } from './charger.js';
import { shutterLine } from './saferoom.js';
import { initChargerView, showCharger, renderCharger, chargerShown } from './chargerview.js';
import { pickTarget, refreshGunTarget, cycleTarget, fire, readyShot, cancelShot, settleShot, startSteady, steadying, tickSteady, releaseSteady, cancelSteady, holdSteady, reloadCategory, reloadOffers, settleReload, readyStruggle, settleStruggle, rollWeaknesses, addRounds } from './gun.js';
import { initGunPanels, showReloadPanel, showQuestionScreen, showDamageBar, runDamageBar, showStruggleBar, runStruggleBar, closeMapPanels, fadeDial, mapPanelShown, pressBar, turnAskPage, holdAskScreen, askHeld, closeHeldAsk } from './gunpanels.js';
import { t, TEXT, setTextArea, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';
import { initDpad, initLookStick, initWalkStick, SCREEN_WAYS, padWay, sweepHold } from './dpad.js';
import { lookUp } from './roomview.js';
import { repeatMs, noteStep, heldStepReady } from './walkpace.js';
import { aimLook, turnBody, sweepLook, wantsTurn, waysInUse } from './look.js';
import { toggleLight, turnsToFull, secondsToFull, batteryInPlay } from './battery.js';
import { tickGaze } from './gaze.js';
import { computeVisibility, seesEnemy, FACING_VECTORS } from './sight.js';
import { noteSigns, warningAtReach } from './warning.js';
import { buy } from './exchange.js';
import { initExchangeView, renderExchange } from './exchangeview.js';
import { pollClock, resetClock } from './realclock.js';
import { walkFree, freeSpot, resetWalk, switchSneak } from './walk.js';
import { mountQuestionPanel, setQuestion, setMinigame, retypeQuestion, clearModifier, applyModifier, placeWager, markAnswer } from './questionview.js';
import { rollMinigame, forcedQuestion, endMinigame, letterPoolSetup, sumLockSetup } from './minigames.js';
import { playMinigameOut } from './minigameview.js';
import { initMinimap, refreshMinimap } from './minimapview.js';
import { initBook, bookReading, closeBook, refreshBook, refreshBookLog } from './bookview.js';

const startScreen = document.getElementById('startScreen');
const introGlitch = document.getElementById('introGlitch');
const revealToggle = document.getElementById('revealToggle');
const realTimeToggle = document.getElementById('realTimeToggle');
const turnsToggle = document.getElementById('turnsToggle');
const simpleEnemiesToggle = document.getElementById('simpleEnemiesToggle');
const tutorialToggle = document.getElementById('tutorialToggle');
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
const roomLogEl = document.getElementById('roomLog');
const devPanel = document.getElementById('devPanel');

const winStats = document.getElementById('winStats');
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
const lookStick = dpadButtons.Skip; // the d-pad's centre: the look stick (dpad.js initLookStick)
const btnSelect = document.getElementById('btnSelect');

initRender({
  startScreen, introGlitch, roomScreen, battleScreen, exchangeScreen, winScreen, loseScreen,
  heartsEl, coinsTotalEl, turnCountEl, roomNumEl, roomOfEl, roomTotalEl, timerEl, combatStatusEl, targetLabelEl, attackBtn, statsEl,
  lightHintEls, dpadButtons,
  senseNote: document.getElementById('senseNote'),
  answerNote: document.getElementById('answerNote'),
  energyStat: document.getElementById('energyStat'),
  gunTargetStat: document.getElementById('gunTargetStat'),
  energyCount: document.getElementById('energyCount'),
  lightBattery: document.getElementById('lightBattery'),
  hudTube: document.getElementById('hudTube'),
  hudTubeWord: document.getElementById('hudTubeWord'),
  gunTarget: document.getElementById('gunTarget'),
  clockStat: document.getElementById('clockStat'),
  keysStat: document.getElementById('keysStat'),
  keysText: document.getElementById('keysText'),
  goalsStat: document.getElementById('goalsStat'),
  goalsText: document.getElementById('goalsText'),
  goalNames: document.getElementById('goalNames'),
  clockFill: document.getElementById('clockFill'),
  btnSelect,
});
initMapView(document.getElementById('mapCanvas'));
onMapPointer({ tap: tapMap });

initDataView({ backScreen: document.getElementById('workshopScreen') });
initExchangeView({ buyItem, leaveExchange });
initGunPanels({ pickReload, cancelReload: () => endReload(), readyBar: readyDial, backBar: lowerGun, stopBar: stopDamageBar, stopStruggle: stopStruggleBar });
initChargerView({ turnWire: turnChargerWire, leave: () => closeCharger('move-msg', t('room.charger.left')) });
initMinimap();
initBook({ askHeld, mapPanelShown });

applyStaticText();

initSetLoader({ showSets: showSetPicker });
initSetPicker({ startGame, openWorkshop: showWorkshop });
initPractice({ letterPoolQuestion, sumLockQuestion, mountBattleQuestion });
initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, playMinigameOut, leaveEncounter, devTestShot, devTestReload, endGunTests,
  gunCombatChanged, autoWinGun, battleScreen, wagerRow,
});

// A tap on the map. With the gun on (DEV -> Combat), it picks the gun's
// target: the light swings to the minion on that tile and the target
// follows it, or a note says why it can't be shot. Costs no turn. Only SELECT
// fires (Timothy: tap, then SELECT), so a tap can never shoot by accident.
// A mouse click on anything else turns the body when the aim is past the
// free arc (free look plan); a tap on a phone never turns, so a stray tap
// can't spend a turn. A tap off a minion aims the light at the floor
// `point` under it instead,
// keeping the target (a mouse click past the arc then turns, as above).
function tapMap(tile, pointerType, point) {
  const minion = state.floor.minions.some(m => m.row === tile.row && m.col === tile.col);
  if (!minion && point) {
    aimAtPoint(point);
    if (pointerType === 'mouse' && wantsTurn()) turnLook();
    return;
  }
  if (!minion && pointerType === 'mouse' && wantsTurn()) { turnLook(); return; }
  if (!gunReady()) return;
  const note = drawEvents(pickTarget(tile));
  if (note.text) showRoomNote(note.cls, note.text);
}

// Whether the player can aim right now: free look on, the room screen up
// with no panel over it, and no turn in progress. Aiming is free, so the
// real-time clock doesn't matter.
function lookReady() {
  return state.settings.freeLook && roomScreen.classList.contains('show') && !mapPanelShown() &&
    !state.run.turnLocked && !state.run.runEnded;
}

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
  if (result === 'held') {
    showRoomNote('block-msg', t('tut.light.held'));
    return;
  }
  if (result === 'locked') {
    showRoomNote('block-msg', state.settings.oneStick ? t('room.ownLight.locked.seconds', { seconds: secondsToFull() }) : t('room.ownLight.locked', { turns: turnsToFull() }));
    return;
  }
  computeVisibility();
  // In the tutorial's ring, the light on is the way out (tutorial.js breakRing).
  const freed = result === 'on' ? breakRing() : [];
  const note = drawEvents([{ type: 'lightSwitched', on: result === 'on' }, ...freed, ...(state.settings.gunCombat ? refreshGunTarget() : [])]);
  showRoomNote(note.cls, note.text);
}
// The LIGHT button under the map (light button prototype, Timothy
// 2026-10-27: 3 taps on a stick, the way before, were too much in a tense
// moment).
document.getElementById('lightBattery').addEventListener('click', () => switchLight());

// The tutorial's ring has closed ("Die in darkness."): a moment later the
// kind voice says the one hint, "Don't let them dim your light." In
// Comfort mode the light is always on, so there is nothing to switch:
// the ring breaks by itself a little after. Real seconds, view-side.
function speakInRing() {
  const inRing = () => state.floor.tutorial && state.floor.tutorial.stage === 'ring' && !state.run.runEnded;
  setTimeout(() => {
    if (!inRing()) return;
    showWhisper(t('tut.dimLight'), 'kind', TUTORIAL_WHISPER_MS);
    if (batteryInPlay()) return;
    setTimeout(() => {
      if (!inRing()) return;
      const note = drawEvents([...breakRing(), ...(state.settings.gunCombat ? refreshGunTarget() : [])]);
      if (note.text) showRoomNote(note.cls, note.text);
    }, TUTORIAL_COMFORT_BREAK_MS);
  }, TUTORIAL_KIND_DELAY_MS);
}

// A tutorial line that waits TUTORIAL_KIND_DELAY_MS before it shows, so
// the line before it can be read (tutorial.js lookUpLine), and then only
// if the player is still in the tutorial.
function whisperSoon(e) {
  setTimeout(() => {
    if (!state.floor.tutorial || state.run.runEnded) return;
    showWhisper(t(e.line), e.tone, TUTORIAL_WHISPER_MS);
  }, TUTORIAL_KIND_DELAY_MS);
}

// The tutorial teaches without hand holding (Timothy): a stage's plain
// hint shows in the room log only if the player is still on it after
// TUTORIAL_STUCK_MS. Stages with no hint teach themselves. With One stick
// a hint with a `.stick` wording says it for the stick (one stick plan
// step G).
const STUCK_HINTS = { dark: 'tut.hint.move', name: 'tut.hint.barrel', ring: 'tut.hint.light', fight: 'tut.hint.fire' };
let watchedStage = null;
let stuckTimer = null;

// Starts the stuck clock when the tutorial's stage changes (`restart`:
// start it again on the same stage, as when the intro ends). Called after
// every drawEvents and floor load.
function watchTutorial(restart = false) {
  const tut = state.floor.tutorial;
  const stage = tut ? tut.stage : null;
  if (stage === watchedStage && !restart) return;
  watchedStage = stage;
  clearTimeout(stuckTimer);
  const plain = STUCK_HINTS[stage];
  const hint = plain && state.settings.oneStick && TEXT[plain + '.stick'] ? plain + '.stick' : plain;
  if (!hint || (stage === 'ring' && !batteryInPlay())) return;
  stuckTimer = setTimeout(() => {
    const now = state.floor.tutorial;
    if (now && now.stage === stage && !state.run.runEnded) showRoomNote('move-msg', t(hint));
  }, TUTORIAL_STUCK_MS);
}

// Aims the light at `angle` (look.js aimLook) and draws the result. No turn.
function aimTo(angle) {
  if (!lookReady()) return;
  drawEvents(aimLook(angle));
}

// A tap on the floor: aims at the floor point under it, unless it's on
// the player's own tile, where the angle would jump about.
function aimAtPoint(point) {
  const dr = point.row - state.floor.playerRow;
  const dc = point.col - state.floor.playerCol;
  if (Math.hypot(dr, dc) < LOOK_POINTER_DEAD) return;
  aimTo(Math.atan2(dc, -dr));
}

// Turns the body toward an aim past the free arc (look.js turnBody): a
// spent turn, so the minions get a move.
function turnLook() {
  if (!wantsTurn() || state.run.turnLocked || state.run.runEnded || mapPanelShown()) return;
  state.run.turnLocked = true;
  applyTurnOutcome(turnBody());
  state.run.turnLocked = false;
}

// The controls (room view plan step A: the camera never turns). Every
// d-pad arrow, key (arrows, W A S D, Q / E / Z / C for the corners) and
// number pad key walks the way it points on screen (dpad.js padWay); the
// light is aimed by the look stick and taps. Returns the ms until a held
// press acts again, or null to stop.
function padPush(sx, sy) {
  if (!roomScreen.classList.contains('show') || state.run.runEnded) return null;
  const way = padWay(sx, sy, waysInUse());
  if (!way) return null;
  const [dr, dc] = FACING_VECTORS[way];
  movePlayer(dr, dc);
  return repeatMs(dr, dc);
}

// Sweeps the light (look.js sweepLook): free inside the arc; a body turn
// past it is a spent turn, so the minions get a move.
function lightSweep(delta) {
  if (!lookReady()) return;
  const events = sweepLook(delta);
  if (!events.some(e => e.type === 'bodyTurned')) {
    drawEvents(events);
    return;
  }
  state.run.turnLocked = true;
  applyTurnOutcome(events);
  state.run.turnLocked = false;
}
const sweep = sweepHold(lightSweep, { speed: LOOK_SWEEP_SPEED });
window.addEventListener('blur', () => sweep.reset());

// The look stick pushed sideways: sweeps faster the further it goes.
function stickSweep(dx) {
  sweep.push('stick', Math.max(-1, Math.min(1, dx / LOOK_STICK_KNOB_PX)));
}

// Looking up at the sky (sky eye plan; the room view's step F): Space held
// or the look stick pushed up, either one ('key' / 'stick'). Free and
// view-only (roomview.js lookUp): the world keeps its turns, and with
// Real time on it keeps moving while the player looks away from the floor.
const lookingUp = new Set();
function holdLookUp(source, on) {
  if (lookingUp.has(source) === on) return;
  if (on) lookingUp.add(source);
  else lookingUp.delete(source);
  lookUp(lookingUp.size > 0);
  requestMapDraw();
}

// The look stick: pushed up past LOOK_UP_STICK of its reach, more up than
// sideways, it looks up and stops sweeping; otherwise it sweeps by its
// sideways push.
function stickPush(dx, dy) {
  const up = -dy > Math.abs(dx) && -dy / LOOK_STICK_KNOB_PX >= LOOK_UP_STICK;
  holdLookUp('stick', up);
  stickSweep(up ? 0 : dx);
}

// The keys by the d-pad way they stand for. A held key steps again once
// the last step has landed (walkpace.js).
const MOVE_KEYS = {
  ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D',
  ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R',
  q: 'UL', Q: 'UL', e: 'UR', E: 'UR', z: 'DL', Z: 'DL', c: 'DR', C: 'DR',
};
function moveKey(way, repeat) {
  if (repeat && !heldStepReady(performance.now())) return;
  padPush(...SCREEN_WAYS[way]);
}

// The look stick lights up while a tap would turn the body, and its label
// says what a tap does.
function syncLookStick() {
  const armed = wantsTurn();
  lookStick.classList.toggle('armed', armed);
  lookStick.setAttribute('aria-label', t(armed ? 'dpad.stick.turn' : 'dpad.stick.wait'));
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

// SELECT (button or F), the gun's one button: on a dial it presses READY,
// then stops it; otherwise it fires at the target. One button
// in one place, so the thumb stays put and the eyes stay on the marker.
// Energy comes only from energy cells: there is no reloading at will.
// Standing on the stairs, SELECT goes down instead of firing.
function pressSelect() {
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
    const note = drawEvents(events);
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
function steadyOn() {
  return state.settings.steadyAim && state.settings.oneStick;
}

// SELECT let go while steadying (gun.js releaseSteady): the shot fires and
// settles as a stopped dial's would. `cancel` (slid off SELECT, Escape)
// lowers the gun for nothing (cancelSteady).
function releaseSelect(cancel = false) {
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
function nextGunTarget() {
  if (!gunReady()) return;
  const note = drawEvents(cycleTarget());
  if (note.text) showRoomNote(note.cls, note.text);
}

// The energy cell the open reload panel came from (bumped on the map), or
// null for the RELOAD button and DEV -> Test reload.
let reloadBox = null;

// Opens the reload panel, or says why not (full energy: a bumped cell
// then stays as it is, for later).
function openReload(test, box = null) {
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
function devTestShot() {
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
function readyDial(mode) {
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
function lowerGun() {
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
function stopDamageBar(barPosition) {
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
function devTestReload() {
  if (!gunReady()) return;
  openReload(true);
}

// What the question panel's input means on the ask screen, for the
// reload or relay that's open (set by pickReload; DEV -> Auto-win answers through it).
let askAnswers = null;

// A reload offer was picked: its question (or a minigame), with its
// modifiers, on the ask screen. Any answer (or the Timer running out) settles
// the reload; a minigame's tier changes the energy.
function pickReload(offer, category) {
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
function openRelay(relay) {
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

// The tutorial's barrel was bumped (moves.js nameAsked): it asks the
// player's name on the ask screen, typed, with no options, no modifiers
// and no minigame. Any name that isn't blank settles it (tutorial.js
// settleName), and that is the turn.
function openNameBarrel() {
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
// on a miss ("47 (40 + 7)"). It never comes back as a haunt; its two
// questions do when the total is wrong (endMinigame).
function sumLockQuestion() {
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
function letterPoolQuestion(group) {
  const pool = letterPoolSetup(group);
  const meaning = pool.hidden.map(w => w[0] + w.slice(1).toLowerCase()).join(', ');
  return { term: t('mg.letterPool.term', { label: group.label, n: LETTER_POOL_FORM }), meaning, letterPool: pool };
}

// Closes the gun's panels, hands the question panel back to the battle
// screen and frees the turn; `settle` (if given) is the rule that ends it.
function endReload(settle) {
  clearModifier();
  closeMapPanels();
  mountBattleQuestion();
  askAnswers = null;
  reloadBox = null;
  state.battle.struggle = null;
  if (settle) finishGunAction(settle());
  state.run.turnLocked = false;
}

// DEV -> Combat back to classic: close whatever gun panel is open, and
// drop a shot waiting for the dial.
function endGunTests() {
  if (!mapPanelShown()) return;
  endReload();
}

// DEV -> Combat switched: the gun's target and the HUD catch up.
function gunCombatChanged() {
  drawEvents(state.settings.gunCombat ? refreshGunTarget() : []);
}

// DEV -> Auto-win, with a gun panel open: picks the first reload, answers
// its question right (a minigame at X) and closes the book held after it, and starts and stops the dial in its
// kill zone (a Struggle's in its zone). Walking, reloading and firing stay the player's.
function autoWinGun() {
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
function stopStruggleBar(barPosition) {
  const events = settleStruggle(barPosition);
  fadeDial(dialResult(events));
  applyTurnOutcome(events, false);
}

function nextQuestion() {
  setQuestion(pickQuestion(state.battle.currentQuestion));
}

// If the showing question isn't from the set being played (a leftover
// from an earlier set), reroll it from the set. A no-op the rest of the time.
function syncQuestionForTarget() {
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
  const isFight = target.kind === 'boss' || target.kind === 'minion' || target.kind === 'hunter';
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

function chooseCategory(i) {
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

// What the intro shows: every question in the set, and one of them with a
// wrong answer for the fake player to type. The wrong answer is another
// question's answer of the same type (a name for a name), so it reads as a
// believable mistake; a set without types falls back to its choices.
// Drafts (answers longer than one word) are left out where the set has
// others, so the typed answer stays short.
function introScript() {
  const pool = state.settings.activeData;
  const settled = pool.filter(q => !q.draft);
  const from = settled.length ? settled : pool;
  const asked = from[Math.floor(Math.random() * from.length)];
  const right = normalizeSpaces(asked.meaning).toLowerCase();
  const isWrong = answer => normalizeSpaces(answer).toLowerCase() !== right;
  const sameType = from.filter(q => q.answerType && q.answerType === asked.answerType && isWrong(q.meaning));
  const wrong = sameType.length
    ? sameType[Math.floor(Math.random() * sameType.length)].meaning
    : buildChoices(asked).find(isWrong) || '';
  return { questions: pool.map(q => q.term), attempt: { question: asked.term, answer: wrong } };
}

// A fresh run's numbers: the questions, hearts, energy (`energy` of it),
// gold, turns and story. startGame() sets them, and again once the
// tutorial is left, so nothing spent or won there carries into the run.
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
  state.run.lastMinigame = null;
  rollWeaknesses();
  state.run.loreQueue = [];
  resetHaunts();
}

function startGame() {
  resetRun();
  state.settings.revealOnWrong = revealToggle.checked;
  // One stick unless the start screen asks for turns (one stick plan step
  // G); Real time is a turns option.
  state.settings.oneStick = !turnsToggle.checked;
  state.settings.realTime = turnsToggle.checked && realTimeToggle.checked;
  syncDevOneStick();
  state.settings.simpleEnemies = simpleEnemiesToggle.checked;
  resetClock();
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

  // Room setup happens immediately (invisibly, behind the intro) so there's
  // no added real loading time, only the intro itself. The elapsed-time
  // clock starts once the intro ends or is skipped, so it isn't charged
  // against the player.
  // A player who has never finished the tutorial room wakes in it first
  // (the start screen's toggle; tutorial.js).
  const tutorial = tutorialToggle.checked;
  loadRoom(tutorial ? 'tutorial' : 'opening');
  showScreen(introGlitch);
  playIntro(introScript(), () => {
    showScreen(roomScreen);
    startTimer();
    if (!tutorial) return;
    showWhisper(t('tut.cantLeave'), 'dread', TUTORIAL_WHISPER_MS);
    watchTutorial(true);
  });
}

// A new floor: make the new floor's data, then put it on the page.
// `restKind` ('opening' / 'between' / 'epilogue') builds a rest floor,
// 'tutorial' the tutorial room; none builds the danger floor at the
// current depth.
function loadRoom(restKind) {
  if (restKind === 'tutorial') buildTutorialFloor();
  else if (restKind) buildRestFloor(restKind);
  else buildFloor();
  drawFloor();
  watchTutorial();
  refreshInspector();
}

// Puts the floor buildFloor() made on the page: the map, hints, HUD, and
// a fresh room screen.
function drawFloor() {
  resetClock();
  resetWalk();
  fadeAnswerLine(true);
  if (state.settings.gunCombat) refreshGunTarget();
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
  // The room the player wakes in announces itself like any other; on a
  // fixed plan, after the building's name.
  // The tutorial room has no name or theme line: its whispers speak instead.
  const startChamber = state.floor.tutorial ? undefined : state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  const startName = state.floor.chamberNames[startChamber];
  if (startName) {
    showRoomNote('move-msg', t('room.enter.plan', { floor: t(state.floor.plan.name), name: t(startName) }));
  } else if (startChamber !== undefined) {
    showRoomNote('move-msg', t('theme.' + state.floor.chamberThemes[startChamber] + '.enter'));
  }
  if (state.floor.stairsAlt) showRoomNote('move-msg', t('room.stairs.two'));
  if (state.floor.path) showRoomNote('move-msg', t('room.path.taken', { path: t('path.' + state.floor.path) }));
  if (state.floor.goals.length) {
    showRoomNote('move-msg', t('room.goals.new', { goals: state.floor.goals.map(g => t('goal.' + g.id)).join(' / ') }));
  }
  answerInput.value = '';
  setControlsEnabled(true);
  answerInput.focus();
}

// Shared by the stairs (goDown) and the dev skip button.
// run.js decides what comes next: a depth, a rest floor, or the win.
function advanceRoom() {
  if (state.floor.tutorial) { leaveTutorial(); return; }
  const next = nextFloor();
  if (next.kind === 'win') endWin();
  else loadRoom(next.kind === 'rest' ? next.rest : null);
}

// Out through the tutorial room's door (or DEV -> Skip room): the
// tutorial is done, so its toggle goes off and is saved (setloader.js
// listens), and the run starts fresh on the opening rest, with
// TUTORIAL_EXIT_ENERGY.
function leaveTutorial() {
  tutorialToggle.checked = false;
  tutorialToggle.dispatchEvent(new Event('change'));
  resetRun(TUTORIAL_EXIT_ENERGY);
  loadRoom('opening');
}

// Going down the stairs, once the player says so (SELECT or Enter while
// standing on them): the floor's goals are scored, then the next floor
// loads and the goals' lines open its room log, so they aren't wiped with
// the old one. Costs no turn.
function goDown() {
  if (state.run.turnLocked || state.run.runEnded || mapPanelShown() || !onStairs()) return;
  const scored = scoreGoals();
  state.run.nextPath = stairsHere().path || null;
  advanceRoom();
  if (!roomScreen.classList.contains('show')) return;
  const note = drawEvents(scored);
  if (note.text) showRoomNote(note.cls, note.text);
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
  // The tutorial room moves on (tutorial.js) after any spent turn.
  turn.push(...tutorialTurn(turn));
  turn.push(...chargerLine());
  turn.push(...shutterLine(turn));
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

// One poll of the real-time clock; when the world's turn is due, the
// minions, the hunter and the light take it, as after a step in turn mode.
// The HUD's NEXT meter follows each poll.
function clockTick() {
  const running = clockMayRun();
  const due = pollClock(performance.now(), running);
  renderClock(running);
  if (bookReading()) refreshBook();
  if (due) applyTurnOutcome([], true);
}
setInterval(clockTick, REALTIME_POLL_MS);

// The eye's clock (gaze.js, light battery plan step E): real time, in turn
// mode too, paused wherever the real-time clock is (a panel over the map,
// the battle screen, the DEV panel, a hidden tab) and while a turn plays
// out. A long gap (a slow tab) counts as one poll at most.
let gazeAt = performance.now();
function gazeMayRun() {
  return !state.run.runEnded && !state.run.turnLocked && !document.hidden &&
    roomScreen.classList.contains('show') && worldRunsUnder() && !devPanel.classList.contains('show');
}
function gazeTick() {
  const now = performance.now();
  const dt = Math.min(now - gazeAt, GAZE_POLL_MS * 2);
  gazeAt = now;
  if (!gazeMayRun() || state.floor.playerRow === undefined) return;
  const events = tickGaze(dt);
  if (events.length) {
    computeVisibility();
    const note = drawEvents([...events, ...(state.settings.gunCombat ? refreshGunTarget() : [])]);
    showRoomNote(note.cls, note.text);
  } else if (state.floor.minions.some(m => m.gaze > 0)) {
    requestMapDraw();
  }
}
setInterval(gazeTick, GAZE_POLL_MS);

// Draws a list of rule events, in order, then redraws the HUD, fog, eye
// and targeting once. Returns the room note the events add up to
// ({ cls, text }, text in event order); the caller decides whether to show it.
// The events that mean the player moved: they put the answer (line or ring) away.
const PLAYER_MOVES = new Set(['stepped', 'waited', 'bodyTurned', 'blocked', 'propSearched', 'minionFinished', 'heldFast']);

function drawEvents(events) {
  const parts = [];
  let cls = 'move-msg';
  let engaged = false;
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
        if (e.kind === 'furniture') parts.push(t('furniture.' + e.thing.piece));
        else parts.push(e.kind === 'prop' ? t('room.' + e.thing.kind + '.done') : t('room.blocked.' + e.kind));
        break;
      // A step says nothing: the map already shows where the player went.
      case 'stepped':
        if (e.free) freeStepOnMap(state.floor.creeping ? ONE_STICK.sneakMs : ONE_STICK.walkMs);
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
      // The static says it instead while on (Simple enemies keep "Enemy close.").
      case 'presenceSensed':
        if (!state.settings.staticNoise || state.settings.simpleEnemies) showSensed();
        break;
      case 'stairsReached':
        if (e.hidden) parts.push(t('room.stairs.hidden'));
        else if (e.path) parts.push(t('room.stairs.path', { path: t('path.' + e.path) }));
        parts.push(t('room.stairs.ask'));
        break;
      case 'stairsScouted':
        parts.push(t('exchange.scouted', { path: t('path.' + e.path) }));
        break;
      case 'goalMet':
        parts.push(t('room.goal.met', { goal: t('goal.' + e.id), gold: e.gold }));
        break;
      case 'goalMissed':
        parts.push(t('room.goal.missed', { goal: t('goal.' + e.id) }));
        break;
      case 'turned':
      case 'boxSprung':
      case 'itemReached':
      case 'cellFound':
        break;
      case 'relayFound':
        parts.push(t('room.relay.found'));
        break;
      // The tutorial room (tutorial.js).
      case 'nameAsked':
      case 'tutorialLeft':
      case 'spotLit':
      case 'barrelAppeared':
      case 'ringBroken':
        break;
      case 'whispered':
        if (e.wait) whisperSoon(e);
        else showWhisper(t(e.line), e.tone, TUTORIAL_WHISPER_MS);
        break;
      case 'ringClosed':
        speakInRing();
        break;
      case 'nameGiven':
        // The start screen's name field keeps it (setloader.js saves on input).
        playerNameInput.value = e.name;
        playerNameInput.dispatchEvent(new Event('input'));
        parts.push(t('tut.name.kept', { name: e.name }));
        break;
      case 'keyDropped':
        parts.push(t('tut.key.dropped'));
        break;
      case 'doorUnlocked':
        parts.push(t('tut.door.open'));
        break;
      case 'relayHeld':
        parts.push(t(e.turns ? 'room.relay.held' : 'room.relay.heldDark', { turns: e.turns }));
        break;
      case 'relaySparked':
        cls = 'block-msg';
        if (state.settings.revealOnWrong) showAnswerLine(e.expected);
        parts.push(t(e.turns ? 'room.relay.sparked' : 'room.relay.sparkedDark', { turns: e.turns }));
        break;
      case 'propSearched':
        break;
      case 'ventStepped':
        parts.push(t('room.vent.stepped'));
        break;
      // A mistake's sound (noise.js): drawn on the map only; the mistake's
      // own line already says what happened.
      case 'noiseMade':
        soundOnMap(e.tiles);
        break;
      case 'noiseHeard':
        if (seesEnemy(e.minion)) heardOnMap(e.minion);
        break;
      // The ducts (vents.js): one going in is always in the log, seen or
      // not (Timothy: it builds dread); the shudder only when heard, and it
      // shakes the grate (none under reduced motion or Comfort mode); the
      // drop slides out of it, its line only when seen.
      case 'ventEntered':
        parts.push(t('room.vent.entered'));
        break;
      case 'ventRattled':
        if (!e.heard) break;
        rattleOnMap(e.vent);
        parts.push(t('room.vent.rattle'));
        break;
      case 'ventDropped':
        if (!state.settings.simpleEnemies) slideOnMap(e.minion, e.vent, MAP_ANIMATION_MS.ventDrop);
        if (e.seen) parts.push(t('room.vent.dropped'));
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
      // The eye (gaze.js): full, it steps closer, or stares from beside the player.
      case 'gazeStep':
        slideOnMap(e.minion, e.from, GAZE_STEP_MS);
        parts.push(t('room.gaze.step'));
        cls = 'warn-msg';
        break;
      case 'gazeStare':
        parts.push(t('room.gaze.stare'));
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
      case 'hunterRepelled':
        logLine(t(e.right ? 'log.hunter.repelled' : 'log.hunter.retreats'), e.right ? 'bright' : undefined);
        break;
      case 'minionCleared':
        deathOnMap(e.minion);
        logLine(t(e.right ? 'log.minion.cleared' : 'log.minion.disperses'), e.right ? 'bright' : undefined);
        break;
      case 'targetSpent':
        if (!e.right) {
          logLine(t('log.' + e.target.kind + '.trapped'));
        }
        break;
      case 'goldGained':
        if (e.from === 'kill') { parts.push(t('gun.killed', { gold: e.amount })); break; }
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
  watchTutorial();
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

// The move keys held down with One stick on (one stick plan step A), by
// d-pad way: free walking goes the way they add up to. The round stick's
// push instead while a finger is on it (step B): [x, y], or null.
const heldWays = new Set();
let stickPushed = null;
const walkStick = document.getElementById('walkStick');
const dpadClip = document.getElementById('dpadClip');
// When the last walking frame ran, for its length.
let walkFrameAt = null;

// One frame of free walking with One stick on (walk.js walkFree): while
// the real-time clock may run and nothing holds the player, the round
// stick's push or the held keys move them and swing their light round; a
// new tile or a bump settles like a step (settleMove). While the walk
// can't run, held keys and the stick's push are forgotten, so a key held
// through a panel doesn't walk on (or bump the same chest again) once it
// closes. The round stick stands in for the d-pad while One stick is on.
function walkFrame(now) {
  requestAnimationFrame(walkFrame);
  const dt = walkFrameAt === null ? 0 : now - walkFrameAt;
  walkFrameAt = now;
  const one = state.settings.oneStick;
  if (walkStick.hidden === one) {
    walkStick.hidden = !one;
    dpadClip.hidden = one;
  }
  if (!one) return;
  // Steadying a shot (steady aim): the player stands still, the aim
  // steadies and the world goes on.
  // A panel over the map (a Struggle, CHARGE.SYS) or a hit takes the aim
  // away: nothing is spent.
  if (steadying() && mapPanelShown()) cancelSteady();
  if (steadying()) {
    heldWays.clear();
    stickPushed = null;
    resetWalk();
    if (!clockMayRun() || state.run.turnLocked) return;
    const note = drawEvents(tickSteady(Math.min(dt, ONE_STICK.frameMs)));
    if (note.text) showRoomNote(note.cls, note.text);
    requestMapDraw();
    const hearts = state.run.hearts;
    worldFrame(dt);
    if (state.run.hearts < hearts && steadying()) {
      cancelSteady();
      selectHold = null;
      showRoomNote('warn-msg', t('gun.steady.knocked'));
    }
    return;
  }
  if (!clockMayRun() || state.run.turnLocked || walkHeld()) {
    heldWays.clear();
    stickPushed = null;
    resetWalk();
    return;
  }
  const spot = freeSpot();
  const [x0, y0, look0] = [spot.x, spot.y, state.floor.look];
  let events;
  if (stickPushed) {
    const [x, y] = stickPushed;
    events = walkFree(x, y, { push: Math.min(1, Math.hypot(x, y)), dtMs: dt, still: reduceMotion });
  } else {
    const [x, y] = [...heldWays].reduce(([sx, sy], way) => [sx + SCREEN_WAYS[way][0], sy + SCREEN_WAYS[way][1]], [0, 0]);
    events = walkFree(x, y, { dtMs: dt, keys: true, still: reduceMotion });
  }
  if (spot.x !== x0 || spot.y !== y0 || state.floor.look !== look0) requestMapDraw();
  if (events.length) {
    state.run.turnLocked = true;
    settleMove(events);
  }
  worldFrame(dt);
}
requestAnimationFrame(walkFrame);

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
  const events = clockFrame(Math.min(dt, ONE_STICK.frameMs), { canStruggle: worldRunsUnder() });
  if (state.settings.warningTimer) noteSigns(performance.now());
  if (Math.ceil(state.floor.light.charge) !== cells) renderHud();
  if (!events.length) return;
  state.run.turnLocked = true;
  applyTurnOutcome(events, false);
  state.run.turnLocked = false;
}

// Sneaking on or off (X, One stick only; walk.js switchSneak).
function toggleSneak() {
  if (!state.settings.oneStick || !roomScreen.classList.contains('show') || mapPanelShown() || state.run.runEnded) return;
  const note = drawEvents(switchSneak());
  showRoomNote(note.cls, note.text);
}

// A move key went down or up with One stick on: it joins or leaves the
// held ways.
function holdWay(way, down) {
  if (down) heldWays.add(way);
  else heldWays.delete(way);
}

// One arrow press (stepPlayer in moves.js). A step or a first look in a
// box spends a turn; a step onto the stairs only asks (goDown takes them); a trapped box or the
// chest opens the battle screen; an energy cell opens the
// reload panel (its answer is the turn); walking into a downed stick man
// finishes it, a turn like a step; a turn to a new direction or a
// bump only draws, except that with free look a bump that turned the body
// is a turn (bodyTurned). With Real time
// on, a press too soon after the last step is ignored (REALTIME_WALK_MS).
function movePlayer(dRow, dCol) {
  if (state.run.turnLocked || state.run.runEnded || walkHeld()) return;
  if (realTimeOn() && performance.now() - lastWalkAt < REALTIME_WALK_MS) return;
  state.run.turnLocked = true;
  const events = stepPlayer(dRow, dCol);
  if (events.some(e => e.type === 'stepped')) {
    lastWalkAt = performance.now();
    noteStep(dRow, dCol, lastWalkAt);
  }
  settleMove(events);
}

// What the player's move (a step, or free walking's new tile or bump)
// leads to, with the turn locked by the caller: a spent turn plays out
// (applyTurnOutcome), else its events are drawn; then any panel or
// screen it asks for opens.
function settleMove(events) {
  const has = (type) => events.some(e => e.type === type);
  if (has('stepped') || has('propSearched') || has('bodyTurned') || has('minionFinished')) {
    applyTurnOutcome(events);
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
    if (has('boxSprung') || has('itemReached') || has('gateReached')) syncBattleScreen();
    if (has('exchangeOpened')) openExchange();
  }
  state.run.turnLocked = false;
  const cell = events.find(e => e.type === 'cellFound');
  if (cell) openReload(false, cell.prop);
  const relay = events.find(e => e.type === 'relayFound');
  if (relay) openRelay(relay.prop);
  if (has('nameAsked')) openNameBarrel();
  if (has('tutorialLeft')) leaveTutorial();
  const charger = events.find(e => e.type === 'chargerOpened');
  if (charger) openCharger(charger.charger);
}

// Whether walking and waiting are held: the Struggle dial is the
// player's move, CHARGE.SYS's wires are (its turns are spent there), and
// the record book read from the map has the map's place.
function walkHeld() {
  const shown = mapPanelShown();
  return shown === 'struggle' || shown === 'charger' || shown === 'book';
}

// Whether the world may go on with a panel up: none, CHARGE.SYS (it sits
// over the map, and Timothy 2026-10-26: with Real time on the running clock
// is its cost), or the record book read from the map for LOG or MAP
// (record book plan open call 1: reading costs time, as it did over the
// map).
function worldRunsUnder() {
  const shown = mapPanelShown();
  return !shown || shown === 'charger' || shown === 'book';
}

// The charger whose CHARGE.SYS is open, or null. View-side, like reloadBox.
let openChargerProp = null;
// Closes CHARGE.SYS a moment after a charge (CHARGER.closeMs), so the
// joined-up wires and their line are seen.
let chargerCloseTimer = null;

// CHARGE.SYS opens over the map on the charger's wires (charger.js
// useCharger already made them, or kept them as they were left).
function openCharger(charger) {
  clearTimeout(chargerCloseTimer);
  openChargerProp = charger;
  showCharger(charger.puzzle, realTimeOn());
}

// A wire turned (a tap, or F / Enter / Space on it): charger.js turnWire.
// Every second turn is a spent turn, the world's as for a step (with Real
// time on, the clock is the cost instead). Once the power joins up, energy
// is full and CHARGE.SYS closes after CHARGER.closeMs.
function turnChargerWire(index) {
  const charger = openChargerProp;
  if (!charger || state.run.turnLocked || state.run.runEnded || !chargerShown()) return;
  const wires = charger.puzzle;
  const events = turnWire(charger, index);
  if (!events.length) return;
  const charged = events.some(e => e.type === 'charged');
  renderCharger(wires, charged);
  if (events.some(e => e.type === 'turnSpent') && !realTimeOn()) {
    state.run.turnLocked = true;
    applyTurnOutcome(events);
    state.run.turnLocked = false;
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
  }
  if (charged && chargerShown()) chargerCloseTimer = setTimeout(() => closeCharger(), CHARGER.closeMs);
}

// Closes CHARGE.SYS (the wires stay on the charger as they were), with a
// room note if one is given.
function closeCharger(cls, text) {
  clearTimeout(chargerCloseTimer);
  openChargerProp = null;
  closeMapPanels();
  if (text) showRoomNote(cls, text);
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
  if (state.run.turnLocked || state.run.runEnded || walkHeld()) return;
  state.run.turnLocked = true;
  applyTurnOutcome([{ type: 'waited' }]);
  state.run.turnLocked = false;
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
  onChoice: attemptAnswerMC, onTyped: attemptAnswer, onTimeout: answerTimedOut, onResult: attemptMinigame, log: logLine,
};

// Puts the question panel back on the battle screen (it may have been
// on the ask screen for a reload or a relay).
function mountBattleQuestion() {
  mountQuestionPanel(battleQuestionSlot, battleAnswers);
}
mountBattleQuestion();

continueBtn.addEventListener('click', leaveEncounter);
// SELECT acts the moment a finger or mouse goes down, not on the click
// that comes when it lifts: a tap is held for about a tenth of a second,
// and on release the dial's marker had already moved on (Timothy
// felt the lag). The click a press ends with is skipped; a click with no
// pointer behind it (Enter or Space on the focused button) still counts,
// the same way the d-pad does it.
let selectPressed = false;
// Steady aim: the press being held, and whether it has slid off SELECT
// (letting go there lowers the gun instead of firing).
let selectHold = null;
const SELECT_SLIDE_OFF_PX = 14;
btnSelect.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || btnSelect.disabled) return;
  e.preventDefault();
  selectPressed = true;
  pressSelect();
  if (!steadying()) return;
  try { btnSelect.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
  selectHold = { off: false };
});
btnSelect.addEventListener('pointermove', (e) => {
  if (!selectHold) return;
  const r = btnSelect.getBoundingClientRect(), pad = SELECT_SLIDE_OFF_PX;
  selectHold.off = e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad;
});
const letGoSelect = (e) => {
  if (!selectHold) return;
  const off = selectHold.off || e.type === 'pointercancel';
  selectHold = null;
  releaseSelect(off);
};
btnSelect.addEventListener('pointerup', letGoSelect);
btnSelect.addEventListener('pointercancel', letGoSelect);
btnSelect.addEventListener('click', () => {
  if (selectPressed) { selectPressed = false; return; }
  pressSelect();
});
btnSelect.addEventListener('keydown', () => { selectPressed = false; });
btnSelect.addEventListener('contextmenu', (e) => e.preventDefault());

initDpad({
  buttons: dpadButtons,
  canWalk: () => roomScreen.classList.contains('show') && !state.run.runEnded,
  push: padPush,
});
initLookStick({
  button: lookStick,
  // The stick sweeps the light, faster the further it is pushed sideways,
  // or looks up when pushed up.
  aim: stickPush,
  done: () => {
    sweep.release('stick');
    holdLookUp('stick', false);
  },
  wait: skipTurn,
  // A tap that does nothing says what the stick does.
  tap: () => showRoomNote('move-msg', t('room.stickTap')),
  turn: turnLook,
  wantsTurn,
});

walkStick.setAttribute('aria-label', t('dpad.walkStick'));
initWalkStick({
  el: walkStick,
  push: (x, y) => { stickPushed = [x, y]; },
  release: () => { stickPushed = null; },
  lookUp: (on) => holdLookUp('stick', on),
  tap: () => showRoomNote('move-msg', t('room.walkStickTap')),
});

// The number pad's keys by the way they point (eight ways plan: 7 8 9 /
// 4 6 / 1 2 3).
const NUMPAD_WAYS = {
  Numpad7: 'UL', Numpad8: 'U', Numpad9: 'UR', Numpad4: 'L',
  Numpad6: 'R', Numpad1: 'DL', Numpad2: 'D', Numpad3: 'DR',
};
document.addEventListener('keyup', (e) => {
  if ((e.key === 'f' || e.key === 'F') && !selectHold) releaseSelect();
  if (e.key === ' ') holdLookUp('key', false);
  if (e.key === 'u' || e.key === 'U') holdLookUp('u', false);
  const way = MOVE_KEYS[e.key] || NUMPAD_WAYS[e.code];
  if (way) holdWay(way, false);
});
window.addEventListener('blur', () => {
  heldWays.clear();
  holdLookUp('key', false);
  holdLookUp('u', false);
  holdLookUp('stick', false);
});

// Keys on desktop, ignored while typing in the answer box. The arrows,
// W A S D, Q / E / Z / C and the number pad walk the way they point on
// screen (moveKey, padPush), unless a question on the map is taking number keys. Space held looks up at the
// sky (sky eye plan step A). With the gun on: F is SELECT (fires), T picks
// the next target, . waits. V switches the light (light battery plan).
// With One stick on, the move keys are held (walkFrame), X switches
// sneaking and U held looks up as Space does.
// On the stairs, Enter goes down (so does SELECT).
// Letter and number keys answer a question on the ask screen, unless the
// gun panels already used the key (picking a reload with 1-3, or F / Space
// stopping the dial).
document.addEventListener('keydown', (e) => {
  if (document.activeElement === answerInput || e.defaultPrevented) return;
  if (!roomScreen.classList.contains('show')) return;
  if (e.key === 'Escape' && steadying()) { e.preventDefault(); releaseSelect(true); return; }
  const numpad = NUMPAD_WAYS[e.code];
  // One stick: the move keys are held, not pressed (walkFrame).
  const held = state.settings.oneStick && !mapPanelShown() && (MOVE_KEYS[e.key] || numpad);
  if (held) { e.preventDefault(); holdWay(held, true); return; }
  // A held number pad key steps again only once its last step has landed
  // (walkpace.js), not at the keyboard's own repeat rate.
  if (e.repeat && numpad && !heldStepReady(performance.now())) { e.preventDefault(); return; }
  const way = !mapPanelShown() && MOVE_KEYS[e.key];
  if (way) { e.preventDefault(); moveKey(way, e.repeat); return; }
  if (numpad && !mapPanelShown()) { e.preventDefault(); padPush(...SCREEN_WAYS[numpad]); }
  else if (e.key === 'Enter' && onStairs() && !mapPanelShown()) { e.preventDefault(); goDown(); }
  else if (e.key === ' ' && !mapPanelShown()) { e.preventDefault(); holdLookUp('key', true); }
  else if (gunReady() && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); if (!(e.repeat && steadyOn())) pressSelect(); }
  else if (gunReady() && (e.key === 't' || e.key === 'T')) { e.preventDefault(); nextGunTarget(); }
  else if (gunReady() && e.key === '.') { e.preventDefault(); skipTurn(); }
  else if (e.key === 'v' || e.key === 'V') { e.preventDefault(); switchLight(); }
  else if (state.settings.oneStick && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); toggleSneak(); }
  else if (state.settings.oneStick && (e.key === 'u' || e.key === 'U') && !mapPanelShown()) { e.preventDefault(); holdLookUp('u', true); }
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
