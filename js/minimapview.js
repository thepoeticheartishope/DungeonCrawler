// The minimap (Timothy, 2026-10-11): MAP (or M) lays a small plan of the
// floor over the map, and again (or M, Escape, a tap on it) takes it away.
// It shows as little as it can: the tiles the player has seen (walls
// brighter than floor) and a dot for the player. No minions, items or
// stairs, so it helps the player find their way without playing the floor
// for them. The one thing it does mark is the grates the player has seen,
// and a dashed line between a pair once they know where it leads (vents
// and noise plan, Timothy's call): the ducts are how the stick men come.
// On a fixed plan it also names the building and each room the
// player has walked into, so the floor can be learned run after run. Drawn as a diamond like the map, so north is up and to the
// right, as on the d-pad, and scaled to fit, but never bigger than
// MINIMAP_MAX_UNIT, so a few seen tiles don't fill the screen. Opening it costs no turn. main.js calls
// refreshMinimap() whenever the map is drawn. Reads state only.

import { state, key } from './state.js';
import { t } from './text.js';
import { MINIMAP_MAX_UNIT, MINIMAP_PAD, MINIMAP_LABEL_PX, MINIMAP_TITLE_PX } from './config.js';

const els = {};
// The page's colours, read once from the CSS variables.
let colours = null;

// Looks up the minimap and its button and hooks them up. Call once, from
// main.js.
export function initMinimap() {
  els.canvas = document.getElementById('minimap');
  els.button = document.getElementById('btnMinimap');
  els.canvas.setAttribute('aria-label', t('map.label'));
  els.button.addEventListener('click', () => toggleMinimap());
  els.canvas.addEventListener('click', () => closeMinimap());
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || !onRoomScreen() || isTyping()) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMinimap(); }
    else if (e.key === 'Escape' && minimapShown()) { e.preventDefault(); closeMinimap(); }
  });
}

// Whether the minimap is showing.
export function minimapShown() {
  return !!els.canvas && !els.canvas.hidden;
}

// Shows the minimap if it's hidden, hides it if it's showing.
export function toggleMinimap() {
  if (minimapShown()) closeMinimap();
  else openMinimap();
}

// Shows the minimap, drawn from where things are now.
function openMinimap() {
  els.canvas.hidden = false;
  els.button.setAttribute('aria-pressed', 'true');
  refreshMinimap();
}

// Hides the minimap.
export function closeMinimap() {
  if (!els.canvas) return;
  els.canvas.hidden = true;
  els.button.setAttribute('aria-pressed', 'false');
}

// Redraws the minimap if it's showing, after the player moved, the floor
// changed or more of it was seen.
export function refreshMinimap() {
  if (!minimapShown()) return;
  const canvas = els.canvas;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!colours) colours = readColours();

  const f = state.floor;
  const tiles = [...seenTiles()];
  if (!tiles.length) return;
  // A tile's centre in diamond units: a step east goes right and down, a
  // step north right and up, as on the map.
  const across = tile => tile.col - tile.row;
  const down = tile => (tile.col + tile.row) / 2;
  const minX = Math.min(...tiles.map(across)) - 1;
  const maxX = Math.max(...tiles.map(across)) + 1;
  const minY = Math.min(...tiles.map(down)) - 0.5;
  const maxY = Math.max(...tiles.map(down)) + 0.5;
  const unit = Math.min(MINIMAP_MAX_UNIT, (width - MINIMAP_PAD * 2) / (maxX - minX), (height - MINIMAP_PAD * 2) / (maxY - minY));
  const left = (width - (maxX - minX) * unit) / 2 - minX * unit;
  const top = (height - (maxY - minY) * unit) / 2 - minY * unit;
  const diamond = (tile) => {
    const x = left + across(tile) * unit;
    const y = top + down(tile) * unit;
    ctx.beginPath();
    ctx.moveTo(x, y - unit / 2);
    ctx.lineTo(x + unit, y);
    ctx.lineTo(x, y + unit / 2);
    ctx.lineTo(x - unit, y);
    ctx.closePath();
  };

  for (const tile of tiles) {
    diamond(tile);
    ctx.fillStyle = isSolid(tile) ? colours.wall : colours.floor;
    ctx.fill();
  }
  // Grates the player has seen, and a line between a pair they know.
  const at = tile => [left + across(tile) * unit, top + down(tile) * unit];
  const seen = v => !state.settings.fogEnabled || f.exploredSet.has(key(v.row, v.col));
  ctx.save();
  ctx.strokeStyle = colours.player;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  f.vents.forEach((v, i) => {
    if ((!v.known && !state.settings.showDucts) || i > v.pair) return;
    ctx.beginPath();
    ctx.moveTo(...at(v));
    ctx.lineTo(...at(f.vents[v.pair]));
    ctx.stroke();
  });
  ctx.setLineDash([]);
  f.vents.filter(seen).forEach(v => {
    const [x, y] = at(v);
    const r = Math.max(2.5, unit * 0.35);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - r, y - r / 2, r * 2, r);
    ctx.strokeRect(x - r, y - r / 2, r * 2, r);
  });
  ctx.restore();
  // Names first, so the player's dot is never hidden under one.
  drawNames(ctx, tile => ({ x: left + across(tile) * unit, y: top + down(tile) * unit }));
  const player = { row: f.playerRow, col: f.playerCol };
  ctx.beginPath();
  ctx.arc(left + across(player) * unit, top + down(player) * unit, Math.max(3, unit * 0.45), 0, Math.PI * 2);
  ctx.fillStyle = colours.player;
  ctx.fill();
}

