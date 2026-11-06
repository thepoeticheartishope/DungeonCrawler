# Furniture sprites

Draw a PNG, name it in `sprites.json`, and the game draws it instead of the code art.
A piece with no PNG (or a PNG that fails to load) keeps its code art.

## Draw one

- **Size:** 16 px wide, up to 32 px tall. The bottom 16 px stand on the floor tile;
  anything above that rises up (like a bookcase or a tall plant).
- **Wide pieces** (a table 3 tiles long): draw 4 frames side by side, 64 px wide:
  single, left, mid, right. Then add `"parts": true` (see below) and the frames join up.
  Without `parts` the one 16 px picture is used on every tile.
- **Background:** transparent. Save as PNG (not JPG).
- **Look:** low detail, a few flat colours, pixels drawn at real size (16 a tile).
  Leave things out rather than draw them small. Dark coloured outlines, not black.
  The game adds the room's light and shadow on top, so draw it as if lit evenly.
- Draw at real size in a pixel editor (Aseprite, Piskel, LibreSprite). Only art you
  drew or have the rights to.

## Add it

1. Put the PNG in this folder, e.g. `sprites/plant.png`.
2. Add a line to `sprites.json` under `"pieces"`:
   ```json
   "plant": { "src": "sprites/plant.png" },
   "counter": { "src": "sprites/counter.png", "parts": true }
   ```
   Same name as a code-art piece (desk, teacher, shelf, table, bench, easel, sink, stall,
   sofa) replaces it. A new name is a new piece.
3. Put it in a room in `rooms/ship.json`: `["plant", 26, 25]`.
4. Optional: a bump line in `js/text.js` (`'furniture.plant': '...'`). Without one the
   game says "Something stands in the way."

The game keeps a copy of each PNG once loaded, so it works offline after one visit.

## Test it

Reload in Incognito (the game may keep the old files until its cache clears).
With `?dev` on the address, the browser console says if a PNG is missing or the wrong size.
