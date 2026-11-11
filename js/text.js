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
  'term.hp': 'STABILITY',
  'term.gold': 'MYELIN',
  'term.query': 'QUERY',
  'term.furniture.symbol': '=', // a fixed plan's furniture; drawn as itself in both views, the glyph is a fallback
  'term.charger': 'CHARGER', // draft
  'term.charger.symbol': 'ϟ', // draft. A spark
  'term.console': 'TRAINING CONSOLE', // draft. Ship plan step B: where you learn a crew role, in Command
  'term.console.symbol': '▣', // draft. A screen
  'term.powerBoard': 'POWER BOARD', // draft. The Engineer's board in the Engine room
  'term.powerBoard.symbol': 'ϟ', // draft. A spark, like the charger
  'term.crew': 'CREW', // draft. A crew member at their station
  'term.crew.symbol': '☺', // draft. A face
  'term.shutter.symbol': '≡', // draft. The safe room's shutter (saferoom.js); drawn as slats on the map, the glyph is a fallback
  // The player's glyph (the map draws a stick man in its place).
  'term.player.symbol': '@',

  // ---- Status bar ----
  'stat.hp': '{@term.hp}',
  'stat.gold': '{@term.gold}',
  'stat.turn': 'CYCLE', // draft
  // The ship's HUD (ship plan step C, render.js renderHud): in place of
  // stability, energy, target and depth.
  'stat.taught': 'TAUGHT', // draft. Crew taught of the roles on duty (crew roles plan step C)
  'stat.sound': 'SOUND', // draft. The top bar's volume button
  'sound.off': 'OFF', // draft
  'sound.step': '{step}/3', // draft. The volume, in thirds
  'sound.title': 'Tap to pick the volume of all sound', // draft
  'stat.textSize': 'TEXT', // draft. The top bar's text size button
  'textSize.step': '{pct}%', // draft. A text size, as a percent of the game's own
  'textSize.title': 'Tap to pick the size of all text', // draft
  'stat.crew': 'CREW', // draft. The crew's panic, by name and as a meter
  'panic.0': 'CALM', // draft
  'panic.1': 'UNEASY', // draft
  'panic.2': 'SHAKEN', // draft
  'panic.3': 'PANICKING', // draft
  'panic.4': 'BROKEN', // draft
  'stat.time': 'TIME',

  // ---- Battle screen labels ----
  'battle.query': '{@term.query}:',
  'battle.answerPlaceholder': 'type your answer',
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
  'mg.fuelMix': 'Fuel Mix', // draft. The Pilot's job (ship minigames plan step A)
  'mg.fuelMix.hint': 'Pour until the engine holds the answer.', // draft
  'mg.fuelMix.tank': '+{n}', // draft. A tank button
  'mg.fuelMix.count': 'Pours {pours}', // draft. No par shown: it gave the answer away (Timothy 2026-11-01)
  'mg.fuelMix.hidden': '???', // draft. The running total while the crew panics
  'mg.fuelMix.empty': 'EMPTY', // draft
  'mg.fuelMix.under': 'UNDER', // draft
  'mg.fuelMix.over': 'OVER. Venting.', // draft
  'mg.fuelMix.vented': 'VENTED. Empty again.', // draft
  'mg.fuelMix.match': 'FULL.', // draft
  'mg.fuelMix.dry': 'The engine runs dry.', // draft
  'mg.fuelMix.scored.X': '{name|upper}: filled at par.', // draft
  'mg.fuelMix.scored.2': '{name|upper}: filled. It was {answer}.', // draft
  'mg.fuelMix.scored.1': '{name|upper}: filled, slowly. It was {answer}.', // draft
  'mg.fuelMix.scored.miss': '{name|upper}: ran dry. It was {answer}.', // draft
  'mg.starChart': 'Star Chart', // draft. The Navigator's job (ship minigames plan step C)
  'mg.starChart.hint': 'Join the stars that spell the answer, in order. Drag, tap or type.', // draft
  'mg.starChart.sky': 'Star chart: type or tap the letters in order', // draft. For screen readers
  'mg.starChart.undo': 'Undo', // draft
  'mg.starChart.wrong': 'That star goes dark. Wrong: {n}', // draft
  'mg.starChart.scored.X': '{name|upper}: a clean course.', // draft
  'mg.starChart.scored.2': '{name|upper}: course plotted.', // draft
  'mg.starChart.scored.1': '{name|upper}: plotted, roughly. It was {answer}.', // draft
  'mg.starChart.scored.miss': '{name|upper}: lost among the stars. It was {answer}.', // draft
  'mg.hullPatch': 'Hull Patch', // draft. Life Support's job (ship minigames plan step D)
  'mg.hullPatch.hint': 'Patch the hole: tap or type a letter plate.', // draft
  'mg.hullPatch.strain': 'Strain', // draft
  'mg.hullPatch.tray': 'Letter plates: type a letter or tap a plate', // draft. For screen readers
  'mg.hullPatch.fits': 'It holds.', // draft
  'mg.hullPatch.off': '{letter} falls off: not in the word. The hull strains.', // draft
  'mg.hullPatch.scored.X': '{name|upper}: sealed without a strain.', // draft
  'mg.hullPatch.scored.2': '{name|upper}: sealed.', // draft
  'mg.hullPatch.scored.1': '{name|upper}: sealed, barely. It was {answer}.', // draft
  'mg.hullPatch.scored.miss': '{name|upper}: the hull breached. It was {answer}.', // draft
  'mg.inference': 'Inference', // draft. The Science job (ship minigames plan step E)
  'mg.inference.hint': 'Each symbol is a number. Work them out from the sums, then answer.', // draft
  'mg.inference.term': 'WORK IT OUT: {fact|upper}.', // draft. Stands in for a question: the fact asked for
  'mg.inference.answer': 'Your answer: {fact}', // draft
  'mg.inference.check': 'Check', // draft
  'mg.inference.fill': 'Fill in every box first.', // draft
  'mg.inference.whole': 'Each symbol is a whole number, 1 or more.', // draft
  'mg.inference.off': 'The marked lines don\'t add up with your numbers. Checks left: {left}', // draft
  'mg.inference.scored.X': '{name|upper}: worked out first time.', // draft
  'mg.inference.scored.2': '{name|upper}: worked out.', // draft
  'mg.inference.scored.1': '{name|upper}: worked out in the end. It was {answer}.', // draft
  'mg.inference.scored.miss': '{name|upper}: the numbers never added up. It was {answer}.', // draft
  'mg.patchBay': 'Patch Bay', // draft. The Signals officer's job (facts list plan step E)
  'mg.patchBay.term': 'PATCH THE LINES: {words|upper}.', // draft. Stands in for a question: the predicate on the board
  'mg.patchBay.hint': 'Tap a plug on the left, then its match on the right. Tap again to move a cable.', // draft
  'mg.patchBay.pair': '{left} \u2192 {right}', // draft. One pair, in the answer shown after a miss
  'mg.patchBay.check': 'Check', // draft
  'mg.patchBay.fill': 'Cable every plug on the left first.', // draft
  'mg.patchBay.off': 'Wrong cables dropped. Checks left: {left}', // draft
  'mg.patchBay.wrong': '{left} \u2192 {right}: no. {nudge}', // draft. One dropped cable and its nudge
  'mg.patchBay.fact': '{label}: {value}.', // draft. A nudge from a fact with a label ("Boaz\'s wife: Ruth.")
  'mg.patchBay.plain': '{subject} {words} {object}.', // draft. A nudge from a fact with no label
  'mg.patchBay.higher': '{left} goes higher than {n}.', // draft
  'mg.patchBay.lower': '{left} goes lower than {n}.', // draft
  'mg.patchBay.noFact': 'No other fact about {left} here.', // draft
  'mg.patchBay.plugLeft': '{text}, plug {id}', // draft. For screen readers
  'mg.patchBay.plugRight': '{text}, cabled to {id}', // draft. For screen readers
  'mg.patchBay.scored.X': '{name|upper}: every line clear first time.', // draft
  'mg.patchBay.scored.2': '{name|upper}: lines patched.', // draft
  'mg.patchBay.scored.1': '{name|upper}: patched in the end. It was {answer}.', // draft
  'mg.patchBay.scored.miss': '{name|upper}: the lines stayed crossed. It was {answer}.', // draft
  'mg.asteroids': 'Asteroids', // draft. The Gunner's job (ship minigames plan step F)
  'mg.asteroids.hint': 'Aim at the rock with the answer, then fire.', // draft
  'mg.asteroids.sky': 'Asteroid field: arrow keys aim, Space fires', // draft. For screen readers
  'mg.asteroids.left': '< Left', // draft
  'mg.asteroids.right': 'Right >', // draft
  'mg.asteroids.fire': 'Fire', // draft
  'mg.asteroids.shots': 'Shots left: {n}', // draft
  'mg.asteroids.miss': 'Missed everything. That shot was free: aim again.', // draft
  'mg.asteroids.wrong': '{text} answers: "{asks}"', // draft. A wrong rock says what it is the answer to
  'mg.asteroids.scored.X': '{name|upper}: one clean shot.', // draft
  'mg.asteroids.scored.2': '{name|upper}: hit.', // draft
  'mg.asteroids.scored.1': '{name|upper}: hit, at last. It was {answer}.', // draft
  'mg.asteroids.scored.miss': '{name|upper}: out of shots. It was {answer}.', // draft
  'mg.match': 'Final challenge', // draft. The Match boss (ship minigames plan step G3)
  'mg.match.scored.X': 'The crew pulled together.', // draft
  'mg.match.scored.miss': 'The board slipped away.', // draft
  'match.who': '{role} · {kind}', // draft. A charge meter: the crew member and the kind of tile that charges them
  'match.crew': 'Crew', // draft. A meter with no crew member behind it
  'match.ability.0': 'Clear a row', // draft. The 1st crew member's ability: clear the crisis in a row
  'match.ability.1': 'Hold it back', // draft. The 2nd's: the crisis skips its next spread
  'match.ability.2': 'Show kinds', // draft. The 3rd's: every tile's kind shows for 2 turns
  'match.meta': 'Crisis {crisis}/{lose} · spreads in {spread}', // draft
  'match.skipped': 'held back', // draft
  'match.arm': 'Tap a tile in the row to clear.', // draft
  'match.used.0': 'The crisis in that row is gone.', // draft
  'match.used.1': 'The crisis will hold back its next spread.', // draft
  'match.used.2': 'Every tile shows its kind for 2 turns.', // draft
  'match.lost': 'The crisis has taken too much of the ship.', // draft
  'match.time': 'Out of time.', // draft
  'match.phase': 'Phase {n}/{of} · {name}', // draft. The boss's phase (boss plan step A)
  'match.phase.0': 'Sort', // draft. Phase 1: the kind colours are on
  'match.phase.1': 'Dark', // draft. Phase 2: the colours are off, words only
  'match.phase.2': 'Call', // draft. Phase 3: a set question; line up its answer (boss plan step B)
  'match.beat.2': 'The comms come alive. The crew calls out questions now: find each answer on the board and clear it in a line.', // draft. Between phase 2 and 3
  'match.call.q': 'Question {n}/{of}: {question}', // draft. Phase 3: the question asked
  'match.call.kind': 'Hint: the answer is one of the {kind} words.', // draft. Hint ladder step 1: its kind
  'match.call.row': 'Hint: the answer is one of the {kind} words, in row {row} from the top.', // draft. Hint ladder step 2: its row (step 3 adds its column glowing)
  'match.beat.1': 'The lights fail. The colours are gone: from now on you sort by the words alone.', // draft. Between phase 1 and 2
  'match.beat.go': 'GO ON', // draft. The button that starts the next phase
  'match.retry': 'The crisis broke through, but the crew pulls it back. One more try at this phase. The clock keeps running.', // draft. The first loss: the one retry
  'match.retry.go': 'TRY AGAIN', // draft
  // The crew chat over the boss (boss plan step C): at most one line a move.
  'boss.chat.who': '{role}:', // draft. Who says a chat line
  'boss.chat.phase.0': 'The breach is open. Line up three of a kind: each kind charges one of us. A line next to the red clears it.', // draft. Sort starts
  'boss.chat.phase.1': 'The lights are gone. Read the words: you know which kind each one is.', // draft. Dark starts
  'boss.chat.phase.2': 'A call is coming in. Find its answer on the board and swap it into a line.', // draft. Call starts
  'boss.chat.retry': 'We pulled it back. A fresh start on this phase, and there is no second one.', // draft. The one retry used
  'boss.chat.answer': 'That is the one: {word}. {note}', // draft. A line through Call's answer; {note} the set's note, or nothing
  'boss.chat.spread': 'The red spreads after your next move.', // draft. One move before the crisis grows
  'boss.chat.hint.call.1': 'That answer is one of my {kind}.', // draft. Call hint ladder step 1
  'boss.chat.hint.call.2': 'That answer is one of my {kind}, in row {row} from the top.', // draft. Step 2
  'boss.chat.hint.call.3': 'I have lit its column for you.', // draft. Step 3: its column glows
  'boss.chat.hint.dark.1': 'One swap makes a line of my {kind}.', // draft. Dark hint ladder step 1 (after swaps with no line)
  'boss.chat.hint.dark.2': 'One of my {kind} in row {row} from the top can move into a line.', // draft. Step 2
  'boss.chat.hint.dark.3': 'I have lit its column for you.', // draft. Step 3: its column glows
  'boss.chat.miss': 'No line. {word} is one of my {kind}. {note}', // draft. The light nudge: never the answer
  'boss.chat.note': 'Note: {note}', // draft. A set's note on a word, after a nudge or an answer
  'boss.chat.wrong': 'Right shelf, wrong word. {note}', // draft. Call: a line of the answer's kind without the answer
  'boss.chat.freed': 'Crisis cleared: {n}. Lines that touch the red take it with them.', // draft
  'boss.chat.chain': 'Chain x{n}! {gains}.', // draft. Falling tiles lined up again
  'boss.chat.charged': 'I am charged. {ability} when you need it.', // draft. A meter just filled
  'boss.chat.cheer': 'A line! {gains}.', // draft
  'mg.scanner': 'Scanner', // draft. The Sensors' job (ship minigames plan step B)
  'mg.scanner.hint': 'Tap the fog to scan a patch. Answer when you know.', // draft
  'mg.scanner.patch': 'Scan patch {n}', // draft. A fog patch's label for screen readers
  'mg.scanner.count': 'Scans: {n}', // draft
  'mg.scanner.wrong': 'Not {opt}. Scan somewhere new.', // draft
  'mg.scanner.scored.X': '{name|upper}: knew it at a glance.', // draft
  'mg.scanner.scored.2': '{name|upper}: found it.', // draft
  'mg.scanner.scored.1': '{name|upper}: found it, slowly. It was {answer}.', // draft
  'mg.scanner.scored.miss': '{name|upper}: lost the signal. It was {answer}.', // draft
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
  'mg.crosswire.hintBlank': 'Two answers cross. Fill in the shared letter too.', // draft. A level up: the shared letter isn't given
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
  'log.modifier': 'MODIFIER: {name|upper}.',
  'log.wager': 'WAGER: {n} {@term.gold}.',

  'room.wait': ['You hold still. The hum continues.', 'You wait. Something recalibrates.'], // draft
  'room.walkStickTap': 'Hold still to look up.', // draft. A tap on the round stick: what it does
  'dpad.walkStick': 'Move stick: drag to walk, push a little to creep, hold still to look up', // draft. The round stick's label (one stick plan step B)
  'room.sneak.on': 'You crouch low and creep.', // draft. X switched sneaking on (one stick plan step B)
  'room.sneak.off': 'You stand and walk.', // draft. X switched it off
  'room.cover': 'In cover. Keep low.', // draft (Timothy 2026-10-26). Crouched beside something solid: quieter, and unseen from its far side
  'room.turn': 'You turn.', // draft. Free look: turning the body to look further round costs a turn
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
  'furniture.chicken': 'A chicken. Nobody knows how it got on board.', // draft; sample sprite piece (room sprites plan step B)
  'furniture.other': 'Something stands in the way.', // draft; a sprite-only piece with no line of its own
  'room.blocked.pillar': ['A pillar. Cold, and older than you.', 'Stone. It does not think.'], // draft

  // The charger (charger.js): energy to full through CHARGE.SYS, in the start room.
  'room.charger.kept': 'Your wires are as you left them.', // draft. Opened on half-done wires
  'room.charger.left': 'You step back from the {thing}.', // draft. LEAVE or Escape: {thing} is the charger's or a ship station's term (main.js)
  'charger.title': 'CHARGE.SYS', // draft
  'charger.hint': 'Turn the wires so power reaches the cell.', // draft
  'charger.charged': 'Charged. Energy full.', // draft
  'charger.clock': 'THE CLOCK RUNS', // draft. Real time: the clock is the cost
  'charger.pwr': 'PWR▸', // draft
  'charger.cell': '◂CELL', // draft
  'charger.wire': 'Wire {row}, {col}', // draft. A wire button's label
  'charger.powered': 'powered', // draft. Added to a wire's label while power runs through it
  'charger.leave': 'LEAVE', // draft
  // The ship's stations (ship plan step B, stations.js): the training
  // console, the Engineer's power board, and the Engineer.
  'station.title': 'POWER.SYS', // draft. The wire panel's title at a ship station
  'station.sub.train': 'TRAINING · MISSES ARE FREE', // draft. At the training console
  'station.sub.teach': 'TEACHING THE ENGINEER', // draft. At the power board
  'station.hint.train': 'Turn wires so power reaches the cell. Tap a breaker to answer it.', // draft
  'station.hint.teach': 'Tell the Engineer which wires to turn. Answer each breaker.', // draft
  'station.done.train': 'Power through. You know how this works now.', // draft. The training wires joined up
  'station.done.teach': 'Power through. The Engineer has it.', // draft. The Engineer's wires joined up (no burns: step G1)
  'station.breaker': 'Breaker {row}, {col}: answer to close it', // draft. An open breaker button's label
  'station.breakerClosed': 'Breaker {row}, {col}, closed', // draft. A closed breaker button's label
  'station.opened.train': 'The training console wakes. The captain’s lessons are still on it.', // draft
  'station.opened.teach': 'You stand beside the Engineer at the power board.', // draft
  'station.locked': 'You don’t know this job yet. Learn it at the training console in Command.', // draft. Power board before training
  'station.breaker.closed': 'The breaker closes.', // draft
  'station.breaker.free': 'The breaker stays open. In training, that costs nothing.', // draft. Wrong answer at the console
  'station.breaker.failed': 'The breaker sparks. The Engineer flinches.', // draft. Wrong answer while teaching: a crew failure
  'station.trained.engineer': 'You can teach this now. The Engineer is in the Engine room.', // draft
  'station.taught': 'The {role} has it now.', // draft. The Engineer taught at the board (step G1)
  'crew.engineer.waiting': 'Engineer: “The captain always ran the board. I don’t know how.”', // draft. Bumping the Engineer before training
  'crew.engineer.ready': 'Engineer: “Tell me what to do.”', // draft. Bumping the Engineer once trained
  // The ship's run (ship plan step C, ship.js).
  'ship.panicRose': 'The crew is {level} now.', // draft. {level} is a panic.N line, lower case
  'ship.panicEased': 'Three clean calls. The crew steadies: {level}.', // draft
  'ship.panicShielded': 'It went wrong, but the crew holds steady.', // draft. A shield took the panic (Comms officer, Life support)
  // The crew roles (crew roles plan, roles.js; config.js SHIP_ROLES). Names are drafts.
  'role.engineer': 'Engineer', // draft. The power board's wires (stations.js)
  'role.navigator': 'Navigator', // draft. Star Chart
  'role.pilot': 'Pilot', // draft. Fuel Mix
  'role.comms': 'Comms officer', // draft. Slow Spell
  'role.medic': 'Medic', // draft. Syllable Split
  'role.cook': 'Cook', // draft. Letter Pool
  'role.systems': 'Systems tech', // draft. Code Break
  'role.science': 'Science officer', // draft. Inference
  'role.gunner': 'Gunner', // draft. Asteroids (ship minigames plan step F)
  'role.signals': 'Signals officer', // draft. Patch Bay (facts list plan step E)
  'role.quartermaster': 'Quartermaster', // draft. Crosswire
  'role.sensors': 'Sensor operator', // draft. Fog Reveal
  'role.lifeSupport': 'Life support', // draft. Sum Lock
  'crew.waiting': '{role}: “The captain always did this. I don’t know how.” Learn it in Command first.', // draft. A role not learned yet
  'crew.sitsOut': '{role}: “Not needed this trip.”', // draft. A role whose game can't run on this set
  'crew.taught': '{role}: “I’ve got it from here.”', // draft. A role already taught this run
  'crew.notCrew': '{role}: “You’ve picked your crew for this trip. I’ll stay out of the way.”', // draft. Not one of the player's 3 (step G2)
  'job.started': 'You walk the {role} through it.', // draft. A job's first round
  'job.right': 'Round {round} of {of}: right.', // draft
  'job.missed': 'Round {round} of {of}: wrong. The crew saw that.', // draft. A crew failure
  'job.badly': 'It went badly. The {role} will manage, but it won’t help much.', // draft. Fewer than SHIP_JOB.passAt right
  'job.helped.shield': 'The {role} keeps everyone talking. The next mistake won’t shake them.', // draft
  'job.helped.panicDown': 'The {role} settles the crew a little.', // draft
  'job.helped.calm': 'The {role} keeps everyone fed. The crew steadies faster.', // draft
  // The tragedy (ship.js rollTragedy): random, told after the splash
  // screen, flavor only. Numbered lists, as many as TRAGEDY_PARTS says.
  'tragedy.title': 'THERE’S BEEN A TRAGEDY', // draft. No name typed on the start screen
  'tragedy.title.named': '{name|upper}, THERE’S BEEN A TRAGEDY', // draft. Timothy 2026-11-02: the start screen's name leads
  'tragedy.day': 'Day {day} of the crossing.', // draft
  'tragedy.died': '{captain} died {cause}.', // draft
  'tragedy.alone': 'No one else aboard was trained to command.', // draft
  'tragedy.mission': 'The {ship} must still reach {planet}. The crew is waiting for orders.', // draft
  'tragedy.how': 'Learn each job at the console in Command. Then go and teach it.', // draft
  'tragedy.go': 'TAKE COMMAND', // draft. The intro's button
  'tragedy.captain.1': 'Captain Okafor', // draft
  'tragedy.captain.2': 'Captain Lindqvist', // draft
  'tragedy.captain.3': 'Captain Reyes', // draft
  'tragedy.captain.4': 'Captain Halvorsen', // draft
  'tragedy.captain.5': 'Captain Mbeki', // draft
  'tragedy.captain.6': 'Captain Tanaka', // draft
  'tragedy.cause.1': 'when a coolant line burst in the forward bay', // draft
  'tragedy.cause.2': 'of a fever the med bay could not name', // draft
  'tragedy.cause.3': 'sealing a hull breach by hand', // draft
  'tragedy.cause.4': 'in a fall when the gravity failed for nine seconds', // draft
  'tragedy.cause.5': 'in their sleep, and no one knows why', // draft
  'tragedy.ship.1': 'Corvid', // draft
  'tragedy.ship.2': 'Long Patience', // draft
  'tragedy.ship.3': 'Small Hours', // draft
  'tragedy.ship.4': 'Meridian', // draft
  'tragedy.ship.5': 'Kestrel', // draft
  'tragedy.planet.1': 'Thale', // draft
  'tragedy.planet.2': 'Orrin b', // draft
  'tragedy.planet.3': 'Vesta Minor', // draft
  'tragedy.planet.4': 'Kesh', // draft
  'tragedy.planet.5': 'Halcyon', // draft
  // The ship's end screens (main.js endShip).
  'end.ship.arrived.title': 'Orbit.', // draft
  'end.ship.arrived.stats': 'The {ship} reached {planet}. The crew you taught brought it in. Failures: {failures}.', // draft
  'end.ship.panic.title': 'The crew broke.', // draft
  'end.ship.boss.title': 'The crisis took the ship.', // draft. The final boss lost (step G3)
  'end.ship.boss.stats': 'So close. The crew you taught could not hold it together in time. Failures: {failures}.', // draft
  'end.ship.panic.stats': 'Too many failures. No one is listening to orders now. Failures: {failures}.', // draft
  'end.ship.crew': 'Crew you taught ({taught}/{of}): {names}.', // draft. After the stats, crew roles plan step C
  'end.ship.noCrew': 'You taught no one else.', // draft. No crew role was taught this run
  // Credits on both end screens (1.0 checklist D; Jeremy Blake's licence asks for his credit).
  'credits.title': 'CREDITS',
  'credits.music': 'Music: Jeremy Blake — Recovery Mission (Helios’s Dreams), Nightscape and Exoplanet (Circular Reality), Novum (Infinity Zero)',
  'credits.font': 'Font: VT323 by Peter Hull (SIL Open Font License 1.1)',
  'credits.space': 'Space view: a port of PixelSpace by Deep-Fold (MIT)',
  'credits.moves': 'Moves: Universal Animation Library by Quaternius (CC0)',
  'credits.icons': 'Zodiac symbols: from the 1-bit Pixel Icons pack',

  // ---- Intro, start and end screens ----
  'start.enter': 'Begin', // Timothy 2026-11-01 (was "Enter the LABYRINTH")
  'start.name.label': 'Your name', // draft
  'start.name.placeholder': 'Leave blank to stay nameless', // draft
  'start.dpadRight': 'Swap sides: arrows on the right, buttons on the left', // draft. For a player who moves with the other hand

  // ---- Set screen (after Enter: which questions this run asks) ----
  'pick.title': 'QUERY.SET', // draft
  'pick.prompt': 'What will you learn?', // Timothy 2026-11-01 (was "What will the LABYRINTH ask you?")
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
  'practice.level': 'Level', // draft. Then the level's settings, which can be changed
  'practice.levelName': 'Level {n}', // draft. n: 1 = the game as it starts
  'practice.copy': 'Copy', // draft. Copies the preset line for config.js
  'practice.copied': 'Copied. Paste it to Claude to make it the preset.', // draft
  'practice.copyFailed': 'Could not copy. Select the line above instead.', // draft
  'practice.reset': 'Reset', // draft. Back to the level's preset
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
  'workshop.loadedFacts': 'Loaded {count} items ({made} made from facts). Pick "Workshop list" on the set screen to play it.', // draft
  'workshop.tooFew': 'Need at least 2 questions. Add questions, or facts with a template that asks about them.', // draft
  'workshop.skipped': '{count} rows skipped.', // draft
  'workshop.warned': '{count} warnings.', // draft
  'workshop.moreProblems': 'and {count} more', // draft
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
  'data.filterNote': 'HAS A NOTE {count}',
  'data.hasNote': 'NOTE',
  'data.filterGenerated': 'GENERATED {count}',
  'data.generated': 'GENERATED',
  'data.openList': 'OPEN LIST',
  'data.accepted': 'ALSO RIGHT: {answers}',
  'data.fact': 'FACT: {fact}',
  'data.note': 'Note: {note}',
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
  'end.win.again': 'Think again', // draft
  'end.lose.title': 'The thought sleeps.',
  'end.lose.retry': 'Wake', // draft

  // The gun's panels over the map (gunpanels.js).
  'map.btn': 'MAP', // draft. The minimap button (M on a keyboard): opens the record book at MAP
  'ask.title.breaker': 'BREAKER', // draft. The ask screen's title for a ship station's breaker question (ship plan step B)
  'ask.title.job': '{role} · {round}/{of}', // draft. The ask screen's title for a round of a crew member's job (crew roles plan)
  'ask.title.learn': 'LEARNING {role} · {round}/{of}', // draft. The ask screen's title for a learning round at the console (crew roles plan step B)
  'ask.title.boss': 'FINAL CHALLENGE', // draft. The Match boss (ship minigames plan step G3)
  'boss.q': 'The crisis is spreading. Line up what belongs together, and get your crew ready.', // draft. The boss's stand-in question
  'boss.ready': 'Your crew is ready. One last thing stands in the way.', // draft. The 3rd crew member taught: the boss comes
  // COMMAND.SYS, the console's roles (crew roles plan step B, consoleview.js).
  'console.title': 'COMMAND.SYS', // draft
  'console.hint': 'The captain’s lessons. Pick 3 crew to learn and teach this trip.', // draft (step G2)
  'console.wires': 'Power wires', // draft. The Engineer's game, in the list
  'console.status.new': 'LEARN', // draft. A role still to learn
  'console.status.learned': 'LEARNED', // draft
  'console.status.taught': 'TAUGHT', // draft
  'console.status.sitsOut': 'NOT NEEDED', // draft. Its game can't run on this set
  'console.status.full': 'CREW FULL', // draft. Not picked, and 3 are already (step G2)
  'console.opened': 'The training console wakes.', // draft
  'console.left': 'You step back from the console.', // draft. LEAVE or Escape on COMMAND.SYS
  'learn.started': 'The captain’s lesson for the {role}. Mistakes are free here.', // draft
  'learn.back': 'BACK', // draft. On a learning round: drop this lesson and pick another on COMMAND.SYS
  'learn.stopped': 'You step back to pick another lesson.', // draft. After BACK on a learning round
  'learn.missed': 'Not that. Round {round} of {of}: look at the answer and try again.', // draft. A learning miss: free
  'learn.done': 'You’ve got it. Go and teach the {role}: the MAP shows where.', // draft. A right learning round
  'learn.shaky': 'You know enough to try. Go and teach the {role}: the MAP shows where.', // draft. Learned after the last round, without a right one
  'book.paused': 'CLOCK PAUSED', // draft. The record book's top strip, right: nothing moves while it is open
  'book.right': 'RIGHT.', // draft. Written beside a right pick on the book's page
  'book.written': '→ {answer}', // draft. Written beside a struck wrong pick: the right answer
  'book.close': 'Tap the page or press a key to close.', // draft. Foot of the book's page once an answer is in
  'book.running': 'CLOCK RUNNING', // draft. The record book's top strip, right, opened from the map for LOG or MAP: the world goes on
  'book.tab.ask': 'ASK', // draft. The book's tab for the question (only while one is open)
  'book.tab.log': 'LOG', // draft. The book's tab for the whole room log
  'book.tab.map': 'MAP', // draft. The book's tab for the minimap
  'book.title.log': 'LOG', // draft. The book's top strip, left, on the LOG page
  'book.title.map': 'MAP', // draft. The book's top strip, left, on the MAP page
  'book.log.head': 'Newest first.', // draft. Top of the LOG page
  'book.log.empty': 'Nothing yet.', // draft. The LOG page before any note
  'book.map.dashed': 'Dashed rooms: not been in yet.', // draft. Foot of the MAP page on a fixed plan
  'book.map.teach': 'Rings: crew you can teach now.', // draft. Foot of the MAP page on the ship, once a role is learned and not yet taught
  'book.read.close': 'Tap the page or press Esc to close.', // draft. Foot of the book's page opened from the map
  'log.btn': 'LOG', // draft. The room log button (L on a keyboard): opens the record book at LOG
  'hud.more': 'Status: tap for more', // draft. The HUD's tooltip: a tap shows myelin, cycle and the goals' names
  'map.label': 'Map of what you have seen on this floor. Tap to close.', // draft. Read out by screen readers
  // Fixed floor plans (plans.js): each floor's name, then its rooms' names.
  // A room's name shows the first time the player walks in (room.enter.named)
  // and on the minimap. Depth 1 is Timothy's pick; depths 2 and 3 are drafts.
  'room.enter.named': '{name}.', // draft. The log line on first walking into a room on a fixed plan
  'room.enter.plan': '{floor}. {name}.', // draft. On arriving on a fixed plan: the building's name, then the room you wake in
  'plan.school.examHall': 'Exam hall', // draft
  'plan.school.frontHall': 'Front hall', // draft
  'plan.school.lab': 'Lab', // draft
  'plan.school.library': 'Library', // draft
  'plan.school.artRoom': 'Art room', // draft
  'plan.school.class1': 'Class 1', // draft
  'plan.school.class2': 'Class 2', // draft
  'plan.school.toilets': 'Toilets', // draft
  'plan.school.staffRoom': 'Staff room', // draft
  'plan.ship': 'THE SHIP', // draft. The ship (ship plan): its name on the minimap
  'plan.ship.command': 'Command', // draft. The center room: you start, learn and research here
  'plan.ship.airlock': 'Airlock', // draft
  'plan.ship.medBay': 'Med bay', // draft
  'plan.ship.bridge': 'Bridge', // draft
  'plan.ship.hydroponics': 'Hydroponics', // draft
  'plan.ship.engineRoom': 'Engine room', // draft
  'plan.ship.quarters': 'Crew quarters', // draft
  'plan.ship.washroom': 'Washroom', // draft
  'plan.ship.galley': 'Galley', // draft
};

const warnedKeys = new Set();

function warnOnce(message) {
  if (warnedKeys.has(message)) return;
  warnedKeys.add(message);
  console.warn('text.js: ' + message);
}

// Whether text.js has wording for `key`: a furniture piece named only in
// sprites/sprites.json may have no bump line of its own (main.js then uses
// furniture.other).
export function hasText(key) {
  return TEXT[key] !== undefined;
}

// The wording for `key`, with {placeholders} filled from `vars` and
// {@other.key} references filled from this file. A missing key comes back
// as the key itself (and warns once), so a typo shows up on screen instead
// of silently blanking the line.
export function t(key, vars = {}, depth = 0) {
  const entry = TEXT[key];
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
// updated too.
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
