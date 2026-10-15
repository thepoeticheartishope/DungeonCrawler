// DEV panel (only with ?dev on the address: a small tag in the corner, its
// panel over the screen): Skip room, Auto-win, Fog, Turn, Free look, Minigame, Camera, Look, Tendrils and Combat
// toggles, a test shot and a test reload, for testing. main.js passes in the game actions and elements it needs.
import { state } from './state.js';
import { requestMapDraw } from './mapview.js';
import { renderRoomHints, renderHud } from './render.js';
import { MINIGAMES } from './minigames.js';
import { STICK_POSE_IDS, TENDRIL_STYLES } from './stickforms.js';
import { followBody, lookAngle, bodyAngle, nearestWay } from './look.js';
import { computeVisibility } from './sight.js';
import { refreshGunTarget } from './gun.js';

const devDock = document.getElementById('devDock');
const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devAutoWinBtn = document.getElementById('devAutoWinBtn');
const devFogBtn = document.getElementById('devFogBtn');
const devTurnBtn = document.getElementById('devTurnBtn');
const devFreeLookBtn = document.getElementById('devFreeLookBtn');
const devEightWaysBtn = document.getElementById('devEightWaysBtn');
const devLightBatteryBtn = document.getElementById('devLightBatteryBtn');
const devGazeBtn = document.getElementById('devGazeBtn');
const devNoiseBtn = document.getElementById('devNoiseBtn');
const devShowDuctsBtn = document.getElementById('devShowDuctsBtn');
const dpadEl = document.getElementById('dpad');
const devCameraBtn = document.getElementById('devCameraBtn');
const devSmoothWalkBtn = document.getElementById('devSmoothWalkBtn');
const devLookBtn = document.getElementById('devLookBtn');
const devTendrilsBtn = document.getElementById('devTendrilsBtn');
const devMinigameBtn = document.getElementById('devMinigameBtn');
const devCombatBtn = document.getElementById('devCombatBtn');
const devShotBtn = document.getElementById('devShotBtn');
const devReloadBtn = document.getElementById('devReloadBtn');

