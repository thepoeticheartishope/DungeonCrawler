// The intro before the first floor: the chosen set's questions (never the
// answers) print down a terminal one line at a time, in random order, then
// the call "REWRITE FALSE BELIEFS." (the bosses are false beliefs) and the
// game starts. main.js startGame calls playIntro; any key or tap skips it.
//
// The glitch is in the typing's rhythm, never in flashing or scrambling
// (Timothy's motion rule): a line stalls partway, drops a few letters that
// fill in a moment later, prints dimmer, or breaks off and starts again.
// Under reduced motion a screen of questions shows at once, holds, and goes.

import {
  INTRO_DURATION_MS, INTRO_CALL_AT_MS, INTRO_STILL_MS, INTRO_TICK_MS, INTRO_CHARS_PER_TICK,
  INTRO_GLITCH_CHANCE, INTRO_STALL_MS, INTRO_GAP_FILL_MS, INTRO_LINES_STILL,
} from './config.js';
import { t } from './text.js';

const screen = document.getElementById('introGlitch');
const log = document.getElementById('introLog');
const call = document.getElementById('introCall');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The intro now playing: its timer and what to do when it ends (view-only,
// so module vars rather than state). Null when no intro is up.
let timer = null;
let finish = null;

// Plays the intro over `questions` (the set's question texts), then calls
// `done` once: after INTRO_DURATION_MS, or straight away on a skip.
export function playIntro(questions, done) {
  log.textContent = '';
  call.textContent = t('intro.call');
  call.classList.remove('show');
  const lines = shuffled(questions.filter(Boolean).map(q => String(q).replace(/\s+/g, ' ').trim()));
  finish = () => {
    clearTimeout(timer);
    timer = null;
    finish = null;
    done();
  };
  if (reducedMotion.matches) {
    lines.slice(0, INTRO_LINES_STILL).forEach(text => addLine(text));
    call.classList.add('show');
    timer = setTimeout(finish, INTRO_STILL_MS);
    return;
  }
  const start = performance.now();
  typeLines(lines, start);
  timer = setTimeout(finish, INTRO_DURATION_MS);
}

// Ends the intro now (a key or a tap). The key is used up, so the room
// screen's own key handler doesn't also move the player with it.
function skipIntro(e) {
  if (!finish || !screen.classList.contains('show')) return;
  e.preventDefault();
  finish();
}
document.addEventListener('keydown', skipIntro);
screen.addEventListener('click', skipIntro);

// Types question after question until INTRO_CALL_AT_MS, cutting off
// whatever line is half typed then, and shows the call.
function typeLines(lines, start) {
  let index = 0;
  const next = () => {
    if (!finish) return;
    if (performance.now() - start >= INTRO_CALL_AT_MS || index >= lines.length) {
      call.classList.add('show');
      return;
    }
    typeOne(lines[index++], next, start);
  };
  next();
}

// Types one line a few letters per tick, with at most one glitch (chance
// INTRO_GLITCH_CHANCE): `stall` pauses partway, `gaps` leaves a few letters
// blank and fills them in INTRO_GAP_FILL_MS later, `dim` prints it fainter,
// `restart` breaks off partway and types the line again from the start.
// Calls `then` when the line is done.
function typeOne(text, then, start) {
  const glitch = Math.random() < INTRO_GLITCH_CHANCE
    ? ['stall', 'gaps', 'dim', 'restart'][Math.floor(Math.random() * 4)]
    : null;
  const line = addLine('', glitch === 'dim');
  const breakAt = Math.floor(text.length * (0.3 + Math.random() * 0.4));
  const gaps = glitch === 'gaps' ? gapSpots(text) : new Set();
  const shown = [...text].map((ch, i) => (gaps.has(i) ? ' ' : ch)).join('');
  let typed = 0;
  let stalled = false;
  const tick = () => {
    if (!finish) return;
    if (performance.now() - start >= INTRO_CALL_AT_MS) { then(); return; }
    if (glitch === 'restart' && typed >= breakAt) {
      typeOne(text, then, start);
      return;
    }
    if (glitch === 'stall' && !stalled && typed >= breakAt) {
      stalled = true;
      timer = setTimeout(tick, INTRO_STALL_MS);
      return;
    }
    typed = Math.min(text.length, typed + INTRO_CHARS_PER_TICK);
    line.textContent = shown.slice(0, typed);
    if (typed < text.length) {
      timer = setTimeout(tick, INTRO_TICK_MS);
      return;
    }
    if (gaps.size) setTimeout(() => { line.textContent = text; }, INTRO_GAP_FILL_MS);
    then();
  };
  tick();
}

// Two to four letters (never spaces) to leave blank in a `gaps` line.
function gapSpots(text) {
  const letters = [...text].map((ch, i) => (ch === ' ' ? -1 : i)).filter(i => i >= 0);
  const count = Math.min(letters.length, 2 + Math.floor(Math.random() * 3));
  return new Set(shuffled(letters).slice(0, count));
}

// A new line at the bottom of the log; old lines rise and leave the top.
function addLine(text, dim = false) {
  const line = document.createElement('div');
  line.className = dim ? 'intro-line intro-dim' : 'intro-line';
  line.textContent = text;
  log.appendChild(line);
  return line;
}

// A shuffled copy (the intro's own, so it never touches the run's order).
function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
