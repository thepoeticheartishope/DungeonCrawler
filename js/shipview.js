// The ship's opening (ship plan step C; Timothy 2026-10-30: the tragedy is
// told after the splash screen): the run's random tragedy (ship.js
// rollTragedy) a line at a time, slowly, then TAKE COMMAND. Lines fade in
// one after another; under reduced motion they are all there at once.
// Like the normal intro it can be clicked through (Timothy 2026-10-31): a
// tap or key while lines are still coming puts them all up at once, and
// once all are up a tap anywhere or any key takes command.
// Left alone, it takes command by itself after SHIP_INTRO_AUTO_S, as its
// tune ends (music.js; Timothy 2026-11-01).
// main.js startGame shows it and passes in what TAKE COMMAND does
// (initShipIntro). This only draws and listens.

import { t } from './text.js';
import { SHIP_INTRO_STEP_S, SHIP_INTRO_FADE_S, SHIP_INTRO_AUTO_S } from './config.js';

const els = {};
let begin = () => {};
// When the last line (TAKE COMMAND) has fully faded in, in
// performance.now() ms; 0 once the player has put every line up.
let allInAt = 0;
// The timer that takes command by itself when the tune ends.
let autoAt = null;

// Looks up the intro's elements and hooks up TAKE COMMAND. Call once, from main.js.
export function initShipIntro({ onBegin }) {
  begin = onBegin;
  els.screen = document.getElementById('shipIntroScreen');
  els.lines = document.getElementById('shipIntroLines');
  els.go = document.getElementById('shipIntroGo');
  els.go.addEventListener('click', takeCommand);
  els.screen.addEventListener('click', e => { if (e.target !== els.go) skipOrBegin(e); });
  document.addEventListener('keydown', skipOrBegin);
}

// TAKE COMMAND, once: only while the intro is showing, so a tap that
// bubbles up or a held key can't start the ship twice.
function takeCommand() {
  if (!els.screen.classList.contains('show')) return;
  clearTimeout(autoAt);
  begin();
}

// A tap or key on the intro: lines still coming in all show at once;
// with every line up it takes command. The key is used up, so the room's
// own key handler doesn't also move the player with it.
function skipOrBegin(e) {
  if (!els.screen.classList.contains('show')) return;
  e.preventDefault();
  if (performance.now() >= allInAt) { takeCommand(); return; }
  allInAt = 0;
  els.screen.classList.add('all-in');
}

// The tragedy as the intro's lines, from `tragedy` (ship.js rollTragedy).
export function tragedyLines(tragedy) {
  const names = {
    captain: t('tragedy.captain.' + tragedy.captain),
    cause: t('tragedy.cause.' + tragedy.cause),
    ship: t('tragedy.ship.' + tragedy.ship),
    planet: t('tragedy.planet.' + tragedy.planet),
  };
  return [
    t('tragedy.day', { day: tragedy.day }),
    t('tragedy.died', names),
    t('tragedy.alone'),
    t('tragedy.mission', names),
    t('tragedy.how'),
  ];
}

// Fills the intro with `lines`, each fading in after the one before
// (CSS --d), TAKE COMMAND last. The caller shows the screen.
export function fillShipIntro(lines) {
  els.lines.innerHTML = '';
  lines.forEach((line, i) => {
    const p = document.createElement('p');
    p.className = 'ship-intro-line' + (i === lines.length - 1 ? ' small' : '');
    p.style.setProperty('--d', (i * SHIP_INTRO_STEP_S) + 's');
    p.textContent = line;
    els.lines.appendChild(p);
  });
  els.go.style.setProperty('--d', (lines.length * SHIP_INTRO_STEP_S) + 's');
  els.screen.classList.remove('all-in');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  allInAt = still ? 0 : performance.now() + (lines.length * SHIP_INTRO_STEP_S + SHIP_INTRO_FADE_S) * 1000;
  clearTimeout(autoAt);
  autoAt = setTimeout(takeCommand, SHIP_INTRO_AUTO_S * 1000);
}
