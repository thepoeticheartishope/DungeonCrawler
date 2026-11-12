// Minigame practice (Timothy, 2026-10-11): a hidden screen for playing any
// minigame on its own, outside a run. PRACTICE_TAPS quick taps on the
// title, on the start screen only, open it. The player picks a minigame,
// the modifiers it can carry (PRACTICE_MODIFIERS: no Gambler) and the set
// its questions come from (the last one played, else PRACTICE_DEFAULT_SET).
// A game with levels (MINIGAME_LEVELS, Inference's INFERENCE.levels) also
// gets a level picker (Timothy 2026-11-10): the level's settings show as
// fields to change for a try, and COPY gives the preset line to put in
// config.js. Changes last until the page reloads and never reach a run.
// No points: a result only shows its tier. Nothing pays out, nothing is
// recorded as a haunt, and the run's "not the same minigame twice"
// memory is left alone. Shares the one question panel (questionview.js)
// with the ask screen; main.js passes in letterPoolQuestion and
// sumLockQuestion (the stand-in questions). Mastery (mastery plan,
// Timothy 2026-11-12) sits at the end of the list but is not a minigame
// of a run: it draws its own card (masteryview.js) and keeps a saved
// record per set.
import { state } from './state.js';
import { BATTLE_CHOICE_COUNT, PRACTICE_TAPS, PRACTICE_TAP_MS, PRACTICE_MODIFIERS, PRACTICE_DEFAULT_SET, MINIGAME_LEVELS, INFERENCE } from './config.js';
import { MINIGAMES, MINIGAME_MODIFIERS, setPracticeSettings, minigamesFor, letterPoolFits, sumLockQuestions, inferenceTargets, inferenceQuestion, patchBayPredicates, patchBayQuestion } from './minigames.js';
import { mountQuestionPanel, parkQuestionPanel, setQuestion, setMinigame, applyModifier, clearModifier } from './questionview.js';
import { fightGroups, pickQuestion } from './quiz.js';
import { lastSetValue, setChoices, fetchSet } from './setpicker.js';
import { openMastery, closeMastery } from './masteryview.js';
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
const levelBox = document.getElementById('practiceLevelBox');
const levelList = document.getElementById('practiceLevels');
const fieldList = document.getElementById('practiceFields');
const presetLine = document.getElementById('practicePreset');
const copyBtn = document.getElementById('practiceCopyBtn');
const resetBtn = document.getElementById('practiceResetBtn');

let actions = {};
let taps = 0;
let lastTapAt = 0;
let chosenGame = MINIGAMES[0];
// Questions each minigame can run in the set loaded, worked out once per
// set (some checks look across the whole set).
let fitting = new Map();
// The question showing has been settled; a late Timer is ignored.
let settled = true;
// The level picked for each minigame (0 = the game as it starts), and the
// settings changed for a level, by 'game:level'.
const chosenLevel = new Map();
const edited = new Map();

// Wires the title taps and the screen's buttons.
export function initPractice({ letterPoolQuestion, sumLockQuestion }) {
  actions = { letterPoolQuestion, sumLockQuestion };
  title.addEventListener('click', countTap);
  setSelect.addEventListener('change', () => loadSet(setSelect.value));
  playBtn.addEventListener('click', play);
  againBtn.addEventListener('click', play);
  menuBtn.addEventListener('click', showMenu);
  copyBtn.addEventListener('click', copyPreset);
  resetBtn.addEventListener('click', () => { edited.delete(levelKey()); renderLevels(); });
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
  state.settings.activeFacts = set.facts;
  state.settings.activeTriples = set.triples;
  fitting = new Map();
  renderGames();
}

// The minigame buttons (the chosen one pressed) and the modifiers the
// chosen one can carry. Says so when the set has nothing it can run.
function renderGames() {
  gameList.innerHTML = '';
  [...MINIGAMES, 'mastery'].forEach(id => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-option';
    btn.setAttribute('aria-pressed', String(id === chosenGame));
    btn.innerHTML = '<span class="set-name"></span>';
    btn.querySelector('.set-name').textContent = t(id === 'mastery' ? 'practice.mastery' : 'mg.' + id);
    btn.addEventListener('click', () => { chosenGame = id; renderGames(); });
    gameList.appendChild(btn);
  });
  renderLevels();
  const ticked = new Set([...modList.querySelectorAll('input:checked')].map(i => i.value));
  modList.innerHTML = '';
  PRACTICE_MODIFIERS.filter(mod => (MINIGAME_MODIFIERS[chosenGame] || []).includes(mod)).forEach(mod => {
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

// ---- Levels ----

// Minigame `id`'s levels, or none.
function levelsOf(id) {
  return id === 'inference' ? INFERENCE.levels : MINIGAME_LEVELS.games[id] || [];
}

function levelKey() {
  return chosenGame + ':' + (chosenLevel.get(chosenGame) || 0);
}

// The chosen game's chosen level's settings: as changed here, else its preset.
function currentSettings() {
  const preset = levelsOf(chosenGame)[chosenLevel.get(chosenGame) || 0];
  return edited.get(levelKey()) || preset;
}

// The level buttons, the chosen level's settings as fields, and its
// preset line. Hidden for a game with no levels.
function renderLevels() {
  const levels = levelsOf(chosenGame);
  levelBox.hidden = !levels.length;
  if (!levels.length) return;
  const at = chosenLevel.get(chosenGame) || 0;
  levelList.innerHTML = '';
  levels.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-option';
    btn.setAttribute('aria-pressed', String(i === at));
    btn.innerHTML = '<span class="set-name"></span>';
    btn.querySelector('.set-name').textContent = t('practice.levelName', { n: i + 1 }) + (edited.has(chosenGame + ':' + i) ? ' *' : '');
    btn.addEventListener('click', () => { chosenLevel.set(chosenGame, i); renderLevels(); });
    levelList.appendChild(btn);
  });
  const preset = levels[at];
  const settings = currentSettings();
  fieldList.innerHTML = '';
  Object.keys(preset).forEach(name => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const value = preset[name];
    if (typeof value === 'boolean') {
      input.type = 'checkbox';
      input.checked = settings[name];
    } else if (Array.isArray(value)) {
      input.type = 'text';
      input.value = settings[name].join(', ');
    } else {
      input.type = 'number';
      input.step = 'any';
      input.value = settings[name];
    }
    const span = document.createElement('span');
    span.textContent = name;
    label.append(span, input);
    label.classList.toggle('changed', !same(settings[name], value));
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
      const next = { ...currentSettings(), [name]: readField(input, value) };
      if (same(next, preset)) edited.delete(levelKey());
      else edited.set(levelKey(), next);
      label.classList.toggle('changed', !same(next[name], value));
      levelList.children[at].querySelector('.set-name').textContent = t('practice.levelName', { n: at + 1 }) + (edited.has(levelKey()) ? ' *' : '');
      presetLine.textContent = presetText();
    });
    fieldList.appendChild(label);
  });
  presetLine.textContent = presetText();
}

