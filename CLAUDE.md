# Noesis Protocol (repo: DungeonCrawler)

Static PWA quiz / dungeon-crawler, plain ES modules, no build step, no dependencies.
Hosted on GitHub Pages from `main`. Run locally: `python3 -m http.server 8000`.

## Rules every change must follow

- **The ship is the game** (Timothy 2026-11-01). The start screen always starts the ship; there is
  no other way in. The old dungeon crawl is being deleted in layers (dungeon removal plan,
  `ideas/dungeon-removal-plan.md` outside the repo; step B removed its floors, tutorial and extras,
  step C combat and the charger, step D the light, fog, battery, lamps and the other plans). What
  is left (the turn-based look and the One stick setting, leftover state and config keys) goes in
  step E: don't build on it.
- `main` is protected: branch + PR, one PR per logical change.
- Changed a file listed in `service-worker.js` `APP_SHELL`? Bump `CACHE_NAME` in the same commit.
- New JS file? Add it to `APP_SHELL` too; a deleted one comes out of it.
- All player-facing wording lives in `js/text.js` (`t(key, vars)`). Never write wording inline.
- Tunables live in `js/config.js`. Game state lives in `js/state.js`.
- "Still broken right after a fix" is usually a stale service worker: test in Incognito first.
- Test with the DEV tools: open the game as `index.html?dev` (hidden without it) and tap the DEV tag in the
  bottom-left corner: Fog off, Skip room, Auto-win, Inspect (live state + last 20 events).
- Automated tests: `node --test tests/*.test.mjs` (rule unit tests, no dependencies) and
  `node tests/smoke.mjs` (Playwright, see its header; 4 runs at once by default, `SMOKE_JOBS=1` one at a time;
  `SMOKE_ONLY=ship SMOKE_REPEAT=20` runs only those runs, that many times each, to chase one that
  fails now and then). In smoke checks wait for a condition (`waitUntil`), never a fixed sleep or
  `waitForFunction` with an async check (it never waits).

## Code style (keep new code like the cleaned-up modules)

Model files: `moves.js`, `passage.js`, `floor.js`, `state.js`. Read one before
writing a new module or a big function.

Layers:
- **Rules** (change state, decide what happened) have no DOM access. They change `state` and
  **return an events list** in the order things happened: `[{ type: 'coinTaken', gold }, ...]`.
  Event types are camelCase past tense, and each event carries only the data a view needs.
- **Views** draw from state + events. `main.js` `drawEvents()` is the one place that turns an
  event into DOM changes and wording. New event → new `case` there, not a DOM call in a rule.
- Page modules (`devpanel.js`, `setloader.js`, `setpicker.js`) look up their own elements at the top and get
  the `main.js` actions they call **passed in** (`initDevPanel({ advanceRoom, ... })`). They
  don't import from `main.js`.
- State goes in the right group in `state.js` (`settings` / `run` / `floor` / `battle`), with a
  trailing comment saying what it holds. Never put DOM elements or timers in new state.
- One source of truth per question: `whatBlocks()` decides blocking, `goldReward()` decides gold,
  `renderHud()` is the only writer of hearts / gold / turns. Reuse these. Don't make a second copy.

Comments:
- Every file starts with a `//` header: what the file is for, who calls it, and
  "No DOM access here." for rule files.
- Every function has a comment above it that says what it does and why, in plain
  sentences. Rule functions list the events they can return.
- Comments explain design reasons ("Misses don't feed the light: they already cost a heart").
  Don't narrate the code line by line, and don't leave commented-out code.
- Plain words, short sentences, no jargon the game doesn't use (player, floor, room, minion,
  boss, light, haunt).

Code:
- Plain ES modules, 2-space indent, semicolons, single quotes, `const` (or `let` if it changes),
  `===`. No classes, no build step, no dependencies.
- Named `export function`. Helpers only one module uses are not exported.
- Early returns instead of nested `if`s. Short guard `if`s go on one line.
- Arrow functions for callbacks (`props.find(p => p.kind === 'box')`).
- Tile positions are `{ row, col }` objects. Tile sets and maps are keyed by `key(r, c)`.
- No magic numbers: tunables go in `config.js` as `UPPER_SNAKE` with a comment.
  No inline wording: use `t('key')` from `text.js`.
- Move code with shell commands, unchanged. Don't rewrite it while moving it.

