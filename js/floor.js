// Building the ship as data (buildShipFloor): its plan's layout and
// furniture, the stations, the safe room, the windows, and the light and
// sight that follow from them. No page access — main.js loadRoom() calls
// it, then drawFloor() puts the result on the page.

import { state, key } from './state.js';
import { FLOOR_PLANS, buildPlanLayout } from './plans.js';
import { makePlacer, placeFurniture } from './decor.js';
import { ROOM_THEMES } from './config.js';
import { BODY_ANGLES } from './look.js';
import { computeVisibility } from './sight.js';
import { freshLight } from './battery.js';
import { placeShipWindows } from './windows.js';
import { placeSafeRoom, autoShutters } from './saferoom.js';
import { placeStations } from './stations.js';

// Clears everything dangerous a floor can hold, and the boss light's
// numbers, so nothing from a run before reaches the ship. The
// budget is 1, not 0: lightProgress() divides by it.
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
  f.heldChambers = new Set();
  f.relayTurnsWon = 0;
  f.safeRoom = null;
  f.goals = [];
  f.darkness = false;
  f.darkTurns = 0;
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
  f.bossLitSet = new Set();
  f.spotSet = new Set();
  f.windows = [];
  f.windowLitSet = new Set();
  f.lamps = [];
  f.lampPoolSet = new Set();
  f.tutorial = null;
  f.testRoom = null;
  f.advanced = null;
  f.ship = false;
  f.bossDist = new Map();
  f.floorCount = 0;
  f.lightTurns = 0;
  f.lightTurnBudget = 1;
  f.lightFullRadius = 0;
  f.lightSlack = 0;
  f.lightLossShare = 0;
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
  f.light = freshLight();
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

  const themeKeys = Object.keys(ROOM_THEMES);
  const placer = makePlacer(layout, f.GRID_SIZE);
  f.pillarSet = new Set();
  f.chamberAt = layout.chamberAt;
  f.doorSet = doorTiles(layout);
  f.chamberThemes = layout.chambers.map(() => themeKeys[0]);
  f.chamberNames = layout.chambers.map(ch => ch.name);
  f.props = placeFurniture(layout, placer).map(p => ({ ...p, identified: true, searched: false, sprung: false }));
  // Each role's console, board and crew member (stations.js), before the
  // safe room's switch can take a console's spot.
  placeStations(plan.stations, placer, [f.PLAYER_START]).forEach(p => f.props.push({ ...p, identified: true, searched: false, sprung: false }));
  const safe = placeSafeRoom(layout, placer, [f.PLAYER_START]);
  // No pull switch on the ship: its shutters open and shut by themselves
  // as the player comes near (saferoom.js autoShutters; Timothy 2026-11-02).
  if (safe) {
    f.safeRoom = { ...safe.safeRoom, switchAt: null };
    safe.props.filter(p => p.kind !== 'switch').forEach(p => f.props.push({ ...p, identified: false, searched: false, sprung: false }));
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
