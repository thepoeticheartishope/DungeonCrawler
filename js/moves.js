// The player's step on the map: turning, bumping, walking, and what the
// step finds (stairs, the coin, a paper, a new room, a box). Changes state
// and returns an events list in the order things happened; main.js
// drawEvents() draws it and picks the wording. No DOM access here.

import { state, key } from './state.js';
import { whatBlocks } from './passage.js';
import { computeVisibility, updateCamera } from './sight.js';
import { DARK_GOLD_MULTIPLIER, BOX_GOLD } from './config.js';

// Gold pays DARK_GOLD_MULTIPLIER times as much in the darkness after the boss.
export function goldReward(base) {
  return state.floor.darkness ? base * DARK_GOLD_MULTIPLIER : base;
}

// One arrow press. Facing updates (and the light cone with it) even on a
// blocked move — the player can "turn to look" a direction without
// spending a turn. Events: turned { facing }, blocked { kind, thing },
// stepped { facing }, stairsReached, coinTaken { gold },
// paperRead { paper, loot, story? }, roomEntered { theme }, exchangeOpened
// (bumped THE UNFOLDING; main.js opens its screen) and the box events from
// examineProp. A turn is spent only by `stepped` or `propSearched`.
export function stepPlayer(dRow, dCol) {
  const events = [];
  const facing = dRow === -1 ? 'N' : dRow === 1 ? 'S' : dCol === 1 ? 'E' : 'W';
  if (state.floor.facing !== facing) {
    state.floor.facing = facing;
    events.push({ type: 'turned', facing });
  }
  computeVisibility();

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
  if (block) {
    events.push({ type: 'blocked', kind: block.kind, thing: block.thing });
    return events;
  }

  state.floor.playerRow = newRow;
  state.floor.playerCol = newCol;
  updateCamera();
  computeVisibility();
  events.push({ type: 'stepped', facing });

  if (state.floor.stairs && state.floor.playerRow === state.floor.stairs.row && state.floor.playerCol === state.floor.stairs.col) {
    events.push({ type: 'stairsReached' });
    return events;
  }

  if (state.floor.coin && state.floor.coin.row === state.floor.playerRow && state.floor.coin.col === state.floor.playerCol) {
    state.floor.coin = null;
    const gold = goldReward(1);
    state.run.coinsTotal += gold;
    events.push({ type: 'coinTaken', gold });
  }
  // Stepping onto a paper reads it, as part of the step.
  const paper = state.floor.props.find(p => p.kind === 'paper' && !p.searched &&
    p.row === state.floor.playerRow && p.col === state.floor.playerCol);
  if (paper) events.push(readPaper(paper));
  // First step into a room: its theme line.
  const chamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  if (chamber !== undefined && !state.floor.visitedChambers.has(chamber)) {
    state.floor.visitedChambers.add(chamber);
    events.push({ type: 'roomEntered', theme: state.floor.chamberThemes[chamber] });
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

// Bumping a box examines it. The first look takes a turn (the light
// spreads, minions move); after that there's nothing left in it, and a
// bump is just `blocked`. A trapped box works like the chest instead:
// bumping it selects it for the battle screen, with a question guarding
// its loot (settled in answers.js settleAnswer).
function examineProp(prop) {
  if (prop.searched) return [{ type: 'blocked', kind: 'prop', thing: prop }];
  prop.identified = true;
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
