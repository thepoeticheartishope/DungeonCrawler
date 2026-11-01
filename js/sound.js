// Sound: the one AudioContext and the game's master volume, which every
// sound goes through (only the safe room's music, music.js, so far). The
// top bar's SOUND button opens a list (off, 1/3, 2/3, full; SOUND_VOLUME)
// to pick from: a list, not a button that steps, so choosing quiet never
// passes through loud on the way (Timothy 2026-11-01). The pick is
// remembered. main.js calls initSound once with the button and the list;
// music.js asks soundOut() for where to plug in.
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
let list = null;   // the list of levels the button opens

// Reads the remembered volume and shows it on `button`, fills `menu` with
// one choice per level, and waits for the player's first tap or key to
// make the context. Taps on the button or list don't reach the bar under
// them (which would open its extra stats); a tap anywhere else, or Esc,
// closes the list.
export function initSound(button, menu) {
  state.settings.soundStep = rememberedStep();
  label = button.querySelector('#soundLevel');
  list = menu;
  SOUND_VOLUME.steps.forEach((_, step) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.setAttribute('role', 'menuitemradio');
    choice.textContent = stepText(step);
    choice.addEventListener('click', (e) => {
      e.stopPropagation();
      pick(step);
      closeMenu(button, menu);
      button.focus();
    });
    menu.appendChild(choice);
  });
  menu.setAttribute('role', 'menu');
  showStep();
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) openMenu(button, menu);
    else closeMenu(button, menu);
  });
  [button, menu].forEach(el => el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      closeMenu(button, menu);
      button.focus();
    }
  }));
  document.addEventListener('click', () => closeMenu(button, menu));
  const unlock = () => {
    if (!ctx) makeContext();
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// Opens the list with the current level's choice focused.
function openMenu(button, menu) {
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  menu.children[state.settings.soundStep].focus();
}

// Closes the list.
function closeMenu(button, menu) {
  if (menu.hidden) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

// Sets the volume to level `step`, remembers it and shows it.
function pick(step) {
  state.settings.soundStep = step;
  remember();
  showStep();
  setMaster();
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

// Shows the current level on the button and marks it in the list.
function showStep() {
  label.textContent = stepText(state.settings.soundStep);
  [...list.children].forEach((choice, step) => choice.setAttribute('aria-checked', String(step === state.settings.soundStep)));
}

// A level's words: OFF, or the volume in thirds.
function stepText(step) {
  return step === 0 ? t('sound.off') : t('sound.step', { step });
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
