// The intro before the first floor: the chosen set's questions (never the
// answers) print down a terminal one line at a time, in random order. Then
// one question is answered by a fake player, slowly, and wrong: REJECTED.
// The screen fades to "LEARN AND REWRITE FALSE BELIEFS." and the game
// starts. The beat is Timothy's: the player is afraid of getting it wrong,
// but they will get it right (the bosses are false beliefs). main.js
// startGame calls playIntro; any key or tap skips it.
//
// The glitch is in the typing's rhythm, never in flashing or scrambling
// (Timothy's motion rule): a line stalls partway, drops a few letters that
// fill in a moment later, prints dimmer, or breaks off and starts again.
// Under reduced motion the whole screen shows at once, holds, and goes.

import {
  INTRO_ASK_AT_MS, INTRO_STILL_MS, INTRO_TICK_MS, INTRO_CHARS_PER_TICK,
  INTRO_GLITCH_CHANCE, INTRO_STALL_MS, INTRO_GAP_FILL_MS, INTRO_LINES_STILL,
  INTRO_HESITATE_MS, INTRO_ANSWER_CHAR_MS, INTRO_ANSWER_MAX_MS, INTRO_VERDICT_MS, INTRO_FADE_AFTER_MS, INTRO_FADE_MS, INTRO_CALL_HOLD_MS,
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

// Plays the intro, then calls `done` once: after the call has shown for
// INTRO_CALL_HOLD_MS, or straight away on a skip. `questions` are the
// set's question texts; `attempt` is { question, answer }, the one the
// fake player answers wrong.
export function playIntro({ questions, attempt }, done) {
  log.textContent = '';
  log.classList.remove('fading');
  call.textContent = t('intro.call');
  call.classList.remove('show');
  const lines = shuffled(questions.filter(Boolean).map(oneLine)).filter(q => q !== oneLine(attempt.question));
  finish = () => {
    clearTimeout(timer);
    timer = null;
    finish = null;
    done();
  };
  if (reducedMotion.matches) {
    lines.slice(0, INTRO_LINES_STILL).forEach(text => addLine(text));
    addLine(oneLine(attempt.question));
    addLine(attempt.answer, 'intro-answer');
    addLine(t('intro.rejected'), 'intro-verdict');
    log.classList.add('fading');
    call.classList.add('show');
    timer = setTimeout(finish, INTRO_STILL_MS);
    return;
  }
  typeLines(lines, performance.now(), () => askAndMiss(attempt));
}

// The fake player's try: the question types out, a pause, the answer goes
// in slowly a letter at a time, then REJECTED. A moment later everything
// fades and the call shows.
function askAndMiss(attempt) {
  typeOne(oneLine(attempt.question), () => {
    const line = addLine('', 'intro-answer');
    // A long answer types faster, so the try never takes more than INTRO_ANSWER_MAX_MS.
    const keyMs = Math.min(INTRO_ANSWER_CHAR_MS, INTRO_ANSWER_MAX_MS / Math.max(1, attempt.answer.length));
    let typed = 0;
    const key = () => {
      if (!finish) return;
      typed++;
      line.textContent = attempt.answer.slice(0, typed);
      if (typed < attempt.answer.length) { timer = setTimeout(key, keyMs); return; }
      timer = setTimeout(rejected, INTRO_VERDICT_MS);
    };
    timer = setTimeout(key, INTRO_HESITATE_MS);
  }, null, false);
}

// REJECTED. (the word a miss shows in the game), then the fade to the call.
function rejected() {
  addLine(t('intro.rejected'), 'intro-verdict');
  timer = setTimeout(() => {
    log.classList.add('fading');
    timer = setTimeout(() => {
      call.classList.add('show');
      timer = setTimeout(finish, INTRO_CALL_HOLD_MS);
    }, INTRO_FADE_MS);
  }, INTRO_FADE_AFTER_MS);
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

// Types question after question until INTRO_ASK_AT_MS, cutting off
// whatever line is half typed then, and calls `then`.
function typeLines(lines, start, then) {
  const deadline = start + INTRO_ASK_AT_MS;
  let index = 0;
  const next = () => {
    if (!finish) return;
    if (performance.now() >= deadline || index >= lines.length) { then(); return; }
    typeOne(lines[index++], next, deadline);
  };
  next();
}

// Types one line a few letters per tick, with at most one glitch (chance
// INTRO_GLITCH_CHANCE): `stall` pauses partway, `gaps` leaves a few letters
// blank and fills them in INTRO_GAP_FILL_MS later, `dim` prints it fainter,
// `restart` breaks off partway and types the line again from the start.
// Calls `then` when the line is done, or when `deadline` (a
// performance.now() time, or null for none) cuts it off. `glitches` false
// types it clean.
function typeOne(text, then, deadline, glitches = true) {
  const glitch = glitches && Math.random() < INTRO_GLITCH_CHANCE
    ? ['stall', 'gaps', 'dim', 'restart'][Math.floor(Math.random() * 4)]
    : null;
  const line = addLine('', glitch === 'dim' ? 'intro-dim' : '');
  const breakAt = Math.floor(text.length * (0.3 + Math.random() * 0.4));
  const gaps = glitch === 'gaps' ? gapSpots(text) : new Set();
  const shown = [...text].map((ch, i) => (gaps.has(i) ? ' ' : ch)).join('');
  let typed = 0;
  let stalled = false;
  const tick = () => {
    if (!finish) return;
    if (deadline && performance.now() >= deadline) { then(); return; }
    if (glitch === 'restart' && typed >= breakAt) {
      typeOne(text, then, deadline);
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

// A question as one line of text.
function oneLine(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

// A new line at the bottom of the log, with an extra class if given
// (intro-dim, intro-answer, intro-verdict); old lines rise and leave the top.
function addLine(text, cls = '') {
  const line = document.createElement('div');
  line.className = cls ? 'intro-line ' + cls : 'intro-line';
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
