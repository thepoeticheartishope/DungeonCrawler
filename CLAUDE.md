# Noesis Protocol (repo: DungeonCrawler)

Static PWA quiz / dungeon-crawler, plain ES modules, no build step, no dependencies.
Hosted on GitHub Pages from `main`. Run locally: `python3 -m http.server 8000`.

## Rules every change must follow

- `main` is protected: branch + PR, one PR per logical change.
- Changed a file listed in `service-worker.js` `APP_SHELL`? Bump `CACHE_NAME` in the same commit.
- Added a core mechanic (a new way to move, see, fight, answer or get out)? Give the tutorial room
  (`tutorial.js`) a beat for it: the tutorial shows the game's central mechanics (Timothy).
  New JS file? Add it to `APP_SHELL` too.
- All player-facing wording lives in `js/text.js` (`t(key, vars)`). Never write wording inline.
- Tunables live in `js/config.js`. Game state lives in `js/state.js`.
- "Still broken right after a fix" is usually a stale service worker: test in Incognito first.
- Test with the DEV tools: open the game as `index.html?dev` (hidden without it) and tap the DEV tag in the
  bottom-left corner: Fog off, Skip room, Auto-win, Inspect (live state + last 20 events).
- Automated tests: `node --test tests/*.test.mjs` (rule unit tests, no dependencies) and
  `node tests/smoke.mjs` (Playwright, see its header; 4 runs at once by default, `SMOKE_JOBS=1` one at a time;
  `SMOKE_ONLY=tutorial,answer SMOKE_REPEAT=20` runs only those runs, that many times each, to chase one that
  fails now and then). In smoke checks wait for a condition (`waitUntil`), never a fixed sleep or
  `waitForFunction` with an async check (it never waits).

## Code style (keep new code like the cleaned-up modules)

Model files: `moves.js`, `answers.js`, `passage.js`, `floor.js`, `state.js`. Read one before
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
  floor with `tests/helpers.mjs` `emptyFloor(size, { settings, run, floor })` (also `gunRun`,
  `twoRooms`, `minionAt`, `withRandom`), not a new copy of the setup. Run `node --test tests/*.test.mjs` before a PR.
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
| `rooms.js` | Hand-drawn room templates for random floors. |
| `dungeon.js` | Random floor layouts from the templates; `buildRestLayout()`. |
| `plans.js` | `FLOOR_PLANS`: fixed buildings per depth (School, Archive, Observatory), furniture, lamps; `buildPlanLayout()`. |
| `floors.js` | `FLOOR_RECIPES` (what each floor holds) and `FLOOR_PATHS` (the ways down). Data only. |
| `floor.js` | `buildFloor()` / `buildRestFloor()` / `buildTutorialFloor()`: a floor as data. |
| `decor.js` | Room themes, pillars, papers, boxes, energy cells, fixed-plan furniture (`makePlacer`). |
| `beats.js` | `placeBeats()`: the recipe's beats along the walk to the farthest key. |
| `run.js` | `nextFloor()`: the run's shape, rests between depths. |
| `tutorial.js` | The tutorial room and its stages; the kind voice's lines for each core mechanic. |
| `passage.js` | `whatBlocks()` (can I step here?), `canPassCorner()`, `stepsAway()`. |
| `sight.js` | The player's light (`computeVisibility`), the look cone, `canMakeOut`, `shootBlock`, cover. |
| `look.js` | Free look: body facing vs. aim, `aimLook`, `turnBody`, `sweepLook`, `swingLook`. |
| `light.js` | The boss's light spreading over the floor; the run is lost at the threshold. |
| `battery.js` | The player's light on a battery: switching, drain, lock-out. |
| `gaze.js` | The eye over a stick man the light rests on; at full it steps closer. |
| `haunts.js` | Missed questions that come back later in the run. |
| `exchange.js` | THE UNFOLDING: `offers()` and `buy(id)` on rest floors. |
| `modifiers.js` | Blind / Gambler / Flip / Timer rolls; `blindReadMs()`. |
| `minigames.js` | Minigame rules: which fit a question, rolls, tiers (Close Enough … Sum Lock). |
| `combat.js` | Stick men and the hunter: moving, chasing, last-seen tracking, reaching; `advanceMonsters()`, `clockFrame()`. |
| `gun.js` | The gun: targets, reloads, firing, the dial, the Struggle, steady aim, energy and rounds. |
| `realclock.js` | The real-time clock: `pollClock()` says when the world's beat is due. |
| `moves.js` | The player's step (`stepPlayer`), `bumpInto`, `enterTile`, `goldReward`. |
| `walk.js` | Free walking with One stick: `walkFree()`, sneak and creep. |
| `walkpace.js` | Smooth walk: every way takes the same time per screen distance. |
| `goals.js` | Floor goals: roll, mark, score on the way down. |
| `relays.js` | Relays: hold a room, turn the light back; `keptOut()`. |
| `vents.js` | Grates and ducts the stick men crawl through. |
| `noise.js` | Mistakes make noise; stick men in range hear it. |
| `windows.js` | Windows on outside walls and their pools of light. |
| `lamps.js` | Fixed-plan lamps and their pools (seen from afar, not shootable by). |
| `spots.js` | Room spots: each plan room's places that may hold a hide, takedown, lure or scout, rolled each run (`rollSpots`); hiding in a live hide spot (`hideIn`, `leaveHiding`, `state.floor.hidden`). |
| `shadows.js` | Stick men's shadows thrown away from lamps and windows. |
| `warning.js` | DEV warning timer: how long before a reach the player had a sign. |
| `static.js` | `staticLevel()`: 0..1 from the closest stick man. |
| `desk.js` | The reflective desk in the start room: heals to full once a floor. |
| `saferoom.js` | The safe room: shutters, switch, lamp; who waits outside. |
| `charger.js` | The charger (CHARGE.SYS wires): energy and battery to full. |
| `gate.js` | The locked core's gate: questions by keys held, sealing, `breakGate()`. |
| `answers.js` | `settleAnswer()`: hearts, haunts, wager, boss damage, gold. |
| `quiz.js` | Picking questions, building options, fight choice labels, answer types. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets. |

