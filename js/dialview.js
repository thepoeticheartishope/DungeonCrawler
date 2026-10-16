// The dial (kill or maim plan step B): the circle a landed shot's zones sit
// on, and the Struggle's one zone, drawn on the `<canvas>` in the veil over
// the map (gunpanels.js opens and closes the veil and passes in what to
// draw). The marker goes round clockwise from a random spot; where it
// stops, in the zones' own frame (any drift taken off), goes to the rules
// (gun.js settleShot / settleStruggle). The kind's traits (MINION_KINDS
// dial) play here: the HUSK's zones drift with the marker, the SHARD's left
// side surges, the STALKER's marker stops for a moment and turns back. A
// dark shot or a low battery hides the bottom quarter's zones.
//
// The marker's clock is view-only module vars, like the map's animation
// clocks, so not in state. The pure helpers (zoneFrame, surgeSpeed,
// stepMarker) are tested in tests/dial.test.mjs.

import {
  DIAL_DRIFT_LAPS, DIAL_SURGE_AT, DIAL_SURGE_BOOST, DIAL_TURN_PAUSE_MS, DIAL_TURN_PAUSE_REDUCED_MS,
  DIAL_TURN_FIRST_MS, DIAL_TURN_EVERY_MS, DIAL_DARK_AT, DIAL_DARK_ARC, DIAL_GUARD_TURN_MS,
  DIAL_REDUCED_SCALE, DIAL_SIZE_SHARE, ENEMY_LIGHT,
} from './config.js';
import { t } from './text.js';

// The drawing's own units: a 600 square, scaled to the canvas. R is the
// ring's middle, RING its width.
const UNIT = 600;
const MID = UNIT / 2;
const R = 200;
const RING = 56;

let canvas = null;
let ctx = null;
let colours = null;
let hatch = null;
// What the dial shows: { zones, lapMs, lapLimit, traits, darkArc, guard,
// struggle, marker, result, frame, last, onLimit }, or null.
let dial = null;

// Where the marker is in the zones' own frame (0 to 1 round the circle)
// when it stands at `at` on screen and the zones have drifted `drift`
// round. This is what a stop hands the rules.
export function zoneFrame(at, drift) {
  return (((at - drift) % 1) + 1) % 1;
}

// How fast the marker goes at `at`, as a multiple of its even speed: on a
// surging dial up to 1 + DIAL_SURGE_BOOST round DIAL_SURGE_AT, easing to 1
// a quarter of the way round either side, so the surge reads as one side.
export function surgeSpeed(at, surge) {
  if (!surge) return 1;
  const near = Math.max(0, Math.cos(2 * Math.PI * (at - DIAL_SURGE_AT)));
  return 1 + DIAL_SURGE_BOOST * near * near;
}

// A random time between the two numbers of `range` ([low, high] ms).
function between([low, high], random) {
  return low + (high - low) * random();
}

// A new marker at a random spot, going clockwise: { at, drift, dir, laps,
// pause, nextTurn }. `laps` counts the distance gone round, whichever way,
// so a turn back doesn't buy more time before a lap limit.
export function newMarker(random = Math.random) {
  return { at: random(), drift: random(), dir: 1, laps: 0, pause: 0, nextTurn: between(DIAL_TURN_FIRST_MS, random) };
}

// Moves `marker` on by `dt` ms, for a dial of `lapMs` a lap with `traits`
// (spin, turnBack, surge). Under `reduced` motion the zones don't drift and
// the turn-back pause is longer (the lap time is already doubled by the
// caller). Returns the marker.
export function stepMarker(marker, dt, { lapMs, traits = {}, reduced = false, random = Math.random }) {
  if (traits.spin === 'with' && !reduced) marker.drift = (marker.drift + marker.dir * DIAL_DRIFT_LAPS * dt / 1000 + 1) % 1;
  if (marker.pause > 0) {
    marker.pause -= dt;
    if (marker.pause <= 0) { marker.pause = 0; marker.dir = -marker.dir; }
    return marker;
  }
  const gone = surgeSpeed(marker.at, traits.surge) * dt / lapMs;
  marker.at = (marker.at + marker.dir * gone + 1) % 1;
  marker.laps += gone;
  if (!traits.turnBack) return marker;
  marker.nextTurn -= dt;
  if (marker.nextTurn > 0) return marker;
  marker.pause = reduced ? DIAL_TURN_PAUSE_REDUCED_MS : DIAL_TURN_PAUSE_MS;
  marker.nextTurn = between(DIAL_TURN_EVERY_MS, random);
  return marker;
}

