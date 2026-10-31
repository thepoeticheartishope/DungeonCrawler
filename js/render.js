// DOM rendering around the map: screens, the edge glow and d-pad hints,
// and the HUD (hearts / combat status / targeting / timer). The map
// itself is drawn on a canvas by mapview.js.
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state, key } from './state.js';
import { ENERGY_MAX, SENSE_NOTE_MS, LIGHT_BATTERY_MAX, ANSWER_LINE_FADE_MS, BOOK, SHIP_RUN, SHIP_LOW_SECONDS } from './config.js';
import { drawTube, TUBE_W, TUBE_H } from './tubeart.js';
import { batteryInPlay } from './battery.js';
import { lightProgress } from './light.js';
import { whatBlocks, canPassCorner } from './passage.js';
import { SCREEN_WAYS, padWay } from './dpad.js';
import { FACING_VECTORS } from './sight.js';
import { waysInUse } from './look.js';
import { clockReading } from './realclock.js';
import { goalMark } from './goals.js';
import { t } from './text.js';

let els = {};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function initRender(elements) {
  els = elements;
}

// When "I see you." fades (view-only timing, so a module var, not state).
let senseFadeTimer = null;

// Shows "I see you." over the map for SENSE_NOTE_MS, then lets it fade
// (a plain "Enemy close." with Simple enemies on). A new warning while it
// shows just keeps it up longer: no flash.
export function showSensed() {
  showWhisper(t(state.settings.simpleEnemies ? 'room.sensed.simple' : 'room.sensed'));
}

// Shows `text` over the map where "I see you." shows, for `ms`, then lets
// it fade. `tone` 'dread' is the dungeon's faint voice; 'kind' is the
// warmer one that is on the player's side (the tutorial's lines). A line
// held longer than "I see you." also fades out slower ('slow').
export function showWhisper(text, tone = 'dread', ms = SENSE_NOTE_MS) {
  els.senseNote.textContent = text;
  els.senseNote.classList.toggle('kind', tone === 'kind');
  els.senseNote.classList.toggle('slow', ms > SENSE_NOTE_MS);
  els.senseNote.classList.add('show');
  clearTimeout(senseFadeTimer);
  senseFadeTimer = setTimeout(() => els.senseNote.classList.remove('show'), ms);
}

// Takes a whisper off the map at once (a new floor: a line from the last
// one, an advanced tutorial station's say, doesn't carry over).
export function hideWhisper() {
  clearTimeout(senseFadeTimer);
  // No fade: it goes with the floor it was said on.
  els.senseNote.style.transition = 'none';
  els.senseNote.classList.remove('show', 'slow');
  void els.senseNote.offsetWidth;
  els.senseNote.style.transition = '';
}

// When the answer line is taken off the map after its fade (view-only
// timing, so a module var, not state).
let answerHideTimer = null;

// Shows the right answer to a missed question as a line across the top of
// the map (answer swirl plan step A): "I see you."'s spot and form, in the
// enemies' cold blue. It stays until the player's next move (fadeAnswerLine),
// so they can stop and read it or walk on; "I see you." shows under it
// meanwhile, so neither replaces the other. A new miss replaces the answer.
export function showAnswerLine(text) {
  clearTimeout(answerHideTimer);
  els.answerNote.textContent = text;
  els.answerNote.hidden = false;
  // Read the layout once so the fade runs from the hidden line.
  void els.answerNote.offsetWidth;
  els.answerNote.classList.add('show');
}

// The player moved: the answer line fades, then leaves the map so
// "I see you." moves back up. `now` takes it away at once (a new floor).
export function fadeAnswerLine(now = false) {
  if (els.answerNote.hidden) return;
  els.answerNote.classList.remove('show');
  clearTimeout(answerHideTimer);
  if (now) els.answerNote.hidden = true;
  else answerHideTimer = setTimeout(() => { els.answerNote.hidden = true; }, ANSWER_LINE_FADE_MS);
}

