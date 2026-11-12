// Mastery's page (mastery plan step A, ideas/mastery-plan.md outside the
// repo): the practice screen's Mastery runs here, one question after
// another until the player goes back to the menu. Draws the fact's tier,
// its credits, the optional bet, then options (tier 1) or a typed answer
// (tiers 3 and 4); settles through mastery.js and saves the set's record
// in localStorage (MASTERY.storageKey + the set). With ?dev a button
// moves the day on, to test rests. practice.js calls openMastery and
// closeMastery.
import { MASTERY } from './config.js';
import { newMasteryRecord, masteryDay, masteryNext, masteryTier, masteryTask, masteryCredits, masteryCounts, settleMastery } from './mastery.js';
import { buildChoices, rightAnswers, normalizeSpaces, resolveImageSrc, escapeHtml } from './quiz.js';
import { state } from './state.js';
import { t } from './text.js';

const isDev = new URLSearchParams(location.search).has('dev');
const letters = ['A', 'B', 'C', 'D'];

let box = null;
// The open Mastery: the set's value, its record, the question showing,
// its options, the bet picked (0 = none) and, once answered, what
// happened ({ given, events }).
let open = null;

// Starts Mastery inside `host` on the set loaded (state.settings.activeData),
// picking up the record saved for set `setValue`.
export function openMastery(host, setValue) {
  closeMastery();
  box = document.createElement('div');
  box.className = 'mastery';
  host.appendChild(box);
  open = { setValue, record: load(setValue), q: null, choices: [], bet: 0, answered: null };
  next();
}

// Takes Mastery off the page (back to the menu, or leaving practice).
export function closeMastery() {
  if (box) box.remove();
  box = null;
  open = null;
}

// The saved record for set `setValue`, or a new one when there is none
// or storage is blocked.
function load(setValue) {
  try {
    const saved = JSON.parse(localStorage.getItem(MASTERY.storageKey + setValue) || 'null');
    if (saved && saved.facts && Array.isArray(saved.log)) return saved;
  } catch { /* storage blocked or the record is damaged: start again */ }
  return newMasteryRecord();
}

function save() {
  try {
    localStorage.setItem(MASTERY.storageKey + open.setValue, JSON.stringify(open.record));
  } catch { /* storage blocked: the record lasts until the page closes */ }
}

// Today's day number, moved on by DEV's skipped days.
function today() {
  return masteryDay(new Date()) + (open.record.dayShift || 0);
}

// Picks the next question and draws it.
function next() {
  open.q = masteryNext(open.record, state.settings.activeData, today());
  open.bet = 0;
  open.answered = null;
  open.choices = open.q && masteryTask(open.record, open.q) === 1 ? buildChoices(open.q) : [];
  draw();
}

// Settles the answer `given` and draws what happened.
function answer(given) {
  if (open.answered) return;
  const right = rightAnswers(open.q).has(normalizeSpaces(given).toLowerCase());
  const events = settleMastery(open.record, open.q, { bet: open.bet, right }, today());
  open.answered = { given, right, events };
  save();
  draw();
}

// Draws the whole card from `open`.
function draw() {
  box.innerHTML = '';
  if (!open.q) {
    box.append(line('term-line', t('mastery.allResting')), statusLine());
    if (isDev) box.append(devRow());
    return;
  }
  const q = open.q;
  const task = masteryTask(open.record, q);
  const head = document.createElement('div');
  head.className = 'mastery-head';
  head.append(line('mastery-tier', t('mastery.tier.' + masteryTier(open.record, q))), line('mastery-score', t('mastery.score', { n: open.record.score })));
  box.append(head);
  if (masteryTier(open.record, q) < 4) box.append(line('mastery-credits', t('mastery.credits', { n: masteryCredits(open.record, q), bar: MASTERY.bar })));
  box.append(line('term-line', t('mastery.bet')), betRow());
  box.append(line('mastery-question', q.question));
  const src = resolveImageSrc(q.image);
  if (src) {
    const img = document.createElement('img');
    img.className = 'mastery-image';
    img.src = src;
    img.alt = '';
    box.append(img);
  }
  box.append(line('term-line', t(task === 1 ? 'mastery.pick' : 'mastery.type')));
  box.append(task === 1 ? optionList() : typedRow());
  if (open.answered) box.append(...resultLines(), nextRow());
  box.append(statusLine());
  if (isDev) box.append(devRow());
}

