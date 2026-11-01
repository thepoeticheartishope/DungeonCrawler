// Sound: the one AudioContext and the game's master volume, which every
// sound goes through (only the safe room's music, music.js, so far). The
// top bar's SOUND button steps the volume off, 1/3, 2/3, full
// (SOUND_VOLUME); the pick is remembered. main.js calls initSound once
// with the button; music.js asks soundOut() for where to plug in.
//
// Browsers only let a page make sound after the player's first tap or
// key, so the context is made then. A Web Audio gain, not an element's
// volume, because phones (iOS) ignore an element's own volume.

import { state } from './state.js';
import { SOUND_VOLUME } from './config.js';
import { t } from './text.js';

let ctx = null;    // the AudioContext, made after the first tap or key
let master = null; // the master volume's gain node
let label = null;  // the button's level text

// Reads the remembered volume, shows it on `button`, makes a tap on it
// step the volume (without opening the bar's extra stats), and waits for
// the player's first tap or key to make the context.
export function initSound(button) {
  state.settings.soundStep = rememberedStep();
  label = button.querySelector('#soundLevel');
  showStep();
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    state.settings.soundStep = (state.settings.soundStep + 1) % SOUND_VOLUME.steps.length;
    remember();
    showStep();
    setMaster();
  });
  button.addEventListener('keydown', e => e.stopPropagation());
  const unlock = () => {
    if (!ctx) makeContext();
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// Where a sound plugs in (the master gain) and its context, or null before
// the player's first tap or key.
export function soundOut() {
  return ctx ? { ctx, out: master } : null;
}

// Whether the game's volume is off, so a sound need not play at all.
export function soundOff() {
  return SOUND_VOLUME.steps[state.settings.soundStep] === 0;
}

// Makes the context and the master gain at the player's volume.
function makeContext() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = SOUND_VOLUME.steps[state.settings.soundStep];
  master.connect(ctx.destination);
}

// Moves the master gain to the player's volume over a moment, so a tap
// doesn't click.
function setMaster() {
  if (!ctx) return;
  master.gain.setTargetAtTime(SOUND_VOLUME.steps[state.settings.soundStep], ctx.currentTime, SOUND_VOLUME.changeMs / 3000);
}

// The button's text: OFF, or the volume in thirds.
function showStep() {
  const step = state.settings.soundStep;
  label.textContent = step === 0 ? t('sound.off') : t('sound.step', { step });
}

// The remembered volume step, or SOUND_VOLUME.startAt if none (or storage
// is unavailable).
function rememberedStep() {
  try {
    const step = Number(localStorage.getItem(SOUND_VOLUME.storageKey));
    const known = localStorage.getItem(SOUND_VOLUME.storageKey) !== null && Number.isInteger(step) && step >= 0 && step < SOUND_VOLUME.steps.length;
    return known ? step : SOUND_VOLUME.startAt;
  } catch (e) {
    return SOUND_VOLUME.startAt;
  }
}

// Saves the volume step; without storage it lasts this session only.
function remember() {
  try {
    localStorage.setItem(SOUND_VOLUME.storageKey, String(state.settings.soundStep));
  } catch (e) {
    // Storage unavailable: the volume still works until the page closes.
  }
}
