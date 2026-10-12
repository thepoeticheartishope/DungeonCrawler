// The player's step on the map: turning, bumping, walking, and what the
// step finds (stairs, the coin, a paper, a new room, a box). Changes state
// and returns an events list in the order things happened; main.js
// drawEvents() draws it and picks the wording. No DOM access here.

import { state, key } from './state.js';
import { reachGate } from './gate.js';
import { whatBlocks } from './passage.js';
import { computeVisibility } from './sight.js';
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

// One arrow press. A press in a new direction turns the player to face it
// (and the light cone with it), then goes on to step that way in the same
// press. With state.settings.turnBeforeStep on, it only turns: no step, no
// bump, no turn spent, so they can look behind them first. Turning first is
// off by default because combat.js senseUnseen warns ("I see you.") before
// anything unseen gets next to them. Events: turned { facing } (alone when
// turning first, else before the rest),
// blocked { kind, thing }, stepped { facing }, stairsReached { path, hidden }, coinTaken { gold },
// keyTaken { held, total, unsealed }, gateReached { questions } (bumped the
// boss; main.js opens the battle screen), blocked { kind: 'gate' } (it's sealed),
// paperRead { paper, loot, story? }, roomEntered { theme, name }, exchangeOpened
// (bumped THE UNFOLDING; main.js opens its screen), itemReached { thing }
// (bumped the chest; main.js opens the battle screen) and
// the box events from examineProp. A turn is spent only by `stepped` or `propSearched`.
export function stepPlayer(dRow, dCol) {
  const events = [];
  const facing = dRow === -1 ? 'N' : dRow === 1 ? 'S' : dCol === 1 ? 'E' : 'W';
  if (state.floor.facing !== facing) {
    state.floor.facing = facing;
    computeVisibility();
    events.push({ type: 'turned', facing });
    if (state.settings.turnBeforeStep) return events;
  }

  const newRow = state.floor.playerRow + dRow;
  const newCol = state.floor.playerCol + dCol;

  // Anything in the way stops the move, or, for a box, is examined instead.
  const block = whatBlocks(newRow, newCol);
  if (block && block.kind === 'prop') {
    events.push(...examineProp(block.thing));
    return events;
  }
  // Looking into it costs no turn: a rest floor has no light to feed.
  if (block && block.kind === 'exchange') {
    events.push({ type: 'exchangeOpened' });
    return events;
  }
  if (block && block.kind === 'boss') {
    events.push(reachGate());
    return events;
  }
  if (block && block.kind === 'chest') {
    events.push(reachItem(block));
    return events;
  }
  if (block) {
    events.push({ type: 'blocked', kind: block.kind, thing: block.thing });
    return events;
  }

  state.floor.playerRow = newRow;
  state.floor.playerCol = newCol;
  computeVisibility();
  events.push({ type: 'stepped', facing });

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
// Events: blocked, boxSprung, cellFound { prop }, relayFound { prop }, or propSearched then
// boxOpened.
function examineProp(prop) {
  if (prop.searched) return [{ type: 'blocked', kind: 'prop', thing: prop }];
  prop.identified = true;
  if (prop.kind === 'cell') return [{ type: 'cellFound', prop }];
  if (prop.kind === 'relay') return [{ type: 'relayFound', prop }];
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
