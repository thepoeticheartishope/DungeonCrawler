// The advanced tutorial (tutorial split plan, ideas/tutorial-split-plan.md
// outside the repo; Timothy 2026-10-29: "one room is like the normal start
// ... Then the second room that is optional is how each mechanic works").
// Optional: the simple tutorial's key opens two doors, and the right-hand
// one (tutorial.js) leads here. It is a chain of small hand-drawn
// stations, one mechanic each (ADVANCED_STATIONS); each has a door at the
// top that opens once its mechanic is done, into the next station, and
// the last one's into the run. A mechanic Timothy tags as one the player
// needs gets a station here: a new entry in ADVANCED_STATIONS.
// floor.js buildAdvancedFloor() builds a station; main.js calls
// advancedTurn() after each spent turn. Lines are whispered { line, tone }
// events, as in the tutorial. No DOM access here.

import { state, key } from './state.js';
import { ADVANCED_COVER_STEPS, ENERGY_MAX, LIGHT_BATTERY_MAX, MINION_LIGHT_SIGHT, TUTORIAL_MINION_KIND } from './config.js';
import { computeVisibility, clearLine, hiddenFrom } from './sight.js';
import { spawnMinion } from './combat.js';
import { crawlInto } from './vents.js';
import { addRounds } from './gun.js';
import { drawnFurniture } from './spots.js';

