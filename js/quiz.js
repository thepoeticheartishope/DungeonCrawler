// Question/answer data logic: sample lists, custom-list parsing, question
// selection, and multiple-choice option building. No DOM access here.

import { state } from './state.js';
import { TYPING_SAMPLE_DATA, MC_SAMPLE_DATA, ENCOUNTER_GLYPHS, CATEGORY_LABELS, ANSWER_TYPE_GROUPS, EXPLICIT_ANSWER_TERMS, TYPE_CHOICE_MIN, TYPE_SPLIT_DOMINANCE, CHOICE_TYPES, NO_REPEAT_CHOICE_TYPES, NUMBER_NEAR_POOL, STEM_CUES } from './config.js';
import { t } from './text.js';

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// Whichever built-in list matches the current mode (used whenever no
// custom list has been loaded).
export function defaultSample(mcMode) {
  return mcMode ? MC_SAMPLE_DATA : TYPING_SAMPLE_DATA;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parses pasted text as either a JSON array of {term, meaning} objects,
// or plain lines of "TERM | Meaning". Returns { data } or { error }, with
// an optional { warning } when some lines had to be skipped.
export function parseListInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Paste a list or choose a file first.' };

  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      return { error: 'That JSON could not be parsed. Check the format.' };
    }
    if (!Array.isArray(parsed)) return { error: 'JSON must be an array of {"term","meaning"} objects.' };
    const cleaned = parsed
      .map(item => {
        const category = String((item && item.category) || '').trim();
        const rawDifficulty = String((item && item.difficulty) || '').trim().toLowerCase();
        const source = String((item && item.source) || '').trim();
        const image = String((item && item.image) || '').trim();
        const answerType = String((item && item.answerType) || '').trim();
        return {
          term: String((item && item.term) || '').trim(),
          meaning: String((item && item.meaning) || '').trim(),
          options: Array.isArray(item && item.options)
            ? item.options.map(o => String(o).trim()).filter(Boolean)
            : undefined,
          category: category || undefined,
          difficulty: VALID_DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'medium',
          source: source || undefined,
          image: image || undefined,
          answerType: answerType || undefined,
          draft: (item && item.draft === true) || undefined,
          fact: typeof (item && item.fact) === 'boolean' ? item.fact : undefined,
          factNote: (item && typeof item.factNote === 'string' && item.factNote.trim()) || undefined
        };
      })
      .filter(item => item.term && item.meaning);
    if (cleaned.length < 2) return { error: 'Need at least 2 valid entries with both a prompt and an answer.' };
    return { data: cleaned };
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  const cleaned = [];
  const badLines = [];
  lines.forEach((line, i) => {
    const idx = line.indexOf('|');
    if (idx === -1) { badLines.push(i + 1); return; }
    const term = line.slice(0, idx).trim();
    const meaning = line.slice(idx + 1).trim();
    if (term && meaning) cleaned.push({ term, meaning });
    else badLines.push(i + 1);
  });

  if (cleaned.length < 2) return { error: 'Need at least 2 valid "Prompt | Answer" lines.' };
  const result = { data: cleaned };
  if (badLines.length > 0) {
    result.warning = 'Skipped line' + (badLines.length > 1 ? 's' : '') + ' ' + badLines.join(', ') + ' (missing a "|" separator).';
  }
  return result;
}

