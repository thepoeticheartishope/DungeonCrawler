// The set screen: after Enter on the start screen, the player picks which
// questions this run asks — a built-in set, one of their saved sets, or the
// workshop's list — and picking one starts the run. The last pick is
// remembered and gets the focus next time. Retry on the end screens skips
// this screen and keeps the same set. main.js passes in startGame and the
// way into the workshop (setloader.js showWorkshop).
import { state } from './state.js';
import { escapeHtml } from './quiz.js';
import { fetchManifest, fetchBundledSet, fetchDictionary, listSavedSets, loadSavedSet } from './sets.js';
import { t } from './text.js';

// Which set was picked last: 'builtin:<id>', 'saved:<name>' or 'workshop'.
const LAST_SET_KEY = 'noesisProtocol.lastSet';

const startScreen = document.getElementById('startScreen');
const pickScreen = document.getElementById('pickScreen');
const pickList = document.getElementById('pickList');
const pickStatus = document.getElementById('pickStatus');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('pickBackBtn');
const workshopBtn = document.getElementById('workshopOpenBtn');

let actions = {};
let picking = false; // a built-in set is loading; further taps wait

// Wires Enter, Back and the workshop link. `startGame` begins a run with
// whatever state.settings.activeData holds; `openWorkshop` shows the workshop.
export function initSetPicker({ startGame, openWorkshop }) {
  actions = { startGame, openWorkshop };
  startBtn.addEventListener('click', showSetPicker);
  backBtn.addEventListener('click', () => switchTo(startScreen));
  workshopBtn.addEventListener('click', () => actions.openWorkshop());
  pickScreen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') switchTo(startScreen);
  });
}

// Shows the set screen with a fresh list: saved sets and the workshop list
// can both change between visits.
export async function showSetPicker() {
  switchTo(pickScreen);
  pickStatus.textContent = '';
  picking = false;
  const builtins = await fetchManifest();
  renderList(builtins);
}

function switchTo(screen) {
  document.querySelectorAll('.screen.show').forEach(s => s.classList.remove('show'));
  screen.classList.add('show');
  window.scrollTo(0, 0);
}

function readLastSet() {
  try {
    return localStorage.getItem(LAST_SET_KEY) || '';
  } catch (e) {
    return '';
  }
}

function writeLastSet(value) {
  try {
    localStorage.setItem(LAST_SET_KEY, value);
  } catch (e) {
    // Storage unavailable — the pick still works for this run.
  }
}

// One button per set, grouped: built-in first, then the player's own (the
// workshop list, then saved sets). The last pick is tagged and focused.
function renderList(builtins) {
  const last = readLastSet();
  const own = listSavedSets().map(s => ({ value: 'saved:' + s.name, name: s.name, meta: t('pick.count', { count: s.count }) }));
  if (state.settings.workshopData) {
    own.unshift({ value: 'workshop', name: t('pick.workshopList'), meta: t('pick.count', { count: state.settings.workshopData.length }) });
  }
  const groups = [
    { label: t('pick.builtinGroup'), sets: builtins.map(s => ({ value: 'builtin:' + s.id, name: s.name, meta: s.description || '' })) },
    { label: t('pick.savedGroup'), sets: own },
  ].filter(g => g.sets.length);

  if (!groups.length) {
    pickList.innerHTML = '<p class="saved-sets-empty">' + escapeHtml(t('pick.empty')) + '</p>';
    return;
  }
  pickList.innerHTML = groups.map(g =>
    '<div class="loader-section-label">' + escapeHtml(g.label) + '</div>' +
    g.sets.map(s =>
      '<button type="button" class="set-option" data-set="' + escapeHtml(s.value) + '">' +
        '<span class="set-name">' + escapeHtml(s.name) +
          (s.value === last ? ' <span class="set-last">' + escapeHtml(t('pick.last')) + '</span>' : '') +
        '</span>' +
        (s.meta ? '<span class="set-meta">' + escapeHtml(s.meta) + '</span>' : '') +
      '</button>'
    ).join('')
  ).join('');

  pickList.querySelectorAll('.set-option').forEach((btn) => {
    btn.addEventListener('click', () => pick(btn.dataset.set, builtins));
  });
  const lastBtn = [...pickList.querySelectorAll('.set-option')].find(b => b.dataset.set === last);
  (lastBtn || pickList.querySelector('.set-option')).focus({ preventScroll: true });
}

// The set picked last ('builtin:<id>', 'saved:<name>', 'workshop'), or ''.
// Minigame practice (practice.js) starts on it.
export function lastSetValue() {
  return readLastSet();
}

// Every set there is to pick, as [{ value, name }]: built-in first, then
// the workshop list and saved sets. For minigame practice's set switch.
export async function setChoices() {
  const builtins = await fetchManifest();
  const own = listSavedSets().map(s => ({ value: 'saved:' + s.name, name: s.name }));
  if (state.settings.workshopData) own.unshift({ value: 'workshop', name: t('pick.workshopList') });
  return [...builtins.map(s => ({ value: 'builtin:' + s.id, name: s.name })), ...own];
}

// Fetches set `value` and its subject dictionary (built-in sets only):
// { data, dictionary }, or null if it can't be had. `builtins` is the
// manifest, fetched again when not given.
export async function fetchSet(value, builtins = null) {
  if (value === 'workshop') return state.settings.workshopData ? { data: state.settings.workshopData, dictionary: null } : null;
  if (value.startsWith('saved:')) {
    const data = loadSavedSet(value.slice('saved:'.length));
    return data && data.length ? { data, dictionary: null } : null;
  }
  if (!value.startsWith('builtin:')) return null;
  const chosen = (builtins || await fetchManifest()).find(s => s.id === value.slice('builtin:'.length));
  if (!chosen) return null;
  const [data, dictionary] = await Promise.all([fetchBundledSet(chosen.file), fetchDictionary(chosen.subject)]);
  return data && data.length ? { data, dictionary } : null;
}

// Loads the picked set into state.settings and starts the run. A built-in
// set is fetched first (with its subject dictionary); if that fails the
// player stays here and can try again.
async function pick(value, builtins) {
  if (picking) return;
  const chosen = value.startsWith('builtin:') && builtins.find(s => s.id === value.slice('builtin:'.length));
  if (chosen) {
    picking = true;
    pickStatus.innerHTML = '<span class="loader-ok">' + escapeHtml(t('pick.loading', { name: chosen.name })) + '</span>';
  }
  const set = await fetchSet(value, builtins);
  picking = false;
  if (!set) {
    if (chosen) pickStatus.innerHTML = '<span class="loader-error">' + escapeHtml(t('pick.failed', { name: chosen.name })) + '</span>';
    return;
  }

  state.settings.activeData = set.data;
  state.settings.activeDictionary = set.dictionary;
  writeLastSet(value);
  // startGame's showScreen only knows the game screens, so leave this one first.
  pickScreen.classList.remove('show');
  actions.startGame();
}
