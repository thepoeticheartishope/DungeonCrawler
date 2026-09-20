// Pathfinding and combat/turn mechanics: adjacency, minion movement and
// spawning, and advancing a turn. Depends on render.js for the visual
// side-effects of a turn (positioning, HUD, fog) but render.js never
// depends back on this module, so there's no import cycle.
//
// Call initCombat(elements) once, from main.js, before spawnMinion or
// advanceMonsters run.

import { state, key } from './state.js';
import { MINION_ICONS, MINION_HP, SPAWN_INTERVAL, MAX_MINIONS } from './config.js';
import { positionActor, renderCombatStatus, renderFog, renderTargeting, renderHearts } from './render.js';

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

// True if any player, boss, or minion currently occupies this tile.
export function tileOccupied(row, col, excludeMinion) {
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

// Finds the nearest free, walkable tile to (row, col) — used to place a
// freshly summoned minion beside the boss instead of on top of it.
export function findFreeTileNear(row, col) {
  const startKey = key(row, col);
  const visited = new Set([startKey]);
  const queue = [{ row, col }];
  while (queue.length) {
    const cur = queue.shift();
    for (const [nr, nc] of neighbors(cur.row, cur.col)) {
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      visited.add(k);
      if (state.wallSet.has(k)) continue;
      if (!tileOccupied(nr, nc)) return { row: nr, col: nc };
      queue.push({ row: nr, col: nc });
    }
  }
  return null;
}

// Walls plus every other occupant's current tile, from one minion's point
// of view — so it paths around the boss and other minions instead of
// computing the same blocked step every turn.
// Walls and other monsters block a minion's path, but items (chest, rune,
// encounters) don't — a monster paths straight through an item tile rather
// than detouring around it or getting stuck when one sits in a one-wide
// corridor. Items are only obstacles to the player, who must stand beside
// one to interact with it.
export function blockedTilesFor(minion) {
  const blocked = new Set(state.wallSet);
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

export function bfsNextStep(start, target, walls) {
  const path = bfsPath(start, target, walls);
  if (!path || path.length < 2) return null;
  return path[1];
}

export function spawnMinion() {
  const spot = findFreeTileNear(state.boss.row, state.boss.col);
  if (!spot) return; // no open tile nearby this turn — skip the spawn

  const el = document.createElement('div');
  el.className = 'actor minion';
  el.textContent = MINION_ICONS[state.minions.length % MINION_ICONS.length];
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
}

// Advances the fight by one turn: minions move, the spawn timer ticks,
// and the turn counter increases. Called after any player action.
export function advanceMonsters() {
  state.turnCount++;
  combatEls.turnCountEl.textContent = state.turnCount;

  state.turnsSinceSpawn++;
  let spawnNote = '';
  if (state.turnsSinceSpawn >= SPAWN_INTERVAL) {
    state.turnsSinceSpawn = 0;
    if (state.boss && state.minions.length < MAX_MINIONS) {
      spawnMinion();
      spawnNote = ' The boss summons a minion!';
    }
  }

  let hitNote = '';
  for (const m of state.minions) {
    const next = bfsNextStep({ row: m.row, col: m.col }, { row: state.playerRow, col: state.playerCol }, blockedTilesFor(m));
    if (next) {
      const isPlayerTile = next.row === state.playerRow && next.col === state.playerCol;

      if (isPlayerTile) {
        // Attack: the minion strikes from where it stands, but never
        // occupies the player's tile.
        state.hearts--;
        renderHearts();
        combatEls.grid.classList.remove('shake');
        void combatEls.grid.offsetWidth;
        combatEls.grid.classList.add('shake');
        combatEls.playerActor.classList.remove('hit-flash');
        void combatEls.playerActor.offsetWidth;
        combatEls.playerActor.classList.add('hit-flash');
        hitNote = ' A minion reaches you and strikes!';
        if (state.hearts <= 0) break;
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
  renderFog();
  refreshTargetValidity();
  return { spawnNote, hitNote };
}
