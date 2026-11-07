// Item-set storage: bundled sets shipped with the app (fetched from
// lists/), and player-saved custom sets (browser localStorage). No DOM
// access here — main.js wires this into the UI.

const CUSTOM_SETS_KEY = 'termDungeon.customSets';

// ---- Bundled sets (lists/manifest.json + lists/<file>.json) ----
//
// Each manifest entry: { id, subject, name, description, file, facts? }
// (facts: the set's facts file, see fetchFacts below). Sets with
// the same "subject" (e.g. both Bible sets are "bible") cover the same
// material; CompTIA subjects are per exam ("comptia-aplus"). The subject
// picks the term dictionary wrong answers are drawn from
// (lists/dictionaries/<subject>.json, see quiz.js buildChoices). Pasted and
// saved custom sets have no subject, so no dictionary.

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

// ---- Facts (lists/facts/<id>.json; facts list plan steps B and C1) ----
//
// A set's facts are their own file, apart from its questions. The manifest
// entry names it ("facts": "facts/<id>.json"); no entry, no facts. The file
// is one object of triples (step C1):
//   { entities: [{ id, name, type, aliases? }],
//     facts: [{ subject, predicate, object, source? }],
//     templates: [{ predicate, label?, ... }] }
// `subject` is an entity id; `object` is an entity id or a number. The
// game reads each fact as a row { fact, value, source? }: `fact` is the
// template's label with {subject} / {object} filled in by entity names
// (no template: "<subject name> <predicate with spaces>"), `value` is the
// number or the object entity's name. An old file (a plain array of
// { fact, value } rows, step B) still loads as it is, so saved and teacher
// data never breaks. Inference uses the whole-number values (minigames.js).
// A missing or broken file gives [] (the set still plays, with no facts)
// and a warning in the console with ?dev on the address. Bad rows are skipped.

function factsWarn(message) {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev')) console.warn('facts: ' + message);
}

// Whether `f` is a fact row: a fact name and a number or text value.
export function goodFact(f) {
  if (!f || typeof f !== 'object' || typeof f.fact !== 'string' || !f.fact.trim()) return false;
  if (typeof f.value === 'number') return Number.isFinite(f.value);
  return typeof f.value === 'string' && f.value.trim() !== '';
}

// The good rows of a facts list, each { fact, value, source? }.
export function cleanFacts(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(goodFact).map(f => ({
    fact: f.fact.trim(),
    value: typeof f.value === 'string' ? f.value.trim() : f.value,
    ...(typeof f.source === 'string' && f.source.trim() ? { source: f.source.trim() } : {}),
  }));
}

// A triple's label: its template's `label` with {subject} and {object}
// filled in by names (a number object prints as the number), or the plain
// fallback "<subject name> <predicate with _ as spaces>". Ids never show.
function tripleLabel(f, subject, objectText, template) {
  if (template && typeof template.label === 'string' && template.label.trim()) {
    return template.label.trim().replaceAll('{subject}', subject.name).replaceAll('{object}', objectText);
  }
  return subject.name + ' ' + f.predicate.replaceAll('_', ' ');
}

// The rows { fact, value, source? } of a triples facts file `data`
// ({ entities, facts, templates }), and how many facts were skipped (an
// unknown subject or object id, or a missing predicate). Entities with no
// id or name are left out, so facts naming them are skipped too.
export function factsFromTriples(data) {
  const entities = new Map();
  (Array.isArray(data.entities) ? data.entities : []).forEach((e) => {
    if (e && typeof e.id === 'string' && e.id && typeof e.name === 'string' && e.name.trim()) entities.set(e.id, { ...e, name: e.name.trim() });
  });
  const templates = new Map();
  (Array.isArray(data.templates) ? data.templates : []).forEach((tp) => {
    if (tp && typeof tp.predicate === 'string' && !templates.has(tp.predicate)) templates.set(tp.predicate, tp);
  });
  const rows = Array.isArray(data.facts) ? data.facts : [];
  const facts = [];
  rows.forEach((f) => {
    if (!f || typeof f !== 'object' || typeof f.predicate !== 'string' || !f.predicate.trim()) return;
    const subject = entities.get(f.subject);
    if (!subject) return;
    const object = typeof f.object === 'number' ? (Number.isFinite(f.object) ? f.object : null) : entities.get(f.object);
    if (object === null || object === undefined) return;
    const value = typeof object === 'number' ? object : object.name;
    facts.push({
      fact: tripleLabel(f, subject, String(value), templates.get(f.predicate)),
      value,
      ...(typeof f.source === 'string' && f.source.trim() ? { source: f.source.trim() } : {}),
    });
  });
  return { facts, skipped: rows.length - facts.length };
}

// Returns the facts list in `file` (relative to lists/), or [] when there
// is none or it can't be had.
export async function fetchFacts(file) {
  if (!file) return [];
  try {
    const res = await fetch('lists/' + file);
    if (!res.ok) { factsWarn('lists/' + file + ' not found (' + res.status + '); the set plays with no facts'); return []; }
    const data = await res.json();
    if (data && !Array.isArray(data) && typeof data === 'object') {
      const { facts, skipped } = factsFromTriples(data);
      if (skipped) factsWarn('lists/' + file + ': ' + skipped + ' bad facts skipped');
      return cleanFacts(facts);
    }
    if (!Array.isArray(data)) { factsWarn('lists/' + file + ' is not a facts file; the set plays with no facts'); return []; }
    const facts = cleanFacts(data);
    if (facts.length < data.length) factsWarn('lists/' + file + ': ' + (data.length - facts.length) + ' bad rows skipped');
    return facts;
  } catch (e) {
    factsWarn('lists/' + file + ' could not be read (' + e.message + '); the set plays with no facts');
    return [];
  }
}

// Returns a subject's term dictionary (lists/dictionaries/<subject>.json),
// or null when the set has no subject, the subject has no dictionary, or it
// can't be fetched. Null just means wrong answers come from the set's own
// answers, as before dictionaries existed.
export async function fetchDictionary(subject) {
  if (!subject) return null;
  try {
    const res = await fetch('lists/dictionaries/' + subject + '.json');
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

// A saved row with the old field names (term, meaning, factNote, fact),
// as sets saved before the rename have, in the new names: question,
// answer, note. The old "fact" flag is dropped. Rows already in the new
// names come back as they are.
export function upgradeOldNames(row) {
  if (!row || typeof row !== 'object') return row;
  const { term, meaning, factNote, fact, ...rest } = row;
  const out = { ...rest };
  if (out.question === undefined && term !== undefined) out.question = term;
  if (out.answer === undefined && meaning !== undefined) out.answer = meaning;
  if (out.note === undefined && factNote !== undefined) out.note = factNote;
  return out;
}

// Returns the item array, or null if no set has that name.
export function loadSavedSet(name) {
  const sets = readCustomSets();
  return sets[name] && Array.isArray(sets[name].data) ? sets[name].data.map(upgradeOldNames) : null;
}

export function deleteSet(name) {
  const sets = readCustomSets();
  delete sets[name];
  return writeCustomSets(sets);
}
