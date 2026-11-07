// Item-set storage: bundled sets shipped with the app (fetched from
// lists/), and player-saved custom sets (browser localStorage). No DOM
// access here — main.js wires this into the UI.

import { tripleEntities, tripleTemplates, generateQuestions } from './factgen.js';

const CUSTOM_SETS_KEY = 'termDungeon.customSets';

// ---- Bundled sets (lists/manifest.json + lists/<file>.json) ----
//
// Each manifest entry: { id, subject, name, description, file, facts? }
// (facts: the set's facts file, see fetchFacts below). Sets with
// the same "subject" (e.g. both Bible sets are "bible") cover the same
// material; CompTIA subjects are per exam ("comptia-aplus"). Wrong answers
// are drawn from the set's facts file entities (wordBank below), for every
// kind of set.

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
//   { entities: [{ id, name, type, aliases?, acronym?, of?, relation?,
//                  description?, list?, draft? }],
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
// id or name are left out, so facts naming them are skipped too
// (factgen.js tripleEntities, shared with the question generator).
export function factsFromTriples(data) {
  const entities = tripleEntities(data);
  const templates = tripleTemplates(data);
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

// Returns the facts file `file` (relative to lists/) as read: a triples
// object, an old plain array, or null when there is none or it can't be
// had. factRows reads it for Inference; factgen.js generateQuestions for
// the questions it makes.
export async function fetchFacts(file) {
  if (!file) return null;
  try {
    const res = await fetch('lists/' + file);
    if (!res.ok) { factsWarn('lists/' + file + ' not found (' + res.status + '); the set plays with no facts'); return null; }
    const data = await res.json();
    if (data && typeof data === 'object') return data;
    factsWarn('lists/' + file + ' is not a facts file; the set plays with no facts');
    return null;
  } catch (e) {
    factsWarn('lists/' + file + ' could not be read (' + e.message + '); the set plays with no facts');
    return null;
  }
}

// The facts list rows { fact, value, source? } of facts file `data` (as
// fetchFacts gave it; `file` names it in warnings), or [] for none.
export function factRows(data, file = 'facts') {
  if (!data) return [];
  if (!Array.isArray(data)) {
    const { facts, skipped } = factsFromTriples(data);
    if (skipped) factsWarn('lists/' + file + ': ' + skipped + ' bad facts skipped');
    return cleanFacts(facts);
  }
  const facts = cleanFacts(data);
  if (facts.length < data.length) factsWarn('lists/' + file + ': ' + (data.length - facts.length) + ' bad rows skipped');
  return facts;
}

// The word bank wrong answers are drawn from (quiz.js buildChoices) for
// facts file `data`: every entity, as { term, type, aka?, acronym?, of?,
// relation?, description?, list?, draft? }. An entity no fact uses is a
// word kept as a wrong choice (the subject dictionaries moved into the
// entities, dictionary-entities plan). Fields of the wrong kind are left
// out, so a teacher's file can't break buildChoices. No facts file (or an
// old plain-array one): [], and wrong answers come from the set's own
// answers.
export function wordBank(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const text = v => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return [...tripleEntities(data).values()].map((e) => {
    const word = { term: e.name, type: e.type };
    if (e.aliases.length) word.aka = e.aliases;
    for (const f of ['acronym', 'of', 'relation']) if (text(e[f])) word[f] = text(e[f]);
    for (const f of ['description', 'list', 'draft']) if (e[f] === true) word[f] = true;
    return word;
  });
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

// A set's written questions `data` with the questions its facts file
// `factsFile` makes (factgen.js, tagged `generated`) after them, unless
// `makeQuestions` is false (DEV -> Fact Qs off), and the facts rows for
// Inference: { data, facts }. No facts file: `data` as it is and [].
export function withFacts(data, factsFile, makeQuestions = true, file = 'facts') {
  const made = factsFile && makeQuestions ? generateQuestions(factsFile, data) : [];
  return { data: [...data, ...made], facts: factRows(factsFile, file) };
}

// [{name, savedAt, count}], most recently saved first. `count` takes in
// the questions the set's facts make.
export function listSavedSets() {
  const sets = readCustomSets();
  return Object.keys(sets)
    .map((name) => {
      const data = Array.isArray(sets[name].data) ? sets[name].data : [];
      return { name, savedAt: sets[name].savedAt, count: withFacts(data, sets[name].facts || null).data.length };
    })
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// Overwrites any existing set with the same name. `facts` is a teacher's
// facts parts { entities, facts, templates } (facts list plan step D), or
// null for none; it is kept beside the questions.
export function saveSet(name, data, facts = null) {
  const sets = readCustomSets();
  sets[name] = facts ? { data, facts, savedAt: Date.now() } : { data, savedAt: Date.now() };
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

// The facts parts a saved set was saved with, or null for none (sets
// saved before step D, or with no facts).
export function loadSavedFacts(name) {
  const sets = readCustomSets();
  const facts = sets[name] && sets[name].facts;
  return facts && typeof facts === 'object' && !Array.isArray(facts) ? facts : null;
}

export function deleteSet(name) {
  const sets = readCustomSets();
  delete sets[name];
  return writeCustomSets(sets);
}
