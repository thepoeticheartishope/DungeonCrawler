# Refactor plan: state → rules → events → views

Goal: make the game easy to understand from the code, and ready for a canvas map and
saved progress (a backend) later. **No step changes gameplay.** Each step is one PR.

Line numbers below are as of `main` at `56fd75a` (PR #59). They drift; search for the
function names if they don't match.

## Why (what the analysis found)

Most modules are already clean (see the module map in `CLAUDE.md`). The problems are:

1. **`main.js` does five jobs** in 1,506 lines, and holds ~105 of ~140 state writes.
   `loadRoom()` alone is 163 lines (generation + DOM creation + placement + UI reset).
2. **Rules and drawing are mixed** in the same function. `movePlayer()` interleaves the
   move with five redraw calls. Gold changes in three places in `resolveOneShot()` and
   each updates `coinsTotalEl` by hand.
3. **DOM elements live inside game state.** Minions, props, chest, rune and encounters
   carry `el`; `state` also holds `tileEls` and `timerHandle`. State can't be saved as JSON,
   and a canvas renderer would have to touch every one of them.
4. **Rules in the wrong file.** `computeVisibility()` and `updateCamera()` are in
   `render.js` and write state; `combat.js` moves DOM elements.
5. **One flat `state` object** (~60 fields) mixing run, floor, battle, UI and settings data,
   written from six files.
6. **No JavaScript tests**, so a refactor has no safety net.

## Target structure

```
input (keys, d-pad, buttons)  →  rules  →  state (plain data, saveable)
                                   ↓
                              events list  →  views (map, battle, HUD, screens)
```

- **state**: plain data only, grouped as `run`, `floor`, `battle`, `settings`. No DOM.
- **rules**: change state and return events (`{ type: 'goldGained', amount: 2 }`,
  `minionCleared`, `bossDefeated`, `lightSpread`, ...). No DOM.
- **views**: the only code that touches the page. Draw from state + events.
- **main.js**: ~100 lines of wiring.

## Steps

Status: `[ ]` not started · `[~]` in progress · `[x]` merged (add the PR number).

### [x] 0a. Smoke test (Playwright) (#61)

Two runs, both loading Bible Quiz Bowl with Auto-win on, in `tests/smoke.mjs`
(`node tests/smoke.mjs`): a skip-room run (walk one step, then "Skip room (dev)"
until the win/lose screen) and a battle run (arrow-key wander + "Skip turn" until
a minion engages, then let Auto-win settle the fight — pass is an `ACCEPTED.` log
line and back on `#roomScreen`). No console errors or page errors in either.
- Playwright is available from `~/Repo/codecraft-classroom/node_modules`; don't add
  `node_modules` to this repo. One-line run command in the file's header comment.
- **Must** use `browser.newContext({ serviceWorkers: 'block' })`, or the service worker
  reloads the page mid-test.
- Load a set via `evaluate`: set `#builtinSetSelect`, click `#loadBuiltinBtn` (the loader
  panel is hidden). MC option text is in `.opt-text`.
- Read: `index.html` element IDs only (grep), the dev panel code in `main.js` (~1407–1447).
- If it fights back for more than a few tries, stop and ask Timothy to check by hand in
  Incognito instead.

### [x] 1a. Move the start screen and set loader out of `main.js` (#62)

New file `js/setloader.js`, `export function initSetLoader()`.
- Move `main.js` ~132–278: options storage (`OPTION_STORAGE_KEY`, `loadSavedOptions`,
  `saveOptions`), loader toggle, file/paste loading, `showSampleStatus`, built-in set
  select, `renderSavedSets`, save-set button, and the element lookups they use
  (~37–50: `revealToggle` … `savedSetsList`, `builtinSets`).
- It's self-contained: uses only `state`, `sets.js`, and `quiz.js`
  (`defaultSample`, `parseListInput`, `escapeHtml`).
- The one outside use: `startGame()` (~806) reads `revealToggle.checked`. Leave
  `revealToggle` looked up in `main.js` or export a getter; don't restructure `startGame`.
- Move code by line range with shell commands (`sed -n 'A,Bp'`), not by retyping it.
- Add `js/setloader.js` to `APP_SHELL`, bump `CACHE_NAME`.
- Done when: smoke test passes; loading built-in, pasted, file and saved sets still works.

### [x] 1b. Move the dev panel out of `main.js` (#63)

New file `js/devpanel.js`, `export function initDevPanel(actions)`.
- Move `main.js` ~1407–1447: dev toggle, Skip room, Auto-win (`AUTO_WIN_STEP_MS`,
  `autoWinStep`), Fog toggle, and their element lookups (~59–63).
- It calls five `main.js` functions: `advanceRoom`, `chooseCategory`, `placeWager`,
  `attemptAnswerMC`, `leaveEncounter`. Pass them in as `actions`; don't move them.
  It also reads `battleScreen`, `wagerRow` (pass them in) and uses `renderFog`.
- Add to `APP_SHELL`, bump `CACHE_NAME`. Done when: smoke test passes, all three dev
  buttons work.

### [x] 2. One HUD update (#64)

Add `renderHud()` (render.js) for gold, hearts and turn count; replace every scattered
`coinsTotalEl.textContent = ...` / `renderHearts()` / turn count write with it.

### [x] 3. Visibility and camera become rules (#65)

Move `computeVisibility()` and `updateCamera()` out of `render.js` into a rules module
(e.g. `js/sight.js`). `render.js` then only reads `visibleSet` / `sightSet` / camera.
Add unit tests for `sight.js`, `light.js`, `passage.js` here (first rule changes).
- Done: `js/sight.js` also holds `canMakeOut` and `FACING_VECTORS` (render.js imports
  both). Unit tests in `tests/rules.test.mjs`, run with `node --test tests/*.test.mjs`
  (built-in runner, no dependencies). Later steps: add tests there as rules move.

### [x] 4. Take DOM elements out of state (biggest step, split in three) (#67, #68, #69)

Views keep their own `Map` from thing → element. Remove `el` from minions, props, chest,
rune, encounters; move `tileEls` and `timerHandle` out of `state`. `combat.js` stops
calling `positionActor` / `setGlyph` and reports moves instead.

Split into 4a–4c so each is one PR and a safe place to stop: after each one the game
works and both test commands pass. Line numbers are as of `main` at `64bb2bf` (PR #65).
Done check for the whole step: `grep -n "\.el\b\|tileEls\|timerHandle" js/state.js js/combat.js`
finds nothing, and no rule module stores a page element.

#### [x] 4a. Grid tiles and the timer leave `state` (small) (#67)

- `tileEls`: make it a module-level variable in `render.js` (`buildGridTiles`,
  `renderWalls`, `renderFog` ~41–89 are its only users). Remove it from `state.js`.
- `timerHandle`: `render.js` `startTimer()` (~309–312) keeps the handle itself; add
  `stopTimer()` there and replace the three `clearInterval(state.timerHandle)` in
  `main.js` (~881, ~1044, ~1242). Remove it from `state.js`.
- Bump `CACHE_NAME`. Done when: smoke test passes; the run timer still counts and stops
  on the win/lose screen.
- Done: `tileEls` and `timerHandle` are module-level in `render.js`; `stopTimer()`
  is exported from there and `main.js` imports it.

#### [x] 4b. Things that stay put: chest, rune, encounters, props (#68)

- Add an element registry to `render.js`: a `Map` thing → element, with
  `addActorEl(thing, el)`, `actorEl(thing)`, `removeActorEl(thing)`, `clearActorEls()`.
- `loadRoom` (`main.js` ~687–802): register elements instead of setting `el:` on
  chest (~785), rune (~789), encounters (~796–802) and props (~721–724); clear the
  registry where it now calls `.el.remove()` (~687–694).
- Replace `x.el` with `actorEl(x)` in `render.js` `renderFog` (~129–146),
  `renderTargeting` (~289–290), `main.js` `repositionActors` (~551–552), the searched /
  gone / remove calls (~959, ~985, ~1105–1127) and the battle glyph (~496).
- Leave minions alone (4c). Bump `CACHE_NAME`. Done when: smoke test passes; by hand with
  Fog on, a box, a paper, the chest or rune and an encounter still show `?` far away,
  their glyph up close, and disappear or grey out when used.
- Done: the registry is `actorEls` in `render.js`. Chest and rune register their fixed
  `chestActor` / `runeActor`; `clearActorEls()` only forgets entries (loadRoom still
  removes encounter/prop elements first). `syncBattleScreen` reads
  `actorEl(target) || target.el || bossActor` until 4c moves minions over.

#### [x] 4c. Things that move: minions and the hunter (needs the stronger model) (#69)

- Minions use the 4b registry: `combat.js` spawn (~176–186) registers the element;
  `main.js` `repositionActors` (~546), `loadRoom` (~687), `renderFog` (~114–115) and
  `renderTargeting` (~286) read it with `actorEl(m)`.
- `combat.js` stops touching the page: `advanceMonsters()` (~239) returns what changed
  (e.g. `{ moved: [m, ...], spawned: [m], turnedHunter: m }`) instead of calling
  `positionActor` / `setGlyph` / `classList` (~153–186). The caller in `main.js` draws
  from that list. Drop `positionActor` and `setGlyph` from `combat.js`'s imports.
- This is the first "rules report, views draw" change; keep the returned shape simple,
  step 6 turns it into the events list.
- Add unit tests for `advanceMonsters` in `tests/rules.test.mjs` (chase within range,
  hunter wakes after `HUNTER_SPAWN_DELAY`), now that it runs without a page.
- Bump `CACHE_NAME`. Done when: both test commands pass; by hand, minions chase and
  slide, the hunter wakes after the boss and its glyph changes, Auto-win fights still
  settle. Tick 4 as a whole here.
- Done: `combat.js` imports nothing from `render.js` and makes no elements.
  `advanceMonsters()` returns `{ moved, spawned, engageNote, hunterNote }` (the hunter
  is in `spawned` with `kind: 'hunter'`, so no separate `turnedHunter`) and no longer
  redraws the HUD, fog, eye or targeting; `main.js` `drawMonsterTurn()` does all of that.
  `render.js` `addMinionEl(m)` makes, registers and places a minion or hunter element.
  `repelHunter()` returns whether it moved the hunter; `refreshTargetValidity()` no
  longer calls `renderTargeting()` (callers do). Four `advanceMonsters` tests added.

### [x] 5. Split `loadRoom()` (#70)

`buildFloor()` (data only: layout, furniture, boss, stairs, coin, special item, minions)
and `drawFloor()` (creates and places elements).
- Done: `loadRoom()` is now `clearActorEls()` → `buildFloor()` → `drawFloor()`.
  `buildFloor()` also runs the rules that follow from the floor (`updateCamera`,
  `initBossLight`, `computeVisibility`) and marks the start chamber visited;
  `placeMinions()` only calls `spawnMinion()`. `drawFloor()` makes one element per
  prop, encounter and minion from state and resets the room screen.
  `clearActorEls()` (render.js) now takes the old floor's minion, prop and encounter
  elements off the page itself (loadRoom used to do it by hand); chest and rune stay.

### [x] 6. Rules return events (split in three) (#72, #73, #74)

`movePlayer`, `applyAnswerResult`, `resolveBossAnswer`, `resolveOneShot`, `advanceMonsters`
change state and return an events list; views read the list and draw/log from it.

Split into 6a–6c so each is one PR and a safe place to stop: after each one the game
works and both test commands pass. Line numbers are as of `main` at `536eaa4` (PR #70).

Shared rules for all three:
- An event is a plain object: `{ type: 'goldGained', amount: 2 }`. Types are past-tense
  camelCase and say *what happened*, never how it looks.
- Rules push events in the order things happen; the view draws them in that order (the
  encounter log and room note depend on it).
- Rules never call `t()`. Wording is picked in the view from the event's type and data,
  so an event carries values (`gold`, `cost`, `category`), not finished text.
- One drawing entry point in `main.js`, `drawEvents(events)`, with one `case` per type.
  It grows a little in each sub-step. Screen flow (`advanceRoom`, `endEncounter`,
  `nextQuestion`, `startBattleTurn`, `setTimeout(endLose…)`) stays in the `main.js` caller,
  decided from the events.
- New rule modules import nothing from `render.js` or `main.js` and touch no element, so
  `tests/rules.test.mjs` can load them.
- Done check for the whole step: `grep -n "logLine\|render[A-Z]\|actorEl\|classList\|t('" `
  on `js/combat.js`, `js/moves.js` and `js/answers.js` finds nothing.

#### [x] 6a. The monster turn: set the event shape (small; stronger model) (#72)

- `combat.js` `advanceMonsters()` (~183–233) returns an events list instead of
  `{ moved, spawned, engageNote, hunterNote }`: `{ type: 'hunterWoke', hunter }`,
  `{ type: 'minionMoved', minion }`, `{ type: 'minionEngaged', minion }`. It stops calling
  `t('room.hunter.wakes')` / `t('room.engage')`; drop `t` from combat.js's imports if
  nothing else uses it.
- `main.js` `drawMonsterTurn()` (~907–915) becomes the first cases of `drawEvents()`: the
  hunter gets `addMinionEl`, moved minions slide, then the HUD / fog / eye / targeting
  redraw once at the end (not once per event).
- `applyTurnOutcome(actionMessage)` (~892–903) builds the room note from the events
  (hunter woke → `room.hunter.wakes`, engaged → `room.engage`, `warn-msg` if either).
  Callers still pass `actionMessage` as text for now; 6b replaces that.
- Update the four `advanceMonsters` tests in `tests/rules.test.mjs` (~277–330) to read
  events, and add one for `minionEngaged`.
- Bump `CACHE_NAME`. Done when: both test commands pass; by hand, minions chase and slide,
  an engage note shows, the hunter wakes after the boss with its note.
- Done: `advanceMonsters()` returns events in turn order: `{ type: 'hunterWoke', hunter }`
  (pushed before that turn's moves, so the hunter's first step follows it),
  `{ type: 'minionMoved', minion }` and `{ type: 'minionEngaged', minion }` (one per
  engaging minion). `combat.js` no longer imports `text.js`. `main.js` `drawEvents()`
  replaced `drawMonsterTurn()`; `applyTurnOutcome()` picks the note from the events
  (unchanged text). Five `advanceMonsters` tests (one new for `minionEngaged` and order).

#### [x] 6b. Moving, waiting and boxes (#73)

- New `js/moves.js`, `export function stepPlayer(dRow, dCol)` → events. It holds the rule
  half of `main.js` `movePlayer()` (~927–995): facing change, `whatBlocks`, the step,
  `updateCamera` / `computeVisibility`, stairs, coin, paper, first entry into a room.
  Events: `turned`, `blocked { kind, thing }`, `stepped`, `stairsReached`,
  `coinTaken { gold }`, `paperRead { paper, loot }`, `roomEntered { theme }`.
- Also move there the rule halves of `readPaper` (~998–1005), `examineProp` (~1010–1031)
  and `openBox` (~1034–1040): `propSearched { prop }`, `boxSprung { prop }`,
  `boxOpened { prop, gold }` (gold 0 = junk). `goldReward` (~1131) moves too; 6c uses it.
- `movePlayer` in `main.js` becomes wiring: the `turnLocked` / `runEnded` checks,
  `stepPlayer()`, `drawEvents()`, then `advanceRoom()` on `stairsReached`, the battle
  screen on `boxSprung`, else `applyTurnOutcome(events)`. `skipTurn` passes `[{ type: 'waited' }]`.
  `applyTurnOutcome` now takes events, not a message; the room note text comes from
  `drawEvents` (the `room.move` / `room.coin` / `room.paper.*` / `room.box.*` / theme
  `enter` keys, in event order).
- Drawing that moves into `drawEvents`: arrow glyph, `renderWalls` / `repositionActors` /
  `renderFog`, `bumpActor` + block note, coin `gone`, prop `searched`, `renderHud`.
- Add `js/moves.js` to `APP_SHELL`. Add unit tests for `stepPlayer`: blocked by a wall,
  coin pays `goldReward(1)` (doubled in the darkness), first room entry fires once.
- Bump `CACHE_NAME`. Done when: both test commands pass; by hand, walking, turning in place,
  bumping a wall, coin, paper, a plain box, a trapped box and the stairs all behave as before.
- Done: `stepPlayer()` also emits `stepped { facing }` (the view names the direction) and
  bumping an emptied box is `blocked { kind: 'prop', thing }`. `openBox()` is exported and
  returns the gold (0 for junk); `resolveOneShot` uses it. `drawEvents()` returns the room
  note `{ cls, text }`; `applyTurnOutcome(events)` appends `advanceMonsters()`'s events and
  draws both in one pass. `movePlayer(dRow, dCol)` lost its direction-name argument.
  Three `stepPlayer` tests added.

#### [x] 6c. Answers (biggest; stronger model) (#74)

- New `js/answers.js`, `export function settleAnswer(isCorrect, hadExtraSpace, given)` →
  events. It holds the rule halves of `main.js` `applyAnswerResult` (~1056–1095),
  `resolveBossAnswer` (~1101–1128), `resolveOneShot` (~1138–1201) and `settleWager`
  (~241–248; it's the fourth place gold changes).
- Events (one per current `logLine`, in the same order): `answerGiven { given }`,
  `accepted`, `extraSpaces`, `rejected { cost, expected, source }` (the reveal-on-wrong
  lines stay a view choice), `hauntSilenced`, `hauntLingers`, `wagerSettled { won, n }`,
  `signalLost`, `bossHit { hp, max }`, `bossHeld`, `bossDefeated`, `darknessFell`,
  `hunterRepelled { hunter, right }`, `minionCleared { minion, right }`,
  `targetSpent { target, right, category }`, `goldGained { amount, from }` (chest /
  encounter / box), `runeDecoded { choiceLabel, hint }`.
- `main.js` keeps `applyAnswerResult` as wiring: `settleAnswer()`, `drawEvents()`,
  `flashBattleResult`, then flow from the events: `signalLost` → end-of-run timers;
  a boss hit/held → `nextQuestion()` + `startBattleTurn()`; otherwise `endEncounter()`.
- Drawing that moves into `drawEvents`: every `logLine`, `renderHud`, `renderCombatStatus`,
  boss `gone`, minion element removed + `removeActorEl`, `searched` / `gone` classes,
  the repelled hunter's `positionActor`, the darkness redraw (fog, eye).
- Add `js/answers.js` to `APP_SHELL`. Add unit tests for `settleAnswer`: a miss costs 1
  (2 in the darkness) and ends at 0 hearts with `signalLost`; the last boss hit fires
  `bossDefeated` then `darknessFell`; a chest pays 2; a lost wager can't go below 0 gold.
- Bump `CACHE_NAME`. Done when: both test commands pass (the smoke battle run still logs
  `ACCEPTED.`); by hand, the encounter log reads word for word as before for a boss fight,
  a minion, the chest, the rune, an encounter, a trapped box, a wager and a haunt. Tick 6
  as a whole here.
- Done: the chest, rune, encounter and trapped box all emit `targetSpent` (the view adds
  `searched` for a box, `gone` for the rest, and logs `log.<kind>.trapped` on a miss), then
  `goldGained` or `runeDecoded` when right. `runeDecoded` carries `{ question }` instead of
  `{ choiceLabel, hint }`: `buildHint()` calls `t()`, so the view builds both.
  `bossDefeated` carries `{ boss }`. `settleWager` is private to answers.js.
  `applyAnswerResult` flows from `signalLost` / `bossHit` / `bossHeld`. Five `settleAnswer`
  tests added. Checked word for word with a seeded bot (`Math.random` seeded, pathfinding to
  every target, 5 in 6 answers right, reveal-on-wrong on; light loss, chase range and hearts
  patched the same on both) on a `git archive origin/main` copy and the branch: 25 seeds
  identical, log and room notes included. Every answer log line came up except a missed
  chest or rune (the same `log.<kind>.trapped` path as a missed encounter and box, which did).

### [x] 7. Group state + live inspector (split in two) (#76, #77)

Group `state` into `run` / `floor` / `battle` / `settings`. Add a DEV-panel inspector
showing live state and the last events. Line numbers are as of `main` at `6bbbfb6` (PR #75).

#### [x] 7a. Group state (mechanical; any model) (#76)

- Group by how long a value lives: `settings` (start screen / DEV panel: `revealOnWrong`,
  `mcMode`, `fogEnabled`, `usingSample`, `activeData`), `run` (reset in `startGame`:
  `order`, `roomIndex`, hearts, gold, turns, attempts, haunts, timer, `turnLocked`,
  `runEnded`), `floor` (reset in `buildFloor`: layout, player, camera, sight sets, boss,
  light, darkness, hunter, minions, items, props, rooms, `runeHint`, `lastChoiceType`),
  `battle` (the current fight: question, choices, target, phase, wager).
- Field names stay the same; only the path changes (`state.hearts` → `state.run.hearts`).
  Done with one Perl rename from a field → group list (`(?<![\w$])state\.(field)\b`),
  then `state.js` regrouped by hand with its comments kept.
- Bump `CACHE_NAME`. Done when: both test commands pass, `grep -rnoE "state\.[a-zA-Z_]+" js tests`
  finds only `state.run/floor/battle/settings` outside `state.js`, and the seeded bot
  matches `main`.
- Done: 581 references moved in 16 files; all 60 fields kept. Seeded bot (now reads
  `state.floor || state`, so it runs on either shape): 25 seeds identical to `main`, 0 errors.

#### [x] 7b. Live inspector (small) (#77)

- `drawEvents(events)` (main.js ~907) is the one place every rule event passes through:
  keep the last ~20 in a view-only ring (not in `state`) with the turn number.
- DEV panel (`devpanel.js`) gets an "Inspect" toggle that shows a `<pre>` with
  `state.run`, `state.battle`, `state.settings` (minus `activeData`, show its length),
  a short `state.floor` summary (player, boss, hunter, darkness, light turns, counts of
  minions / props / sets, not the Sets themselves) and the event ring, newest first.
  Redraw it after each `drawEvents()` while it's open; nothing when closed.
- `selectedTarget` / `battleTarget` point at floor objects: print `kind @ row,col`, not the
  object. The DEV panel's labels are plain text in `index.html` (~1244), not `text.js`
  keys; the inspector's button does the same (it's a testing tool, not player wording).
- Bump `CACHE_NAME`. Done when: both test commands pass; by hand, the panel follows a
  walk, a fight and a floor change. Tick 7 as a whole here.
- Done: the ring and inspector live in `devpanel.js` (`recordEvents` at the end of
  `drawEvents`, `refreshInspector` at the end of `loadRoom` so a floor change shows
  without a move). Floor objects print as `kind @ row,col` everywhere, including inside
  events; Sets/Maps print their size, `order` and choice `pool`s their question count.
  Checked in Playwright: empty while closed; follows a walk (turned/stepped/minionMoved
  per turn), a fight (`battlePhase`, `selectedTarget: minion @ r,c`, then
  accepted/minionCleared) and Skip room (grid 33 → 37, `roomIndex` 0 → 1); no page errors.

After 7: canvas map (only the map view changes) and a backend for saves (store `state`).

## Keeping each step cheap

- Fresh session per step. Start by reading `CLAUDE.md` and this file, then only the
  files and line ranges the step names.
- Mechanical moves (1a, 1b, 2, 4a, 4b, 5): a cheaper model is fine (`/model` → Sonnet or Haiku).
  Steps 4c, 6a and 6c benefit from a stronger one (6b is fine either way).
- Move code with shell commands, not by rewriting it.
- When a step merges, tick it here with the PR number in the same PR.
