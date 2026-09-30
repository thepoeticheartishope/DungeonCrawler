// Canvas map: draws the floor (tiles, fog, walls, pillars, the boss
// light's mist, items and every actor's glyph) onto one <canvas> from
// `state`, with a phosphor afterglow. It sits behind the DEV toggle
// "Map: DOM / canvas" until it has caught up with the DOM map in
// render.js (isometric map plan, step 1a); the DOM map stays the default.
//
// main.js calls initMapView() once and requestMapDraw() after anything on
// the map may have changed; devpanel.js flips state.settings.canvasMap and
// calls applyMapMode(). This file reads state and never changes it.
//
// Everything is drawn into one canvas (the "phosphor"), so a later CRT
// pass (curved glass, bloom) can read that canvas and draw on top of it.

import { state, key } from './state.js';
import {
  VIEWPORT_SIZE, DIRECTION_ARROWS, AFTERGLOW_FADE, AFTERGLOW_SETTLE_MS, MAP_GLYPH_SIZES,
} from './config.js';
import { canMakeOut } from './sight.js';
import { glyphForCategory } from './quiz.js';
import { t } from './text.js';

// Drawing proportions copied from the DOM map's CSS in index.html, so the
// two maps look the same side by side.
const PILLAR_INSET = 0.16;   // a pillar is smaller than its tile, so it reads as a column
const FOG_DIM_ALPHA = 0.68;  // explored-but-unlit floor at a third of its brightness
const MIST_RADIUS = 1.1;     // boss mist spills past its tile, so lit tiles blend into one haze
const MIST_STRENGTH = 0.85;  // the middle of the mist's slow drift (1b makes it drift)
const BLOOM_RADIUS = 0.85;   // the hostile bloom behind the boss and minions
const REMEMBERED_ALPHA = 0.35; // papers and boxes seen before but not lit now
const TARGET_ALPHA = 0.75;   // the target box, at the middle of its pulse (1b makes it pulse)

// Floor beyond the player's memory, a touch warmer than black like the DOM map.
const HIDDEN_FLOOR = '#050403';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let wrap = null;    // .grid-wrap: its canvas-map class says which map shows
let canvas = null;  // the phosphor: what the player sees, faded frame to frame
let screen = null;  // the phosphor's 2D context
const scene = document.createElement('canvas'); // this frame, drawn plain from state
const sceneCtx = scene.getContext('2d');
let mistSprite = null; // one tile's worth of boss mist, redrawn when the size changes
let colours = {};
let frameHandle = 0; // the queued animation frame, or 0 when nothing is queued
let dirty = false;   // state may have changed since the scene was last drawn
let snap = false;    // show the next scene straight away, with no afterglow
let lastChange = 0;  // when the scene last changed, for the afterglow's settle
let lastFrame = 0;   // when the last faded frame was drawn, 0 while idle

// Stores the canvas and reads the map colours from the page's CSS
// variables, so the palette has one source (index.html :root). Redraws
// once the terminal font has loaded, since glyphs drawn before that come
// out in the fallback font.
export function initMapView(canvasEl, wrapEl) {
  canvas = canvasEl;
  wrap = wrapEl;
  screen = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  colours = {
    tileA: read('--tile-a'), tileB: read('--tile-b'), wall: read('--wall'), line: read('--line'),
    text: read('--text'), muted: read('--muted'), torch: read('--torch'), bright: read('--torch-bright'),
    glowRgb: read('--glow-rgb'), bossFogRgb: read('--boss-fog-rgb'),
  };
  new ResizeObserver(() => {
    snap = true;
    requestMapDraw();
  }).observe(canvas);
  document.fonts.load('10px VT323').then(requestMapDraw);
  applyMapMode();
}

// Shows whichever map state.settings.canvasMap picks. The DOM map keeps
// updating underneath either way, so switching back and forth is instant.
export function applyMapMode() {
  wrap.classList.toggle('canvas-map', state.settings.canvasMap);
  snap = true;
  requestMapDraw();
}

// Asks for the map to be drawn again from state on the next frame. Cheap
// to call often: several calls before a frame make one drawing, and it
// does nothing while the DOM map is showing.
export function requestMapDraw() {
  if (!canvas || !state.settings.canvasMap) return;
  dirty = true;
  queueFrame();
}

function queueFrame() {
  if (!frameHandle) frameHandle = requestAnimationFrame(drawFrame);
}