Tests and commits:
- A new or changed rule gets a check in `tests/*.test.mjs` (Node's built-in runner). Set up the
  floor with `tests/helpers.mjs` `emptyFloor(size, { settings, run, floor })` (also `twoRooms`,
  `withRandom`), not a new copy of the setup. Run `node --test tests/*.test.mjs` before a PR.
  A change that could alter gameplay also gets `node tests/smoke.mjs`.
- Commit subject: short and imperative ("Move floor setup out of main.js into floor.js",
  "Fix: <symptom>"). The body says what changed and why, and ends with the
  `CACHE_NAME vN -> vN+1` bump when there is one.

## Module map

One line per file. The long form (functions, events, config names, which plan each came from)
is `docs/module-map.md`: read the rows for the files a change touches, not the whole thing.
Each file's own header comment says the rest. A new file gets a line here and a row there.

Rules and data (no page/DOM access):

| File | Job |
|---|---|
| `config.js` | Tunable constants and sample data. Never changes at runtime. |
| `state.js` | The one shared `state` (`settings` / `run` / `floor` / `battle`), `key(r, c)` and `parseKey(k)`. |
| `grid.js` | `FOUR_STEPS` / `EIGHT_STEPS` step tables and `stepsFrom()`, the one step-count walk over the floor. |
| `random.js` | `shuffle(list)` and `randInt(lo, hi)`. |
| `text.js` | All wording: `t()`, per-floor overrides, `data-t` labels. |
| `plans.js` | `FLOOR_PLANS`: fixed buildings per depth (School, Archive, Observatory), furniture, lamps; `buildPlanLayout()`. |
| `floor.js` | `buildShipFloor()`: the ship as data. |
| `decor.js` | Room themes, pillars, papers, boxes, energy cells, fixed-plan furniture (`makePlacer`). |
| `passage.js` | `whatBlocks()` (can I step here?), `canPassCorner()`, `stepsAway()`. |
| `sight.js` | The player's light (`computeVisibility`), the look cone, `canMakeOut`, `shootBlock`, cover. |
| `look.js` | Free look: body facing vs. aim, `aimLook`, `turnBody`, `sweepLook`, `swingLook`. |
| `modifiers.js` | The Gambler's most (`maxWager`), `blindReadMs()`, Flip's roll. |
| `minigames.js` | Minigame rules: which fit a question, rolls, tiers (Close Enough … Sum Lock). |
| `moves.js` | The player's step (`stepPlayer`), `bumpInto`, `enterTile`, `goldReward`. |
| `walk.js` | Free walking with One stick: `walkFree()`, sneak and creep. |
| `walkpace.js` | Smooth walk: every way takes the same time per screen distance. |
| `windows.js` | Windows on outside walls and their pools of light. |
| `desk.js` | The reflective desk in the start room: heals to full once a floor. |
| `saferoom.js` | The safe room: shutters, switch, lamp; who waits outside. |
| `stations.js` | The ship's stations: training console, a crew member's board, the crew member; breakers that close on a right answer. |
| `ship.js` | The ship's run: arrival clock, crew panic and its effects, training period, burn window, the tragedy roll, arrive / lose. |
| `roles.js` | The ship's crew roles, one per minigame: who sits out, learning, a 3-round job, the benefit a taught role gives the run, how each crew member looks. |
| `quiz.js` | Picking questions, building options, fight choice labels, answer types. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets. |

Drawing and page code:

| File | Job |
|---|---|
| `main.js` | Everything else: wiring, `drawEvents()`, the world's clock and turn outcome, room log, end screens (~830 lines). |
| `controls.js` | The player's controls: taps, aiming, the sticks and keys, `walkFrame` and `movePlayer`. |
| `gunactions.js` | The ship's questions on the ask screen: breakers, crew jobs, learning, the final boss, dressing a question, Auto-win. |
| `render.js` | Screens, the HUD (`renderHud()` only writer of hearts / gold / turns), edge glow, d-pad hints. |
| `mapview.js` | The map canvas, its animations and taps; `requestMapDraw()`, `glyphOf()`, `mapThings()`. |
| `roomview.js` | The room view, the only map view: camera, walls and floors, light map, the player (~800 lines). |
| `roomthings.js` | The room view's things on the floor and the furniture as pixel art (`FLAT` / `STAND`). |
| `roomgun.js` | The player's book on the room view, shut under his arm. |
| `roomsky.js` | Windows and their light, and the eye in the sky (`lookUp`). |
| `mapshared.js` | Sizes and view-independent helpers the map view uses (`floorLevelOf`, `isWall`, `grain` …). |
| `playerform.js` | The player's stick man: breath, ember head, glances. |
| `figure3d.js` | Picks and blends the 3D moves into poses for the player and the crew. |
| `moves3d.js` | Generated 3D move data (Quaternius, CC0). Don't edit by hand. |
| `questionview.js` | The one question panel, its modifiers, mounted where it's needed (`parkQuestionPanel`, `matchesAnswer`). |
| `minigameview.js` | Draws each minigame in the question panel. |
| `gunpanels.js` | The ask screen, the book held after an answer, `mapPanelShown()`. |
| `chargerview.js` | CHARGE.SYS, a ship station's wires panel. |
| `bookview.js` | The record book: ASK / LOG / MAP tabs, held answers. |
| `pageturn.js` | The record book's page turn. |
| `minimapview.js` | The minimap on the book's MAP page. |
| `shipview.js` | The ship's opening: the run's tragedy a line at a time, then TAKE COMMAND. |
| `consoleview.js` | COMMAND.SYS, the ship's training console: the roles to learn and where each stands. |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `setloader.js` | Start screen options and the workshop. |
| `setpicker.js` | The set screen; `fetchSet()` shared with practice.js. |
| `practice.js` | Hidden minigame practice screen. |
| `dpad.js` | The on-screen pad, the walk stick and look stick, `padWay()`. |
| `devpanel.js` | The DEV panel (`?dev`) and the Inspect view. |

## How the game moves

- **One stick (always):** controls.js `walkFrame()` runs every animation frame: input →
  walk.js `walkFree()` → moves.js `enterTile()` / `bumpInto()` → events →
  main.js `applyTurnOutcome(events)`. Then `worldFrame()` redraws the ship's HUD.
- **Turns:** no start option reaches it any more (dungeon removal step B); controls.js
  `movePlayer()` → `stepPlayer()` is still the DEV One stick OFF path, and goes in step E.
- **Questions:** a breaker, a crew member's job, a lesson or the final boss → gunactions.js
  (`openBreaker`, `openJob`, `openLearning`, `openBoss`) → the ask screen (gunpanels.js) →
  stations.js / roles.js settle the answer. Combat (the gun, the dial, stick men, the battle
  screen) went in dungeon removal step C.
- The clock pauses for the ask screen, the DEV panel, end screens and a hidden tab; it keeps
  running under CHARGE.SYS, COMMAND.SYS and the book.

The full walk-through of each flow is at the end of `docs/module-map.md`.

## History

`docs/refactor-plan.md` is the finished state → rules → events → views refactor (steps 1–7b,
all merged): why the layers are as they are.