// Picks a random term from `pool` (the full active list, by default),
// avoiding an immediate repeat of whatever question is currently showing.
export function pickQuestion(exclude, pool) {
  pool = pool || state.settings.activeData;
  let candidates = pool;
  if (exclude && pool.length > 1) {
    candidates = pool.filter(d => d.term !== exclude.term);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Which pool a question should be drawn from for the given target: an
// encounter's own category pool, or the full active list for anything else
// (boss, minion, chest, rune, or no target at all).
export function poolFor(target) {
  return target && target.kind === 'encounter' ? target.pool : state.settings.activeData;
}

function groupBy(pool, keyFn) {
  const groups = new Map();
  pool.forEach(item => {
    const k = keyFn(item);
    if (!k) return;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  });
  return groups;
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

// A pool's category groups, each split further by answer type wherever a
// type has at least TYPE_CHOICE_MIN questions in that category ("OT ·
// Names"); the category's remaining questions stay together under its
// plain label ("OT"), so no question is lost. A category isn't split at
// all when one type already makes up TYPE_SPLIT_DOMINANCE of it (the
// "Names" cards are almost all names — "Names · Names" says nothing), and
// if the leftover group would be smaller than TYPE_CHOICE_MIN, the
// smallest type groups are folded back into it, so no choice is so thin it
// keeps repeating. Types without a type.* line in text.js, or whose label
// matches the category's, aren't split out.
function categoryTypeGroups(pool) {
  const out = [];
  groupBy(pool, d => d.category).forEach((items, category) => {
    const catLabel = categoryLabel(category);
    const byType = groupBy(items, d => d.answerType);
    const largest = Math.max(0, ...[...byType.values()].map(g => g.length));
    const splittable = largest < items.length * TYPE_SPLIT_DOMINANCE;
    let rest = items.filter(d => !d.answerType);
    const typedGroups = [];
    byType.forEach((typed, type) => {
      const typeLabel = t('type.' + type);
      if (splittable && typed.length >= TYPE_CHOICE_MIN && typeLabel !== 'type.' + type && typeLabel !== catLabel) {
        typedGroups.push({ label: catLabel + ' · ' + typeLabel, category, pool: typed });
      } else {
        rest.push(...typed);
      }
    });
    typedGroups.sort((a, b) => a.pool.length - b.pool.length);
    while (rest.length && rest.length < TYPE_CHOICE_MIN && typedGroups.length) {
      rest = rest.concat(typedGroups.shift().pool);
    }
    out.push(...typedGroups);
    if (rest.length) out.push({ label: catLabel, category, pool: rest });
  });
  return out;
}

// A pool's answer-type groups ("Names", "Things" ...; CHOICE_TYPES), each
// { label, category, choiceType, pool } — category holds the choice type
// too, so the "one group per category" spread below applies unchanged.
// Only types with at least TYPE_CHOICE_MIN questions and a type.* line in
// text.js are kept; questions of other types aren't in any group.
function answerTypeGroups(pool) {
  const out = [];
  groupBy(pool, d => CHOICE_TYPES[d.answerType]).forEach((items, choiceType) => {
    const label = t('type.' + choiceType);
    if (items.length >= TYPE_CHOICE_MIN && label !== 'type.' + choiceType) {
      out.push({ label, category: choiceType, choiceType, pool: items });
    }
  });
  return out;
}

// Every group a fight over `pool` can offer: answer types when the pool has
// at least `count` of them, otherwise categories — each split by answer
// type where there are enough questions (categoryTypeGroups) when the pool
// has at least `count` categories, else category + difficulty (small sets
// with only a couple of categories).
function fightGroups(pool, count) {
  const byType = answerTypeGroups(pool);
  if (byType.length >= count) return byType;
  if (groupBy(pool, d => d.category).size >= count) return categoryTypeGroups(pool);
  const pairs = groupBy(pool, d => d.category && d.category + '\u0000' + (d.difficulty || 'medium'));
  return Array.from(pairs.entries()).map(([k, items]) => {
    const [category, difficulty] = k.split('\u0000');
    return { label: categoryLabel(category) + ' · ' + difficulty, category, pool: items };
  });
}

// The questions of `pool` a fight can actually offer as a choice (a rune
// hints at one of these, so its hint can't land on a question no choice
// holds). Falls back to the whole pool when no group forms at all.
export function fightChoosable(pool, count) {
  const groups = fightGroups(pool, count);
  return groups.length ? groups.flatMap(g => g.pool) : pool;
}

// The label of the fight choice that holds `item` ("Names"), or null.
export function fightChoiceLabel(item, pool, count) {
  const g = fightGroups(pool, count).find(g => g.pool.includes(item));
  return g ? g.label : null;
}

// The battle screen's category choices for one turn: up to `count` groups
// of `pool` (fightGroups), each { label, category, pool }. One group per
// category is taken first so the choices stay as varied as possible. If
// `mustInclude` is in the pool, its group is always one of the choices (a
// rune's hint stays usable). A NO_REPEAT_CHOICE_TYPES type the player
// picked last turn (`lastChoiceType`) sits this turn out, unless it holds
// the hint or dropping it would leave fewer than `count` choices. Returns
// fewer than 2 choices when the pool can't offer a real choice (e.g. a
// pasted list with no categories) — the caller skips the choice step then.
export function buildCategoryChoices(pool, count, mustInclude, lastChoiceType) {
  let groups = fightGroups(pool, count);
  const required = mustInclude && groups.find(g => g.pool.includes(mustInclude));
  if (lastChoiceType && NO_REPEAT_CHOICE_TYPES.includes(lastChoiceType)) {
    const rested = groups.filter(g => g.choiceType !== lastChoiceType || g === required);
    if (rested.length >= count) groups = rested;
  }

  const all = shuffle(groups);
  const picked = [];
  if (required) picked.push(required);
  for (const g of all) {
    if (picked.length >= count) break;
    if (!picked.includes(g) && !picked.some(p => p.category === g.category)) picked.push(g);
  }
  for (const g of all) {
    if (picked.length >= count) break;
    if (!picked.includes(g)) picked.push(g);
  }
  return shuffle(picked);
}

// Deterministic glyph for a category name, so the same category always
// renders the same encounter icon. Uses djb2 (a standard string hash with
// decent bit dispersion) rather than a plain char-code sum — a sum collides
// constantly for short, similar-length names (e.g. "Hardware" and
// "Networking" land on the same bucket), which defeats the point when a
// room can show a few categories side by side.
export function glyphForCategory(category) {
  let hash = 5381;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash * 33) ^ category.charCodeAt(i)) >>> 0;
  }
  return ENCOUNTER_GLYPHS[hash % ENCOUNTER_GLYPHS.length];
}

