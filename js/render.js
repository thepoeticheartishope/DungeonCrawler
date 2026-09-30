// DOM rendering around the map: screens, the edge glow and d-pad hints,
// and the HUD (hearts / combat status / targeting / timer). The map
// itself is drawn on a canvas by mapview.js.
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state } from './state.js';
import { MAX_HEARTS, BOSS_HP, VIEWPORT_SIZE } from './config.js';
import { lightProgress } from './light.js';
import { whatBlocks } from './passage.js';
import { FACING_VECTORS } from './sight.js';
import { categoryLabel } from './quiz.js';
import { isoScreenShare, isoScreenOffset } from './isoview.js';
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

// How far away (in steps, as the crow flies) the hunter's edge glow starts
// to brighten.
const HUNTER_HINT_RANGE = 20;

// The room screen's hints around the map: the edge glow toward an
// off-screen boss or hunter, and which d-pad directions are open. Call
// after anything that moves the player, the camera or what's around them.
export function renderRoomHints() {
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
    const row = state.floor.playerRow + dr, col = state.floor.playerCol + dc;
    const block = whatBlocks(row, col);
    const unreadPaper = !block && state.floor.props.some(p => p.kind === 'paper' && !p.searched && p.row === row && p.col === col);
    const examine = unreadPaper || (!!block && block.kind === 'prop' && !block.thing.searched);
    btn.classList.toggle('move-examine', examine);
    btn.classList.toggle('move-blocked', !!block && !examine);
  }
}

// While the boss is off screen, the edge of the view facing it glows —
// brighter as its light spreads — so the player always has a sense of
// where it is. A diagonal boss lights two edges. The edges are screen
// edges, so in the isometric view they follow where the diamond puts it
// (grid north is up and to the right there).
//
// After the boss, the same edges point at the hunter instead (in white,
// not the boss's blue), brighter the closer it gets.
function renderLightHint() {
  const edges = els.lightHintEls;
  if (!edges) return;
  const boss = state.floor.boss || state.floor.hunter;
  const { dx, dy, offScreen } = boss ? placeOnScreen(boss) : { dx: 0, dy: 0, offScreen: false };
  const near = state.floor.hunter && !state.floor.boss
    ? 1 - Math.min(1, (Math.abs(boss.row - state.floor.playerRow) + Math.abs(boss.col - state.floor.playerCol)) / HUNTER_HINT_RANGE)
    : lightProgress();
  const strength = offScreen ? (0.25 + 0.6 * near).toFixed(2) : '0';
  Object.values(edges).forEach(el => el.classList.toggle('hunter-hint', !state.floor.boss && !!state.floor.hunter));
  const on = {
    n: dy < 0 && Math.abs(dy) * 2 >= Math.abs(dx),
    s: dy > 0 && Math.abs(dy) * 2 >= Math.abs(dx),
    w: dx < 0 && Math.abs(dx) * 2 >= Math.abs(dy),
    e: dx > 0 && Math.abs(dx) * 2 >= Math.abs(dy),
  };
  Object.entries(edges).forEach(([side, el]) => { el.style.opacity = on[side] ? strength : '0'; });
}

// Where a thing is on the map compared with the player, in the view being
// drawn: dx right and dy down (any unit, only the direction is used), and
// whether it is off the map. Top-down, that's its grid offset and the
// camera's window; isometric, its place on the diamond.
function placeOnScreen(thing) {
  if (state.settings.isoView) {
    const at = isoScreenShare(thing.row, thing.col);
    const { x, y } = isoScreenOffset(thing.row - state.floor.playerRow, thing.col - state.floor.playerCol);
    return { dx: x, dy: y, offScreen: at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1 };
  }
  const f = state.floor;
  return {
    dx: thing.col - f.playerCol,
    dy: thing.row - f.playerRow,
    offScreen: thing.row < f.camRow || thing.row >= f.camRow + VIEWPORT_SIZE ||
      thing.col < f.camCol || thing.col >= f.camCol + VIEWPORT_SIZE,
  };
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

// Status bar numbers: hearts, gold and turn count. Call after any change to them.
export function renderHud() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.run.hearts, 0) + '/' + MAX_HEARTS;
  els.coinsTotalEl.textContent = state.run.coinsTotal;
  els.turnCountEl.textContent = state.run.turnCount;
}

// HP pips for whichever target is currently engaged on the battle screen.
// Only shown for a multi-hit fight — the boss, under the current constants
// (MINION_HP is always 1, and chest/rune/encounters have no hp at all).
// Gating on `target.kind === 'boss'` rather than `target.hp > 1` matters:
// hp is exactly 1 right before the boss's final, most dramatic hit, and the
// pips need to still show at that moment (and at hp 0, right after) rather
// than vanishing early.
export function renderCombatStatus() {
  const target = state.battle.selectedTarget;
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

// The battle screen's target line and the attack button's wording. The
// box round the target on the map is drawn by mapview.js.
export function renderTargeting() {
  const target = state.battle.selectedTarget;
  els.targetLabelEl.textContent = target
    ? t('target.' + target.kind, { category: target.category ? categoryLabel(target.category) : '' })
    : t('target.none');

  const isObject = state.battle.selectedTarget &&
    ['chest', 'rune', 'encounter', 'box'].includes(state.battle.selectedTarget.kind);
  els.attackBtn.textContent = t(isObject ? 'battle.attempt' : 'battle.attack');
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

let timerHandle = null;

export function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

export function startTimer() {
  stopTimer();
  state.run.seconds = 0;
  els.timerEl.textContent = formatTime(0);
  timerHandle = setInterval(() => {
    state.run.seconds++;
    els.timerEl.textContent = formatTime(state.run.seconds);
  }, 1000);
}