function line(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

// The three bets; tapping the picked one again takes it back. Locked once answered.
function betRow() {
  const row = document.createElement('div');
  row.className = 'mastery-bets';
  row.setAttribute('role', 'group');
  MASTERY.bets.forEach(bet => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-option';
    btn.disabled = !!open.answered;
    btn.setAttribute('aria-pressed', String(open.bet === bet));
    btn.innerHTML = '<span class="set-name"></span>';
    btn.querySelector('.set-name').textContent = t('mastery.bet.' + bet);
    btn.addEventListener('click', () => {
      open.bet = open.bet === bet ? 0 : bet;
      draw();
    });
    row.append(btn);
  });
  return row;
}

// Tier 1: the options, marked like the book once answered (the right one
// underlined, a wrong pick struck).
function optionList() {
  const list = document.createElement('div');
  list.className = 'mc-options show' + (open.answered ? ' answered' : '');
  open.choices.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option';
    btn.innerHTML = '<span class="letter">' + letters[i] + '</span><span class="opt-text">' + escapeHtml(opt) + '</span>';
    if (open.answered) {
      btn.disabled = true;
      const isRight = rightAnswers(open.q).has(normalizeSpaces(opt).toLowerCase());
      const picked = opt === open.answered.given;
      if (isRight) btn.classList.add('opt-right');
      if (picked) btn.classList.add(isRight ? 'opt-picked' : 'opt-struck');
    }
    btn.addEventListener('click', () => answer(opt));
    list.append(btn);
  });
  return list;
}

// Tiers 3 and 4: type the answer; Enter or CHECK settles it.
function typedRow() {
  const row = document.createElement('div');
  row.className = 'term-input-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'masteryTyped';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', t('mastery.type'));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = t('mastery.check');
  if (open.answered) {
    input.value = open.answered.given;
    input.disabled = btn.disabled = true;
  }
  const go = () => { if (input.value.trim()) answer(input.value); };
  btn.addEventListener('click', go);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  row.append(input, btn);
  if (!open.answered) setTimeout(() => input.focus(), 0);
  return row;
}

// The answer's lines: right or wrong with its credits, the question's
// note, then a move up, a kept mastery or a drop.
function resultLines() {
  const lines = [];
  open.answered.events.forEach(e => {
    if (e.type === 'masteryAnswered') {
      lines.push(line('term-line mastery-result', e.right
        ? t('mastery.right', { n: e.credits })
        : t('mastery.wrong', { n: -e.credits, answer: open.q.answer })));
      if (open.q.note) lines.push(line('term-line mastery-note', open.q.note));
    }
    if (e.type === 'masteryMovedUp') lines.push(line('term-line mastery-change', t('mastery.movedUp', { tier: t('mastery.tier.' + e.tier), questions: e.questions, days: e.days })));
    if (e.type === 'masteryKept') lines.push(line('term-line mastery-change', t('mastery.kept', { questions: e.questions, days: e.days })));
    if (e.type === 'masteryDropped') lines.push(line('term-line mastery-change', t('mastery.dropped', { tier: t('mastery.tier.' + e.tier) })));
  });
  return lines;
}

function nextRow() {
  const row = document.createElement('div');
  row.className = 'pick-footer';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = t('mastery.next');
  btn.addEventListener('click', next);
  row.append(btn);
  setTimeout(() => btn.focus(), 0);
  return row;
}

function statusLine() {
  return line('mastery-status', t('mastery.status', masteryCounts(open.record, state.settings.activeData, today())));
}

// DEV only: move the day on by one, so rests can be tested now.
function devRow() {
  const row = document.createElement('div');
  row.className = 'mastery-dev';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ghost small';
  btn.textContent = t('mastery.nextDay');
  btn.addEventListener('click', () => {
    open.record.dayShift = (open.record.dayShift || 0) + 1;
    save();
    if (!open.q || open.answered) next();
    else draw();
  });
  row.append(btn, line('mastery-status', t('mastery.day', { n: open.record.dayShift || 0 })));
  return row;
}
