// Checks a teacher's facts (facts list plan step D): the entities, facts
// and templates parts of an uploaded file. A teacher's file never goes
// through tools/validate.py, so this is where its mistakes are found and
// named, by row and reason, in plain words. No DOM access here.
//
// checkFacts({ entities, facts, templates }) returns
//   { clean: { entities, facts, templates }, problems: [{ skipped, text }] }
// `clean` keeps only the good rows (the generator and Inference read it).
// A problem with `skipped: true` dropped its row; one with `skipped: false`
// kept it but warns that it does nothing, or looks wrong to the player.
// Fields with safe defaults (source, aliases, category, difficulty, min,
// max, label) get no message.
//
// The rules follow tools/validate.py's facts checks (bundled sets). That
// script is stricter (id spelling, CompTIA sources, label length), as a
// bundled set must pass all of them; this one only drops what would break.

const PARTS = ['entities', 'facts', 'templates'];
const PLACEHOLDER = /\{([^{}]*)\}/g;
const NUMBER_TEXT = /^\s*-?\d+(\.\d+)?\s*$/;

function show(value) {
  return value === undefined ? 'nothing' : JSON.stringify(value);
}

function isText(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// The rows of part `name` of `data`, or [] with a problem when it is not a list.
function partRows(data, name, problems) {
  if (data[name] === undefined) return [];
  if (Array.isArray(data[name])) return data[name];
  problems.push({ skipped: true, text: '"' + name + '" must be a list [ ... ]; it is skipped' });
  return [];
}

export function checkFacts(data) {
  const problems = [];
  const skip = text => problems.push({ skipped: true, text });
  const warn = text => problems.push({ skipped: false, text });
  const clean = { entities: [], facts: [], templates: [] };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { clean, problems };

  // Entities: an id and a name; the first one with an id wins.
  const ids = new Map(); // id -> row number
  partRows(data, 'entities', problems).forEach((e, i) => {
    const tag = 'entity #' + (i + 1);
    if (!e || typeof e !== 'object' || Array.isArray(e)) { skip(tag + ': must be { "id", "name", "type" }; skipped'); return; }
    if (!isText(e.id)) { skip(tag + ': no "id"; skipped'); return; }
    if (ids.has(e.id)) { skip(tag + ': id "' + e.id + '" is already entity #' + ids.get(e.id) + '; skipped'); return; }
    ids.set(e.id, i + 1);
    if (!isText(e.name)) { skip(tag + ' "' + e.id + '": no "name"; skipped, and every fact that uses it'); return; }
    clean.entities.push(e);
  });
  const entities = new Map(clean.entities.map(e => [e.id, e]));
  // How a fact names an id that is not a kept entity.
  const notEntity = id => (ids.has(id) && !entities.has(id) ? 'is entity #' + ids.get(id) + ', which was skipped' : 'is not an entity id');

  // Templates: a predicate, one template per predicate.
  const templateRow = new Map(); // predicate -> row number
  partRows(data, 'templates', problems).forEach((tp, i) => {
    const tag = 'template #' + (i + 1);
    if (!tp || typeof tp !== 'object' || Array.isArray(tp) || !isText(tp.predicate)) { skip(tag + ': no "predicate"; skipped'); return; }
    if (templateRow.has(tp.predicate)) { skip(tag + ': predicate "' + tp.predicate + '" already has template #' + templateRow.get(tp.predicate) + '; skipped'); return; }
    templateRow.set(tp.predicate, i + 1);
    ['ask_object', 'ask_subject', 'label'].forEach((key) => {
      if (typeof tp[key] !== 'string') return;
      [...tp[key].matchAll(PLACEHOLDER)].forEach(([whole, inner]) => {
        if (inner !== 'subject' && inner !== 'object') warn(tag + ': "' + whole + '" in "' + key + '" is not {subject} or {object}; it shows as typed');
      });
    });
    clean.templates.push(tp);
  });

  // Facts: subject an entity id, a predicate, object an entity id or a number.
  const seen = new Map(); // subject|predicate|object -> row number
  partRows(data, 'facts', problems).forEach((f, i) => {
    const tag = 'fact #' + (i + 1);
    if (!f || typeof f !== 'object' || Array.isArray(f)) { skip(tag + ': must be { "subject", "predicate", "object" }; skipped'); return; }
    if (!entities.has(f.subject)) { skip(tag + ': subject ' + show(f.subject) + ' ' + notEntity(f.subject) + '; skipped'); return; }
    if (!isText(f.predicate)) { skip(tag + ': no "predicate"; skipped'); return; }
    const obj = f.object;
    if (typeof obj === 'string' && !entities.has(obj) && NUMBER_TEXT.test(obj)) {
      skip(tag + ': object "' + obj + '" has quotes; write ' + obj.trim() + ' without quotes; skipped'); return;
    }
    if (typeof obj === 'number' ? !Number.isFinite(obj) : !entities.has(obj)) {
      skip(tag + ': object ' + show(obj) + ' ' + (ids.has(obj) ? notEntity(obj) : 'is not an entity id or a number') + '; skipped'); return;
    }
    const key = f.subject + '|' + f.predicate + '|' + (typeof obj === 'number' ? '#' + obj : obj);
    if (seen.has(key)) { skip(tag + ': same as fact #' + seen.get(key) + '; skipped'); return; }
    seen.set(key, i + 1);
    clean.facts.push(f);
  });

  // Rows that are kept but would do nothing.
  const used = new Map(); // predicate -> fact count
  clean.facts.forEach(f => used.set(f.predicate, (used.get(f.predicate) || 0) + 1));
  used.forEach((count, predicate) => {
    if (!templateRow.has(predicate)) warn('predicate "' + predicate + '" has no template, so its ' + count + (count === 1 ? ' fact makes' : ' facts make') + ' no questions');
  });
  templateRow.forEach((row, predicate) => {
    if (!used.has(predicate)) warn('template #' + row + ': no fact uses predicate "' + predicate + '"');
  });

  // A type that only one entity has: its questions have few wrong choices.
  const byType = new Map();
  clean.entities.forEach((e) => {
    const type = typeof e.type === 'string' ? e.type.trim() : '';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(e);
  });
  if (clean.entities.length > 1) {
    byType.forEach((list, type) => {
      if (list.length === 1) warn('entity #' + ids.get(list[0].id) + ' "' + list[0].id + '": no other entity has type ' + show(type || undefined) + ', so its questions have few wrong choices');
    });
  }

  return { clean, problems };
}

// Whether `data` has any facts part (an uploaded object, not a plain list).
export function hasFactParts(data) {
  return Boolean(data && typeof data === 'object' && !Array.isArray(data) && PARTS.some(p => data[p] !== undefined));
}
