// The space outside the ship's windows (Timothy 2026-11-02): one pixel-art
// picture of space per run, drawn once on a canvas, that every ship window
// shows its own part of (roomsky.js drawWindow; windows.js placeShipWindows
// says where each window looks and the run's seed). The look is ported from
// Deep-Fold's PixelSpace generator (Godot shaders, MIT licence, copyright
// (c) 2021 Deep-Fold; https://deep-fold.itch.io/): star dust, a nebula with
// a pale edge, small stars, a few big ones and planets, each coloured from
// one of its colour schemes. The shaders run here on the CPU, one picture
// pixel at a time, so the picture is low-detail pixel art like the rooms.
// It never moves (the calm rule), so reduced motion needs nothing more.

import { SHIP_WINDOWS } from './config.js';

// PixelSpace's colour schemes: the background first, then the 8 colours
// its layers pick from, dark to light.
const SCHEMES = [
  ['#01090f', '#08141e', '#0f2a3f', '#20394f', '#4e495f', '#816271', '#997577', '#c3a38a', '#f6d6bd'],
  ['#000a03', '#040c06', '#112318', '#1e3a29', '#305d42', '#4d8061', '#89a257', '#bedc7f', '#eeffcc'],
  ['#111837', '#20284e', '#2c4a78', '#3875a1', '#8bcadd', '#738d9d', '#a7bcc9', '#d6e1e9', '#ffffff'],
  ['#171711', '#202215', '#3a2802', '#963c3c', '#ca5a2e', '#ff7831', '#f39949', '#ebc275', '#dfd785'],
  ['#050219', '#120f28', '#2e1e5c', '#6d4299', '#8623ae', '#de39e9', '#f792e4', '#ffd2de', '#f7faea'],
  ['#211921', '#543344', '#8b4049', '#ae6a47', '#caa05a', '#515262', '#63787d', '#8ea091', '#c9cca1'],
  ['#000000', '#000000', '#0a0a0a', '#191919', '#533e2d', '#a27035', '#b88b4a', '#ddca7d', '#fbf9ef'],
  ['#120826', '#2b0f54', '#ab1f65', '#ff4f69', '#ff8142', '#ffda45', '#3368dc', '#49e7ec', '#fff7f8'],
  ['#2e242a', '#73464c', '#ab5675', '#ee6a7c', '#ffa7a5', '#34acba', '#72dcbb', '#ffe07e', '#ffe7d6'],
].map(list => list.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))));

const cache = { seed: null, canvas: null };

// The run's space picture for `seed` (state.floor.spaceSeed), made once
// and kept until the seed changes: a canvas SHIP_WINDOWS.width by height.
export function spacePicture(seed) {
  if (cache.seed === seed && cache.canvas) return cache.canvas;
  const { width: w, height: h } = SHIP_WINDOWS;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  paintSpace(image.data, w, h, seed);
  ctx.putImageData(image, 0, 0);
  cache.seed = seed;
  cache.canvas = canvas;
  return canvas;
}

// Paints the picture into `px` (RGBA, w by h) for `seed`, in PixelSpace's
// order: background, star dust, small stars, nebula, big stars, planets.
// Exported for tests (no canvas needed).
export function paintSpace(px, w, h, seed) {
  const rand = seeded(seed);
  const scheme = SCHEMES[Math.floor(rand() * SCHEMES.length)];
  const back = scheme[0], colours = scheme.slice(1);
  const pick = value => colours[Math.max(0, Math.min(7, Math.round(value * 7)))];
  const put = (x, y, rgb, alpha = 1) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - alpha) + rgb[c] * alpha);
    px[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, back);

  const dustSeed = 1 + rand() * 9, nebulaSeed = 1 + rand() * 9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dust = dustAt(x / h, y / h, (x + y) % 2 === 0, dustSeed);
      if (dust !== null) put(x, y, pick(dust));
    }
  }
  const stars = Math.floor(w * h / SHIP_WINDOWS.stars * (0.25 + rand() * 0.75));
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h);
    put(x, y, colours[4 + Math.floor(rand() * 4)], 0.5 + rand() * 0.5);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cloud = nebulaAt(x / h, y / h, (x + y) % 2 === 0, nebulaSeed);
      if (cloud !== null) put(x, y, cloud < 0.1 ? back : pick(cloud));
    }
  }
  const big = Math.floor(rand() * (SHIP_WINDOWS.bigStars + 1));
  for (let i = 0; i < big; i++) bigStar(put, Math.floor(rand() * w), Math.floor(rand() * h), colours, rand);
  const planets = Math.floor(rand() * (SHIP_WINDOWS.planets + 1));
  for (let i = 0; i < planets; i++) {
    const size = Math.max(5, Math.round((0.2 + rand() * 0.5) * (0.5 + rand() * 0.5) * h * 0.5));
    planet(put, Math.floor(rand() * w), Math.floor(rand() * h), size, pick, rand);
  }
}

