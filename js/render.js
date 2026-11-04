// DOM rendering around the map: screens, the edge glow and d-pad hints,
// and the HUD (hearts / the ship's crew and panic / timer). The map
// itself is drawn on a canvas by mapview.js.
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state, key } from './state.js';
import { SENSE_NOTE_MS, LIGHT_BATTERY_MAX, ANSWER_LINE_FADE_MS, BOOK } from './config.js';
import { drawTube, TUBE_W, TUBE_H } from './tubeart.js';
import { batteryInPlay } from './battery.js';
import { lightProgress } from './light.js';
import { whatBlocks, canPassCorner } from './passage.js';
import { SCREEN_WAYS, padWay } from './dpad.js';
import { FACING_VECTORS } from './sight.js';
import { waysInUse } from './look.js';
import { taughtCount } from './roles.js';
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
  [els.startScreen, els.shipIntroScreen, els.roomScreen, els.winScreen, els.loseScreen]
    .forEach(s => s.classList.remove('show'));
  el.classList.add('show');
  // Hearts/coins/turn/room/timer are meaningless before a run starts (and
  // during the ship's opening, before the timer even
  // starts), so the header only shows them once the player has actually
  // reached a room.
  els.statsEl.classList.toggle('show', ![els.startScreen, els.shipIntroScreen].includes(el));
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
  renderBattery();
  renderShipHud();
}

// The ship's HUD (ship plan step C, ship.js; no arrival clock since
// Timothy 2026-10-31; no burns since step G1): crew taught of the roles on
// duty, and the crew's panic by name and as a meter. The rest of the HUD
// hides there (CSS .ship-hud). main.js worldFrame calls it each frame.
export function renderShipHud() {
  const ship = state.floor.ship ? state.run.ship : null;
  els.statsEl.classList.toggle('ship-hud', !!ship);
  if (!ship) return;
  // Crew taught of the roles on duty (crew roles plan step C).
  const crew = taughtCount();
  els.shipTaught.textContent = crew.taught + '/' + crew.of;
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
