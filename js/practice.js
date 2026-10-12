// Minigame practice (Timothy, 2026-10-11): a hidden screen for playing any
// minigame on its own, outside a run. PRACTICE_TAPS quick taps on the
// title, on the start screen only, open it. The player picks a minigame,
// the modifiers it can carry (PRACTICE_MODIFIERS: no Gambler) and the set
// its questions come from (the last one played, else PRACTICE_DEFAULT_SET).
// No points: a result only shows its tier. Nothing pays out, nothing is
// recorded as a haunt, and the run's "not the same minigame twice"
// memory is left alone. Shares the one question panel (questionview.js)
// with the battle screen and the ask screen; main.js passes in
// letterPoolQuestion and sumLockQuestion (the stand-in questions) and
// mountBattleQuestion (hands the panel back on the way out).
import { state } from './state.js';
import { BATTLE_CHOICE_COUNT, PRACTICE_TAPS, PRACTICE_TAP_MS, PRACTICE_MODIFIERS, PRACTICE_DEFAULT_SET } from './config.js';
import { MINIGAMES, MINIGAME_MODIFIERS, minigamesFor, letterPoolFits, sumLockQuestions } from './minigames.js';
import { mountQuestionPanel, setQuestion, setMinigame, applyModifier, clearModifier } from './questionview.js';
import { fightGroups, pickQuestion } from './quiz.js';
import { lastSetValue, setChoices, fetchSet } from './setpicker.js';
import { t } from './text.js';

const title = document.querySelector('header h1');
const startScreen = document.getElementById('startScreen');
const practiceScreen = document.getElementById('practiceScreen');
const menu = document.getElementById('practiceMenu');
const setSelect = document.getElementById('practiceSet');
const gameList = document.getElementById('practiceGames');
const modList = document.getElementById('practiceMods');
const status = document.getElementById('practiceStatus');
const playBtn = document.getElementById('practicePlayBtn');
const backBtn = document.getElementById('practiceBackBtn');
const playArea = document.getElementById('practicePlay');
const slot = document.getElementById('practiceSlot');
const result = document.getElementById('practiceResult');
const resultButtons = document.getElementById('practiceResultButtons');
const againBtn = document.getElementById('practiceAgainBtn');
const menuBtn = document.getElementById('practiceMenuBtn');

let actions = {};
let taps = 0;
let lastTapAt = 0;
let chosenGame = MINIGAMES[0];
// Questions each minigame can run in the set loaded, worked out once per
// set (some checks look across the whole set).
let fitting = new Map();
// The question showing has been settled; a late Timer is ignored.
let settled = true;

// Wires the title taps and the screen's buttons.
export function initPractice({ letterPoolQuestion, sumLockQuestion, mountBattleQuestion }) {
  actions = { letterPoolQuestion, sumLockQuestion, mountBattleQuestion };
  title.addEventListener('click', countTap);
  setSelect.addEventListener('change', () => loadSet(setSelect.value));
  playBtn.addEventListener('click', play);
  againBtn.addEventListener('click', play);
  menuBtn.addEventListener('click', showMenu);
  backBtn.addEventListener('click', leave);
  practiceScreen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) leave();
  });
  renderGames();
}

// Counts a tap on the title; PRACTICE_TAPS in a row, each within
// PRACTICE_TAP_MS of the last, open practice. Only on the start screen.
function countTap() {
  if (!startScreen.classList.contains('show')) return;
  const now = performance.now();
  taps = now - lastTapAt <= PRACTICE_TAP_MS ? taps + 1 : 1;
  lastTapAt = now;
  if (taps < PRACTICE_TAPS) return;
  taps = 0;
  open();
}

// Shows the screen on its menu and loads the set the player last played
// (else PRACTICE_DEFAULT_SET, else the first one there is).
async function open() {
  document.querySelectorAll('.screen.show').forEach(s => s.classList.remove('show'));
  practiceScreen.classList.add('show');
  window.scrollTo(0, 0);
  showMenu();
  const choices = await setChoices();
  setSelect.innerHTML = '';
  choices.forEach(c => {
    const option = document.createElement('option');
    option.value = c.value;
    option.textContent = c.name;
    setSelect.appendChild(option);
  });
  const start = [lastSetValue(), PRACTICE_DEFAULT_SET].find(v => choices.some(c => c.value === v));
  setSelect.value = start || (choices[0] ? choices[0].value : '');
  if (setSelect.value) loadSet(setSelect.value);
  else status.textContent = t('practice.noSets');
}

