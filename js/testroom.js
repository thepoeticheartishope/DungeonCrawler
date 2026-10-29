// DEV test rooms (Timothy 2026-10-29: "a test room for mechanics so they
// can individually tested"): one hand-drawn room per mechanic, where a
// stick man walks a set route the same every time, so one mechanic can be
// tried on its own, again and again. Only with ?dev: the start screen's
// DEV "Start in" picks one (main.js startGame) and DEV -> Restart test
// room starts it over. Not part of the game, so no wording and no tutorial
// beat. floor.js buildTestFloor() builds the room from TEST_ROOMS;
// combat.js walks the route (m.route). No DOM access here.

import { key } from './state.js';

// The rooms: '#' wall, '.' floor, 'S' where the player starts, '1' to '9'
// the stick man's route in order (it starts on '1'). Any other letter is
// furniture, `pieces` saying which (FURNITURE_PIECES in config.js): the
// same letter side by side along a row is one wide piece. `spots` makes
// every piece of a letter a live room spot of that kind (spots.js), never
// empty. `loop`: the stick man walks its route back and forth for ever;
// otherwise once the route ends it hunts the player as usual.
export const TEST_ROOMS = {
  // A stall two steps from the start; the stick man comes from the far
  // corner to the player's side, then hunts. Get in before it arrives.
  hide: {
    rows: [
      '##########',
      '#1.......#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#.....H..#',
      '#...S2...#',
      '##########',
    ],
    pieces: { H: 'stall' },
    spots: { H: 'hide' },
    loop: false,
  },
  // A bookcase with a stick man pacing the row below it. Walk round to
  // the back of it and push it over as he passes under.
  takedown: {
    rows: [
      '##########',
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
    loop: true,
  },
};

// The test room `name` as tiles: { size, walls, roomTiles (Set of keys),
// start, route, loop, props, spots }. `props` are its furniture as
// decor.js lays it down ({ kind: 'furniture', piece, part }), `spots` its
// live room spots as spots.js rollSpots gives them.
export function parseTestRoom(name) {
  const def = TEST_ROOMS[name];
  const room = { size: def.rows.length, walls: new Set(), roomTiles: new Set(), route: [], loop: def.loop, props: [], spots: [] };
  def.rows.forEach((line, row) => [...line].forEach((ch, col) => {
    if (ch === '#') { room.walls.add(key(row, col)); return; }
    room.roomTiles.add(key(row, col));
    if (ch === 'S') room.start = { row, col };
    if (ch >= '1' && ch <= '9') room.route[Number(ch) - 1] = { row, col };
  }));
  def.rows.forEach((line, row) => pieceRuns(line).forEach(({ ch, col, width }) => {
    const tiles = Array.from({ length: width }, (_, i) => ({ row, col: col + i }));
    tiles.forEach((p, i) => {
      const part = width === 1 ? 'single' : i === 0 ? 'left' : i === width - 1 ? 'right' : 'mid';
      room.props.push({ row: p.row, col: p.col, kind: 'furniture', piece: def.pieces[ch], part, identified: true, searched: false, sprung: false });
    });
    if (def.spots[ch]) room.spots.push({ row, col, kind: def.spots[ch], used: false, tiles });
  }));
  return room;
}

// The furniture along one row of a room's drawing: [{ ch, col, width }],
// one for each run of the same piece letter.
function pieceRuns(line) {
  const runs = [];
  [...line].forEach((ch, col) => {
    if (!/[A-Z]/.test(ch) || ch === 'S') return;
    const last = runs[runs.length - 1];
    if (last && last.ch === ch && last.col + last.width === col) last.width++;
    else runs.push({ ch, col, width: 1 });
  });
  return runs;
}