// A small seeded random number source (mulberry32), so a run's picture is
// the same every time it is drawn.
function seeded(seed) {
  let s = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- PixelSpace's shader helpers, as plain functions ----

const fract = v => v - Math.floor(v);

// The shaders' hash: a fixed-looking random 0..1 for a grid point.
function hash(x, y, seed) {
  return fract(Math.sin(x * 12.9898 + y * 78.233) * (15.5453 + seed));
}

// Smooth value noise at (x, y).
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  const cx = fx * fx * (3 - 2 * fx), cy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * cx + (c - a) * cy * (1 - cx) + (d - b) * cx * cy;
}

// Layers of noise, each twice as fine and half as strong.
function fbm(x, y, octaves, seed) {
  let value = 0, scale = 0.5;
  for (let i = 0; i < octaves; i++) {
    value += noise(x, y, seed) * scale;
    x *= 2;
    y *= 2;
    scale *= 0.5;
  }
  return value;
}

// Round blobs on a staggered grid, which give the clouds their lumps.
function circleNoise(x, y, seed) {
  const row = Math.floor(y);
  x += row * 0.31;
  const h = hash(Math.floor(x), row, seed);
  const m = Math.hypot(fract(x) - 0.25 - h * 0.5, fract(y) - 0.25 - h * 0.5);
  const r = h * 0.25;
  const t = r > 0 ? Math.max(0, Math.min(1, m * 0.75 / r)) : 1;
  return t * t * (3 - 2 * t);
}

// Lumpy cloud noise: noise pushed about by the blobs.
function cloudAlpha(x, y, octaves, seed) {
  let c = 0;
  for (let i = 0; i < 2; i++) c += circleNoise(x * 0.5 + i + 1 - 0.3, y * 0.5 + i + 1, seed);
  return fbm(x + c, y + c, octaves, seed);
}

// The star dust at (x, y) (in picture heights): a colour value 0..1, or
// null where there is none. `dith` is the shaders' checkerboard.
function dustAt(x, y, dith, seed) {
  const size = SHIP_WINDOWS.dust, octaves = 8;
  const alpha = fbm(x * Math.ceil(size * 0.5) + 2, y * Math.ceil(size * 0.5) + 2, octaves, seed);
  let lerp = fbm(x * Math.ceil(size * 0.2) - 2, y * Math.ceil(size * 0.2) - 2, octaves, seed) * cloudAlpha(x * size, y * size, octaves, seed);
  if (dith) lerp *= 0.95;
  if (alpha > lerp * 1.8) return null;
  let value = Math.pow(lerp, 3.2) * 56;
  if (dith) value *= 1.1;
  return Math.floor(value) / 7;
}

// The nebula at (x, y): a colour value 0..1 (under 0.1 shows the
// background colour), or null outside it. Its thin pale band is where the
// edge (SHIP_WINDOWS.edge) widens it.
function nebulaAt(x, y, dith, seed) {
  const size = SHIP_WINDOWS.nebula, octaves = 3;
  const n = cloudAlpha(x * size, y * size, octaves, seed);
  const n2 = fbm(x * size + 1, y * size + 1, octaves, seed);
  let lerp = n * n2 * n;
  if (dith) lerp *= 0.95;
  const inside = n2 <= SHIP_WINDOWS.nebulaAt;
  const band = n2 <= SHIP_WINDOWS.nebulaAt + SHIP_WINDOWS.edge;
  if (!band) return null;
  return inside ? Math.floor(lerp * 14) / 7 : Math.floor(lerp * 35) / 7;
}

// A big star: a bright middle and a cross of rays, 1 or 2 pixels long.
function bigStar(put, x, y, colours, rand) {
  const reach = 1 + Math.floor(rand() * 2);
  put(x, y, colours[7]);
  for (let i = 1; i <= reach; i++) {
    const rgb = i === 1 ? colours[6] : colours[4];
    put(x + i, y, rgb);
    put(x - i, y, rgb);
    put(x, y + i, rgb);
    put(x, y - i, rgb);
  }
}

// A planet `size` pixels across with its top-left at (x0, y0): noise
// wrapped on a ball and shaded from a random light (PixelSpace's planet
// shader).
function planet(put, x0, y0, size, pick, rand) {
  const seed = 1 + rand() * 9, lx = rand(), ly = rand();
  const scale = 5.365, octaves = 3;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      const toMiddle = Math.hypot(u - 0.5, v - 0.5);
      if (toMiddle > 0.5) continue;
      const cx = u * 2 - 1, cy = v * 2 - 1;
      const z = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
      const su = cx / (z + 1) * 0.5 + 0.5, sv = cy / (z + 1) * 0.5 + 0.5;
      const toLight = Math.hypot(su - lx, sv - ly) + Math.pow(toMiddle * 3, 4) * 0.05;
      const n = fbm(su * scale, sv * scale, octaves, seed * 15.5453 - 15.5453);
      let mixed = fbm(su * scale + n * 3, sv * scale + n * 3, octaves, seed * 15.5453 - 15.5453) * toLight;
      if ((i + j) % 2 === 0) mixed *= 0.95;
      put(x0 + i, y0 + j, pick(Math.floor(mixed * 15) / 7));
    }
  }
}
