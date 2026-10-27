// The map: draws the floor (tiles, fog, walls, pillars, the boss light's
// mist, items and every actor's glyph) onto one <canvas> from `state`,
// with a phosphor afterglow and the map's animations (a minion's step,
// the player's bump, warps, pulses, glows, the mist's drift).
//
// main.js calls initMapView() once, requestMapDraw() after anything on
// the map may have changed, slideOnMap() / bumpOnMap() / shotOnMap() and a
// minion's hurtOnMap() / deathOnMap() from their drawEvents cases, and onMapPointer() to hear taps on the map. This file reads state and never changes it.
//
// Everything is drawn into one canvas (the "phosphor"), so a later CRT
// pass (curved glass, bloom) can read that canvas and draw on top of it.

import { state, key } from './state.js';
import { stepsAway } from './passage.js';
import {
  AFTERGLOW_FADE, AFTERGLOW_SETTLE_MS, MAP_MAX_PIXEL_RATIO, MAP_GLYPH_SIZES,
  MAP_ANIMATION_MS, FORM_TELL_STEPS, MAP_DRAG_PX, CRAWL_REACH, DOWNED_GLYPH_LEVEL, DOWNED_GLYPH_LIFT,
} from './config.js';
import { canMakeOut, seesEnemy, FACING_VECTORS } from './sight.js';
import { stepMs } from './walkpace.js';
import { freeSpot } from './walk.js';
import { t } from './text.js';
import { drawRoomScene, roomTileAt, roomGridAt, PLAYER_FIGURE } from './roomview.js';
import { playOnce } from './figure3d.js';
import { chargerHasMore } from './charger.js';
import { showShot } from './mapshared.js';
import { hurtStick, killStick, fallStick, crawlStick, grabStick, finishStick } from './stickforms.js';
import { startAnswerRing, endAnswerRing } from './swirl.js';
import { ventSealed } from './vents.js';
import { playerStepped, playerBumped } from './playerform.js';
import { updateStatic } from './staticview.js';

// Drawing proportions, as shares of a tile or strengths from 0 to 1.
const FOG_DIM_ALPHA = 0.68;  // explored-but-unlit floor at a third of its brightness
const MIST_DRIFT = [0.7, 1];  // the mist's strength at either end of its drift
// The drift starts at three points in its cycle, tile by tile, so the mist
// doesn't pulse in step.
const MIST_OFFSETS_MS = [0, 2300, 4700];
const BLOOM_RADIUS = 0.85;   // the hostile bloom behind the boss and minions
const REMEMBERED_ALPHA = 0.35; // papers and boxes seen before but not lit now
const COIN_BOB = 0.1;        // how far the coin lifts, as a share of a tile
const BUMP_DISTANCE = 0.18;  // how far the player nudges into what blocks them, in tiles
const SOUND_OPEN_MS = 300;   // a tile of a mistake's sound opens out from its middle over this long
// The glow behind a pulsing glyph at its dim and bright ends: grey level,
// strength, and blur as a share of a tile.
const BOSS_GLOW = { dim: [200, 0.5, 0.1], bright: [255, 0.9, 0.29] };
const ITEM_GLOW = { dim: [180, 0.4, 0.065], bright: [230, 0.85, 0.23] };
// The black bar of a minion's signal dropout, in tiles from the tile's top-left.
const GLITCH_BAR = { left: -0.2, top: 0.15, width: 1.4, height: 0.7 };

// Keyframes, as [share of the cycle, value]. The
// warp's values are [scale x, scale y, skew x, skew y] in degrees; the
// glitch bar's are its strength; a pulse runs from 0 (dim) to 1 (bright).
const WARP_KEYS = [
  [0, [1, 1, 0, 0]], [0.18, [1.06, 0.94, -4, 1]], [0.34, [0.95, 1.05, 2, -3]],
  [0.52, [1.03, 0.97, 3, 1]], [0.71, [0.97, 1.04, -2, -2]], [0.85, [1.02, 0.98, 1, 2]], [1, [1, 1, 0, 0]],
];
const GLITCH_KEYS = [[0, 0], [0.84, 0], [0.87, 1], [0.9, 0], [0.93, 0.85], [0.95, 0], [1, 0]];
const PULSE_KEYS = [[0, 0], [0.5, 1], [1, 0]];

// The CSS timing curves the animations use (ease, ease-in-out, ease-out),
// as functions from time (0..1) to progress (0..1).
const EASE = cubicBezier(0.25, 0.1, 0.25, 1);
const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);
const EASE_OUT = cubicBezier(0, 0, 0.58, 1);

// The key a player's bump is stored under; minions' slides use the minion.
const PLAYER = 'player';

// Floor beyond the player's memory, a touch warmer than black.
const HIDDEN_FLOOR = '#050403';


