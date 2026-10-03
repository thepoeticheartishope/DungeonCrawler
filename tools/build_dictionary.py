"""Builds or tops up a subject's term dictionary from the answers of every
bundled set with that subject (lists/manifest.json "subject").

    python3 tools/build_dictionary.py bible

Writes lists/dictionaries/<subject>.json: one entry per answer and answerType,
sorted by type then term. Re-running keeps every existing entry as it is
(edits are safe) and only adds answers no entry covers yet, by its "term" or
one of its "aka" spellings.

Entry fields:
  term         the answer as it should be shown
  type         an answerType (a name and a book with the same text, e.g.
               "Jonah", are two entries)
  aka          other spellings that mean this entry (a possessive "David's"
               is folded into "David")
  description  true when the answer describes rather than names ("The woman
               Jesus met at the well", "Isaac (and/or Rebekah)")
  list         true when the answer names several terms ("Abraham and Sarah",
               "1 Kings, 2 Kings, 2 Chronicles")
  draft        true when every question with this answer is a draft

New entries are guesses for review: check "description" / "list", fold any
other variants into "aka", and remove a flag when it's wrong.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Describes rather than names: brackets, a full sentence, "The"/"A"/"An" and
# then a lowercase word ("The gardener"; "The Red Sea" is a name), or more
# than 3 words ("Mother of John the Baptist"; "John the Baptist" is a name).
DESCRIPTION = re.compile(r'\(|\.$|^(The|A|An) [a-z0-9]|^\S+( \S+){3,}$')
# Several terms: split on commas, "and", "or", ";" and "/", every part
# capitalized ("Shadrach, Meshach and Abednego", "1 Kings, 2 Kings").
LIST_SPLIT = re.compile(r'\s*[,;/]\s*(?:and |or )?|\s+(?:and|or)\s+')
POSSESSIVE = re.compile(r"^(.*?)['’]s$")


def key(s):
    return re.sub(r'\s+', ' ', s.strip()).lower()


def collect(subject):
    """{(meaning, type): all_draft} over every bundled set of `subject`."""
    manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
    sets = [s for s in manifest if s.get('subject') == subject]
    if not sets:
        sys.exit(f'No set in lists/manifest.json has subject {subject!r}.')
    answers = {}
    for s in sets:
        for e in json.load(open(os.path.join(ROOT, 'lists', s['file']), encoding='utf-8')):
            meaning = re.sub(r'\s+', ' ', e['meaning'].strip())
            k = (meaning, e.get('answerType'))
            answers[k] = answers.get(k, True) and e.get('draft') is True
    return [s['file'] for s in sets], answers


def new_entry(term, type_, all_draft):
    entry = {'term': term, 'type': type_}
    if type_ not in ('number', 'verse'):
        parts = LIST_SPLIT.split(term)
        if len(parts) > 1 and '(' not in term and all(p[:1].isupper() or p[:1].isdigit() for p in parts):
            entry['list'] = True
        elif DESCRIPTION.search(term):
            entry['description'] = True
    if all_draft:
        entry['draft'] = True
    return entry


def dump(entries):
    """One entry per line, so a review diff shows each change on its own line."""
    lines = ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in entries)
    return '[\n' + lines + '\n]\n'


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    subject = sys.argv[1]
    files, answers = collect(subject)
    path = os.path.join(ROOT, 'lists', 'dictionaries', subject + '.json')
    entries = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else []

    def covered(term, type_):
        return any(e['type'] == type_ and key(term) in [key(e['term'])] + [key(a) for a in e.get('aka', [])]
                   for e in entries)

    added, folded = [], []
    # Plain answers first, so a possessive finds its base entry.
    for (term, type_), all_draft in sorted(answers.items(), key=lambda kv: bool(POSSESSIVE.match(kv[0][0]))):
        if covered(term, type_):
            continue
        m = POSSESSIVE.match(term)
        base = m and next((e for e in entries if e['type'] == type_ and key(e['term']) == key(m.group(1))), None)
        if base:
            base.setdefault('aka', []).append(term)
            folded.append(f'{term} -> {base["term"]}')
            continue
        entry = new_entry(term, type_, all_draft)
        entries.append(entry)
        added.append(entry)

    entries.sort(key=lambda e: (e['type'], key(e['term'])))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(dump(entries))

    print(f'{os.path.relpath(path, ROOT)}: {len(entries)} entries from {", ".join(files)}')
    print(f'  added {len(added)}, folded {len(folded)} spelling(s) into an existing entry')
    for line in folded:
        print('    aka: ' + line)
    for flag in ('description', 'list', 'draft'):
        flagged = [e['term'] for e in added if e.get(flag)]
        if flagged:
            print(f'  {len(flagged)} new marked {flag}: check these')
    counts = {}
    for e in entries:
        counts[e['type']] = counts.get(e['type'], 0) + 1
    print('  by type: ' + ', '.join(f'{t} {n}' for t, n in sorted(counts.items())))


if __name__ == '__main__':
    main()
