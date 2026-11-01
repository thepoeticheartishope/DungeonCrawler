// Music: the game's tunes (config.js MUSIC), one at a time, crossfading
// from one to the next under the game's volume (sound.js):
// - shipIntro on the ship's opening, from the top each new run, once;
// - safeRoom while the player stands in the safe room (the room, a
//   question or the exchange on screen), looping;
// - shipWalk on the ship anywhere outside its safe room (Command),
//   looping, so crossing Command's doorway crossfades the two.
// Taking command crosses straight from the opening's tune into the safe
// room's, since the ship starts in Command, its safe room. Anything else
// (start, win, lose, a hidden tab, sound off) fades the music out.
// main.js calls initMusic once. A view: it reads state, never changes it.
//
// The tunes are not in the service worker's cache: browsers ask for audio
// in pieces (Range requests), which a cached whole file can't answer on
// some of them (Safari), so offline the game is just quiet.

import { state } from './state.js';
import { MUSIC, MUSIC_FADE_STEPS, MUSIC_CHECK_MS } from './config.js';
import { soundOut, soundOff } from './sound.js';

// Each tune once made: { audio, fade (its own gain), up (whether it is
// meant to be up), pauseAt (the timer that pauses it once faded out) }.
const tunes = {};

// Checks every MUSIC_CHECK_MS which tune should be up, from `screens`:
// { intro: the ship's opening, run: [the run's screens] }. A check on a
// clock, not on each event, so every way in or out (a step, taking
// command, a new floor, the end screen, a hidden tab) goes through the
// same one rule.
export function initMusic(screens) {
  setInterval(() => follow(wanted(screens)), MUSIC_CHECK_MS);
}

// The tune that should be up now ('shipIntro', 'safeRoom', 'shipWalk'),
// or null.
function wanted(screens) {
  if (soundOff() || document.hidden) return null;
  if (screens.intro.classList.contains('show')) return 'shipIntro';
  if (!screens.run.some(s => s.classList.contains('show'))) return null;
  const f = state.floor;
  if (f && f.safeRoom && f.safeRoom.playerIn) return 'safeRoom';
  return f && f.ship ? 'shipWalk' : null;
}

// Brings `name` up and every other tune down, each along its own fade, so
// a change of tune is a crossfade.
function follow(name) {
  const sound = soundOut();
  if (!sound) return;
  if (name && !tunes[name]) tunes[name] = makeTune(sound, MUSIC[name]);
  Object.entries(tunes).forEach(([id, tune]) => {
    const on = id === name;
    if (on === tune.up) return;
    tune.up = on;
    clearTimeout(tune.pauseAt);
    const music = MUSIC[id];
    if (on) {
      if (tune.audio.paused && !music.loop) tune.audio.currentTime = 0;
      tune.audio.play().catch(() => { tune.up = false; });
      easeTo(sound.ctx, tune.fade, music.volume, music.fadeInMs);
      return;
    }
    easeTo(sound.ctx, tune.fade, 0, music.fadeOutMs);
    tune.pauseAt = setTimeout(() => tune.audio.pause(), music.fadeOutMs + 100);
  });
}

// Makes a tune's element into its own fade gain on the master, silent.
function makeTune(sound, music) {
  const audio = new Audio(music.src);
  audio.loop = music.loop;
  audio.preload = 'none';
  const fade = sound.ctx.createGain();
  fade.gain.value = 0;
  sound.ctx.createMediaElementSource(audio).connect(fade).connect(sound.out);
  return { audio, fade, up: false, pauseAt: null };
}

// Moves `fade` to `to` over `ms` along a cosine curve, so it leaves and
// arrives gently instead of at a straight line's sharp corners (Timothy
// 2026-11-01). Starts from the gain's value now, held where an earlier
// fade got to.
function easeTo(ctx, fade, to, ms) {
  const g = fade.gain;
  const now = ctx.currentTime;
  const from = g.value;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
  else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
  }
  const curve = new Float32Array(MUSIC_FADE_STEPS);
  for (let i = 0; i < MUSIC_FADE_STEPS; i++) curve[i] = from + (to - from) * (1 - Math.cos(Math.PI * i / (MUSIC_FADE_STEPS - 1))) / 2;
  g.setValueCurveAtTime(curve, now + 0.01, ms / 1000);
}

// Each made tune's loudness now (0 silent) and whether it is meant to be
// up, by name, and how far into its file it is (seconds). For tests.
export function musicLevel() {
  const out = {};
  Object.entries(tunes).forEach(([id, tune]) => { out[id] = { level: tune.fade.gain.value, up: tune.up, at: tune.audio.currentTime }; });
  return out;
}
