// The light tube (record book plan): the light's battery drawn as a
// fluorescent tube, glass with one cell a charge, a coil inside and a cap
// at its foot, at the room's own chunky pixel size. bookview.js stands it
// up on the book's left edge. The shapes follow the Pocket Inventory pack's
// tube, drawn in code: the pack's own files may not be shared, so none of
// them are in the game.

// The tube's size in art pixels, standing up. The canvas it is drawn on is
// this size and scaled up by CSS (image-rendering: pixelated).
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
  glow: 'rgba(170,200,255,0.7)',
};

// How full each of the `max` cells is for `charge`, bottom cell first:
// 1 full, 0 empty, part-way for the cell being spent.
export function tubeCells(charge, max) {
  return Array.from({ length: max }, (_, i) => Math.max(0, Math.min(1, charge - i)));
}

// Draws the tube standing up into `ctx` at the canvas's top-left corner:
// `charge` of `max` cells, lit with the light on (`lit`), dim with it off.
// Each cell fills from the bottom in whole art pixels.
export function drawTube(ctx, { charge, max, lit }) {
  ctx.clearRect(0, 0, TUBE_W, TUBE_H);
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
  if (lit && cells[max - 1] > 0) { ctx.fillStyle = COLORS.lit; ctx.fillRect(4, 2, 14, 3); }
  for (const [x, w] of RODS) {
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(x, GLASS_TOP - 1, w, GLASS_BOTTOM - GLASS_TOP + 1);
    ctx.save();
    if (lit) { ctx.shadowColor = COLORS.glow; ctx.shadowBlur = 6; }
    ctx.fillStyle = lit ? COLORS.lit : COLORS.stored;
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
