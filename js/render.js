// DOM rendering: screens, the tile grid, fog of war, actor positioning,
// and the HUD (hearts / combat status / targeting / timer).
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state, key } from './state.js';
import { MAX_HEARTS, BOSS_HP, PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, VIEWPORT_SIZE } from './config.js';
import { lightProgress } from './light.js';
import { categoryLabel } from './quiz.js';
import { t } from './text.js';

let els = {};

export function initRender(elements) {
  els = elements;
}

export function showScreen(el) {
  [els.startScreen, els.introGlitch, els.roomScreen, els.battleScreen, els.winScreen, els.loseScreen].forEach(s => s.classList.remove('show'));
  el.classList.add('show');
  // Hearts/coins/turn/room/timer are meaningless before a run starts (and
  // during the intro glitch, which plays before the timer even starts), so
  // the header only shows them once the player has actually reached a room.
  els.statsEl.classList.toggle('show', el !== els.startScreen && el !== els.introGlitch);
}

// The rendered grid is always VIEWPORT_SIZE x VIEWPORT_SIZE, regardless of
// how big the room's own data (state.GRID_SIZE) is — the camera pans that
// fixed window over the larger world. Rebuilt once per room load; walls,
// fog, and the checkerboard are re-applied on every camera move instead
// (see renderWalls/renderFog), since which world tile lands in which
// viewport cell changes as the camera pans.
export function buildGridTiles() {
  els.grid.querySelectorAll('.tile').forEach(t => t.remove());
  els.grid.style.gridTemplateColumns = 'repeat(' + VIEWPORT_SIZE + ', 1fr)';
  els.grid.style.gridTemplateRows = 'repeat(' + VIEWPORT_SIZE + ', 1fr)';
  state.tileEls = new Array(VIEWPORT_SIZE * VIEWPORT_SIZE);
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      els.grid.insertBefore(tile, els.playerActor);
      state.tileEls[vr * VIEWPORT_SIZE + vc] = tile;
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi));
}

// Centers the viewport on the player, clamped so it never shows past the
// room's edge. Call this any time the player moves (or a room loads),
// before renderWalls()/renderFog()/positionActor() — they all read
// state.camRow/camCol to know which world tile belongs in which cell.
export function updateCamera() {
  state.camRow = clamp(state.playerRow - Math.floor(VIEWPORT_SIZE / 2), 0, state.GRID_SIZE - VIEWPORT_SIZE);
  state.camCol = clamp(state.playerCol - Math.floor(VIEWPORT_SIZE / 2), 0, state.GRID_SIZE - VIEWPORT_SIZE);
}

// Walls plus the checkerboard both key off world coordinates, so both are
// re-applied here from the current camera offset rather than only once at
// build time — the checkerboard would otherwise stay fixed to the screen
// instead of panning with the world.
export function renderWalls() {
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      const worldRow = state.camRow + vr;
      const worldCol = state.camCol + vc;
      const tile = state.tileEls[vr * VIEWPORT_SIZE + vc];
      tile.classList.toggle('b', (worldRow + worldCol) % 2 !== 0);
      tile.classList.toggle('wall', state.wallSet.has(key(worldRow, worldCol)));
    }
  }
}

// Facing vectors for the cone test below.
const FACING_VECTORS = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

// True if the tile at (row, col) falls within a 90-degree cone opening in
// `facing`'s direction from the player — a diamond that widens as it gets
// further away, using only integer math (no trig needed on a square grid).
// The player's own tile always passes (forward = lateral = 0).
function inFacingCone(row, col) {
  const [fr, fc] = FACING_VECTORS[state.facing];
  const dr = row - state.playerRow;
  const dc = col - state.playerCol;
  const forward = dr * fr + dc * fc;       // distance projected along facing
  const lateral = dr * fc - dc * fr;       // signed distance perpendicular to it
  return forward >= 0 && Math.abs(lateral) <= forward;
}