export function showScreen(el) {
  [els.startScreen, els.introGlitch, els.shipIntroScreen, els.roomScreen, els.battleScreen, els.exchangeScreen, els.winScreen, els.loseScreen]
    .forEach(s => s.classList.remove('show'));
  el.classList.add('show');
  // Hearts/coins/turn/room/timer are meaningless before a run starts (and
  // during the intro glitch or the ship's opening, before the timer even
  // starts), so the header only shows them once the player has actually
  // reached a room.
  els.statsEl.classList.toggle('show', ![els.startScreen, els.introGlitch, els.shipIntroScreen].includes(el));
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
// so does THE UNFOLDING, which a press opens. A diagonal that would cut a
// corner is blocked too (passage.js canPassCorner). Each arrow is the way
// it points on screen (dpad.js padWay).
function renderMoveHints() {
  const buttons = els.dpadButtons;
  if (!buttons) return;
  for (const [dir, [sx, sy]] of Object.entries(SCREEN_WAYS)) {
    const btn = buttons[dir];
    if (!btn) continue;
    const way = padWay(sx, sy, waysInUse());
    const step = way && FACING_VECTORS[way];
    if (!step) {
      btn.classList.remove('move-examine', 'move-blocked');
      continue;
    }
    const [dr, dc] = step;
    const row = state.floor.playerRow + dr, col = state.floor.playerCol + dc;
    const cornered = !canPassCorner(state.floor.playerRow, state.floor.playerCol, dr, dc);
    const block = cornered ? { kind: 'corner' } : whatBlocks(row, col);
    const unreadPaper = !block && state.floor.props.some(p => p.kind === 'paper' && !p.searched && p.row === row && p.col === col);
    const examine = unreadPaper || (!!block && block.kind === 'prop' && !block.thing.searched) ||
      (!!block && block.kind === 'exchange');
    btn.classList.toggle('move-examine', examine);
    btn.classList.toggle('move-blocked', !!block && !examine);
  }
}

// While the boss is off screen, the edge of the view facing it glows —
// brighter as its light spreads — so the player always has a sense of
// where it is. A diagonal boss lights two edges: its way from the player
// on screen (the room view's camera never turns, so north is the top edge).
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

// Where a thing is compared with the player on screen: dx right and dy
// down (only the direction is used; grid north is up). It counts as on
// screen while it is in the player's own sight (walls hide it, its light
// alone doesn't show it).
function placeOnScreen(thing) {
  const seen = !state.settings.fogEnabled || state.floor.sightSet.has(key(thing.row, thing.col));
  return { dx: thing.col - state.floor.playerCol, dy: thing.row - state.floor.playerRow, offScreen: !seen };
}

// Status bar numbers: hearts, gold, turn count and the depth (REST on a
// rest floor, which isn't a depth). Call after any change to them.
export function renderHud() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.run.hearts, 0) + '/' + state.run.maxHearts;
  els.coinsTotalEl.textContent = state.run.coinsTotal;
  els.turnCountEl.textContent = state.run.turnCount;
  // With One stick a walk isn't a turn: the HUD's time says it instead.
  els.turnCountEl.parentElement.hidden = state.settings.oneStick;
  els.roomNumEl.textContent = state.run.resting ? t('stat.rest') : state.run.roomIndex + 1;
  els.roomOfEl.style.display = state.run.resting ? 'none' : '';
  els.roomTotalEl.textContent = state.run.order.length;
  // Keys held of the floor's; a rest floor has none.
  const keysTotal = state.floor.keysHeld + state.floor.keys.length;
  els.keysStat.hidden = keysTotal === 0;
  els.keysText.textContent = t(state.floor.gateSealed ? 'stat.keys.sealed' : 'stat.keys.count', { held: state.floor.keysHeld, total: keysTotal });
  renderGoals();
  renderGunHud();
  renderBattery();
  renderShipHud();
}

// The ship's HUD (ship plan step C, ship.js): the arrival clock (bright in
// its last minute), burns of the ones needed, and the crew's panic by name
// and as a meter. The rest of the HUD hides there (CSS .ship-hud). main.js
// worldFrame calls it each frame, as the clock runs.
export function renderShipHud() {
  const ship = state.floor.ship ? state.run.ship : null;
  els.statsEl.classList.toggle('ship-hud', !!ship);
  if (!ship) return;
  const seconds = Math.ceil(ship.clockMs / 1000);
  els.shipClock.textContent = formatTime(seconds);
  els.shipClock.classList.toggle('ship-low', seconds <= SHIP_LOW_SECONDS);
  els.shipBurns.textContent = state.run.burns + '/' + SHIP_RUN.burnsNeeded;
  els.shipPanic.textContent = t('panic.' + ship.panic);
  [...els.shipPanicMeter.children].forEach((cell, i) => cell.classList.toggle('on', i < ship.panic));
}

// The light's battery on the LIGHT button under the map (battery.js; light
// button prototype): the light tube on its side (tubeart.js, record book
// plan step E), a cell a turn of
// charge, then ON / OFF / EMPTY (locked until full). Its label keeps the
// words the HUD used to show (LIGHT ##-- ON), so a screen reader hears
// the same. Hidden with the battery out of play (Comfort mode, DEV).
function renderBattery() {
  const inPlay = batteryInPlay();
  els.lightBattery.hidden = !inPlay;
  if (!inPlay) return;
  const light = state.floor.light;
  // With One stick the charge runs by time: a # stays until it is all spent.
  const left = Math.ceil(light.charge);
  const cells = '#'.repeat(left) + '-'.repeat(Math.max(LIGHT_BATTERY_MAX - left, 0));
  const word = light.on ? 'on' : light.locked ? 'empty' : 'off';
  els.lightBattery.setAttribute('aria-label', t('stat.battery', { cells, state: t('stat.battery.' + word) }));
  els.hudTubeWord.textContent = t('stat.battery.' + word);
  els.lightBattery.classList.toggle('battery-off', !light.on);
  if (light.on && !tubeWasOn) tubeWarmFrom = reducedMotion.matches ? null : performance.now();
  tubeWasOn = light.on;
  drawHudTube();
}

// The HUD tube's switch-on: when it started (null = done), and whether
// the light was on at the last draw. View-only timing, so module vars.
let tubeWarmFrom = null;
let tubeWasOn = true;

