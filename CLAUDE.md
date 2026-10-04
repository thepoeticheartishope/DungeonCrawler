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
| `dungeon.js` | Builds a floor layout from the templates: rooms, hallways, boss room, stairs; `buildRestLayout()` for a rest floor's one room. |
| `decor.js` | Themes rooms and places pillars, papers, boxes (`makePlacer`). |
| `floors.js` | `FLOOR_RECIPES`: what each floor holds (grid, rooms, loops, minions and their kinds, light loss share, start/boss rooms, the floor's story lines, the beats met on the way to the boss); `floorRecipe(i)` reads it. Data only, grows with the level-design plan. |
| `beats.js` | `placeBeats()`: puts the recipe's beats (paper, box, minion, special) on room tiles along the walk from the start to the boss, in the recipe's order. Called by `buildFloor()`. |
| `floor.js` | `buildFloor()`: a new floor as data — layout, furniture, boss, stairs, the recipe's beats, coin, the one special item (chest / rune / encounter), minions, then light, sight and camera. `buildRestFloor(kind)`: a rest floor (opening / between / epilogue) — one room (`REST_RECIPES` in floors.js), papers on its `?` spots, the rest's story lines (`restLore`; the epilogue drops unread lines), coin, stairs, every danger and light field cleared. |
| `run.js` | `nextFloor()`: the run's shape, opening rest -> depth -> rest -> ... -> depth 3 -> epilogue rest -> win. `state.run.resting` says a rest floor is up; `roomIndex` counts danger depths only and goes up as a depth is left. |
| `passage.js` | `whatBlocks(row, col)`: the single answer to "can I step here?". |
| `sight.js` | The player's light (`computeVisibility`: `visibleSet` / `sightSet` / `exploredSet`, and marks papers/boxes made out as `identified`) and `canMakeOut`. Shooting (gun plan step 2, not used yet): `shootBlock(thing)` = null or why not (`outOfRange` past `PLAYER_CONE_RANGE` walkable steps, `notInLight` outside `sightSet`, `noLineOfSight`; wording `gun.block.*` in text.js), `canShoot(thing)`, `aimChance(thing)` (1 next to the player, `AIM_FALLOFF_PER_TILE` per tile of straight-line distance past the first, at least `AIM_MIN`). The camera is view-only, in `isoview.js`. |
| `light.js` | Boss light spreading through the floor; the run is lost at the coverage threshold. |
| `haunts.js` | Missed questions that come back later in the run. |
| `exchange.js` | THE UNFOLDING (code name exchange), on every rest floor: `offers()` (each `EXCHANGE_ITEMS` item, offered or why not) and `buy(id)` (spends myelin, applies the item, returns events). Max stability is `state.run.maxHearts`; bought slack waits in `state.run.bonusSlack` until `initBossLight()` spends it. |
| `modifiers.js` | Rolls Blind / Gambler / Flip / Timer for fight choices. |
| `combat.js` | Minion/hunter movement and turn advance. `spawnMinion(spot, minionKind)` makes a minion of a `MINION_KINDS` kind (config.js): `minionKind`, `hpLeft`, `limbs`, `trail` (its last tiles, for knockback). `advanceMonsters()` returns an events list; `main.js` `drawEvents()` draws it. With the gun on (`state.settings.gunCombat`, gun plan step 6) a minion or the hunter that reaches the player strikes (gun.js `minionStrike`) instead of engaging (step 7: the hunter strikes and is knocked back like a minion; a landed shot staggers it for `HUNTER_REST_TURNS`), kinds move only every `moveEvery` turns, and `findAdjacentEnemies()` leaves minions and the hunter out (no battle screen for them; the boss and items still open it). |
| `gun.js` | The gun (gun combat plan step 3; played since step 6 with DEV → Combat on gun): `pickTarget(tile)` (a seen minion or the hunter on the tapped tile becomes `state.floor.gunTarget`, anything else clears it; no turn), `refreshGunTarget()` (after a turn: drop a dead / unseen / unshootable target, then pick the best shootable one), `cycleTarget()` (T: the next shootable one), `reloadCategory()` (the next group of `fightGroups`, by `state.run.reloadIndex`), `reloadOffers()` (that category with no / one / two modifiers for `GUN_RELOAD_ROUNDS` 1/2/3, Gambler never), `settleReload()` (right loads up to `GUN_CHAMBER`, wrong jams, no heart lost), `fireBlock()` (`chamberEmpty`, `noTarget`, `notShootable` or a shootBlock reason) / `fire(target)` (aim roll; a landed shot on a minion waits in `state.battle.aim`, on the hunter it staggers), `settleShot(barPosition)` (graze 0 / hit 1 inside `GUN_HIT_HALF` / weak point 2 + a limb; a kill pays the kind's `gold` via `goldReward`), `minionStrike(m)` (`MINION_STRIKE_COST`, `DARK_MISS_COST` in the darkness, knocked back to the oldest trail tile), `staggerHunter()`. Rounds are `state.run.ammo`. Returns events lists; the caller spends the turn. |
| `moves.js` | The player's step (`stepPlayer()`: turn, bump, walk, stairs, coin, paper (the next story line from `state.run.loreQueue`), room entry, boxes) and `goldReward`. Returns an events list. |
| `answers.js` | Settling an answer (`settleAnswer()`: hearts, haunts, the Gambler wager, boss HP and the darkness, clearing or spending the target, gold and the rune's hint). Returns an events list. |
| `quiz.js` | Picking questions, building multiple-choice options, fight choice labels. |
| `sets.js` | Bundled sets (`lists/`) and saved custom sets (localStorage). |

Drawing and page code:

| File | Job |
|---|---|
| `render.js` | Draws around the map: screens, the edge glow toward an off-screen boss/hunter (screen edges, so it follows the diamond) and the d-pad hints (`renderRoomHints()`), the eye, and the HUD (`renderHud()` is the only writer of hearts / gold / turns; with the gun on also rounds, target + hp, aim % and whether RELOAD / FIRE can be pressed), battle target line, timer. |
| `mapview.js` | The map's canvas (isometric plan steps 1a–1c; gun plan step 0 removed the top-down view): hands `isoview.js` what it draws from `state` (fog, boss mist, glyphs) and owns the one `<canvas>` with a phosphor afterglow and the map's animations (looping warps/pulses/glows/mist drift from a frame clock; `slideOnMap()` / `bumpOnMap()` / `shotOnMap()` from their `drawEvents` cases; `onMapTap(handler)` hands main.js the tile under a tap, via isoview's `isoTileAt()`). `requestMapDraw()` after anything on the map changes (end of `drawEvents`, `drawFloor`, `leaveEncounter`). `glyphOf(thing)` is the one source of a thing's glyph (the battle screen uses it too). Reads visibility from `sight.js`; reads state only. `mapThings()` is the one list of what the map shows. |
| `isoview.js` | The isometric map, **the only map view** (the top-down view was removed in gun plan step 0; the room screen's map is 3:2 and the d-pad is turned 45° in CSS): `drawIsoScene()` is called by `mapview.js` `drawScene` with what it owns (colours, `mapThings()`, fog, `paintGlyph`, mist). Wall/pillar/box blocks with merged ridges, back-to-front by `row + col`, light falloff over 5 steps, pillar shadows, the player's light pool, stairs pit, flat papers, facing wedge, the player as a stick man (`drawStickMan()`: breathes, glances round after `MAP_ANIMATION_MS.playerIdle` standing still, feet swing on a step; idle clock is view-only module vars), the camera on the player. Step 3: walls in front of anything in sight are cut to stubs with a dashed full-height outline (Timothy chose cut-away over see-through); pillars are cut the same way (`pillarBox()`), with the same ease and hold; the boss mist is drawn per tile in the back-to-front order; `isoScreenShare()` / `isoScreenOffset()` place a tile on screen (render.js's edge glow uses them). Step 4a: the map is 3:2 (`ISO_MAP_SHAPE`), 7 tiles across instead of 9 on a map under 400 CSS px. Camera (`moveCamera()`, view-only module vars, not state): rests while the player is inside `ISO_CAMERA_BOX`, glides `ISO_CAMERA_GLIDE_MS` after them past its edge, frames shown without afterglow while it glides (mapview `showPlain()`, also used while the player slides (`slidePlayerOnMap()`) and while a wall eases between full height and stub (`easeWallCuts()` / `cutOf()`)); DEV → Camera switches to the old locked camera (`state.settings.isoCameraGlide`). Line glow is `strokeGlow()` + `glowStroke()`: two wider, fainter strokes under the line (`HALO_LAYERS`), not canvas `shadowBlur`, which cost about half of each frame; keep new iso lines on these. Gun plan step 4a, only with `state.settings.gunCombat`: the stick man holds the gun (`holdGun()` / `drawGun()`: raised while `state.battle.aim` waits, kicks back on a shot), tiles the gun reaches (`inReach()` = sight.js `canShoot`) lit by `aimChance` with the aim % on empty ones, corner brackets on shootable minions and the target (`state.floor.gunTarget`, breathing, aim % over it), a dashed laser muzzle → target, `showShot()` (flash + ring; a miss goes past, alternating sides, with MISS rising slowly; frames shown plain while it plays). `isoTileAt(x, y)` is the inverse of the projection (minion glyph boxes first, `tapBoxes`), for taps. Reads state only. |
| `textforms.js` | Minions as text forms (gun plan step 4b), drawn by `isoview.js` in place of a made-out minion's glyph (a '?' and the hunter stay glyphs): faceless shapes of letters from the loaded set's answers. SHARD = the mass, HUSK = the turning mass, STALKER = the drain (`drawTextForm()`; `formBox()` is a form's body box for brackets, taps and wall cuts, from fixed sizes so walls don't move as it floats). Limbs are its `limbs`; the strike tell shows within `FORM_TELL_STEPS`; the weak point brightens while `state.battle.aim` waits on it. `hurtForm` / `loseLimb` / `killForm` (via mapview `hurtOnMap` / `limbOffOnMap` / `deathOnMap` from drawEvents) note view-only moments here, not in state; a killed form floats apart where it died (`dyingForms()`). Calm rule: letters rewrite slowly (`MAP_ANIMATION_MS.formRewrite` / `formFade`), never scroll/scramble/flash; reduced motion holds everything still. Reads state only. |
| `tileart.js` | Filled-in textures for the map. **Which texture goes where is `TILE_ART` in config.js** (walls, wall tops, pillars, boxes, hallways, one floor per room theme), brightness `TILE_ART_TONES`, looks `TILE_ART_LOOKS`; to restyle, change the table; a new texture is a painter in `PAINTERS` plus its name in the table (`tests/tileart.test.mjs` checks every name exists and every theme has a floor). `artAt(row, col, size)` / `art(part, row, col, size, shade)` return a square canvas drawn once per size and look (4 looks, picked by tile place + floor) from its own seeded numbers, never `Math.random` (the seeded tests own it). Top-down draws them as squares (walls show beside seen floor, with a lit rim and a cast shadow); `isoview.js` bends them onto diamonds and faces once and keeps the result (`drawCachedFill()`), since bending them every frame doubled the frame time. Floors stay low-contrast so glyphs read first. |
| `exchangeview.js` | THE UNFOLDING's screen: myelin held, items with prices and reasons, the last trade's line. `renderExchange(note)`; gets `buyItem` / `leaveExchange` passed in from `main.js`. |
| `dataview.js` | DATA.SYS question viewer and comment export. |
| `setloader.js` | Start screen options and the set loader (pasted, file, built-in, saved sets). |
| `questionview.js` | The question panel (gun plan step 5): one `#queryPanel` (question, image, options, typed answer, Blind / Flip / Timer / Gambler) with `setQuestion()`, `applyModifier()`, `clearModifier()`, `placeWager()`, `retypeQuestion()`. `mountQuestionPanel(host, handlers)` moves it where it's needed — the battle screen's `#battleQuestionSlot` (main.js `mountBattleQuestion`) or the map's panel (gunpanels.js) — and the host's handlers (`onChoice`, `onTyped`, `onTimeout`, `log`) decide what an answer means there. |
| `gunpanels.js` | The gun's panels over the map (gun plan step 5), in `#mapWrap`: reload choices from `reloadOffers()` (`showReloadPanel`; 1-3 pick, Escape cancels), the question panel moved over the map (`showQuestionOnMap`), the damage bar (`showDamageBar(aim)`: marker sweeps `DAMAGE_BAR_SWEEP_MS` there and back, half speed under reduced motion; a tap, Space or F stops it). `mapPanelShown()`, `closeMapPanels()`. They start below the map's middle (the player stays visible) and grow down over the d-pad. Gets `pickReload` / `cancelReload` / `stopBar` passed in from `main.js`. Opened by RELOAD / FIRE (main.js `reloadGun` / `fireGun`) and the DEV test buttons. |
| `devpanel.js` | DEV panel: Skip room, Auto-win (with the gun on it also answers an open reload right and stops the damage bar on the weak point, via main.js `autoWinGun`), Fog, Camera and Combat (classic / gun, `state.settings.gunCombat`: minions fought on the map with RELOAD / FIRE) toggles, Test shot (main.js `devTestShot`: real `fire`; a landed shot opens the damage bar, real `settleShot`, no turn, fills an empty chamber), Test reload (main.js `devTestReload`: real `reloadOffers` / `settleReload` through the map panels, no turn), and the Inspect view (live state + a view-only ring of the last 20 events, fed by `drawEvents`). Gets the `main.js` actions it calls passed in. |
| `main.js` | Everything else: element lookups, battle screen (category choices, encounter log; the question itself is `questionview.js`), floor setup (`loadRoom` = `buildFloor()` from floor.js + `drawFloor` page), `drawEvents()` (draws every rule event), turn and answer flow, end screens. 1,030 lines — being split up. |

How a turn flows today: key/d-pad → `movePlayer()` (main.js) → `stepPlayer()` (moves.js,
uses `whatBlocks()`) → events → `applyTurnOutcome(events)` → `advanceMonsters()` (combat.js) →
`drawEvents()` (draws both lists, returns the room note) + `lightConsumed()` →
battle screen if something is adjacent → answer → `applyAnswerResult()` (main.js) →
`settleAnswer()` (answers.js) → events → `drawEvents()` (the encounter log) → next boss
question, end of run, or `endEncounter()`.

With the gun on (DEV → Combat), RELOAD / FIRE are turns too: R or RELOAD → `reloadGun()` →
reload panel → question over the map → `settleReload()`; F, FIRE or tapping the target again →
`fireGun()` → `fire()` (a landed shot on a minion opens the damage bar → `settleShot()`); T →
`cycleTarget()` (free); `.` waits. Each ends in `applyTurnOutcome(events)`, which also runs
`refreshGunTarget()` and ends the run if a minion's strike took the last stability.

## Refactor in progress

See `docs/refactor-plan.md` for the target structure, the step list and its status.
Read only the files a step names; don't re-survey the whole codebase.
