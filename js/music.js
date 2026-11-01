// Music: the game's tunes (config.js MUSIC), one at a time, crossfading
// from one to the next under the game's volume (sound.js):
// - shipIntro on the ship's opening, from the top each new run, once;
// - boss through the final boss, its song the time limit, once;
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

// Each tune once made: { voices: [{ audio, gain }] (one copy of the file
// each, with its own gain; two for a tune with an ending to skip),
// active (the voice playing now), fade (the tune's own gain), up
// (whether it is meant to be up), pauseAt (the timer that pauses it once
// faded out), crossing (whether two voices are crossfading now) }.
const tunes = {};

// Checks every MUSIC_CHECK_MS which tune should be up, from `screens`:
// { intro: the ship's opening, run: [the run's screens] }. A check on a
// clock, not on each event, so every way in or out (a step, taking
// command, a new floor, the end screen, a hidden tab) goes through the
// same one rule. The same check hands a looping tune over to its second
// copy before its ending.
export function initMusic(screens) {
  setInterval(() => {
    follow(wanted(screens));
    const sound = soundOut();
    if (sound) Object.entries(tunes).forEach(([id, tune]) => keepLooping(sound.ctx, tune, MUSIC[id]));
  }, MUSIC_CHECK_MS);
}

// The tune that should be up now ('shipIntro', 'boss', 'safeRoom',
// 'shipWalk'), or null.
function wanted(screens) {
  if (soundOff() || document.hidden) return null;
  if (screens.intro.classList.contains('show')) return 'shipIntro';
  if (!screens.run.some(s => s.classList.contains('show'))) return null;
  const f = state.floor;
  if (state.run.ship && state.run.ship.boss) return 'boss';
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
    const voice = tune.voices[tune.active];
    if (on) {
      if (voice.audio.paused && !music.loop && !music.resume) voice.audio.currentTime = 0;
      voice.audio.play().catch(() => { tune.up = false; });
      easeTo(sound.ctx, tune.fade, music.volume, music.fadeInMs);
      return;
    }
    easeTo(sound.ctx, tune.fade, 0, music.fadeOutMs);
    tune.pauseAt = setTimeout(() => settle(tune), music.fadeOutMs + 100);
  });
}

// Makes a tune: its fade gain on the master, silent, and its voices into
// it. A tune with an ending to skip gets two voices that take turns (no
// built-in loop, which would play the ending); any other looping tune
// one voice with the built-in loop.
function makeTune(sound, music) {
  const fade = sound.ctx.createGain();
  fade.gain.value = 0;
  fade.connect(sound.out);
  const turns = music.loop && music.loopEndS;
  const voices = Array.from({ length: turns ? 2 : 1 }, (_, i) => {
    const audio = new Audio(music.src);
    audio.loop = music.loop && !turns;
    audio.preload = 'none';
    const gain = sound.ctx.createGain();
    gain.gain.value = i === 0 ? 1 : 0;
    sound.ctx.createMediaElementSource(audio).connect(gain).connect(fade);
    return { audio, gain };
  });
  return { voices, active: 0, fade, up: false, pauseAt: null, crossing: false };
}

// While a two-voice tune is up: once the playing voice is `crossfadeS`
// from where its ending starts (or has run out, say after the tab slept),
// the other voice starts from the top and the two crossfade, so the
// ending is never heard. The old voice pauses once silent.
function keepLooping(ctx, tune, music) {
  if (!tune.up || tune.crossing || tune.voices.length < 2) return;
  const now = tune.voices[tune.active];
  const near = !now.audio.paused && now.audio.currentTime >= music.loopEndS - music.crossfadeS;
  if (!near && !now.audio.ended) return;
  const next = tune.voices[1 - tune.active];
  next.audio.currentTime = 0;
  next.audio.play().catch(() => {});
  easeTo(ctx, next.gain, 1, music.crossfadeS * 1000, true);
  easeTo(ctx, now.gain, 0, music.crossfadeS * 1000, true);
  tune.active = 1 - tune.active;
  tune.crossing = true;
  setTimeout(() => {
    now.audio.pause();
    tune.crossing = false;
  }, music.crossfadeS * 1000 + 100);
}

// Once a tune has faded out: every voice paused, the playing one at full
// and any other silent, so it comes back up as one voice.
function settle(tune) {
  tune.voices.forEach((voice, i) => {
    voice.audio.pause();
    voice.gain.gain.cancelScheduledValues(0);
    voice.gain.gain.value = i === tune.active ? 1 : 0;
  });
  tune.crossing = false;
}

// Moves gain node `fade` to `to` over `ms` along a cosine curve, so it
// leaves and arrives gently instead of at a straight line's sharp corners
// (Timothy 2026-11-01). Starts from the gain's value now, held where an
// earlier fade got to. `equalPower` (a loop's two copies crossing) uses a
// quarter sine instead, so the two together stay as loud as one all the
// way through rather than dipping in the middle.
function easeTo(ctx, fade, to, ms, equalPower = false) {
  const g = fade.gain;
  const now = ctx.currentTime;
  const from = g.value;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
  else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
  }
  const curve = new Float32Array(MUSIC_FADE_STEPS);
  for (let i = 0; i < MUSIC_FADE_STEPS; i++) {
    const x = i / (MUSIC_FADE_STEPS - 1);
    const share = !equalPower ? (1 - Math.cos(Math.PI * x)) / 2 : to > from ? Math.sin(Math.PI * x / 2) : 1 - Math.cos(Math.PI * x / 2);
    curve[i] = from + (to - from) * share;
  }
  g.setValueCurveAtTime(curve, now + 0.01, ms / 1000);
}

// Each made tune's loudness now (0 silent), whether it is meant to be up,
// which voice is playing and how far into the file it is (seconds), by
// name. For tests.
export function musicLevel() {
  const out = {};
  Object.entries(tunes).forEach(([id, tune]) => {
    const voice = tune.voices[tune.active];
    out[id] = { level: tune.fade.gain.value, up: tune.up, voice: tune.active, at: voice.audio.currentTime, voices: tune.voices.map(v => v.gain.gain.value) };
  });
  return out;
}
