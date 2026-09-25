# Question-set tools

Scripts for checking the bundled question sets in `lists/`. They're not part
of the game: the service worker doesn't cache them and players never load them.
Python 3, standard library only. Run them from the repo root.

| Script | Needs internet | What it does |
|---|---|---|
| `validate.py` | no | Rules every set must pass: fields present, known `answerType`, no duplicate questions, no explicit terms in answers, verse answers look like "Micah 1:1", every Bible question labelled `fact`. Runs automatically on every PR. |
| `kjv_check.py` | first run only | Checks citations and quotes against the KJV text: citations exist, "Which verse says…?" quotes match, quoted phrases are in the cited verses. Reports only. |
| `fact_check.py` | yes (cached) | Labels every Bible question `"fact": true` or `false` by comparing the cited verse in the KJV, ASV and WEB. Writes the label into the JSON. |

Downloads and caches go in `tools/.cache/` (git-ignored). The KJV comes from a
public-domain JSON; ASV and WEB verses come from [bible-api.com](https://bible-api.com),
one request every couple of seconds, cached so re-runs are quick.

## Adding a batch of questions

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
5. `python3 tools/validate.py` should print "All question sets pass."

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