// Draws the HUD tube from the light now. While it warms after a
// switch-on, the cells and glow come up over BOOK.tubeWarmMs, one frame
// at a time; reduced motion lights it at once.
function drawHudTube() {
  const canvas = els.hudTube;
  if (canvas.width !== TUBE_H) { canvas.width = TUBE_H; canvas.height = TUBE_W; }
  const light = state.floor.light;
  const warm = tubeWarmFrom === null ? 1 : Math.min(1, (performance.now() - tubeWarmFrom) / BOOK.tubeWarmMs);
  drawTube(canvas.getContext('2d'), { charge: light.charge, max: LIGHT_BATTERY_MAX, lit: light.on, bright: warm, upright: false });
  if (warm >= 1) { tubeWarmFrom = null; return; }
  requestAnimationFrame(() => { if (light.on && tubeWarmFrom !== null) drawHudTube(); });
}

// The floor's goals (goals.js), each with a mark: [x] kept if the player
// went down now, [-] lost, [ ] not there yet. Hidden on a floor with none.
const GOAL_MARKS = { kept: '[x]', failed: '[-]', open: '[ ]' };
function renderGoals() {
  const goals = state.floor.goals;
  els.goalsStat.hidden = !goals.length;
  // Marks on the HUD's short line; names with the rest of it (a tap).
  els.goalsText.textContent = goals.map(g => GOAL_MARKS[goalMark(g.id)]).join('');
  els.goalNames.textContent = goals.map(g => GOAL_MARKS[goalMark(g.id)] + ' ' + t('goal.' + g.id)).join('  ');
}

// The NEXT meter (Real time or One stick only): how long until the world next moves.
// Its edge runs slowly across and reaches the far end as the world moves,
// filling the meter one step and emptying it the next, so it never jumps.
// Dim while the clock is paused (`running` false). Under reduced motion it
// moves in still quarter steps instead of gliding. Called on each clock
// poll (main.js clockTick).
export function renderClock(running) {
  const on = state.settings.realTime || state.settings.oneStick;
  els.clockStat.hidden = !on;
  if (!on) return;
  const { share, filling } = clockReading();
  const edge = reducedMotion.matches ? Math.floor(share * 4) / 4 : share;
  els.clockFill.style.left = (filling ? 0 : edge) * 100 + '%';
  els.clockFill.style.width = (filling ? edge : 1 - edge) * 100 + '%';
  els.clockStat.classList.toggle('clock-held', !running);
}

// The gun's part of the HUD (gun plan step 6): energy held, the target and
// its guard, and whether SELECT can be pressed. Part of renderHud, the one
// writer of the HUD.
function renderGunHud() {
  [els.energyStat, els.gunTargetStat].forEach(el => { el.hidden = false; });
  els.btnSelect.hidden = false;
  const energy = state.run.energy;
  const target = state.floor.gunTarget;
  // A round that matches the target's known weakness shows as *.
  const weak = target && state.run.weakKnown.has(target.minionKind) ? state.run.weakTo[target.minionKind] : null;
  const held = Array.from({ length: energy }, (_, i) => (weak && state.run.rounds[i] === weak ? '*' : '#')).join('');
  els.energyCount.textContent = held + '-'.repeat(Math.max(ENERGY_MAX - energy, 0));
  els.gunTarget.textContent = target ? gunTargetName(target) : t('stat.noTarget');
  // SELECT stays pressable with no energy: it says so, and it must
  // still answer a dial opened by the last shot.
  els.btnSelect.disabled = state.run.runEnded;
}

// The HUD's name for the gun's target: a minion's kind, its guard while it
// has one (kill or maim plan: no health to count) and its weakness
// (strategy plan step D: the reload group, or ? until a shot has landed on
// that kind), or the hunter.
function gunTargetName(target) {
  if (target.kind === 'hunter') return t('term.hunter');
  const name = t('minionKind.' + target.minionKind) + (target.guard ? ' ' + t('stat.guard') : '');
  const weak = state.run.weakTo[target.minionKind];
  if (!weak) return name;
  return name + ' /' + (state.run.weakKnown.has(target.minionKind) ? weak : t('stat.weakUnknown'));
}

// HP pips for whichever target is currently engaged on the battle screen.
// Only shown for a multi-hit fight — the boss, under the current constants
// (a minion's fight still settles in one answer, and the chest and boxes
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
  const empty = Math.max((target.max || 0) - full, 0);
  const pips = '<span class="pip-full">' + '#'.repeat(full) + '</span>' +
    '<span class="pip-empty">' + '-'.repeat(empty) + '</span>';
  els.combatStatusEl.innerHTML = 'HP: ' + pips;
}

// The battle screen's target line and the attack button's wording. The
// box round the target on the map is drawn by mapview.js.
export function renderTargeting() {
  const target = state.battle.selectedTarget;
  els.targetLabelEl.textContent = target
    ? t('target.' + target.kind)
    : t('target.none');

  const isObject = state.battle.selectedTarget &&
    ['chest', 'box'].includes(state.battle.selectedTarget.kind);
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
