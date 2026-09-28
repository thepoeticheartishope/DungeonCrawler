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

### 4. Take DOM elements out of state (biggest step, split in three)

Views keep their own `Map` from thing → element. Remove `el` from minions, props, chest,
rune, encounters; move `tileEls` and `timerHandle` out of `state`. `combat.js` stops
calling `positionActor` / `setGlyph` and reports moves instead.

Split into 4a–4c so each is one PR and a safe place to stop: after each one the game
works and both test commands pass. Line numbers are as of `main` at `64bb2bf` (PR #65).
Done check for the whole step: `grep -n "\.el\b\|tileEls\|timerHandle" js/state.js js/combat.js`
finds nothing, and no rule module stores a page element.

#### [ ] 4a. Grid tiles and the timer leave `state` (small)

- `tileEls`: make it a module-level variable in `render.js` (`buildGridTiles`,
  `renderWalls`, `renderFog` ~41–89 are its only users). Remove it from `state.js`.
- `timerHandle`: `render.js` `startTimer()` (~309–312) keeps the handle itself; add
  `stopTimer()` there and replace the three `clearInterval(state.timerHandle)` in
  `main.js` (~881, ~1044, ~1242). Remove it from `state.js`.
- Bump `CACHE_NAME`. Done when: smoke test passes; the run timer still counts and stops
  on the win/lose screen.

#### [ ] 4b. Things that stay put: chest, rune, encounters, props

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

#### [ ] 4c. Things that move: minions and the hunter (needs the stronger model)

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

### [ ] 5. Split `loadRoom()`

`buildFloor()` (data only: layout, furniture, boss, stairs, coin, special item, minions)
and `drawFloor()` (creates and places elements).

### [ ] 6. Rules return events

`movePlayer`, `applyAnswerResult`, `resolveBossAnswer`, `resolveOneShot`, `advanceMonsters`
change state and return an events list; views read the list and draw/log from it.

### [ ] 7. Group state + live inspector

Group `state` into `run` / `floor` / `battle` / `settings`. Add a DEV-panel inspector
showing live state and the last events.

After 7: canvas map (only the map view changes) and a backend for saves (store `state`).

## Keeping each step cheap

- Fresh session per step. Start by reading `CLAUDE.md` and this file, then only the
  files and line ranges the step names.
- Mechanical moves (1a, 1b, 2, 4a, 4b, 5): a cheaper model is fine (`/model` → Sonnet or Haiku).
  Steps 4c and 6 benefit from a stronger one.
- Move code with shell commands, not by rewriting it.
- When a step merges, tick it here with the PR number in the same PR.
