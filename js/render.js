// DOM rendering around the map: screens, the edge glow and d-pad hints,
// and the HUD (hearts / combat status / targeting / timer). The map
// itself is drawn on a canvas by mapview.js.
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state } from './state.js';
import { BOSS_HP, GUN_CHAMBER, MINION_KINDS } from './config.js';
import { lightProgress } from './light.js';
import { whatBlocks } from './passage.js';
import { FACING_VECTORS, shootBlock, aimChance } from './sight.js';
import { categoryLabel } from './quiz.js';
import { isoScreenShare, isoScreenOffset } from './isoview.js';
import { clockReading } from './realclock.js';
import { t } from './text.js';

let els = {};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function initRender(elements) {
  els = elements;
}

export function showScreen(el) {
  [els.startScreen, els.introGlitch, els.roomScreen, els.battleScreen, els.exchangeScreen, els.winScreen, els.loseScreen].forEach(s => s.classList.remove('show'));
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
// not yet gone through lights up, since that press reads or examines it;
// so does THE UNFOLDING, which a press opens.
function renderMoveHints() {
  const buttons = els.dpadButtons;
  if (!buttons) return;
  for (const [dir, [dr, dc]] of Object.entries(FACING_VECTORS)) {
    const btn = buttons[dir];
    if (!btn) continue;
    const row = state.floor.playerRow + dr, col = state.floor.playerCol + dc;
    const block = whatBlocks(row, col);
    const unreadPaper = !block && state.floor.props.some(p => p.kind === 'paper' && !p.searched && p.row === row && p.col === col);
    const examine = unreadPaper || (!!block && block.kind === 'prop' && !block.thing.searched) ||
      (!!block && block.kind === 'exchange');
    btn.classList.toggle('move-examine', examine);
    btn.classList.toggle('move-blocked', !!block && !examine);
  }
}

// While the boss is off screen, the edge of the view facing it glows —
// brighter as its light spreads — so the player always has a sense of
// where it is. A diagonal boss lights two edges. The edges are screen
// edges, so they follow where the diamond puts it (grid north is up and
// to the right).
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

// Where a thing is on the map compared with the player, by its place on
// the diamond: dx right and dy down (any unit, only the direction is
// used), and whether it is off the map.
function placeOnScreen(thing) {
  const at = isoScreenShare(thing.row, thing.col);
  const { x, y } = isoScreenOffset(thing.row - state.floor.playerRow, thing.col - state.floor.playerCol);
  return { dx: x, dy: y, offScreen: at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1 };
}

// The eye in the status bar: shut when a room begins, opening as the boss
// light spreads, fully open (and twitching) as it's about to consume the
// floor. Drawn in CSS — the terminal font has no symbol glyphs.
export function renderLightEye() {
  const eye = els.lightEyeEl;
  if (!eye) return;
  // A rest floor has no light. Hidden, not removed, so the bar keeps its shape.
  eye.style.visibility = state.run.resting ? 'hidden' : '';
  const p = lightProgress();
  eye.style.setProperty('--open', p.toFixed(3));
  eye.classList.toggle('eye-near', p >= 0.8);
  const label = t('stat.light', { pct: Math.round(p * 100) });
  eye.title = label;
  eye.setAttribute('aria-label', label);
}

// Status bar numbers: hearts, gold, turn count and the depth (REST on a
// rest floor, which isn't a depth). Call after any change to them.
export function renderHud() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.run.hearts, 0) + '/' + state.run.maxHearts;
  els.coinsTotalEl.textContent = state.run.coinsTotal;
  els.turnCountEl.textContent = state.run.turnCount;
  els.roomNumEl.textContent = state.run.resting ? t('stat.rest') : state.run.roomIndex + 1;
  els.roomOfEl.style.display = state.run.resting ? 'none' : '';
  els.roomTotalEl.textContent = state.run.order.length;
  renderGunHud();
}

// The NEXT meter (Real time only): how long until the world next moves.
// Its edge runs slowly across and reaches the far end as the world moves,
// filling the meter one step and emptying it the next, so it never jumps.
// Dim while the clock is paused (`running` false). Under reduced motion it
// moves in still quarter steps instead of gliding. Called on each clock
// poll (main.js clockTick).
export function renderClock(running) {
  els.clockStat.hidden = !state.settings.realTime;
  if (!state.settings.realTime) return;
  const { share, filling } = clockReading();
  const edge = reducedMotion.matches ? Math.floor(share * 4) / 4 : share;
  els.clockFill.style.left = (filling ? 0 : edge) * 100 + '%';
  els.clockFill.style.width = (filling ? edge : 1 - edge) * 100 + '%';
  els.clockStat.classList.toggle('clock-held', !running);
}

// The gun's part of the HUD (gun plan step 6), shown only with DEV ->
// Combat on gun: rounds in the chamber, the target and its hp, the aim %
// (or '-' when the target can't be shot), and whether RELOAD and FIRE
// can be pressed. Part of renderHud, the one writer of the HUD.
function renderGunHud() {
  const on = state.settings.gunCombat;
  [els.gunRoundsStat, els.gunTargetStat, els.gunAimStat, els.gunActions].forEach(el => { el.hidden = !on; });
  if (!on) return;
  const ammo = state.run.ammo;
  els.gunRounds.textContent = '#'.repeat(ammo) + '-'.repeat(Math.max(GUN_CHAMBER - ammo, 0));
  const target = state.floor.gunTarget;
  els.gunTarget.textContent = target ? gunTargetName(target) : t('stat.noTarget');
  els.gunAim.textContent = target && !shootBlock(target)
    ? t('gun.aimChance', { chance: Math.round(aimChance(target) * 100) })
    : t('stat.noTarget');
  els.btnReload.disabled = state.run.runEnded || ammo >= GUN_CHAMBER;
  els.btnFire.disabled = state.run.runEnded || ammo <= 0;
}

// The HUD's name for the gun's target: a minion's kind and its hp (# left,
// - lost), or the hunter, which has no hp.
function gunTargetName(target) {
  if (target.kind === 'hunter') return t('term.hunter');
  const hp = MINION_KINDS[target.minionKind].hp;
  return t('minionKind.' + target.minionKind) + ' ' + '#'.repeat(target.hpLeft) + '-'.repeat(hp - target.hpLeft);
}

// HP pips for whichever target is currently engaged on the battle screen.
// Only shown for a multi-hit fight — the boss, under the current constants
// (a minion's fight still settles in one answer, and chest/rune/encounters
// have no hp at all).
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
