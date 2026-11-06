# There's Been a Tragedy

A quiz game for teaching: the captain of a spaceship has died, and the player takes command. Each
crew member has a job that is a small game built from a question set; the player learns each
role at the training console, then teaches it to the crew. Wrong answers raise the crew's panic.
Teach the crew and beat the final challenge, and the ship reaches the planet.

## Play

**[Play it here](https://thepoeticheartishope.github.io/DungeonCrawler/)**

Works in any browser, and can be installed as an app (PWA) from that page on desktop or mobile.

## Use your own questions

After **Begin**, the set screen lists the built-in sets. **Make your own set** opens the workshop:
paste or load a `.txt`, `.csv` or `.json` list (`term | definition` per line), then save it. Saved
sets show on the set screen.

## Changing the wording

All game text (screen labels, the room log, the ship's opening, the minigames, the end screens)
lives in [`js/text.js`](js/text.js), one line per key. Edit the text in quotes; `{name}` parts are
filled in by the game. The top of that file explains the rest (capitals, plurals, random
variants). After editing, bump `CACHE_NAME` in `service-worker.js` so browsers pick up the change.

## The ship's plan

The ship is one fixed plan in [`js/plans.js`](js/plans.js) (`FLOOR_PLANS.ship`): rows of text for
its walls and floor, each room's rectangle and name, its furniture, and where the stations and
crew stand. Room names are `plan.ship.*` lines in `js/text.js`. After editing, bump `CACHE_NAME` as
above.

## Credits

Terminal font: [VT323](https://github.com/phoikoi/VT323) by Peter Hull, under the SIL Open Font License 1.1 (see `fonts/OFL.txt`).

Space outside the ship's windows: drawn by a port of [PixelSpace](https://deep-fold.itch.io/) by Deep-Fold (`js/space.js`), under the MIT licence, copyright (c) 2021 Deep-Fold.
