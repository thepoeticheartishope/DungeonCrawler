// The windows and the eye in the sky on the room view (room view plan
// step F, sky eye plan; moved out of roomview.js): the ship's windows into
// space (space.js),
// and, while the player looks up (main.js holdLookUp -> lookUp), the room
// fading into the night sky with the eye hanging in it as pixel art.
// roomview.js hands over this frame's look and its scale first
// (startSkyFrame). Reads state and never changes it.

import { state } from './state.js';
import { ROOM_VIEW, SKY_EYE, SHIP_WINDOWS } from './config.js';
import { spacePicture } from './space.js';

const T = ROOM_VIEW.tilePx;
// The ship's windows: a hull-grey frame with a lit top edge and a dark
// inner rim round the view of space.
const SHIP_FRAME = { frame: '#2b3138', edge: '#56606b', rim: '#14181c' };
// The night sky while looking up: how dark the room goes under it, and the
// line width of the eye, in picture pixels.
const SKY = { dark: 0.92, line: 1, rise: 0.15, middle: 0.42 };

let look = null;          // what mapview.js hands roomview each frame
let scale = 1;            // canvas pixels per picture pixel
let lookingUp = false;    // the player is looking up at the sky (lookUp)
let upShare = 0;          // how far the sky has faded in, 0 to 1
let skyAt = 0;            // the last frame the sky eased at
let sky = null;           // the sky at the picture's size, over the whole map
let sctx = null;

// roomview.js hands over this frame's look and its scale before anything
// here draws.
export function startSkyFrame(shared, pixelScale) {
  look = shared;
  scale = pixelScale;
}

// Looks up at the sky (on) or back down (sky eye plan, room view plan step
// F): main.js calls it while Space is held or the look stick is pushed up.
// View-only and free: the room fades into the night sky with the eye.
export function lookUp(on) {
  lookingUp = on;
}

// A window in the still picture: a ship window, looking into space.
export function drawWindow(ctx, w) {
  drawShipWindow(ctx, w);
}

// Where a ship window's glass is in the still picture, in picture pixels:
// two tiles wide over both faces of its wall, inside the frame.
function shipGlass(w) {
  const x = w.col * T + 5, y = (w.row - 1) * T + 6;
  return { x, y, w: 2 * T - 10, h: 2 * T - 13 };
}

// Where in the space picture a ship window's glass looks: `w.view`'s spot,
// scrolled SHIP_WINDOWS.drift picture pixels a second (`now`, ms), the
// ship moving through space. Across, it wraps round the picture (space.js
// makes it seamless). Where the player stands doesn't move it (Timothy
// 2026-11-02: that was disorienting). No `now` (the still picture, reduced
// motion): no scroll.
function viewCorner(w, g, sky, now) {
  let sx = w.view.x * sky.width;
  const sy = w.view.y * (sky.height - g.h);
  if (now) sx += now / 1000 * SHIP_WINDOWS.drift;
  sx = Math.round(sx) % sky.width;
  return [sx < 0 ? sx + sky.width : sx, Math.round(sy)];
}

// Draws the glass `g` from the space picture with its top-left at
// (sx, sy), in two pieces where it runs off the picture's right edge and
// wraps to its left.
function drawView(c, sky, sx, sy, g, dx, dy) {
  const first = Math.min(g.w, sky.width - sx);
  c.drawImage(sky, sx, sy, first, g.h, dx, dy, first, g.h);
  if (first < g.w) c.drawImage(sky, 0, sy, g.w - first, g.h, dx + first, dy, g.w - first, g.h);
}

// A ship window's view of space drawn over the lit picture at `alpha`
// (roomview.js, each frame, for the room the player is in), scrolling with
// the time (`now`); null under reduced motion keeps the still picture's
// view. While it scrolls the view keeps drawing frames.
export function drawShipView(c, w, ox, oy, now, alpha) {
  const g = shipGlass(w);
  const sky = spacePicture(state.floor.spaceSeed);
  const [sx, sy] = viewCorner(w, g, sky, now);
  c.globalAlpha = alpha;
  drawView(c, sky, sx, sy, g, g.x - ox, g.y - oy);
  c.globalAlpha = 1;
  if (now) look.keepMoving();
}

// A ship window (Timothy 2026-11-02): a rounded hull frame two tiles wide
// with its part of the run's space picture (space.js) as the glass, from
// where `w.view` says it looks, and a short sill below.
function drawShipWindow(ctx, w) {
  const g = shipGlass(w);
  const sky = spacePicture(state.floor.spaceSeed);
  const [sx, sy] = viewCorner(w, g, sky, null);
  ctx.fillStyle = SHIP_FRAME.frame;
  ctx.fillRect(g.x - 2, g.y - 3, g.w + 4, g.h + 6);
  ctx.fillRect(g.x - 3, g.y - 2, g.w + 6, g.h + 4);
  ctx.fillStyle = SHIP_FRAME.edge;
  ctx.fillRect(g.x - 1, g.y - 3, g.w + 2, 1);
  ctx.fillStyle = SHIP_FRAME.rim;
  ctx.fillRect(g.x, g.y - 1, g.w, g.h + 2);
  ctx.fillRect(g.x - 1, g.y, g.w + 2, g.h);
  drawView(ctx, sky, sx, sy, g, g.x, g.y);
  ctx.fillStyle = SHIP_FRAME.edge;
  ctx.fillRect(g.x - 4, g.y + g.h + 3, g.w + 8, 1);
}