const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let canvas = null;  // the phosphor: what the player sees, faded frame to frame
let screen = null;  // the phosphor's 2D context
const scene = document.createElement('canvas'); // this frame, drawn plain from state
const sceneCtx = scene.getContext('2d');
let colours = {};
let pageSize = { width: 0, height: 0 }; // the canvas's size on the page in CSS pixels, from the resize observer
let frameHandle = 0; // the queued animation frame, or 0 when nothing is queued
let dirty = false;   // state may have changed since the scene was last drawn
let snap = false;    // show the next scene straight away, with no afterglow
let lastChange = 0;  // when the scene last changed, for the afterglow's settle
let lastFrame = 0;   // when the last faded frame was drawn, 0 while idle
let frameNow = 0;    // this frame's time, which every animation reads
let looping = false; // the last scene drew something that keeps moving
// Slides and bumps still playing: minion (or PLAYER) -> { kind, start, ms, ... }.
const effects = new Map();
// Each minion's place in its warp and dropout cycles, so they don't move in step.
const phases = new WeakMap();
let phaseCount = 0;
// How long the last drawn scenes took, in ms, newest last (DEV panel's frame meter).
const DRAW_TIMES_KEPT = 120;
const drawTimes = [];

// Stores the canvas and reads the map colours from the page's CSS
// variables, so the palette has one source (index.html :root). Redraws
// once the terminal font has loaded, since glyphs drawn before that come
// out in the fallback font.
export function initMapView(canvasEl) {
  canvas = canvasEl;
  screen = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  colours = {
    text: read('--text'), muted: read('--muted'), torch: read('--torch'), bright: read('--torch-bright'),
    glowRgb: read('--glow-rgb'), kindRgb: read('--kind-rgb'), bossFogRgb: read('--boss-fog-rgb'), bossLightRgb: read('--boss-light-rgb'),
    hidden: HIDDEN_FLOOR,
  };
  // The canvas's size is noted here, when it changes, instead of read each
  // frame: reading it makes the browser lay the page out first.
  new ResizeObserver(entries => {
    const box = entries[entries.length - 1].contentRect;
    pageSize = { width: box.width, height: box.height };
    snap = true;
    requestMapDraw();
  }).observe(canvas);
  document.fonts.load('10px VT323').then(requestMapDraw);
}

// The glyph a map thing shows once it's made out, from its term.*.symbol
// line in text.js (so a room's AREAS overrides can change it). The battle
// screen shows the same.
// With Simple enemies on, a minion is a still 'e', and an 'E' as its
// strike tell, within FORM_TELL_STEPS of the player (as a form's tell);
// the hunter is a still 'E', drawn bigger. A downed one is a small 'e'
// low on its tile (mapThings), and an 'E' only while it holds the player.
export function glyphOf(thing) {
  if (thing.kind === 'hunter' && state.settings.simpleEnemies) return t('term.hunter.simpleSymbol');
  if (thing.kind === 'minion' && thing.downed) return t(thing.grabbing ? 'term.minion.tellSymbol' : 'term.minion.downedSymbol');
  if (thing.kind === 'minion' && state.settings.simpleEnemies) {
    const steps = stepsAway(thing.row, thing.col);
    return t(steps <= FORM_TELL_STEPS ? 'term.minion.tellSymbol' : 'term.minion.simpleSymbol');
  }
  return t('term.' + thing.kind + '.symbol');
}

// Asks for the map to be drawn again from state on the next frame. Cheap
// to call often: several calls before a frame make one drawing.
export function requestMapDraw() {
  if (!canvas) return;
  dirty = true;
  queueFrame();
  updateStatic();
}

// Slides a minion that has just stepped from `from` to its new tile. A minion already sliding starts from
// where it shows now, so quick turns don't make it jump.
// `hold` is the share of `ms` it waits on its old tile before it moves (a
// crawl: the hand reaches first).
export function slideOnMap(thing, from, ms = MAP_ANIMATION_MS.slide, hold = 0) {
  if (!canvas || reducedMotion.matches) return;
  const now = performance.now();
  const running = effects.get(thing);
  const start = running && running.kind === 'slide' ? slidePlace(running, now) : from;
  effects.set(thing, { kind: 'slide', start: now, ms, hold, from: start, to: { row: thing.row, col: thing.col } });
  requestMapDraw();
}

// Slides the player onto the tile they just stepped to, from the one
// behind them (a step is always one tile toward `facing`), over the
// step's time on screen (walkpace.js), and tells the stick man's body a
// step started (playerform.js). A slide still playing starts from where
// the player shows now.
export function slidePlayerOnMap(facing) {
  if (!canvas || reducedMotion.matches) return;
  const f = state.floor;
  const [dr, dc] = FACING_VECTORS[facing];
  const now = performance.now();
  const running = effects.get(PLAYER);
  const from = running && running.kind === 'slide' ? slidePlace(running, now) : { row: f.playerRow - dr, col: f.playerCol - dc };
  effects.set(PLAYER, { kind: 'slide', start: now, ms: stepMs(dr, dc), from, to: { row: f.playerRow, col: f.playerCol } });
  playerStepped(now, stepMs(dr, dc));
  requestMapDraw();
}

// The player walked freely onto a new tile (one stick plan, walk.js): the
// stick man's body takes a step over `ms`, the time a tile takes at their
// pace (playerform.js). The spot itself moves every frame, so no slide.
export function freeStepOnMap(ms) {
  if (!canvas || reducedMotion.matches) return;
  playerStepped(performance.now(), ms);
  requestMapDraw();
}

