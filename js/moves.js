// The player's step on the map: turning, bumping, walking, and what the
// step finds (stairs, the coin, a paper, a new room, a box). Changes state
// and returns an events list in the order things happened; main.js
// drawEvents() draws it and picks the wording. No DOM access here.

import { state, key } from './state.js';
import { reachGate } from './gate.js';
import { useDesk } from './desk.js';
import { useCharger } from './charger.js';
import { pullShutter, enterSafeRoom } from './saferoom.js';
import { ventUnderfoot } from './vents.js';
import { whatBlocks, canPassCorner } from './passage.js';
import { computeVisibility, facingOf } from './sight.js';
import { followBody, waysInUse } from './look.js';
import { finishDowned } from './gun.js';
import { DARK_GOLD_MULTIPLIER, BOX_GOLD } from './config.js';

// Gold pays DARK_GOLD_MULTIPLIER times as much in the darkness after the boss.
export function goldReward(base) {
  return state.floor.darkness ? base * DARK_GOLD_MULTIPLIER : base;
}

// The stairs the player stands on (a between-rest has two: `stairs` and
// `stairsAlt`), or null. Stepping onto them only asks (stairsReached);
// main.js goes down when the player says so, so nobody leaves a floor by
// accident.
export function stairsHere() {
  const f = state.floor;
  const here = s => s && f.playerRow === s.row && f.playerCol === s.col;
  return [f.stairs, f.stairsAlt].find(here) || null;
}

// True while the player stands on stairs.
export function onStairs() {
  return !!stairsHere();
}

// Takes the key at this index of state.floor.keys (locked core plan): it
// leaves the floor and counts toward the keys held. `total` is every key
// the floor had. Event: keyTaken { held, total }.
function takeKey(index) {
  state.floor.keys.splice(index, 1);
  state.floor.keysHeld++;
  // A new key unseals the gate (gate.js), at its new, easier level.
  const unsealed = state.floor.gateSealed;
  state.floor.gateSealed = false;
  return { type: 'keyTaken', held: state.floor.keysHeld, total: state.floor.keysHeld + state.floor.keys.length, unsealed };
}

// One arrow press, (dRow, dCol) one tile on the grid: one of the 8 ways
// (eight ways plan). A press in a new direction turns the player's body to
// face it, then goes on to step that way in the same press. A diagonal that
// would cut a corner (passage.js canPassCorner) is a bump, kind 'corner',
// before anything on the tile itself counts. A turn or a
// step points the light straight ahead again (look.js followBody), even
// with free look on. It never only turns: combat.js senseUnseen warns
// ("I see you.") before anything unseen gets next to the player, which is
// what looking first was for. Events: turned { facing } (before the rest),
// blocked { kind, thing } (kind 'corner' too; with free look, then bodyTurned { facing,
// bumped: true } if the press turned the body: a spent turn), stepped { facing }, stairsReached { path, hidden }, coinTaken { gold },
// keyTaken { held, total, unsealed }, gateReached { questions } (bumped the
// boss; main.js opens the battle screen), blocked { kind: 'gate' } (it's sealed),
// paperRead { paper, loot, story? }, roomEntered { theme, name }, tutorialLeft
// (stepped into the tutorial's open door), exchangeOpened
// (bumped THE UNFOLDING; main.js opens its screen), itemReached { thing }
// (bumped the chest; main.js opens the battle screen) and
// the box events from examineProp. Walking into a downed stick man
// finishes it (gun.js finishDowned: minionFinished, minionKilled,
// goldGained). While one holds the player's ankle a step onto another tile
// is refused, heldFast { minion }, no turn spent (with free look, then
// bodyTurned { bumped: true } if the press turned the body, as a bump).
// A turn is spent only by `stepped`, `propSearched`, `bodyTurned` or `minionFinished`.
export function stepPlayer(dRow, dCol) {
  const events = [];
  const facing = facingOf(dRow, dCol);
  if (!facing || !waysInUse().includes(facing)) return events;
  const turned = state.floor.facing !== facing;
  if (turned) {
    state.floor.facing = facing;
    followBody();
    computeVisibility();
    events.push({ type: 'turned', facing });
  }

  const newRow = state.floor.playerRow + dRow;
  const newCol = state.floor.playerCol + dCol;

  // Anything in the way stops the move, or, for a box, is examined instead.
  const cornered = !canPassCorner(state.floor.playerRow, state.floor.playerCol, dRow, dCol);
  const block = cornered ? { kind: 'corner' } : whatBlocks(newRow, newCol);
  if (block) {
    events.push(...bumpInto(block));
    // With free look, turning costs a turn, so a bump that turned the body
    // isn't a free turn: it's spent like one (free look plan, call 1).
    if (turned && plainBump(block)) events.push({ type: 'bodyTurned', facing, bumped: true });
    return events;
  }
  // A downed one has the player's ankle: they can turn, shoot, wait or
  // finish it, but not walk away (downed plan, call 2).
  const holder = state.floor.minions.find(m => m.grabbing);
  if (holder) {
    events.push({ type: 'heldFast', minion: holder });
    if (turned) events.push({ type: 'bodyTurned', facing, bumped: true });
    return events;
  }

  state.floor.playerRow = newRow;
  state.floor.playerCol = newCol;
  followBody();
  events.push(...enterTile(facing));
  return events;
}

