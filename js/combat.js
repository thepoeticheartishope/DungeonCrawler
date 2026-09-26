// Pathfinding and combat/turn mechanics: adjacency, minion movement and
// spawning, and advancing a turn. Depends on render.js for the visual
// side-effects of a turn (positioning, HUD, fog) but render.js never
// depends back on this module, so there's no import cycle.
//
// Call initCombat(elements) once, from main.js, before spawnMinion or
// advanceMonsters run.

import { state, key } from './state.js';
import { MINION_HP, MINION_CHASE_RANGE, HUNTER_SPAWN_DELAY, HUNTER_REST_TURNS, HUNTER_REST_AFTER_MISS } from './config.js';
import { positionActor, setGlyph, renderCombatStatus, computeVisibility, renderFog, renderTargeting, renderLightEye } from './render.js';
import { advanceLight } from './light.js';
import { t } from './text.js';

let combatEls = {};

export function initCombat({ grid, playerActor, turnCountEl }) {
  combatEls = { grid, playerActor, turnCountEl };
}

export function isAdjacentToPlayer(entity) {
  return Math.abs(entity.row - state.playerRow) + Math.abs(entity.col - state.playerCol) === 1;
}

export function findAdjacentEnemies() {
  const result = [];
  if (state.boss && isAdjacentToPlayer(state.boss)) result.push(state.boss);
  for (const m of state.minions) {
    if (isAdjacentToPlayer(m)) result.push(m);
  }
  if (state.chest && isAdjacentToPlayer(state.chest)) result.push(state.chest);
  if (state.rune && isAdjacentToPlayer(state.rune)) result.push(state.rune);
  for (const e of state.encounters) {
    if (isAdjacentToPlayer(e)) result.push(e);
  }
  // A trapped box only becomes something to answer once it's been
  // bumped (main.js examineProp); until then it looks like any other.
  for (const p of state.props) {
    if (p.sprung && isAdjacentToPlayer(p)) result.push(p);
  }
  return result;
}

// Drops the current target if it's no longer adjacent, then auto-picks an
// adjacent enemy if one is available and nothing is targeted. A manual tap
// on any other adjacent enemy always overrides this.
export function refreshTargetValidity() {
  if (state.selectedTarget && !isAdjacentToPlayer(state.selectedTarget)) {
    state.selectedTarget = null;
  }
  if (!state.selectedTarget) {
    const adjacent = findAdjacentEnemies();
    if (adjacent.length > 0) state.selectedTarget = adjacent[0];
  }
  renderTargeting();
}

// True if any player, boss, minion, item or solid piece of furniture
// currently occupies this tile (papers lie flat, so they don't count).
export function tileOccupied(row, col, excludeMinion) {
  if (state.pillarSet.has(key(row, col))) return true;
  if (state.props.some(p => p.kind === 'box' && p.row === row && p.col === col)) return true;
  if (state.boss && state.boss.row === row && state.boss.col === col) return true;
  if (state.playerRow === row && state.playerCol === col) return true;
  if (state.chest && state.chest.row === row && state.chest.col === col) return true;
  if (state.rune && state.rune.row === row && state.rune.col === col) return true;
  if (state.encounters.some(e => e.row === row && e.col === col)) return true;
  for (const m of state.minions) {
    if (m === excludeMinion) continue;
    if (m.row === row && m.col === col) return true;
  }
  return false;
}

export function neighbors(r, c) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([nr, nc]) => nr >= 0 && nr < state.GRID_SIZE && nc >= 0 && nc < state.GRID_SIZE);
}

// Walls, pillars, boxes, the boss, and every other minion's
// current tile, from one minion's point of view — so it paths around them instead of computing the same
// blocked step every turn. Minions are placed outside the boss chamber
// (loadRoom) and the boss holds its one doorway, so they never end up
// inside it. Items (chest, rune, encounters) don't block a chase — a
// monster paths straight through rather than getting stuck when one sits
// in a one-wide corridor; items are only obstacles to the player.
export function blockedTilesFor(minion) {
  const blocked = new Set(state.wallSet);
  state.pillarSet.forEach(k => blocked.add(k));
  state.props.forEach(p => { if (p.kind === 'box') blocked.add(key(p.row, p.col)); });
  if (state.boss) blocked.add(key(state.boss.row, state.boss.col));
  for (const other of state.minions) {
    if (other === minion) continue;
    blocked.add(key(other.row, other.col));
  }
  return blocked;
}

// Shortest path between two tiles, avoiding walls. Returns array of {row,col} or null.
export function bfsPath(start, target, walls) {
  const startKey = key(start.row, start.col);
  const targetKey = key(target.row, target.col);
  if (startKey === targetKey) return [start];
  const visited = new Set([startKey]);
  const queue = [[start]];
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    for (const [nr, nc] of neighbors(cur.row, cur.col)) {
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      if (walls.has(k) && k !== targetKey) continue;
      visited.add(k);
      const newPath = path.concat([{ row: nr, col: nc }]);
      if (k === targetKey) return newPath;
      queue.push(newPath);
    }
  }
  return null;
}