// On a fixed plan: the building's name in the corner, and each room's
// name over its middle once the player has walked in (every room with
// DEV -> Fog off). Each name sits on a dark band so the floor under it
// doesn't make it hard to read. `at` turns a tile into canvas px.
function drawNames(ctx, at) {
  const f = state.floor;
  if (!f.plan) return;
  ctx.textBaseline = 'middle';
  ctx.font = MINIMAP_TITLE_PX + 'px ' + colours.font;
  ctx.textAlign = 'left';
  ctx.fillStyle = colours.label;
  ctx.fillText(t(f.plan.name), MINIMAP_PAD, MINIMAP_PAD + MINIMAP_TITLE_PX / 2);

  ctx.font = MINIMAP_LABEL_PX + 'px ' + colours.font;
  ctx.textAlign = 'center';
  roomMiddles().forEach((middle, room) => {
    if (state.settings.fogEnabled && !f.visitedChambers.has(room)) return;
    const name = t(f.chamberNames[room]);
    const { x, y } = at(middle);
    const w = ctx.measureText(name).width + 8;
    ctx.fillStyle = colours.band;
    ctx.fillRect(x - w / 2, y - MINIMAP_LABEL_PX * 0.6, w, MINIMAP_LABEL_PX * 1.2);
    ctx.fillStyle = colours.label;
    ctx.fillText(name, x, y);
  });
}

// The middle of each named room, as a (fractional) tile: the average of
// its tiles. A Map from the room's index to { row, col }.
function roomMiddles() {
  const f = state.floor;
  const sums = new Map();
  f.chamberAt.forEach((room, k) => {
    if (!f.chamberNames[room]) return;
    const [row, col] = k.split(',').map(Number);
    const s = sums.get(room) || { row: 0, col: 0, n: 0 };
    sums.set(room, { row: s.row + row, col: s.col + col, n: s.n + 1 });
  });
  const middles = new Map();
  sums.forEach((s, room) => middles.set(room, { row: s.row / s.n, col: s.col / s.n }));
  return middles;
}

// The tiles the minimap shows, as { row, col }: every tile the player has
// seen on this floor (state.floor.exploredSet), or every tile with DEV ->
// Fog off. Of the walls, only those beside an open tile, so rooms show
// as outlines and the solid rock between them stays dark.
function* seenTiles() {
  const f = state.floor;
  for (let row = 0; row < f.GRID_SIZE; row++) {
    for (let col = 0; col < f.GRID_SIZE; col++) {
      if (state.settings.fogEnabled && !f.exploredSet.has(key(row, col))) continue;
      const tile = { row, col };
      if (!isSolid(tile) || besideOpen(tile)) yield tile;
    }
  }
}

// Whether `tile` is a wall or a pillar.
function isSolid({ row, col }) {
  const f = state.floor;
  return f.wallSet.has(key(row, col)) || f.pillarSet.has(key(row, col));
}

// Whether any of the eight tiles round `tile` is open floor on the grid.
function besideOpen({ row, col }) {
  const size = state.floor.GRID_SIZE;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr || dc) && r >= 0 && c >= 0 && r < size && c < size && !isSolid({ row: r, col: c })) return true;
    }
  }
  return false;
}

// Floor, wall, player and name colours and the font from the page's CSS
// variables, so the minimap matches the phosphor screen.
function readColours() {
  const css = getComputedStyle(document.documentElement);
  const glow = css.getPropertyValue('--glow-rgb').trim();
  return {
    floor: 'rgba(' + glow + ', 0.3)',
    wall: 'rgba(' + glow + ', 0.6)',
    player: css.getPropertyValue('--torch-bright').trim(),
    label: css.getPropertyValue('--torch-bright').trim(),
    band: 'rgba(0, 0, 0, 0.7)',
    font: css.getPropertyValue('--font').trim(),
  };
}

// Whether the room screen is up (the minimap's key works only there).
function onRoomScreen() {
  const room = document.getElementById('roomScreen');
  // Not while the ask screen (a reload or relay) has the map's place.
  return room.classList.contains('show') && !room.classList.contains('asking');
}

// Whether a text box has the keyboard (M is then a letter, not the map).
function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}