// What a bump into `block` (passage.js whatBlocks) does: a box or another
// prop is examined (examineProp), THE UNFOLDING opens (no turn: a rest
// floor has no light to feed), the gate asks, the chest is selected, a
// downed stick man is finished, and anything else just stops the player.
// Shared by the step (stepPlayer) and free walking (walk.js). Events:
// blocked { kind, thing }, exchangeOpened, gateReached / blocked gate
// (gate.js reachGate), itemReached, the box events from examineProp, and
// gun.js finishDowned's.
export function bumpInto(block) {
  if (block.kind === 'prop') return examineProp(block.thing);
  if (block.kind === 'exchange') return [{ type: 'exchangeOpened' }];
  if (block.kind === 'boss') return [reachGate()];
  if (block.kind === 'chest') return [reachItem(block)];
  if (block.kind === 'minion' && block.thing.downed) return finishDowned(block.thing);
  return [{ type: 'blocked', kind: block.kind, thing: block.thing }];
}

// Whether a bump into `block` only stops the player (a wall, a stick man
// standing, furniture), with nothing to open, ask or finish.
function plainBump(block) {
  if (['prop', 'exchange', 'boss', 'chest'].includes(block.kind)) return false;
  return !(block.kind === 'minion' && block.thing.downed);
}

// The player has just come onto the tile they now stand on
// (playerRow / playerCol, already set): the light is worked out again and
// whatever lies there counts. Shared by the step (stepPlayer) and free
// walking (walk.js, which passes `free` so the map doesn't slide the
// player a whole tile). Events: stepped { facing, free }, then
// tutorialLeft, or stairsReached { path, hidden }, or coinTaken { gold },
// keyTaken, paperRead, the vent events from ventUnderfoot, reachBroken from
// crossing into the safe room (saferoom.js enterSafeRoom) and
// roomEntered { theme, name }.
export function enterTile(facing, free = false) {
  const events = [];
  const newRow = state.floor.playerRow;
  const newCol = state.floor.playerCol;
  computeVisibility();
  events.push({ type: 'stepped', facing, free });

  // The tutorial's open door is the way out of it (tutorial.js): main.js
  // starts the run.
  const tut = state.floor.tutorial;
  if (tut && tut.stage === 'open' && tut.door.row === newRow && tut.door.col === newCol) {
    events.push({ type: 'tutorialLeft' });
    return events;
  }

  const stairs = stairsHere();
  if (stairs) {
    events.push({ type: 'stairsReached', path: stairs.path || null, hidden: !!stairs.hidden });
    return events;
  }

  if (state.floor.coin && state.floor.coin.row === state.floor.playerRow && state.floor.coin.col === state.floor.playerCol) {
    state.floor.coin = null;
    const gold = goldReward(1);
    state.run.coinsTotal += gold;
    events.push({ type: 'coinTaken', gold });
  }
  const keyHere = state.floor.keys.findIndex(p => p.row === state.floor.playerRow && p.col === state.floor.playerCol);
  if (keyHere !== -1) events.push(takeKey(keyHere));
  // Stepping onto a paper reads it, as part of the step.
  const paper = state.floor.props.find(p => p.kind === 'paper' && !p.searched &&
    p.row === state.floor.playerRow && p.col === state.floor.playerCol);
  if (paper) events.push(readPaper(paper));
  events.push(...ventUnderfoot());
  events.push(...enterSafeRoom());
  // First step into a room: its name on a fixed plan, else its theme line.
  const chamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  if (chamber !== undefined && !state.floor.visitedChambers.has(chamber)) {
    state.floor.visitedChambers.add(chamber);
    events.push({ type: 'roomEntered', theme: state.floor.chamberThemes[chamber], name: state.floor.chamberNames[chamber] || null });
  }
  return events;
}

