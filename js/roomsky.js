// The windows and the eye in the sky on the room view (room view plan
// step F, sky eye plan; moved out of roomview.js): windows on back walls
// that face the outside, their warm pool of light with the frame's shadow,
// and, while the player looks up (main.js holdLookUp -> lookUp), the room
// fading into the night sky with the eye hanging in it as pixel art.
// roomview.js hands over its glow canvas, this frame's look and its scale
// first (startSkyFrame). Reads state and never changes it.

import { state } from './state.js';
import { ROOM_VIEW, SKY_EYE, WINDOW_LIGHT } from './config.js';
import { skyEyeOpen, skyTurnsLeft } from './mapshared.js';
import { POOL } from './roomthings.js';
import { t } from './text.js';

const T = ROOM_VIEW.tilePx;
// Windows (step F; where they stand and the shape of their light are
// windows.js and WINDOW_LIGHT): the frame and glass, the warm pool's
// strength and colour, the frame's shadow in it, and how bright the glass stays.
const WINDOW = { frame: '#4a3a30', glassTop: '#f3dcae', glassFoot: '#ddb173' };
// The night sky while looking up: how dark the room goes under it, and the
// line width of the eye, in picture pixels.
const SKY = { dark: 0.92, line: 1, rise: 0.15, middle: 0.42 };

let gctx = null;          // the light added over the picture (roomview's glow canvas)
let look = null;          // what mapview.js hands roomview each frame
let scale = 1;            // canvas pixels per picture pixel
let lookingUp = false;    // the player is looking up at the sky (lookUp)
let upShare = 0;          // how far the sky has faded in, 0 to 1
let skyAt = 0;            // the last frame the sky eased at
let sky = null;           // the sky at the picture's size, over the whole map
let sctx = null;

// roomview.js hands over its glow canvas, this frame's look and its scale
// before anything here draws.
export function startSkyFrame(glow, shared, pixelScale) {
  gctx = glow;
  look = shared;
  scale = pixelScale;
}

// Looks up at the sky (on) or back down (sky eye plan, room view plan step
// F): main.js calls it while Space is held or the look stick is pushed up.
// View-only and free: the room fades into the night sky with the eye.
export function lookUp(on) {
  lookingUp = on;
}

// How far the sky has faded in, 0 to 1 (for the smoke test).
export function roomLookUp() {
  return upShare;
}

// A window in the still picture: an arched frame two tiles wide over both
// faces of the wall, warm glass (light outside), its cross bars, a sill.
export function drawWindow(ctx, w) {
  const x0 = w.col * T + 4, width = 2 * T - 8, top = (w.row - 1) * T + 5, bottom = w.row * T + T - 6;
  const rad = width / 2;
  for (let y = top; y <= bottom; y++) {
    let half = rad;
    if (y < top + rad) half = Math.sqrt(Math.max(0, rad * rad - (top + rad - y) ** 2));
    const h = Math.round(half);
    ctx.fillStyle = WINDOW.frame;
    ctx.fillRect(x0 + rad - h - 2, y, h * 2 + 4, 1);
    ctx.fillStyle = (y - top) / (bottom - top) < 0.5 ? WINDOW.glassTop : WINDOW.glassFoot;
    if (h > 1) ctx.fillRect(x0 + rad - h, y, h * 2, 1);
  }
  ctx.fillStyle = WINDOW.frame;
  ctx.fillRect(x0 + rad - 1, top, 2, bottom - top);
  ctx.fillRect(x0, top + Math.round((bottom - top) * 0.55), width, 2);
  ctx.fillRect(x0 - 3, bottom + 1, width + 6, 2);
}

// The warm light a window throws down and across the floor of its room
// (the same shape as windows.js lights), added to the light, with the
// shadow of its cross bars laid over it.
export function drawPool(w, ox, oy) {
  const inset = WINDOW_LIGHT.inset * T;
  const x0 = w.col * T + inset - ox, x1 = (w.col + 2) * T - inset - ox, by = (w.row + 1) * T - oy;
  const dx = WINDOW_LIGHT.slant * T, len = WINDOW_LIGHT.length * T;
  const g = gctx.createLinearGradient(0, by, 0, by + len);
  g.addColorStop(0, 'rgba(' + POOL.rgb + ', ' + POOL.level + ')');
  g.addColorStop(0.7, 'rgba(' + POOL.rgb + ', ' + POOL.level * 0.5 + ')');
  g.addColorStop(1, 'rgba(' + POOL.rgb + ', 0)');
  gctx.globalCompositeOperation = 'lighter';
  gctx.fillStyle = g;
  gctx.beginPath();
  gctx.moveTo(x0, by);
  gctx.lineTo(x1, by);
  gctx.lineTo(x1 + dx, by + len);
  gctx.lineTo(x0 + dx, by + len);
  gctx.closePath();
  gctx.fill();
  gctx.globalCompositeOperation = 'multiply';
  gctx.strokeStyle = POOL.bars;
  gctx.lineWidth = 2;
  const mx = (x0 + x1) / 2, t = 0.42;
  gctx.beginPath();
  gctx.moveTo(mx, by + 2);
  gctx.lineTo(mx + dx * 0.8, by + len * 0.8);
  gctx.moveTo(x0 + dx * t, by + len * t);
  gctx.lineTo(x1 + dx * t, by + len * t);
  gctx.stroke();
  gctx.globalCompositeOperation = 'lighter';
}

// The eye in the sky while the player looks up (sky eye plan): the whole
// map fades into the night, paling faintly blue as the eye opens, and the
// eye hangs above the middle, drawn at the picture's size and scaled up
// like the rest, its pupil turned down toward the player. It eases in and
// out over ROOM_VIEW.lookUpMs (at once under reduced motion).
// Comfort mode shows the turns left as words instead.
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
  const open = skyEyeOpen();
  sctx.clearRect(0, 0, w, h);
  sctx.fillStyle = 'rgba(0, 0, 0, ' + SKY.dark * upShare + ')';
  sctx.fillRect(0, 0, w, h);
  const pale = Math.max(0, (open - SKY_EYE.paleFrom) / (1 - SKY_EYE.paleFrom)) * upShare;
  if (pale > 0) {
    const g = sctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(' + look.colours.bossLightRgb + ', ' + 0.14 * pale + ')');
    g.addColorStop(1, 'rgba(' + look.colours.bossLightRgb + ', 0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, w, h);
  }
  const ex = w / 2, ey = h * SKY.middle + (1 - upShare) * h * SKY.rise;
  if (!state.settings.simpleEnemies) {
    sctx.globalAlpha = upShare;
    drawSkyEye(sctx, ex, ey, w * SKY_EYE.size, open, [(at.col + 0.5) * T - ox, (at.row + 0.2) * T - oy]);
    sctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sky, 0, 0, w, h, 0, 0, w * scale, h * scale);
  ctx.imageSmoothingEnabled = true;
  if (!state.settings.simpleEnemies) return;
  const left = skyTurnsLeft();
  const words = state.floor.tutorial ? t('sky.watching') : left === null ? t('sky.noLight') : t(state.settings.oneStick ? 'sky.secondsLeft' : 'sky.turnsLeft', { count: left });
  ctx.save();
  ctx.globalAlpha = upShare;
  ctx.font = Math.round(w * scale * SKY_EYE.size * 0.5) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgb(' + look.colours.glowRgb + ')';
  ctx.fillText(words, ex * scale, ey * scale);
  ctx.restore();
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
