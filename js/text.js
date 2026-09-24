// All player-facing game wording, in one place.
//
// Code never writes wording inline; it asks for a line by its key:
//   t('log.boss.integrity', { hp: 2, max: 3 })  ->  'CONCEPT INTEGRITY 2/3.'
//
// To reword something, change the text in quotes. Rules for a line:
//   - {name}               filled in by the game. Keep the braces and the name.
//   - {name|upper}         the same value in CAPITALS.
//   - {name|plural:word}   "word" when {name} is 1, otherwise "words".
//                          For irregular plurals: {name|plural:child/children}.
//   - {@term.boss}         another line from this file, by its key — used for
//                          the Terms below, so each thing is named only once.
//                          Takes |upper too: {@term.boss|upper}.
//   - ['one', 'two', ...]  a list instead of a single line: one is picked at
//                          random each time it's shown, for flavour variety.
//   - A straight apostrophe ' ends the line early and stops the game from
//     loading: use the curly ’ instead (or write \').
//
// Per-area wording: AREAS (bottom of this file) can replace any line for one
// room, terms and symbols included. A room only lists the lines it changes;
// everything else falls back to TEXT. The game switches area as each room
// loads (setTextArea in main.js loadRoom), so this is also where later area-
// or enemy-specific voices can plug in.
//
// Screen labels written in index.html carry a data-t="key" attribute and
// are filled in from here (applyStaticText), so they're edited here too.
//
// Lines marked "// draft" are first-pass suggestions to rewrite freely.
//
// After changing this file, bump CACHE_NAME in service-worker.js so
// browsers pick up the new wording.

