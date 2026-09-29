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
- Test with the DEV button (status bar): Fog off, Skip room, Auto-win.
- Automated tests: `node --test tests/*.test.mjs` (rule unit tests, no dependencies) and
  `node tests/smoke.mjs` (Playwright, see its header).

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
| `passage.js` | `whatBlocks(row, col)`: the single answer to "can I step here?". |
| `sight.js` | The player's light (`computeVisibility`: `visibleSet` / `sightSet` / `exploredSet`), `canMakeOut`, and the camera (`updateCamera`). |
| `light.js` | Boss light spreading through the floor; the run is lost at the coverage threshold. |
| `haunts.js` | Missed questions that come back later in the run. |
| `modifiers.js` | Rolls Blind / Gambler / Flip / Timer for fight choices. |
| `combat.js` | Minion/hunter movement and turn advance. `advanceMonsters()` returns an events list; `main.js` `drawEvents()` draws it. |
| `moves.js` | The player's step (`stepPlayer()`: turn, bump, walk, stairs, coin, paper, room entry, boxes) and `goldReward`. Returns an events list. |
| `answers.js` | Settling an answer (`settleAnswer()`: hearts, haunts, the Gambler wager, boss HP and the darkness, clearing or spending the target, gold and the rune's hint). Returns an events list. |
| `quiz.js` | Picking questions, building multiple-choice options, fight choice labels. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets (localStorage). |

Drawing and page code:

| File | Job |
|---|---|
| `render.js` | Draws the grid, fog, actors, HUD (`renderHud()` is the only writer of hearts / gold / turns). Reads visibility and the camera from `sight.js`. |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `setloader.js` | Start screen options and the set loader (pasted, file, built-in, saved sets). |
| `devpanel.js` | DEV panel: Skip room, Auto-win, Fog toggle. Gets the `main.js` actions it calls passed in. |
| `main.js` | Everything else: element lookups, battle screen, floor setup (`loadRoom` = `buildFloor` data + `drawFloor` page), `drawEvents()` (draws every rule event), turn and answer flow, end screens. 1,250 lines — being split up. |

How a turn flows today: key/d-pad → `movePlayer()` (main.js) → `stepPlayer()` (moves.js,
uses `whatBlocks()`) → events → `applyTurnOutcome(events)` → `advanceMonsters()` (combat.js) →
`drawEvents()` (draws both lists, returns the room note) + `lightConsumed()` →
battle screen if something is adjacent → answer → `applyAnswerResult()` (main.js) →
`settleAnswer()` (answers.js) → events → `drawEvents()` (the encounter log) → next boss
question, end of run, or `endEncounter()`.

## Refactor in progress

See `docs/refactor-plan.md` for the target structure, the step list and its status.
Read only the files a step names; don't re-survey the whole codebase.
