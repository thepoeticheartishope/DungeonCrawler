# Noesis Protocol (repo: DungeonCrawler)

Static PWA quiz / dungeon-crawler, plain ES modules, no build step, no dependencies.
Hosted on GitHub Pages from `main`. Run locally: `python3 -m http.server 8000`.

## Rules every change must follow

- `main` is protected: branch + PR, one PR per logical change.
- Changed a file listed in `service-worker.js` `APP_SHELL`? Bump `CACHE_NAME` in the same commit.
  New JS file? Add it to `APP_SHELL` too.
- All player-facing wording lives in `js/text.js` (`t(key, vars)`). Never write wording inline.
- Tunables live in `js/config.js`. Game state lives in `js/state.js`.
- "Still broken right after a fix" is usually a stale service worker: test in Incognito first.
- Test with the DEV button (status bar): Fog off, Skip room, Auto-win, Inspect (live state + last 20 events).
- Automated tests: `node --test tests/*.test.mjs` (rule unit tests, no dependencies) and
  `node tests/smoke.mjs` (Playwright, see its header).

## Code style (keep new code like the cleaned-up modules)

Model files: `moves.js`, `answers.js`, `passage.js`, `floor.js`, `state.js`. Read one before
writing a new module or a big function.

Layers:
- **Rules** (change state, decide what happened) have no DOM access. They change `state` and
  **return an events list** in the order things happened: `[{ type: 'coinTaken', gold }, ...]`.
  Event types are camelCase past tense, and each event carries only the data a view needs.
- **Views** draw from state + events. `main.js` `drawEvents()` is the one place that turns an
  event into DOM changes and wording. New event → new `case` there, not a DOM call in a rule.
- Page modules (`devpanel.js`, `setloader.js`) look up their own elements at the top and get
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
- A new or changed rule gets a check in `tests/*.test.mjs` (Node's built-in runner, set up
  the floor with `resetFloor()`). Run `node --test tests/*.test.mjs` before a PR.
  A change that could alter gameplay also gets `node tests/smoke.mjs`.
- Commit subject: short and imperative ("Move floor setup out of main.js into floor.js",
  "Fix: <symptom>"). The body says what changed and why, and ends with the
  `CACHE_NAME vN -> vN+1` bump when there is one.

## Module map

Rules and data (no page/DOM access):

| File | Job |
|---|---|
| `config.js` | Tunable constants and sample data. Never changes at runtime. |
| `state.js` | The one shared `state` object, plus `key(r, c)`. Grouped by lifetime: `state.settings` (start screen / DEV panel), `state.run` (one run), `state.floor` (rebuilt each floor), `state.battle` (the current fight). |
| `text.js` | All wording. `t()`, per-floor overrides, `data-t` labels. |
| `rooms.js` | Hand-drawn room templates (`#` wall, `.` floor, `?` prop, `+` inner door). |
| `dungeon.js` | Builds a floor layout from the templates: rooms, hallways, boss room, stairs. |
| `decor.js` | Themes rooms and places pillars, papers, boxes (`makePlacer`). |
| `floors.js` | `FLOOR_RECIPES`: what each floor holds (grid, rooms, loops, minions, light loss share, start/boss rooms, the floor's story lines); `floorRecipe(i)` reads it. Data only, grows with the level-design plan. |
| `floor.js` | `buildFloor()`: a new floor as data — layout, furniture, boss, stairs, coin, the one special item (chest / rune / encounter), minions, then light, sight and camera. |
| `passage.js` | `whatBlocks(row, col)`: the single answer to "can I step here?". |
| `sight.js` | The player's light (`computeVisibility`: `visibleSet` / `sightSet` / `exploredSet`), `canMakeOut`, and the camera (`updateCamera`). |
| `light.js` | Boss light spreading through the floor; the run is lost at the coverage threshold. |
| `haunts.js` | Missed questions that come back later in the run. |
| `modifiers.js` | Rolls Blind / Gambler / Flip / Timer for fight choices. |
| `combat.js` | Minion/hunter movement and turn advance. `advanceMonsters()` returns an events list; `main.js` `drawEvents()` draws it. |
| `moves.js` | The player's step (`stepPlayer()`: turn, bump, walk, stairs, coin, paper (the next story line from `state.run.loreQueue`), room entry, boxes) and `goldReward`. Returns an events list. |
| `answers.js` | Settling an answer (`settleAnswer()`: hearts, haunts, the Gambler wager, boss HP and the darkness, clearing or spending the target, gold and the rune's hint). Returns an events list. |
| `quiz.js` | Picking questions, building multiple-choice options, fight choice labels. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets (localStorage). |

Drawing and page code:

| File | Job |
|---|---|
| `render.js` | Draws the grid, fog, actors, HUD (`renderHud()` is the only writer of hearts / gold / turns). Reads visibility and the camera from `sight.js`. |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `setloader.js` | Start screen options and the set loader (pasted, file, built-in, saved sets). |
| `devpanel.js` | DEV panel: Skip room, Auto-win, Fog toggle, and the Inspect view (live state + a view-only ring of the last 20 events, fed by `drawEvents`). Gets the `main.js` actions it calls passed in. |
| `main.js` | Everything else: element lookups, battle screen, floor setup (`loadRoom` = `buildFloor()` from floor.js + `drawFloor` page), `drawEvents()` (draws every rule event), turn and answer flow, end screens. 1,090 lines — being split up. |

How a turn flows today: key/d-pad → `movePlayer()` (main.js) → `stepPlayer()` (moves.js,
uses `whatBlocks()`) → events → `applyTurnOutcome(events)` → `advanceMonsters()` (combat.js) →
`drawEvents()` (draws both lists, returns the room note) + `lightConsumed()` →
battle screen if something is adjacent → answer → `applyAnswerResult()` (main.js) →
`settleAnswer()` (answers.js) → events → `drawEvents()` (the encounter log) → next boss
question, end of run, or `endEncounter()`.

## Refactor in progress

See `docs/refactor-plan.md` for the target structure, the step list and its status.
Read only the files a step names; don't re-survey the whole codebase.
