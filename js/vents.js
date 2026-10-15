// Grates and the ducts between them (vents and noise plan,
// `ideas/vents-noise-plan.md` outside the repo; Timothy 2026-10-15, after
// Dead Space). Each floor gets up to VENT_PAIRS pairs of grates, each pair
// joining two rooms far apart on foot. The ducts belong to the stick men:
// the player walks over a grate but can't go in. floor.js buildFloor()
// calls placeVents(); moves.js stepPlayer() calls ventUnderfoot(); noise.js
// sends sound through open ducts. Step C: hunting stick men that fit crawl
// through them (combat.js advanceMonsters calls ductStep, crawlInto and
// crawlTurn). No DOM access here.

import { state, key } from './state.js';
import { VENT_PAIRS, VENT_MIN_APART, VENT_TURNS, VENT_RATTLE_HEARD, MINION_KINDS } from './config.js';
import { shuffle } from './quiz.js';
import { neighbors, blockedTilesFor, tileOccupied } from './combat.js';
import { keptOut } from './relays.js';

const STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

// The floor's grates: one spot in each room that may have one (never the
// start room, so the desk's room stays safe, nor the core), then rooms
// paired up whose spots are at least VENT_MIN_APART walking steps apart.
// A spot is room floor the placer would keep furniture off (no doorway,
// not beside one, not where the player starts), with nothing on it and
// not on a `taken` tile. Grates aren't solid, so the floor stays whole
// whatever is chosen. Fewer pairs when the floor can't fit them.
// Returns [{ row, col, pair, known: false }] (`pair` = the index of the
// other end in the list).
export function placeVents(layout, placer, taken, props) {
  const startKey = key(layout.start.row, layout.start.col);
  const used = new Set([...taken, ...props].map(p => key(p.row, p.col)));
  const free = p => {
    const k = key(p.row, p.col);
    return layout.roomTiles.has(k) && !used.has(k) && !placer.blocked.has(k) && !placer.reserved.has(k);
  };
  const spots = shuffle(layout.chambers.filter(ch => !ch.isBoss && !ch.floorCells.some(p => key(p.row, p.col) === startKey)))
    .map(ch => shuffle(ch.floorCells.filter(free))[0])
    .filter(Boolean);

  const vents = [];
  const paired = new Set();
  for (let i = 0; i < spots.length && vents.length < VENT_PAIRS * 2; i++) {
    if (paired.has(i)) continue;
    const dist = walkingSteps(spots[i], layout.walls);
    const j = spots.findIndex((p, n) => n > i && !paired.has(n) && dist.get(key(p.row, p.col)) >= VENT_MIN_APART);
    if (j === -1) continue;
    paired.add(i);
    paired.add(j);
    const at = vents.length;
    vents.push({ row: spots[i].row, col: spots[i].col, pair: at + 1, known: false });
    vents.push({ row: spots[j].row, col: spots[j].col, pair: at, known: false });
  }
  return vents;
}

// Walking steps from `from` to every floor tile, 8 ways, never cutting a
// wall's corner (the way stick men walk). A Map of tile key -> steps.
function walkingSteps(from, walls) {
  const dist = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of STEPS) {
      const row = cur.row + dr, col = cur.col + dc, k = key(row, col);
      if (dist.has(k) || walls.has(k)) continue;
      if (dr && dc && (walls.has(key(cur.row + dr, cur.col)) || walls.has(key(cur.row, cur.col + dc)))) continue;
      dist.set(k, d + 1);
      queue.push({ row, col });
    }
  }
  return dist;
}

// The grate at a tile, or null.
export function ventAt(row, col) {
  return state.floor.vents.find(v => v.row === row && v.col === col) || null;
}

// The index in state.floor.vents of the grate at a tile, or -1.
export function ventIndexAt(row, col) {
  return state.floor.vents.findIndex(v => v.row === row && v.col === col);
}

// A grate in a room held by a relay is sealed: nothing gets through it,
// sound or stick man, either way.
export function ventSealed(v) {
  const f = state.floor;
  return f.heldChambers.has(f.chamberAt.get(key(v.row, v.col)));
}

// Whether the duct behind grate `i` is open: neither end is sealed.
export function ductOpen(i) {
  const vents = state.floor.vents;
  return !ventSealed(vents[i]) && !ventSealed(vents[vents[i].pair]);
}

// Stepping onto a grate says so, as part of the step: the player can't go
// in (the vents are theirs), but should notice the way they come.
// Returns [ventStepped] or [].
export function ventUnderfoot() {
  return ventAt(state.floor.playerRow, state.floor.playerCol) ? [{ type: 'ventStepped' }] : [];
}

// Whether a stick man can crawl through the ducts: SHARDs and STALKERs
// (MINION_KINDS `vents`) and the hunter (Timothy); HUSKs are too big.
// Never with DEV -> Noise off: then grates are just floor.
export function fitsVents(m) {
  if (!state.settings.noise) return false;
  return m.kind === 'hunter' || !!(MINION_KINDS[m.minionKind] && MINION_KINDS[m.minionKind].vents);
}

