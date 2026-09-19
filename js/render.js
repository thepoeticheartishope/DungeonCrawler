// DOM rendering: screens, the tile grid, fog of war, actor positioning,
// and the HUD (hearts / combat status / targeting / timer).
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state, key } from './state.js';
import { MAX_HEARTS, BOSS_HP, VISION_RADIUS } from './config.js';

let els = {};

export function initRender(elements) {
  els = elements;
}

export function showScreen(el) {
  [els.startScreen, els.roomScreen, els.winScreen, els.loseScreen].forEach(s => s.classList.remove('show'));
  el.classList.add('show');
}

export function buildGridTiles() {
  els.grid.querySelectorAll('.tile').forEach(t => t.remove());
  els.grid.style.gridTemplateColumns = 'repeat(' + state.GRID_SIZE + ', 1fr)';
  els.grid.style.gridTemplateRows = 'repeat(' + state.GRID_SIZE + ', 1fr)';
  state.tileEls = new Array(state.GRID_SIZE * state.GRID_SIZE);
  for (let r = 0; r < state.GRID_SIZE; r++) {
    for (let c = 0; c < state.GRID_SIZE; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile' + ((r + c) % 2 === 0 ? '' : ' b');
      els.grid.insertBefore(tile, els.playerActor);
      state.tileEls[r * state.GRID_SIZE + c] = tile;
    }
  }
}

export function renderWalls() {
  state.tileEls.forEach(t => t.classList.remove('wall'));
  state.wallSet.forEach(k => {
    const [r, c] = k.split(',').map(Number);
    state.tileEls[r * state.GRID_SIZE + c].classList.add('wall');
  });
}

// Sweeps outward from the player through open floor, stopping at walls
// and at VISION_RADIUS steps. This is what makes fog "line-of-sight
// aware" — vision travels down corridors and fills rooms, but never
// passes through a wall.
export function computeVisibility() {
  state.visibleSet = new Set();
  const startKey = key(state.playerRow, state.playerCol);
  state.visibleSet.add(startKey);
  const queue = [{ row: state.playerRow, col: state.playerCol, dist: 0 }];
  const seen = new Set([startKey]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist >= VISION_RADIUS) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.GRID_SIZE || nc < 0 || nc >= state.GRID_SIZE) continue;
      const nk = key(nr, nc);
      if (seen.has(nk) || state.wallSet.has(nk)) continue;
      seen.add(nk);
      state.visibleSet.add(nk);
      queue.push({ row: nr, col: nc, dist: cur.dist + 1 });
    }
  }
  state.visibleSet.forEach(k => state.exploredSet.add(k));
}

// Applies fog classes to every tile, and hides or shows the boss,
// minions, and coin based on whether their tile is currently lit.
// Explored-but-not-currently-visible tiles stay dimly remembered.
export function renderFog() {
  for (let r = 0; r < state.GRID_SIZE; r++) {
    for (let c = 0; c < state.GRID_SIZE; c++) {
      const el = state.tileEls[r * state.GRID_SIZE + c];
      el.classList.remove('fog-hidden', 'fog-dim');
      if (!state.fogEnabled) continue;
      const k = key(r, c);
      if (state.visibleSet.has(k)) continue;
      el.classList.add(state.exploredSet.has(k) ? 'fog-dim' : 'fog-hidden');
    }
  }

  const isLit = (row, col) => !state.fogEnabled || state.visibleSet.has(key(row, col));

  if (state.boss) els.bossActor.classList.toggle('fog-hidden', !isLit(state.boss.row, state.boss.col));
  state.minions.forEach(m => m.el.classList.toggle('fog-hidden', !isLit(m.row, m.col)));
  els.coinActor.classList.toggle('fog-hidden', !!state.coin && !isLit(state.coin.row, state.coin.col));
  els.chestActor.classList.toggle('fog-hidden', !!state.chest && !isLit(state.chest.row, state.chest.col));
  els.runeActor.classList.toggle('fog-hidden', !!state.rune && !isLit(state.rune.row, state.rune.col));
}

export function positionActor(el, row, col) {
  const cell = 100 / state.GRID_SIZE;
  el.style.left = (col * cell) + '%';
  el.style.top = (row * cell) + '%';
  el.style.width = cell + '%';
  el.style.height = cell + '%';
}

export function renderHearts() {
  els.heartsEl.textContent = '♥'.repeat(state.hearts) + '♡'.repeat(MAX_HEARTS - state.hearts);
}

export function renderCombatStatus() {
  const full = Math.max(state.boss.hp, 0);
  const empty = Math.max(BOSS_HP - full, 0);
  const pips = '<span class="pip-full">' + '♦'.repeat(full) + '</span>' +
    '<span class="pip-empty">' + '♦'.repeat(empty) + '</span>';
  els.combatStatusEl.innerHTML = 'Boss HP: ' + pips + ' · Minions: ' + state.minions.length;
}

export function renderTargeting() {
  els.bossActor.classList.toggle('targeted', state.selectedTarget === state.boss);
  state.minions.forEach(m => m.el.classList.toggle('targeted', state.selectedTarget === m));
  els.chestActor.classList.toggle('targeted', state.selectedTarget === state.chest);
  els.runeActor.classList.toggle('targeted', state.selectedTarget === state.rune);

  const kindLabels = { boss: 'Boss', minion: 'Minion', chest: 'Chest', rune: 'Rune' };
  els.targetLabelEl.textContent = state.selectedTarget
    ? 'Target: ' + (kindLabels[state.selectedTarget.kind] || 'Minion')
    : 'Target: none — move next to something';

  const isObject = state.selectedTarget && (state.selectedTarget.kind === 'chest' || state.selectedTarget.kind === 'rune');
  els.attackBtn.textContent = isObject ? 'Attempt' : 'Attack';
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function startTimer() {
  clearInterval(state.timerHandle);
  state.seconds = 0;
  els.timerEl.textContent = formatTime(0);
  state.timerHandle = setInterval(() => {
    state.seconds++;
    els.timerEl.textContent = formatTime(state.seconds);
  }, 1000);
}
