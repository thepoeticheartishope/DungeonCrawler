// DOM rendering: screens, the tile grid, fog of war, actor positioning,
// and the HUD (hearts / combat status / targeting / timer).
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state, key } from './state.js';
import { MAX_HEARTS, BOSS_HP, VIEWPORT_SIZE } from './config.js';
import { lightProgress } from './light.js';
import { whatBlocks } from './passage.js';
import { canMakeOut, FACING_VECTORS } from './sight.js';
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

// Walls, pillars and the checkerboard all key off world
// coordinates, so they're re-applied here from the current camera offset
// rather than only once at build time — they'd otherwise stay fixed to
// the screen instead of panning with the world.
export function renderWalls() {
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      const worldRow = state.camRow + vr;
      const worldCol = state.camCol + vc;
      const tile = state.tileEls[vr * VIEWPORT_SIZE + vc];
      const k = key(worldRow, worldCol);
      tile.classList.toggle('b', (worldRow + worldCol) % 2 !== 0);
      tile.classList.toggle('wall', state.wallSet.has(k));
      tile.classList.toggle('pillar', state.pillarSet.has(k));
    }
  }
}

// Sets an actor's real map glyph. renderFog shows it, or '?' while the
// actor is too far away to make out.
export function setGlyph(el, glyph) {
  el.dataset.glyph = glyph;
  el.textContent = glyph;
}

// How far away (in steps, as the crow flies) the hunter's edge glow starts
// to brighten.
const HUNTER_HINT_RANGE = 20;

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
  const isNear = canMakeOut;
  // Too far to make out: a '?' instead of the real glyph (and none of the
  // hostile glow, which would give an enemy away).
  const showGlyph = (el, known) => {
    el.classList.toggle('unknown', !known);
    const glyph = known ? el.dataset.glyph : t('term.unknown.symbol');
    if (glyph !== undefined && el.textContent !== glyph) el.textContent = glyph;
  };

  if (state.boss) {
    els.bossActor.classList.toggle('fog-hidden', !isLit(state.boss.row, state.boss.col));
    showGlyph(els.bossActor, isNear(state.boss.row, state.boss.col));
  }
  state.minions.forEach(m => {
    m.el.classList.toggle('fog-hidden', !isLit(m.row, m.col));
    showGlyph(m.el, isNear(m.row, m.col));
  });
  els.coinActor.classList.toggle('fog-hidden', !!state.coin && !isLit(state.coin.row, state.coin.col));
  if (state.coin) showGlyph(els.coinActor, isNear(state.coin.row, state.coin.col));
  // The stairs are never lost in the fog: they're the way out, and they
  // stay visible whenever they're on screen — including in the darkness
  // after the boss, when nothing else is remembered — so leaving or
  // staying for double gold is always a clear choice.
  if (state.stairs) els.stairsActor.classList.remove('fog-hidden');
  els.chestActor.classList.toggle('fog-hidden', !!state.chest && !isLit(state.chest.row, state.chest.col));
  if (state.chest) showGlyph(els.chestActor, isNear(state.chest.row, state.chest.col));
  els.runeActor.classList.toggle('fog-hidden', !!state.rune && !isLit(state.rune.row, state.rune.col));
  if (state.rune) showGlyph(els.runeActor, isNear(state.rune.row, state.rune.col));
  state.encounters.forEach(e => {
    e.el.classList.toggle('fog-hidden', !isLit(e.row, e.col));
    showGlyph(e.el, isNear(e.row, e.col));
  });
  // Papers and boxes don't move, so once seen they stay dimly remembered
  // on explored floor (not in the darkness, where nothing is). They keep
  // their '?' until the player has been close enough to make them out.
  state.props.forEach(p => {
    const k = key(p.row, p.col);
    const lit = isLit(p.row, p.col);
    if (isNear(p.row, p.col)) p.identified = true;
    const remembered = state.fogEnabled && !lit && !state.darkness && state.exploredSet.has(k);
    p.el.classList.toggle('fog-hidden', !lit && !remembered);
    p.el.classList.toggle('remembered', remembered);
    showGlyph(p.el, !state.fogEnabled || p.identified);
    // A paper under the player or a minion is hidden, so glyphs don't pile up.
    const covered = p.kind === 'paper' && ((state.playerRow === p.row && state.playerCol === p.col) ||
      state.minions.some(m => m.row === p.row && m.col === p.col));
    p.el.classList.toggle('covered', covered);
  });
  renderLightHint();
  renderMoveHints();
}

// The d-pad shows which ways the player can go: a blocked direction dims
// (pressing it still turns to look that way), and one with a paper or box
// not yet gone through lights up, since that press reads or examines it.
function renderMoveHints() {
  const buttons = els.dpadButtons;
  if (!buttons) return;
  for (const [dir, [dr, dc]] of Object.entries(FACING_VECTORS)) {
    const btn = buttons[dir];
    if (!btn) continue;
    const row = state.playerRow + dr, col = state.playerCol + dc;
    const block = whatBlocks(row, col);
    const unreadPaper = !block && state.props.some(p => p.kind === 'paper' && !p.searched && p.row === row && p.col === col);
    const examine = unreadPaper || (!!block && block.kind === 'prop' && !block.thing.searched);
    btn.classList.toggle('move-examine', examine);
    btn.classList.toggle('move-blocked', !!block && !examine);
  }
}

// A quick nudge toward `facing` and back — the feel of walking into
// something, alongside the d-pad's blocked look.
export function bumpActor(el, facing) {
  const [dr, dc] = FACING_VECTORS[facing];
  el.style.setProperty('--bump-x', (dc * 18) + '%');
  el.style.setProperty('--bump-y', (dr * 18) + '%');
  el.classList.remove('bump');
  void el.offsetWidth; // restart the animation on a repeat bump
  el.classList.add('bump');
}

// While the boss is off screen, the edge of the view facing it glows —
// brighter as its light spreads — so the player always has a sense of
// where it is. A diagonal boss lights two edges.
//
// After the boss, the same edges point at the hunter instead (in white,
// not the boss's blue), brighter the closer it gets.
function renderLightHint() {
  const edges = els.lightHintEls;
  if (!edges) return;
  const boss = state.boss || state.hunter;
  const offScreen = !!boss && (boss.row < state.camRow || boss.row >= state.camRow + VIEWPORT_SIZE ||
    boss.col < state.camCol || boss.col >= state.camCol + VIEWPORT_SIZE);
  const near = state.hunter && !state.boss
    ? 1 - Math.min(1, (Math.abs(boss.row - state.playerRow) + Math.abs(boss.col - state.playerCol)) / HUNTER_HINT_RANGE)
    : lightProgress();
  const strength = offScreen ? (0.25 + 0.6 * near).toFixed(2) : '0';
  Object.values(edges).forEach(el => el.classList.toggle('hunter-hint', !state.boss && !!state.hunter));
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

// Status bar numbers: hearts, gold and turn count. Call after any change to them.
export function renderHud() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.hearts, 0) + '/' + MAX_HEARTS;
  els.coinsTotalEl.textContent = state.coinsTotal;
  els.turnCountEl.textContent = state.turnCount;
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
  state.props.forEach(p => p.el.classList.toggle('targeted', state.selectedTarget === p));

  const target = state.selectedTarget;
  els.targetLabelEl.textContent = target
    ? t('target.' + target.kind, { category: target.category ? categoryLabel(target.category) : '' })
    : t('target.none');

  const isObject = state.selectedTarget &&
    ['chest', 'rune', 'encounter', 'box'].includes(state.selectedTarget.kind);
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