// One animation frame. A changed state is drawn into the scene; then the
// phosphor keeps part of its last frame and takes the brighter of that and
// the scene, pixel by pixel, so light the player leaves fades out instead
// of vanishing. Once nothing has changed for AFTERGLOW_SETTLE_MS the fade
// is done: the phosphor takes the scene exactly (rounding would otherwise
// leave faint ghosts that never clear) and the frames stop until the next
// change. Reduced motion skips the fade.
function drawFrame(now) {
  frameHandle = 0;
  if (!fitCanvas()) return;
  if (dirty) {
    drawScene();
    dirty = false;
    lastChange = now;
  }
  if (snap || reducedMotion.matches || now - lastChange >= AFTERGLOW_SETTLE_MS) {
    screen.globalCompositeOperation = 'copy';
    screen.drawImage(scene, 0, 0);
    screen.globalCompositeOperation = 'source-over';
    snap = false;
    lastFrame = 0;
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
function fitCanvas() {
  const size = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
  if (!size) return false;
  if (canvas.width === size && scene.width === size) return true;
  canvas.width = canvas.height = size;
  scene.width = scene.height = size;
  mistSprite = makeMistSprite(size / VIEWPORT_SIZE);
  dirty = true;
  snap = true;
  return true;
}

// One tile's boss mist as a soft round haze, drawn once per size instead
// of building a gradient for every lit tile on every frame.
function makeMistSprite(cell) {
  const radius = cell * MIST_RADIUS;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = Math.ceil(radius * 2);
  const ctx = sprite.getContext('2d');
  const mid = sprite.width / 2;
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, radius);
  const fog = a => 'rgba(' + colours.bossFogRgb + ', ' + a + ')';
  g.addColorStop(0, fog(0.13));
  g.addColorStop(0.45, fog(0.09));
  g.addColorStop(0.8, fog(0.03));
  g.addColorStop(1, fog(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sprite.width, sprite.height);
  return sprite;
}

// Draws the whole map as state has it now, in the DOM map's layer order:
// floor and walls, then the boss mist over them, then things on the floor.
function drawScene() {
  const ctx = sceneCtx;
  const cell = scene.width / VIEWPORT_SIZE;
  ctx.fillStyle = HIDDEN_FLOOR;
  ctx.fillRect(0, 0, scene.width, scene.height);
  forEachViewTile((row, col, x, y) => drawTile(ctx, row, col, x, y, cell));
  forEachViewTile((row, col, x, y) => drawMist(ctx, row, col, x, y, cell));
  drawActors(ctx, cell);
}

// Calls fn(row, col, x, y) for every world tile in the camera's window,
// with the tile's top-left corner in canvas pixels.
function forEachViewTile(fn) {
  const cell = scene.width / VIEWPORT_SIZE;
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      fn(state.floor.camRow + vr, state.floor.camCol + vc, vc * cell, vr * cell);
    }
  }
}

// How much of a tile the player sees: 'lit' now, 'dim' (explored, not lit
// now) or 'hidden' (never seen, or wiped by the darkness).
function fogOf(row, col) {
  const k = key(row, col);
  if (!state.settings.fogEnabled || state.floor.visibleSet.has(k)) return 'lit';
  return state.floor.exploredSet.has(k) ? 'dim' : 'hidden';
}

// One floor tile: the checkerboard, a wall block, or a pillar standing on
// the floor, dimmed if only remembered.
function drawTile(ctx, row, col, x, y, cell) {
  const fog = fogOf(row, col);
  if (fog === 'hidden') return;
  const k = key(row, col);
  if (state.floor.wallSet.has(k)) {
    ctx.fillStyle = colours.wall;
    ctx.fillRect(x, y, cell, cell);
    // A black seam round each wall block, like the DOM map's inset edge.
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  } else {
    ctx.fillStyle = (row + col) % 2 !== 0 ? colours.tileB : colours.tileA;
    ctx.fillRect(x, y, cell, cell);
  }
  if (state.floor.pillarSet.has(k)) {
    const inset = cell * PILLAR_INSET;
    ctx.fillStyle = colours.wall;
    ctx.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
    ctx.strokeStyle = colours.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, cell - inset * 2 - 1, cell - inset * 2 - 1);
  }
  if (fog === 'dim') {
    ctx.fillStyle = 'rgba(0, 0, 0, ' + FOG_DIM_ALPHA + ')';
    ctx.fillRect(x, y, cell, cell);
  }
}

// The boss light's pale blue mist on a lit floor tile (not walls, not
// floor the player has never seen). Remembered floor shows it dimmed.
function drawMist(ctx, row, col, x, y, cell) {
  const k = key(row, col);
  if (!state.floor.bossLitSet.has(k) || state.floor.wallSet.has(k)) return;
  const fog = fogOf(row, col);
  if (fog === 'hidden') return;
  ctx.globalAlpha = MIST_STRENGTH * (fog === 'dim' ? 1 - FOG_DIM_ALPHA : 1);
  const half = mistSprite.width / 2;
  ctx.drawImage(mistSprite, x + cell / 2 - half, y + cell / 2 - half);
  ctx.globalAlpha = 1;
}

