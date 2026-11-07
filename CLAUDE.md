# Noesis Protocol (repo: DungeonCrawler)

Static PWA quiz game, "There's Been a Tragedy" (a spaceship whose crew the player teaches),
plain ES modules, no build step, no dependencies.
Hosted on GitHub Pages from `main`. Run locally: `python3 -m http.server 8000`.

## Rules every change must follow

- **The ship is the game** (Timothy 2026-11-01). The start screen always starts the ship; there is
  no other way in. The old dungeon crawl is deleted (dungeon removal plan, steps A–E2,
  `ideas/dungeon-removal-plan.md` outside the repo; its old plans are in `ideas/reference/dungeon/`).
  The old PRs keep its code. Don't bring dungeon features back from them; a new idea is checked
  against `ideas/endgame.md` first.
- `main` is protected: branch + PR, one PR per logical change.
- Changed a file listed in `service-worker.js` `APP_SHELL`? Bump `CACHE_NAME` in the same commit.
- New JS file? Add it to `APP_SHELL` too; a deleted one comes out of it.
- All player-facing wording lives in `js/text.js` (`t(key, vars)`). Never write wording inline.
- Tunables live in `js/config.js`. Game state lives in `js/state.js`.
- "Still broken right after a fix" is usually a stale service worker: test in Incognito first.
- Test with the DEV tools: open the game as `index.html?dev` (hidden without it) and tap the DEV tag in the
  bottom-left corner: Auto-win, Learn all roles, Boss now, Panic (one step up), Book paper, Minigame
  (roll / off / force one), Inspect (live state + last 20 events) and the map's draw time.
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
- One source of truth per question: `whatBlocks()` decides blocking, `renderShipHud()` is the only
  writer of the ship's HUD. Reuse these. Don't make a second copy.

Comments:
- Every file starts with a `//` header: what the file is for, who calls it, and
  "No DOM access here." for rule files.
- Every function has a comment above it that says what it does and why, in plain
  sentences. Rule functions list the events they can return.
- Comments explain design reasons ("Misses don't feed the light: they already cost a heart").
  Don't narrate the code line by line, and don't leave commented-out code.
- Plain words, short sentences, no jargon the game doesn't use (player, ship, room, crew, role,
  station, breaker, panic, boss).

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
| `grid.js` | The `FOUR_STEPS` step table and `stepsFrom()`, the one step-count walk over the floor. |
| `random.js` | `shuffle(list)`. |
| `text.js` | All wording: `t()` and the `data-t` labels. |
| `plans.js` | `FLOOR_PLANS.ship`: the ship's rooms, furniture and stations; `buildPlanLayout()`. |
| `floor.js` | `buildShipFloor()`: the ship as data. |
| `decor.js` | The plan's furniture (`placeFurniture`) on rules that keep every tile reachable (`makePlacer`). |
| `passage.js` | `whatBlocks()` (can I step here?) and `solidProp()`. |
| `sight.js` | What the player sees (`computeVisibility`: all of the ship), `canMakeOut`, cover. |
| `look.js` | The light's angle: body facing, `lookAngle`, `aimLook`, `swingLook`. |
| `modifiers.js` | The Gambler's most (`maxWager`), `blindReadMs()`, Flip's roll. |
| `minigames.js` | Minigame rules: which fit a question, rolls, tiers (Close Enough … Sum Lock, Patch Bay). |
| `moves.js` | What a walk finds: `enterTile` (a new tile: the safe room, a new room) and `bumpInto`. |
| `walk.js` | Free walking with One stick: `walkFree()`, sneak and creep. |
| `windows.js` | Windows on outside walls and their pools of light. |
| `saferoom.js` | The safe room (Command): its automatic shutters and lamp. |
| `stations.js` | The ship's stations: training console, a crew member's board, the crew member; breakers that close on a right answer. |
| `ship.js` | The ship's run: crew panic and its effects, the tragedy roll, arrive / lose. |
| `roles.js` | The ship's crew roles, one per minigame: who sits out, learning, a 3-round job, the benefit a taught role gives the run, how each crew member looks. |
| `quiz.js` | Picking questions, building options, fight choice labels, answer types. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets. |
| `factgen.js` | Questions made from a set's facts and templates (`generateQuestions`). |

Drawing and page code:

| File | Job |
|---|---|
| `main.js` | Everything else: wiring, `drawEvents()`, the world's clock and turn outcome, room log, end screens (~640 lines). |
| `controls.js` | The player's controls: taps aim the light, the walk stick and keys, `walkFrame`. |
| `gunactions.js` | The ship's questions on the ask screen: breakers, crew jobs, learning, the final boss, dressing a question, Auto-win. |
| `render.js` | Screens, the ship's HUD (`renderShipHud()`), edge glow, the answer line. |
| `mapview.js` | The map canvas, its afterglow, animations and taps; `requestMapDraw()`, `mapThings()`. |
| `roomview.js` | The room view, the only map view: camera, walls and floors, light map, the player (~800 lines). |
| `roomthings.js` | The room view's furniture, stations, crew and shutters as pixel art (`STAND`); a piece's PNG when it has one. |
| `rooms.js` | The ship's furniture from `rooms/ship.json` (`loadShipRooms`), plans.js as fallback. |
| `sprites.js` | Furniture PNGs named in `sprites/sprites.json` (`loadSprites`, `spriteFor`); code art as fallback. |
| `roomgun.js` | The player's book on the room view, shut under his arm. |
| `roomsky.js` | Windows and their light, and the eye in the sky (`lookUp`). |
| `mapshared.js` | `isWall` and `grain`, shared by the room view's files. |
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
| `dpad.js` | The walk stick (`initWalkStick`, `stickGestures`) and `SCREEN_WAYS`. |
| `devpanel.js` | The DEV panel (`?dev`) and the Inspect view. |

## How the game moves

- **One stick (always):** controls.js `walkFrame()` runs every animation frame: input →
  walk.js `walkFree()` → moves.js `enterTile()` / `bumpInto()` → events →
  main.js `applyTurnOutcome(events)`. Then `worldFrame()` redraws the ship's HUD.
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