// The player was struck (3D moves, one stick plan step F): his figure
// takes the hit, or, with the run lost (`dead`), falls and stays down.
// Nothing moves under reduced motion.
export function playerHitOnMap(dead) {
  if (!canvas || reducedMotion.matches) return;
  playOnce(PLAYER_FIGURE, dead ? 'Death01' : 'Hit_Head', performance.now(), dead);
  requestMapDraw();
}

// Nudges the player toward `facing` and back: the feel of walking into
// something, alongside the d-pad's blocked look; the stick man takes a
// half step (playerform.js).
export function bumpOnMap(facing) {
  if (!canvas || reducedMotion.matches) return;
  const now = performance.now();
  effects.set(PLAYER, { kind: 'bump', start: now, ms: MAP_ANIMATION_MS.bump, facing });
  playerBumped(now, MAP_ANIMATION_MS.bump);
  requestMapDraw();
}

// Plays a gun shot at `target` on the map (mapshared.js showShot, which
// both views draw): a flash
// to it, or past it with MISS over it when it `missed`. One more frame is
// asked for once MISS is done, so it clears even under reduced motion,
// where nothing else keeps frames going.
export function shotOnMap(target, missed) {
  if (!canvas) return;
  showShot(target, missed);
  requestMapDraw();
  setTimeout(requestMapDraw, MAP_ANIMATION_MS.gunMiss);
}

// A stick man hit in the dark (light battery plan step C): drawn for
// MAP_ANIMATION_MS.darkFlash in the shot's flash, though no light is on
// it, then gone into the dark again. Shown under reduced motion too: it
// is seen, not moved.
let flashSeen = null; // { minion, until }
export function revealInFlash(minion) {
  flashSeen = { minion, until: performance.now() + MAP_ANIMATION_MS.darkFlash };
  requestMapDraw();
  setTimeout(requestMapDraw, MAP_ANIMATION_MS.darkFlash + 20);
}
function inFlash(m) {
  return !!flashSeen && flashSeen.minion === m && performance.now() < flashSeen.until;
}

// A minion's stick man (stickforms.js) reacts to a landed shot: a soft
// brightening, one small push and a hit's tendrils (one stays out when it
// was a hit, `stays`, not a miss).
export function hurtOnMap(minion, stays) {
  hurtStick(minion, stays);
  requestMapDraw();
}

// A minion's stick man goes down (downed plan): it falls from its pose to
// propped on its arms (at once under reduced motion). With Simple enemies
// on its 'e' just becomes the small one.
export function downOnMap(minion) {
  fallStick(minion, reducedMotion.matches);
  requestMapDraw();
}

// A downed minion crawled from `from`: its hand reaches and plants, then
// its body drags after it (the slide holds back CRAWL_REACH of the crawl),
// and it drops letters on the tile it left. Under reduced motion, or as
// Simple enemies' small 'e', it moves tile to tile.
export function crawlOnMap(minion, from) {
  if (state.settings.simpleEnemies) return requestMapDraw();
  crawlStick(minion, from, reducedMotion.matches);
  slideOnMap(minion, from, MAP_ANIMATION_MS.crawl, CRAWL_REACH);
  requestMapDraw();
}

// A downed minion grabbed the player's ankle: its front hand reaches for
// their foot and stays there.
export function grabOnMap(minion) {
  grabStick(minion);
  requestMapDraw();
}

// The player finished a downed minion: its death (deathOnMap, next) is
// letters settling to the floor.
export function finishOnMap(minion) {
  finishStick(minion);
}

// A killed minion's stick man fades where it stood (gone at once under
// reduced motion, or with Simple enemies on).
export function deathOnMap(minion) {
  killStick(minion, reducedMotion.matches || state.settings.simpleEnemies);
  requestMapDraw();
}

// A mistake's sound (noise.js noiseMade): each tile it reached lights up
// as an outline one walking step later than the last, every
// MAP_ANIMATION_MS.soundStep, and fades over soundFade, so the player sees
// how far it carried. Only on floor they have seen, so it never shows the
// shape of rooms they haven't found; nothing that came out of a grate
// whose pair they don't know (the sound just goes in). Under reduced
// motion it shows all at once, still, then goes. View-only, not state.
let sounds = []; // [{ tiles, start, ends }]
export function soundOnMap(tiles) {
  const now = performance.now();
  const still = reducedMotion.matches;
  const far = Math.max(0, ...tiles.map(tile => tile.d));
  const ends = now + (still ? 0 : far * MAP_ANIMATION_MS.soundStep) + MAP_ANIMATION_MS.soundFade;
  sounds.push({ tiles, start: now, ends, far });
  requestMapDraw();
  setTimeout(requestMapDraw, ends - now + 20);
}

