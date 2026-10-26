// The charger (charger plan, `ideas/charger-plan.md` outside the repo;
// Timothy 2026-10-19): a machine in the start room that fills energy to
// full for free. Its puzzle, CHARGE.SYS, is a square of wires to turn until
// power runs from PWR (the left edge) to the CELL (the right edge). There is
// no wrong move and no fail state; the cost is time, a turn every
// CHARGER.wireTurnsPerTurn wire turns. Half-done wires stay as they were
// left; a charge clears them, so the next use gets new ones. No limit on
// uses. floor.js buildFloor() calls placeCharger(). No DOM access here.

import { state } from './state.js';
import { CHARGER, ENERGY_MAX } from './config.js';
import { startRoom } from './desk.js';
import { addRounds } from './gun.js';

// A wire's ends as bits; a wire is the sum of the sides it reaches.
export const N = 1, E = 2, S = 4, W = 8;
const SIDES = [[N, -1, 0], [E, 0, 1], [S, 1, 0], [W, 0, -1]];
const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };
// Wires off the path: a straight, a bend, a T and a bend again, so bends
// (the commonest shape on a path) don't stand out.
const SPARES = [N | S, N | E, N | E | S, N | E];

// A wire turned a quarter clockwise.
export function rotated(wire) {
  return ((wire << 1) | (wire >> 3)) & 15;
}

// New wires, `n` square: a random path from PWR (row `from`, left edge) to
// the CELL (row `to`, right edge) at least n + 2 long, spare wires
// everywhere else, then every wire spun at random until power doesn't
// already reach the cell. Turning the path's wires back always solves it.
// Returns { n, from, to, wires, turns: 0 } (`turns` = wire turns so far).
export function makeWires(n, rand = Math.random) {
  const pick = (count) => Math.floor(rand() * count);
  const from = pick(n), to = pick(n);
  const path = [];
  const onPath = new Set();
  const walk = (row, col) => {
    path.push([row, col]);
    onPath.add(row * n + col);
    if (row === to && col === n - 1 && path.length >= n + 2) return true;
    const next = SIDES.map(([, dr, dc]) => [row + dr, col + dc])
      .filter(([r, c]) => r >= 0 && r < n && c >= 0 && c < n && !onPath.has(r * n + c));
    while (next.length) {
      const [[r, c]] = next.splice(pick(next.length), 1);
      if (walk(r, c)) return true;
    }
    path.pop();
    onPath.delete(row * n + col);
    return false;
  };
  walk(from, 0);
  const sideTo = ([r0, c0], [r1, c1]) => SIDES.find(([, dr, dc]) => r0 + dr === r1 && c0 + dc === c1)[0];
  const wires = Array.from({ length: n * n }, () => SPARES[pick(SPARES.length)]);
  path.forEach((p, i) => {
    const back = i === 0 ? W : sideTo(p, path[i - 1]);
    const on = i === path.length - 1 ? E : sideTo(p, path[i + 1]);
    wires[p[0] * n + p[1]] = back | on;
  });
  const puzzle = { n, from, to, wires, turns: 0 };
  do {
    puzzle.wires = puzzle.wires.map(wire => {
      for (let t = pick(4); t > 0; t--) wire = rotated(wire);
      return wire;
    });
  } while (powered(puzzle).done);
  return puzzle;
}

// Where the power reaches: `on` = the set of wire indexes it runs through
// from PWR, `done` = it leaves the CELL's wire through the right edge.
export function powered({ n, from, to, wires }) {
  const on = new Set();
  const first = from * n;
  if (wires[first] & W) {
    on.add(first);
    const queue = [first];
    while (queue.length) {
      const i = queue.shift();
      const row = Math.floor(i / n), col = i % n;
      for (const [side, dr, dc] of SIDES) {
        const r = row + dr, c = col + dc, j = r * n + c;
        if (!(wires[i] & side) || r < 0 || r >= n || c < 0 || c >= n || on.has(j)) continue;
        if (!(wires[j] & OPPOSITE[side])) continue;
        on.add(j);
        queue.push(j);
      }
    }
  }
  const last = to * n + n - 1;
  return { on, done: on.has(last) && !!(wires[last] & E) };
}

