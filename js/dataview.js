// Question data viewer: lists every entry of a set (the current list, a
// built-in set, or a saved set) as a terminal listing — answer type, draft
// flag, question, answer, source — with a comment box per question.
// Comments live in localStorage and export as plain text, so reviewing a
// set doesn't mean reading its JSON. Viewing a set here never changes the
// list the game plays; that stays with the start screen loader.

import { state } from './state.js';
import { escapeHtml } from './quiz.js';
import { fetchManifest, fetchBundledSet, listSavedSets, loadSavedSet } from './sets.js';
import { t } from './text.js';

// { [question text]: comment }. Keyed by the question itself, so a comment
// follows the entry whether it's viewed as a built-in set or as the loaded
// current list.
const COMMENTS_KEY = 'noesisProtocol.dataComments';

const els = {};
let entries = [];        // the set being viewed
let viewedLabel = '';    // its name, for the export header
let viewedFile = 'current-list';
let filter = 'all';      // 'all' | 'draft' | 'commented' | 'type:<answerType>'
let comments = readComments();

function readComments() {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeComments() {
  try {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  } catch (e) {
    // Storage unavailable — comments still work until the page closes.
  }
}

function typeOf(entry) {
  return entry.answerType || '';
}

function commentFor(entry) {
  return comments[entry.term] || '';
}

export function initDataView({ startScreen }) {
  els.startScreen = startScreen;
  els.screen = document.getElementById('dataScreen');
  els.openBtn = document.getElementById('dataOpenBtn');
  els.closeBtn = document.getElementById('dataCloseBtn');
  els.select = document.getElementById('dataSetSelect');
  els.summary = document.getElementById('dataSummary');
  els.filters = document.getElementById('dataFilters');
  els.search = document.getElementById('dataSearch');
  els.list = document.getElementById('dataList');
  els.copyBtn = document.getElementById('dataCopyBtn');
  els.saveBtn = document.getElementById('dataSaveBtn');
  els.status = document.getElementById('dataStatus');

  els.openBtn.addEventListener('click', open);
  els.closeBtn.addEventListener('click', close);
  els.select.addEventListener('change', () => viewSet(els.select.value));
  els.search.addEventListener('input', applyFilter);
  els.copyBtn.addEventListener('click', copyComments);
  els.saveBtn.addEventListener('click', saveComments);
  els.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    syncFilters();
    applyFilter();
  });
}

async function open() {
  els.startScreen.classList.remove('show');
  els.screen.classList.add('show');
  document.body.classList.add('data-open');
  window.scrollTo(0, 0);
  await buildSetOptions();
  viewSet('current');
}

function close() {
  els.screen.classList.remove('show');
  els.startScreen.classList.add('show');
  document.body.classList.remove('data-open');
  window.scrollTo(0, 0);
}

// Rebuilt on every open: the current list's size and the saved sets can
// both have changed since last time.
async function buildSetOptions() {
  const builtins = await fetchManifest();
  const saved = listSavedSets();
  let html = '<option value="current">' + escapeHtml(t('data.currentList', { count: state.activeData.length })) + '</option>';
  if (builtins.length) {
    html += '<optgroup label="' + escapeHtml(t('data.builtinGroup')) + '">' +
      builtins.map(s => '<option value="builtin:' + escapeHtml(s.file) + '">' + escapeHtml(s.name) + '</option>').join('') +
      '</optgroup>';
  }
  if (saved.length) {
    html += '<optgroup label="' + escapeHtml(t('data.savedGroup')) + '">' +
      saved.map(s => '<option value="saved:' + escapeHtml(s.name) + '">' + escapeHtml(s.name) + '</option>').join('') +
      '</optgroup>';
  }
  els.select.innerHTML = html;
}