// The sound's tiles to draw at `now`: [{ row, col, strength, spread }],
// strength 0..1 (fading, and fainter the further it went), spread 0..1
// (the outline opens out from the tile's middle as it lights). Drops
// sounds that are done.
function soundTilesNow(now) {
  sounds = sounds.filter(sound => now < sound.ends);
  if (!sounds.length) return [];
  const still = reducedMotion.matches;
  const vents = state.floor.vents;
  const out = [];
  sounds.forEach(sound => sound.tiles.forEach(tile => {
    if (!state.settings.showDucts && tile.through.some(i => !vents[i] || !vents[i].known)) return;
    if (fogOf(tile.row, tile.col) === 'hidden') return;
    const age = still ? 0 : now - sound.start - tile.d * MAP_ANIMATION_MS.soundStep;
    if (age < 0 || age > MAP_ANIMATION_MS.soundFade) return;
    const strength = (1 - age / MAP_ANIMATION_MS.soundFade) * (1 - tile.d / (sound.far + 2));
    out.push({ row: tile.row, col: tile.col, strength, spread: still ? 1 : Math.min(1, age / SOUND_OPEN_MS) });
  }));
  if (!still) looping = true;
  return out;
}

// A grate shudders, the turn before something drops out of it (vents.js
// ventRattled): the grate wobbles slowly over MAP_ANIMATION_MS.ventRattle.
// None under reduced motion or in Comfort mode: the line says it.
const rattles = new Map(); // grate -> when it started shaking
export function rattleOnMap(vent) {
  if (reducedMotion.matches || state.settings.simpleEnemies) return;
  rattles.set(vent, performance.now());
  requestMapDraw();
}

// How far a grate's shudder has got, 0..1, or null when it isn't shaking.
function rattleOf(vent) {
  const at = rattles.get(vent);
  if (at === undefined) return null;
  const age = frameNow - at;
  if (age >= MAP_ANIMATION_MS.ventRattle) {
    rattles.delete(vent);
    return null;
  }
  looping = true;
  return age / MAP_ANIMATION_MS.ventRattle;
}

// A stick man the player can see heard the sound (noise.js noiseHeard): a
// small '!' over it fades over MAP_ANIMATION_MS.heardMark. Still under
// reduced motion, then gone.
const heardAt = new WeakMap();
export function heardOnMap(minion) {
  heardAt.set(minion, performance.now());
  requestMapDraw();
  setTimeout(requestMapDraw, MAP_ANIMATION_MS.heardMark + 20);
}

// How strongly a stick man's '!' shows now, 0 once it is gone.
function heardMark(m) {
  const at = heardAt.get(m);
  if (at === undefined) return 0;
  const age = frameNow - at;
  if (age >= MAP_ANIMATION_MS.heardMark) return 0;
  if (reducedMotion.matches) return 1;
  looping = true;
  return 1 - age / MAP_ANIMATION_MS.heardMark;
}

// After a miss: puts the right answer `text` up as a ring over tile `at`
// (round the boss when `boss`; answer swirl plan step B). Returns false
// when it should be the line instead (too long, reduced motion, Simple
// enemies, no tile): main.js then shows render.js showAnswerLine.
export function answerRingOnMap(text, at, boss) {
  if (!startAnswerRing(text, at, boss, reducedMotion.matches, performance.now())) return false;
  requestMapDraw();
  return true;
}

// The player moved: the answer ring fades.
export function endAnswerRingOnMap() {
  endAnswerRing(performance.now());
  requestMapDraw();
}

