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
  'term.hunter': 'OBSESSION', // draft
  'term.hunter.symbol': 'Ø', // draft
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
  'term.paper': 'PAPER', // draft
  'term.paper.symbol': '=',
  'term.box': 'BOX', // draft
  'term.exchange': 'THE UNFOLDING', // Timothy's name; code name exchange (js/exchange.js)
  'term.exchange.symbol': '8', // a loop folded over itself
  'term.box.symbol': '&',
  // The player's glyph (the isometric map draws a stick man in its place).
  'term.player.symbol': '@',
  // What anything further than REVEAL_DISTANCE (config.js) shows as.
  'term.unknown.symbol': '?',

  // ---- Status bar ----
  'stat.hp': '{@term.hp}',
  'stat.gold': '{@term.gold}',
  'stat.turn': 'CYCLE', // draft
  'stat.room': '{@term.room}',
  'stat.time': 'TIME',
  'stat.rest': 'REST', // draft — shown for the depth number while on a rest floor
  'stat.light': 'The {@term.boss} light: {pct}% of the way to consuming everything', // draft (the eye's tooltip)

  // ---- Encounter log: opening lines (what it is, a hint of what's at stake) ----
  'log.start.boss': 'ENCOUNTER: {@term.boss.symbol}',
  'log.rules.boss': 'CLEAR {queries} QUERIES TO PROCEED.',
  'log.start.minion': 'ENCOUNTER: {@term.minion.symbol}',
  'log.rules.minion': '{@term.query} REQUIRED FOR NEURON FUSION.',
  'log.start.hunter': 'ENCOUNTER: {@term.hunter}', // draft
  'log.rules.hunter': 'IT CANNOT BE PRUNED. ANSWER, AND IT LOSES YOUR TRAIL.', // draft
  'log.hunter.repelled': 'THE {@term.hunter} LOSES YOUR TRAIL. FOR NOW.', // draft
  'log.hunter.retreats': 'THE {@term.hunter} FEEDS, AND FALLS BACK TO CIRCLE AGAIN.', // draft
  'log.start.chest': 'ENCOUNTER: {@term.chest}',
  'log.rules.chest': 'WE ALL SEEK TO BE FREE.',
  'log.start.box': 'ENCOUNTER: SEALED {@term.box}', // draft
  'log.rules.box': 'IT OPENS ONLY FOR THE RIGHT ANSWER.', // draft
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
  'log.box.gold': 'IT OPENS. +{gold} {@term.gold}.', // draft
  'log.box.trapped': 'THE LID SNAPS SHUT. WHATEVER WAS INSIDE IS GONE.', // draft
  'log.rune.decoded': 'SIGNAL CARRIED: A {category|upper} {@term.query}, {hint}', // draft (was: SYNAPSE FUSED — the rune is the AXON now)
  'log.rune.decodedUncategorized': 'SIGNAL CARRIED: {hint}', // draft
  'log.rune.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.encounter.mastered': 'NEW {@term.encounter} FORMED: {category|upper}. +{gold} {@term.gold}.',
  'log.encounter.trapped': 'THE {category|upper} THOUGHT REJECTS YOU.',

  // Haunts: a missed question coming back in a later fight (js/haunts.js).
  'log.haunt.returns': ['A FAMILIAR DOUBT.', 'YOU HAVE HEARD THIS BEFORE.', 'IT REMEMBERS YOU GOT THIS WRONG.'], // draft
  'log.haunt.silenced': ['YOU REMEMBER NOW. IT GOES QUIET.', 'THE DOUBT HAS NOTHING LEFT TO SAY.'], // draft
  'log.haunt.lingers': 'IT WILL BE BACK.', // draft

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

  // ---- Answer types, as shown in a fight's query choices ("OT · Names") ----
  'type.name': 'Names',
  'type.relation': 'Relatives',
  'type.group': 'Groups',
  'type.role': 'Roles',
  'type.related': 'Known by kin',
  'type.location': 'Places',
  'type.book': 'Books',
  'type.verse': 'Verses',
  'type.number': 'Numbers',
  'type.object': 'Things',
  'type.theology': 'Theology',
  'type.creature': 'Creatures',
  'type.adjective': 'Descriptions',
  'type.verb': 'Actions',

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
  'mod.timer': 'Timer',
  'mod.timer.tag': 'T',
  'mod.timer.tip': 'answer within {secs} seconds, or it counts as a miss.', // draft
  'battle.timer': 'TIME: {s}',
  'battle.noAnswer': '(no answer)',
  'log.timeout': 'TIME EXPIRED.',
  'log.modifier': 'MODIFIER: {name|upper}.',
  'log.wager': 'WAGER: {n} {@term.gold}.',
  'log.wager.won': 'WAGER WON. +{n} {@term.gold}.',
  'log.wager.lost': 'WAGER LOST. -{n} {@term.gold}.',
  'target.none': 'Target: nothing within reach', // draft
  'target.boss': 'Target: {@term.boss}',
  'target.minion': 'Target: {@term.minion}',
  'target.hunter': 'Target: {@term.hunter}',
  'target.chest': 'Target: {@term.chest}',
  'target.box': 'Target: {@term.box}',
  'target.rune': 'Target: {@term.rune}',
  'target.encounter': 'Target: {category} {@term.encounter}',

  // ---- Room (map) screen ----
  'room.wait': ['You hold still. The hum continues.', 'You wait. Something recalibrates.'], // draft
  'room.coin': 'You absorb a trace of {@term.gold}.', // draft
  'room.engage': 'Something fires in the dark.', // draft
  'room.light.consumed': 'The light reaches everything.', // draft
  'room.blocked.wall': 'The membrane holds.', // draft
  'room.blocked.boss': 'The {@term.boss} will not move.', // draft
  'room.blocked.minion': 'A {@term.minion} is in the way.', // draft
  'room.blocked.hunter': 'The {@term.hunter} is right there.', // draft
  'room.hunter.wakes': ['Something else wakes. It knows where you are.', 'An {@term.hunter} stirs, far off, and turns toward you.'], // draft
  'room.blocked.chest': 'Something is sealed here. Reach for it from beside it.', // draft
  'room.blocked.rune': 'An {@term.rune} hums here. Reach for it from beside it.', // draft
  'room.blocked.encounter': 'A {category} {@term.encounter} is forming here. Reach for it from beside it.', // draft
  'room.blocked.pillar': ['A pillar. Cold, and older than you.', 'Stone. It does not think.'], // draft

  // Reading papers (step onto one) and examining boxes (bump into one; a turn passes).
  'room.paper.lore': 'You read: {lore}', // draft — {lore} is a line from the room theme’s lore below
  'room.paper.junk': ['The page is blank.', 'The ink has run. Nothing is left.', 'A list of names, all crossed out.', 'It crumbles as you touch it.'], // draft
  'room.box.gold': 'Inside: {gold} {@term.gold}.', // draft
  'room.box.junk': ['Empty.', 'Dust, and a smell like old rain.', 'A broken lens. Useless.', 'Rags. Nothing more.'], // draft
  'room.box.done': 'It is empty now.', // draft

  // ---- THE UNFOLDING's screen (js/exchangeview.js), on every rest floor.
  // It never speaks: every line describes it, in the narrator's voice.
  // All drafts for Timothy.
  'exchange.title': '{@term.exchange}',
  'exchange.look': 'A shape the eye keeps losing.', // draft
  'exchange.held': 'You hold {gold} {@term.gold}.', // draft
  'exchange.price': '{price} {@term.gold}',
  'exchange.item.silence': 'Silence a doubt', // draft — the oldest haunt
  'exchange.item.heal': '+1 {@term.hp}', // draft
  'exchange.item.maxStability': '+1 max {@term.hp}', // draft — does not heal
  'exchange.item.slack': 'More time on the next {@term.room}', // draft
  'exchange.why.bought': 'Already taken here.', // draft
  'exchange.why.noHaunts': 'No doubts to silence.', // draft
  'exchange.why.fullStability': '{@term.hp} is full.', // draft
  'exchange.why.atCap': 'It will not hold more.', // draft
  'exchange.why.noDepth': 'There is no next {@term.room}.', // draft
  'exchange.bought': 'It takes the {@term.gold}. Something in you settles.', // draft
  'exchange.cannotAfford': 'It does not turn toward you.', // draft
  'exchange.leave': 'LOOK AWAY', // draft — the button that closes the screen
  'room.exchange.opened': 'Something here was never folded right.', // draft — room log, on bumping it
  'room.exchange.left': 'You look away. It is easier.', // draft — room log, on leaving its screen

  // ---- Room themes: each room on a floor gets one (ROOM_THEMES in
  // config.js). enter shows the first time the player walks in; lore is
  // what a paper there can say.
  'theme.crypt.enter': ['A crypt. The names here have been forgotten.', 'Cold air. Something was buried here, once.'], // draft
  'theme.crypt.lore': ['“We laid the old ideas here so they would stop speaking.”', '“Every certainty ends in a room like this.”', '“Do not wake what was settled.”'], // draft
  'theme.library.enter': ['A library. The shelves lean in to listen.', 'Paper everywhere. Someone was trying to remember.'], // draft
  'theme.library.lore': ['“A thought read twice becomes a belief.”', '“The index lists a room that is not here.”', '“Question everything. Especially this page.”'], // draft
  'theme.flooded.enter': ['A flooded cellar. The water is very still.', 'Water to the ankles. It does not ripple.'], // draft
  'theme.flooded.lore': ['“It rose while we slept. It always does.”', '“Below the waterline the old doubts keep.”', '“Do not drink. Do not look down.”'], // draft
  'theme.shrine.enter': ['A shrine. Someone knelt here and asked.', 'Candles, long cold. The quiet feels deliberate.'], // draft
  'theme.shrine.lore': ['“The light promised rest. It lied.”', '“We prayed to be certain. We were answered.”', '“Ask. Then ask again.”'], // draft

  // ---- The run's story: read in this order, one line per paper, wherever
  // the papers lie (the order is each floor's lore list in floors.js).
  // A voice speaking to the player, kinder than the dungeon. {name} is the
  // name from the start screen (story.nameless if blank); {answered} is the
  // run's correct answers so far. Once a floor's lines run out, papers go
  // back to the theme lore above.
  'story.1.1': '“Do not be afraid.”', // draft
  'story.1.2': '“Seek the light, and slay the pretender.”', // draft
  'story.1.3': '“I know you will know the answers.”', // draft
  'story.1.4': '“This time is different. I know it will be.”', // draft
  'story.2.1': '“Rumination will not be your ruin.”', // draft
  'story.2.2': '“The maw of light consumes all.”', // draft
  'story.2.3': '“Focus on the journey, lest {@term.hunter} take you.”', // draft
  'story.3.1': '“Do not be afraid, {name}.”', // draft
  'story.3.2': '“Look at what you have already accomplished: {answered} {answered|plural:answer}.”', // draft
  'story.3.3': '“It is time to live.”', // draft
  'story.nameless': 'stranger', // draft — {name} in a story line when the start screen's name was left blank

  // ---- Intro, start and end screens ----
  'intro.call': 'YOU ARE NEEDED. ASCEND.',
  'start.enter': 'Enter the {@term.dungeon}', // draft
  'start.name.label': 'Your name', // draft
  'start.name.placeholder': 'Leave blank to stay nameless', // draft

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
  'data.filterFact': 'FACT {count}',
  'data.filterNotFact': 'NOT FACT {count}',
  'data.notFact': 'NOT FACT',
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
  'end.haunts': 'Doubts silenced: {silenced} of {total}.', // draft
  'end.win.spacing': 'Watch spacing on {count} {count|plural:answer} next run.',
  'end.win.again': 'Think again', // draft
  'end.lose.title': 'The thought sleeps.',
  'end.lose.light.title': 'A thought was born. It consumes.',
  'end.lose.stats': 'Reached {@term.room} {room} of {rooms} in {time} and {turns} cycles. {@term.gold} gathered: {coins}.', // draft
  'end.lose.retry': 'Wake', // draft

  // ---- Gun (gun combat plan): why a target can't be shot (sight.js shootBlock).
  'gun.block.outOfRange': 'Out of range.', // draft
  'gun.block.notInLight': 'Not in your light. Turn toward it.', // draft
  'gun.block.noLineOfSight': 'No line of sight.', // draft
  'gun.block.chamberEmpty': 'The chamber is empty. Reload.', // draft
  'gun.block.chamberFull': 'The chamber is full.', // draft
  'gun.block.notShootable': 'The gun does nothing to that.', // draft
  'gun.block.noTarget': 'Nothing in reach.', // draft. FIRE or T with nothing the gun can reach
  'gun.aimChance': '{chance}%', // over a target and on each tile the gun reaches: the chance a shot there lands
  'gun.miss': 'MISS', // floats up over a minion the shot missed
  // The gun's panels over the map (gunpanels.js).
  'gun.reload.title': 'SELECT RELOAD: {category|upper}', // draft. Over the reload choices; {category} is the next category
  'gun.reload.titlePlain': 'SELECT RELOAD', // draft. The same, for a set with no categories
  'gun.reload.offer': 'LOAD {rounds} {rounds|plural:ROUND}', // draft
  'gun.reload.room': 'room for {room}', // draft. When fewer rounds fit in the chamber than the offer loads
  'gun.reload.cancel': 'CANCEL', // draft
  'gun.bar.prompt': 'TAP TO FIRE', // draft. Over the damage bar
  'gun.bar.label': 'Damage bar. Tap, or press Space or F, to fire.', // draft. Read out by screen readers
  'gun.bar.graze': 'graze 0', // draft. The damage bar's legend, left to right: graze, hit, weak point, hit, graze
  'gun.bar.hit': 'hit 1', // draft
  'gun.bar.weak': 'weak 2', // draft
  'gun.reloaded': 'Loaded {rounds} {rounds|plural:round}.', // draft. A right reload answer
  'gun.jammed': 'Jammed. Nothing loads.', // draft. A wrong reload answer
  // Gun combat on the map (gun plan step 6): the buttons by the d-pad, the
  // HUD, and the room notes a shot or a strike adds up to.
  'gun.btn.reload': 'RELOAD', // draft. Button by the d-pad (key R)
  'gun.btn.fire': 'FIRE', // draft. Button by the d-pad (key F; T picks the next target)
  'stat.rounds': 'ROUNDS', // draft. HUD: rounds in the chamber, # loaded and - empty
  'stat.target': 'TARGET', // draft. HUD: the gun's target and its hp, # left and - lost
  'stat.aim': 'AIM', // draft. HUD: the chance a shot at the target lands
  'stat.noTarget': '-', // the HUD's target and aim with nothing targeted
  'minionKind.SHARD': 'SHARD', // draft. A minion kind's name (config.js MINION_KINDS), in the HUD
  'minionKind.HUSK': 'HUSK', // draft
  'minionKind.STALKER': 'STALKER', // draft
  'gun.missed': 'The shot goes wide.', // draft
  'gun.grazed': 'A graze. It keeps coming.', // draft
  'gun.hit': 'Hit.', // draft
  'gun.weakPoint': 'Weak point.', // draft
  'gun.limbLost': 'A limb comes away.', // draft
  'gun.killed': 'It comes apart. {gold} {@term.gold}.', // draft. A kill and the gold it paid
  'gun.struck': 'It strikes. -{cost} {@term.hp}.', // draft. A minion reached the player
  'gun.hunterStruck': 'The {@term.hunter} strikes. -{cost} {@term.hp}.', // draft. The hunter reached the player (gun on)
  'gun.hunterStaggered': 'The {@term.hunter} staggers.', // draft. A landed shot on the hunter
};

