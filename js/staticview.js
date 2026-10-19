// Draws the static (static.js) over the map: a thin veil of grain,
// eased toward the level static.js gives after every change on the map
// (mapview.js requestMapDraw calls updateStatic), drifting slowly from one
// grain frame to the next, with a faint band rolling down. Once it is
// strong, now and then one letter of a HUD label or a room log line turns
// into its lookalike and back (Timothy's text uncanny valley). Simple
// enemies show none of it ("Enemy close." stays instead). Reduced motion:
// one still grain frame, no band, no wrong letters. Reads state only.

import { state } from './state.js';
import { STATIC, STATIC_LOOKALIKES } from './config.js';
import { staticLevel } from './static.js';

const canvas = document.getElementById('staticCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const FRAMES = 5;
const frames = [];
let target = 0;
let shown = 0;
let frameHandle = 0;
let lastNow = 0;
let wrong = null;
let nextWrong = 0;

// Grain frames, made once at the size of the canvas in grains: each grain
// a random grey, a touch cold, like the stick men's light.
function makeFrames(cols, rows) {
  frames.length = 0;
  for (let f = 0; f < FRAMES; f++) {
    const frame = document.createElement('canvas');
    frame.width = cols;
    frame.height = rows;
    const fctx = frame.getContext('2d');
    const img = fctx.createImageData(cols, rows);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v * 0.88;
      img.data[i + 1] = v * 0.93;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    fctx.putImageData(img, 0, 0);
    frames.push(frame);
  }
}

// Matches the canvas to its size on the page and remakes the grain to fit.
// Returns false while it isn't on screen.
function fitCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return false;
  if (canvas.width === width && canvas.height === height && frames.length) return true;
  canvas.width = width;
  canvas.height = height;
  makeFrames(Math.ceil(width / STATIC.grainSize), Math.ceil(height / STATIC.grainSize));
  return true;
}

// Takes the level static.js gives now and starts frames if there is
// static to ease toward or away from. Called by mapview.js requestMapDraw.
export function updateStatic() {
  if (!ctx) return;
  target = state.settings.simpleEnemies ? 0 : staticLevel();
  if (target > 0 || shown > 0) queueFrame();
}

function queueFrame() {
  if (!frameHandle) frameHandle = requestAnimationFrame(drawFrame);
}

// One frame: eases the strength, draws the veil and band, and runs the
// wrong letters. Frames stop once the static has eased to nothing, and
// under reduced motion once it has reached its level.
function drawFrame(now) {
  frameHandle = 0;
  const still = reducedMotion.matches;
  const dt = lastNow ? now - lastNow : 16;
  lastNow = now;
  shown = still ? target : shown + (target - shown) * Math.min(1, dt / STATIC.easeMs);
  if (Math.abs(target - shown) < 0.002) shown = target;
  if (!fitCanvas()) { lastNow = 0; return; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (shown > 0.005) drawVeil(now, still);
  wrongLetters(now, still);
  if (shown > 0 && !(still && shown === target)) queueFrame();
  else lastNow = 0;
}

// The veil: two grain frames crossfading (one still frame under reduced
// motion), and a faint band rolling down.
function drawVeil(now, still) {
  const alpha = STATIC.grain * shown;
  ctx.imageSmoothingEnabled = false;
  if (still) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(frames[0], 0, 0, frames[0].width * STATIC.grainSize, frames[0].height * STATIC.grainSize);
    ctx.globalAlpha = 1;
    return;
  }
  const at = now / STATIC.driftMs;
  const i = Math.floor(at) % FRAMES;
  const mix = at % 1;
  const w = frames[0].width * STATIC.grainSize;
  const h = frames[0].height * STATIC.grainSize;
  ctx.globalAlpha = alpha * (1 - mix);
  ctx.drawImage(frames[i], 0, 0, w, h);
  ctx.globalAlpha = alpha * mix;
  ctx.drawImage(frames[(i + 1) % FRAMES], 0, 0, w, h);
  const bandHeight = canvas.height * 0.07;
  const y = ((now / STATIC.bandMs) % 1) * (canvas.height + bandHeight * 2) - bandHeight;
  ctx.globalAlpha = STATIC.band * shown;
  ctx.fillStyle = '#e8ecea';
  ctx.fillRect(0, y, canvas.width, bandHeight);
  ctx.globalAlpha = 1;
}

// The wrong letters: once the static reaches STATIC.letters, every few
// seconds (STATIC.letterGapMs) it may (by its strength) turn one letter
// of a shown HUD label or room log line into its lookalike, and back after
// STATIC.letterHoldMs. Only one at a time. A line the game has rewritten
// meanwhile is left as the game wrote it.
function wrongLetters(now, still) {
  if (wrong && (now > wrong.until || still || shown < STATIC.letters)) {
    if (wrong.el.textContent === wrong.shownText) wrong.el.textContent = wrong.text;
    wrong = null;
  }
  if (still || wrong || now < nextWrong) return;
  const [low, high] = STATIC.letterGapMs;
  nextWrong = now + low + Math.random() * (high - low);
  if (shown < STATIC.letters || Math.random() > shown) return;
  const els = [...document.querySelectorAll('#statsBar .stat-label, #roomFeedback .room-note')]
    .filter(el => el.offsetParent && el.children.length === 0);
  const el = els[Math.floor(Math.random() * els.length)];
  if (!el) return;
  const text = el.textContent;
  const spots = [...text].map((ch, i) => (STATIC_LOOKALIKES[ch] ? i : -1)).filter(i => i >= 0);
  if (!spots.length) return;
  const i = spots[Math.floor(Math.random() * spots.length)];
  const shownText = text.slice(0, i) + STATIC_LOOKALIKES[text[i]] + text.slice(i + 1);
  el.textContent = shownText;
  wrong = { el, text, shownText, until: now + STATIC.letterHoldMs };
}
