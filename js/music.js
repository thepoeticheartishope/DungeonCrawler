// Music: the safe room's tune (Jeremy Blake, "Safe Rooms" pack; Timothy
// checked the licence, credits go in at the end). It fades in while the
// player stands in the safe room and fades out when they leave it, or
// when the run's screens go away, under the game's volume (sound.js).
// main.js calls initMusic once. A view: it reads state, never changes it.
//
// The tune is not in the service worker's cache: browsers ask for audio
// in pieces (Range requests), which a cached whole file can't answer on
// some of them (Safari), so offline the room is just quiet.

import { state } from './state.js';
import { SAFE_ROOM_MUSIC } from './config.js';
import { soundOut, soundOff } from './sound.js';

let audio = null;    // the <audio> element, made on first need
let fade = null;     // the tune's own gain, which fades
let playing = false; // whether the tune is (or is fading) up
let pauseAt = null;  // the timer that pauses the element once a fade out ends

// Checks every SAFE_ROOM_MUSIC.checkMs whether the tune should be up, on
// `screens` (the run's). A check on a clock, not on each event, so every
// way in or out (a step, a new floor, the end screen, a hidden tab) goes
// through the same one rule.
export function initMusic(screens) {
  setInterval(() => follow(wanted(screens)), SAFE_ROOM_MUSIC.checkMs);
}

// Whether the tune should be up now: sound not off, a run's screen
// showing (the room, a question, the exchange), the page in view, and the
// player inside the safe room.
function wanted(screens) {
  if (soundOff() || document.hidden) return false;
  if (!screens.some(s => s.classList.contains('show'))) return false;
  const sr = state.floor && state.floor.safeRoom;
  return Boolean(sr && sr.playerIn);
}

// Makes the element, looping, into its own fade gain on the master.
function makeTune(sound) {
  audio = new Audio(SAFE_ROOM_MUSIC.src);
  audio.loop = true;
  audio.preload = 'none';
  fade = sound.ctx.createGain();
  fade.gain.value = 0;
  sound.ctx.createMediaElementSource(audio).connect(fade).connect(sound.out);
}

// Fades the tune up or down to match `on`, from wherever it is now. A
// fade down pauses the element once silent, so a finished fade costs
// nothing.
function follow(on) {
  const sound = soundOut();
  if (!sound || on === playing) return;
  if (!audio) makeTune(sound);
  playing = on;
  clearTimeout(pauseAt);
  if (on) audio.play().catch(() => { playing = false; });
  const ms = on ? SAFE_ROOM_MUSIC.fadeInMs : SAFE_ROOM_MUSIC.fadeOutMs;
  easeTo(sound.ctx, on ? SAFE_ROOM_MUSIC.volume : 0, ms);
  if (!on) pauseAt = setTimeout(() => audio.pause(), ms + 100);
}

// Moves the fade gain to `to` over `ms` along a cosine curve, so it leaves
// and arrives gently instead of at a straight line's sharp corners (the
// fade out was too abrupt, Timothy 2026-11-01). Starts from the gain's
// value now, held where an earlier fade got to.
function easeTo(ctx, to, ms) {
  const g = fade.gain;
  const now = ctx.currentTime;
  const from = g.value;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
  else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
  }
  const n = SAFE_ROOM_MUSIC.fadeSteps;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = from + (to - from) * (1 - Math.cos(Math.PI * i / (n - 1))) / 2;
  g.setValueCurveAtTime(curve, now + 0.01, ms / 1000);
}

// How loud the tune is right now under the game's volume (0 silent or
// not made yet), and whether it is meant to be up. For tests.
export function musicLevel() {
  return { level: fade ? fade.gain.value : 0, playing };
}
