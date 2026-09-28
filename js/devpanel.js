// DEV panel in the status bar: Skip room, Auto-win and Fog toggles, for
// testing. main.js passes in the game actions and elements it needs.
import { state } from './state.js';
import { renderFog } from './render.js';

const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devAutoWinBtn = document.getElementById('devAutoWinBtn');
const devFogBtn = document.getElementById('devFogBtn');

export function initDevPanel({
  advanceRoom, chooseCategory, placeWager, attemptAnswerMC, leaveEncounter,
  battleScreen, wagerRow,
}) {
  devToggleBtn.addEventListener('click', () => {
    devPanel.classList.toggle('show');
  });

  // Dev tool: jump to the next room instantly, skipping combat, for
  // faster testing of dungeon generation across levels.
  devSkipBtn.addEventListener('click', () => {
    if (state.hearts <= 0) return;
    advanceRoom();
  });

  // Dev tool: while on, every encounter plays itself out — the first query
  // category is picked, the correct answer given, and CONTINUE pressed — one
  // step every AUTO_WIN_STEP_MS so the log stays readable. Walking stays
  // manual, so the boss light, minions and darkness behave as usual.
  const AUTO_WIN_STEP_MS = 300;
  let autoWinTimer = null;

  function autoWinStep() {
    if (!battleScreen.classList.contains('show') || state.turnLocked || state.runEnded) return;
    if (state.battlePhase === 'choosing') chooseCategory(0);
    else if (!wagerRow.hidden) placeWager(1);
    else if (state.battlePhase === 'answering' && state.selectedTarget) attemptAnswerMC(state.currentQuestion.meaning);
    else if (state.battlePhase === 'ended') leaveEncounter();
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
    state.fogEnabled = !state.fogEnabled;
    devFogBtn.textContent = state.fogEnabled ? 'Fog: ON (dev)' : 'Fog: OFF (dev)';
    renderFog();
  });
}