// The stations, in the order they are played. Each room: '#' wall, '.'
// floor, 'S' where the player comes in, 'D' its door (in the top wall),
// 'g' a grate with no pair, '1' to '9' a stick man's route in order, and
// furniture letters (`pieces`, spots.js drawnFurniture) whose `spots` are
// live from the start. `begin(station)` sets the station going;
// `turn(station, events)` moves it on after a spent turn and returns its
// events; both set `station.done` once the mechanic is done, which opens
// the door. `hint` is the stuck hint (main.js) while it isn't done.
// `oneStick`: only played with One stick (crouching is One stick's);
// with Turns it is skipped (nextStation). `intro`, if any, is the kind
// voice's line as it starts (main.js showStationName).
export const ADVANCED_STATIONS = [
  // Hiding: the book is empty and a stick man comes out of the grate for
  // the player. Into the stall; it loses them and goes off to pace the
  // bottom-left corner, out of the way to the door, and the door opens.
  {
    name: 'hide',
    rows: [
      '####D#####',
      '#g.......#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#1.......#',
      '#......H.#',
      '#2..S....#',
      '##########',
    ],
    pieces: { H: 'stall' },
    spots: { H: 'hide' },
    hint: 'tut.hint.hide',
    begin(station) {
      emptyBook();
      station.minion = sendFromGrate();
    },
    turn(station, events) {
      const f = state.floor;
      const m = station.minion;
      const out = [];
      if (!station.told.drop && events.some(e => e.type === 'ventDropped' && e.minion === m)) {
        station.told.drop = true;
        out.push({ type: 'whispered', line: 'tut.hide', tone: 'kind' });
      }
      if (f.hidden && !station.done) {
        // It loses them and goes off to pace its corner (combat.js
        // routeStep): it never comes for them again here.
        m.hunts = false;
        m.lastSeen = null;
        m.track = 0;
        m.route = { points: station.route, at: 0, loop: true };
        station.done = true;
        out.push({ type: 'whispered', line: 'adv.hide.done', tone: 'kind' });
      }
      return out;
    },
  },
  // Takedowns: the book is empty and a stick man paces the row in front
  // of a bookcase. From behind it, a push as he passes under it brings it
  // down on him: "Now. Push." Pushed onto nothing: "Too soon. The book,
  // then.", and the book fills again, so the station can't stick.
  {
    name: 'takedown',
    rows: [
      '####D#####',
      '#........#',
      '#..BBB...#',
      '#.1....2.#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#...S....#',
      '##########',
    ],
    pieces: { B: 'shelf' },
    spots: { B: 'takedown' },
    hint: 'tut.hint.push',
    begin(station) {
      emptyBook();
      const m = spawnMinion(station.route[0], TUTORIAL_MINION_KIND);
      m.guard = false;
      m.route = { points: station.route, at: 0, loop: true };
      station.minion = m;
    },
    turn(station, events) {
      const f = state.floor;
      const m = station.minion;
      if (!f.minions.includes(m)) {
        station.done = true;
        return [];
      }
      const shelf = f.roomSpots.find(s => s.kind === 'takedown');
      const out = [];
      if (shelf.used) {
        if (state.run.energy < ENERGY_MAX) addRounds(ENERGY_MAX - state.run.energy);
        if (!station.told.missed) {
          station.told.missed = true;
          out.push({ type: 'whispered', line: 'tut.missed', tone: 'kind' });
        }
        return out;
      }
      const across = p => shelf.tiles.some(t => t.col === p.col);
      const behind = f.playerRow === shelf.row - 1 && across({ col: f.playerCol });
      const under = m.row === shelf.row + 1 && across(m);
      if (!station.told.push && behind && under) {
        station.told.push = true;
        out.push({ type: 'whispered', line: 'tut.push', tone: 'kind' });
      }
      return out;
    },
  },
  // Lures: a sink in a nook beside a bookcase, the row behind it walled
  // off, and the book empty. Light out, the tap on: the stick man pacing
  // below comes to the sink, and the only way in is under the bookcase.
  // Pushed onto him, the door opens. If he sees the light instead of
  // hearing the tap, the sink can be used again; a push on nothing gives
  // the book back, as in the takedown station.
  {
    name: 'lure',
    rows: [
      '######D###',
      '#S.......#',
      '#.BBB#####',
      '#W.......#',
      '###......#',
      '#........#',
      '#...2..1.#',
      '#........#',
      '#........#',
      '##########',
    ],
    pieces: { B: 'shelf', W: 'sink' },
    spots: { B: 'takedown', W: 'lure' },
    hint: 'tut.hint.lure',
    begin(station) {
      emptyBook();
      const m = spawnMinion(station.route[0], TUTORIAL_MINION_KIND);
      m.guard = false;
      m.route = { points: station.route, at: 0, loop: true };
      station.minion = m;
    },
    turn(station, events) {
      const f = state.floor;
      const m = station.minion;
      if (!f.minions.includes(m)) {
        station.done = true;
        return [];
      }
      const out = [];
      if (events.some(e => e.type === 'lureSounded')) {
        const heard = events.some(e => e.type === 'noiseHeard' && e.minion === m);
        if (!heard) f.roomSpots.find(s => s.kind === 'lure').used = false;
        out.push({ type: 'whispered', line: heard ? 'adv.lure.heard' : 'adv.lure.light', tone: 'kind' });
      }
      const shelf = f.roomSpots.find(s => s.kind === 'takedown');
      if (shelf.used) {
        if (state.run.energy < ENERGY_MAX) addRounds(ENERGY_MAX - state.run.energy);
        if (!station.told.missed) {
          station.told.missed = true;
          out.push({ type: 'whispered', line: 'tut.missed', tone: 'kind' });
        }
      }
      return out;
    },
  },
  // Sneaking (One stick only): a stick man paces past a long table, the
  // player's light held on. They start crouched behind it (`intro` says
  // so): crouched there (cover, sight.js hiddenFrom), he walks past
  // without noticing them; standing (X, or a full push) shows them. ADVANCED_COVER_STEPS
  // of his steps like that, in his sight but unseen, open the door. If he
  // notices them his route ends and he hunts them (combat.js `untilSeen`)
  // until he loses them, then paces again.
  {
    name: 'sneak',
    oneStick: true,
    intro: 'adv.sneak.intro',
    rows: [
      '####D#####',
      '#........#',
      '#........#',
      '#........#',
      '#1......2#',
      '#........#',
      '#.TTTT...#',
      '#...S....#',
      '#........#',
      '##########',
    ],
    pieces: { T: 'table' },
    spots: {},
    hint: 'tut.hint.sneak',
    begin(station) {
      state.floor.light = { on: true, charge: LIGHT_BATTERY_MAX, locked: false, steady: true };
      state.floor.sneaking = true;
      const m = spawnMinion(station.route[0], TUTORIAL_MINION_KIND);
      m.guard = false;
      m.route = { points: station.route, at: 0, loop: true, untilSeen: true };
      station.minion = m;
      station.unseen = 0;
    },
    turn(station, events) {
      const f = state.floor;
      const m = station.minion;
      const out = [];
      if (!f.minions.includes(m)) return out;
      if (!m.route) {
        // He saw them: he hunts until he has lost them, then paces again.
        if (!station.told.seen) {
          station.told.seen = true;
          out.push({ type: 'whispered', line: 'adv.sneak.seen', tone: 'kind' });
        }
        if (m.track === 0 && !m.lastSeen) {
          m.route = { points: station.route, at: 0, loop: true, untilSeen: true };
          station.told.seen = false;
        }
        station.unseen = 0;
        return out;
      }
      const moved = events.some(e => e.type === 'minionMoved' && e.minion === m);
      const inSight = Math.hypot(m.row - f.playerRow, m.col - f.playerCol) <= MINION_LIGHT_SIGHT &&
        clearLine(m.row, m.col, f.playerRow, f.playerCol);
      if (moved && inSight && hiddenFrom(m.row, m.col)) station.unseen++;
      if (station.unseen < ADVANCED_COVER_STEPS) return out;
      // Done: from now on he only paces, whatever he sees.
      m.route.untilSeen = false;
      station.done = true;
      out.push({ type: 'whispered', line: 'adv.sneak.done', tone: 'kind' });
      return out;
    },
  },
];

