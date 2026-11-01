// The minimap (Timothy, 2026-10-11): a small plan of the floor, on the
// record book's MAP page (record book plan step D: MAP or M opens the
// book there, bookview.js). It shows as little as it can: the tiles the
// player has seen (walls brighter than floor) and a dot for the player.
// No minions, items or stairs, so it helps the player find their way
// without playing the floor for them. The one thing it does mark is the
// grates the player has seen, and a dashed line between a pair once they
// know where it leads (vents and noise plan, Timothy's call): the ducts
// are how the stick men come. Lamps the player has seen get a small ring
// (presence cues plan step B): the lit places to plan from. On a fixed plan it also names the building
// and each room the player has walked into, so the floor can be learned
// run after run, and a room seen but not yet walked into is drawn faint
// with dashed walls. Drawn square like the map (room view plan step G),
// north up, as on the d-pad, and scaled to fit, but never bigger than
// MINIMAP_MAX_UNIT, so a few seen tiles don't fill the page. main.js
// calls refreshMinimap() whenever the map is drawn. Reads state only.

import { state, key, parseKey } from './state.js';
import { t } from './text.js';
import { MINIMAP_MAX_UNIT, MINIMAP_PAD, MINIMAP_LABEL_PX, MINIMAP_TITLE_PX, MINIMAP_ARROW } from './config.js';
import { lookAngle } from './look.js';
import { teachTargets } from './roles.js';

const els = {};

// Looks up the minimap's canvas. Call once, from main.js.
export function initMinimap() {
  els.canvas = document.getElementById('minimap');
  els.canvas.setAttribute('aria-label', t('map.label'));
}

// Whether the minimap is showing: the book is open at its MAP page.
export function minimapShown() {
  return !!els.canvas && els.canvas.offsetParent !== null;
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
  const colours = readColours(canvas);

  const f = state.floor;
  const tiles = [...seenTiles()];
  if (!tiles.length) return;
  // Crew waiting to be taught (roles.js teachTargets) are shown even in
  // rooms not seen yet, so the map always takes them in.
  const targets = teachTargets();
  const bounds = [...tiles, ...targets];
  // A tile's centre in tile units: east is right and north up, as on the map.
  const across = tile => tile.col;
  const down = tile => tile.row;
  const minX = Math.min(...bounds.map(across)) - 0.5;
  const maxX = Math.max(...bounds.map(across)) + 0.5;
  const minY = Math.min(...bounds.map(down)) - 0.5;
  const maxY = Math.max(...bounds.map(down)) + 0.5;
  const unit = Math.min(MINIMAP_MAX_UNIT, (width - MINIMAP_PAD * 2) / (maxX - minX), (height - MINIMAP_PAD * 2) / (maxY - minY));
  const left = (width - (maxX - minX) * unit) / 2 - minX * unit;
  const top = (height - (maxY - minY) * unit) / 2 - minY * unit;
  const away = unenteredTiles();
  ctx.fillStyle = colours.ink;
  for (const tile of tiles) {
    const out = away.has(key(tile.row, tile.col));
    const solid = isSolid(tile);
    // A wall of a room not been in shows every other tile, as a dash.
    if (out && solid && (tile.row + tile.col) % 2) continue;
    ctx.globalAlpha = solid ? colours.wall : out ? colours.floorFaint : colours.floor;
    ctx.fillRect(left + (across(tile) - 0.5) * unit, top + (down(tile) - 0.5) * unit, unit, unit);
  }
  ctx.globalAlpha = 1;
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
  // Lamps the player has seen (lamps.js): a small ring, so the lit places
  // to plan from are on the map.
  f.lamps.filter(seen).forEach(l => {
    const [x, y] = at(l);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, unit * 0.3), 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
  // Names first, so the player's dot is never hidden under one.
  drawNames(ctx, colours, tile => ({ x: left + across(tile) * unit, y: top + down(tile) * unit }), targets);
  drawTargets(ctx, colours, targets.map(at), unit);
  const player = { row: f.playerRow, col: f.playerCol };
  ctx.beginPath();
  ctx.arc(left + across(player) * unit, top + down(player) * unit, Math.max(3, unit * 0.45), 0, Math.PI * 2);
  ctx.fillStyle = colours.player;
  ctx.fill();
  drawFacing(ctx, colours, at(player), unit);
}

// On a fixed plan with the fog on: the keys of the tiles of every named
// room the player hasn't walked into yet, and of the walls that only
// border such rooms. Empty otherwise.
function unenteredTiles() {
  const f = state.floor;
  const out = new Set();
  if (!f.plan || !state.settings.fogEnabled) return out;
  f.chamberAt.forEach((room, k) => {
    if (f.chamberNames[room] && !f.visitedChambers.has(room)) out.add(k);
  });
  if (!out.size) return out;
  for (const tile of seenTiles()) {
    if (isSolid(tile) && besideOnly(tile, out)) out.add(key(tile.row, tile.col));
  }
  return out;
}

// Whether every open tile round `tile` is in `keys` (and there is one).
function besideOnly({ row, col }, keys) {
  let any = false;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const next = { row: row + dr, col: col + dc };
      if ((!dr && !dc) || !inGrid(next) || isSolid(next)) continue;
      if (!keys.has(key(next.row, next.col))) return false;
      any = true;
    }
  }
  return any;
}