// Hands main.js a tap on the map: `tap(tile, pointerType, point)` with the
// tile under a press that didn't drag past MAP_DRAG_PX (roomview
// roomTileAt: an enemy first) and the floor point under it (roomGridAt).
// There is no hover or drag aim (a holdover from the shoulder view, whose camera turned with
// the light, so the point under the pointer would run away from it), and a
// drag never taps, so a phone can't pick or clear a target by accident.
export function onMapPointer({ tap }) {
  let press = null; // { x, y, id, dragged } while a press is down
  const place = e => {
    const box = canvas.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  };
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    press = { x: e.clientX, y: e.clientY, id: e.pointerId, dragged: false };
    if (e.pointerType !== 'mouse') canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MAP_DRAG_PX) press.dragged = true;
  });
  canvas.addEventListener('pointerup', e => {
    if (!press || press.id !== e.pointerId) return;
    const dragged = press.dragged;
    press = null;
    if (dragged) return;
    const tile = roomTileAt(...place(e));
    if (tile) tap(tile, e.pointerType, roomGridAt(...place(e)));
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
}

function queueFrame() {
  if (!frameHandle) frameHandle = requestAnimationFrame(drawFrame);
}

// One animation frame. A changed state, a slide or bump, or anything that
// keeps moving is drawn into the scene. After a change or a slide or bump,
// the phosphor keeps part of its last frame and takes the brighter of that
// and the scene, pixel by pixel, so light the player leaves fades out
// instead of vanishing. Once nothing has changed for AFTERGLOW_SETTLE_MS
// the fade is done: the phosphor takes the scene exactly (rounding would
// otherwise leave faint ghosts that never clear). Pulses and warps alone
// don't restart the fade, for the same reason: they are drawn plain.
// Frames stop when nothing is fading or moving. Reduced motion skips the
// fade and every animation.
function drawFrame(now) {
  frameHandle = 0;
  if (!fitCanvas()) return;
  const still = reducedMotion.matches;
  if (dirty || effects.size) lastChange = now;
  if (dirty || effects.size || (looping && !still)) {
    drawScene(now);
    dirty = false;
  }
  const moving = !still && (looping || effects.size > 0);
  if (snap || still || now - lastChange >= AFTERGLOW_SETTLE_MS) {
    screen.globalCompositeOperation = 'copy';
    screen.drawImage(scene, 0, 0);
    screen.globalCompositeOperation = 'source-over';
    snap = false;
    lastFrame = 0;
    if (moving) queueFrame();
    return;
  }
  // The fade is set per 60fps frame; a slower or faster screen keeps the
  // same fade per second.
  const frameMs = 1000 / 60;
  const keep = Math.pow(1 - AFTERGLOW_FADE, (lastFrame ? now - lastFrame : frameMs) / frameMs);
  lastFrame = now;
  screen.fillStyle = 'rgba(0, 0, 0, ' + (1 - keep) + ')';
  screen.fillRect(0, 0, canvas.width, canvas.height);
  screen.globalCompositeOperation = 'lighten';
  screen.drawImage(scene, 0, 0);
  screen.globalCompositeOperation = 'source-over';
  queueFrame();
}

// Matches the canvas's pixels to its size on the page (sharp on high-DPI
// screens). Returns false while the map isn't on screen (zero size), so
// nothing is drawn until it is; the resize observer asks again then.
// The map is wider than tall (the page's CSS sets the shape), so width
// and height are read separately.
function fitCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, MAP_MAX_PIXEL_RATIO);
  const width = Math.round(pageSize.width * ratio);
  const height = Math.round(pageSize.height * ratio);
  if (!width || !height) return false;
  if (canvas.width === width && canvas.height === height && scene.width === width && scene.height === height) return true;
  canvas.width = scene.width = width;
  canvas.height = scene.height = height;
  dirty = true;
  snap = true;
  return true;
}

// Draws the whole map as state has it at `now`, from the room camera
// (roomview.js, the game's map view since room view plan step G). Notes whether anything drawn keeps moving, so frames
// go on, and how long the drawing took (mapDrawTimes).
function drawScene(now) {
  const started = performance.now();
  frameNow = now;
  looping = false;
  const ctx = sceneCtx;
  ctx.fillStyle = HIDDEN_FLOOR;
  ctx.fillRect(0, 0, scene.width, scene.height);
  const shared = {
    colours, things: mapThings(), fogOf, paintGlyph, mistStrength, pulse, keepMoving,
    showPlain, now, still: reducedMotion.matches, walkAt: walkAt(now), sounds: soundTilesNow(now),
  };
  const size = { width: scene.width, height: scene.height, pageWidth: pageSize.width };
  // The room view's pixel art has no afterglow: it would smear it.
  drawRoomScene(ctx, size, shared);
  snap = true;
  drawTimes.push(performance.now() - started);
  if (drawTimes.length > DRAW_TIMES_KEPT) drawTimes.shift();
}

// The DEV panel's frame meter: the median and slowest time, in ms, of the
// last DRAW_TIMES_KEPT scenes drawn, or null before any.
export function mapDrawTimes() {
  if (!drawTimes.length) return null;
  const sorted = [...drawTimes].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], slowest: sorted[sorted.length - 1], count: sorted.length };
}

// Tells the frame loop that something just drawn keeps moving, so frames
// go on. The room view calls it for its own looping effects.
function keepMoving() {
  looping = true;
}

// The room view is moving something big this frame (the camera
// gliding, the sky fading in, the player sliding): keep drawing frames, and show
// each one plain, with no afterglow. The afterglow keeps every in-between
// place, so a moving scene smeared.
function showPlain() {
  looping = true;
  snap = true;
}

// How much of a tile the player sees: 'lit' now, 'dim' (explored, not lit
// now) or 'hidden' (never seen, or wiped by the darkness).
function fogOf(row, col) {
  const k = key(row, col);
  if (!state.settings.fogEnabled || state.floor.visibleSet.has(k)) return 'lit';
  return state.floor.exploredSet.has(k) ? 'dim' : 'hidden';
}

// How strongly the boss mist shows on a tile this frame, from 0 (none) to
// 1: only on lit floor (not walls, not floor the player has never seen),
// dimmed on remembered floor, drifting over time. The room view draws with it.
function mistStrength(row, col) {
  const k = key(row, col);
  if (!state.floor.bossLitSet.has(k) || state.floor.wallSet.has(k)) return 0;
  const fog = fogOf(row, col);
  if (fog === 'hidden') return 0;
  looping = true;
  const offset = MIST_OFFSETS_MS[(row * state.floor.GRID_SIZE + col) % MIST_OFFSETS_MS.length];
  const strength = MIST_DRIFT[0] + (MIST_DRIFT[1] - MIST_DRIFT[0]) * pulse(MAP_ANIMATION_MS.mist, offset);
  return strength * (fog === 'dim' ? 1 - FOG_DIM_ALPHA : 1);
}