// Station `index` as tiles: { size, walls, roomTiles (Set of keys), start,
// door, grate, route, props, spots } (positions { row, col }; props its
// furniture and spots its live room spots, spots.js drawnFurniture). The
// door is floor, not wall: passage.js whatBlocks shuts it until it opens.
export function parseStation(index) {
  const def = ADVANCED_STATIONS[index];
  const room = { size: def.rows.length, walls: new Set(), roomTiles: new Set(), route: [], grate: null };
  def.rows.forEach((line, row) => [...line].forEach((ch, col) => {
    const at = { row, col };
    if (ch === '#') { room.walls.add(key(row, col)); return; }
    if (ch === 'D') { room.door = at; return; }
    room.roomTiles.add(key(row, col));
    if (ch === 'S') room.start = at;
    if (ch === 'g') room.grate = at;
    if (ch >= '1' && ch <= '9') room.route[Number(ch) - 1] = at;
  }));
  return { ...room, ...drawnFurniture(def.rows, def.pieces, def.spots) };
}

// A fresh station's own state, for state.floor.advanced: which one, its
// door and route, its stick man once begun, the lines it has said, and
// whether its mechanic is done.
export function freshStation(index, room) {
  return { index, name: ADVANCED_STATIONS[index].name, door: room.door, route: room.route, minion: null, told: {}, done: false, open: false };
}

// Sets the station on this floor going (floor.js buildAdvancedFloor, once
// the room is down).
export function beginStation() {
  const station = state.floor.advanced;
  ADVANCED_STATIONS[station.index].begin(station);
  computeVisibility();
}

// Moves the station on after a spent turn (`events` are the turn's).
// Returns its events, then doorUnlocked { advanced: true } the turn its
// mechanic is done. None off the advanced tutorial.
export function advancedTurn(events) {
  const station = state.floor.advanced;
  if (!station || station.open) return [];
  const out = ADVANCED_STATIONS[station.index].turn(station, events);
  if (!station.done) return out;
  station.open = true;
  return [...out, { type: 'doorUnlocked', advanced: true }];
}

// The station played after `index` (-1 for the start: the first), the
// One stick ones skipped with Turns; -1 when there is none and the door
// leads into the run.
export function nextStation(index) {
  for (let i = index + 1; i < ADVANCED_STATIONS.length; i++) {
    if (!ADVANCED_STATIONS[i].oneStick || state.settings.oneStick) return i;
  }
  return -1;
}

// The book is emptied: in these stations the mechanic is the way, not
// the book.
function emptyBook() {
  state.run.energy = 0;
  state.run.rounds = [];
}

// A slow stick man in the station's grate's duct (vents.js crawlInto,
// quietly), hunting: next turn the grate shudders, the turn after it
// climbs out. No guard, as the tutorial's. Returns it.
function sendFromGrate() {
  const f = state.floor;
  const grate = f.vents[0];
  const m = spawnMinion({ row: grate.row, col: grate.col }, TUTORIAL_MINION_KIND);
  m.guard = false;
  m.hunts = true;
  crawlInto(m, 0);
  f.minions.splice(f.minions.indexOf(m), 1);
  f.crawling.push(m);
  return m;
}
