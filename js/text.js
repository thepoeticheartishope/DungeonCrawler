// All player-facing game wording, in one place.
//
// Code never writes wording inline; it asks for a line by its key:
//   t('log.boss.integrity', { hp: 2, max: 3 })  ->  'BOSS INTEGRITY 2/3.'
//
// To reword something, change the text in quotes. Rules for a line:
//   - {name}               filled in by the game. Keep the braces and the name.
//   - {name|upper}         the same value in CAPITALS.
//   - {name|plural:word}   "word" when {name} is 1, otherwise "words".
//                          For irregular plurals: {name|plural:child/children}.
//   - ['one', 'two', ...]  a list instead of a single line: one is picked at
//                          random each time it's shown, for flavour variety.
//
// Per-area wording: AREAS (bottom of this file) can replace any line for one
// room. A room only lists the lines it changes; everything else falls back
// to TEXT. The game switches area as each room loads (setTextArea in
// main.js loadRoom), so this is also where later area- or enemy-specific
// voices can plug in.
//
// Screen labels written in index.html carry a data-t="key" attribute and
// are filled in from here (applyStaticText), so they're edited here too.
//
// After changing this file, bump CACHE_NAME in service-worker.js so
// browsers pick up the new wording.

export const TEXT = {
  // ---- Encounter log: opening lines (what it is, what's at stake) ----
  'log.start.boss': 'ENCOUNTER: BOSS',
  'log.rules.boss': 'CLEAR {queries} QUERIES TO BREAK THROUGH. EACH MISS COSTS 1 HP.',
  'log.start.minion': 'ENCOUNTER: MINION',
  'log.rules.minion': 'ONE QUERY SETTLES IT. A MISS COSTS 1 HP.',
  'log.start.chest': 'ENCOUNTER: LOCKED CHEST',
  'log.rules.chest': 'ANSWER TO OPEN IT. A MISS SPRINGS A TRAP.',
  'log.start.rune': 'ENCOUNTER: RUNE',
  'log.rules.rune': 'ANSWER TO READ ITS HINT. A MISS SPRINGS A TRAP.',
  'log.start.encounter': 'ENCOUNTER: {category|upper} CHALLENGE',
  'log.rules.encounter': 'ANSWER FOR GOLD. A MISS SPRINGS A TRAP.',

  // ---- Encounter log: each answer ----
  'log.vector': 'VECTOR {n}: {label|upper}',
  'log.input': 'INPUT: {answer}',
  'log.accepted': 'ACCEPTED.',
  'log.extraSpaces': 'NOTE: EXTRA SPACES IN INPUT.',
  'log.rejected': 'REJECTED. -1 HP',
  'log.expected': 'EXPECTED: {answer}',
  'log.source': 'SOURCE: {source}',
  'log.signalLost': 'SIGNAL LOST.',
  'log.outOfRange': 'NOTHING IN RANGE. MOVE NEXT TO SOMETHING FIRST.',

  // ---- Encounter log: outcomes ----
  'log.boss.integrity': 'BOSS INTEGRITY {hp}/{max}.',
  'log.boss.holds': 'THE BOSS HOLDS.',
  'log.boss.cleared': 'BOSS CLEARED. THE WAY TO THE STAIRS IS OPEN.',
  'log.minion.cleared': 'MINION CLEARED.',
  'log.minion.disperses': 'THE MINION DISPERSES.',
  'log.chest.opened': 'CHEST OPENED. +{gold} GOLD.',
  'log.chest.trapped': 'THE CHEST WAS TRAPPED.',
  'log.rune.decoded': 'RUNE DECODED: A {category|upper} QUERY, {hint}',
  'log.rune.decodedUncategorized': 'RUNE DECODED: {hint}',
  'log.rune.trapped': 'THE RUNE WAS TRAPPED.',
  'log.encounter.mastered': '{category|upper} CHALLENGE MASTERED. +{gold} GOLD.',
  'log.encounter.trapped': 'THE {category|upper} CHALLENGE WAS TRAPPED.',

  // The rune's clue about its hinted answer ({hint} in log.rune.decoded).
  'hint.shape': 'starts with "{first}" · {words} {words|plural:word}, {chars} characters',

  // ---- Battle screen labels ----
  'battle.title': 'ENCOUNTER.SYS',
  'battle.selectVector': 'SELECT QUERY VECTOR',
  'battle.query': 'QUERY:',
  'battle.answerPlaceholder': 'type your answer',
  'battle.attack': 'Attack',
  'battle.attempt': 'Attempt',
  'battle.continue': 'CONTINUE',
  'battle.runeHintMark': "The rune's hint is in here",
  'target.none': 'Target: none — move next to something',
  'target.boss': 'Target: Boss',
  'target.minion': 'Target: Minion',
  'target.chest': 'Target: Chest',
  'target.rune': 'Target: Rune',
  'target.encounter': 'Target: {category}',

  // ---- Room (map) screen ----
  'room.move': 'You move {direction}.',
  'room.dir.north': 'north',
  'room.dir.south': 'south',
  'room.dir.east': 'east',
  'room.dir.west': 'west',
  'room.wait': 'You hold your ground.',
  'room.coin': 'You grab a coin!',
  'room.engage': 'Something lunges out of the dark!',
  'room.spawn': 'The boss summons a minion!',
  'room.blocked.wall': 'The dungeon wall blocks that path.',
  'room.blocked.boss': 'The boss blocks that path.',
  'room.blocked.minion': 'A minion blocks that path.',
  'room.blocked.chest': 'A locked chest blocks that path. Tap it from beside it.',
  'room.blocked.rune': 'A glowing rune blocks that path. Tap it from beside it.',
  'room.blocked.encounter': 'A {category} challenge blocks that path. Tap it from beside it.',

  // ---- Intro, start and end screens ----
  'intro.call': 'YOU ARE NEEDED. ASCEND.',
  'start.enter': 'Enter the dungeon',

  // ---- Question data viewer (start screen) ----
  'data.open': 'View question data',
  'data.title': 'DATA.SYS',
  'data.close': 'Back',
  'data.currentList': 'Current list ({count})',
  'data.builtinGroup': 'Built-in sets',
  'data.savedGroup': 'My saved sets',
  'data.loading': 'LOADING…',
  'data.loadFailed': 'Could not load that set.',
  'data.summary': '{count} {count|plural:entry/entries} · {drafts} {drafts|plural:draft} · {comments} {comments|plural:comment}',
  'data.showing': 'SHOWING {shown} OF {count}',
  'data.filterAll': 'ALL {count}',
  'data.filterType': '{type|upper} {count}',
  'data.filterDraft': 'DRAFT {count}',
  'data.filterCommented': 'COMMENTED {count}',
  'data.untyped': 'untyped',
  'data.draft': 'DRAFT',
  'data.options': 'OPTIONS: {options}',
  'data.source': 'SRC: {source}',
  'data.commentPlaceholder': 'add a comment',
  'data.searchPlaceholder': 'filter by question or answer',
  'data.noMatches': 'No entries match.',
  'data.copy': 'Copy comments',
  'data.save': 'Save comments file',
  'data.copied': 'Copied {count} {count|plural:comment} to the clipboard.',
  'data.copyFailed': 'Clipboard unavailable. Use "Save comments file" instead.',
  'data.saved': 'Saved {count} {count|plural:comment} to {file}.',
  'data.noComments': 'No comments on this set yet.',
  'data.exportTitle': 'NOESIS DATA COMMENTS: {set}',
  'data.exportAnswer': 'ANSWER: {answer}',
  'data.exportComment': 'COMMENT: {comment}',
  'end.win.title': 'Dungeon cleared!',
  'end.win.stats': 'Cleared {bosses} bosses in {time} and {turns} turns, in {attempts} attempts, with {hearts} {hearts|plural:heart} left. Coins collected: {coins}.',
  'end.win.spacing': 'Watch spacing on {count} {count|plural:answer} next run.',
  'end.win.again': 'Play again',
  'end.lose.title': 'You have fallen',
  'end.lose.stats': 'You reached room {room} of {rooms} in {time} and {turns} turns. Coins collected: {coins}.',
  'end.lose.retry': 'Try again',
};