// Every glyph on the map, following render.js renderFog's rules for what
// shows: things are seen only on lit tiles, '?' until the player is close
// enough to make them out (and then with no hostile glow to give an enemy
// away), stairs always, papers and boxes remembered dimly once seen.
// Order follows the DOM map, so moving things draw over items.
function drawActors(ctx, cell) {
  const f = state.floor;
  const isLit = (row, col) => !state.settings.fogEnabled || f.visibleSet.has(key(row, col));
  const glyphOrUnknown = (thing, glyph) => (canMakeOut(thing.row, thing.col) ? glyph : null);

  if (f.boss && isLit(f.boss.row, f.boss.col)) {
    drawGlyph(ctx, cell, f.boss, glyphOrUnknown(f.boss, t('term.boss.symbol')), { size: 'boss', bloom: 0.26 });
  }
  f.props.forEach(p => {
    const lit = isLit(p.row, p.col);
    const remembered = state.settings.fogEnabled && !lit && !f.darkness && f.exploredSet.has(key(p.row, p.col));
    if (!lit && !remembered) return;
    // A paper under the player or a minion is hidden, so glyphs don't pile up.
    const under = thing => thing.row === p.row && thing.col === p.col;
    if (p.kind === 'paper' && (under({ row: f.playerRow, col: f.playerCol }) || f.minions.some(under))) return;
    const known = !state.settings.fogEnabled || p.identified || canMakeOut(p.row, p.col);
    drawGlyph(ctx, cell, p, known ? t('term.' + p.kind + '.symbol') : null, {
      size: 'prop', colour: p.searched ? colours.muted : colours.torch, alpha: remembered ? REMEMBERED_ALPHA : 1,
    });
  });
  if (f.coin && isLit(f.coin.row, f.coin.col)) {
    drawGlyph(ctx, cell, f.coin, glyphOrUnknown(f.coin, t('term.gold.symbol')), { size: 'coin' });
  }
  if (f.chest && isLit(f.chest.row, f.chest.col)) {
    drawGlyph(ctx, cell, f.chest, glyphOrUnknown(f.chest, t('term.chest.symbol')), { size: 'chest' });
  }
  if (f.rune && isLit(f.rune.row, f.rune.col)) {
    drawGlyph(ctx, cell, f.rune, glyphOrUnknown(f.rune, t('term.rune.symbol')), { size: 'rune' });
  }
  // The stairs are never lost in the fog: they're the way out.
  if (f.stairs) drawGlyph(ctx, cell, f.stairs, t('term.exit.symbol'), { size: 'stairs', colour: colours.bright });
  drawGlyph(ctx, cell, { row: f.playerRow, col: f.playerCol }, DIRECTION_ARROWS[f.facing], { size: 'player' });
  f.encounters.forEach(e => {
    if (!isLit(e.row, e.col)) return;
    drawGlyph(ctx, cell, e, glyphOrUnknown(e, glyphForCategory(e.category)), { size: 'encounter' });
  });
  f.minions.forEach(m => {
    if (!isLit(m.row, m.col)) return;
    const hunter = m.kind === 'hunter';
    drawGlyph(ctx, cell, m, glyphOrUnknown(m, t('term.' + m.kind + '.symbol')), {
      size: m.kind, colour: hunter ? colours.bright : colours.text, bloom: hunter ? 0.32 : 0.26,
    });
  });
  drawTargetBox(ctx, cell);
}

// Draws one glyph standing on its tile, with the terminal's soft phosphor
// glow. A null glyph is the '?' of something too far to make out: dim,
// and without the hostile bloom. Things outside the camera's window are
// skipped. Options: size (a MAP_GLYPH_SIZES key), colour, alpha, and
// bloom (the strength of the glow behind a hostile glyph).
function drawGlyph(ctx, cell, at, glyph, { size, colour = colours.text, alpha = 1, bloom = 0 }) {
  const vr = at.row - state.floor.camRow;
  const vc = at.col - state.floor.camCol;
  if (vr < 0 || vr >= VIEWPORT_SIZE || vc < 0 || vc >= VIEWPORT_SIZE) return;
  const cx = (vc + 0.5) * cell;
  const cy = (vr + 0.5) * cell;
  const known = glyph !== null;
  ctx.globalAlpha = alpha;
  if (known && bloom) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * BLOOM_RADIUS);
    g.addColorStop(0, 'rgba(' + colours.glowRgb + ', ' + bloom + ')');
    g.addColorStop(0.55, 'rgba(' + colours.glowRgb + ', ' + (bloom / 4) + ')');
    g.addColorStop(0.75, 'rgba(' + colours.glowRgb + ', 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
  }
  ctx.font = Math.round(cell * MAP_GLYPH_SIZES[size]) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = known ? colour : colours.muted;
  ctx.shadowColor = 'rgba(' + colours.glowRgb + ', 0.35)';
  ctx.shadowBlur = cell * 0.2;
  ctx.fillText(known ? glyph : t('term.unknown.symbol'), cx, cy);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// The box around whatever the battle screen is fighting, like the DOM
// map's .targeted outline.
function drawTargetBox(ctx, cell) {
  const target = state.battle.selectedTarget;
  if (!target || target.row === undefined) return;
  const vr = target.row - state.floor.camRow;
  const vc = target.col - state.floor.camCol;
  if (vr < 0 || vr >= VIEWPORT_SIZE || vc < 0 || vc >= VIEWPORT_SIZE) return;
  const line = Math.max(2, cell * 0.06);
  ctx.globalAlpha = TARGET_ALPHA;
  ctx.strokeStyle = colours.bright;
  ctx.lineWidth = line;
  ctx.shadowColor = 'rgba(' + colours.glowRgb + ', 0.5)';
  ctx.shadowBlur = line * 3;
  ctx.strokeRect(vc * cell + line / 2, vr * cell + line / 2, cell - line, cell - line);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}