export const TEXT = {
  // ---- Terms: what each thing is called, and its symbol on the map and
  // battle screen. Rename something here and every line using it follows.
  // Symbols must be in the VT323 font (see the README) and stay distinct
  // from each other and from the player's arrows ^ v < >.
  'term.boss': 'BELIEF',
  'term.boss.symbol': '¤',
  'term.minion': 'DENDRITE',
  'term.minion.symbol': '•',
  'term.chest': 'TRAPPED THOUGHT',
  'term.chest.symbol': '[]',
  'term.rune': 'AXON',
  'term.rune.symbol': '§',
  'term.encounter': 'SYNAPSE',
  'term.hp': 'STABILITY',
  'term.gold': 'MYELIN',
  'term.gold.symbol': '.',
  'term.exit': 'THRESHOLD',
  'term.exit.symbol': '>>',
  'term.room': 'DEPTH',
  'term.dungeon': 'LABYRINTH',
  'term.query': 'QUERY',
  'term.vector': 'VECTOR',

  // ---- Status bar ----
  'stat.hp': '{@term.hp}',
  'stat.gold': '{@term.gold}',
  'stat.turn': 'CYCLE', // draft
  'stat.room': '{@term.room}',
  'stat.time': 'TIME',
  'stat.light': 'The {@term.boss} light: {pct}% of the way to consuming everything', // draft (the eye's tooltip)

  // ---- Encounter log: opening lines (what it is, a hint of what's at stake) ----
  'log.start.boss': 'ENCOUNTER: {@term.boss.symbol}',
  'log.rules.boss': 'CLEAR {queries} QUERIES TO PROCEED.',
  'log.start.minion': 'ENCOUNTER: {@term.minion.symbol}',
  'log.rules.minion': '{@term.query} REQUIRED FOR NEURON FUSION.',
  'log.start.chest': 'ENCOUNTER: {@term.chest}',
  'log.rules.chest': 'WE ALL SEEK TO BE FREE.',
  'log.start.rune': 'ENCOUNTER: {@term.rune.symbol}',
  'log.rules.rune': 'THE {@term.rune} OFFERS A SIGNAL.', // draft (was: NEURON FUSION OFFER A SYNAPSE.)
  'log.start.encounter': '{@term.encounter} FORMING: {category|upper}', // draft (start and rules both said FUSION UNDERWAY)
  'log.rules.encounter': 'FUSION UNDERWAY.',

  // ---- Encounter log: each answer ----
  'log.vector': '{@term.vector} {n}: {label|upper}',
  'log.input': 'INPUT: {answer}',
  'log.accepted': 'ACCEPTED.',
  'log.extraSpaces': 'NOTE: EXTRA SPACES IN INPUT.',
  'log.rejected': 'REJECTED. -{cost} {@term.hp}',
  'log.expected': 'EXPECTED: {answer}',
  'log.source': 'SOURCE: {source}',
  'log.signalLost': 'SIGNAL LOST.',
  'log.outOfRange': 'NOTHING WITHIN REACH.', // draft

  // ---- Encounter log: outcomes ----
  'log.boss.integrity': 'CONCEPT INTEGRITY {hp}/{max}.',
  'log.boss.holds': 'ITS {@term.boss} HOLDS.',
  'log.boss.cleared': '{@term.boss} REWRITTEN. ASCEND.',
  'log.darkness': 'ITS LIGHT DIES WITH IT. WHAT REMAINS HUNTS YOU. MISSES COST MORE; {@term.gold} PAYS DOUBLE.', // draft
  'log.minion.cleared': '{@term.minion} PRUNED.', // draft (was: MINOR DOUBT ERASED. — the minion is a DENDRITE now)
  'log.minion.disperses': 'THE {@term.minion} RETRACTS INTO THE DARK.', // draft (minions no longer grow back; was: IT WILL GROW BACK. BE READY.)
  'log.chest.opened': 'THOUGHT RELEASED. +{gold} {@term.gold}.', // draft (was: CHEST OPENED. +{gold} PROCESS.)
  'log.chest.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.rune.decoded': 'SIGNAL CARRIED: A {category|upper} {@term.query}, {hint}', // draft (was: SYNAPSE FUSED — the rune is the AXON now)
  'log.rune.decodedUncategorized': 'SIGNAL CARRIED: {hint}', // draft
  'log.rune.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.encounter.mastered': 'NEW {@term.encounter} FORMED: {category|upper}. +{gold} {@term.gold}.',
  'log.encounter.trapped': 'THE {category|upper} THOUGHT REJECTS YOU.',

  // The axon's clue about its hinted answer ({hint} in log.rune.decoded).
  'hint.shape': 'starts with "{first}" · {words} {words|plural:word}, {chars} characters',

  // ---- Battle screen labels ----
  'battle.title': 'ENCOUNTER.SYS',
  'battle.selectVector': 'SELECT {@term.query} {@term.vector}',
  'battle.query': '{@term.query}:',
  'battle.answerPlaceholder': 'type your answer',
  'battle.attack': 'Transmit', // draft
  'battle.attempt': 'Transmit', // draft
  'battle.continue': 'CONTINUE',
  'battle.runeHintMark': 'The {@term.rune}’s signal is in here', // draft
  'battle.wager': 'WAGER:',

  // ---- Question modifiers: name, the tag beside a category, its tooltip ----
  // Tags must be in the VT323 font and stay distinct from the category
  // encounter glyphs (! % & * + ~ = ≈) and the map symbols.
  'mod.blind': 'Blind Pick',
  'mod.blind.tag': 'B',
  'mod.blind.tip': 'the answers vanish after a few seconds.', // draft
  'mod.gambler': 'Gambler',
  'mod.gambler.tag': '$',
  'mod.gambler.tip': 'wager up to {max} {@term.gold} before answering. Right wins it, wrong loses it.', // draft
  'mod.flip': 'Flip',
  'mod.flip.tag': 'F',
  'mod.flip.tip': 'some answers are turned upside down or mirrored.', // draft
  'log.modifier': 'MODIFIER: {name|upper}.',
  'log.wager': 'WAGER: {n} {@term.gold}.',
  'log.wager.won': 'WAGER WON. +{n} {@term.gold}.',
  'log.wager.lost': 'WAGER LOST. -{n} {@term.gold}.',
  'target.none': 'Target: nothing within reach', // draft
  'target.boss': 'Target: {@term.boss}',
  'target.minion': 'Target: {@term.minion}',
  'target.chest': 'Target: {@term.chest}',
  'target.rune': 'Target: {@term.rune}',
  'target.encounter': 'Target: {category} {@term.encounter}',

  // ---- Room (map) screen ----
  'room.move': 'You drift {direction}.', // draft
  'room.dir.north': 'north',
  'room.dir.south': 'south',
  'room.dir.east': 'east',
  'room.dir.west': 'west',
  'room.wait': ['You hold still. The hum continues.', 'You wait. Something recalibrates.'], // draft
  'room.coin': 'You absorb a trace of {@term.gold}.', // draft
  'room.engage': 'Something fires in the dark.', // draft
  'room.light.consumed': 'The light reaches everything.', // draft
  'room.blocked.wall': 'The membrane holds.', // draft
  'room.blocked.boss': 'The {@term.boss} will not move.', // draft
  'room.blocked.minion': 'A {@term.minion} is in the way.', // draft
  'room.blocked.chest': 'Something is sealed here. Reach for it from beside it.', // draft
  'room.blocked.rune': 'An {@term.rune} hums here. Reach for it from beside it.', // draft
  'room.blocked.encounter': 'A {category} {@term.encounter} is forming here. Reach for it from beside it.', // draft

  // ---- Intro, start and end screens ----
  'intro.call': 'YOU ARE NEEDED. ASCEND.',
  'start.enter': 'Enter the {@term.dungeon}', // draft

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

  'end.win.title': 'Your thought is born.',
  'end.win.stats': '{@term.boss} rewritten: {bosses}. Time: {time}. Cycles: {turns}. Transmissions: {attempts}. {@term.hp} remaining: {hearts}. {@term.gold} gathered: {coins}.', // draft
  'end.win.spacing': 'Watch spacing on {count} {count|plural:answer} next run.',
  'end.win.again': 'Think again', // draft
  'end.lose.title': 'The thought sleeps.',
  'end.lose.light.title': 'A thought was born. It consumes.',
  'end.lose.stats': 'Reached {@term.room} {room} of {rooms} in {time} and {turns} cycles. {@term.gold} gathered: {coins}.', // draft
  'end.lose.retry': 'Wake', // draft
};