// The eye in the sky while the player looks up (sky eye plan): the whole
// map fades into the night, paling faintly blue as the eye opens, and the
// eye hangs above the middle, drawn at the picture's size and scaled up
// like the rest, its pupil turned down toward the player. It eases in and
// out over ROOM_VIEW.lookUpMs (at once under reduced motion).
export function drawSky(ctx, w, h, at, ox, oy) {
  const goal = lookingUp ? 1 : 0;
  const ease = look.still ? 1 : 1 - Math.exp(-Math.min(50, look.now - (skyAt || look.now)) / ROOM_VIEW.lookUpMs);
  skyAt = look.now;
  upShare += (goal - upShare) * ease;
  if (Math.abs(goal - upShare) < 0.01) upShare = goal;
  if (upShare !== goal) look.showPlain();
  if (!upShare) return;
  if (!sky) {
    sky = document.createElement('canvas');
    sctx = sky.getContext('2d');
  }
  if (sky.width !== w || sky.height !== h) {
    sky.width = w;
    sky.height = h;
  }
  sctx.clearRect(0, 0, w, h);
  sctx.fillStyle = 'rgba(0, 0, 0, ' + SKY.dark * upShare + ')';
  sctx.fillRect(0, 0, w, h);
  const ex = w / 2, ey = h * SKY.middle + (1 - upShare) * h * SKY.rise;
  // The eye stays shut: there is no boss's light on the ship.
  sctx.globalAlpha = upShare;
  drawSkyEye(sctx, ex, ey, w * SKY_EYE.size, 0, [(at.col + 0.5) * T - ox, (at.row + 0.2) * T - oy]);
  sctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sky, 0, 0, w, h, 0, 0, w * scale, h * scale);
  ctx.imageSmoothingEnabled = true;
}

// The eye at (x, y), `r` its half width in picture pixels, `open` (0..1,
// skyEyeOpen) parting the lids: its glow, the dark between the lids, the
// iris and slit pupil turned toward `toward`, then the lids. Near the end
// it twitches slowly (never under reduced motion: the calm rule).
function drawSkyEye(c, x0, y, r, open, toward) {
  let x = x0;
  if (open >= SKY_EYE.twitchAt && !look.still) {
    look.keepMoving();
    const phase = (look.now % SKY_EYE.twitchMs) / SKY_EYE.twitchMs;
    if (phase > 0.86 && phase < 0.9) x -= r * SKY_EYE.twitch;
    else if (phase >= 0.9 && phase < 0.94) x += r * SKY_EYE.twitch;
  }
  const blue = look.colours.bossLightRgb;
  const pale = look.colours.bossFogRgb;
  const lid = r * SKY_EYE.lid * open;
  const shape = () => {
    c.beginPath();
    c.moveTo(x - r, y);
    c.quadraticCurveTo(x, y - lid * 2, x + r, y);
    c.quadraticCurveTo(x, y + lid * 2, x - r, y);
    c.closePath();
  };
  const reach = r * SKY_EYE.halo;
  const halo = c.createRadialGradient(x, y, r * 0.2, x, y, reach);
  halo.addColorStop(0, 'rgba(' + blue + ', ' + (0.05 + 0.18 * open) + ')');
  halo.addColorStop(1, 'rgba(' + blue + ', 0)');
  c.fillStyle = halo;
  c.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  if (lid > 1) {
    c.save();
    shape();
    c.fillStyle = '#000';
    c.fill();
    c.clip();
    const length = Math.hypot(toward[0] - x, toward[1] - y) || 1;
    const ix = x + (toward[0] - x) / length * r * SKY_EYE.look;
    const iy = y + (toward[1] - y) / length * Math.min(lid * 0.6, r * SKY_EYE.look);
    const ir = r * SKY_EYE.iris;
    const iris = c.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
    iris.addColorStop(0, 'rgba(' + pale + ', 0.95)');
    iris.addColorStop(1, 'rgba(' + blue + ', 0.55)');
    c.beginPath();
    c.arc(ix, iy, ir, 0, Math.PI * 2);
    c.fillStyle = iris;
    c.fill();
    c.beginPath();
    c.ellipse(ix, iy, ir * 0.18, ir * (0.35 + 0.45 * open), 0, 0, Math.PI * 2);
    c.fillStyle = '#000';
    c.fill();
    c.restore();
  }
  c.lineJoin = 'round';
  [[SKY.line * 3, 0.15], [SKY.line, 0.95]].forEach(([lw, a]) => {
    shape();
    c.strokeStyle = 'rgba(' + pale + ', ' + a + ')';
    c.lineWidth = lw;
    c.stroke();
  });
}
