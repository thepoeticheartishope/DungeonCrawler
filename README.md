# Term Dungeon

A vocabulary quiz game with dungeon-crawler combat, built for educators to gamify vocabulary/term practice.

## Play

**[Play Term Dungeon](https://thepoeticheartishope.github.io/DungeonCrawler/)**

Works in any browser, and can be installed as an app (PWA) from that page on desktop or mobile.

## Load your own term list

From the start screen, use "Load your own term list" to upload a `.txt`, `.csv`, or `.json` file, or paste terms directly (`term | definition` per line).

## Changing the wording

All game text (the encounter log, battle and map messages, screen labels, end screens) lives in [`js/text.js`](js/text.js), one line per key. Edit the text in quotes; `{name}` parts are filled in by the game. The top of that file explains the rest (capitals, plurals, random variants, per-room overrides). After editing, bump `CACHE_NAME` in `service-worker.js` so browsers pick up the change.

## Drawing rooms

Every room is a text drawing in [`js/rooms.js`](js/rooms.js): `#` wall, `.` floor, `?` a spot that always gets a paper or box, `+` a doorway inside the room, and a `.` on the outer edge is a door out. Each drawing is also used turned and mirrored. Room themes (crypt, library, flooded cellar, shrine), pillar odds, box loot and the 3-tile `?` distance are in [`js/config.js`](js/config.js); their wording and lore are the `theme.*` lines in `js/text.js`. After editing, bump `CACHE_NAME` as above.

## Credits

Terminal font: [VT323](https://github.com/phoikoi/VT323) by Peter Hull, under the SIL Open Font License 1.1 (see `fonts/OFL.txt`).
