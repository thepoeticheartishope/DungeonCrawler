# Ship rooms

`ship.json` lists the furniture in each ship room. Edit it, save, reload the game.

- Each room: `name`, its corners `r0 c0` (top left) and `r1 c1` (bottom right), and `furniture`.
- Each piece: `["piece", row, col]` or `["piece", row, col, width]` (width goes right; 1 if left out).
- Pieces: desk, teacher, shelf, table, bench, easel, sink, stall, sofa, plus any name in `sprites/sprites.json` (see `sprites/README.md`). An unknown name draws as a table.
- Rows go down, columns go right, both from 0. The room's corners show which tiles are inside.
- A piece off its room's floor (on a wall, a doorway, out of the room) or one that would block a path is left out. With `?dev` the browser console says which one.
- Walls, stations and crew stay in `js/plans.js`. If this file is missing or broken the game uses the furniture in `js/plans.js`.
- After a change the game may show the old file until the cache clears: test in Incognito.
