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

## Module map

Rules and data (no page/DOM access):

| File | Job |
|---|---|
| `config.js` | Tunable constants and sample data. Never changes at runtime. |
| `state.js` | The one shared `state` object every module reads/writes, plus `key(r, c)`. |
| `text.js` | All wording. `t()`, per-floor overrides, `data-t` labels. |
| `rooms.js` | Hand-drawn room templates (`#` wall, `.` floor, `?` prop, `+` inner door). |
| `dungeon.js` | Builds a floor layout from the templates: rooms, hallways, boss room, stairs. |
| `decor.js` | Themes rooms and places pillars, papers, boxes (`makePlacer`). |
| `passage.js` | `whatBlocks(row, col)`: the single answer to "can I step here?". |
| `light.js` | Boss light spreading through the floor; the run is lost at the coverage threshold. |
| `haunts.js` | Missed questions that come back later in the run. |
| `modifiers.js` | Rolls Blind / Gambler / Flip / Timer for fight choices. |
| `quiz.js` | Picking questions, building multiple-choice options, fight choice labels. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets (localStorage). |

Drawing and page code:

| File | Job |
|---|---|
| `render.js` | Draws the grid, fog, actors, HUD. **Also** computes visibility and the camera (a rule, see plan step 3). |
| `combat.js` | Minion/hunter movement and turn advance. **Also** moves DOM elements (see plan step 4). |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `main.js` | Everything else: element lookups, start screen + set loader, battle screen, floor setup (`loadRoom`), turn and answer rules, dev panel, end screens. 1,500 lines — being split up. |

How a turn flows today: key/d-pad → `movePlayer()` (main.js) → `whatBlocks()` → move +
redraw → `applyTurnOutcome()` → `advanceMonsters()` (combat.js) + `lightConsumed()` →
battle screen if something is adjacent → answer → `applyAnswerResult()` →
`resolveBossAnswer()` or `resolveOneShot()`.

## Refactor in progress

See `docs/refactor-plan.md` for the target structure, the step list and its status.
Read only the files a step names; don't re-survey the whole codebase.
