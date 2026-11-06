// The map: draws the floor (tiles, walls, props and the player) onto one
// <canvas> from `state`, with a phosphor afterglow and the map's
// animations (the player's step and bump, pulses, glows).
//
// main.js calls initMapView() once, requestMapDraw() after anything on
// the map may have changed, freeStepOnMap() / bumpOnMap() from their
// drawEvents cases, and onMapPointer() to hear taps on the map. This file
// reads state and never changes it.
//
// Everything is drawn into one canvas (the "phosphor"), so a later CRT
// pass (curved glass, bloom) can read that canvas and draw on top of it.

import { state, key } from './state.js';
import {
  AFTERGLOW_FADE, AFTERGLOW_SETTLE_MS, MAP_MAX_PIXEL_RATIO,
  MAP_ANIMATION_MS, MAP_DRAG_PX,
} from './config.js';
import { canMakeOut } from './sight.js';
import { freeSpot } from './walk.js';
import { t } from './text.js';
import { drawRoomScene, roomTileAt, roomGridAt } from './roomview.js';

import { playerStepped, playerBumped } from './playerform.js';


// Drawing proportions, as shares of a tile or strengths from 0 to 1.

// Keyframes, as [share of the cycle, value]: a pulse runs from 0 (dim)
// to 1 (bright) and back.
const PULSE_KEYS = [[0, 0], [0.5, 1], [1, 0]];

// The CSS timing curve the pulses use (ease-in-out),
// as a function from time (0..1) to progress (0..1).
const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);


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
// Until when a bump is still playing (performance.now ms): frames keep coming till then.
let bumpUntil = 0;
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
// line in text.js (so a room's AREAS overrides can change it).
function glyphOf(thing) {
  return t('term.' + thing.kind + '.symbol');
}

// Asks for the map to be drawn again from state on the next frame. Cheap
// to call often: several calls before a frame make one drawing.
export function requestMapDraw() {
  if (!canvas) return;
  dirty = true;
  queueFrame();
}

// The player walked freely onto a new tile (one stick plan, walk.js): the
// stick man's body takes a step over `ms`, the time a tile takes at their
// pace (playerform.js). The spot itself moves every frame, so no slide.
export function freeStepOnMap(ms) {
  if (!canvas || reducedMotion.matches) return;
  playerStepped(performance.now(), ms);
  requestMapDraw();
}

// The feel of walking into something: the stick man takes a half step
// (playerform.js) and frames keep coming while it plays.
export function bumpOnMap() {
  if (!canvas || reducedMotion.matches) return;
  const now = performance.now();
  bumpUntil = now + MAP_ANIMATION_MS.bump;
  playerBumped(now, MAP_ANIMATION_MS.bump);
  requestMapDraw();
}

// Hands main.js a tap on the map: `tap(tile, pointerType, point)` with the
// tile under a press that didn't drag past MAP_DRAG_PX (roomview
// roomTileAt) and the floor point under it (roomGridAt).
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
  const bumping = now < bumpUntil;
  if (dirty || bumping) lastChange = now;
  if (dirty || bumping || (looping && !still)) {
    drawScene(now);
    dirty = false;
  }
  const moving = !still && (looping || bumping);
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
    colours, things: mapThings(), fogOf, pulse, keepMoving,
    showPlain, now, still: reducedMotion.matches, walkAt: freeAt(),
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
// now) or 'hidden' (never seen).
function fogOf(row, col) {
  const k = key(row, col);
  if (!state.settings.fogEnabled || state.floor.visibleSet.has(k)) return 'lit';
  return state.floor.exploredSet.has(k) ? 'dim' : 'hidden';
}

// Every thing on the map, as a list the room view draws from: { kind, at,
// tile, glyph }. `at` is where it shows this frame in tiles (the player
// walks between tiles), `tile` the tile the rules have it on, glyph is
// null for the '?' of something too far to make out. Things are seen only
// on lit tiles, '?' until the player is close enough to make them out, and
// props remembered once seen. The player comes last, so they draw over the
// rest.
function mapThings() {
  const f = state.floor;
  const things = [];
  const add = (kind, at, glyph, tile = at) => things.push({ kind, at, tile: { row: tile.row, col: tile.col }, glyph });
  const isLit = (row, col) => !state.settings.fogEnabled || f.visibleSet.has(key(row, col));

  f.props.forEach(p => {
    const lit = isLit(p.row, p.col);
    const remembered = state.settings.fogEnabled && !lit && f.exploredSet.has(key(p.row, p.col));
    if (!lit && !remembered) return;
    const known = !state.settings.fogEnabled || p.identified || canMakeOut(p.row, p.col);
    add(p.kind, p, known ? glyphOf(p) : null);
  });
  add('player', freeAt(), t('term.player.symbol'), { row: f.playerRow, col: f.playerCol });
  return things;
}

// Where free walking has the player (one stick plan, walk.js), as a place
// in tiles like a slide's (the tile's top-left corner).
function freeAt() {
  const at = freeSpot();
  return { row: at.y - 0.5, col: at.x - 0.5 };
}

// Where a looping pulse is this frame, from 0 (dim) to 1 (bright) and back
// over `period` ms, started `offsetMs` in. Still at the middle under
// reduced motion.
function pulse(period, offsetMs = 0) {
  if (reducedMotion.matches) return 0.5;
  return sampleKeys(PULSE_KEYS, ((frameNow + offsetMs) % period) / period, EASE_IN_OUT);
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
