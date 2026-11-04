// The wire puzzle: a square of wires to turn until power runs from PWR
// (the left edge) to the CELL (the right edge). The ship's stations
// (stations.js) use it with breakers on the path, closed by right answers;
// the deprecated dungeon charger (charger.js) uses it without. There is no
// wrong move and no fail state. Split out of charger.js so the ship needs
// none of the dungeon's code (dungeon removal plan step A). No DOM access
// here.

import { CHARGER } from './config.js';

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
// `breakers` (the ship's stations, stations.js; ship plan step B): that
// many of the path's wires, spread along it, are breakers instead: set the
// right way, never spun or turned, and power stops at one until a right
// answer closes it.
// Returns { n, from, to, wires, turns: 0, breakers: [indexes], closed: [indexes] }
// (`turns` = wire turns so far).
export function makeWires(n, rand = Math.random, breakers = 0) {
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
  const inner = path.slice(1, -1).map(([r, c]) => r * n + c);
  const step = inner.length / Math.max(breakers, 1);
  const breakerAt = Array.from({ length: breakers }, (_, k) => inner[Math.floor(step * k + step / 2)]);
  const puzzle = { n, from, to, wires, turns: 0, breakers: breakerAt, closed: [] };
  do {
    puzzle.wires = puzzle.wires.map((wire, i) => {
      if (breakerAt.includes(i)) return wire;
      for (let t = pick(4); t > 0; t--) wire = rotated(wire);
      return wire;
    });
  } while (powered({ ...puzzle, breakers: [] }).done);
  return puzzle;
}

// Whether wire `i` of `puzzle` is a breaker still open (makeWires).
export function openBreaker(puzzle, i) {
  return (puzzle.breakers || []).includes(i) && !puzzle.closed.includes(i);
}

// Where the power reaches: `on` = the set of wire indexes it runs through
// from PWR, `done` = it leaves the CELL's wire through the right edge. An
// open breaker takes the power but passes none on, and `done` waits for
// every breaker to close, so wiring round one never skips its question.
export function powered(puzzle) {
  const { n, from, to, wires } = puzzle;
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
        if (!openBreaker(puzzle, j)) queue.push(j);
      }
    }
  }
  const last = to * n + n - 1;
  const allClosed = !(puzzle.breakers || []).some(i => openBreaker(puzzle, i));
  return { on, done: on.has(last) && !!(wires[last] & E) && allClosed };
}

// Turns wire `i` of `holder.puzzle` a quarter clockwise. Every
// CHARGER.wireTurnsPerTurn-th wire turn spends a turn (`turnSpent`: the
// caller runs the world's turn). Once the power reaches the cell, `finish`
// says what joined-up power does: a ship station's stationDone
// (stations.js). A
// breaker never turns: an open one asks its question instead (the caller
// opens it), a closed one does nothing.
// Events: breakerAsked { index }, or wireTurned { index }, then turnSpent,
// then `finish`'s.
export function turnWire(holder, i, finish) {
  const puzzle = holder.puzzle;
  if (!puzzle || i < 0 || i >= puzzle.wires.length) return [];
  if (openBreaker(puzzle, i)) return [{ type: 'breakerAsked', index: i }];
  if ((puzzle.breakers || []).includes(i)) return [];
  puzzle.wires[i] = rotated(puzzle.wires[i]);
  puzzle.turns++;
  const events = [{ type: 'wireTurned', index: i }];
  if (puzzle.turns % CHARGER.wireTurnsPerTurn === 0) events.push({ type: 'turnSpent' });
  if (powered(puzzle).done) events.push(...finish(holder));
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
