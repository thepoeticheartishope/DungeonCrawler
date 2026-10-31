// The ship's opening (ship plan step C; Timothy 2026-10-30: the tragedy is
// told after the splash screen): the run's random tragedy (ship.js
// rollTragedy) a line at a time, slowly, then TAKE COMMAND. Lines fade in
// one after another; under reduced motion they are all there at once.
// main.js startGame shows it and passes in what TAKE COMMAND does
// (initShipIntro). This only draws and listens.

import { t } from './text.js';
import { SHIP_INTRO_STEP_S } from './config.js';

const els = {};
let begin = () => {};

// Looks up the intro's elements and hooks up TAKE COMMAND. Call once, from main.js.
export function initShipIntro({ onBegin }) {
  begin = onBegin;
  els.screen = document.getElementById('shipIntroScreen');
  els.lines = document.getElementById('shipIntroLines');
  els.go = document.getElementById('shipIntroGo');
  els.go.addEventListener('click', () => begin());
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
}
