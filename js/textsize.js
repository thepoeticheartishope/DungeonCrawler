// Text size: the top bar's TEXT button, beside SOUND, opens a list of
// sizes (TEXT_SIZE.steps, a share of the game's own sizes) to pick from,
// so a player (Timothy 2026-11-01: to find exactly where text feels
// smushed) can make all the game's text bigger or smaller. Every
// font-size in index.html is its own px times var(--text-scale), set
// here on the page's root; at 100% the game looks as before. Text drawn
// on a canvas (the map's letters, the dial, words in the room) keeps its
// own size. The pick is remembered. main.js calls initTextSize once with
// the button and the list.

import { TEXT_SIZE } from './config.js';
import { t } from './text.js';

let current = TEXT_SIZE.startAt; // the step picked
let label = null; // the button's size text
let list = null;  // the list of sizes the button opens

// Reads the remembered size and applies it, fills `menu` with one choice
// per size. Taps on the button or list don't reach the bar under them; a
// tap anywhere else, or Esc, closes the list.
export function initTextSize(button, menu) {
  current = rememberedStep();
  label = button.querySelector('#textSizeLevel');
  list = menu;
  TEXT_SIZE.steps.forEach((_, step) => {
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
  apply();
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
}

// The text scale picked, as a share of the game's own sizes (1 = 100%).
export function textScale() {
  return TEXT_SIZE.steps[current];
}

function openMenu(button, menu) {
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  menu.children[current].focus();
}

function closeMenu(button, menu) {
  if (menu.hidden) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

// Sets size `step`, remembers it and applies it.
function pick(step) {
  current = step;
  remember();
  apply();
}

// Sets the scale on the page and shows it on the button and in the list.
// Screens sized to their text (the room, the map) hear a resize.
function apply() {
  document.documentElement.style.setProperty('--text-scale', String(textScale()));
  label.textContent = stepText(current);
  [...list.children].forEach((choice, step) => choice.setAttribute('aria-checked', String(step === current)));
  window.dispatchEvent(new Event('resize'));
}

// A size's words: its percent.
function stepText(step) {
  return t('textSize.step', { pct: Math.round(TEXT_SIZE.steps[step] * 100) });
}

// The step of the remembered scale, or TEXT_SIZE.startAt if none, not a
// size any more, or storage is unavailable.
function rememberedStep() {
  try {
    const raw = localStorage.getItem(TEXT_SIZE.storageKey);
    const step = raw === null ? -1 : TEXT_SIZE.steps.indexOf(Number(raw));
    return step >= 0 ? step : TEXT_SIZE.startAt;
  } catch (e) {
    return TEXT_SIZE.startAt;
  }
}

// Saves the scale (not the step: adding sizes never shifts a pick); without storage it lasts this session only.
function remember() {
  try {
    localStorage.setItem(TEXT_SIZE.storageKey, String(TEXT_SIZE.steps[current]));
  } catch (e) {
    // Storage unavailable: the size still works until the page closes.
  }
}