Drawing and page code:

| File | Job |
|---|---|
| `main.js` | Everything else: wiring, `drawEvents()`, the world's clock and turn outcome, room log, end screens (~1,260 lines). |
| `controls.js` | The player's controls: taps, aiming, the sticks and keys, SELECT's hold, `walkFrame` and `movePlayer`. |
| `battlescreen.js` | The battle screen: encounter log, category choices, a turn of questions, settling answers. |
| `gunactions.js` | The gun's actions: SELECT / fire, steady aim, the dial, reloads, relays, dressing a question. |
| `render.js` | Screens, the HUD (`renderHud()` only writer of hearts / gold / turns), edge glow, d-pad hints. |
| `mapview.js` | The map canvas, its animations and taps; `requestMapDraw()`, `glyphOf()`, `mapThings()`. |
| `roomview.js` | The room view, the only map view: camera, walls and floors, light map, stick men, shadows (~1,000 lines). |
| `roomthings.js` | The room view's things on the floor and the furniture as pixel art (`FLAT` / `STAND`). |
| `roomgun.js` | The gun on the room view, drawn as a book: held book, reach, brackets, steady mark, laser, shot, answer ring. |
| `roomsky.js` | Windows and their light, and the eye in the sky (`lookUp`). |
| `mapshared.js` | Sizes and view-independent helpers the map view uses (`floorLevelOf`, `minionOn`, `isWall`, `grain`, `ENEMY_KINDS`, `POSE_SCALE`, last shot …). |
| `stickforms.js` | Minions as stick men: poses, tells, tendrils of letters, downed and dying. |
| `playerform.js` | The player's stick man: breath, ember head, glances. |
| `figure3d.js` | Picks and blends the 3D moves into poses for the player and stick men. |
| `moves3d.js` | Generated 3D move data (Quaternius, CC0). Don't edit by hand. |
| `staticview.js` | Draws the static veil and the wrong letters. |
| `swirl.js` | The answer ring after a miss with Reveal on. |
| `introview.js` | The terminal intro before the first floor. |
| `questionview.js` | The one question panel, its modifiers, mounted where it's needed. |
| `minigameview.js` | Draws each minigame in the question panel. |
| `gunpanels.js` | The ask screen (reloads, relays), the dial veil, `mapPanelShown()`. |
| `dialview.js` | Draws and runs the dial's marker. |
| `chargerview.js` | CHARGE.SYS, the charger's panel. |
| `bookview.js` | The record book: ASK / LOG / MAP tabs, held answers. |
| `pageturn.js` | The record book's page turn. |
| `tubeart.js` | The light tube as pixel art (book strip and LIGHT button). |
| `minimapview.js` | The minimap on the book's MAP page. |
| `exchangeview.js` | THE UNFOLDING's screen. |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `setloader.js` | Start screen options and the workshop. |
| `setpicker.js` | The set screen; `fetchSet()` shared with practice.js. |
| `practice.js` | Hidden minigame practice screen. |
| `dpad.js` | The on-screen pad, the walk stick and look stick, `padWay()`. |
| `devpanel.js` | The DEV panel (`?dev`) and the Inspect view. |

## How the game moves

- **One stick (the default):** controls.js `walkFrame()` runs every animation frame: input →
  walk.js `walkFree()` → moves.js `enterTile()` / `bumpInto()` → events →
  main.js `applyTurnOutcome(events)`. Then `worldFrame()` → combat.js `clockFrame(dt)` (battery, each
  stick man on its own clock). Every `REALTIME_STEP_MS` the beat (`clockTick`) runs what still
  counts in turns: the boss's light, the hunter, the ducts.
- **Turns (start screen option):** controls.js `movePlayer()` → `stepPlayer()` → events →
  `applyTurnOutcome(events)` → `advanceMonsters()` → `drawEvents()`.
- **Fights:** SELECT → gunactions.js `pressSelect()` → `fireGun()` → `fire()` → dial or steady aim →
  `settleShot()`. Energy cells and relays ask on the ask screen; the boss and the chest use the
  battle screen → `settleAnswer()`.
- The clock pauses for the ask screen, a dial, the Struggle, the battle screen, THE UNFOLDING,
  the DEV panel, end screens and a hidden tab; it keeps running under CHARGE.SYS and the book.

The full walk-through of each flow is at the end of `docs/module-map.md`.

## History

`docs/refactor-plan.md` is the finished state → rules → events → views refactor (steps 1–7b,
all merged): why the layers are as they are.