export function initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, playMinigameOut, leaveEncounter, devTestShot, devTestReload, endGunTests,
  gunCombatChanged, autoWinGun,
  battleScreen, wagerRow,
}) {
  // Players never see DEV: it shows only when the address has ?dev
  // (index.html?dev), for testing.
  devDock.hidden = !new URLSearchParams(location.search).has('dev');
  devToggleBtn.addEventListener('click', () => {
    const open = devPanel.classList.toggle('show');
    devToggleBtn.setAttribute('aria-expanded', String(open));
  });

  // Dev tool: jump to the next room instantly, skipping combat, for
  // faster testing of dungeon generation across levels.
  devSkipBtn.addEventListener('click', () => {
    if (state.run.hearts <= 0) return;
    advanceRoom();
  });

  // Dev tool: while on, every encounter plays itself out — the first query
  // category is picked, the correct answer given (a minigame is played out
  // at X), and CONTINUE pressed — one
  // step every AUTO_WIN_STEP_MS so the log stays readable. Walking stays
  // manual, so the boss light, minions and darkness behave as usual. With
  // the gun on, an open reload is answered right and the damage bar stops
  // on the weak point (main.js autoWinGun); SELECT and the energy cells stay manual.
  const AUTO_WIN_STEP_MS = 300;
  let autoWinTimer = null;

  function autoWinStep() {
    if (state.settings.gunCombat && !battleScreen.classList.contains('show')) { autoWinGun(); return; }
    if (!battleScreen.classList.contains('show') || state.run.turnLocked || state.run.runEnded) return;
    if (state.battle.battlePhase === 'choosing') chooseCategory(0);
    else if (!wagerRow.hidden) placeWager(1);
    else if (state.battle.battlePhase === 'answering' && state.battle.selectedTarget && state.battle.minigame) playMinigameOut();
    else if (state.battle.battlePhase === 'answering' && state.battle.selectedTarget) attemptAnswerMC(state.battle.currentQuestion.meaning);
    else if (state.battle.battlePhase === 'ended') leaveEncounter();
  }

  devAutoWinBtn.addEventListener('click', () => {
    const on = !autoWinTimer;
    if (on) autoWinTimer = setInterval(autoWinStep, AUTO_WIN_STEP_MS);
    else { clearInterval(autoWinTimer); autoWinTimer = null; }
    devAutoWinBtn.textContent = on ? 'Auto-win: ON (dev)' : 'Auto-win: OFF (dev)';
    devAutoWinBtn.setAttribute('aria-pressed', String(on));
  });

  // Dev tool: reveal the whole map instantly, to check that the layout,
  // boss placement, and entities are generating correctly under the fog.
  devFogBtn.addEventListener('click', () => {
    state.settings.fogEnabled = !state.settings.fogEnabled;
    devFogBtn.textContent = state.settings.fogEnabled ? 'Fog: ON (dev)' : 'Fog: OFF (dev)';
    requestMapDraw();
  });

  // Dev tool: a press in a new direction turns and steps at once (warned by
  // "I see you."), or only turns, as before, so the two can be compared.
  devTurnBtn.addEventListener('click', () => {
    state.settings.turnBeforeStep = !state.settings.turnBeforeStep;
    devTurnBtn.textContent = state.settings.turnBeforeStep ? 'Turn: look first (dev)' : 'Turn: and step (dev)';
    devTurnBtn.setAttribute('aria-pressed', String(state.settings.turnBeforeStep));
  });

  // Dev tool (free look plan): the light points where the player aims,
  // within the free arc, or only where the body faces. Off, the aim goes
  // back with the body, so the light is straight ahead again.
  devFreeLookBtn.addEventListener('click', () => {
    state.settings.freeLook = !state.settings.freeLook;
    devFreeLookBtn.textContent = state.settings.freeLook ? 'Free look: ON (dev)' : 'Free look: OFF (dev)';
    devFreeLookBtn.setAttribute('aria-pressed', String(state.settings.freeLook));
    if (state.floor.playerRow === undefined) return;
    followBody();
    computeVisibility();
    if (state.settings.gunCombat) refreshGunTarget();
    requestMapDraw();
  });

  // Dev tool (eight ways plan): the player and the minions walk and face 8
  // ways, or only the 4 grid ways, as before, so the two can be compared.
  // Off while facing a diagonal, the body turns to the nearest grid way.
  // The d-pad shows the ways in use: square with 8 arrows, or turned 45°
  // with its 4 (index.html .dpad.four-ways).
  dpadEl.classList.toggle('four-ways', !state.settings.eightWays);
  devEightWaysBtn.addEventListener('click', () => {
    state.settings.eightWays = !state.settings.eightWays;
    dpadEl.classList.toggle('four-ways', !state.settings.eightWays);
    devEightWaysBtn.textContent = state.settings.eightWays ? '8 ways: ON (dev)' : '8 ways: OFF (dev)';
    devEightWaysBtn.setAttribute('aria-pressed', String(state.settings.eightWays));
    if (state.floor.playerRow === undefined) return;
    state.floor.facing = nearestWay(bodyAngle());
    followBody();
    computeVisibility();
    if (state.settings.gunCombat) refreshGunTarget();
    renderRoomHints();
    requestMapDraw();
  });

  // Dev tool (light battery plan): the light goes on and off and runs on
  // its battery, or is always on, as before. Off, the light comes back on.
  devLightBatteryBtn.addEventListener('click', () => {
    state.settings.lightBattery = !state.settings.lightBattery;
    devLightBatteryBtn.textContent = state.settings.lightBattery ? 'Light battery: ON (dev)' : 'Light battery: OFF (dev)';
    devLightBatteryBtn.setAttribute('aria-pressed', String(state.settings.lightBattery));
    if (state.floor.playerRow === undefined) return;
    computeVisibility();
    if (state.settings.gunCombat) refreshGunTarget();
    renderHud();
    requestMapDraw();
  });

  // Dev tool (vents and noise plan step B): mistakes make a sound stick
  // men hear, or are quiet, as before.
  devNoiseBtn.addEventListener('click', () => {
    state.settings.noise = !state.settings.noise;
    devNoiseBtn.textContent = state.settings.noise ? 'Noise: ON (dev)' : 'Noise: OFF (dev)';
    devNoiseBtn.setAttribute('aria-pressed', String(state.settings.noise));
  });

  // Dev tool (vents and noise plan step C): see who is in a duct and where
  // every pair of grates leads, to check the crawling in play.
  devShowDuctsBtn.addEventListener('click', () => {
    state.settings.showDucts = !state.settings.showDucts;
    devShowDuctsBtn.textContent = state.settings.showDucts ? 'Show ducts: ON (dev)' : 'Show ducts: OFF (dev)';
    devShowDuctsBtn.setAttribute('aria-pressed', String(state.settings.showDucts));
    requestMapDraw();
  });

  // Dev tool (light battery plan step E): the eye over a stick man in the
  // light, or none. Off, every eye shuts.
  devGazeBtn.addEventListener('click', () => {
    state.settings.gaze = !state.settings.gaze;
    devGazeBtn.textContent = state.settings.gaze ? 'Gaze: ON (dev)' : 'Gaze: OFF (dev)';
    devGazeBtn.setAttribute('aria-pressed', String(state.settings.gaze));
    state.floor.minions.forEach(m => { m.gaze = 0; });
    requestMapDraw();
  });

  // Dev tool: minigames roll as usual, never, or (one minigame picked)
  // always when the question fits it; forcing one also swaps in a question
  // it fits (minigames.js forcedQuestion), so it can be tried anywhere.
  const MINIGAME_MODES = ['roll', 'off', ...MINIGAMES];
  devMinigameBtn.addEventListener('click', () => {
    const next = MINIGAME_MODES[(MINIGAME_MODES.indexOf(state.settings.minigame) + 1) % MINIGAME_MODES.length];
    state.settings.minigame = next;
    devMinigameBtn.textContent = 'Minigame: ' + next + ' (dev)';
  });

  // Dev tool: the isometric camera glides after the player, or stays locked
  // on them as it did before, so the two can be compared in play.
  devCameraBtn.addEventListener('click', () => {
    state.settings.isoCameraGlide = !state.settings.isoCameraGlide;
    devCameraBtn.textContent = state.settings.isoCameraGlide ? 'Camera: glide (dev)' : 'Camera: locked (dev)';
    devCameraBtn.setAttribute('aria-pressed', String(state.settings.isoCameraGlide));
    requestMapDraw();
    renderRoomHints();
  });

  // Dev tool: smooth walk (walkpace.js) on, or one step time for every way
  // with the camera gliding after the player, as before, to compare.
  devSmoothWalkBtn.addEventListener('click', () => {
    state.settings.smoothWalk = !state.settings.smoothWalk;
    devSmoothWalkBtn.textContent = state.settings.smoothWalk ? 'Smooth walk: ON (dev)' : 'Smooth walk: OFF (dev)';
    devSmoothWalkBtn.setAttribute('aria-pressed', String(state.settings.smoothWalk));
    requestMapDraw();
  });

  // Dev tool (stick enemies plan): every stick enemy shows its own random
  // pose, or all show the one picked here, so each pose can be checked in play.
  const LOOK_MODES = ['random', ...STICK_POSE_IDS];
  devLookBtn.addEventListener('click', () => {
    const next = LOOK_MODES[(LOOK_MODES.indexOf(state.settings.enemyPose) + 1) % LOOK_MODES.length];
    state.settings.enemyPose = next;
    devLookBtn.textContent = 'Look: ' + next + ' (dev)';
    requestMapDraw();
  });

  // Dev tool (stick enemies plan): every stick enemy uses its own random
  // tendril style, or all use the one picked here (wound, head, unravel).
  const TENDRIL_MODES = ['random', ...TENDRIL_STYLES];
  devTendrilsBtn.addEventListener('click', () => {
    const next = TENDRIL_MODES[(TENDRIL_MODES.indexOf(state.settings.enemyTendrils) + 1) % TENDRIL_MODES.length];
    state.settings.enemyTendrils = next;
    devTendrilsBtn.textContent = 'Tendrils: ' + next + ' (dev)';
    requestMapDraw();
  });

  // Dev tool (gun plan): the gun on the map (the default since step 9), or
  // classic combat. With the gun, minions don't open the battle screen: they
  // strike when they reach the player, and are fought with SELECT
  // (main.js), each a turn. It also shows Test shot and Test reload, which spend no turn.
  // Turning it off drops the target and any shot waiting for the damage bar,
  // and closes a gun panel left open over the map.
  devCombatBtn.addEventListener('click', () => {
    const on = !state.settings.gunCombat;
    state.settings.gunCombat = on;
    if (!on) {
      state.floor.gunTarget = null;
      state.battle.aim = null;
    }
    devCombatBtn.textContent = on ? 'Combat: gun (dev)' : 'Combat: classic (dev)';
    devCombatBtn.setAttribute('aria-pressed', String(on));
    devShotBtn.hidden = !on;
    devReloadBtn.hidden = !on;
    if (!on) endGunTests();
    gunCombatChanged();
    requestMapDraw();
    refreshInspector();
  });

  devShotBtn.addEventListener('click', devTestShot);
  devReloadBtn.addEventListener('click', devTestReload);
}

