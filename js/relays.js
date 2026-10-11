// Relays (strategy plan step B): dead machines in a floor's rooms. Answer
// the question at one and its room is held: the boss light never lights it
// again this floor, minions outside it can't come in, and the light loses
// a few turns. A wrong answer gives the light turns instead. Each relay
// works once, and the turns a floor can win back are capped, so relays slow
// the light without stopping it. floor.js buildFloor() calls placeRelays();
// main.js opens the question when one is bumped (moves.js relayFound) and
// settles it with settleRelay(). No DOM access here.

import { state, key } from './state.js';
import { RELAYS_PER_FLOOR, RELAY_TURNS_BACK, RELAY_TURNS_CAP, RELAY_WRONG_TURNS } from './config.js';
import { shuffle } from './quiz.js';
import { updateBossLit } from './light.js';
import { recordHauntAnswer } from './haunts.js';

// The floor's relays, one each in RELAYS_PER_FLOOR [min, max] rooms, never
// in the boss's room or the room the player starts in (holding those would
// mean nothing, or cost nothing). Solid, on the furniture's rules, never
// on a `taken` tile. Returns [{ row, col, kind: 'relay' }].
export function placeRelays(layout, placer, taken) {
  const startKey = key(layout.start.row, layout.start.col);
  const rooms = layout.chambers.filter(ch => !ch.isBoss && !ch.floorCells.some(p => key(p.row, p.col) === startKey));
  const [min, max] = RELAYS_PER_FLOOR;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const free = (cells) => cells.filter(p => !taken.some(q => q.row === p.row && q.col === p.col));
  const relays = [];
  for (const room of shuffle(rooms)) {
    if (relays.length >= count) break;
    const spot = placer.pick(free(room.floorCells), true);
    if (spot) relays.push({ ...spot, kind: 'relay' });
  }
  return relays;
}

// The held room's tiles a minion can't step onto: every held room it isn't
// standing in. One already inside when the room is held may stay, but
// once it leaves it can't come back.
export function keptOut(minion) {
  const f = state.floor;
  const out = new Set();
  if (!f.heldChambers.size) return out;
  const inside = f.chamberAt.get(key(minion.row, minion.col));
  f.chamberAt.forEach((room, k) => { if (f.heldChambers.has(room) && room !== inside) out.add(k); });
  return out;
}

// The answer at a relay. Right: its room is held and the light loses
// RELAY_TURNS_BACK turns (less once the floor has won RELAY_TURNS_CAP).
// Wrong: the light gains RELAY_WRONG_TURNS. With the boss already down the
// light is out, so only the room changes. The relay is used up either way.
// Events: relayHeld { turns } or relaySparked { turns, expected, source },
// then hauntSilenced / hauntLingers.
export function settleRelay(isCorrect, relay) {
  const f = state.floor;
  const q = state.battle.currentQuestion;
  relay.searched = true;
  const events = [];
  if (isCorrect) {
    state.run.correctTotal++;
    f.heldChambers.add(f.chamberAt.get(key(relay.row, relay.col)));
    const turns = f.boss ? Math.min(RELAY_TURNS_BACK, RELAY_TURNS_CAP - f.relayTurnsWon, f.lightTurns) : 0;
    f.relayTurnsWon += turns;
    f.lightTurns -= turns;
    events.push({ type: 'relayHeld', turns });
  } else {
    f.misses++;
    const turns = f.boss ? RELAY_WRONG_TURNS : 0;
    f.lightTurns += turns;
    events.push({ type: 'relaySparked', turns, expected: q.meaning, source: q.source });
  }
  updateBossLit();
  const haunt = recordHauntAnswer(q, isCorrect);
  if (haunt === 'silenced') events.push({ type: 'hauntSilenced' });
  else if (haunt === 'lingers') events.push({ type: 'hauntLingers' });
  return events;
}