// Per-room overrides, keyed by room number (1 = the first room). List only
// the lines that room changes, e.g.:
//
//   3: {
//     'log.boss.holds': ['IT DOES NOT BREAK.', 'IT WAITS FOR YOU TO DOUBT.'],
//     'room.engage': 'Something you recognise steps out of the dark.',
//   },
export const AREAS = {
};

let currentArea = null;
const warnedKeys = new Set();

// Which area's overrides t() should prefer. Called as each room loads.
export function setTextArea(area) {
  currentArea = area;
}

// The wording for `key`, with {placeholders} filled from `vars`. A missing
// key comes back as the key itself (and warns once), so a typo shows up on
// screen instead of silently blanking the line.
export function t(key, vars = {}) {
  const area = AREAS[currentArea];
  const entry = area && key in area ? area[key] : TEXT[key];
  if (entry === undefined) {
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn('text.js: no wording for "' + key + '"');
    }
    return key;
  }
  const template = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
  return template.replace(/\{(\w+)(?:\|(\w+)(?::([^}]*))?)?\}/g, (match, name, modifier, arg) => {
    if (!(name in vars)) return match;
    const value = vars[name];
    if (modifier === 'upper') return String(value).toUpperCase();
    if (modifier === 'plural') {
      const [one, many] = arg.includes('/') ? arg.split('/') : [arg, arg + 's'];
      return Number(value) === 1 ? one : many;
    }
    return String(value);
  });
}

// Fills every element marked data-t="key" in index.html from TEXT, plus
// data-t-placeholder="key" for input placeholders. Elements that mirror
// their text into data-text (the glitch effects draw from it) get that
// updated too. Re-run after setTextArea so area overrides reach them.
export function applyStaticText(root = document) {
  root.querySelectorAll('[data-t]').forEach((el) => {
    const text = t(el.dataset.t);
    el.textContent = text;
    if (el.hasAttribute('data-text')) el.setAttribute('data-text', text);
  });
  root.querySelectorAll('[data-t-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.tPlaceholder);
  });
}
