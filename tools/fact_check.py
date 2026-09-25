"""Label every Bible question as a translation-independent fact or not.

    python3 tools/fact_check.py            # label lists/bible-*.json in place
    python3 tools/fact_check.py --dry-run  # report only, change nothing

A question is a FACT when its answer holds in every translation: its key
word(s) appear in the cited verse in the KJV, ASV and WEB alike (spelling
differences such as Elias/Elijah don't count), or it's a narrative answer
no translation spells out (an author, a count, a description).

It is NOT a fact when the answer depends on one translation's wording
("his truth endureth" in the KJV is "his faithfulness" in the ASV and WEB),
when the question names a particular translation, or when the passage is
missing from some translations (manuscript differences, e.g. Matt 6:13).

Each entry gets "fact": true/false, and "factNote" (why) when false.
Hand-reviewed decisions in tools/fact_review.json always win. Anything the
automatic check marks "not fact", or that cites a disputed passage, and
isn't reviewed yet is listed at the end: review it, add it to
fact_review.json, and re-run.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bible_text import (BIBLE_SETS, parse_refs, kjv_passage, passage, tokens, answer_keywords)

REVIEW_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fact_review.json')
NAMES_A_VERSION = re.compile(r'king james|\bkjv\b|\basv\b|\bniv\b|\besv\b|\bnkjv\b', re.I)
# Passages where translations follow different manuscripts. Questions citing
# these always get a human look before they're labelled.
DISPUTED = {('Matthew', 6, 13), ('Matthew', 17, 21), ('Matthew', 18, 11), ('Mark', 7, 16), ('Mark', 9, 44),
            ('Luke', 23, 34), ('John', 5, 4), ('Acts', 8, 37), ('1 John', 5, 7), ('Revelation', 13, 18)}
DISPUTED_CHAPTER_RANGES = {('Mark', 16): range(9, 21), ('John', 7): range(53, 54), ('John', 8): range(1, 12)}


def touches_disputed(refs):
    for book, ch, vs in refs:
        for v in (vs or []):
            if (book, ch, v) in DISPUTED or v in DISPUTED_CHAPTER_RANGES.get((book, ch), ()):
                return True
        if not vs and ((book, ch) in DISPUTED_CHAPTER_RANGES or any(d[:2] == (book, ch) for d in DISPUTED)):
            return True
    return False


def classify(e):
    """(fact, note, needs_review)"""
    if NAMES_A_VERSION.search(e['term']):
        return False, 'the question names a particular translation', True
    refs, _ = parse_refs(e.get('source'))
    disputed = touches_disputed(refs)
    if e.get('answerType') == 'verse':
        return True, None, disputed
    if not refs:
        return True, None, False
    keys = answer_keywords(e['meaning'])
    in_kjv = [w for w in keys if w in set(tokens(kjv_passage(refs)))]
    if not in_kjv:
        return True, None, disputed  # narrative answer, not spelled out in any translation
    missing = {}
    for tr in ('asv', 'web'):
        text = passage(refs, tr)
        if text is None:
            return None, f'could not fetch {tr.upper()}', True
        gone = [w for w in in_kjv if w not in set(tokens(text))]
        if gone:
            missing[tr] = gone
    if missing:
        return False, 'wording differs: ' + '; '.join(f'{tr.upper()} lacks "{", ".join(ws)}"' for tr, ws in missing.items()), True
    return True, None, disputed


def main():
    dry = '--dry-run' in sys.argv
    review = json.load(open(REVIEW_PATH, encoding='utf-8')) if os.path.exists(REVIEW_PATH) else {}
    totals = {True: 0, False: 0, None: 0}
    to_review = []
    for path in BIBLE_SETS:
        data = json.load(open(path, encoding='utf-8'))
        for i, e in enumerate(data):
            if e['term'] in review:
                fact, note = review[e['term']]['fact'], review[e['term']].get('note')
            else:
                fact, note, needs = classify(e)
                if needs:
                    to_review.append((path, i + 1, e, fact, note))
            totals[fact] += 1
            if fact is None:
                continue
            e['fact'] = fact
            if fact is False and note:
                e['factNote'] = note
            else:
                e.pop('factNote', None)
        if not dry:
            open(path, 'w', encoding='utf-8').write(json.dumps(data, indent=2, ensure_ascii=False))
    n = totals[True] + totals[False]
    print(f'fact: {totals[True]}  not fact: {totals[False]}  undecided: {totals[None]}'
          + (f'  ({totals[True] / n * 100:.1f}% fact)' if n else '') + ('  [dry run]' if dry else ''))
    if to_review:
        print(f'\nNEEDS REVIEW ({len(to_review)}): check each, then add it to tools/fact_review.json as')
        print('  "<question text>": {"fact": true|false, "note": "why (for not-fact)"}\n')
        for path, num, e, fact, note in to_review:
            print(f'  {os.path.basename(path)} #{num} [{e.get("source")}] auto={fact} {note or ""}')
            print(f'      {e["term"][:100]} => {e["meaning"]}')


if __name__ == '__main__':
    main()
