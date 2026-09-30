// Start screen options and the set loader: remembered options, pasted/file
// sets, built-in sets and saved sets. Uses only state, sets.js and quiz.js.
import { state } from './state.js';
import { defaultSample, parseListInput, escapeHtml } from './quiz.js';
import {
  fetchManifest, fetchBundledSet, listSavedSets, saveSet, loadSavedSet, deleteSet
} from './sets.js';

const revealToggle = document.getElementById('revealToggle');
const toggleLoaderBtn = document.getElementById('toggleLoader');
const loaderPanel = document.getElementById('loaderPanel');
const fileInput = document.getElementById('fileInput');
const dataInput = document.getElementById('dataInput');
const loadListBtn = document.getElementById('loadListBtn');
const resetListBtn = document.getElementById('resetListBtn');
const loaderStatus = document.getElementById('loaderStatus');
const builtinSetSelect = document.getElementById('builtinSetSelect');
const loadBuiltinBtn = document.getElementById('loadBuiltinBtn');
const saveSetName = document.getElementById('saveSetName');
const saveSetBtn = document.getElementById('saveSetBtn');
const savedSetsList = document.getElementById('savedSetsList');
let builtinSets = [];

export function initSetLoader() {
  // ---- Remember the reveal/multiple-choice option toggles across sessions ----
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
      }));
    } catch (e) {
      // Storage unavailable — the checkboxes still work for this session.
    }
  }

  const savedOptions = loadSavedOptions();
  if (typeof savedOptions.revealOnWrong === 'boolean') revealToggle.checked = savedOptions.revealOnWrong;

  revealToggle.addEventListener('change', saveOptions);

  toggleLoaderBtn.addEventListener('click', () => {
    loaderPanel.classList.toggle('show');
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { dataInput.value = reader.result; };
    reader.onerror = () => {
      loaderStatus.innerHTML = '<span class="loader-error">Could not read that file.</span>';
    };
    reader.readAsText(file);
  });

  loadListBtn.addEventListener('click', () => {
    const result = parseListInput(dataInput.value);
    if (result.error) {
      loaderStatus.innerHTML = '<span class="loader-error">' + result.error + '</span>';
      return;
    }
    state.settings.activeData = result.data;
    state.settings.usingSample = false;
    let msg = 'Loaded ' + state.settings.activeData.length + ' items — this set will be used for the next run.';
    if (result.warning) msg += ' ' + result.warning;
    loaderStatus.innerHTML = '<span class="loader-ok">' + msg + '</span>';
  });

  function showSampleStatus() {
    loaderStatus.innerHTML = '<span class="loader-ok">Using the built-in multiple choice sample list (' +
      defaultSample(true).length + ' items).</span>';
  }

  resetListBtn.addEventListener('click', () => {
    state.settings.usingSample = true;
    state.settings.activeData = defaultSample(true);
    dataInput.value = '';
    fileInput.value = '';
    showSampleStatus();
  });

  // ---- Built-in and saved item sets ----

  builtinSetSelect.addEventListener('change', () => {
    loadBuiltinBtn.disabled = !builtinSetSelect.value;
  });
  loadBuiltinBtn.disabled = true;

  fetchManifest().then((sets) => {
    builtinSets = sets;
    sets.forEach((set) => {
      const opt = document.createElement('option');
      opt.value = set.id;
      opt.textContent = set.name;
      if (set.description) opt.title = set.description;
      builtinSetSelect.appendChild(opt);
    });
  });

  loadBuiltinBtn.addEventListener('click', async () => {
    const chosen = builtinSets.find((set) => set.id === builtinSetSelect.value);
    if (!chosen) return;
    loaderStatus.innerHTML = '<span class="loader-ok">Loading ' + escapeHtml(chosen.name) + '…</span>';
    const data = await fetchBundledSet(chosen.file);
    if (!data) {
      loaderStatus.innerHTML = '<span class="loader-error">Could not load that set. Try again.</span>';
      return;
    }
    state.settings.activeData = data;
    state.settings.usingSample = false;
    loaderStatus.innerHTML = '<span class="loader-ok">Loaded "' + escapeHtml(chosen.name) + '" (' +
      data.length + ' items) — this set will be used for the next run.</span>';
  });

  function renderSavedSets() {
    const sets = listSavedSets();
    if (sets.length === 0) {
      savedSetsList.innerHTML = '<p class="saved-sets-empty">Nothing saved yet — load a set above and save it to reuse later.</p>';
      return;
    }
    savedSetsList.innerHTML = '';
    sets.forEach((set) => {
      const row = document.createElement('div');
      row.className = 'saved-set-row';
      row.innerHTML = '<span class="saved-set-name">' + escapeHtml(set.name) + '</span>' +
        '<span class="saved-set-count">' + set.count + '</span>' +
        '<button type="button" class="ghost load-saved-set">Load</button>' +
        '<button type="button" class="ghost delete-saved-set">Delete</button>';
      row.querySelector('.load-saved-set').addEventListener('click', () => {
        const data = loadSavedSet(set.name);
        if (!data) return;
        state.settings.activeData = data;
        state.settings.usingSample = false;
        loaderStatus.innerHTML = '<span class="loader-ok">Loaded "' + escapeHtml(set.name) + '" (' +
          data.length + ' items) — this set will be used for the next run.</span>';
      });
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
      loaderStatus.innerHTML = '<span class="loader-error">Give this set a name first.</span>';
      return;
    }
    if (state.settings.usingSample || !state.settings.activeData || state.settings.activeData.length === 0) {
      loaderStatus.innerHTML = '<span class="loader-error">Load a set (built-in, pasted, or a file) before saving.</span>';
      return;
    }
    saveSet(name, state.settings.activeData);
    saveSetName.value = '';
    loaderStatus.innerHTML = '<span class="loader-ok">Saved "' + escapeHtml(name) + '" — it now appears under My saved sets.</span>';
    renderSavedSets();
  });

  renderSavedSets();
}