// Whether the marker has gone `lapLimit` laps (0: no limit).
export function lapsUp(marker, lapLimit) {
  return lapLimit > 0 && marker.laps >= lapLimit;
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Looks up the canvas and reads the page's colours. Call once, from
// gunpanels.js.
export function initDialView(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  colours = {
    glow: read('--glow-rgb'), text: read('--text'), muted: read('--muted'),
    bright: read('--torch-bright'), ink: read('--ink'), font: read('--font'),
  };
  const tile = document.createElement('canvas');
  tile.width = tile.height = 10;
  const g = tile.getContext('2d');
  g.strokeStyle = 'rgba(' + colours.glow + ', 0.5)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-2, 12); g.lineTo(12, -2); g.stroke();
  hatch = ctx.createPattern(tile, 'repeat');
}

// Sizes the canvas to DIAL_SIZE_SHARE of the `width` x `height` it has
// (CSS px), sharp on high-density screens. Only when the size changed.
export function sizeDial(width, height) {
  const side = Math.max(120, Math.floor(Math.min(width, height) * DIAL_SIZE_SHARE));
  const scale = window.devicePixelRatio || 1;
  if (canvas.width === Math.round(side * scale)) return;
  canvas.style.width = canvas.style.height = side + 'px';
  canvas.width = canvas.height = Math.round(side * scale);
  if (dial) drawDial(performance.now());
}

// Starts the dial: `spec` = { zones ([{ tier, harm?, from, to }]), lapMs,
// lapLimit (0: none), traits, darkArc, guard, struggle }. `onLimit` is
// called when the lap limit stops it by itself.
export function startDial(spec, onLimit) {
  stopLoop();
  const lapMs = spec.lapMs * (reducedMotion() ? DIAL_REDUCED_SCALE : 1);
  dial = { ...spec, traits: spec.traits || {}, lapMs, marker: newMarker(), result: null, frame: 0, last: performance.now(), onLimit };
  dial.frame = requestAnimationFrame(tick);
}

// One frame: the marker moves on (a long gap, such as a hidden tab, counts
// as one short step), then the dial is drawn. At its lap limit it stops.
function tick(now) {
  if (!dial || dial.result !== null) return;
  const dt = Math.min(50, now - dial.last);
  dial.last = now;
  stepMarker(dial.marker, dt, { lapMs: dial.lapMs, traits: dial.traits, reduced: reducedMotion() });
  if (lapsUp(dial.marker, dial.lapLimit)) {
    dial.frame = 0;
    dial.onLimit();
    return;
  }
  drawDial(now);
  dial.frame = requestAnimationFrame(tick);
}

function stopLoop() {
  if (dial && dial.frame) cancelAnimationFrame(dial.frame);
  if (dial) dial.frame = 0;
}

// Whether the marker is going round.
export function dialRunning() {
  return !!dial && dial.result === null;
}

// Stops the marker where it is and returns where that is in the zones'
// frame (0 to 1), or null if it wasn't running. The dial stays drawn.
export function stopDial() {
  if (!dialRunning()) return null;
  stopLoop();
  dial.result = '';
  drawDial(performance.now());
  return zoneFrame(dial.marker.at, dial.marker.drift);
}

// Writes `word` (what the shot did) in the middle of the stopped dial.
export function showDialResult(word) {
  if (!dial) return;
  stopLoop();
  dial.result = word || '';
  drawDial(performance.now());
}

// Clears the dial (the veil is gone).
export function clearDial() {
  stopLoop();
  dial = null;
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// The angle on the canvas of `f` round the circle: 0 at the top, clockwise.
function angle(f) {
  return f * Math.PI * 2 - Math.PI / 2;
}

// A band of the ring from `from` to `to` (0 to 1), between radii r0 and r1.
function band(from, to, r0, r1) {
  ctx.beginPath();
  ctx.arc(MID, MID, r1, angle(from), angle(to));
  ctx.arc(MID, MID, r0, angle(to), angle(from), true);
  ctx.closePath();
}

// The point `r` out from the middle at `f` round the circle.
function at(f, r) {
  const a = angle(f);
  return [MID + Math.cos(a) * r, MID + Math.sin(a) * r];
}

function font(size) {
  return size + 'px ' + colours.font;
}

// Draws the running (or stopped) dial: the ring, the surge ticks, the
// zones with their marks, the dark arc, the guard ring, the marker with a
// dot ahead of it for its way, and in the middle the lap count, STOP or
// the result.
function drawDial(now) {
  const scale = canvas.width / UNIT;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!dial) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const r0 = R - RING / 2;
  const r1 = R + RING / 2;
  const { marker } = dial;

  ctx.lineWidth = dial.struggle ? 3 : 1.5;
  ctx.strokeStyle = dial.struggle ? colours.bright : colours.muted;
  ctx.beginPath(); ctx.arc(MID, MID, r1, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(MID, MID, r0, 0, Math.PI * 2); ctx.stroke();
  if (dial.traits.surge) drawSurge(r1);
  dial.zones.forEach(zone => drawZone(zone, marker.drift, r0, r1));
  if (dial.darkArc) drawDarkArc(r0, r1);
  if (dial.guard) drawGuardRing(now, r0);
  drawMarker(r0, r1);

  ctx.fillStyle = colours.text;
  if (dial.result) {
    ctx.font = font(44);
    ctx.fillText(dial.result, MID, MID);
  } else if (dial.result === null) {
    ctx.font = font(34);
    const lap = Math.min(dial.lapLimit, Math.floor(marker.laps) + 1);
    ctx.fillText(dial.lapLimit ? t('gun.dial.lap', { lap, of: dial.lapLimit }) : t('gun.dial.stop'), MID, MID);
  }
}

// The surge side: ticks outside the ring, longer where it is fastest.
function drawSurge(r1) {
  ctx.strokeStyle = 'rgba(' + colours.glow + ', 0.35)';
  ctx.lineWidth = 2;
  for (let f = DIAL_SURGE_AT - 0.15; f <= DIAL_SURGE_AT + 0.15; f += 0.0125) {
    const w = surgeSpeed(f, true) - 1;
    ctx.beginPath();
    ctx.moveTo(...at(f, r1 + 6));
    ctx.lineTo(...at(f, r1 + 8 + 14 * w / DIAL_SURGE_BOOST));
    ctx.stroke();
  }
}

// One zone, turned on by the drift: the kill zone (and the Struggle's)
// solid, the maim zone faint with dashed edges, a harmful one hatched,
// each with its mark (K, M, X, N, >).
function drawZone(zone, drift, r0, r1) {
  const from = zone.from + drift;
  const to = zone.to + drift;
  band(from, to, r0, r1);
  if (zone.tier === 'kill' || dial.struggle) {
    ctx.fillStyle = 'rgba(' + colours.glow + ', 0.85)';
    ctx.fill();
  } else if (zone.tier === 'maim') {
    ctx.fillStyle = 'rgba(' + colours.glow + ', 0.22)';
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = colours.muted;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = hatch;
    ctx.fill();
    ctx.strokeStyle = colours.muted;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (dial.struggle) return;
  ctx.fillStyle = zone.tier === 'kill' ? colours.ink : colours.text;
  ctx.font = font(32);
  ctx.fillText(t('gun.dial.zone.' + (zone.harm || zone.tier)), ...at((from + to) / 2, R));
}

// The dark arc: the zones under it are hidden, its edge dotted, "dark"
// under it.
function drawDarkArc(r0, r1) {
  band(DIAL_DARK_AT - DIAL_DARK_ARC / 2, DIAL_DARK_AT + DIAL_DARK_ARC / 2, r0 - 3, r1 + 3);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.setLineDash([2, 8]);
  ctx.strokeStyle = colours.muted;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colours.muted;
  ctx.font = font(24);
  ctx.fillText(t('gun.dial.darkArc'), ...at(DIAL_DARK_AT, r1 + 24));
}

// The guard (the HUSK's): GUARD · round the inside of the ring in the
// enemies' cold blue, turning slowly (still under reduced motion). Each
// letter leans along the circle, so the word reads round it clockwise
// (upright letters read backwards up the left side).
function drawGuardRing(now, r0) {
  const letters = t('gun.dial.guardRing').repeat(6).split('');
  const turn = reducedMotion() ? 0 : now / DIAL_GUARD_TURN_MS;
  ctx.fillStyle = 'rgba(' + ENEMY_LIGHT.core + ', 0.75)';
  ctx.font = font(22);
  letters.forEach((ch, i) => {
    const f = i / letters.length + turn;
    ctx.save();
    ctx.translate(...at(f, r0 - 32));
    ctx.rotate(angle(f) + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

// The marker across the ring, a fainter wider stroke under it for its
// glow (not shadowBlur), and a dot just ahead of it showing which way it
// goes: dim while it pauses to turn back (the STALKER's tell) and once
// it has stopped.
function drawMarker(r0, r1) {
  const { marker } = dial;
  ctx.lineCap = 'round';
  [[12, 'rgba(' + colours.glow + ', 0.25)'], [4, colours.bright]].forEach(([width, colour]) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(...at(marker.at, r0 - 14));
    ctx.lineTo(...at(marker.at, r1 + 14));
    ctx.stroke();
  });
  ctx.lineCap = 'butt';
  ctx.fillStyle = marker.pause > 0 || dial.result !== null ? colours.muted : colours.bright;
  ctx.beginPath();
  ctx.arc(...at(marker.at + marker.dir * 0.025, r1 + 30), 6, 0, Math.PI * 2);
  ctx.fill();
}
