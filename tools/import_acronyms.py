"""Adds the acronym list of one or more CompTIA exam objectives PDFs to a
subject's term dictionary (lists/dictionaries/<subject>.json).

    python3 tools/import_acronyms.py comptia-aplus OBJECTIVES.pdf [MORE.pdf ...]

Needs `pdftotext` (poppler-utils). Each objectives PDF ends with an
"Acronym List" (ACRONYM / DEFINITION columns); every definition becomes an
entry of type "term" (the sets ask "RAM" and want "Random Access Memory"):

  {"term": "Random-access Memory", "type": "term", "acronym": "RAM", "aka": ["Random Access Memory"]}

- A bracketed expansion inside a definition is dropped from the shown
  term and kept as an aka: "Virtual LAN [Local Area Network]" -> "Virtual
  LAN". Shown with it, the right answer would stand out by its length.
- When two PDFs spell the same acronym's definition differently only by
  case or wording ("Identity and Access Management" / "Identity Access
  Management"), the first PDF's spelling is the term and the other an aka.
  An acronym with two unrelated meanings (SPICE) gets two entries. A
  definition already in the dictionary under another acronym is skipped
  and reported (the 220-1201 list has "XXS" for Cross-site Scripting, a
  typo for XSS): fix the kept entry's "acronym" by hand if it's the wrong one.
- An answer of the subject's sets that matches a definition ignoring case,
  hyphens and spaces ("Random Access Memory" / "Random-access Memory")
  becomes an aka of it, so the dictionary has one entry for it.

Re-running keeps existing entries as they are and only adds what's new.
Then run tools/build_dictionary.py for any set answer the list doesn't
have, and tools/validate.py.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build_dictionary import dump, key  # noqa: E402

HEADER = re.compile(r'^CompTIA .*\(\d{3}-\d{3,4}\) Acronym List')
ROW = re.compile(r'^(\S+)\s{2,}(\S.*)$')
SKIP = re.compile(r'^(ACRONYM\s+DEFINITION|.*Copyright|.*Exam Objectives|CompTIA .*Certification Exam)')
BRACKET = re.compile(r'\s*\[([^\]]*)\]')


def acronyms(pdf):
    """[(acronym, definition)] from one objectives PDF's acronym list."""
    text = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if HEADER.match(l.strip())), None)
    if start is None:
        sys.exit(f'No acronym list found in {pdf}')
    rows, last, started = [], None, False
    for line in lines[start + 1:]:
        if 'Hardware and' in line and 'List' in line or 'Software List' in line:
            break  # the hardware/software list that follows the acronyms
        if line.startswith('ACRONYM'):
            started = True
        if not started or not line.strip() or SKIP.match(line.strip()):
            last = None
            continue
        m = ROW.match(line)
        if m:
            rows.append([m.group(1), m.group(2).strip()])
            last = rows[-1]
        elif last and line.startswith(' ' * 10):
            last[1] += ' ' + line.strip()  # a definition wrapped onto the next line
    return rows


def loose(s):
    """Spelling key ignoring case, hyphens and spaces."""
    return re.sub(r'[\s\-]+', '', s).lower()


def words(s):
    return set(re.findall(r'[a-z0-9]+', s.lower()))


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    subject, pdfs = sys.argv[1], sys.argv[2:]
    path = os.path.join(ROOT, 'lists', 'dictionaries', subject + '.json')
    entries = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else []

    def spellings(e):
        return [e['term']] + list(e.get('aka', []))

    def add_aka(e, spelling):
        if key(spelling) not in [key(s) for s in spellings(e)]:
            e.setdefault('aka', []).append(spelling)

    added, akas, repeats = [], [], []
    for pdf in pdfs:
        for acronym, definition in acronyms(pdf):
            shown = BRACKET.sub('', definition).strip()
            same = [e for e in entries if e.get('acronym') == acronym]
            # Same acronym, mostly the same words: another spelling of one meaning.
            match = next((e for e in same if loose(e['term']) == loose(shown)
                          or len(words(e['term']) & words(shown)) >= max(len(words(shown)) - 1, 1)), None)
            if match:
                for spelling in (shown, definition):
                    if key(spelling) not in [key(s) for s in spellings(match)]:
                        add_aka(match, spelling)
                        akas.append(f'{acronym}: {spelling} -> {match["term"]}')
                continue
            other = next((e for e in entries if key(e['term']) == key(shown)), None)
            if other:
                if other.get('acronym') != acronym:
                    repeats.append(f'{acronym}: same definition as {other.get("acronym")} ({shown}); kept {other.get("acronym")}')
                continue
            entry = {'term': shown, 'type': 'term', 'acronym': acronym}
            if definition != shown:
                entry['aka'] = [definition]
            entries.append(entry)
            added.append(entry)

    # Set answers spelled a little differently from the list become akas.
    manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
    for s in manifest:
        if s.get('subject') != subject:
            continue
        for q in json.load(open(os.path.join(ROOT, 'lists', s['file']), encoding='utf-8')):
            m = q['meaning'].strip()
            e = next((e for e in entries if any(loose(x) == loose(m) for x in spellings(e))), None)
            if e and key(m) not in [key(x) for x in spellings(e)]:
                add_aka(e, m)
                akas.append(f'set answer: {m} -> {e["term"]}')

    entries.sort(key=lambda e: (e['type'], key(e['term'])))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(dump(entries))
    print(f'{os.path.relpath(path, ROOT)}: {len(entries)} entries, added {len(added)}')
    for line in akas:
        print('  aka: ' + line)
    for line in repeats:
        print('  check: ' + line)
    for acronym in sorted({e['acronym'] for e in entries if e.get('acronym')}):
        meanings = [e['term'] for e in entries if e.get('acronym') == acronym]
        if len(meanings) > 1:
            print(f'  {acronym} has {len(meanings)} meanings: {" / ".join(meanings)}')


if __name__ == '__main__':
    main()
