// Music: the safe room's tune (Jeremy Blake, "Safe Rooms" pack; Timothy
// checked the licence, credits go in at the end). It fades in while the
// player stands in the safe room and fades out when they leave it, or
// when the run's screens go away. main.js calls initMusic once. A view:
// it reads state and never changes it.
//
// The tune plays through an <audio> element routed into a Web Audio gain,
// because phones (iOS) ignore an element's own volume, so a fade has to
// go through the gain. It is not in the service worker's cache: browsers
// ask for audio in pieces (Range requests), which a cached whole file
// can't answer on some of them, so offline the room is just quiet.

import { state } from './state.js';
import { SAFE_ROOM_MUSIC } from './config.js';

let audio = null;   // the <audio> element, made on first need
let ctx = null;     // the AudioContext, made after the player's first tap or key
let gain = null;    // the fade's gain node
let playing = false; // whether the tune is (or is fading) up

// Starts listening for the player's first tap or key (browsers only let a
// page make sound after one), then checks every SAFE_ROOM_MUSIC.checkMs
// whether the tune should be up. A check on a clock, not on each event,
// so every way in or out (a step, a new floor, the end screen, a hidden
// tab) is caught by the same one rule.
export function initMusic(screens) {
  const unlock = () => {
    if (!ctx) makeSound();
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  setInterval(() => follow(wanted(screens)), SAFE_ROOM_MUSIC.checkMs);
}

// Whether the tune should be up now: sound on, a run's screen showing
// (the room, a question, the exchange), the page in view, and the player
// inside the safe room.
function wanted(screens) {
  if (!state.settings.sound || document.hidden) return false;
  if (!screens.some(s => s.classList.contains('show'))) return false;
  const sr = state.floor && state.floor.safeRoom;
  return Boolean(sr && sr.playerIn);
}

// Makes the element, the context and the gain, silent, looping.
function makeSound() {
  audio = new Audio(SAFE_ROOM_MUSIC.src);
  audio.loop = true;
  audio.preload = 'none';
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
}

// Fades the tune up or down to match `on`. Fading down pauses the element
// once it is silent, so a finished fade costs nothing.
function follow(on) {
  if (!ctx || on === playing) return;
  playing = on;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  if (on) {
    audio.play().catch(() => { playing = false; });
    gain.gain.linearRampToValueAtTime(SAFE_ROOM_MUSIC.volume, now + SAFE_ROOM_MUSIC.fadeInMs / 1000);
    return;
  }
  gain.gain.linearRampToValueAtTime(0, now + SAFE_ROOM_MUSIC.fadeOutMs / 1000);
  setTimeout(() => { if (!playing) audio.pause(); }, SAFE_ROOM_MUSIC.fadeOutMs + 50);
}

// How loud the tune is right now, 0 (silent or not made yet) to
// SAFE_ROOM_MUSIC.volume, and whether it is meant to be up. For tests.
export function musicLevel() {
  return { level: gain ? gain.gain.value : 0, playing };
}
