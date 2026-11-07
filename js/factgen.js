// The facts generator (facts list plan step C2): a set's facts and
// templates (lists/facts/<id>.json) make extra questions that join the
// written ones. The author writes only true facts; a template says how a
// question about one predicate is asked. sets.js reads the file and
// calls generateQuestions when a set loads; it also uses tripleEntities and
// tripleTemplates to read the same file for Inference. No DOM access here.
//
// A template's `ask_object` asks for a fact's object ("Name a child of
// {subject}."), its `ask_subject` for its subject ("Who was the father of
// {object}?"). Each way groups first, so a prompt is never asked twice:
// ask_object by (subject, predicate), ask_subject by (predicate, object).
// David's four sons make one "Name a child of David." whose
// `acceptedAnswers` holds all four (and their aliases).
//
// Open lists (Timothy 2026-11-07): the facts may not list every right
// answer (Saul's children in the file: only Michal, not Jonathan). Marking
// "Jonathan" wrong would break the player's trust, so a generated row is
// `openList` unless its template lists that way in `exhaustive`
// (["ask_subject"]: a person has one father). An open row is only ever a
// plain multiple-choice question whose wrong choices come from this file
// alone (quiz.js buildChoices), never a minigame (minigames.js), and it is
// left out when the file gives it fewer than FACT_QUESTIONS.openMinWrong.

import { FACT_QUESTIONS } from './config.js';
import { numberQuestion, normalizeSpaces } from './quiz.js';
import { shuffle } from './random.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// The entities of facts file `data` by id: { id, name, type, aliases }.
// One with no id or no name is left out, so facts naming it are skipped.
// When two share an id, the first one wins.
export function tripleEntities(data) {
  const entities = new Map();
  (Array.isArray(data.entities) ? data.entities : []).forEach((e) => {
    if (!e || typeof e.id !== 'string' || !e.id || entities.has(e.id) || typeof e.name !== 'string' || !e.name.trim()) return;
    const aliases = Array.isArray(e.aliases) ? e.aliases.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()) : [];
    entities.set(e.id, { ...e, name: e.name.trim(), type: typeof e.type === 'string' ? e.type.trim() : '', aliases });
  });
  return entities;
}

// The templates of facts file `data` by predicate (the first one wins).
export function tripleTemplates(data) {
  const templates = new Map();
  (Array.isArray(data.templates) ? data.templates : []).forEach((tp) => {
    if (tp && typeof tp.predicate === 'string' && !templates.has(tp.predicate)) templates.set(tp.predicate, tp);
  });
  return templates;
}

// The good facts of `data`, in file order, with their entities looked up:
// { subject: entity, predicate, object: entity | number, source? }. Facts
// with an unknown id, no predicate or a bad object are left out (sets.js
// counts and warns about those).
function readFacts(data, entities) {
  const out = [];
  (Array.isArray(data.facts) ? data.facts : []).forEach((f) => {
    if (!f || typeof f !== 'object' || typeof f.predicate !== 'string' || !f.predicate.trim()) return;
    const subject = entities.get(f.subject);
    if (!subject) return;
    const object = typeof f.object === 'number' ? (Number.isFinite(f.object) ? f.object : null) : entities.get(f.object);
    if (object === null || object === undefined) return;
    out.push({ subject, predicate: f.predicate, object, source: typeof f.source === 'string' && f.source.trim() ? f.source.trim() : undefined });
  });
  return out;
}

// What a fact's side prints as: an entity's name (never its id), or a number.
function textOf(side) {
  return typeof side === 'number' ? String(side) : side.name;
}

// A case/space-insensitive key for an answer.
function keyOf(text) {
  return normalizeSpaces(String(text)).toLowerCase();
}