// Per-room overrides, keyed by room number (1 = the first room). List only
// the lines that room changes, e.g.:
//
//   3: {
//     'log.boss.holds': ['IT DOES NOT BREAK.', 'IT WAITS FOR YOU TO DOUBT.'],
//     'term.boss.symbol': 'Ω',
//   },
// Floor 1 speaks in the plain voice above; each floor below it leans a
// little further in.
export const AREAS = {
  2: {
    'room.wait': ['You hold still. The hum is louder here.', 'You wait. Something waits with you.'], // draft
    'room.blocked.wall': 'The membrane holds. It is thicker here.', // draft
    'room.paper.junk': ['The page is blank, but warm.', 'The same line, written over and over until it means nothing.', 'A name. Yours? The ink has run.'], // draft
    'log.boss.holds': ['ITS {@term.boss} HOLDS.', 'IT HAS BEEN BELIEVED FOR A LONG TIME.'], // draft
  },
  3: {
    'room.wait': ['You hold still. The hum is inside you now.', 'You wait. The dark does not.'], // draft
    'room.blocked.wall': ['The membrane holds.', 'The membrane gives a little, then holds.'], // draft
    'room.paper.junk': ['The page is blank. It was always blank.', 'Your own handwriting. You do not remember writing it.'], // draft
    'log.boss.holds': ['ITS {@term.boss} HOLDS.', 'IT IS CERTAIN. ARE YOU?'], // draft
  },
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