// Every glyph on the map, as a list the room view draws from: { kind, at, tile, glyph, look }. `at` is where it
// shows this frame in tiles (between tiles while something slides), `tile`
// the tile the rules have it on (where a slide ends), glyph is
// null for the '?' of something too far to make out, and look holds the
// paintGlyph options. Things are seen only on lit tiles, '?' until the
// player is close enough to make them out, enemies only once made out
// (no '?' to track them by), stairs always, papers and boxes remembered
// dimly once seen. The list runs in drawing order: moving things after
// items, so they draw over them.
function mapThings() {
  const f = state.floor;
  const things = [];
  const add = (kind, at, glyph, look, tile = at) => things.push({ kind, at, tile: { row: tile.row, col: tile.col }, glyph, look });
  const isLit = (row, col) => !state.settings.fogEnabled || f.visibleSet.has(key(row, col));
  const glyphOrUnknown = (thing, glyph) => (canMakeOut(thing.row, thing.col) ? glyph : null);

  if (f.boss && isLit(f.boss.row, f.boss.col)) {
    add('boss', f.boss, glyphOrUnknown(f.boss, glyphOf(f.boss)), {
      size: 'boss', bloom: 0.26, warp: warpAt(MAP_ANIMATION_MS.warp, 0),
      glow: glowAt(BOSS_GLOW, pulse(MAP_ANIMATION_MS.bossPulse)),
    });
  }
  // Grates lie flat in the floor, seen like the floor round them (vents.js).
  // A held room's grates are sealed (relays.js).
  f.vents.forEach(v => {
    const lit = isLit(v.row, v.col);
    const remembered = state.settings.fogEnabled && !lit && !f.darkness && f.exploredSet.has(key(v.row, v.col));
    if (!lit && !remembered) return;
    add('vent', v, t('term.vent.symbol'), { size: 'prop', alpha: remembered ? REMEMBERED_ALPHA : 1, sealed: ventSealed(v), rattle: rattleOf(v) });
  });
  f.props.forEach(p => {
    const lit = isLit(p.row, p.col);
    const remembered = state.settings.fogEnabled && !lit && !f.darkness && f.exploredSet.has(key(p.row, p.col));
    if (!lit && !remembered) return;
    // A paper under the player or a minion is hidden, so glyphs don't pile up.
    const under = thing => thing.row === p.row && thing.col === p.col;
    if (p.kind === 'paper' && (under({ row: f.playerRow, col: f.playerCol }) || f.minions.some(under))) return;
    const known = !state.settings.fogEnabled || p.identified || canMakeOut(p.row, p.col);
    // An unused energy cell breathes a faint glow (roomview.js drawCell).
    const breath = p.kind === 'cell' && !p.searched && !remembered ? pulse(MAP_ANIMATION_MS.cellBreath, phaseOf(p) * MAP_ANIMATION_MS.cellBreath) : null;
    // An unused reflective desk sits in a pool of the kind voice's warm
    // light (roomview.js drawDesk), remembered ones too: it says "safe"
    // and calls the player back. Spent, the pool is gone.
    // The charger breathes the same warm light while energy isn't full
    // (roomview.js drawCharger); at full it has nothing to give.
    const deskGlow = p.kind === 'desk' && !p.searched ? pulse(MAP_ANIMATION_MS.deskGlow)
      : p.kind === 'charger' && chargerHasMore() ? pulse(MAP_ANIMATION_MS.chargerGlow) : null;
    add(p.kind, p, known ? glyphOf(p) : null, {
      size: 'prop', colour: p.searched || (p.kind === 'charger' && deskGlow === null) ? colours.muted : deskGlow !== null ? 'rgb(' + colours.kindRgb + ')' : colours.torch, alpha: remembered ? REMEMBERED_ALPHA : 1, breath, deskGlow,
    });
  });
  if (f.coin && isLit(f.coin.row, f.coin.col)) {
    add('coin', f.coin, glyphOrUnknown(f.coin, t('term.gold.symbol')), {
      size: 'coin', lift: COIN_BOB * pulse(MAP_ANIMATION_MS.coinBob), moves: true,
    });
  }
  // A key glows like the stairs, so a lit one isn't missed in a room.
  f.keys.forEach(k => {
    if (!isLit(k.row, k.col)) return;
    add('key', k, glyphOrUnknown(k, t('term.key.symbol')), {
      size: 'key', colour: colours.bright, glow: glowAt(ITEM_GLOW, pulse(MAP_ANIMATION_MS.glow)),
    });
  });
  if (f.chest && isLit(f.chest.row, f.chest.col)) {
    add('chest', f.chest, glyphOrUnknown(f.chest, glyphOf(f.chest)), { size: 'chest' });
  }
  // THE UNFOLDING warps like the boss, slower: a shape the eye keeps losing.
  if (f.exchange && isLit(f.exchange.row, f.exchange.col)) {
    add('exchange', f.exchange, glyphOrUnknown(f.exchange, glyphOf(f.exchange)), {
      size: 'exchange', colour: colours.bright, warp: warpAt(MAP_ANIMATION_MS.exchangeWarp, 0),
      glow: glowAt(ITEM_GLOW, pulse(MAP_ANIMATION_MS.glow)),
    });
  }
  // The stairs are never lost in the fog: they're the way out (both of
  // them on a between-rest).
  [f.stairs, f.stairsAlt].filter(Boolean).forEach(s => {
    add('stairs', s, t('term.exit.symbol'), {
      size: 'stairs', colour: colours.bright, glow: glowAt(ITEM_GLOW, pulse(MAP_ANIMATION_MS.glow)),
    });
  });
  add('player', state.settings.oneStick ? freeAt() : shownAt(PLAYER, f.playerRow, f.playerCol), t('term.player.symbol'), { size: 'player' },
    { row: f.playerRow, col: f.playerCol });
  // DEV -> Show ducts: a stick man in a duct shows dimly on the grate it
  // will come out of.
  if (state.settings.showDucts) f.crawling.forEach(m => {
    add(m.kind, f.vents[m.vent.to], glyphOf(m), { size: m.kind, colour: colours.muted, alpha: REMEMBERED_ALPHA }, f.vents[m.vent.to]);
  });
  f.minions.forEach(m => {
    // An enemy shows only while made out (or lit by a dark shot), never
    // as a '?' to follow round the dark.
    if (state.settings.fogEnabled && !seesEnemy(m) && !inFlash(m)) return;
    const hunter = m.kind === 'hunter';
    // Simple enemies: a still white letter, like a key's k, with no warp,
    // dropout or glow (the hunter's E is bigger, from its glyph size).
    if (state.settings.simpleEnemies) {
      // Downed: a smaller, dimmer e low on its tile; E while it holds them.
      const down = m.downed ? { size: 'downed', alpha: m.grabbing ? 1 : DOWNED_GLYPH_LEVEL, lift: DOWNED_GLYPH_LIFT } : {};
      add(m.kind, shownAt(m, m.row, m.col), glyphOf(m), { size: m.kind, colour: colours.bright, heard: heardMark(m), ...down }, m);
      return;
    }
    const phase = phaseOf(m);
    const warpMs = hunter ? MAP_ANIMATION_MS.hunterWarp : MAP_ANIMATION_MS.warp;
    add(m.kind, shownAt(m, m.row, m.col), glyphOf(m), {
      size: m.kind, colour: hunter ? colours.bright : colours.text, bloom: hunter ? 0.32 : 0.26,
      warp: warpAt(warpMs, phase * warpMs),
      // Only minions drop out; the hunter is always there.
      dropout: hunter ? 0 : dropoutAt(((phase * 2) % 1) * MAP_ANIMATION_MS.glitchBar),
      heard: heardMark(m),
    }, m);
  });
  return things;
}

