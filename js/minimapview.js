// The minimap (Timothy, 2026-10-11): MAP (or M) lays a small plan of the
// floor over the map, and again (or M, Escape, a tap on it) takes it away.
// It shows as little as it can: the tiles the player has seen (walls
// brighter than floor) and a dot for the player. No minions, items or
// stairs, so it helps the player find their way without playing the floor
// for them. Drawn as a diamond like the map, so north is up and to the
// right, as on the d-pad, and scaled to fit, but never bigger than
// MINIMAP_MAX_UNIT, so a few seen tiles don't fill the screen. Opening it costs no turn. main.js calls
// refreshMinimap() whenever the map is drawn. Reads state only.

import { state, key } from './state.js';
import { t } from './text.js';
import { MINIMAP_MAX_UNIT, MINIMAP_PAD } from './config.js';

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
  const player = { row: f.playerRow, col: f.playerCol };
  ctx.beginPath();
  ctx.arc(left + across(player) * unit, top + down(player) * unit, Math.max(3, unit * 0.45), 0, Math.PI * 2);
  ctx.fillStyle = colours.player;
  ctx.fill();
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

// Floor, wall and player colours from the page's CSS variables, so the
// minimap matches the phosphor screen.
function readColours() {
  const css = getComputedStyle(document.documentElement);
  const glow = css.getPropertyValue('--glow-rgb').trim();
  return {
    floor: 'rgba(' + glow + ', 0.3)',
    wall: 'rgba(' + glow + ', 0.6)',
    player: css.getPropertyValue('--torch-bright').trim(),
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
