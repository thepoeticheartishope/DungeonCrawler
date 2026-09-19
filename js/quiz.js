// Question/answer data logic: sample lists, custom-list parsing, question
// selection, and multiple-choice option building. No DOM access here.

import { state } from './state.js';
import { TYPING_SAMPLE_DATA, MC_SAMPLE_DATA } from './config.js';

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
      .map(item => ({
        term: String((item && item.term) || '').trim(),
        meaning: String((item && item.meaning) || '').trim(),
        options: Array.isArray(item && item.options)
          ? item.options.map(o => String(o).trim()).filter(Boolean)
          : undefined
      }))
      .filter(item => item.term && item.meaning);
    if (cleaned.length < 2) return { error: 'Need at least 2 valid entries with both a term and meaning.' };
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

  if (cleaned.length < 2) return { error: 'Need at least 2 valid "TERM | Meaning" lines.' };
  const result = { data: cleaned };
  if (badLines.length > 0) {
    result.warning = 'Skipped line' + (badLines.length > 1 ? 's' : '') + ' ' + badLines.join(', ') + ' (missing a "|" separator).';
  }
  return result;
}

// Picks a random term from the full list, avoiding an immediate repeat
// of whatever question is currently showing.
export function pickQuestion(exclude) {
  let pool = state.activeData;
  if (exclude && state.activeData.length > 1) {
    pool = state.activeData.filter(d => d.term !== exclude.term);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function normalizeSpaces(s) {
  return s.trim().replace(/\s+/g, ' ');
}

// Builds 2-4 answer choices for a question. Uses the item's own "options"
// list if the loaded JSON provided one (adding the correct meaning in if
// it's missing); otherwise picks up to 3 random distractor meanings from
// the rest of the active list.
export function buildChoices(item) {
  let opts;
  if (Array.isArray(item.options) && item.options.length >= 2) {
    opts = item.options.slice();
    const hasCorrect = opts.some(o => normalizeSpaces(o).toLowerCase() === normalizeSpaces(item.meaning).toLowerCase());
    if (!hasCorrect) opts.push(item.meaning);
  } else {
    const pool = state.activeData.filter(d => d !== item &&
      normalizeSpaces(d.meaning).toLowerCase() !== normalizeSpaces(item.meaning).toLowerCase());
    const distractors = shuffle(pool).slice(0, 3).map(d => d.meaning);
    opts = [item.meaning, ...distractors];
  }
  return shuffle(opts).slice(0, 4);
}

// Builds a short clue from a question's meaning: first letter, word
// count, and character count — enough to help without giving it away.
export function buildHint(q) {
  const meaning = q.meaning.trim();
  const words = meaning.split(/\s+/);
  const firstWord = words[0];
  const wordLabel = words.length === 1 ? 'word' : 'words';
  return 'starts with "' + firstWord + '" · ' + words.length + ' ' + wordLabel + ', ' + meaning.length + ' characters';
}
