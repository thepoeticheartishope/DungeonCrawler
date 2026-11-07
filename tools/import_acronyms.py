"""Adds the acronym list of one or more CompTIA exam objectives PDFs to a
set's entities (lists/facts/<id>.json, the "facts" file of its manifest
entry). Entities are also the words wrong choices are drawn from.

    python3 tools/import_acronyms.py comptia-aplus OBJECTIVES.pdf [MORE.pdf ...]

Needs `pdftotext` (poppler-utils). Each objectives PDF ends with an
"Acronym List" (ACRONYM / DEFINITION columns); every definition becomes an
entity of type "term" (the sets ask "RAM" and want "Random Access Memory"):

  {"id": "random_access_memory", "name": "Random-access Memory", "type": "term", "acronym": "RAM", "aliases": ["Random Access Memory"]}

- A bracketed expansion inside a definition is dropped from the shown
  name and kept as an alias: "Virtual LAN [Local Area Network]" -> "Virtual
  LAN". Shown with it, the right answer would stand out by its length.
- When two PDFs spell the same acronym's definition differently only by
  case or wording ("Identity and Access Management" / "Identity Access
  Management"), the first PDF's spelling is the name and the other an alias.
  An acronym with two unrelated meanings (SPICE) gets two entities. A
  definition already an entity under another acronym is skipped and
  reported (the 220-1201 list has "XXS" for Cross-site Scripting, a typo
  for XSS): fix the kept entity's "acronym" by hand if it's the wrong one.
- An answer of the set that matches a definition ignoring case, hyphens
  and spaces ("Random Access Memory" / "Random-access Memory") becomes an
  alias of it, so the set has one entity for it.

Re-running keeps existing entities as they are and only adds what's new.
Then run tools/build_entities.py for any set answer the list doesn't
have, and tools/validate.py.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build_entities import dump, insert, key, load_set, new_id, spellings  # noqa: E402

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
    set_id, pdfs = sys.argv[1], sys.argv[2:]
    questions, path, data = load_set(set_id)
    entities = data['entities']

    def add_alias(e, spelling):
        if key(spelling) not in [key(s) for s in spellings(e)]:
            e.setdefault('aliases', []).append(spelling)

    added, aliases, repeats = [], [], []
    for pdf in pdfs:
        for acronym, definition in acronyms(pdf):
            shown = BRACKET.sub('', definition).strip()
            same = [e for e in entities if e.get('acronym') == acronym]
            # Same acronym, mostly the same words: another spelling of one meaning.
            match = next((e for e in same if loose(e['name']) == loose(shown)
                          or len(words(e['name']) & words(shown)) >= max(len(words(shown)) - 1, 1)), None)
            if match:
                for spelling in (shown, definition):
                    if key(spelling) not in [key(s) for s in spellings(match)]:
                        add_alias(match, spelling)
                        aliases.append(f'{acronym}: {spelling} -> {match["name"]}')
                continue
            other = next((e for e in entities if e.get('type') == 'term' and key(e['name']) == key(shown)), None)
            if other:
                if other.get('acronym') != acronym:
                    repeats.append(f'{acronym}: same definition as {other.get("acronym")} ({shown}); kept {other.get("acronym")}')
                continue
            entity = {'id': new_id(shown, 'term', entities), 'name': shown, 'type': 'term', 'acronym': acronym}
            if definition != shown:
                entity['aliases'] = [definition]
            insert(entities, entity)
            added.append(entity)

    # Set answers spelled a little differently from the list become aliases.
    for q in questions:
        m = q['answer'].strip()
        e = next((e for e in entities if e.get('acronym') and any(loose(x) == loose(m) for x in spellings(e))), None)
        if e and key(m) not in [key(x) for x in spellings(e)]:
            add_alias(e, m)
            aliases.append(f'set answer: {m} -> {e["name"]}')

    open(path, 'w', encoding='utf-8').write(dump(data))
    print(f'{os.path.relpath(path, ROOT)}: {len(entities)} entities, added {len(added)}')
    for line in aliases:
        print('  alias: ' + line)
    for line in repeats:
        print('  check: ' + line)
    for acronym in sorted({e['acronym'] for e in entities if e.get('acronym')}):
        meanings = [e['name'] for e in entities if e.get('acronym') == acronym]
        if len(meanings) > 1:
            print(f'  {acronym} has {len(meanings)} meanings: {" / ".join(meanings)}')


if __name__ == '__main__':
    main()
