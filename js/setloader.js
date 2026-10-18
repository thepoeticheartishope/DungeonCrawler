// Start screen options and the workshop. The start screen keeps only what a
// player sets before a run (name, reveal, real time, swap sides, simple
// enemies, the tutorial room, the view and the shoulder view's comfort
// settings), remembered across
// sessions. The workshop is for authors: pasted or file lists, the sample
// list, saving and deleting sets, and the way into DATA.SYS. Players pick
// the set itself after Enter (setpicker.js). Uses only state, sets.js,
// quiz.js and text.js.
import { state } from './state.js';
import { PLAYER_NAME_MAX_LENGTH } from './config.js';
import { defaultSample, parseListInput, escapeHtml } from './quiz.js';
import { listSavedSets, saveSet, deleteSet } from './sets.js';
import { t } from './text.js';

const revealToggle = document.getElementById('revealToggle');
const realTimeToggle = document.getElementById('realTimeToggle');
const dpadRightToggle = document.getElementById('dpadRightToggle');
const simpleEnemiesToggle = document.getElementById('simpleEnemiesToggle');
const tutorialToggle = document.getElementById('tutorialToggle');
const shoulderOptions = document.getElementById('shoulderOptions');
const isoViewToggle = document.getElementById('isoViewToggle');
const shoulderToggles = {
  shoulderSteps: document.getElementById('shoulderStepsToggle'),
  shoulderSlow: document.getElementById('shoulderSlowToggle'),
  shoulderWide: document.getElementById('shoulderWideToggle'),
};
const roomControls = document.querySelector('.room-controls');
const playerNameInput = document.getElementById('playerName');
const workshopScreen = document.getElementById('workshopScreen');
const workshopBackBtn = document.getElementById('workshopBackBtn');
const fileInput = document.getElementById('fileInput');
const dataInput = document.getElementById('dataInput');
const loadListBtn = document.getElementById('loadListBtn');
const resetListBtn = document.getElementById('resetListBtn');
const loaderStatus = document.getElementById('loaderStatus');
const saveSetName = document.getElementById('saveSetName');
const saveSetBtn = document.getElementById('saveSetBtn');
const savedSetsList = document.getElementById('savedSetsList');

// Matches the start screen to the view in play (it can also come from the
// address, ?view=iso / ?view=shoulder, or DEV -> View): the Isometric view
// box, and the shoulder view's comfort settings shown only while that view
// is on (shoulder view plan steps F and G).
export function showViewOptions() {
  isoViewToggle.checked = state.settings.view === 'iso';
  shoulderOptions.hidden = state.settings.view !== 'shoulder';
}