// Paints one glyph centred on (x, y) in canvas pixels, sized for a tile
// `cell` pixels wide, with the terminal's soft phosphor glow. The room
// view paints with it. A null glyph is the '?' of something too far to make
// out: dim, and without the hostile bloom or any animation.
// Look options: size (a MAP_GLYPH_SIZES key), colour, alpha, bloom (the
// strength of the glow behind a hostile glyph), warp ([scale x, scale y,
// skew x, skew y] round the glyph's middle, bloom and dropout included),
// glow ([grey, strength, blur] in place of the soft glow), dropout (the
// strength of a minion's black signal bar over it), lift (how far it rises
// off its tile, in tiles; the views place it) and moves (it animates with
// no other option saying so, like the coin's bob).
function paintGlyph(ctx, cell, x, y, glyph, { size, colour = colours.text, alpha = 1, bloom = 0, warp, glow, dropout = 0, moves = false }) {
  const known = glyph !== null;
  if (known && (warp || glow || moves)) looping = true;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (known && warp) {
    const [sx, sy, kx, ky] = warp;
    const rad = Math.PI / 180;
    ctx.transform(sx, sy * Math.tan(ky * rad), sx * Math.tan(kx * rad), sy, 0, 0);
  }
  if (known && bloom) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * BLOOM_RADIUS);
    g.addColorStop(0, 'rgba(' + colours.glowRgb + ', ' + bloom + ')');
    g.addColorStop(0.55, 'rgba(' + colours.glowRgb + ', ' + (bloom / 4) + ')');
    g.addColorStop(0.75, 'rgba(' + colours.glowRgb + ', 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-cell, -cell, cell * 2, cell * 2);
  }
  ctx.font = Math.round(cell * MAP_GLYPH_SIZES[size]) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = known ? colour : colours.muted;
  if (known && glow) {
    const [grey, strength, blur] = glow;
    ctx.shadowColor = 'rgba(' + grey + ', ' + grey + ', ' + grey + ', ' + strength + ')';
    ctx.shadowBlur = cell * blur;
  } else {
    ctx.shadowColor = 'rgba(' + colours.glowRgb + ', 0.35)';
    ctx.shadowBlur = cell * 0.2;
  }
  ctx.fillText(known ? glyph : t('term.unknown.symbol'), 0, 0);
  ctx.shadowBlur = 0;
  if (known && dropout > 0) {
    ctx.globalAlpha = alpha * dropout;
    ctx.fillStyle = '#000';
    ctx.fillRect((GLITCH_BAR.left - 0.5) * cell, (GLITCH_BAR.top - 0.5) * cell, GLITCH_BAR.width * cell, GLITCH_BAR.height * cell);
  }
  ctx.restore();
}

