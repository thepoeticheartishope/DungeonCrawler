// Room templates: the hand-drawn layouts every chamber is built from.
//
// Draw a room as rows of text, all the same length:
//   #  wall
//   .  floor
//   ?  floor that always gets something to examine (a paper or a box)
//   +  a doorway inside the room (joins two parts of it; always open)
// A '.' on the outer edge is a door out. Doors a hallway reaches stay open;
// the rest are walled up. Floor that can't be reached from the room's
// middle (like the corner outside the slanted wall below) is left as wall.
//
// Each template is also used turned (90/180/270 degrees) and mirrored, so
// one drawing gives up to eight rooms. Add a new room by adding a drawing.
// No DOM access here — dungeon.js places these on the grid.

export const ROOM_TEMPLATES = [
  [
    '###########',
    '#?.......?#',
    '#.........#',
    '#.........#',
    '####.######',
  ],
  [
    '#####.#####',
    '#.........#',
    '#.........#',
    '.....?.....',
    '#.........#',
    '#.........#',
    '#####.#####',
  ],
  [
    '######.######',
    '#....#......#',
    '#....#......#',
    '#....+......#',
    '#....#......#',
    '######.######',
  ],
  [
    '###########',
    '#.........#',
    '#..##.##..#',
    '#..#...#..#',
    '#..#####..#',
    '#.........#',
    '####.######',
  ],
  [
    '#####.#####',
    '#.........#',
    '##........#',
    '.##.......#',
    '..##......#',
    '...########',
  ],
];

const isFloorChar = (ch) => ch === '.' || ch === '?' || ch === '+';

function rotate(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const out = [];
  for (let c = 0; c < w; c++) {
    let line = '';
    for (let r = h - 1; r >= 0; r--) line += rows[r][c];
    out.push(line);
  }
  return out;
}

function mirror(rows) {
  return rows.map(line => [...line].reverse().join(''));
}

// A random template, turned and mirrored at random.
export function randomTemplate() {
  let rows = ROOM_TEMPLATES[Math.floor(Math.random() * ROOM_TEMPLATES.length)];
  const turns = Math.floor(Math.random() * 4);
  for (let i = 0; i < turns; i++) rows = rotate(rows);
  if (Math.random() < 0.5) rows = mirror(rows);
  return rows;
}

// Reads a drawing into room-local coordinates: the floor (the largest
// connected patch of it), its doors out with the tile just outside each,
// its '?' spots, and its inner '+' doorways.
export function parseTemplate(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const seen = new Set();
  let best = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!isFloorChar(rows[r][c]) || seen.has(r + ',' + c)) continue;
      const patch = [];
      const queue = [[r, c]];
      seen.add(r + ',' + c);
      while (queue.length) {
        const [cr, cc] = queue.shift();
        patch.push([cr, cc]);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
          if (!isFloorChar(rows[nr][nc]) || seen.has(nr + ',' + nc)) continue;
          seen.add(nr + ',' + nc);
          queue.push([nr, nc]);
        }
      }
      if (patch.length > best.length) best = patch;
    }
  }

  const floor = [];
  const doors = [];
  const slots = [];
  const innerDoors = [];
  for (const [r, c] of best) {
    const ch = rows[r][c];
    if (r === 0 || r === h - 1 || c === 0 || c === w - 1) {
      const exit = r === 0 ? [r - 1, c] : r === h - 1 ? [r + 1, c] : c === 0 ? [r, c - 1] : [r, c + 1];
      doors.push({ row: r, col: c, exit: { row: exit[0], col: exit[1] } });
    } else if (ch === '?') {
      slots.push({ row: r, col: c });
    } else if (ch === '+') {
      innerDoors.push({ row: r, col: c });
    }
    floor.push({ row: r, col: c });
  }
  return { h, w, floor, doors, slots, innerDoors };
}