// A field's value, the same kind as the preset's `like`: a number (the
// preset's when the box is empty or not a number), a tick, or a list
// split on commas.
function readField(input, like) {
  if (typeof like === 'boolean') return input.checked;
  if (Array.isArray(like)) {
    const items = input.value.split(',').map(x => x.trim()).filter(Boolean);
    return typeof like[0] === 'number' ? items.map(Number).filter(n => !Number.isNaN(n)) : items;
  }
  const n = parseFloat(input.value);
  return Number.isNaN(n) ? like : n;
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A value written the way config.js writes it.
function literal(v) {
  if (Array.isArray(v)) return '[' + v.map(literal).join(', ') + ']';
  if (typeof v === 'string') return "'" + v + "'";
  if (v && typeof v === 'object') return '{ ' + Object.keys(v).map(k => k + ': ' + literal(v[k])).join(', ') + ' }';
  return String(v);
}

// The chosen level's preset line, e.g. "starChart level 2: { decoys: 8 }".
function presetText() {
  return chosenGame + ' level ' + ((chosenLevel.get(chosenGame) || 0) + 1) + ': ' + literal(currentSettings());
}

async function copyPreset() {
  try {
    await navigator.clipboard.writeText(presetText());
    status.textContent = t('practice.copied');
  } catch {
    status.textContent = t('practice.copyFailed');
  }
}

// What minigame `id` can run in the set loaded: questions, or for a
// Letter Pool the categories (fight groups) it fits.
function questionsFor(id) {
  if (!fitting.has(id)) {
    const data = state.settings.activeData;
    // Letter Pool runs a category, Sum Lock two number questions and
    // Inference and Patch Bay the set's facts, not one question each.
    const runs = {
      letterPool: () => fightGroups(data, BATTLE_CHOICE_COUNT).filter(letterPoolFits),
      sumLock: () => (sumLockQuestions().length >= 2 ? sumLockQuestions() : []),
      inference: () => inferenceTargets(),
      patchBay: () => patchBayPredicates(),
      mastery: () => data,
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
  if (chosenGame === 'mastery') { playMastery(); return; }
  const mods = [...modList.querySelectorAll('input:checked')].map(i => i.value);
  menu.hidden = true;
  playArea.hidden = false;
  result.textContent = '';
  resultButtons.hidden = true;
  againBtn.hidden = false;
  settled = false;
  setPracticeSettings(levelsOf(chosenGame).length ? chosenGame : null, currentSettings());
  mountQuestionPanel(slot, { onChoice() {}, onTyped() {}, onTimeout: () => settle(null), onResult: settle, log() {} });
  const standIn = {
    letterPool: () => actions.letterPoolQuestion(pool[Math.floor(Math.random() * pool.length)]),
    sumLock: () => actions.sumLockQuestion(),
    inference: () => inferenceQuestion(state.battle.currentQuestion),
    patchBay: () => patchBayQuestion(state.battle.currentQuestion),
  }[chosenGame];
  const q = standIn ? standIn() : pickQuestion(state.battle.currentQuestion, pool);
  setQuestion(q);
  setMinigame(chosenGame);
  mods.forEach(applyModifier);
}

// Mastery runs on until the player goes back, so only MENU shows under it.
function playMastery() {
  menu.hidden = true;
  playArea.hidden = false;
  result.textContent = '';
  resultButtons.hidden = false;
  againBtn.hidden = true;
  openMastery(slot, setSelect.value);
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
    : t('practice.miss', { answer: state.battle.currentQuestion.answer });
  resultButtons.hidden = false;
  againBtn.focus();
}

// Back to the menu from a game, leaving the minigame put away.
function showMenu() {
  putAway();
  playArea.hidden = true;
  menu.hidden = false;
}

// Stops whatever minigame is showing and parks the question panel
// (questionview.js parkQuestionPanel), so a run starts clean.
function putAway() {
  settled = true;
  closeMastery();
  clearModifier();
  setMinigame(null);
  parkQuestionPanel();
  setPracticeSettings(null);
}

// Back to the start screen.
function leave() {
  putAway();
  practiceScreen.classList.remove('show');
  startScreen.classList.add('show');
  window.scrollTo(0, 0);
}