// Loads set `value` for practice. Minigames read the set being played
// (state.settings.activeData), so it goes there; a run started afterwards
// loads its own from the set screen.
async function loadSet(value) {
  playBtn.disabled = true;
  status.textContent = t('practice.loading');
  const set = await fetchSet(value);
  if (setSelect.value !== value) return; // switched again while this loaded
  if (!set) { status.textContent = t('practice.loadFailed'); return; }
  state.settings.activeData = set.data;
  state.settings.activeDictionary = set.dictionary;
  fitting = new Map();
  renderGames();
}

// The minigame buttons (the chosen one pressed) and the modifiers the
// chosen one can carry. Says so when the set has nothing it can run.
function renderGames() {
  gameList.innerHTML = '';
  MINIGAMES.forEach(id => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-option';
    btn.setAttribute('aria-pressed', String(id === chosenGame));
    btn.innerHTML = '<span class="set-name"></span>';
    btn.querySelector('.set-name').textContent = t('mg.' + id);
    btn.addEventListener('click', () => { chosenGame = id; renderGames(); });
    gameList.appendChild(btn);
  });
  const ticked = new Set([...modList.querySelectorAll('input:checked')].map(i => i.value));
  modList.innerHTML = '';
  PRACTICE_MODIFIERS.filter(mod => MINIGAME_MODIFIERS[chosenGame].includes(mod)).forEach(mod => {
    const label = document.createElement('label');
    label.className = 'option-toggle';
    label.innerHTML = '<input type="checkbox"><span></span>';
    label.querySelector('input').value = mod;
    label.querySelector('input').checked = ticked.has(mod);
    label.querySelector('span').textContent = t('mod.' + mod);
    modList.appendChild(label);
  });
  const ready = state.settings.activeData.length && setSelect.value;
  const any = ready && questionsFor(chosenGame).length;
  playBtn.disabled = !any;
  status.textContent = !ready ? status.textContent : any ? '' : t('practice.nothingFits', { game: t('mg.' + chosenGame) });
}

// What minigame `id` can run in the set loaded: questions, or for a
// Letter Pool the categories (fight groups) it fits.
function questionsFor(id) {
  if (!fitting.has(id)) {
    const data = state.settings.activeData;
    // Letter Pool runs a category and Sum Lock two number questions, not
    // one question each.
    const runs = {
      letterPool: () => fightGroups(data, BATTLE_CHOICE_COUNT).filter(letterPoolFits),
      sumLock: () => (sumLockQuestions().length >= 2 ? sumLockQuestions() : []),
    };
    fitting.set(id, runs[id] ? runs[id]() : data.filter(q => minigamesFor(q).includes(id)));
  }
  return fitting.get(id);
}

// Plays the chosen minigame once, on a question it fits (never the one
// just played, when there's another), with the ticked modifiers.
function play() {
  const pool = questionsFor(chosenGame);
  if (!pool.length) return;
  const mods = [...modList.querySelectorAll('input:checked')].map(i => i.value);
  menu.hidden = true;
  playArea.hidden = false;
  result.textContent = '';
  resultButtons.hidden = true;
  settled = false;
  mountQuestionPanel(slot, { onChoice() {}, onTyped() {}, onTimeout: () => settle(null), onResult: settle, log() {} });
  const standIn = {
    letterPool: () => actions.letterPoolQuestion(pool[Math.floor(Math.random() * pool.length)]),
    sumLock: () => actions.sumLockQuestion(),
  }[chosenGame];
  const q = standIn ? standIn() : pickQuestion(state.battle.currentQuestion, pool);
  setQuestion(q);
  setMinigame(chosenGame);
  mods.forEach(applyModifier);
}

// The minigame ended with `outcome` ({ right, tier }), or null when the
// Timer ran out: show how it went, and nothing else.
function settle(outcome) {
  if (settled) return;
  settled = true;
  clearModifier();
  const tier = outcome && outcome.right ? outcome.tier : null;
  result.textContent = tier
    ? t('practice.tier', { tier })
    : t('practice.miss', { answer: state.battle.currentQuestion.meaning });
  resultButtons.hidden = false;
  againBtn.focus();
}

// Back to the menu from a game, leaving the minigame put away.
function showMenu() {
  putAway();
  playArea.hidden = true;
  menu.hidden = false;
}

// Stops whatever minigame is showing and hands the question panel back to
// the battle screen, so a run starts clean.
function putAway() {
  settled = true;
  clearModifier();
  setMinigame(null);
  actions.mountBattleQuestion();
}

// Back to the start screen.
function leave() {
  putAway();
  practiceScreen.classList.remove('show');
  startScreen.classList.add('show');
  window.scrollTo(0, 0);
}
