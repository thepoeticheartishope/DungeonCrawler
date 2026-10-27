// The light tube (record book plan): the light's battery drawn as a
// fluorescent tube, glass with one cell a charge, a coil inside and a cap
// at its foot, at the room's own chunky pixel size. bookview.js stands it
// up on the book's left edge; render.js lays it on its side on the HUD
// (record book plan step E), in place of LIGHT #### ON. The shapes follow the Pocket Inventory pack's
// tube, drawn in code: the pack's own files may not be shared, so none of
// them are in the game.

// The tube's size in art pixels, standing up. The canvas it is drawn on is
// this size (on its side, TUBE_H wide and TUBE_W tall) and scaled up by
// CSS (image-rendering: pixelated).
export const TUBE_W = 22;
export const TUBE_H = 106;

// Each cell is CELL art pixels tall, one a charge.
const CELL = 22;
const GLASS_TOP = 6;
const GLASS_BOTTOM = GLASS_TOP + CELL * 4;
// The two rods inside the glass, [left x, width].
const RODS = [[3, 6], [13, 6]];

const COLORS = {
  glass: '#3F5257',
  empty: '#151E21',
  stored: '#5F7896',  // charge held with the light off: dim, no glow
  lit: '#DCE9FF',     // the light on
  coilDark: 'rgba(30,44,54,0.9)',
  coilLit: 'rgba(90,120,170,0.55)',
  gap: '#0E1517',
  cap: '#252D31',
  capLine: '#1A2023',
  capTop: '#323C40',
  glow: [170, 200, 255, 0.7],
};

// How full each of the `max` cells is for `charge`, bottom cell first:
// 1 full, 0 empty, part-way for the cell being spent.
export function tubeCells(charge, max) {
  return Array.from({ length: max }, (_, i) => Math.max(0, Math.min(1, charge - i)));
}

// Draws the tube into `ctx` at the canvas's top-left corner: `charge` of
// `max` cells, lit with the light on (`lit`), dim with it off. `bright`
// (0..1, default 1 when lit) is how far a switch-on has warmed it: the
// cells go from stored to lit and the glow comes up (render.js fades it
// over BOOK.tubeWarmMs instead of the pack's flicker). Standing up
// (`upright`, the default) the cells fill from the bottom; on its side
// the cap is on the left and they fill from there. Each cell fills in
// whole art pixels.
export function drawTube(ctx, { charge, max, lit, bright = lit ? 1 : 0, upright = true }) {
  ctx.save();
  if (upright) ctx.clearRect(0, 0, TUBE_W, TUBE_H);
  else {
    ctx.clearRect(0, 0, TUBE_H, TUBE_W);
    // A quarter turn: the tube's foot (y = TUBE_H) lands at x = 0, its
    // left side along the top.
    ctx.transform(0, 1, -1, 0, TUBE_H, 0);
  }
  drawStanding(ctx, { charge, max, lit: lit && bright > 0, bright });
  ctx.restore();
}

// The tube standing up, in its own art pixels (drawTube).
function drawStanding(ctx, { charge, max, lit, bright }) {
  const cellH = (GLASS_BOTTOM - GLASS_TOP) / max;
  // The U bend at the top and the glass down each rod.
  ctx.fillStyle = COLORS.glass;
  ctx.fillRect(4, 1, 14, 1);
  ctx.fillRect(2, 2, 2, 2);
  ctx.fillRect(18, 2, 2, 2);
  ctx.fillRect(9, 5, 4, 1);
  for (const [x, w] of RODS) {
    ctx.fillRect(x - 1, GLASS_TOP - 2, 1, GLASS_BOTTOM - GLASS_TOP + 2);
    ctx.fillRect(x + w, GLASS_TOP - 2, 1, GLASS_BOTTOM - GLASS_TOP + 2);
  }
  ctx.fillStyle = COLORS.empty;
  ctx.fillRect(4, 2, 14, 3);
  const cells = tubeCells(charge, max);
  const on = mix(COLORS.stored, COLORS.lit, bright);
  if (lit && cells[max - 1] > 0) { ctx.fillStyle = on; ctx.fillRect(4, 2, 14, 3); }
  for (const [x, w] of RODS) {
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(x, GLASS_TOP - 1, w, GLASS_BOTTOM - GLASS_TOP + 1);
    ctx.save();
    if (lit) {
      const [r, g, b, a] = COLORS.glow;
      ctx.shadowColor = `rgba(${r},${g},${b},${a * bright})`;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = lit ? on : COLORS.stored;
    cells.forEach((fill, i) => {
      const h = Math.round(cellH * fill);
      if (h > 0) ctx.fillRect(x, GLASS_BOTTOM - i * cellH - h, w, h);
    });
    ctx.restore();
    // The coil, a zigzag of single pixels down the rod.
    ctx.fillStyle = lit ? COLORS.coilLit : COLORS.coilDark;
    for (let y = GLASS_TOP; y < GLASS_BOTTOM - 1; y += 3) ctx.fillRect(x + ((y / 3) % 2 ? 1 : 4), y, 1, 1);
    // A dark line between cells, so the charges can be counted.
    ctx.fillStyle = COLORS.gap;
    for (let i = 1; i < max; i++) ctx.fillRect(x, Math.round(GLASS_BOTTOM - i * cellH), w, 1);
  }
  // The cap.
  ctx.fillStyle = COLORS.cap;
  ctx.fillRect(1, GLASS_BOTTOM + 1, 20, TUBE_H - GLASS_BOTTOM - 1);
  ctx.fillStyle = COLORS.capTop;
  ctx.fillRect(1, GLASS_BOTTOM + 1, 20, 1);
  ctx.fillStyle = COLORS.capLine;
  ctx.fillRect(1, GLASS_BOTTOM + 5, 20, 1);
  ctx.fillRect(1, GLASS_BOTTOM + 9, 20, 1);
}

// The colour `p` (0..1) of the way from hex `from` to hex `to`.
function mix(from, to, p) {
  const a = [1, 3, 5].map(i => parseInt(from.slice(i, i + 2), 16));
  const b = [1, 3, 5].map(i => parseInt(to.slice(i, i + 2), 16));
  return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * p)).join(',') + ')';
}
