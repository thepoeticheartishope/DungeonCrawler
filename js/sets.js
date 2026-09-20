// Item-set storage: bundled sets shipped with the app (fetched from
// lists/), and player-saved custom sets (browser localStorage). No DOM
// access here — main.js wires this into the UI.

const CUSTOM_SETS_KEY = 'termDungeon.customSets';

// ---- Bundled sets (lists/manifest.json + lists/<file>.json) ----

// Returns the manifest array, or [] if it can't be fetched (offline before
// the service worker has cached it, opened over file://, etc.) — the start
// screen should degrade gracefully to "no built-in sets available" rather
// than throw.
export async function fetchManifest() {
  try {
    const res = await fetch('lists/manifest.json');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// Returns the item array for a bundled set's file, or null on failure.
export async function fetchBundledSet(file) {
  try {
    const res = await fetch('lists/' + file);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

// ---- Player-saved custom sets (localStorage) ----

// All localStorage access is wrapped — private browsing, disabled storage,
// or a full quota can throw, and none of that should crash the app. Saved
// sets just silently stay unavailable instead.
function readCustomSets() {
  try {
    const raw = localStorage.getItem(CUSTOM_SETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeCustomSets(sets) {
  try {
    localStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(sets));
    return true;
  } catch (e) {
    return false;
  }
}

// [{name, savedAt, count}], most recently saved first.
export function listSavedSets() {
  const sets = readCustomSets();
  return Object.keys(sets)
    .map((name) => ({
      name,
      savedAt: sets[name].savedAt,
      count: Array.isArray(sets[name].data) ? sets[name].data.length : 0
    }))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// Overwrites any existing set with the same name.
export function saveSet(name, data) {
  const sets = readCustomSets();
  sets[name] = { data, savedAt: Date.now() };
  return writeCustomSets(sets);
}

// Returns the item array, or null if no set has that name.
export function loadSavedSet(name) {
  const sets = readCustomSets();
  return sets[name] && Array.isArray(sets[name].data) ? sets[name].data : null;
}

export function deleteSet(name) {
  const sets = readCustomSets();
  delete sets[name];
  return writeCustomSets(sets);
}