// A paper is read by stepping onto it. While the run's story has lines
// left, every paper gives the next one, whatever it rolled: that way the
// story arrives in order wherever the papers lie, and doesn't hang on the
// lore roll. Once it's told, a paper gives its own roll (a theme line or
// nothing), as before.
function readPaper(paper) {
  paper.searched = true;
  paper.identified = true;
  const story = state.run.loreQueue.shift();
  if (story) return { type: 'paperRead', paper, loot: 'story', story };
  return { type: 'paperRead', paper, loot: paper.loot };
}

// Bumping the chest selects it for the battle screen.
// Standing next to one doesn't (combat.js findAdjacentEnemies), so the
// player chooses when to take it on. No turn is spent: the answer is the
// turn. Event: itemReached { thing }.
function reachItem(block) {
  const thing = state.floor.chest;
  state.battle.selectedTarget = thing;
  return { type: 'itemReached', thing };
}

// Bumping a box examines it. The first look takes a turn (the light
// spreads, minions move); after that there's nothing left in it, and a
// bump is just `blocked`. A trapped box works like the chest instead:
// bumping it selects it for the battle screen, with a question guarding
// its loot (settled in answers.js settleAnswer). Bumping an energy cell
// takes no turn here: main.js opens the reload panel for it, and the
// answer is the turn (gun.js settleReload uses the cell up). A relay is
// the same: main.js asks its question, relays.js settleRelay settles it.
// The tutorial's barrel asks the player's name instead (tutorial.js; main.js
// opens the ask screen, settleName settles it). The reflective desk heals
// (desk.js useDesk), no turn spent. The safe room's switch, or a shutter
// that is down, drops or lifts its shutters (saferoom.js pullShutter), no
// turn spent either.
// Events: blocked, boxSprung, cellFound { prop }, relayFound { prop }, nameAsked { prop },
// deskUntouched, deskHealed { healed }, shutterDown, shutterUp, shutterBlocked,
// or propSearched then boxOpened.
function examineProp(prop) {
  if (prop.searched) return [{ type: 'blocked', kind: 'prop', thing: prop }];
  prop.identified = true;
  if (prop.asks === 'name') return [{ type: 'nameAsked', prop }];
  if (prop.kind === 'cell') return [{ type: 'cellFound', prop }];
  if (prop.kind === 'relay') return [{ type: 'relayFound', prop }];
  if (prop.kind === 'desk') return useDesk(prop);
  if (prop.kind === 'charger') return useCharger(prop);
  if (prop.kind === 'switch' || prop.kind === 'shutter') return pullShutter();
  if (prop.kind === 'box' && prop.trapped) {
    prop.sprung = true;
    state.battle.selectedTarget = prop;
    return [{ type: 'boxSprung', prop }];
  }
  prop.searched = true;
  return [{ type: 'propSearched', prop }, { type: 'boxOpened', prop, gold: openBox(prop) }];
}

// Hands over a box's loot and returns the gold (0 for junk). Never hearts.
export function openBox(prop) {
  if (prop.loot === 'junk') return 0;
  const gold = goldReward(prop.gold || BOX_GOLD[0] + state.run.roomIndex);
  state.run.coinsTotal += gold;
  return gold;
}
