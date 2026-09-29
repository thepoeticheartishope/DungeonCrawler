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
  return state.darkness ? base * DARK_GOLD_MULTIPLIER : base;
}

// One arrow press. Facing updates (and the light cone with it) even on a
// blocked move — the player can "turn to look" a direction without
// spending a turn. Events: turned { facing }, blocked { kind, thing },
// stepped { facing }, stairsReached, coinTaken { gold },
// paperRead { paper, loot }, roomEntered { theme }, and the box events
// from examineProp. A turn is spent only by `stepped` or `propSearched`.
export function stepPlayer(dRow, dCol) {
  const events = [];
  const facing = dRow === -1 ? 'N' : dRow === 1 ? 'S' : dCol === 1 ? 'E' : 'W';
  if (state.facing !== facing) {
    state.facing = facing;
    events.push({ type: 'turned', facing });
  }
  computeVisibility();

  const newRow = state.playerRow + dRow;
  const newCol = state.playerCol + dCol;

  // Anything in the way stops the move, or, for a box, is examined instead.
  const block = whatBlocks(newRow, newCol);
  if (block && block.kind === 'prop') {
    events.push(...examineProp(block.thing));
    return events;
  }
  if (block) {
    events.push({ type: 'blocked', kind: block.kind, thing: block.thing });
    return events;
  }

  state.playerRow = newRow;
  state.playerCol = newCol;
  updateCamera();
  computeVisibility();
  events.push({ type: 'stepped', facing });

  if (state.stairs && state.playerRow === state.stairs.row && state.playerCol === state.stairs.col) {
    events.push({ type: 'stairsReached' });
    return events;
  }

  if (state.coin && state.coin.row === state.playerRow && state.coin.col === state.playerCol) {
    state.coin = null;
    const gold = goldReward(1);
    state.coinsTotal += gold;
    events.push({ type: 'coinTaken', gold });
  }
  // Stepping onto a paper reads it, as part of the step.
  const paper = state.props.find(p => p.kind === 'paper' && !p.searched &&
    p.row === state.playerRow && p.col === state.playerCol);
  if (paper) events.push(readPaper(paper));
  // First step into a room: its theme line.
  const chamber = state.chamberAt.get(key(state.playerRow, state.playerCol));
  if (chamber !== undefined && !state.visitedChambers.has(chamber)) {
    state.visitedChambers.add(chamber);
    events.push({ type: 'roomEntered', theme: state.chamberThemes[chamber] });
  }
  return events;
}

// A paper is read by stepping onto it.
function readPaper(paper) {
  paper.searched = true;
  paper.identified = true;
  return { type: 'paperRead', paper, loot: paper.loot };
}

// Bumping a box examines it. The first look takes a turn (the light
// spreads, minions move); after that there's nothing left in it, and a
// bump is just `blocked`. A trapped box works like the chest instead:
// bumping it selects it for the battle screen, with a question guarding
// its loot (settled in main.js resolveOneShot).
function examineProp(prop) {
  if (prop.searched) return [{ type: 'blocked', kind: 'prop', thing: prop }];
  prop.identified = true;
  if (prop.kind === 'box' && prop.trapped) {
    prop.sprung = true;
    state.selectedTarget = prop;
    return [{ type: 'boxSprung', prop }];
  }
  prop.searched = true;
  return [{ type: 'propSearched', prop }, { type: 'boxOpened', prop, gold: openBox(prop) }];
}

// Hands over a box's loot and returns the gold (0 for junk). Never hearts.
export function openBox(prop) {
  if (prop.loot === 'junk') return 0;
  const gold = goldReward(prop.gold || BOX_GOLD[0] + state.roomIndex);
  state.coinsTotal += gold;
  return gold;
}