// Where something shows this frame, in tiles: its own tile, or part way
// through a slide or bump still playing. A finished effect is dropped, and
// so is a slide the thing has since left (the hunter thrown back, a new
// floor), so it shows where it is.
function shownAt(effectKey, row, col) {
  const fx = effects.get(effectKey);
  if (!fx) return { row, col };
  const done = (frameNow - fx.start) / fx.ms >= 1;
  const left = fx.kind === 'slide' && (fx.to.row !== row || fx.to.col !== col);
  if (done || left) {
    effects.delete(effectKey);
    return { row, col };
  }
  if (fx.kind === 'slide') return slidePlace(fx, frameNow);
  const [dr, dc] = FACING_VECTORS[fx.facing];
  const out = BUMP_DISTANCE * sampleKeys(PULSE_KEYS, (frameNow - fx.start) / fx.ms, EASE_OUT);
  return { row: row + dr * out, col: col + dc * out };
}

// How far along its slide a minion (or the player) is at `now`, as a place in tiles.
// Where the player's step slide has them at `now`: their tile once it has
// landed. A bump doesn't count, so the camera following this never nudges.
function walkAt(now) {
  if (state.settings.oneStick) return freeAt();
  const f = state.floor;
  const fx = effects.get(PLAYER);
  const tile = { row: f.playerRow, col: f.playerCol };
  if (!fx || fx.kind !== 'slide' || fx.to.row !== tile.row || fx.to.col !== tile.col || now - fx.start >= fx.ms) return tile;
  return slidePlace(fx, now);
}

// Where free walking has the player (one stick plan, walk.js), as a place
// in tiles like a slide's (the tile's top-left corner).
function freeAt() {
  const at = freeSpot();
  return { row: at.y - 0.5, col: at.x - 0.5 };
}

function slidePlace(fx, now) {
  const hold = fx.hold || 0;
  const s = EASE(Math.min(1, Math.max(0, ((now - fx.start) / fx.ms - hold) / (1 - hold))));
  return { row: fx.from.row + (fx.to.row - fx.from.row) * s, col: fx.from.col + (fx.to.col - fx.from.col) * s };
}

// A minion's own place in its warp and dropout cycles, from 0 to 1. Spread
// by the golden ratio, not Math.random: the seeded tests replace
// Math.random, and drawing must never use up their numbers.
function phaseOf(thing) {
  if (!phases.has(thing)) phases.set(thing, (phaseCount++ * 0.618034) % 1);
  return phases.get(thing);
}

// Where a looping pulse is this frame, from 0 (dim) to 1 (bright) and back
// over `period` ms, started `offsetMs` in. Still at the middle under
// reduced motion.
function pulse(period, offsetMs = 0) {
  if (reducedMotion.matches) return 0.5;
  return sampleKeys(PULSE_KEYS, ((frameNow + offsetMs) % period) / period, EASE_IN_OUT);
}

// The boss's or a minion's warp this frame, as [scale x, scale y, skew x,
// skew y]. None under reduced motion.
function warpAt(period, offsetMs) {
  if (reducedMotion.matches) return null;
  return sampleKeys(WARP_KEYS, ((frameNow + offsetMs) % period) / period, EASE_IN_OUT);
}

// The strength of a minion's signal dropout bar this frame. None under
// reduced motion.
function dropoutAt(offsetMs) {
  if (reducedMotion.matches) return 0;
  const period = MAP_ANIMATION_MS.glitchBar;
  return sampleKeys(GLITCH_KEYS, ((frameNow + offsetMs) % period) / period, EASE_IN_OUT);
}

// A glyph's glow part way between its dim and bright ends.
function glowAt({ dim, bright }, amount) {
  return dim.map((v, i) => v + (bright[i] - v) * amount);
}

// The value of a keyframe list at `at` (0..1 through the cycle), eased
// between each pair of keyframes the way CSS does. Values are numbers or
// lists of numbers.
function sampleKeys(keys, at, ease) {
  let i = 1;
  while (i < keys.length - 1 && at > keys[i][0]) i++;
  const [t0, a] = keys[i - 1];
  const [t1, b] = keys[i];
  const s = ease(Math.min(1, Math.max(0, (at - t0) / (t1 - t0))));
  return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * s) : a + (b - a) * s;
}

// A CSS cubic-bezier timing curve as a function from time to progress,
// both 0..1. Finds the curve's point for that time by halving, which is
// plenty exact for a few dozen calls a frame.
function cubicBezier(x1, y1, x2, y2) {
  const along = (p1, p2, s) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3;
  return time => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (along(x1, x2, mid) < time) lo = mid;
      else hi = mid;
    }
    return along(y1, y2, (lo + hi) / 2);
  };
}
