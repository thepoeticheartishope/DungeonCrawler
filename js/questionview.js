// The question panel (gun plan step 5): one question with its answer
// options, image, and the modifiers it carries (Blind, Flip, Timer, the
// Gambler's wager). There is one panel, #queryPanel, and it is mounted
// where it is needed: the battle screen (main.js) or the panel over the
// map (gunpanels.js). Whoever mounts it passes the handlers that decide
// what an answer means, so the battle screen and a reload share the same
// drawing. Sets state.battle.currentQuestion / currentChoices / wager.
import { state } from './state.js';
import { BLIND_BASE_MS, BLIND_MS_PER_WORD, BLIND_MAX_MS, TIMER_SECONDS } from './config.js';
import { rollFlip, maxWager } from './modifiers.js';
import { escapeHtml, buildChoices, resolveImageSrc } from './quiz.js';
import { t } from './text.js';

const queryPanel = document.getElementById('queryPanel');
const enemyName = document.getElementById('enemyName');
const queryImage = document.getElementById('queryImage');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const wagerRow = document.getElementById('wagerRow');
const wagerButtons = document.getElementById('wagerButtons');
const modTimerEl = document.getElementById('modTimer');

// What the current host does with the panel's input: onChoice(option) for
// a tapped option, onTyped(raw) for a typed answer, onTimeout() when the
// Timer runs out on the question still showing, log(text, kind) for the
// modifier and wager lines.
let handlers = { onChoice() {}, onTyped() {}, onTimeout() {}, log() {} };

// Moves the question panel into `host` and hands its input to `next`
// (see `handlers`), shown. Mounting where it already is just swaps the
// handlers. The battle screen hides it again between questions
// (main.js showBattlePhase).
export function mountQuestionPanel(host, next) {
  handlers = next;
  if (queryPanel.parentElement !== host) host.appendChild(queryPanel);
  queryPanel.hidden = false;
}

// Draws state.battle.currentChoices as lettered option buttons.
function renderChoices() {
  const letters = ['A', 'B', 'C', 'D'];
  mcOptionsEl.innerHTML = '';
  state.battle.currentChoices.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option';
    btn.innerHTML = '<span class="letter">' + letters[i] + '</span><span class="opt-text">' + escapeHtml(opt) + '</span>';
    btn.addEventListener('click', () => handlers.onChoice(opt));
    mcOptionsEl.appendChild(btn);
  });
}

// Types `text` into `el` one character at a time, terminal-style, instead
// of setting it all at once. Cancels any typing already in progress on
// that element first, so rapid-fire question changes (a quick correct
// answer against the boss, say) never leave two runs racing each other.
const typewriterTimers = new WeakMap();
// A fixed per-character delay made short answers ("CPU") finish in ~50ms —
// too fast to read as typing at all. Instead, aim for a roughly constant
// total reveal time and derive the per-character delay from the string's
// length, clamped so short strings type slowly enough to notice and long
// ones don't drag.
function typeText(el, text, targetDurationMs = 450) {
  const speedMs = Math.min(140, Math.max(12, targetDurationMs / Math.max(text.length, 1)));
  const existing = typewriterTimers.get(el);
  if (existing) clearInterval(existing);
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(timer);
      typewriterTimers.delete(el);
    }
  }, speedMs);
  typewriterTimers.set(el, timer);
}

// ---- Question modifiers (see modifiers.js) ----
// A category offered in a fight may carry one; it applies to the question
// asked once that category is picked, and is cleared by the next question.
let blindTimer = null;
let countdownTimer = null;

// Ends whatever modifier the last question carried: timers, the wager,
// the hidden answers.
export function clearModifier() {
  clearTimeout(blindTimer);
  blindTimer = null;
  clearInterval(countdownTimer);
  countdownTimer = null;
  modTimerEl.hidden = true;
  modTimerEl.classList.remove('urgent');
  state.battle.wager = 0;
  mcOptionsEl.classList.remove('mod-blind');
  wagerRow.hidden = true;
  wagerButtons.innerHTML = '';
}

// Puts `modifier` on the question now showing. A reload offer or a fight
// choice may carry two; each is applied in turn.
export function applyModifier(modifier) {
  handlers.log(t('log.modifier', { name: t('mod.' + modifier) }), 'sys');
  const buttons = [...mcOptionsEl.querySelectorAll('.mc-option')];
  if (modifier === 'blind') {
    // Longer answers stay readable for longer.
    const words = state.battle.currentChoices.reduce((n, opt) => n + opt.trim().split(/\s+/).length, 0);
    const ms = Math.min(BLIND_MAX_MS, BLIND_BASE_MS + BLIND_MS_PER_WORD * words);
    blindTimer = setTimeout(() => mcOptionsEl.classList.add('mod-blind'), ms);
  } else if (modifier === 'flip') {
    const { slots, mode } = rollFlip(buttons.length);
    buttons.forEach((b, i) => { if (slots.has(i)) b.querySelector('.opt-text').classList.add('flip-' + mode); });
  } else if (modifier === 'gambler') {
    // Answers stay locked until a wager of 1..maxWager() is placed.
    buttons.forEach(b => { b.disabled = true; });
    wagerButtons.innerHTML = '';
    for (let n = 1; n <= maxWager(); n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wager-option';
      btn.textContent = String(n);
      btn.addEventListener('click', () => placeWager(n));
      wagerButtons.appendChild(btn);
    }
    wagerRow.hidden = false;
  } else if (modifier === 'timer') {
    startCountdown();
  }
}

// Timer modifier: TIMER_SECONDS to answer. Running out counts as a miss,
// through the same path as a wrong answer.
function startCountdown() {
  let left = TIMER_SECONDS;
  const q = state.battle.currentQuestion;
  const show = () => {
    modTimerEl.textContent = t('battle.timer', { s: left });
    modTimerEl.classList.toggle('urgent', left <= 3);
  };
  show();
  modTimerEl.hidden = false;
  countdownTimer = setInterval(() => {
    left--;
    show();
    if (left > 0) return;
    clearInterval(countdownTimer);
    countdownTimer = null;
    // Only if that same question is still showing; the host checks it is
    // still waiting on an answer.
    if (state.battle.currentQuestion !== q) return;
    handlers.onTimeout();
  }, 1000);
}

// Gambler: the player bet `n`, so the answers unlock.
export function placeWager(n) {
  if (state.battle.wager || wagerRow.hidden) return;
  state.battle.wager = n;
  wagerRow.hidden = true;
  handlers.log(t('log.wager', { n }), 'sys');
  mcOptionsEl.querySelectorAll('.mc-option').forEach(b => { b.disabled = false; });
}

// Sets the active question, and (in MC mode) its answer choices.
export function setQuestion(q) {
  clearModifier();
  state.battle.currentQuestion = q;
  typeText(enemyName, q.term);
  answerInput.value = '';
  const imageSrc = resolveImageSrc(q.image);
  if (imageSrc) {
    queryImage.src = imageSrc;
    queryImage.hidden = false;
  } else {
    queryImage.hidden = true;
    queryImage.removeAttribute('src');
  }
  if (state.settings.mcMode) {
    state.battle.currentChoices = buildChoices(q);
    renderChoices();
  }
}

// Types the question now showing again. A question is often set well
// before it is seen (off-screen, at room load), so the typing would
// otherwise be missed.
export function retypeQuestion() {
  typeText(enemyName, state.battle.currentQuestion.term);
}

attackBtn.addEventListener('click', () => handlers.onTyped(answerInput.value));

answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handlers.onTyped(answerInput.value);
  }
});

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handlers.onTyped(answerInput.value);
});