// The cheapest way for `m` to `target` with the ducts: a step costs 1,
// and an open duct from a grate to its pair VENT_TURNS (one more than the
// turns it really takes, so a walk that ties always wins). Other stick
// men, walls and furniture block it as on foot (combat.js
// blockedTilesFor); the target itself never does. Returns the tiles from
// where it stands to the target, or null if it can't get there.
function ductRoute(m, target) {
  const f = state.floor;
  const blocked = blockedTilesFor(m);
  const start = key(m.row, m.col);
  const goal = key(target.row, target.col);
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const tiles = new Map([[start, { row: m.row, col: m.col }]]);
  const buckets = [[start]];
  const relax = (row, col, d, from) => {
    const k = key(row, col);
    if (dist.has(k) && dist.get(k) <= d) return;
    dist.set(k, d);
    prev.set(k, from);
    tiles.set(k, { row, col });
    (buckets[d] = buckets[d] || []).push(k);
  };
  for (let d = 0; d < buckets.length && !dist.has(goal); d++) {
    for (const ck of buckets[d] || []) {
      if (dist.get(ck) !== d) continue;
      const cur = tiles.get(ck);
      neighbors(cur.row, cur.col).forEach(([row, col]) => {
        if (key(row, col) !== goal && blocked.has(key(row, col))) return;
        relax(row, col, d + 1, ck);
      });
      const v = ventIndexAt(cur.row, cur.col);
      if (v === -1 || !ductOpen(v)) continue;
      const far = f.vents[f.vents[v].pair];
      relax(far.row, far.col, d + VENT_TURNS, ck);
    }
  }
  if (!dist.has(goal)) return null;
  const path = [];
  for (let k = goal; k !== undefined; k = prev.get(k)) path.unshift(tiles.get(k));
  return path;
}

// What a hunting stick man that fits does about the ducts on its way to
// `target` (the player it chases, or the spot it last knew them at): null
// when walking is as quick (it walks as before); { enter } (a grate's
// index) to go in now, from the grate it stands on or the one it steps
// onto; or { step } (a tile) on the way to a grate.
export function ductStep(m, target) {
  if (!state.floor.vents.length || !fitsVents(m)) return null;
  const path = ductRoute(m, target);
  if (!path) return null;
  const vents = state.floor.vents;
  const hop = path.findIndex((tile, i) => {
    const v = ventIndexAt(tile.row, tile.col);
    const next = path[i + 1];
    return v !== -1 && !!next && vents[vents[v].pair].row === next.row && vents[vents[v].pair].col === next.col;
  });
  if (hop === -1) return null;
  if (hop <= 1) return { enter: ventIndexAt(path[hop].row, path[hop].col) };
  return { step: path[1] };
}

// `m` goes into grate `i` (stepping onto it first if it stands beside
// it): it is in the duct for VENT_TURNS turns, out of play. combat.js
// takes it off the floor's minions once every one has moved (crawlTurn
// brings it back). It stops being a target.
// Event: ventEntered { minion, from, vent } (always in the room log, seen
// or not: Timothy, it builds dread).
export function crawlInto(m, i) {
  const f = state.floor;
  const grate = f.vents[i];
  const from = { row: m.row, col: m.col };
  m.row = grate.row;
  m.col = grate.col;
  m.vent = { from: i, to: grate.pair, left: VENT_TURNS };
  m.goal = null;
  m.linger = 0;
  m.trail = [];
  if (f.gunTarget === m) f.gunTarget = null;
  if (state.battle.selectedTarget === m) state.battle.selectedTarget = null;
  return [{ type: 'ventEntered', minion: m, from, vent: grate }];
}

// One turn for every stick man in a duct, before the others move. On its
// first turn in, the far grate shudders; on the next it climbs out onto a
// free tile beside that grate, the one nearest where it is going (where
// it last knew the player was, else the player). If that end has been
// sealed meanwhile (its room held), it comes back out the way it went in.
// With no free tile it waits a turn. Seen coming out, the pair is known.
// Events: ventRattled { vent, heard } (`heard`: in sight or within
// VENT_RATTLE_HEARD tiles), ventDropped { minion, vent, seen }.
export function crawlTurn() {
  const f = state.floor;
  const events = [];
  f.crawling.slice().forEach(m => {
    m.vent.left--;
    const exit = f.vents[ductOpen(m.vent.from) ? m.vent.to : m.vent.from];
    if (m.vent.left === 1) {
      events.push({ type: 'ventRattled', vent: exit, heard: playerHears(exit) });
      return;
    }
    if (m.vent.left > 0) return;
    const aim = m.lastSeen || { row: f.playerRow, col: f.playerCol };
    const out = keptOut(m);
    const spots = neighbors(exit.row, exit.col)
      .filter(([row, col]) => !f.wallSet.has(key(row, col)) && !out.has(key(row, col)) && !tileOccupied(row, col, m))
      .sort((a, b) => Math.hypot(a[0] - aim.row, a[1] - aim.col) - Math.hypot(b[0] - aim.row, b[1] - aim.col));
    if (!spots.length) {
      m.vent.left = 1;
      return;
    }
    const seen = f.visibleSet.has(key(exit.row, exit.col));
    if (seen) {
      exit.known = true;
      f.vents[exit.pair].known = true;
    }
    [m.row, m.col] = spots[0];
    delete m.vent;
    f.crawling.splice(f.crawling.indexOf(m), 1);
    f.minions.push(m);
    events.push({ type: 'ventDropped', minion: m, vent: exit, seen });
  });
  return events;
}

// Whether the player hears a grate shudder: it is in their light, or near.
function playerHears(v) {
  const f = state.floor;
  return f.visibleSet.has(key(v.row, v.col)) || Math.hypot(v.row - f.playerRow, v.col - f.playerCol) <= VENT_RATTLE_HEARD;
}