// Wires the start screen options and the workshop. `showSets` returns to
// the set screen (setpicker.js), which lists what the workshop made.
export function initSetLoader({ showSets }) {
  // ---- Remember the reveal, real-time, swap-sides and simple-enemies toggles and the player's name across sessions ----
  // localStorage access is wrapped in try/catch — private browsing or disabled
  // storage should degrade to "just use the checkbox defaults" rather than
  // break the start screen.
  const OPTION_STORAGE_KEY = 'noesisProtocol.options';

  function loadSavedOptions() {
    try {
      const raw = localStorage.getItem(OPTION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveOptions() {
    try {
      localStorage.setItem(OPTION_STORAGE_KEY, JSON.stringify({
        revealOnWrong: revealToggle.checked,
        realTime: realTimeToggle.checked,
        dpadRight: dpadRightToggle.checked,
        simpleEnemies: simpleEnemiesToggle.checked,
        tutorial: tutorialToggle.checked,
        isoView: isoViewToggle.checked,
        ...Object.fromEntries(Object.entries(shoulderToggles).map(([name, box]) => [name, box.checked])),
        playerName: playerNameInput.value,
      }));
    } catch (e) {
      // Storage unavailable — the checkboxes still work for this session.
    }
  }

  // Puts the d-pad on the side the swap-sides toggle asks for: right
  // (MAP, LOG and SELECT on the left) for a player who moves with the
  // other hand. Only the layout changes, so it lives here, not in state.
  function placeDpad() {
    roomControls.classList.toggle('dpad-right', dpadRightToggle.checked);
  }

  const savedOptions = loadSavedOptions();
  if (typeof savedOptions.revealOnWrong === 'boolean') revealToggle.checked = savedOptions.revealOnWrong;
  if (typeof savedOptions.realTime === 'boolean') realTimeToggle.checked = savedOptions.realTime;
  if (typeof savedOptions.dpadRight === 'boolean') dpadRightToggle.checked = savedOptions.dpadRight;
  if (typeof savedOptions.simpleEnemies === 'boolean') simpleEnemiesToggle.checked = savedOptions.simpleEnemies;
  // On until a tutorial is finished (main.js switches it off then), so a
  // player who has never played gets one.
  if (typeof savedOptions.tutorial === 'boolean') tutorialToggle.checked = savedOptions.tutorial;
  // The view (shoulder view plan step G): the shoulder view unless the
  // player chose the old isometric map.
  if (typeof savedOptions.isoView === 'boolean') state.settings.view = savedOptions.isoView ? 'iso' : 'shoulder';
  isoViewToggle.addEventListener('change', () => {
    state.settings.view = isoViewToggle.checked ? 'iso' : 'shoulder';
    showViewOptions();
    saveOptions();
  });
  Object.entries(shoulderToggles).forEach(([name, box]) => {
    if (typeof savedOptions[name] === 'boolean') box.checked = savedOptions[name];
    box.addEventListener('change', saveOptions);
  });
  placeDpad();
  playerNameInput.maxLength = PLAYER_NAME_MAX_LENGTH;
  if (typeof savedOptions.playerName === 'string') playerNameInput.value = savedOptions.playerName.slice(0, PLAYER_NAME_MAX_LENGTH);

  revealToggle.addEventListener('change', saveOptions);
  realTimeToggle.addEventListener('change', saveOptions);
  simpleEnemiesToggle.addEventListener('change', saveOptions);
  tutorialToggle.addEventListener('change', saveOptions);
  dpadRightToggle.addEventListener('change', () => { placeDpad(); saveOptions(); });
  playerNameInput.addEventListener('input', saveOptions);

  // ---- Workshop ----

  workshopBackBtn.addEventListener('click', showSets);

  function showStatus(key, vars, isError, extra = '') {
    loaderStatus.innerHTML = '<span class="' + (isError ? 'loader-error' : 'loader-ok') + '">' +
      escapeHtml(t(key, vars) + extra) + '</span>';
  }

  // The workshop's list is what the run plays until the player picks
  // another set, and the set screen offers it as "Workshop list".
  function useWorkshopList(data) {
    state.settings.workshopData = data;
    state.settings.activeData = data;
    state.settings.activeDictionary = null;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { dataInput.value = reader.result; };
    reader.onerror = () => showStatus('workshop.fileFailed', {}, true);
    reader.readAsText(file);
  });

  loadListBtn.addEventListener('click', () => {
    const result = parseListInput(dataInput.value);
    if (result.error) {
      loaderStatus.innerHTML = '<span class="loader-error">' + result.error + '</span>';
      return;
    }
    useWorkshopList(result.data);
    state.settings.usingSample = false;
    showStatus('workshop.loaded', { count: result.data.length }, false, result.warning ? ' ' + result.warning : '');
  });

  resetListBtn.addEventListener('click', () => {
    useWorkshopList(defaultSample(true));
    state.settings.usingSample = true;
    dataInput.value = '';
    fileInput.value = '';
    showStatus('workshop.sample', { count: state.settings.activeData.length });
  });

  function renderSavedSets() {
    const sets = listSavedSets();
    if (sets.length === 0) {
      savedSetsList.innerHTML = '<p class="saved-sets-empty">' + escapeHtml(t('workshop.noSaved')) + '</p>';
      return;
    }
    savedSetsList.innerHTML = '';
    sets.forEach((set) => {
      const row = document.createElement('div');
      row.className = 'saved-set-row';
      row.innerHTML = '<span class="saved-set-name">' + escapeHtml(set.name) + '</span>' +
        '<span class="saved-set-count">' + set.count + '</span>' +
        '<button type="button" class="ghost delete-saved-set">' + escapeHtml(t('workshop.delete')) + '</button>';
      row.querySelector('.delete-saved-set').addEventListener('click', () => {
        deleteSet(set.name);
        renderSavedSets();
      });
      savedSetsList.appendChild(row);
    });
  }

  saveSetBtn.addEventListener('click', () => {
    const name = saveSetName.value.trim();
    if (!name) {
      showStatus('workshop.needName', {}, true);
      return;
    }
    const data = state.settings.workshopData;
    if (state.settings.usingSample || !data || data.length === 0) {
      showStatus('workshop.needList', {}, true);
      return;
    }
    saveSet(name, data);
    saveSetName.value = '';
    showStatus('workshop.saved', { name });
    renderSavedSets();
  });

  renderSavedSets();
}

// Opens the workshop (from the set screen).
export function showWorkshop() {
  document.querySelectorAll('.screen.show').forEach(s => s.classList.remove('show'));
  workshopScreen.classList.add('show');
  window.scrollTo(0, 0);
}
