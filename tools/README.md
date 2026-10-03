# Question-set tools

Scripts for checking the bundled question sets in `lists/`. They're not part
of the game: the service worker doesn't cache them and players never load them.
Python 3, standard library only. Run them from the repo root.

| Script | Needs internet | What it does |
|---|---|---|
| `validate.py` | no | Rules every set must pass: every manifest entry has a `subject` (sets on the same material share one, e.g. `bible`), every answer is in the subject's dictionary when it has one, fields present, known `answerType`, no duplicate questions, no explicit terms in answers, verse answers look like "Micah 1:1", every Bible question labelled `fact`. Run it before every PR that touches a question set. |
| `stem_check.mjs` | no | `node tools/stem_check.mjs` (Node): per set, how many questions a stem cue covers (`STEM_CUES` in `js/config.js`: "Who…?" → people, "How many…?" → numbers) and which tagged questions have a type their stem doesn't allow. The tag wins in play, so each listed one is a tagging mistake to fix or a real exception to leave. Reports only. |
| `import_acronyms.py` | no | `python3 tools/import_acronyms.py comptia-aplus OBJECTIVES.pdf [MORE.pdf]` (needs `pdftotext`): adds a CompTIA objectives PDF's acronym list to the subject's dictionary, one `term` entry per definition with its `acronym`. Reports spellings it merged and definitions listed twice. Re-running only adds what's new. |
| `build_dictionary.py` | no | `python3 tools/build_dictionary.py bible`: adds every answer of the subject's sets that `lists/dictionaries/<subject>.json` doesn't cover yet. Keeps existing entries as they are, so edits are safe. See "Subject dictionaries" below. |
| `convert_batch.py` | yes (cached) | The steps for a photographed card batch in one place: checks the photos weren't converted before, refuses exact duplicates and lists likely near-duplicates, adds the batch, bumps `CACHE_NAME`, then runs the three scripts above for just the new questions. |
| `kjv_check.py` | first run only | Checks citations and quotes against the KJV text: citations exist, "Which verse says…?" quotes match, quoted phrases are in the cited verses. Reports only. |
| `fact_check.py` | yes (cached) | Labels every Bible question `"fact": true` or `false` by comparing the cited verse in the KJV, ASV and WEB. Writes the label into the JSON. |

Downloads and caches go in `~/.cache/dungeoncrawler-tools/` (outside the repo,
so every checkout and worktree shares them; set `DUNGEONCRAWLER_TOOLS_CACHE` to
move it). The KJV comes from a public-domain JSON; ASV and WEB verses come from
[bible-api.com](https://bible-api.com), one request every couple of seconds,
cached so re-runs are quick.

## Converting a photographed card batch

1. `python3 tools/convert_batch.py photos FRONT.jpg BACK.jpg`: stops you if
   either photo was converted before, even under another name
   (`tools/batches.json` keeps every batch's photo hashes and PR).
2. Transcribe the cards into a JSON list of entries (`term`, `meaning`,
   `category`, `difficulty`, `source`, `answerType`, `draft` when the answer is
   more than one word; a person named through another, "Pharaoh's daughter",
   counts as one answer: type `related`), then
   `python3 tools/convert_batch.py add BATCH.json --front FRONT.jpg --back BACK.jpg`.
   It refuses exact duplicates, lists near-duplicates to judge (skip only true
   duplicates), adds the rest, bumps `CACHE_NAME` and runs the checks.
3. Fix what the KJV check reports and add the fact decisions to
   `tools/fact_review.json` (see step 4 below), then
   `python3 tools/convert_batch.py check` until it's clean.
4. Open the PR, then `python3 tools/convert_batch.py pr NUMBER` and push that
   to the same PR.

"New" means not on `origin/main`; set `CONVERT_BASE` to compare with another ref.

## Adding a batch of questions by hand

1. Add the questions to `lists/bible-quiz-bowl.json` (or `bible-trivia.json`).
2. `python3 tools/kjv_check.py`: fix any wrong citations or misquoted verses it reports.
3. `python3 tools/fact_check.py`: labels every question.
4. Look at its **NEEDS REVIEW** list. For each one, decide whether the answer
   really depends on the translation, and record the decision in
   `tools/fact_review.json`:
   ```json
   "<exact question text>": {"fact": false, "note": "KJV \"truth\" / ASV, WEB \"faithfulness\""}
   ```
   Spelling differences (Elias / Elijah, colours / colors) and the same thing
   under another name (Diana / Artemis) count as facts. Then run step 3 again.
5. `python3 tools/build_dictionary.py bible`: adds the new answers to the dictionary; check what it marks.
6. `python3 tools/validate.py` should print "All question sets and dictionaries pass."

## Subject dictionaries

`lists/dictionaries/<subject>.json` lists the terms of one subject (all sets
with that `subject` in `lists/manifest.json`), one entry per line:

```json
{"term": "David", "type": "name", "aka": ["David's"]}
{"term": "The woman Jesus met at the well", "type": "name", "description": true}
{"term": "Abraham and Sarah", "type": "name", "list": true}
```

- `type`: an answerType. A name and a book with the same text ("Jonah") are two entries.
- `aka`: other spellings that mean this entry. A question's answer matches an
  entry by its `term` or an `aka`.
- `of` / `relation`: for type `related` (one person named through another):
  "Pharaoh's daughter" is of "Pharaoh", relation "daughter". Wrong answers
  that share a part ("Jairus' daughter", "Lot's daughters") come first.
- `acronym`: for CompTIA terms, the acronym the definition belongs to
  (`tools/import_acronyms.py`). `lists/dictionaries/comptia-aplus.json` is
  the A+ 220-1201 + 220-1202 objectives' acronym lists; the 220-1201 list's
  "XXS" (Cross-site Scripting) is fixed to XSS by hand.
- `description`: the answer describes rather than names. `list`: it names
  several terms. `draft`: every question with this answer is a draft.

`build_dictionary.py` only guesses `description` / `list` / the possessive
`aka`s; review its new entries. Only terms from the course material belong
here (names in the Bible, acronyms on the exam's list). The game doesn't use
the dictionary yet: the plan is that wrong answers come from it.

## What "fact" means

- **Fact:** the answer is true in every translation. Most questions: people,
  places, events, numbers.
- **Not fact** (`"fact": false`, with a `"factNote"` saying why): the answer
  depends on one translation's wording ("his *truth* endureth" is "his
  *faithfulness*" in the ASV and WEB), the question names a translation
  ("the last word of the King James Version"), or the passage is missing
  from some translations because they follow different manuscripts
  (Matthew 6:13's "For thine is the kingdom…").

The game doesn't use the label yet. It's there so a future switch to another
translation knows exactly which questions to reword or hide.

## Floor statistics

`node tools/floor_stats.mjs [floors per depth]` (Node, no dependencies) builds
many floors per depth with the game's own `buildFloor()` and prints the walk
from the start to the boss, the light's turn budget, and the slack between them
(p10 / p50 / p90). Add `--loss 0.9,0.7,0.5` to compare loss shares on every
floor. Use it when tuning `js/floors.js`. 300 floors per depth takes about 30 s.