// `list` without repeats (by keyOf), first one kept.
function distinct(list) {
  const seen = new Set();
  return list.filter((s) => {
    const k = keyOf(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Every entity that shares a fact with entity `e` (either side, any
// predicate), and `e` itself. These are never offered as wrong answers
// about `e`: a wrong answer about David must not be one of his wives.
function linkedTo(e, facts) {
  const linked = new Set([e]);
  facts.forEach((f) => {
    if (f.subject === e && typeof f.object !== 'number') linked.add(f.object);
    if (f.object === e) linked.add(f.subject);
  });
  return linked;
}

// Wrong entity answers, best first: entities on the asked side of the same
// predicate with the same type, then any entity of that type that some
// fact uses (`inFacts`). Neither tier holds anything `linked` or right
// (`rightKeys`). An empty type matches only other empty types. Returns
// [tier1, tier2] as name lists.
// An entity no fact uses is only a word for wrong choices (the old subject
// dictionary): the file knows nothing about it, so it could be a right
// answer the facts left out (Jonathan for "Name a child of Saul."). It is
// left to buildChoices' word-bank tiers, which an open-list question skips.
function entityWrongTiers(predicateSide, type, linked, rightKeys, inFacts) {
  const fair = e => e.type === type && !linked.has(e) && !rightKeys.has(keyOf(e.name));
  const first = distinct(predicateSide.filter(fair).map(e => e.name));
  const firstKeys = new Set(first.map(keyOf));
  const second = distinct(inFacts.filter(fair).map(e => e.name).filter(n => !firstKeys.has(keyOf(n))));
  return [first, second];
}

// Made-up wrong numbers near `n` (FACT_QUESTIONS.madeUpSpread of it, at
// least 1 either way): whole, at least 1, within the template's `min` /
// `max`, never a right answer. Up to FACT_QUESTIONS.madeUpCount, picked at
// random once when the set loads. Only reached when the set's real
// numbers run short (buildChoices takes tiers in order).
function madeUpNumbers(n, rightKeys, template) {
  const spread = Math.max(1, Math.round(Math.abs(n) * FACT_QUESTIONS.madeUpSpread));
  const low = Math.max(1, Number.isInteger(template.min) ? template.min : 1, Math.round(n) - spread);
  const high = Math.min(Number.isInteger(template.max) ? template.max : Infinity, Math.round(n) + spread);
  const out = [];
  for (let v = low; v <= high; v++) if (!rightKeys.has(String(v))) out.push(String(v));
  return shuffle(out).slice(0, FACT_QUESTIONS.madeUpCount);
}

// Wrong number answers, best first: other values of the same predicate,
// then the set's other number answers (written questions' and every number
// fact's), then made-up ones (madeUpNumbers). Real values always come
// before made-up ones; buildChoices orders each tier nearest first.
function numberWrongTiers(n, predicateNumbers, setNumbers, rightKeys, template) {
  const real = list => distinct(list.map(String).filter(s => !rightKeys.has(s)));
  const first = real(predicateNumbers);
  const firstKeys = new Set(first);
  const second = real(setNumbers).filter(s => !firstKeys.has(s));
  return [first, second, madeUpNumbers(n, rightKeys, template)];
}

// A prompt with {subject} / {object} filled in by `vars` (names or numbers).
function fill(text, vars) {
  let out = text.trim();
  Object.entries(vars).forEach(([k, v]) => { out = out.replaceAll('{' + k + '}', v); });
  return out;
}

// `groups` of facts keyed by `keyFn`, in the order each key first appears.
function groupFacts(facts, keyFn) {
  const groups = new Map();
  facts.forEach((f) => {
    const k = keyFn(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  });
  return [...groups.values()];
}

// One generated question row: the normal question shape plus
// `acceptedAnswers` (every right answer and its aliases), `wrongTiers`
// (buildChoices tries these before its own tiers), `openList` (see the
// top: unless the template's `exhaustive` lists `way`), `fromFacts` (the
// triples in `group` as the file writes them, ids not names, and `asks`:
// which side the question asks for; DATA.SYS shows them) and
// `generated: true`.
// `answers` are the asked side of each fact in `group` (file order: the
// first is `answer`, so it stays the same for review).
function questionRow(prompt, answers, group, wrongTiers, template, way) {
  const right = distinct(answers.map(textOf));
  const aliases = answers.flatMap(a => (typeof a === 'number' ? [] : a.aliases));
  const sources = distinct(group.map(f => f.source).filter(Boolean));
  const first = answers[0];
  const difficulty = String(template.difficulty || '').toLowerCase();
  return {
    question: prompt,
    answer: right[0],
    acceptedAnswers: distinct([...right, ...aliases]),
    wrongTiers,
    answerType: typeof first === 'number' ? 'number' : (first.type || undefined),
    category: typeof template.category === 'string' && template.category.trim() ? template.category.trim() : FACT_QUESTIONS.category,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : FACT_QUESTIONS.difficulty,
    source: sources.length ? sources.join('; ') : undefined,
    openList: !(Array.isArray(template.exhaustive) && template.exhaustive.includes(way)) || undefined,
    fromFacts: group.map(f => ({
      subject: f.subject.id,
      predicate: f.predicate,
      object: typeof f.object === 'number' ? f.object : f.object.id,
      asks: way === 'ask_subject' ? 'subject' : 'object',
    })),
    generated: true,
  };
}

// The questions facts file `data` makes ({ entities, facts, templates }):
// for each template in file order, its ask_object questions, then its
// ask_subject ones. A prompt that is already a written question in
// `written` (the set's own rows, same text) is left out: the written one
// stays. An old plain-array file, or a file with no templates, makes none.
export function generateQuestions(data, written = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const entities = tripleEntities(data);
  const facts = readFacts(data, entities);
  const used = new Set(facts.flatMap(f => [f.subject, f.object]));
  const inFacts = [...entities.values()].filter(e => used.has(e));
  const writtenKeys = new Set(written.map(q => keyOf(q.question || '')));
  const setNumbers = [
    ...written.map(numberQuestion).filter(n => n && !n.unit).map(n => n.value),
    ...facts.filter(f => typeof f.object === 'number').map(f => f.object),
  ];
  const rows = [];
  const add = (row) => {
    if (writtenKeys.has(keyOf(row.question))) return;
    // An open row has only this file's wrong answers to offer.
    if (row.openList && distinct(row.wrongTiers.flat()).length < FACT_QUESTIONS.openMinWrong) return;
    writtenKeys.add(keyOf(row.question));
    rows.push(row);
  };

  tripleTemplates(data).forEach((template, predicate) => {
    const same = facts.filter(f => f.predicate === predicate);
    if (!same.length) return;

    if (typeof template.ask_object === 'string' && template.ask_object.trim()) {
      groupFacts(same, f => f.subject.id).forEach((group) => {
        const subject = group[0].subject;
        const answers = group.map(f => f.object);
        const rightKeys = new Set(answers.map(a => keyOf(textOf(a))));
        const first = answers[0];
        const tiers = typeof first === 'number'
          ? numberWrongTiers(first, same.map(f => f.object).filter(o => typeof o === 'number'), setNumbers, rightKeys, template)
          : entityWrongTiers(same.map(f => f.object).filter(o => typeof o !== 'number'), first.type, linkedTo(subject, facts), rightKeys, inFacts);
        add(questionRow(fill(template.ask_object, { subject: subject.name }), answers, group, tiers, template, 'ask_object'));
      });
    }

    if (typeof template.ask_subject === 'string' && template.ask_subject.trim()) {
      groupFacts(same, f => (typeof f.object === 'number' ? '#' + f.object : f.object.id)).forEach((group) => {
        const object = group[0].object;
        const answers = group.map(f => f.subject);
        const rightKeys = new Set(answers.map(a => keyOf(a.name)));
        const linked = typeof object === 'number' ? new Set(answers) : linkedTo(object, facts);
        const tiers = entityWrongTiers(same.map(f => f.subject), answers[0].type, linked, rightKeys, inFacts);
        add(questionRow(fill(template.ask_subject, { object: textOf(object) }), answers, group, tiers, template, 'ask_subject'));
      });
    }
  });
  return rows;
}
