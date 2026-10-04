// DEV panel in the status bar: Skip room, Auto-win, Fog, Camera and Combat
// toggles, a test shot and a test reload, for testing. main.js passes in the game actions and elements it needs.
import { state } from './state.js';
import { requestMapDraw } from './mapview.js';
import { renderRoomHints } from './render.js';

const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devAutoWinBtn = document.getElementById('devAutoWinBtn');
const devFogBtn = document.getElementById('devFogBtn');
const devCameraBtn = document.getElementById('devCameraBtn');
const devCombatBtn = document.getElementById('devCombatBtn');
const devShotBtn = document.getElementById('devShotBtn');
const devReloadBtn = document.getElementById('devReloadBtn');

export function initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, leaveEncounter, devTestShot, devTestReload, endGunTests,
  battleScreen, wagerRow,
}) {
  devToggleBtn.addEventListener('click', () => {
    devPanel.classList.toggle('show');
  });

  // Dev tool: jump to the next room instantly, skipping combat, for
  // faster testing of dungeon generation across levels.
  devSkipBtn.addEventListener('click', () => {
    if (state.run.hearts <= 0) return;
    advanceRoom();
  });

  // Dev tool: while on, every encounter plays itself out — the first query
  // category is picked, the correct answer given, and CONTINUE pressed — one
  // step every AUTO_WIN_STEP_MS so the log stays readable. Walking stays
  // manual, so the boss light, minions and darkness behave as usual.
  const AUTO_WIN_STEP_MS = 300;
  let autoWinTimer = null;

  function autoWinStep() {
    if (!battleScreen.classList.contains('show') || state.run.turnLocked || state.run.runEnded) return;
    if (state.battle.battlePhase === 'choosing') chooseCategory(0);
    else if (!wagerRow.hidden) placeWager(1);
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

  // Dev tool: the isometric camera glides after the player, or stays locked
  // on them as it did before, so the two can be compared in play.
  devCameraBtn.addEventListener('click', () => {
    state.settings.isoCameraGlide = !state.settings.isoCameraGlide;
    devCameraBtn.textContent = state.settings.isoCameraGlide ? 'Camera: glide (dev)' : 'Camera: locked (dev)';
    devCameraBtn.setAttribute('aria-pressed', String(state.settings.isoCameraGlide));
    requestMapDraw();
    renderRoomHints();
  });

  // Dev tool (gun plan): classic combat, or the gun on the map. For now it
  // only switches the map's drawing (the gun, its reach, the target picked
  // by a tap) and shows Test shot and Test reload; step 6 puts the gun's
  // rules behind it.
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

function floorSummary() {
  const f = state.floor;
  return {
    grid: f.GRID_SIZE,
    player: f.playerRow + ',' + f.playerCol + ' ' + f.facing,
    boss: f.boss && where(f.boss) + ' hp ' + f.boss.hp,
    hunter: where(f.hunter),
    darkness: f.darkness,
    darkTurns: f.darkTurns,
    lightTurns: f.lightTurns + ' / ' + f.lightTurnBudget,
    lightSlack: f.lightSlack + ' (loss ' + Math.round(f.lightLossShare * 100) + '%)',
    minions: f.minions.map(m => where(m) + (m.minionKind ? ' ' + m.minionKind + ' hp ' + m.hpLeft : '')),
    gunTarget: where(f.gunTarget),
    props: f.props.length,
    encounters: f.encounters.length,
    chest: where(f.chest),
    rune: where(f.rune),
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