// The free floor tile the most walkable steps from the player, for the
// hunter to wake on or be thrown back to.
function farthestFromPlayer() {
  const blocked = new Set(state.wallSet);
  state.pillarSet.forEach(k => blocked.add(k));
  state.props.forEach(p => { if (p.kind === 'box') blocked.add(key(p.row, p.col)); });
  const start = { row: state.playerRow, col: state.playerCol };
  const dist = new Map([[key(start.row, start.col), 0]]);
  const queue = [start];
  let best = null;
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    if (d > 0 && !tileOccupied(cur.row, cur.col) && (!best || d > best.d)) best = { ...cur, d };
    for (const [nr, nc] of neighbors(cur.row, cur.col)) {
      const k = key(nr, nc);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return best;
}

function wakeHunter() {
  const spot = farthestFromPlayer();
  if (!spot) return false;
  const m = spawnMinion(spot);
  m.kind = 'hunter';
  m.rest = 0;
  m.el.classList.remove('minion');
  m.el.classList.add('hunter');
  setGlyph(m.el, t('term.hunter.symbol'));
  state.hunter = m;
  return true;
}

// After its question is answered, the hunter loses the trail: back to the
// far side of the floor, where it waits a few turns before hunting again.
export function repelHunter(m, answeredRight) {
  const spot = farthestFromPlayer();
  if (spot) {
    m.row = spot.row;
    m.col = spot.col;
    positionActor(m.el, m.row, m.col, true);
  }
  m.rest = answeredRight ? HUNTER_REST_TURNS : HUNTER_REST_AFTER_MISS;
}

// Places a minion on `spot` (a free floor tile) — loadRoom picks the tiles.
export function spawnMinion(spot) {
  const el = document.createElement('div');
  el.className = 'actor minion';
  setGlyph(el, t('term.minion.symbol'));
  // Offsets this minion's warp animation out of sync with any others already
  // on screen — several identical creatures warping in perfect lockstep
  // reads as mechanical, not unsettling. Same idea for the glitch-bar
  // dropout, via a custom property its ::after reads (a pseudo-element
  // isn't a real node, so its own animation-delay can't be set directly).
  el.style.animationDelay = (Math.random() * -3.6).toFixed(2) + 's';
  el.style.setProperty('--glitch-delay', (Math.random() * -6.5).toFixed(2) + 's');
  combatEls.grid.appendChild(el);
  const m = { row: spot.row, col: spot.col, hp: MINION_HP, el, kind: 'minion' };
  positionActor(el, m.row, m.col, true); // freshly spawned — appears in place, doesn't slide in
  state.minions.push(m);
  return m;
}

// A random free neighbouring floor tile for a wandering minion, or null if
// it's boxed in this turn. Unlike a chase, wandering never steps onto an
// item, so an idle minion doesn't sit on top of a chest or rune.
function wanderStep(m) {
  const options = neighbors(m.row, m.col)
    .filter(([r, c]) => !state.wallSet.has(key(r, c)) && !tileOccupied(r, c, m));
  if (options.length === 0) return null;
  const [row, col] = options[Math.floor(Math.random() * options.length)];
  return { row, col };
}

// Advances the room by one turn: the boss light spreads, minions move, and
// the turn counter increases. Called after any player action.
export function advanceMonsters() {
  state.turnCount++;
  combatEls.turnCountEl.textContent = state.turnCount;
  advanceLight();

  // Walking around is safe: a minion that reaches the player never deals
  // damage here. It engages instead — it becomes the target, which puts the
  // battle screen up, and hearts are only ever lost by missing a question.
  // Minions roam freely and only give chase once the player is within
  // MINION_CHASE_RANGE walkable steps.
  let engageNote = '';
  let hunterNote = '';
  if (state.darkness) {
    state.darkTurns++;
    if (!state.hunter && state.darkTurns >= HUNTER_SPAWN_DELAY && wakeHunter()) hunterNote = t('room.hunter.wakes');
  }
  for (const m of state.minions) {
    if (m.rest > 0) {
      m.rest--;
      continue;
    }
    const path = bfsPath({ row: m.row, col: m.col }, { row: state.playerRow, col: state.playerCol }, blockedTilesFor(m));
    // In the darkness after the boss falls, every minion hunts, from anywhere.
    const chasing = path && (state.darkness || path.length - 1 <= MINION_CHASE_RANGE);
    const next = chasing ? path[1] : wanderStep(m);
    if (next) {
      const isPlayerTile = next.row === state.playerRow && next.col === state.playerCol;

      if (isPlayerTile) {
        // Engage from where it stands, never occupying the player's tile.
        if (!state.selectedTarget) state.selectedTarget = m;
        engageNote = t('room.engage');
      } else {
        m.row = next.row;
        m.col = next.col;
        positionActor(m.el, m.row, m.col);
      }
    }
    // If next is null, this minion has no route around current
    // obstacles this turn — it waits rather than overlapping anything.
  }

  renderCombatStatus();
  computeVisibility();
  renderFog();
  renderLightEye();
  refreshTargetValidity();
  return { engageNote, hunterNote };
}