// Whether `tile` is on the floor's grid.
function inGrid({ row, col }) {
  const size = state.floor.GRID_SIZE;
  return row >= 0 && col >= 0 && row < size && col < size;
}

// An arrow from the player's dot shows where the light points (shoulder
// view plan step E, call 3, kept), north up like the map.
function drawFacing(ctx, colours, [x, y], unit) {
  const angle = lookAngle();
  const ax = Math.sin(angle);
  const ay = -Math.cos(angle);
  const length = Math.hypot(ax, ay);
  const [ux, uy] = [ax / length, ay / length];
  const reach = Math.max(16, unit * MINIMAP_ARROW[0]);
  const half = Math.max(5, unit * MINIMAP_ARROW[1]);
  const tip = [x + ux * reach, y + uy * reach];
  const base = [x + ux * reach * 0.45, y + uy * reach * 0.45];
  ctx.beginPath();
  ctx.moveTo(...tip);
  ctx.lineTo(base[0] - uy * half, base[1] + ux * half);
  ctx.lineTo(base[0] + uy * half, base[1] - ux * half);
  ctx.closePath();
  ctx.fillStyle = colours.player;
  ctx.fill();
}

// Each crew member waiting to be taught (roles.js teachTargets): two
// rings round their tile in the player's colour, a target to walk to.
// Still, never blinking (motion: text and marks stay calm).
function drawTargets(ctx, colours, points, unit) {
  ctx.save();
  ctx.strokeStyle = colours.player;
  ctx.fillStyle = colours.player;
  ctx.lineWidth = 2;
  points.forEach(([x, y]) => {
    const r = Math.max(6, unit * 0.9);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// On a fixed plan: the building's name in the corner, and each room's
// name over its middle once the player has walked in (every room with
// DEV -> Fog off). On the ship every room is named from the start, seen or
// not, so the player can find their way (Timothy, 2026-11-01); the other
// buildings keep theirs to explore. Each name sits on a dark band so the
// floor under it doesn't make it hard to read. `at` turns a tile into
// canvas px.
function drawNames(ctx, colours, at, targets = []) {
  const f = state.floor;
  if (!f.plan) return;
  ctx.textBaseline = 'middle';
  ctx.font = MINIMAP_TITLE_PX + 'px ' + colours.font;
  ctx.textAlign = 'left';
  ctx.fillStyle = colours.label;
  ctx.fillText(t(f.plan.name), MINIMAP_PAD, MINIMAP_PAD + MINIMAP_TITLE_PX / 2);

  ctx.font = MINIMAP_LABEL_PX + 'px ' + colours.font;
  ctx.textAlign = 'center';
  // A room with crew waiting to be taught is named even before it is seen.
  const wanted = new Set(targets.map(tile => f.chamberAt.get(key(tile.row, tile.col))));
  roomMiddles().forEach((middle, room) => {
    if (state.settings.fogEnabled && !f.plan.ship && !f.visitedChambers.has(room) && !wanted.has(room)) return;
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
    const { row, col } = parseKey(k);
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

// The page's ink and how strongly floor and walls show in it, the player
// and name colours and the font, from the CSS variables where the canvas
// is, so the minimap matches the book's paper (read each time: DEV ->
// Book paper changes it). The player is in the book's second ink.
function readColours(canvas) {
  const css = getComputedStyle(canvas);
  const mark = css.getPropertyValue('--page-mark').trim() || css.getPropertyValue('--torch-bright').trim();
  return {
    ink: css.getPropertyValue('--text').trim(),
    floor: 0.3,
    floorFaint: 0.12,
    wall: 0.6,
    player: mark,
    label: css.getPropertyValue('--text').trim(),
    band: 'rgba(0, 0, 0, 0.7)',
    font: css.getPropertyValue('--font').trim(),
  };
}