// The player's own light: every open tile within PLAYER_LIGHT_RADIUS steps,
// plus open tiles up to PLAYER_CONE_RANGE steps inside the facing cone.
// Walls fully block it (a lit cone never bleeds through a wall into an
// adjacent corridor). Everything the boss's light reaches is visible too
// (state.bossLitSet, from light.js) — the thing that ends the run is also
// what shows the player the way.
export function computeVisibility() {
  state.visibleSet = new Set(state.bossLitSet);
  const startKey = key(state.playerRow, state.playerCol);
  state.visibleSet.add(startKey);
  const reach = Math.max(PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE);
  const queue = [{ row: state.playerRow, col: state.playerCol, dist: 0 }];
  const seen = new Set([startKey]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist >= reach) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.GRID_SIZE || nc < 0 || nc >= state.GRID_SIZE) continue;
      const nk = key(nr, nc);
      if (seen.has(nk) || state.wallSet.has(nk)) continue;
      seen.add(nk);
      // Still traverse through out-of-cone tiles (a corridor can bend into
      // view further on), but only mark in-cone ones as actually visible.
      const dist = cur.dist + 1;
      if (dist <= PLAYER_LIGHT_RADIUS || inFacingCone(nr, nc)) state.visibleSet.add(nk);
      queue.push({ row: nr, col: nc, dist });
    }
  }
  // In the darkness after the boss, nothing is remembered: only what the
  // player's light touches right now can be seen.
  if (!state.darkness) state.visibleSet.forEach(k => state.exploredSet.add(k));
}

// Applies fog classes to every tile, and hides or shows the boss,
// minions, and coin based on whether their tile is currently lit.
// Explored-but-not-currently-visible tiles stay dimly remembered.
export function renderFog() {
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      const worldRow = state.camRow + vr;
      const worldCol = state.camCol + vc;
      const el = state.tileEls[vr * VIEWPORT_SIZE + vc];
      el.classList.remove('fog-hidden', 'fog-dim');
      const k = key(worldRow, worldCol);
      el.classList.toggle('boss-lit', state.bossLitSet.has(k));
      if (!state.fogEnabled) continue;
      if (state.visibleSet.has(k)) continue;
      el.classList.add(state.exploredSet.has(k) ? 'fog-dim' : 'fog-hidden');
    }
  }

  const isLit = (row, col) => !state.fogEnabled || state.visibleSet.has(key(row, col));

  if (state.boss) els.bossActor.classList.toggle('fog-hidden', !isLit(state.boss.row, state.boss.col));
  state.minions.forEach(m => m.el.classList.toggle('fog-hidden', !isLit(m.row, m.col)));
  els.coinActor.classList.toggle('fog-hidden', !!state.coin && !isLit(state.coin.row, state.coin.col));
  if (state.stairs) els.stairsActor.classList.toggle('fog-hidden', !isLit(state.stairs.row, state.stairs.col));
  els.chestActor.classList.toggle('fog-hidden', !!state.chest && !isLit(state.chest.row, state.chest.col));
  els.runeActor.classList.toggle('fog-hidden', !!state.rune && !isLit(state.rune.row, state.rune.col));
  state.encounters.forEach(e => e.el.classList.toggle('fog-hidden', !isLit(e.row, e.col)));
  renderLightHint();
}

// While the boss is off screen, the edge of the view facing it glows —
// brighter as its light spreads — so the player always has a sense of
// where it is. A diagonal boss lights two edges.
function renderLightHint() {
  const edges = els.lightHintEls;
  if (!edges) return;
  const boss = state.boss;
  const offScreen = !!boss && (boss.row < state.camRow || boss.row >= state.camRow + VIEWPORT_SIZE ||
    boss.col < state.camCol || boss.col >= state.camCol + VIEWPORT_SIZE);
  const strength = offScreen ? (0.25 + 0.6 * lightProgress()).toFixed(2) : '0';
  const dr = boss ? boss.row - state.playerRow : 0;
  const dc = boss ? boss.col - state.playerCol : 0;
  const on = {
    n: dr < 0 && Math.abs(dr) * 2 >= Math.abs(dc),
    s: dr > 0 && Math.abs(dr) * 2 >= Math.abs(dc),
    w: dc < 0 && Math.abs(dc) * 2 >= Math.abs(dr),
    e: dc > 0 && Math.abs(dc) * 2 >= Math.abs(dr),
  };
  Object.entries(edges).forEach(([side, el]) => { el.style.opacity = on[side] ? strength : '0'; });
}

