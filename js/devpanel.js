// DEV panel (only with ?dev on the address: a small tag in the corner, its
// panel over the screen): Skip room, Auto-win, Fog, Turn, Free look, Minigame, Look, Tendrils and Combat
// toggles, a test shot and a test reload, and the map's frame meter, for testing. main.js passes in the game actions and elements it needs.
import { state } from './state.js';
import { requestMapDraw, mapDrawTimes } from './mapview.js';
import { renderHud } from './render.js';
import { MINIGAMES } from './minigames.js';
import { STICK_POSE_IDS, TENDRIL_STYLES } from './stickforms.js';
import { lookAngle, bodyAngle } from './look.js';
import { computeVisibility } from './sight.js';
import { refreshGunTarget } from './gun.js';
import { refreshBook } from './bookview.js';
import { BOOK } from './config.js';

const devDock = document.getElementById('devDock');
const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devAutoWinBtn = document.getElementById('devAutoWinBtn');
const devFogBtn = document.getElementById('devFogBtn');
const devBookPaperBtn = document.getElementById('devBookPaperBtn');
const devLightBatteryBtn = document.getElementById('devLightBatteryBtn');
const devGazeBtn = document.getElementById('devGazeBtn');
const devDownedBtn = document.getElementById('devDownedBtn');
const devSteadyBtn = document.getElementById('devSteadyBtn');
const devNoiseBtn = document.getElementById('devNoiseBtn');
const devStaticBtn = document.getElementById('devStaticBtn');
const devWarningBtn = document.getElementById('devWarningBtn');
const devOneStickBtn = document.getElementById('devOneStickBtn');
const devShowDuctsBtn = document.getElementById('devShowDuctsBtn');
const dpadEl = document.getElementById('dpad');
const devFrameOut = document.getElementById('devFrameOut');
const devLookBtn = document.getElementById('devLookBtn');
const devTendrilsBtn = document.getElementById('devTendrilsBtn');
const devMinigameBtn = document.getElementById('devMinigameBtn');
const devShotBtn = document.getElementById('devShotBtn');
const devReloadBtn = document.getElementById('devReloadBtn');

// DEV -> One stick's label from state.settings.oneStick (main.js
// startGame sets it from the start screen's Turns option).
export function syncDevOneStick() {
  devOneStickBtn.textContent = state.settings.oneStick ? 'One stick: ON (dev)' : 'One stick: OFF (dev)';
  devOneStickBtn.setAttribute('aria-pressed', String(state.settings.oneStick));
}