async function viewSet(value) {
  els.select.value = value;
  els.status.textContent = '';
  const label = els.select.selectedOptions[0] ? els.select.selectedOptions[0].textContent : '';
  if (value === 'current') {
    entries = state.activeData;
    viewedLabel = label;
    viewedFile = 'current-list';
  } else if (value.startsWith('builtin:')) {
    const file = value.slice('builtin:'.length);
    els.list.innerHTML = '<div class="data-empty">' + escapeHtml(t('data.loading')) + '</div>';
    const data = await fetchBundledSet(file);
    if (els.select.value !== value) return; // switched again while loading
    if (!data) {
      entries = [];
      els.status.innerHTML = '<span class="loader-error">' + escapeHtml(t('data.loadFailed')) + '</span>';
    } else {
      entries = data;
    }
    viewedLabel = label + ' (' + file + ')';
    viewedFile = file.replace(/\.json$/, '');
  } else {
    const name = value.slice('saved:'.length);
    entries = loadSavedSet(name) || [];
    viewedLabel = label;
    viewedFile = name.replace(/[^\w-]+/g, '-');
  }
  filter = 'all';
  els.search.value = '';
  renderRows();
  renderFilters();
  applyFilter();
}

function renderRows() {
  const pad = String(entries.length).length;
  els.list.innerHTML = entries.map((entry, i) => {
    const type = typeOf(entry);
    const meta = [
      '<span class="data-num">' + String(i + 1).padStart(pad, '0') + '</span>',
      '<span class="data-type' + (type ? '' : ' untyped') + '">' + escapeHtml((type || t('data.untyped')).toUpperCase()) + '</span>',
      entry.draft ? '<span class="data-draft">' + escapeHtml(t('data.draft')) + '</span>' : '',
      entry.fact === false
        ? '<span class="data-notfact" title="' + escapeHtml(entry.factNote || '') + '">' + escapeHtml(t('data.notFact')) + '</span>' : '',
      entry.category ? '<span>' + escapeHtml(entry.category) + '</span>' : '',
      entry.difficulty ? '<span>' + escapeHtml(entry.difficulty) + '</span>' : ''
    ].join('');
    const opts = Array.isArray(entry.options) && entry.options.length
      ? '<div class="data-opts">' + escapeHtml(t('data.options', { options: entry.options.join(' / ') })) + '</div>' : '';
    const src = entry.source
      ? '<div class="data-src">' + escapeHtml(t('data.source', { source: entry.source })) + '</div>' : '';
    const comment = commentFor(entry);
    return '<div class="data-row' + (comment ? ' has-comment' : '') + '" data-i="' + i + '">' +
      '<div class="data-meta">' + meta + '</div>' +
      '<div class="data-q">' + escapeHtml(entry.term) + '</div>' +
      '<div class="data-a">' + escapeHtml(entry.meaning) + '</div>' +
      opts + src +
      '<label class="data-comment"><textarea rows="1" placeholder="' + escapeHtml(t('data.commentPlaceholder')) +
      '">' + escapeHtml(comment) + '</textarea></label>' +
      '</div>';
  }).join('') + '<div class="data-empty" id="dataEmpty" hidden>' + escapeHtml(t('data.noMatches')) + '</div>';

  els.list.querySelectorAll('.data-row').forEach((row) => {
    const entry = entries[Number(row.dataset.i)];
    const box = row.querySelector('textarea');
    autoGrow(box);
    box.addEventListener('input', () => {
      autoGrow(box);
      const text = box.value.trim();
      if (text) comments[entry.term] = box.value;
      else delete comments[entry.term];
      row.classList.toggle('has-comment', Boolean(text));
      writeComments();
      renderSummary();
    });
    // The COMMENTED count refreshes on blur, updated in place: rebuilding
    // the buttons there would swallow the click that caused the blur.
    box.addEventListener('change', syncFilters);
  });
  renderSummary();
}

function autoGrow(box) {
  box.style.height = 'auto';
  box.style.height = box.scrollHeight + 'px';
}

function commentedCount() {
  return entries.filter(e => commentFor(e).trim()).length;
}

function renderSummary() {
  els.summary.textContent = t('data.summary', {
    count: entries.length,
    drafts: entries.filter(e => e.draft).length,
    comments: commentedCount()
  });
}

