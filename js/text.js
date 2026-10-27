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
  'term.minion.simpleSymbol': 'e', // Simple enemies (start screen): every minion on the map is this still letter, like k for a key
  'term.minion.tellSymbol': 'E', // Simple enemies: the strike tell, one step from being next to the player
  'term.minion.downedSymbol': 'e', // a downed minion (downed plan): Simple enemies draw it small and dim, low on its tile; it is the tell E while it holds the player
  'term.hunter': 'OBSESSION', // draft
  'term.hunter.symbol': 'Ø', // draft
  'term.hunter.simpleSymbol': 'E', // Simple enemies: the hunter is a still big E (Timothy, 2026-10-12)
  'term.chest': 'TRAPPED THOUGHT',
  'term.chest.symbol': '[]',
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
  'term.furniture.symbol': '=', // a fixed plan's furniture; drawn as itself in both views, the glyph is a fallback
  'term.cell': 'ENERGY CELL', // draft
  'term.relay': 'RELAY', // draft
  'term.relay.symbol': '¥', // draft. A mast with two arms
  'term.key': 'KEY', // draft (locked core plan)
  'term.key.symbol': 'k', // draft
  'term.desk': 'REFLECTIVE DESK', // draft
  'term.vent': 'GRATE', // draft. A grate in the floor over a duct (vents.js)
  'term.vent.symbol': '#', // draft. Drawn as a grate on the map; the glyph is a fallback
  'term.desk.symbol': 'Π', // draft. A desk seen from the front
  'term.charger': 'CHARGER', // draft
  'term.charger.symbol': 'ϟ', // draft. A spark
  'term.cell.symbol': 'o', // drawn as a drum on the map; the glyph is a fallback
  // The player's glyph (the map draws a stick man in its place).
  'term.player.symbol': '@',
  // What anything further than REVEAL_DISTANCE (config.js) shows as.
  'term.unknown.symbol': '?',

  // ---- Status bar ----
  'stat.hp': '{@term.hp}',
  'stat.gold': '{@term.gold}',
  'stat.turn': 'CYCLE', // draft
  'stat.room': '{@term.room}',
  'stat.time': 'TIME',
  'stat.keys': '{@term.key}', // draft. HUD: keys held of the floor's
  'stat.keys.count': '{held}/{total}', // HUD: keys held of the floor's
  'stat.keys.sealed': '{held}/{total} SEALED', // draft. HUD: the gate is sealed until another key
  'stat.rest': 'REST', // draft — shown for the depth number while on a rest floor
  'sky.turnsLeft': '{count} {count|plural:turn} left', // draft. Comfort mode's sky while looking up, where the eye would be (sky eye plan)
  'sky.secondsLeft': '{count} {count|plural:second} left', // draft. The same with One stick, where the light runs by time (one stick plan step D)
  'sky.watching': 'it is watching', // draft. Comfort mode's sky in the tutorial, where the eye is wide open
  'sky.noLight': 'no light here', // draft. The same with no boss light on the floor (a rest floor, the tutorial, after the boss)

  // ---- Encounter log: opening lines (what it is, a hint of what's at stake) ----
  'log.start.boss': 'ENCOUNTER: {@term.boss.symbol}',
  'log.rules.boss': 'CLEAR {queries} QUERIES TO PROCEED. ONE WRONG SEALS IT.', // draft
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

  // ---- Encounter log: each answer ----
  'log.vector': '{@term.vector} {n}: {label|upper}',
  'log.input': 'INPUT: {answer}',
  'log.accepted': 'ACCEPTED.',
  'log.extraSpaces': 'NOTE: EXTRA SPACES IN INPUT.',
  'log.rejected': 'REJECTED. -{cost} {@term.hp}',
  'log.rejected.free': 'REJECTED.', // a miss that costs no heart (the gate)
  'log.expected': 'EXPECTED: {answer}',
  'log.source': 'SOURCE: {source}',
  'log.signalLost': 'SIGNAL LOST.',
  'log.outOfRange': 'NOTHING WITHIN REACH.', // draft

  // ---- Encounter log: outcomes ----
  'log.boss.integrity': 'CONCEPT INTEGRITY {hp}/{max}.',
  'log.boss.holds': 'ITS {@term.boss} HOLDS.',
  'log.boss.cleared': '{@term.boss} REWRITTEN. ASCEND.',
  'log.gate.sealed': 'IT SEALS. THE LIGHT GAINS {turns}. FIND ANOTHER {@term.key}.', // draft. A wrong answer at the gate
  'log.gate.opened': 'EVERY {@term.key} TURNS. IT CANNOT HOLD.', // draft. All keys held: the gate gives
  'log.darkness': 'ITS LIGHT DIES WITH IT. WHAT REMAINS HUNTS YOU. MISSES COST MORE; {@term.gold} PAYS DOUBLE.', // draft
  'log.minion.cleared': '{@term.minion} PRUNED.', // draft (was: MINOR DOUBT ERASED. — the minion is a DENDRITE now)
  'log.minion.disperses': 'THE {@term.minion} RETRACTS INTO THE DARK.', // draft (minions no longer grow back; was: IT WILL GROW BACK. BE READY.)
  'log.chest.opened': 'THOUGHT RELEASED. +{gold} {@term.gold}.', // draft (was: CHEST OPENED. +{gold} PROCESS.)
  'log.chest.trapped': 'IT DOES NOT WANT YOU TO ASCEND.',
  'log.box.gold': 'IT OPENS. +{gold} {@term.gold}.', // draft
  'log.box.trapped': 'THE LID SNAPS SHUT. WHATEVER WAS INSIDE IS GONE.', // draft

  // Haunts: a missed question coming back in a later fight (js/haunts.js).
  'log.haunt.returns': ['A FAMILIAR DOUBT.', 'YOU HAVE HEARD THIS BEFORE.', 'IT REMEMBERS YOU GOT THIS WRONG.'], // draft
  'log.haunt.silenced': ['YOU REMEMBER NOW. IT GOES QUIET.', 'THE DOUBT HAS NOTHING LEFT TO SAY.'], // draft
  'log.haunt.lingers': 'IT WILL BE BACK.', // draft


  // ---- Battle screen labels ----
  'battle.title': 'ENCOUNTER.SYS',
  'battle.selectVector': 'SELECT {@term.query} {@term.vector}',
  'battle.query': '{@term.query}:',
  'battle.answerPlaceholder': 'type your answer',
  'battle.attack': 'Transmit', // draft
  'battle.attempt': 'Transmit', // draft
  'battle.continue': 'CONTINUE',
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
  'type.port': 'Ports', // draft. CompTIA
  'type.protocol': 'Protocols', // draft
  'type.device': 'Devices', // draft
  'type.tool': 'Tools', // draft
  'type.networkType': 'Network types', // draft
  'type.record': 'DNS records', // draft
  'type.standard': 'Standards', // draft
  'type.config': 'Network setup', // draft
  'type.connection': 'Connections', // draft
  'type.cable': 'Cables', // draft
  'type.connector': 'Connectors', // draft
  'type.interface': 'Interfaces', // draft
  'type.memory': 'Memory', // draft
  'type.storage': 'Storage', // draft
  'type.raid': 'RAID', // draft
  'type.board': 'Boards & slots', // draft
  'type.component': 'Parts', // draft
  'type.display': 'Displays', // draft
  'type.printer': 'Printers', // draft
  'type.printSetting': 'Print setup', // draft
  'type.accessory': 'Accessories', // draft
  'type.mobileSetting': 'Mobile setup', // draft
  'type.virtualization': 'Virtualization', // draft
  'type.cloud': 'Cloud', // draft
  'type.cause': 'Likely causes', // draft

  // ---- Question modifiers: name, the tag beside a category, its tooltip ----
  // Tags are one whole word (Timothy: players didn't understand the old
  // single letters B / $ / F / T), shown in capitals by the .mod-tag style.
  'mod.blind': 'Blind Pick',
  'mod.blind.tag': 'Blind',
  'mod.blind.tip': 'the question vanishes after a few seconds.', // draft
  'mod.gambler': 'Gambler',
  'mod.gambler.tag': 'Gamble',
  'mod.gambler.tip': 'wager up to {max} {@term.gold} before answering. Right wins it, wrong loses it.', // draft
  'mod.flip': 'Flip',
  'mod.flip.tag': 'Flip',
  'mod.flip.tip': 'some answers are turned upside down or mirrored.', // draft
  'mod.timer': 'Timer',
  'mod.timer.tag': 'Timer',
  'mod.timer.tip': 'answer within {secs} seconds, or it counts as a miss.', // draft
  // Minigames (js/minigames.js, js/minigameview.js): a question run as a
  // small game. mg.<minigame>.scored.* is the line once it ends, by tier.
  'mg.closeEnough': 'Close Enough', // draft
  'mg.closeEnough.hint': 'Set the dial to the answer.', // draft
  'mg.closeEnough.lock': 'Lock', // draft
  'mg.closeEnough.less': 'Less', // draft
  'mg.closeEnough.more': 'More', // draft
  'mg.closeEnough.scored.X': '{name|upper}: exact.', // draft
  'mg.closeEnough.scored.2': '{name|upper}: close. It was {answer}.', // draft
  'mg.closeEnough.scored.1': '{name|upper}: near. It was {answer}.', // draft
  'mg.closeEnough.scored.miss': '{name|upper}: too far.', // draft
  'mg.higherLower': 'Higher / Lower', // draft
  'mg.higherLower.hint': 'Find the number in {n} guesses.', // draft
  'mg.higherLower.guess': 'Guess', // draft
  'mg.higherLower.left': 'Guesses left: {n}', // draft
  'mg.higherLower.higher': '{n}: HIGHER.', // draft
  'mg.higherLower.lower': '{n}: LOWER.', // draft
  'mg.higherLower.scored.X': '{name|upper}: first guess.', // draft
  'mg.higherLower.scored.2': '{name|upper}: second guess.', // draft
  'mg.higherLower.scored.1': '{name|upper}: last guess.', // draft
  'mg.higherLower.scored.miss': '{name|upper}: out of guesses. It was {answer}.', // draft
  'mg.slowSpell': 'Slow Spell', // draft
  'mg.slowSpell.hint': 'Name it before the letters do. Fewer letters, bigger hit.', // draft
  'mg.slowSpell.know': 'I know it', // draft
  'mg.slowSpell.typePlaceholder': 'type the answer', // draft. Slow Spell's answer box, after I know it
  'mg.slowSpell.enter': 'Enter', // draft
  'mg.slowSpell.shown': 'Letters shown: {n} of {total}', // draft
  'mg.slowSpell.scored.X': '{name|upper}: named it early.', // draft
  'mg.slowSpell.scored.2': '{name|upper}: named it.', // draft
  'mg.slowSpell.scored.1': '{name|upper}: named it late.', // draft
  'mg.slowSpell.scored.miss': '{name|upper}: wrong name. It was {answer}.', // draft
  'mg.syllableSplit': 'Syllable Split', // draft
  'mg.syllableSplit.hint': 'Build the name, piece by piece, in order.', // draft
  'mg.syllableSplit.left': 'Wrong pieces allowed: {n}', // draft
  'mg.syllableSplit.scored.2': '{name|upper}: clean build.', // draft
  'mg.syllableSplit.scored.1': '{name|upper}: built, with a slip.', // draft
  'mg.syllableSplit.scored.miss': '{name|upper}: broken. It was {answer}.', // draft
  'mg.letterPool': 'Letter Pool', // draft
  'mg.letterPool.term': '{label|upper}: FORM {n}.', // draft
  'mg.letterPool.hint': 'Spell answers from the letters. Use any letter again.', // draft
  'mg.letterPool.back': 'Take a letter off', // draft
  'mg.letterPool.enter': 'Enter', // draft
  'mg.letterPool.done': 'Done', // draft
  'mg.letterPool.count': 'Formed: {n} of {form}. Hidden found: {hidden} of {of}.', // draft
  'mg.letterPool.said.hidden': '{word}: HIDDEN. FORMED.', // draft
  'mg.letterPool.said.valid': '{word}: FORMED.', // draft
  'mg.letterPool.said.again': '{word}: ALREADY FORMED.', // draft
  'mg.letterPool.said.unknown': '{word}: NOT IN {label|upper}.', // draft
  'mg.letterPool.scored.X': '{name|upper}: every hidden answer found.', // draft
  'mg.letterPool.scored.2': '{name|upper}: formed {given}.', // draft
  'mg.letterPool.scored.1': '{name|upper}: formed {given}. Short.', // draft
  'mg.letterPool.scored.miss': '{name|upper}: too few. Hidden: {answer}.', // draft
  'mg.codeBreak': 'Code Break', // draft
  'mg.codeBreak.hint': 'Crack the code in {n} guesses.', // draft
  'mg.codeBreak.placeholder': '{n} characters', // draft. Code Break's guess box
  'mg.codeBreak.try': 'Try', // draft
  'mg.codeBreak.left': 'Guesses left: {n}', // draft
  'mg.codeBreak.length': 'The code is {n} characters.', // draft
  'mg.codeBreak.mark.hit': 'right place', // draft
  'mg.codeBreak.mark.near': 'elsewhere', // draft
  'mg.codeBreak.mark.miss': 'not in it', // draft
  'mg.codeBreak.scored.X': '{name|upper}: cracked on the first guess.', // draft
  'mg.codeBreak.scored.2': '{name|upper}: cracked on the second guess.', // draft
  'mg.codeBreak.scored.1': '{name|upper}: cracked on the last guess.', // draft
  'mg.codeBreak.scored.miss': '{name|upper}: still locked. It was {answer}.', // draft
  'mg.verdict': 'Verdict', // draft
  'mg.verdict.hint': 'True or false? {n} claims.', // draft
  'mg.verdict.claim': 'Claim {i} of {n}', // draft
  'mg.verdict.true': 'True', // draft
  'mg.verdict.false': 'False', // draft
  'mg.verdict.wasTrue': 'It was true: {answer}.', // draft. A true claim called false
  'mg.verdict.wasFalse': 'It was false: {answer}, not {shown}.', // draft. A false claim called true
  'mg.verdict.timeUp': 'Time. {line}', // draft. A claim not called in time
  'mg.verdict.given': '{n} of {total} right', // draft
  'mg.verdict.scored.X': '{name|upper}: every call right.', // draft
  'mg.verdict.scored.2': '{name|upper}: {given}.', // draft
  'mg.verdict.scored.1': '{name|upper}: {given}.', // draft
  'mg.verdict.scored.miss': '{name|upper}: {given}. Missed.', // draft
  'mg.crosswire': 'Crosswire', // draft
  'mg.crosswire.hint': 'Two answers cross. The shared letter is given.', // draft
  'mg.crosswire.across': 'ACROSS ({n})', // draft. Clue label, n = letters
  'mg.crosswire.down': 'DOWN ({n})', // draft
  'mg.crosswire.cellAcross': 'Across, letter {n}', // draft. A grid square, for screen readers
  'mg.crosswire.cellDown': 'Down, letter {n}', // draft
  'mg.crosswire.cellShared': 'Shared letter {letter}', // draft
  'mg.crosswire.check': 'Check', // draft
  'mg.crosswire.reveal': 'Reveal', // draft
  'mg.crosswire.reveals': 'Reveals: {n}. Each one costs a step.', // draft
  'mg.crosswire.scored.X': '{name|upper}: both words, no help.', // draft
  'mg.crosswire.scored.2': '{name|upper}: both words, one reveal.', // draft
  'mg.crosswire.scored.1': '{name|upper}: {given}.', // draft
  'mg.crosswire.scored.miss': '{name|upper}: neither word. It was {answer}.', // draft
  'mg.fogReveal': 'Fog Reveal', // draft
  'mg.fogReveal.hint': 'The fog lifts slowly. Name it early for a bigger hit.', // draft
  'mg.fogReveal.covered': 'Covered: {n} of {total}', // draft
  'mg.fogReveal.scored.X': '{name|upper}: named it in the fog.', // draft
  'mg.fogReveal.scored.2': '{name|upper}: named it half seen.', // draft
  'mg.fogReveal.scored.1': '{name|upper}: named it late.', // draft
  'mg.fogReveal.scored.miss': '{name|upper}: wrong. It was {answer}.', // draft
  'mg.sumLock': 'Sum Lock', // draft
  'mg.sumLock.term': 'LOCKED. TWO ANSWERS, ONE CODE.', // draft. Stands in for a trapped box's question
  'mg.sumLock.hint': 'Add the two answers. Enter the total.', // draft
  'mg.sumLock.total': 'total', // draft. Sum Lock's answer box
  'mg.sumLock.open': 'Open', // draft
  'mg.sumLock.reveal': '{total} ({a} + {b})', // draft
  'mg.sumLock.scored.X': '{name|upper}: {given}. The lock opens.', // draft
  'mg.sumLock.scored.miss': '{name|upper}: {given} is wrong. It was {answer}.', // draft
  'battle.timer': 'TIME: {s}',
  'battle.noAnswer': '(no answer)',
  'battle.blindQuestion': '????', // draft
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

  // ---- Room (map) screen ----
  'room.sensed.simple': 'Enemy close.', // draft. "I see you." with Simple enemies on (Timothy: it falls under the filter)
  // The tutorial room (tutorial.js). Timothy's script: the dungeon's
  // whisper, then the kind voice, then the barrel's question.
  'tut.cantLeave': "You can't leave. Don't try.", // Timothy's wording. Fades on waking, in "I see you."'s style
  'tut.trust': 'You can do this. I trust you.', // Timothy's wording. The kind voice, walking toward the light
  'tut.lookUp': "It's watching you. Show it true light.", // Timothy's wording (sky eye plan step B). The kind voice, the first time the player stands in the light from above, shoulder view only: up there the eye is wide open, so they learn an open eye is bad without being told
  'tut.die': 'Die in darkness.', // Timothy's wording. The dungeon, as the ring of dark closes after the name
  'tut.dimLight': "Don't let them dim your light.", // Timothy's wording. The kind voice, a moment later: the only hint
  'tut.ring.words': 'dark dim die dark dim die', // draft. The words circling the player in the ring (split on spaces)
  'room.blocked.dark': 'The dark holds you here.', // draft. A step while the tutorial's ring is closed
  'tut.hint.light': 'Your light: V, or tap the middle of the arrows 3 times.', // draft. Room log, only if stuck in the ring
  'tut.hint.move.stick': 'Hold to walk. A quick tap only looks.', // draft (one stick plan step G). Stuck in the dark with One stick: the stick or the keys
  'tut.hint.light.stick': 'Your light: V, or tap the stick 3 times.', // draft (one stick plan step G). Stuck in the ring with One stick
  'tut.reach': 'When it reaches, step away.', // draft (one stick plan step G). The kind voice, the first time the tutorial's stick man reaches for the player with One stick: out of reach, it misses
  'tut.ready': "They'll be listening. Be ready.", // Timothy's wording (vents and noise plan step D: world-driven, not on the nose; it hints that sound brings them). The kind voice, once the ring breaks; then a stick man comes out of the grate
  'tut.breathe': 'Breathe. Then READY.', // draft (kill or maim plan step C). The kind voice, as the tutorial's first shot opens the dial at READY
  'tut.dial': 'Stop on K to kill. M drops it.', // draft. The kind voice, once that dial runs
  'tut.charger': 'It still holds a charge.', // draft (charger plan step C). The kind voice, the first time in a run the player makes out a charger
  'tut.static': 'Static means one is close.', // draft (static). The kind voice, the first time the static shows in the tutorial's fight (the stick man is out of the grate), so the player learns the grain means one is near
  'tut.finish': 'Finish it.', // draft (downed plan step C). The kind voice, when the tutorial's stick man goes down: a bump finishes it
  'tut.name.q': 'What is your name?', // Timothy: the barrel asks the player's name; any name is right
  // The plain hints show only for a player stuck on a stage (TUTORIAL_STUCK_MS).
  'tut.hint.move': 'Up walks ahead. Left and right sweep your light.', // draft. Stuck in the dark
  'tut.hint.barrel': 'Walk into the barrel to open it.', // draft. Stuck at the barrel
  'tut.hint.fire': 'Look at it and press SELECT to shoot.', // draft. Stuck in the fight
  'tut.key.dropped': 'It falls. Something is left where it stood.', // draft. The stick man is gone and left the key
  'tut.door.open': 'The locked door opens.', // draft. Key taken
  'tut.light.none': 'Your light will not come on.', // draft. V in the tutorial's dark
  'tut.light.held': 'Keep your light on.', // draft. V in the tutorial's fight: the light stays on there
  'tut.name.kept': 'Your name is {name}.', // draft. After the barrel's answer
  'room.blocked.door': 'The door is locked.', // draft. The tutorial's door before its key
  'room.sensed': 'I see you.', // Timothy's wording: something unseen will be beside the player after its next move (combat.js senseUnseen)
  'room.wait': ['You hold still. The hum continues.', 'You wait. Something recalibrates.'], // draft
  'room.stickTaps': 'Tap 3 times for your light. Hold to wait.', // draft. The look stick's first tap (light battery plan step D)
  'room.walkStickTaps': 'Tap 3 times for your light. Hold still to look up.', // draft. The round stick's first tap (one stick plan step B)
  'room.walkStickTaps.plain': 'Hold still to look up.', // draft. The same in Comfort mode
  'dpad.walkStick': 'Move stick: drag to walk, push a little to creep, hold still to look up, tap 3 times for your light', // draft. The round stick's label (one stick plan step B)
  'room.sneak.on': 'You crouch low and creep.', // draft. X switched sneaking on (one stick plan step B)
  'room.sneak.off': 'You stand and walk.', // draft. X switched it off
  'room.cover': 'In cover. Keep low.', // draft (Timothy 2026-10-26). Crouched beside something solid: quieter, and unseen from its far side
  'room.reach.missed': 'It misses.', // draft. A stick man's reach ended with the player out of reach (one stick plan step C)
  'room.stickTaps.plain': 'Hold to wait.', // draft. The same in Comfort mode, where there is no light to switch
  'dpad.stick.wait': 'Look stick: push sideways to sweep your light, push up to look up, hold to wait, tap 3 times for your light', // draft. The d-pad centre's label
  'dpad.stick.wait.plain': 'Look stick: push sideways to sweep your light, push up to look up, hold to wait', // draft. Its label in Comfort mode
  'dpad.stick.turn': 'Look stick: tap to turn and face your aim', // draft. Its label while the aim is past the arc
  'room.turn': 'You turn.', // draft. Free look: turning the body to look further round costs a turn
  'room.coin': 'You absorb a trace of {@term.gold}.', // draft
  'room.key': '{@term.key} {held} of {total}.', // draft. A key taken (locked core plan)
  'room.gate.unsealed': 'Somewhere behind you, the {@term.boss} listens again.', // draft. A key taken while the gate was sealed
  'room.blocked.gate': 'The {@term.boss} is sealed. Find another {@term.key}.', // draft. Bumped the gate after a wrong answer
  'room.engage': 'Something fires in the dark.', // draft
  'room.light.consumed': 'The light reaches everything.', // draft
  // The player's own light on its battery (battery.js; light battery plan, wording from the mockup)
  'room.ownLight.on': 'Light on.', // draft
  'room.ownLight.off': 'Light off. Only the circle round you now.', // draft
  'room.ownLight.died': 'Your light dies. It needs a full charge.', // draft. Ran empty with the light on: locked off until full
  'room.ownLight.charged': 'Your light is charged.', // draft. A locked light is full again
  'room.ownLight.locked': 'No light until it is full. {turns} more turns.', // draft. V while locked
  'room.ownLight.locked.seconds': 'No light until it is full. {seconds} more seconds.', // draft. The same with One stick (one stick plan step D)
  'room.gaze.step': 'It comes closer while you look.', // draft. The eye (gaze.js) is full: the stick man steps one closer
  'room.gaze.stare': 'It stares at you.', // draft. The same, already beside the player
  'room.blocked.wall': 'The membrane holds.', // draft
  'room.blocked.boss': 'The {@term.boss} will not move.', // draft
  'room.blocked.minion': 'A {@term.minion} is in the way.', // draft
  'room.blocked.hunter': 'The {@term.hunter} is right there.', // draft
  'room.hunter.wakes': ['Something else wakes. It knows where you are.', 'An {@term.hunter} stirs, far off, and turns toward you.'], // draft
  'room.blocked.corner': 'The corner is in the way.', // draft. A diagonal step that would cut past a wall or pillar (eight ways plan)
  // A fixed plan's furniture, bumped (room view plan step E; plans.js).
  'furniture.desk': ['A desk. A word is carved into it, then scratched out.', 'A desk, its chair pushed in.'], // draft
  'furniture.teacher': "The teacher's desk. The register lies open at a blank page.", // draft
  'furniture.shelf': ['Shelves. Every spine is blank.', 'Shelves, packed tight.'], // draft
  'furniture.table': 'A table, set for no one.', // draft
  'furniture.bench': 'A bench. The taps along it are dry.', // draft
  'furniture.easel': 'An easel. The canvas faces away.', // draft
  'furniture.sink': 'A sink. The mirror above it is gone.', // draft
  'furniture.stall': 'A stall door, shut.', // draft
  'furniture.sofa': 'A sofa, sunk where someone always sat.', // draft
  'room.blocked.pillar': ['A pillar. Cold, and older than you.', 'Stone. It does not think.'], // draft

  // Reading papers (step onto one) and examining boxes (bump into one; a turn passes).
  'room.paper.lore': 'You read: {lore}', // draft — {lore} is a line from the room theme’s lore below
  'room.paper.junk': ['The page is blank.', 'The ink has run. Nothing is left.', 'A list of names, all crossed out.', 'It crumbles as you touch it.'], // draft
  'room.box.gold': 'Inside: {gold} {@term.gold}.', // draft
  'room.box.junk': ['Empty.', 'Dust, and a smell like old rain.', 'A broken lens. Useless.', 'Rags. Nothing more.'], // draft
  'room.box.done': 'It is empty now.', // draft
  'room.cell.done': 'The cell is spent.', // draft. Bumping a used energy cell
  // Relays (strategy plan step B, relays.js). Bump one: a question over the
  // map. Right holds the room (no boss light, nothing from outside comes in)
  // and takes {turns} turns off the light. All drafts for Timothy.
  'room.relay.found': 'A dead {@term.relay}. It hums when you come close.', // draft
  'room.relay.held': 'The {@term.relay} wakes. This room is yours now, and the light falls back.', // draft
  'room.relay.heldDark': 'The {@term.relay} wakes. This room is yours now.', // draft. Boss already down: no light to push back
  'room.relay.sparked': 'The {@term.relay} sparks and dies. The light surges.', // draft
  'room.relay.sparkedDark': 'The {@term.relay} sparks and dies.', // draft
  'room.relay.done': 'The {@term.relay} is spent.', // draft. Bumping a used relay
  // Grates (vents.js): stepping onto one, as part of the step.
  'room.vent.stepped': 'A grate. Air moves through it.', // draft (Timothy's plan call 1)
  'room.vent.entered': 'Something crawls into a grate.', // draft. A stick man goes into a duct, seen or not: always logged (Timothy: dread) (vents.js)
  'room.vent.rattle': 'The grate shudders.', // draft. Something will drop out of it next turn
  'room.vent.dropped': 'Something drops out of the grate.', // draft. Seen: now the player knows where its pair leads
  // The reflective desk (desk.js): in the start room, heals to full once a floor.
  'room.desk.healed': 'You see yourself in the {@term.desk}. You are whole again.', // draft
  'room.desk.full': 'Your face looks back from the {@term.desk}. You are already whole.', // draft. Full stability: the heal is kept
  // The charger (charger.js): energy to full through CHARGE.SYS, in the start room.
  'room.charger.loose': 'CHARGE.SYS. Its wires are loose.', // draft. Opened on new wires
  'room.charger.kept': 'Your wires are as you left them.', // draft. Opened on half-done wires
  'room.charger.left': 'You step back from the {@term.charger}.', // draft. LEAVE or Escape
  'room.charger.found': 'It found you. CHARGE.SYS closed.', // draft. A stick man reached the player while it was open
  'room.charger.done': 'The {@term.charger} hums. Energy full.', // draft
  'room.charger.doneLight': 'The {@term.charger} hums. Energy and light full.', // draft. The same when it filled the light's battery too (Timothy 2026-10-26)
  'room.charger.full': 'The {@term.charger} has nothing to give. Your energy and light are full.', // draft. Bumped with both full: nothing opens
  'charger.title': 'CHARGE.SYS', // draft
  'charger.hint': 'Turn the wires so power reaches the cell.', // draft
  'charger.charged': 'Charged. Energy full.', // draft
  'charger.turns': 'TURNS SPENT {turns}', // draft. Turn mode: the turns the wires have cost so far
  'charger.clock': 'THE CLOCK RUNS', // draft. Real time: the clock is the cost
  'charger.pwr': 'PWR▸', // draft
  'charger.cell': '◂CELL', // draft
  'charger.wire': 'Wire {row}, {col}', // draft. A wire button's label
  'charger.powered': 'powered', // draft. Added to a wire's label while power runs through it
  'charger.leave': 'LEAVE', // draft
  'room.desk.done': 'The {@term.desk} is dull now. It will shine on the next floor.', // draft. Bumping a used desk

  // Stairs and floor goals (strategy plan step A). Stepping onto the stairs
  // only asks; SELECT or Enter goes down. All drafts for Timothy.
  'room.stairs.ask': 'Stairs lead down. SELECT or ENTER to descend. Step away to stay.', // draft
  // Two ways down from a between-rest (strategy plan step C): floors.js
  // FLOOR_PATHS. All drafts for Timothy.
  'room.stairs.two': 'Two ways lead down.', // draft. Room log on arriving at a between-rest
  'room.stairs.path': 'These stairs lead to {path}.', // draft
  'room.stairs.hidden': 'Where these stairs lead is hidden. Something here could show you.', // draft
  'room.path.taken': 'You chose {path}.', // draft. Room log on arriving at the depth
  'path.crowded': 'MORE OF THEM, MORE TIME', // draft. Two more minions, the light slower
  'path.hurried': 'FEWER OF THEM, LESS TIME', // draft. One minion fewer, the light faster
  'path.stalked': 'STALKERS WHERE SHARDS WERE', // draft. Every SHARD a STALKER, the light as usual
  'room.goals.new': 'Asked of you here: {goals}.', // draft. Room log on arrival
  'room.goal.met': '{goal}: kept. +{gold} {@term.gold}.', // draft. Scored on the way down
  'room.goal.missed': '{goal}: not kept.', // draft
  'goal.noMiss': 'NO MISSES', // draft. Nothing answered wrong on the floor
  'goal.allPapers': 'ALL PAPERS', // draft. Every paper on the floor read
  'goal.swift': 'SWIFT', // draft. The boss down before the eye is half open
  'goal.noHunter': 'BEFORE THE HUNTER', // draft. Gone down before the hunter wakes
  'goal.noStruggle': 'NO STRUGGLE', // draft. Never caught with no energy

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
  'exchange.item.scout': 'See where the other stairs lead', // draft (strategy plan step C)
  'exchange.why.noHidden': 'Nothing here is hidden from you.', // draft
  'exchange.scouted': 'You see it now. The other stairs lead to {path}.', // draft
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
  'intro.call': 'LEARN AND REWRITE FALSE BELIEFS.', // Timothy: ties to the bosses; shows after the fake player's miss fades
  'intro.rejected': 'REJECTED.', // the fake player's miss, in the word a miss shows in the game (log.rejected)
  'intro.skip': 'Any key or tap to skip', // draft
  'start.enter': 'Enter the {@term.dungeon}', // draft
  'start.name.label': 'Your name', // draft
  'start.name.placeholder': 'Leave blank to stay nameless', // draft
  'start.dpadRight': 'Swap sides: arrows on the right, buttons on the left', // draft. For a player who moves with the other hand
  'start.simpleEnemies': 'Comfort mode: plain enemies, light always on', // draft. A comfort option for players who don't want creepy enemies: every enemy a still letter e, and no light battery (was "Simple enemies")
  'start.tutorial': 'Tutorial room: runs once before your first run', // draft. On until a tutorial is finished
  'start.turns': 'Turns: the world waits for you (step by step, no rush)', // draft. Start screen option (one stick plan step G): off, the default, the game is in real time with one stick
  'start.realTime': 'Real time: the dark keeps moving every 2.5 s, even while you answer', // draft. Shown with Turns on only

  // ---- Set screen (after Enter: which questions this run asks) ----
  'pick.title': 'QUERY.SET', // draft
  'pick.prompt': 'What will the {@term.dungeon} ask you?', // draft
  'pick.builtinGroup': 'Built-in', // draft
  'pick.savedGroup': 'Your sets', // draft
  'pick.workshopList': 'Workshop list', // draft — the list last loaded in the workshop, not saved
  'pick.count': '{count} {count|plural:question}', // draft
  'pick.last': 'last played', // draft
  'pick.loading': 'Loading {name}…', // draft
  'pick.failed': 'Could not load {name}. Try again.', // draft
  'pick.empty': 'No sets found. Make one in the workshop.', // draft
  'pick.back': 'Back', // draft
  'pick.workshop': 'Make your own set', // draft

  // Minigame practice (js/practice.js): five taps on the title on the start
  // screen. Play any minigame on its own, no points.
  'practice.title': 'PRACTICE.SYS', // draft
  'practice.prompt': 'Play a minigame on its own. Nothing is scored.', // draft
  'practice.set': 'Questions from', // draft
  'practice.mods': 'Modifiers', // draft
  'practice.play': 'Play', // draft
  'practice.again': 'Again', // draft
  'practice.menu': 'Menu', // draft
  'practice.back': 'Back', // draft
  'practice.loading': 'Loading the set...', // draft
  'practice.loadFailed': 'That set would not load. Try another.', // draft
  'practice.noSets': 'No sets to play from.', // draft
  'practice.nothingFits': 'Nothing in this set fits {game}. Try another set.', // draft
  'practice.tier': 'Tier {tier}.', // draft. A right answer: 1, 2 or X
  'practice.miss': 'Missed. It was {answer}.', // draft

  // ---- Workshop (set making, for authors; reached from the set screen) ----
  'workshop.title': 'WORKSHOP',
  'workshop.intro': 'Paste or load a list, then save it. Saved sets show on the set screen.',
  'workshop.pasteLabel': 'Paste or load a list',
  'workshop.formatHelp': 'Format help',
  'workshop.back': 'Back to sets',
  'workshop.loaded': 'Loaded {count} items. Pick "Workshop list" on the set screen to play it.',
  'workshop.sample': 'Loaded the built-in multiple choice sample ({count} items) as the workshop list.',
  'workshop.fileFailed': 'Could not read that file.',
  'workshop.needName': 'Give this set a name first.',
  'workshop.needList': 'Paste or load a list before saving.',
  'workshop.saved': 'Saved "{name}". It now shows on the set screen.',
  'workshop.noSaved': 'Nothing saved yet. Paste a list above and save it to reuse later.',
  'workshop.delete': 'Delete',

  // ---- Question data viewer (workshop) ----
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
  'gun.block.notInLight': 'Not in your light. Look at it first.', // draft
  'gun.block.needsTurn': 'Behind your shoulder. Turn to face it.', // draft. Tapped, but past the free look arc
  'gun.block.noLineOfSight': 'No line of sight.', // draft
  'gun.block.noEnergy': 'No energy. Find a cell.', // draft
  'gun.block.energyFull': 'Energy is full.', // draft
  'gun.block.notShootable': 'The gun does nothing to that.', // draft
  'gun.block.noTarget': 'Nothing in reach.', // draft. FIRE or T with nothing the gun can reach
  'gun.miss': 'MISS', // floats up over a minion when a shot backfires
  // The gun's panels over the map (gunpanels.js).
  'gun.reload.title': 'SELECT RELOAD: {category|upper}', // draft. Over the reload choices; {category} is the next category
  'gun.reload.titlePlain': 'SELECT RELOAD', // draft. The same, for a set with no categories
  'gun.reload.offer': '+{energy} ENERGY', // draft
  'gun.reload.room': 'room for {room}', // draft. When less energy fits under the most you can hold than the offer gives
  'gun.reload.cancel': 'CANCEL', // draft
  // The dial (kill or maim plan): READY first, then the marker runs; zones K / M and harmful ones.
  'gun.dial.ready': 'SELECT WHEN READY', // draft. Over the veil before the dial starts: nothing of it shows yet
  'gun.dial.readyButton': 'READY', // draft. The button in the middle of the veil; it starts the dial
  'gun.dial.back': 'BACK', // draft. Under READY: puts the gun down, nothing spent
  'gun.dial.stop': 'STOP', // draft. In the middle of a running dial with no lap limit
  'gun.dial.lap': 'LAP {lap}/{of}', // draft. In the middle of a running dial with a lap limit (depth 3)
  'gun.dial.darkArc': 'dark', // draft. Under the dark arc (a dark shot or a low battery)
  'gun.dial.guardRing': 'GUARD · ', // draft. Repeated round the inside of a guarded one's dial
  'gun.dial.result.kill': 'KILL', // draft. In the dial's middle after the stop, while it fades
  'gun.dial.result.down': 'DOWN', // draft. A maim dropped it
  'gun.dial.result.finished': 'FINISHED', // draft. A downed one finished
  'gun.dial.result.guard': 'GUARD BROKEN', // draft
  'gun.dial.result.hit': 'HIT', // draft. A maim with DEV -> Downed off: it only reels
  'gun.dial.result.miss': 'MISS', // draft
  'gun.dial.result.jam': 'JAMMED', // draft
  'gun.dial.result.loud': 'LOUD', // draft
  'gun.dial.result.lunge': 'LUNGE', // draft
  'gun.dial.result.shoved': 'SHOVED', // draft. The Struggle dial stopped in its zone
  'gun.dial.result.lost': 'LOST', // draft. The Struggle dial missed
  'gun.dial.prompt': 'PRESS SELECT', // draft. While the dial runs
  'gun.dial.dark.fast': 'DARK SHOT · FASTER', // draft. A shot in the dark whose dial goes round faster (light battery plan)
  'gun.dial.dark.plain': 'DARK SHOT', // draft. A shot in the dark in the tutorial room, no harder than a lit one
  'gun.dial.dark.x': 'DARK SHOT · ONE MORE HARMFUL ZONE', // draft. A shot in the dark with one more harmful zone
  'gun.dial.label': 'Dial. Press SELECT, Space, F or READY to start it, then SELECT, Space or F to fire. Escape or BACK puts the gun down before it starts.', // draft. Read out by screen readers
  'gun.dial.zone.kill': 'K', // draft. Marked on the kill zone
  'gun.dial.zone.maim': 'M', // draft. Marked on the maim zone
  'gun.dial.zone.jam': 'X', // draft. Marked on a jam zone
  'gun.dial.zone.loud': 'N', // draft. Marked on a loud zone
  'gun.dial.zone.lunge': '>', // draft. Marked on a lunge zone
  'gun.dial.key.kill': 'K = kill', // draft. The dial's key, one entry per kind of zone on it
  'gun.dial.key.maim': 'M = maim', // draft
  'gun.dial.key.guard': 'K / M = break its guard', // draft. On a guarded one (the HUSK)
  'gun.dial.key.finish': 'K / M = finish it', // draft. On a downed one
  'gun.dial.key.jam': 'X = jam, lose 1 energy', // draft
  'gun.dial.key.loud': 'N = loud', // draft
  'gun.dial.key.lunge': '> = it lunges', // draft
  'gun.dial.key.miss': 'else miss', // draft
  'gun.dark.nothing': 'The shot goes into the dark. Nothing there.', // draft. A shot in the dark that found nothing
  'map.btn': 'MAP', // draft. The minimap button (M on a keyboard)
  'ask.title.reload': 'RELOAD.SYS', // draft. The ask screen's title for a reload (its offers, then its question)
  'ask.title.relay': 'RELAY.SYS', // draft. The ask screen's title for a relay's question
  'ask.title.barrel': 'BARREL', // draft. The ask screen's title for the tutorial barrel's question
  'log.btn': 'LOG', // draft. The room log button (L on a keyboard): the whole log over the map
  'hud.more': 'Status: tap for more', // draft. The HUD's tooltip: a tap shows myelin, cycle and the goals' names
  'map.label': 'Map of what you have seen on this floor. Tap to close.', // draft. Read out by screen readers
  // Fixed floor plans (plans.js): each floor's name, then its rooms' names.
  // A room's name shows the first time the player walks in (room.enter.named)
  // and on the minimap. Depth 1 is Timothy's pick; depths 2 and 3 are drafts.
  'room.enter.named': '{name}.', // draft. The log line on first walking into a room on a fixed plan
  'room.enter.plan': '{floor}. {name}.', // draft. On arriving on a fixed plan: the building's name, then the room you wake in
  'plan.school': 'THE SCHOOL', // draft. The floor's name, on the minimap
  'plan.school.examHall': 'Exam hall', // draft
  'plan.school.frontHall': 'Front hall', // draft
  'plan.school.lab': 'Lab', // draft
  'plan.school.library': 'Library', // draft
  'plan.school.artRoom': 'Art room', // draft
  'plan.school.class1': 'Class 1', // draft
  'plan.school.class2': 'Class 2', // draft
  'plan.school.toilets': 'Toilets', // draft
  'plan.school.staffRoom': 'Staff room', // draft
  'plan.archive': 'THE ARCHIVE', // draft. The floor's name, on the minimap
  'plan.archive.core': 'Strongroom', // draft
  'plan.archive.wake': 'Front desk', // draft
  'plan.archive.readingRoom': 'Reading room', // draft
  'plan.archive.vault': 'Vault', // draft
  'plan.archive.catalogue': 'Catalogue', // draft
  'plan.archive.bindery': 'Bindery', // draft
  'plan.observatory': 'THE OBSERVATORY', // draft. The floor's name, on the minimap
  'plan.observatory.telescopeRoom': 'Telescope room', // draft
  'plan.observatory.lobby': 'Lobby', // draft
  'plan.observatory.dome': 'Dome', // draft
  'plan.observatory.darkroom': 'Darkroom', // draft
  'plan.observatory.bunks': 'Bunks', // draft
  'plan.observatory.orrery': 'Orrery', // draft
  'plan.observatory.plateStore': 'Plate store', // draft
  'plan.observatory.clockRoom': 'Clock room', // draft
  'plan.observatory.boilerRoom': 'Boiler room', // draft
  'gun.struggle.ready': 'STRUGGLE · SELECT WHEN READY', // draft. Before the Struggle dial starts (no energy, a minion reached the player)
  'gun.struggle.readyAgain': 'STRUGGLE {count} · SELECT WHEN READY', // draft. The same, for a later Struggle on this floor (faster, smaller zone)
  'gun.struggle.prompt': 'STRUGGLE: PRESS SELECT', // draft. While the Struggle dial runs
  'gun.struggle.promptAgain': 'STRUGGLE {count}: PRESS SELECT', // draft. The same, for a later Struggle on this floor
  'gun.struggle.label': 'Struggle dial. Press SELECT, Space or F to start it, then again in its zone to push it back.', // draft. Read out by screen readers
  'gun.struggle.start': 'Empty. It is on you.', // draft. A minion reached the player with no energy
  'gun.struggle.won': 'You shove it away.', // draft. The Struggle dial stopped in the zone
  'gun.struggle.lost': 'It gets through.', // draft. The Struggle dial missed; the strike line follows
  'gun.reloaded': '+{energy} energy.', // draft. A right reload answer
  'gun.jammed': 'The cell fizzles. No energy.', // draft. A wrong reload answer
  // Gun combat on the map (gun plan step 6): the buttons by the d-pad, the
  // HUD, and the room notes a shot or a strike adds up to.
  'gun.btn.select': 'SELECT', // draft. The gun's one button, by the d-pad (key F): fires at the target, or starts and stops the dial
  'stat.energy': 'ENERGY', // draft. HUD: energy held, # each and - for room left
  'stat.battery': 'LIGHT {cells} {state}', // draft. Foot of the map: the light's battery, # a turn of charge and - spent, then its state
  'stat.battery.on': 'ON', // draft
  'stat.battery.off': 'OFF', // draft
  'stat.battery.empty': 'EMPTY', // draft. Ran empty: locked off until full
  'stat.target': 'TARGET', // draft. HUD: the gun's target, and its guard while it has one
  'stat.guard': '[GUARD]', // draft. HUD and over the target: a minion whose guard is still whole (the HUSK)
  'stat.noTarget': '-', // the HUD's target with nothing targeted
  'stat.goals': 'GOALS', // draft. HUD: the floor's goals, [x] kept / [-] lost / [ ] not yet
  'stat.clock': 'NEXT', // draft. HUD, Real time only: a meter that reaches its end as the dark next moves
  'minionKind.SHARD': 'SHARD', // draft. A minion kind's name (config.js MINION_KINDS), in the HUD
  'minionKind.HUSK': 'HUSK', // draft
  'minionKind.STALKER': 'STALKER', // draft
  'gun.missed': 'Miss. It keeps coming.', // draft. The dial stopped outside every zone
  'gun.cleanKill': 'Clean kill.', // draft. The dial stopped in the kill zone
  'gun.shotJammed': 'Jammed. 1 energy lost.', // draft. The dial stopped in a jam zone
  'gun.shotJammedEmpty': 'Jammed.', // draft. The same, with no energy left to lose
  'gun.shotLoud': 'Too loud. It carries.', // draft. The dial stopped in a loud zone
  'gun.shotLunged': 'It lunges.', // draft. The dial stopped in a lunge zone: it steps closer
  'gun.guardBroken': 'The guard breaks. It reels.', // draft. A hit on a guard (the HUSK's)
  'gun.lowered': 'You lower the gun.', // draft. BACK before READY: nothing spent
  'gun.stunned': 'It reels.', // draft. A maim with DEV -> Downed off: the minion skips its next move
  // Category weaknesses (strategy plan step D): {group} is a reload group's label.
  'gun.matched': 'The round was made for it.', // draft. A round from the group the minion is weak to (its kill zone was wider)
  'gun.weakFound': 'The {kind} flinches. It is weak to {group}.', // draft. First landed shot on a kind
  'stat.weakUnknown': '?', // draft. HUD target: a minion kind whose weakness isn't found yet
  'gun.killed': 'It comes apart. {gold} {@term.gold}.', // draft. A kill and the gold it paid
  'gun.struck': 'It strikes. -{cost} {@term.hp}.', // draft. A minion reached the player
  'gun.hunterStruck': 'The {@term.hunter} strikes. -{cost} {@term.hp}.', // draft. The hunter reached the player (gun on)
  'gun.hunterStaggered': 'The {@term.hunter} staggers.', // draft. A landed shot on the hunter
  // Downed stick men (downed plan): a shot in the dial's maim zone.
  'gun.downed': 'It goes down. It keeps coming.', // draft. It falls and crawls on its arms
  'gun.finished': 'You finish it.', // draft. The player walked into a downed one
  'gun.grabbed': 'It has your ankle.', // draft. A downed one reached the player
  'gun.heldFast': 'It holds on. Finish it.', // draft. A step away while it holds the player's ankle
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
// data-t-placeholder="key" for input placeholders and data-t-title="key"
// for tooltips (also the element's spoken name). Elements that mirror
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
  root.querySelectorAll('[data-t-title]').forEach((el) => {
    el.title = t(el.dataset.tTitle);
    el.setAttribute('aria-label', el.title);
  });
}