// The eye in the status bar: shut when a room begins, opening as the boss
// light spreads, fully open (and twitching) as it's about to consume the
// floor. Drawn in CSS — the terminal font has no symbol glyphs.
export function renderLightEye() {
  const eye = els.lightEyeEl;
  if (!eye) return;
  const p = lightProgress();
  eye.style.setProperty('--open', p.toFixed(3));
  eye.classList.toggle('eye-near', p >= 0.8);
  const label = t('stat.light', { pct: Math.round(p * 100) });
  eye.title = label;
  eye.setAttribute('aria-label', label);
}

// row/col are world coordinates; this converts them to a position within
// the current camera window, and hides the actor entirely (off-screen)
// if the camera has panned past it.
//
// `instant` skips the actor's usual sliding transition. Use it whenever the
// screen position changes because the CAMERA panned (the actor's own world
// position didn't move) — otherwise every on-screen actor visibly drifts
// into place each time the player takes a step, since the camera re-centers
// on nearly every move. Real movement (a minion actually stepping to an
// adjacent tile) should keep the smooth slide, so leave `instant` false there.
export function positionActor(el, row, col, instant = false) {
  const screenRow = row - state.camRow;
  const screenCol = col - state.camCol;
  const offScreen = screenRow < 0 || screenRow >= VIEWPORT_SIZE || screenCol < 0 || screenCol >= VIEWPORT_SIZE;
  el.classList.toggle('off-screen', offScreen);
  if (offScreen) return;
  const cell = 100 / VIEWPORT_SIZE;
  if (instant) {
    el.classList.add('no-transition');
    el.style.left = (screenCol * cell) + '%';
    el.style.top = (screenRow * cell) + '%';
    el.style.width = cell + '%';
    el.style.height = cell + '%';
    void el.offsetWidth; // force layout so the class change above applies before it's removed
    el.classList.remove('no-transition');
    return;
  }
  el.style.left = (screenCol * cell) + '%';
  el.style.top = (screenRow * cell) + '%';
  el.style.width = cell + '%';
  el.style.height = cell + '%';
}

export function renderHearts() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.hearts, 0) + '/' + MAX_HEARTS;
}

// HP pips for whichever target is currently engaged on the battle screen.
// Only shown for a multi-hit fight — the boss, under the current constants
// (MINION_HP is always 1, and chest/rune/encounters have no hp at all).
// Gating on `target.kind === 'boss'` rather than `target.hp > 1` matters:
// hp is exactly 1 right before the boss's final, most dramatic hit, and the
// pips need to still show at that moment (and at hp 0, right after) rather
// than vanishing early.
export function renderCombatStatus() {
  const target = state.selectedTarget;
  if (!target || target.kind !== 'boss') {
    els.combatStatusEl.innerHTML = '';
    return;
  }
  const full = Math.max(target.hp, 0);
  const empty = Math.max(BOSS_HP - full, 0);
  const pips = '<span class="pip-full">' + '#'.repeat(full) + '</span>' +
    '<span class="pip-empty">' + '-'.repeat(empty) + '</span>';
  els.combatStatusEl.innerHTML = 'HP: ' + pips;
}

export function renderTargeting() {
  els.bossActor.classList.toggle('targeted', !!state.boss && state.selectedTarget === state.boss);
  state.minions.forEach(m => m.el.classList.toggle('targeted', state.selectedTarget === m));
  els.chestActor.classList.toggle('targeted', state.selectedTarget === state.chest);
  els.runeActor.classList.toggle('targeted', state.selectedTarget === state.rune);
  state.encounters.forEach(e => e.el.classList.toggle('targeted', state.selectedTarget === e));

  const target = state.selectedTarget;
  els.targetLabelEl.textContent = target
    ? t('target.' + target.kind, { category: target.category ? categoryLabel(target.category) : '' })
    : t('target.none');

  const isObject = state.selectedTarget &&
    (state.selectedTarget.kind === 'chest' || state.selectedTarget.kind === 'rune' || state.selectedTarget.kind === 'encounter');
  els.attackBtn.textContent = t(isObject ? 'battle.attempt' : 'battle.attack');
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
