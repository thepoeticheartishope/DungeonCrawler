// Building the ship as data (buildShipFloor): its plan's layout and
// furniture, the stations, the safe room, the windows, and what the
// player sees. No page access — main.js loadRoom() calls
// it, then drawFloor() puts the result on the page.

import { state, key } from './state.js';
import { FLOOR_PLANS, buildPlanLayout } from './plans.js';
import { makePlacer, placeFurniture } from './decor.js';
import { BODY_ANGLES } from './look.js';
import { computeVisibility } from './sight.js';
import { placeShipWindows } from './windows.js';
import { placeSafeRoom, autoShutters } from './saferoom.js';
import { placeStations } from './stations.js';

// Clears everything dangerous a floor can hold, so nothing from a run
// before reaches the ship.
function clearDanger() {
  const f = state.floor;
  f.boss = null;
  f.minions = [];
  f.crawling = [];
  f.hunter = null;
  f.gunTarget = null;
  state.battle.struggle = null;
  f.struggles = 0;
  f.misses = 0;
  f.path = null;
  f.stairsAlt = null;
  f.safeRoom = null;
  f.goals = [];
  f.chest = null;
  f.lastChoiceType = null;
  f.beats = [];
  f.keys = [];
  f.vents = [];
  f.keysHeld = 0;
  f.keySpots = [];
  f.roomSpots = [];
  f.hidden = null;
  f.keyRoute = 0;
  f.gateSealed = false;
  f.windows = [];
  f.tutorial = null;
  f.testRoom = null;
  f.advanced = null;
  f.ship = false;
}

// Every doorway on a floor, as tile keys: each room's open doors and inner
// doors. Only the map uses them (an arch over each), so a way through
// reads from any side.
function doorTiles(layout) {
  return new Set(layout.chambers.flatMap(ch => [...ch.doorKeys]));
}

// The ship as data (ship plan, ideas/ship-plan.md outside the repo;
// Timothy 2026-10-30): plans.js `ship`, the School's rooms as a small
// spaceship. The player starts in Command, the center room, which is the
// safe room (automatic shutters, no switch). Only the plan's furniture and its
// stations (stations.js: consoles, boards, crew) go down:
// nothing dangerous, no papers, boxes, cells, grates, stairs or boss, as
// on a rest floor. Every floor tile is lit and seen from the start
// (state.floor.ship: sight.js computeVisibility, roomview.js lightTiles),
// so there are no dark areas. No page access.
export function buildShipFloor() {
  const plan = FLOOR_PLANS.ship;
  const f = state.floor;
  clearDanger();
  f.ship = true;
  const layout = buildPlanLayout(plan, 0);
  f.GRID_SIZE = plan.rows.length;
  f.CHAMBER_TARGET = layout.chambers.length;
  f.plan = { name: plan.name, version: layout.version };
  f.wallSet = layout.walls;
  f.PLAYER_START = { row: layout.start.row, col: layout.start.col };
  f.playerRow = f.PLAYER_START.row;
  f.playerCol = f.PLAYER_START.col;
  f.playerAt = null;
  f.lookWant = null;
  f.sneaking = false;
  f.creeping = false;
  f.facing = 'S';
  f.look = BODY_ANGLES[f.facing];

  const placer = makePlacer(layout, f.GRID_SIZE);
  f.pillarSet = new Set();
  f.chamberAt = layout.chamberAt;
  f.doorSet = doorTiles(layout);
  f.chamberNames = layout.chambers.map(ch => ch.name);
  f.props = placeFurniture(layout, placer).map(p => ({ ...p, identified: true, searched: false, sprung: false }));
  // Each role's console, board and crew member (stations.js).
  placeStations(plan.stations, placer, [f.PLAYER_START]).forEach(p => f.props.push({ ...p, identified: true, searched: false, sprung: false }));
  // Its shutters open and shut by themselves as the player comes near
  // (saferoom.js autoShutters; Timothy 2026-11-02).
  const safe = placeSafeRoom(layout);
  if (safe) {
    f.safeRoom = safe.safeRoom;
    safe.props.forEach(p => f.props.push({ ...p, identified: false, searched: false, sprung: false }));
  }
  f.stairs = null;
  f.exchange = null;
  f.exchangeBought = new Set();
  f.coin = null;

  placeShipWindows();
  autoShutters();
  f.visibleSet = new Set();
  f.exploredSet = new Set();
  computeVisibility();
  state.battle.selectedTarget = null;
  f.visitedChambers = new Set([f.chamberAt.get(key(f.playerRow, f.playerCol))]);
}
