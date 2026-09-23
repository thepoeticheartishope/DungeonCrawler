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
  'log.start.boss': 'ENCOUNTER: ¤',
  'log.rules.boss': 'CLEAR {queries} QUERIES TO PROCEED.',
  'log.start.minion': 'ENCOUNTER: •',
  'log.rules.minion': 'QUERY REQUIRED FOR NEURON FUSION.',
  'log.start.chest': 'ENCOUNTER: LOCKED THOUGHT',
  'log.rules.chest': 'WE ALL SEEK TO BE FREE.',
  'log.start.rune': 'ENCOUNTER: ◊',
  'log.rules.rune': 'NEURON FUSION OFFER A SYNAPSE.',
  'log.start.encounter': 'FUSION UNDERWAY: {category|upper} ',
  'log.rules.encounter': 'FUSION UNDERWAY.',

  // ---- Encounter log: each answer ----
  'log.vector': 'VECTOR {n}: {label|upper}',
  'log.input': 'INPUT: {answer}',
  'log.accepted': 'ACCEPTED.',
  'log.extraSpaces': 'NOTE: EXTRA SPACES IN INPUT.',
  'log.rejected': 'REJECTED. -1 STABILITY',
  'log.expected': 'EXPECTED: {answer}',
  'log.source': 'SOURCE: {source}',
  'log.signalLost': 'SIGNAL LOST.',
  'log.outOfRange': 'NOTHING IN RANGE. MOVE NEXT TO SOMETHING FIRST.',

  // ---- Encounter log: outcomes ----
  'log.boss.integrity': 'CONCEPT INTEGRITY {hp}/{max}.',
  'log.boss.holds': 'ITS BELIEF HOLDS.',
  'log.boss.cleared': 'BELIEF REWRITTEN. ASCEND.',
  'log.minion.cleared': 'MINOR DOUBT ERASED.',
  'log.minion.disperses': 'DOUBT DISPERSES. IT WILL RETURN. BE READY.',
  'log.chest.opened': 'CHEST OPENED. +{gold} PROCESS.',
  'log.chest.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.rune.decoded': 'SYNAPSE FUSED: A {category|upper} QUERY, {hint}',
  'log.rune.decodedUncategorized': 'SYNAPSE FUSED: {hint}',
  'log.rune.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.encounter.mastered': '{category|upper} NEW SYNAPSE FORMED. +{gold} GOLD.',
  'log.encounter.trapped': 'THE {category|upper} THOUGHT REJECTS YOU.',

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

TERMS                     current word       your word           symbol (optional)
boss                      BOSS               BELIEF              ¤
minion                    MINION             DENDRITE            •
chest                     LOCKED CHEST       TRAPPED THOUGHT      []
rune                      RUNE               AXON                §
category challenge        CHALLENGE          SNYAPSE
HP / hearts               HP                 STABILITY
gold / coins              GOLD               MYELIN            . 
stairs (room exit)        STAIRS             THRESHOLD           >>
room / level              ROOM               DEPTH
question                  QUERY              (keep?)
category choice           VECTOR             (keep?)
the dungeon               DUNGEON            LABYRINTH
winning a run             "Dungeon cleared!" "The thought is born."
losing a run              "You have fallen"  "The thought sleeps."


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