function renderFilters() {
  const counts = new Map();
  entries.forEach(e => counts.set(typeOf(e), (counts.get(typeOf(e)) || 0) + 1));
  const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const buttons = [['all', t('data.filterAll', { count: entries.length })]];
  types.forEach(type => buttons.push(['type:' + type, t('data.filterType', { type: type || t('data.untyped'), count: counts.get(type) })]));
  const drafts = entries.filter(e => e.draft).length;
  if (drafts) buttons.push(['draft', t('data.filterDraft', { count: drafts })]);
  // Fact filters only appear for sets that carry the label (the Bible sets).
  const labelled = entries.filter(e => typeof e.fact === 'boolean');
  if (labelled.length) {
    buttons.push(['fact', t('data.filterFact', { count: labelled.filter(e => e.fact).length })]);
    buttons.push(['notfact', t('data.filterNotFact', { count: labelled.filter(e => !e.fact).length })]);
  }
  buttons.push(['commented', t('data.filterCommented', { count: commentedCount() })]);
  els.filters.innerHTML = buttons.map(([key, label]) =>
    '<button type="button" data-filter="' + escapeHtml(key) + '" aria-pressed="' + (key === filter) + '">' + escapeHtml(label) + '</button>'
  ).join('');
}

function syncFilters() {
  els.filters.querySelectorAll('button[data-filter]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter));
    if (btn.dataset.filter === 'commented') {
      btn.textContent = t('data.filterCommented', { count: commentedCount() });
    }
  });
}

function matchesFilter(entry) {
  if (filter === 'draft') return Boolean(entry.draft);
  if (filter === 'fact') return entry.fact === true;
  if (filter === 'notfact') return entry.fact === false;
  if (filter === 'commented') return Boolean(commentFor(entry).trim());
  if (filter.startsWith('type:')) return typeOf(entry) === filter.slice(5);
  return true;
}

function applyFilter() {
  const q = els.search.value.trim().toLowerCase();
  let shown = 0;
  els.list.querySelectorAll('.data-row').forEach((row) => {
    const entry = entries[Number(row.dataset.i)];
    const hit = matchesFilter(entry) &&
      (!q || (entry.term + '\n' + entry.meaning + '\n' + (entry.source || '')).toLowerCase().includes(q));
    row.hidden = !hit;
    if (hit) shown++;
  });
  const empty = document.getElementById('dataEmpty');
  if (empty) empty.hidden = shown > 0;
  if (shown !== entries.length) {
    els.status.textContent = t('data.showing', { shown, count: entries.length });
  } else if (!els.status.querySelector('.loader-error')) {
    els.status.textContent = '';
  }
}

// Plain-text export of the viewed set's commented entries: readable as-is,
// and it carries the question text so each note can be traced back to its
// JSON entry.
function buildExport() {
  const lines = [t('data.exportTitle', { set: viewedLabel }), new Date().toISOString().slice(0, 10), ''];
  let count = 0;
  entries.forEach((entry, i) => {
    const comment = commentFor(entry).trim();
    if (!comment) return;
    count++;
    const tags = [typeOf(entry) || t('data.untyped')];
    if (entry.draft) tags.push('draft');
    if (entry.fact === false) tags.push('not fact');
    lines.push('#' + (i + 1) + ' [' + tags.join(', ') + '] ' + entry.term);
    lines.push('  ' + t('data.exportAnswer', { answer: entry.meaning }));
    comment.split('\n').forEach((line, n) => {
      lines.push('  ' + (n === 0 ? t('data.exportComment', { comment: line }) : line));
    });
    lines.push('');
  });
  return { text: lines.join('\n'), count };
}

function statusLine(text, ok) {
  els.status.innerHTML = '<span class="' + (ok ? 'loader-ok' : 'loader-error') + '">' + escapeHtml(text) + '</span>';
}

async function copyComments() {
  const { text, count } = buildExport();
  if (!count) return statusLine(t('data.noComments'), false);
  try {
    await navigator.clipboard.writeText(text);
    statusLine(t('data.copied', { count }), true);
  } catch (e) {
    statusLine(t('data.copyFailed'), false);
  }
}

function saveComments() {
  const { text, count } = buildExport();
  if (!count) return statusLine(t('data.noComments'), false);
  const file = 'noesis-comments-' + viewedFile + '.txt';
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusLine(t('data.saved', { count, file }), true);
}