export function initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, playMinigameOut, leaveEncounter, devTestShot, devTestReload, 
  autoWinGun,
  battleScreen, wagerRow,
}) {
  // Players never see DEV: it shows only when the address has ?dev
  // (index.html?dev), for testing.
  const params = new URLSearchParams(location.search);
  devDock.hidden = !params.has('dev');
  devToggleBtn.addEventListener('click', () => {
    const open = devPanel.classList.toggle('show');
    devToggleBtn.setAttribute('aria-expanded', String(open));
    showFrameTimes();
  });

  // The frame meter: how long the map takes to draw, refreshed twice a
  // second while the panel is open (shoulder view plan step A: under about
  // 10 ms on his phone is fine).
  const FRAME_METER_MS = 500;
  function showFrameTimes() {
    if (!devPanel.classList.contains('show')) return;
    const times = mapDrawTimes();
    devFrameOut.textContent = times
      ? 'Draw: ' + times.median.toFixed(1) + ' ms, slowest ' + times.slowest.toFixed(1) + ' (dev)'
      : 'Draw: - (dev)';
  }
  setInterval(showFrameTimes, FRAME_METER_MS);

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
  // the gun on, an open reload is answered right and a dial is started and
  // stopped in its kill zone (a Struggle's in its zone; main.js autoWinGun); SELECT and the energy cells stay manual.
  const AUTO_WIN_STEP_MS = 300;
  let autoWinTimer = null;

  function autoWinStep() {
    if (!battleScreen.classList.contains('show')) { autoWinGun(); return; }
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

  // Dev tool (record book plan step A): the book's page, dark as the game
  // has it, or cold paper or cream, to compare. Seen on the next ask screen
  // (Test reload opens one).
  devBookPaperBtn.addEventListener('click', () => {
    const papers = BOOK.papers;
    state.settings.bookPaper = papers[(papers.indexOf(state.settings.bookPaper) + 1) % papers.length];
    devBookPaperBtn.textContent = 'Book paper: ' + state.settings.bookPaper + ' (dev)';
    refreshBook();
  });

  // Dev tool (light battery plan): the light goes on and off and runs on
  // its battery, or is always on, as before. Off, the light comes back on.
  devLightBatteryBtn.addEventListener('click', () => {
    state.settings.lightBattery = !state.settings.lightBattery;
    devLightBatteryBtn.textContent = state.settings.lightBattery ? 'Light battery: ON (dev)' : 'Light battery: OFF (dev)';
    devLightBatteryBtn.setAttribute('aria-pressed', String(state.settings.lightBattery));
    if (state.floor.playerRow === undefined) return;
    computeVisibility();
    refreshGunTarget();
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

  // Dev tool (static): the grain as stick men near, or "I see you." as
  // before, to compare.
  devStaticBtn.addEventListener('click', () => {
    state.settings.staticNoise = !state.settings.staticNoise;
    devStaticBtn.textContent = state.settings.staticNoise ? 'Static: ON (dev)' : 'Static: OFF (dev)';
    devStaticBtn.setAttribute('aria-pressed', String(state.settings.staticNoise));
    requestMapDraw();
  });

  // Dev tool (presence cues plan step D): the warning timer, to tune the
  // lamps by how long before a reach a stick man first showed.
  devWarningBtn.addEventListener('click', () => {
    state.settings.warningTimer = !state.settings.warningTimer;
    devWarningBtn.textContent = state.settings.warningTimer ? 'Warning timer: ON (dev)' : 'Warning timer: OFF (dev)';
    devWarningBtn.setAttribute('aria-pressed', String(state.settings.warningTimer));
  });

  // Dev tool (one stick plan step A): walk freely in real time with the
  // move keys held, or tile to tile as before. On, it turns Real time on.
  devOneStickBtn.addEventListener('click', () => {
    state.settings.oneStick = !state.settings.oneStick;
    syncDevOneStick();
    requestMapDraw();
  });

  // Dev tool (vents and noise plan step C): see who is in a duct and where
  // every pair of grates leads, to check the crawling in play.
  devShowDuctsBtn.addEventListener('click', () => {
    state.settings.showDucts = !state.settings.showDucts;
    devShowDuctsBtn.textContent = state.settings.showDucts ? 'Show ducts: ON (dev)' : 'Show ducts: OFF (dev)';
    devShowDuctsBtn.setAttribute('aria-pressed', String(state.settings.showDucts));
    requestMapDraw();
  });

  // Dev tool (steady aim plan step A): SELECT held steadies a shot, or the
  // dial as before. ?aim=steady or ?aim=dial in the address sets it at load.
  const showSteady = () => {
    devSteadyBtn.textContent = state.settings.steadyAim ? 'Steady aim: ON (dev)' : 'Steady aim: OFF (dev)';
    devSteadyBtn.setAttribute('aria-pressed', String(state.settings.steadyAim));
  };
  if (params.get('aim') === 'steady') state.settings.steadyAim = true;
  if (params.get('aim') === 'dial') state.settings.steadyAim = false;
  showSteady();
  devSteadyBtn.addEventListener('click', () => {
    state.settings.steadyAim = !state.settings.steadyAim;
    showSteady();
  });

  // Dev tool (downed plan step A): a shot that leaves a stick man on 1 HP
  // knocks it down, or it stays standing, as before. Only later shots
  // change: one already down stays down.
  devDownedBtn.addEventListener('click', () => {
    state.settings.downed = !state.settings.downed;
    devDownedBtn.textContent = state.settings.downed ? 'Downed: ON (dev)' : 'Downed: OFF (dev)';
    devDownedBtn.setAttribute('aria-pressed', String(state.settings.downed));
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


  // Dev tool (stick enemies plan): every stick enemy shows the one look
  // picked here: the walker (3D moves, one stick plan step F, the default),
  // or one of the seven odd poses from before, to compare.
  const LOOK_MODES = STICK_POSE_IDS;
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
    minions: f.minions.map(m => where(m) + (m.minionKind ? ' ' + m.minionKind + (m.guard ? ' guard' : '') + (m.downed ? ' downed' : '') : '')),
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