// The wires' size on this depth (CHARGER.sizes, the last for any deeper).
export function wireSize() {
  const sizes = CHARGER.sizes;
  return sizes[Math.min(state.run.roomIndex, sizes.length - 1)];
}

// The floor's one charger, in the room holding `layout.start`, on the
// furniture's rules, never on a `taken` tile (the desk's among them). Null
// if the room has no spot for it. Returns { row, col, kind: 'charger' } or null.
export function placeCharger(layout, placer, taken) {
  const room = startRoom(layout);
  if (!room) return null;
  const free = room.floorCells.filter(p => !taken.some(q => q.row === p.row && q.col === p.col));
  const spot = placer.pick(free, true);
  return spot ? { ...spot, kind: 'charger' } : null;
}

// Bumping the charger. At full energy nothing opens (Timothy 2026-10-26).
// Otherwise CHARGE.SYS opens on its wires: the ones left half done
// (`kept`), else new ones for this depth. No turn is spent.
// Events: chargerFull, or chargerOpened { kept }.
export function useCharger(charger, rand = Math.random) {
  if (state.run.energy >= ENERGY_MAX) return [{ type: 'chargerFull' }];
  const kept = !!charger.puzzle;
  if (!kept) charger.puzzle = makeWires(wireSize(), rand);
  return [{ type: 'chargerOpened', kept }];
}

// Turns wire `i` a quarter clockwise. Every CHARGER.wireTurnsPerTurn-th
// wire turn on these wires spends a turn (`turnSpent`: the caller runs the
// world's turn; with Real time on the clock is the cost instead). Once the
// power reaches the cell, energy fills to ENERGY_MAX with plain rounds and
// the wires are cleared for next time.
// Events: wireTurned { index }, then turnSpent, then charged { gained }.
export function turnWire(charger, i) {
  const puzzle = charger.puzzle;
  if (!puzzle || i < 0 || i >= puzzle.wires.length) return [];
  puzzle.wires[i] = rotated(puzzle.wires[i]);
  puzzle.turns++;
  const events = [{ type: 'wireTurned', index: i }];
  if (puzzle.turns % CHARGER.wireTurnsPerTurn === 0) events.push({ type: 'turnSpent' });
  if (powered(puzzle).done) {
    const gained = Math.max(ENERGY_MAX - state.run.energy, 0);
    addRounds(gained);
    charger.puzzle = null;
    events.push({ type: 'charged', gained });
  }
  return events;
}

// A way to solve `puzzle`: the wire indexes to turn, in order (an index
// once per quarter turn), or null if there is none. Walks a path from PWR,
// trying each turn of each wire it meets. For tests and the smoke test;
// the game never solves for the player.
export function solveWires({ n, from, to, wires }) {
  const set = new Map(); // wire index -> quarter turns given to it on the path
  const walk = (i, inSide) => {
    const row = Math.floor(i / n), col = i % n;
    let wire = wires[i];
    for (let quarter = 0; quarter < 4; quarter++, wire = rotated(wire)) {
      if (!(wire & inSide)) continue;
      set.set(i, quarter);
      if (i === to * n + n - 1 && (wire & E)) return true;
      for (const [side, dr, dc] of SIDES) {
        const r = row + dr, c = col + dc, j = r * n + c;
        if (side === inSide || !(wire & side) || r < 0 || r >= n || c < 0 || c >= n || set.has(j)) continue;
        if (walk(j, OPPOSITE[side])) return true;
      }
      set.delete(i);
    }
    return false;
  };
  if (!walk(from * n, W)) return null;
  return [...set].flatMap(([i, quarter]) => Array(quarter).fill(i));
}