// Dev tool: a live look at the game state and the last rule events, for
// checking that the rules did what the screen shows. The event ring is
// view-only (not in state), filled by drawEvents in main.js.
const EVENT_RING_SIZE = 20;
const eventRing = []; // [{ turn, event }], oldest first
const devInspectBtn = document.getElementById('devInspectBtn');
const devInspectOut = document.getElementById('devInspectOut');

devInspectBtn.addEventListener('click', () => {
  const on = devInspectOut.hidden;
  devInspectOut.hidden = !on;
  devInspectBtn.textContent = on ? 'Inspect: ON (dev)' : 'Inspect: OFF (dev)';
  devInspectBtn.setAttribute('aria-pressed', String(on));
  refreshInspector();
});

export function recordEvents(events) {
  for (const event of events) eventRing.push({ turn: state.run.turnCount, event });
  eventRing.splice(0, eventRing.length - EVENT_RING_SIZE);
  refreshInspector();
}

// Floor objects (boss, minions, props, chest...) print as "kind @ row,col"
// instead of the whole object; Sets, Maps and question pools print their size.
function where(thing) {
  return thing ? thing.kind + ' @ ' + thing.row + ',' + thing.col : null;
}

function brief(key, value) {
  if (key && value && typeof value === 'object' && 'row' in value && 'col' in value && 'kind' in value) return where(value);
  if (value instanceof Set || value instanceof Map) return value.constructor.name + '(' + value.size + ')';
  if ((key === 'pool' || key === 'order') && Array.isArray(value)) return value.length + ' questions';
  return value;
}

