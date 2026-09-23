// Question/answer data logic: sample lists, custom-list parsing, question
// selection, and multiple-choice option building. No DOM access here.

import { state } from './state.js';
import { TYPING_SAMPLE_DATA, MC_SAMPLE_DATA, ENCOUNTER_GLYPHS, CATEGORY_LABELS } from './config.js';
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
          draft: (item && item.draft === true) || undefined
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
  pool = pool || state.activeData;
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
  return target && target.kind === 'encounter' ? target.pool : state.activeData;
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

// The battle screen's category choices for one turn: up to `count` groups
// of `pool`, each { label, category, pool }. Groups by category when the
// pool has at least `count` of them; otherwise (most bundled sets only have
// two) by category + difficulty, taking one group per category first so
// the choices stay as varied as possible. If `mustInclude` is in the pool,
// its group is always one of the choices (a rune's hint stays usable).
// Returns fewer than 2 choices when the pool can't offer a real choice
// (e.g. a pasted list with no categories) — the caller skips the choice
// step then.
export function buildCategoryChoices(pool, count, mustInclude) {
  let groups = groupBy(pool, d => d.category);
  let label = k => categoryLabel(k);
  if (groups.size < count) {
    const pairs = groupBy(pool, d => d.category && d.category + '\u0000' + (d.difficulty || 'medium'));
    if (pairs.size > groups.size) {
      groups = pairs;
      label = k => {
        const [category, difficulty] = k.split('\u0000');
        return categoryLabel(category) + ' · ' + difficulty;
      };
    }
  }

  const all = shuffle(Array.from(groups.entries()))
    .map(([k, items]) => ({ label: label(k), category: items[0].category, pool: items }));
  const picked = [];
  const required = mustInclude && all.find(g => g.pool.includes(mustInclude));
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

// Shuffles `pool` and returns its distinct meanings (case/space-insensitive,
// first occurrence wins), so two different questions that happen to share
// an answer (e.g. two "who wrote this?" entries both answered "John") never
// both land in the same choice list looking like duplicate options.
function distinctMeanings(pool) {
  const seen = new Set();
  const out = [];
  for (const d of shuffle(pool)) {
    const key = normalizeSpaces(d.meaning).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d.meaning);
  }
  return out;
}

// Builds 2-4 answer choices for a question. Uses the item's own "options"
// list if the loaded JSON provided one (adding the correct meaning in if
// it's missing); otherwise picks up to 3 random distractor meanings from
// the rest of the active list, preferring ones that share the item's
// answerType (a name for a name, a number for a number, ...) so the correct
// choice can't be spotted just by its shape. Candidates are drawn in tiers,
// topping up from the next tier only when the previous runs out: same
// answerType and same draft status (a one-word answer isn't offered next
// to multi-word draft answers), then same answerType, then anything.
export function buildChoices(item) {
  let opts;
  if (Array.isArray(item.options) && item.options.length >= 2) {
    opts = item.options.slice();
    const hasCorrect = opts.some(o => normalizeSpaces(o).toLowerCase() === normalizeSpaces(item.meaning).toLowerCase());
    if (!hasCorrect) opts.push(item.meaning);
  } else {
    const basePool = state.activeData.filter(d => d !== item &&
      normalizeSpaces(d.meaning).toLowerCase() !== normalizeSpaces(item.meaning).toLowerCase());
    const typedPool = item.answerType
      ? basePool.filter(d => d.answerType === item.answerType)
      : [];
    const tiers = [
      typedPool.filter(d => !d.draft === !item.draft),
      typedPool,
      basePool
    ];
    const distractors = [];
    const seen = new Set();
    for (const tier of tiers) {
      for (const m of distinctMeanings(tier)) {
        if (distractors.length >= 3) break;
        const key = normalizeSpaces(m).toLowerCase();
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
