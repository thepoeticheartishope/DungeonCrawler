// Furniture drawn from PNGs (room sprites plan step B,
// ideas/room-sprites-plan.md outside the repo; Timothy 2026-11-06):
// sprites/sprites.json names a PNG for a piece, and roomthings.js draws that
// picture instead of the piece's code art. Any name works, so a new piece
// needs only a PNG, a line in sprites.json and a spot in rooms/ship.json.
// A missing or broken file or PNG falls back to the code art and DEV says
// so; it never leaves a gap and never stops the game. main.js calls
// loadSprites() once at start, before the ship is drawn.

import { ROOM_VIEW, FURNITURE_SPRITES } from './config.js';
import { devWarn } from './rooms.js';

const T = ROOM_VIEW.tilePx;
const loaded = new Map();   // piece name -> { image, parts, tall }

// Why a sprite of `width` x `height` px can't be used for piece `name`
// (entry = its sprites.json line), or null when it fits: one tile wide (or
// one tile a frame with `parts`), at most FURNITURE_SPRITES.maxTall tall.
export function spriteProblem(name, entry, width, height) {
  const wide = T * (entry.parts ? FURNITURE_SPRITES.frames.length : 1);
  if (width !== wide) return name + ': ' + entry.src + ' is ' + width + ' px wide, should be ' + wide;
  if (height < 1 || height > FURNITURE_SPRITES.maxTall) return name + ': ' + entry.src + ' is ' + height + ' px tall, should be 1 to ' + FURNITURE_SPRITES.maxTall;
  return null;
}

// The pieces in sprites.json that have a usable line ({ src: 'sprites/x.png' },
// optional parts: true), as [name, entry] pairs, and warnings for the rest.
export function spriteEntries(data) {
  if (!data || typeof data.pieces !== 'object' || data.pieces === null) return { entries: [], warnings: ['sprites.json has no "pieces"; all furniture is code art'] };
  const entries = [];
  const warnings = [];
  Object.entries(data.pieces).forEach(([name, entry]) => {
    if (entry && typeof entry.src === 'string' && entry.src !== '') entries.push([name, entry]);
    else warnings.push(name + ': no "src"; drawn as code art');
  });
  return { entries, warnings };
}

// Loads one PNG; resolves with the image, or null (and a DEV warning) when
// it is missing, broken or the wrong size.
function loadOne(name, entry) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const problem = spriteProblem(name, entry, image.naturalWidth, image.naturalHeight);
      if (problem) { devWarn(problem + '; drawn as code art'); resolve(null); return; }
      resolve(image);
    };
    image.onerror = () => { devWarn(name + ': ' + entry.src + ' not loaded; drawn as code art'); resolve(null); };
    image.src = entry.src;
  });
}

// Fetches sprites.json and loads every PNG it names. On any failure the
// pieces keep their code art.
export async function loadSprites() {
  try {
    const res = await fetch(FURNITURE_SPRITES.file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { entries, warnings } = spriteEntries(await res.json());
    warnings.forEach(devWarn);
    const images = await Promise.all(entries.map(([name, entry]) => loadOne(name, entry)));
    entries.forEach(([name, entry], i) => {
      if (images[i]) loaded.set(name, { image: images[i], parts: !!entry.parts, tall: images[i].naturalHeight });
    });
  } catch (err) {
    devWarn(FURNITURE_SPRITES.file + ' not loaded (' + err.message + '); all furniture is code art');
  }
}

// The loaded sprite for `piece`, or undefined (draw the code art).
export function spriteFor(piece) {
  return loaded.get(piece);
}
