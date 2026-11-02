// Sound effects: short sounds for what the player just did (config.js
// SFX), under the game's volume (sound.js), so SOUND OFF silences them
// too. For now a right answer's soft "good" and a wrong one's "wrong"
// (Timothy 2026-11-01: questions gave little feedback): an option marked
// in the book (questionview.js markAnswer) and a minigame's result
// (minigameview.js finish).
//
// Each sound is fetched and decoded once, whole (so the service worker can
// cache it, unlike the music), the first time the player taps or presses
// a key; one asked for before it is ready plays when it is.

import { SFX } from './config.js';
import { soundOut, soundOff } from './sound.js';

const buffers = {}; // name -> Promise of its decoded AudioBuffer

// Starts loading every sound at the player's first tap or key, when the
// game's audio context exists (sound.js makes it on the same event).
export function initSfx() {
  const preload = () => {
    if (!soundOut()) return;
    Object.keys(SFX.sounds).forEach(load);
    window.removeEventListener('pointerup', preload);
    window.removeEventListener('keyup', preload);
  };
  window.addEventListener('pointerup', preload);
  window.addEventListener('keyup', preload);
}

// Plays sound `name` (a key of SFX.sounds) once, unless the sound is off.
export function playSfx(name) {
  if (soundOff() || !SFX.sounds[name]) return;
  const sound = soundOut();
  if (!sound) return;
  load(name).then((buffer) => {
    if (!buffer || soundOff()) return;
    const source = sound.ctx.createBufferSource();
    const gain = sound.ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = SFX.sounds[name].volume;
    source.connect(gain).connect(sound.out);
    source.start();
  });
}

// Sound `name`'s decoded buffer, fetched once (null if it can't be had).
function load(name) {
  if (!buffers[name]) {
    const sound = soundOut();
    buffers[name] = !sound ? Promise.resolve(null) : fetch(SFX.sounds[name].src)
      .then(r => r.arrayBuffer())
      .then(data => new Promise((resolve, reject) => sound.ctx.decodeAudioData(data, resolve, reject)))
      .catch(() => { delete buffers[name]; return null; });
  }
  return buffers[name];
}