// Bundled-set images are authored as plain relative paths (e.g.
// "images/cpu-chip.svg") resolved against the lists/ folder they ship
// alongside; a custom list can instead give a full URL (http(s):// or a
// data: URI) if the author wants to reference something external, at the
// cost of it not being cached for offline play.
export function resolveImageSrc(image) {
  if (!image) return null;
  if (/^(https?:|data:)/i.test(image)) return image;
  return 'lists/' + image;
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function normalizeSpaces(s) {
  return s.trim().replace(/\s+/g, ' ');
}

// Shuffles `meanings` and returns the distinct ones (case/space-insensitive,
// first occurrence wins), so two different questions that happen to share
// an answer (e.g. two "who wrote this?" entries both answered "John") never
// both land in the same choice list looking like duplicate options.
function distinctMeanings(meanings) {
  const seen = new Set();
  const out = [];
  for (const m of shuffle(meanings)) {
    const key = normalizeSpaces(m).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

// A case/space-insensitive key for an answer's spelling.
function spellingKey(s) {
  return normalizeSpaces(String(s)).toLowerCase();
}

// Every spelling in `dictionary` (each entry's term and "aka"s) -> its
// entries, built once per dictionary. A name and a book can share a
// spelling ("Jonah"), so a spelling can hold more than one entry.
const spellingMaps = new WeakMap();
function spellingsOf(dictionary) {
  if (spellingMaps.has(dictionary)) return spellingMaps.get(dictionary);
  const map = new Map();
  for (const e of dictionary) {
    for (const spelling of [e.term, ...(e.aka || [])]) {
      const k = spellingKey(spelling);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
  }
  spellingMaps.set(dictionary, map);
  return map;
}

// The dictionary entry an answer stands for (by term or "aka", same type
// first), or null when it has none.
function dictionaryEntry(dictionary, meaning, type) {
  const found = spellingsOf(dictionary).get(spellingKey(meaning)) || [];
  return found.find(e => e.type === type) || found[0] || null;
}

// Whether dictionary entry `e` shares a part with `own`, an answer named
// through another person ("of" / "relation": "Lot's wife" and "Lot's
// daughters" share Lot; "Pharaoh's daughter" and "Jairus' daughter" share
// daughter). Those are the closest wrong answers: the player has to know
// exactly which wife or which daughter.
function sharesPart(e, own) {
  if (!own || !own.of || !e.of) return false;
  const rel = s => String(s || '').toLowerCase().replace(/s$/, '');
  return e.of === own.of || rel(e.relation) === rel(own.relation);
}

// How alike two acronyms look: 2 when they share their first two letters
// (RAM / RAID), 1 for the first letter only (RAM / RSA), else 0. For an
// acronym question the right answer's initials match the acronym, so wrong
// answers with other initials would give it away; look-alike acronyms'
// definitions start with the same letters too, and they're real terms.
function acronymLikeness(e, own) {
  if (!own || !own.acronym || !e.acronym) return 0;
  const a = own.acronym.toUpperCase();
  const b = e.acronym.toUpperCase();
  if (a.slice(0, 2) === b.slice(0, 2)) return 2;
  return a[0] === b[0] ? 1 : 0;
}

// What kind of answer an entry is: a plain term, a description ("The
// gardener") or a list of several terms ("Abraham and Sarah"). A choice
// list keeps to one kind, so the right answer can't stand out as the only
// description among names.
function entryForm(e) {
  if (e.description) return 'description';
  if (e.list) return 'list';
  return 'term';
}

// The number an answer states, with any unit after it ("8 GB" -> { value:
// 8, unit: 'gb' }), or null when the answer doesn't start with a number.
// Commas are thousands separators ("144,000"). A unit can't hold digits,
// so a verse address ("1 Corinthians 1:27") isn't a number.
export function numericAnswer(s) {
  const m = /^\s*(-?\d[\d,]*(?:\.\d+)?)\s*([^\d]*)$/.exec(String(s));
  if (!m) return null;
  const value = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return { value, unit: normalizeSpaces(m[2]).toLowerCase() };
}

// Whether `item` is a number question, for any set: its answerType is in
// the number shape, or it has no answerType and its answer is a number
// (a pasted list), or its answer is a bare number whatever its type. A
// typed non-number answer with words after the number ("1 Corinthians",
// a book) is not.
function numberQuestion(item) {
  const n = numericAnswer(item.meaning);
  if (!n) return null;
  if (ANSWER_TYPE_GROUPS[item.answerType] === 'number' || !item.answerType || !n.unit) return n;
  return null;
}

// How far apart two numbers are in size (ratio, not difference: 2 vs 3 is
// as far as 2000 vs 3000).
function numberDistance(a, b) {
  return Math.abs(Math.log((Math.abs(a) + 1) / (Math.abs(b) + 1)));
}

// `meanings` reordered for a number question `n`: numbers with the same
// unit first, nearest in size first (the NUMBER_NEAR_POOL nearest
// shuffled, see below), then everything else in its old order.
function nearestNumbersFirst(meanings, n) {
  const near = [];
  const rest = [];
  for (const m of meanings) {
    const v = numericAnswer(m);
    if (v && v.unit === n.unit && v.value !== n.value) near.push({ m, d: numberDistance(v.value, n.value) });
    else if (!v || v.value !== n.value || v.unit !== n.unit) rest.push(m);
  }
  near.sort((a, b) => a.d - b.d);
  // Shuffle the 3 nearest together with any others no more than twice as
  // far as the 3rd nearest (up to NUMBER_NEAR_POOL), so a set dense in
  // numbers varies its choices but a sparse one never reaches far ones.
  const third = near.length >= 3 ? near[2].d : Infinity;
  let cut = Math.min(3, near.length);
  while (cut < Math.min(NUMBER_NEAR_POOL, near.length) && near[cut].d <= third * 2) cut++;
  const ordered = near.map(x => x.m);
  return [...shuffle(ordered.slice(0, cut)), ...ordered.slice(cut), ...rest];
}

// The answer types a question's stem allows (STEM_CUES in config.js:
// "Who…?" -> the person types), or null when no cue matches.
export function stemTypes(question) {
  const stem = normalizeSpaces(String(question || ''));
  const found = STEM_CUES.find(c => c.cue.test(stem));
  return found ? found.types : null;
}

// A question's answer type: its tag, or for an untagged question (a
// pasted list) the first type its stem allows, or undefined.
function answerTypeOf(d) {
  if (d.answerType) return d.answerType;
  const types = stemTypes(d.term);
  return types ? types[0] : undefined;
}

// Builds 2-4 answer choices for a question. Uses the item's own "options"
// list if the loaded JSON provided one (adding the correct meaning in if
// it's missing); otherwise picks up to 3 wrong answers, in tiers, topping
// up from the next tier only when the previous runs out.
//
// When the set has a subject dictionary (state.settings.activeDictionary,
// lists/dictionaries/) and the question has an answerType, the first tiers
// are dictionary entries of that type: for a person named through another
// ("Pharaoh's daughter"), ones sharing a part first ("Jairus' daughter",
// "Pharaoh's ..."; sharesPart), and for an acronym's definition ones whose
// acronym looks alike (same first two letters, then first letter;
// acronymLikeness); then same kind (term / description / list, entryForm)
// and same draft status, then same kind, then any kind.
// The dictionary holds every term of the subject, not just the answers of
// the set in play, so a small set still gets close wrong answers.
//
// Then the answers of the other questions in the set: same answerType and
// same draft status (a one-word answer isn't offered next to multi-word
// draft answers), then same answerType, then the same top-level shape
// (ANSWER_TYPE_GROUPS in config.js: another noun for a noun), again
// draft-matched first, then (for a number question) any number with the
// same unit, then anything. For a number question each tier offers the
// numbers nearest in size first (nearestNumbersFirst), so this works for
// any set, typed or not.
//
// The stem lock (STEM_CUES): when the stem allows a set of types and the
// question's type is one of them, every tier above keeps to those types
// first, plus a tier of any allowed type (dictionary, then set) before the
// shape tiers: a "Who…?" question short of relatives gets other people,
// never a place. Only when the allowed types can't fill the choices do the
// shape and "anything" tiers run again without the lock. An untagged
// question takes its type from its stem (answerTypeOf), so a pasted list
// of "Who…?" and "How many…?" questions gets the same matching.
//
// A wrong answer is never the right answer under another spelling: an
// answer the dictionary lists as an "aka" counts as its entry's term
// ("David's" is David), and is shown as that term.
export function buildChoices(item) {
  let opts;
  if (Array.isArray(item.options) && item.options.length >= 2) {
    opts = item.options.slice();
    const hasCorrect = opts.some(o => normalizeSpaces(o).toLowerCase() === normalizeSpaces(item.meaning).toLowerCase());
    if (!hasCorrect) opts.push(item.meaning);
  } else {
    const dictionary = state.settings.activeDictionary || [];
    const itemType = answerTypeOf(item);
    const allowed = stemTypes(item.term);
    const lock = allowed && allowed.includes(itemType) ? allowed : null;
    const fits = type => !lock || lock.includes(type);
    const own = dictionaryEntry(dictionary, item.meaning, itemType);
    // A set answer's shown spelling: its dictionary entry's term, if any.
    const shown = m => { const e = dictionaryEntry(dictionary, m); return e ? e.term : m; };
    const rightKey = spellingKey(shown(item.meaning));
    const isWrong = m => spellingKey(shown(m)) !== rightKey && !EXPLICIT_ANSWER_TERMS.test(m);

    const dictPool = itemType
      ? dictionary.filter(e => e.type === itemType && isWrong(e.term))
      : [];
    const allowedDict = lock ? dictionary.filter(e => e.type !== itemType && fits(e.type) && isWrong(e.term)) : [];
    const sameForm = e => !own || entryForm(e) === entryForm(own);
    const sameDraft = d => !d.draft === !item.draft;

    const basePool = state.settings.activeData.filter(d => d !== item && isWrong(d.meaning));
    const typedPool = itemType
      ? basePool.filter(d => answerTypeOf(d) === itemType)
      : [];
    const allowedSet = lock ? basePool.filter(d => fits(answerTypeOf(d))) : [];
    const group = ANSWER_TYPE_GROUPS[itemType];
    const groupPool = group
      ? basePool.filter(d => ANSWER_TYPE_GROUPS[answerTypeOf(d)] === group)
      : [];
    const locked = items => items.filter(d => fits(answerTypeOf(d)));
    const num = numberQuestion(item);
    const numberPool = num
      ? basePool.filter(d => { const v = numericAnswer(d.meaning); return v && v.unit === num.unit; })
      : [];
    const terms = entries => entries.map(e => e.term);
    const meanings = items => items.map(d => shown(d.meaning));
    const tiers = [
      terms(dictPool.filter(e => sharesPart(e, own) && sameForm(e) && sameDraft(e))),
      terms(dictPool.filter(e => acronymLikeness(e, own) === 2)),
      terms(dictPool.filter(e => acronymLikeness(e, own) === 1)),
      terms(dictPool.filter(e => sameForm(e) && sameDraft(e))),
      terms(dictPool.filter(sameForm)),
      terms(dictPool),
      meanings(typedPool.filter(sameDraft)),
      meanings(typedPool),
      terms(allowedDict.filter(sameForm)),
      terms(allowedDict),
      meanings(allowedSet),
      meanings(locked(groupPool).filter(sameDraft)),
      meanings(locked(groupPool)),
      meanings(locked(numberPool)),
      meanings(locked(basePool)),
      // Soft lock: reached only when the allowed types can't fill the choices.
      meanings(groupPool),
      meanings(numberPool),
      meanings(basePool)
    ];
    const distractors = [];
    const seen = new Set();
    for (const tier of tiers) {
      const distinct = distinctMeanings(tier);
      for (const m of num ? nearestNumbersFirst(distinct, num) : distinct) {
        if (distractors.length >= 3) break;
        const v = num && numericAnswer(m);
        const key = v ? v.value + ' ' + v.unit : spellingKey(m);
        if (seen.has(key)) continue;
        seen.add(key);
        distractors.push(m);
      }
    }
    opts = [item.meaning, ...distractors];
  }
  return shuffle(opts).slice(0, 4);
}

// Builds a short clue from a question's meaning: first letter, word
// count, and character count — enough to help without giving it away.
export function buildHint(q) {
  const meaning = q.meaning.trim();
  const words = meaning.split(/\s+/);
  return t('hint.shape', { first: words[0], words: words.length, chars: meaning.length });
}