// Per-room overrides, keyed by room number (1 = the first room). List only
// the lines that room changes, e.g.:
//
//   3: {
//     'log.boss.holds': ['IT DOES NOT BREAK.', 'IT WAITS FOR YOU TO DOUBT.'],
//     'term.boss.symbol': 'Ω',
//   },
export const AREAS = {
};

let currentArea = null;
const warnedKeys = new Set();

// Which area's overrides t() should prefer. Called as each room loads.
export function setTextArea(area) {
  currentArea = area;
}

function warnOnce(message) {
  if (warnedKeys.has(message)) return;
  warnedKeys.add(message);
  console.warn('text.js: ' + message);
}

// The wording for `key`, with {placeholders} filled from `vars` and
// {@other.key} references filled from this file. A missing key comes back
// as the key itself (and warns once), so a typo shows up on screen instead
// of silently blanking the line.
export function t(key, vars = {}, depth = 0) {
  const area = AREAS[currentArea];
  const entry = area && key in area ? area[key] : TEXT[key];
  if (entry === undefined) {
    warnOnce('no wording for "' + key + '"');
    return key;
  }
  const template = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
  return template.replace(/\{(@?[\w.]+)(?:\|(\w+)(?::([^}]*))?)?\}/g, (match, name, modifier, arg) => {
    let value;
    if (name[0] === '@') {
      // A reference to another line; the depth guard stops a line that
      // (directly or not) refers to itself from looping forever.
      if (depth >= 5) {
        warnOnce('reference loop at "' + name.slice(1) + '"');
        return match;
      }
      value = t(name.slice(1), vars, depth + 1);
    } else {
      if (!(name in vars)) return match;
      value = vars[name];
    }
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