// Where the light points against the body, as '+20°' (east of it) or
// '-15°', for the player line.
function lookOffset() {
  const deg = Math.round((lookAngle() - bodyAngle()) * 180 / Math.PI);
  return (deg < 0 ? '' : '+') + deg + '°';
}

function floorSummary() {
  const f = state.floor;
  return {
    grid: f.GRID_SIZE,
    player: f.playerRow + ',' + f.playerCol + ' ' + f.facing + ' ' + lookOffset(),
    boss: f.boss && where(f.boss) + ' hp ' + f.boss.hp,
    hunter: where(f.hunter),
    darkness: f.darkness,
    darkTurns: f.darkTurns,
    lightTurns: f.lightTurns + ' / ' + f.lightTurnBudget,
    lightSlack: f.lightSlack + ' (loss ' + Math.round(f.lightLossShare * 100) + '%)',
    minions: f.minions.map(m => where(m) + (m.minionKind ? ' ' + m.minionKind + ' hp ' + m.hpLeft : '')),
    gunTarget: where(f.gunTarget),
    props: f.props.length,
    chest: where(f.chest),
    stairs: f.stairs && f.stairs.row + ',' + f.stairs.col,
    lastChoiceType: f.lastChoiceType,
    sets: {
      walls: f.wallSet.size, pillars: f.pillarSet.size, visible: f.visibleSet.size,
      sight: f.sightSet.size, explored: f.exploredSet.size, bossLit: f.bossLitSet.size,
      visitedChambers: f.visitedChambers.size,
    },
  };
}

// Only drawn while open, so a closed inspector costs nothing.
export function refreshInspector() {
  if (devInspectOut.hidden) return;
  const { activeData, ...settings } = state.settings;
  const view = {
    settings: { ...settings, activeData: activeData.length + ' questions' },
    run: state.run,
    floor: floorSummary(),
    battle: state.battle,
  };
  const events = eventRing.slice().reverse()
    .map(({ turn, event }) => 't' + turn + ' ' + JSON.stringify(event, brief));
  devInspectOut.textContent = JSON.stringify(view, brief, 2) + '\n\nevents (newest first):\n' + events.join('\n');
}
