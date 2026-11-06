// DEV panel (only with ?dev on the address: a small tag in the corner, its
// panel over the screen): Skip room, Auto-win, Learn all roles, Fog, Book
// paper, One stick, Minigame, Inspect, and the map's frame meter, for testing.
// main.js passes in the game actions and elements it needs.
import { state } from './state.js';
import { requestMapDraw, mapDrawTimes } from './mapview.js';
import { MINIGAMES } from './minigames.js';
import { lookAngle, bodyAngle } from './look.js';
import { refreshBook } from './bookview.js';
import { BOOK, SHIP_ROLES } from './config.js';

const devDock = document.getElementById('devDock');
const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devAutoWinBtn = document.getElementById('devAutoWinBtn');
const devLearnRolesBtn = document.getElementById('devLearnRolesBtn');
const devFogBtn = document.getElementById('devFogBtn');
const devBookPaperBtn = document.getElementById('devBookPaperBtn');
const devFrameOut = document.getElementById('devFrameOut');
const devMinigameBtn = document.getElementById('devMinigameBtn');

export function initDevPanel({ advanceRoom, autoWinGun }) {
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

  // Dev tool: lays the ship out again at once.
  devSkipBtn.addEventListener('click', () => {
    if (state.run.hearts <= 0) return;
    advanceRoom();
  });

  // Dev tool: while on, a question on the ask screen plays itself out: the
  // right answer given (a minigame is played out at X) and the book held
  // after it closed (gunactions.js autoWinGun), one step every
  // AUTO_WIN_STEP_MS so the log stays readable. Walking stays manual.
  const AUTO_WIN_STEP_MS = 300;
  let autoWinTimer = null;

  devAutoWinBtn.addEventListener('click', () => {
    const on = !autoWinTimer;
    if (on) autoWinTimer = setInterval(autoWinGun, AUTO_WIN_STEP_MS);
    else { clearInterval(autoWinTimer); autoWinTimer = null; }
    devAutoWinBtn.textContent = on ? 'Auto-win: ON (dev)' : 'Auto-win: OFF (dev)';
    devAutoWinBtn.setAttribute('aria-pressed', String(on));
  });

  // Dev tool (crew roles plan step A): every crew role learned at once, so
  // their jobs can be tried before learning at the console exists.
  devLearnRolesBtn.addEventListener('click', () => {
    state.run.trained = ['engineer', ...SHIP_ROLES.map(r => r.id)];
    devLearnRolesBtn.textContent = 'All roles learned (dev)';
  });

  // Dev tool: reveal the whole map instantly, to check that the layout,
  // boss placement, and entities are generating correctly under the fog.
  devFogBtn.addEventListener('click', () => {
    state.settings.fogEnabled = !state.settings.fogEnabled;
    devFogBtn.textContent = state.settings.fogEnabled ? 'Fog: ON (dev)' : 'Fog: OFF (dev)';
    requestMapDraw();
  });

  // Dev tool (record book plan step A): the book's page, dark as the game
  // has it, or cold paper or cream, to compare. Seen on the next ask screen.
  devBookPaperBtn.addEventListener('click', () => {
    const papers = BOOK.papers;
    state.settings.bookPaper = papers[(papers.indexOf(state.settings.bookPaper) + 1) % papers.length];
    devBookPaperBtn.textContent = 'Book paper: ' + state.settings.bookPaper + ' (dev)';
    refreshBook();
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
    props: f.props.length,
    chest: where(f.chest),
    stairs: f.stairs && f.stairs.row + ',' + f.stairs.col,
    lastChoiceType: f.lastChoiceType,
    sets: {
      walls: f.wallSet.size, pillars: f.pillarSet.size, visible: f.visibleSet.size,
      explored: f.exploredSet.size,
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
