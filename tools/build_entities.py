"""Tops up a set's entities (lists/facts/<id>.json, the "facts" file of its
manifest entry) with every answer of the set no entity covers yet. Entities
are also the words wrong choices are drawn from (the old subject
dictionaries moved in: dictionary-entities plan).

    python3 tools/build_entities.py bible-quiz-bowl

Re-running keeps every entity as it is (edits are safe) and only adds
answers no entity covers by its "name" or one of its "aliases", any type.
A new entity goes after the last one of its type.

Entity fields (tools/validate.py checks them):
  id           the name in lowercase, "_" for anything else ("docking_station");
               one spelling with several types gets "_" + its type on every
               one ("name" reads "_person": judah_person, judah_location)
  name         the answer as it should be shown
  type         an answerType
  aliases      other spellings that mean this entity (a possessive "David's"
               is folded into "David")
  description  true when the answer describes rather than names ("The woman
               Jesus met at the well", "Isaac (and/or Rebekah)")
  list         true when the answer names several terms ("Abraham and Sarah",
               "1 Kings, 2 Kings, 2 Chronicles")
  draft        true when every question with this answer is a draft
  of, relation for type "related" (one person named through another):
               "Pharaoh's daughter" is of "Pharaoh", relation "daughter".
               Wrong answers sharing a part ("Jairus' daughter", "Lot's
               daughters") are offered first.
  acronym      the acronym a definition stands for (tools/import_acronyms.py)

New entities are guesses for review: check "description" / "list", fold any
other variants into "aliases", and remove a flag when it's wrong.
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
RELATED = re.compile(r"^(.+?)['’]s? (.+)$")


def key(s):
    return re.sub(r'\s+', ' ', str(s).strip()).lower()


def spellings(e):
    """An entity's name and aliases."""
    return [e['name']] + list(e.get('aliases', []))


def base_id(name):
    """The name in lowercase, "_" for anything else; apostrophes dropped."""
    s = name.replace('½', ' half').lower().replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_') or 'word'


def new_id(name, type_, entities):
    """A free id for a new entity: the base id, else + "_" + its type, else + a number."""
    taken = {e['id'] for e in entities}
    nid = base_id(name)
    if nid in taken:
        nid += '_' + ('person' if type_ == 'name' else type_.lower())
    n, first = 2, nid
    while nid in taken:
        nid, n = f'{first}_{n}', n + 1
    return nid


def insert(entities, entity):
    """Put `entity` after the last entity of its type (else at the end)."""
    last = max((i for i, e in enumerate(entities) if e.get('type') == entity['type']), default=len(entities) - 1)
    entities.insert(last + 1, entity)


def load_set(set_id):
    """(questions, facts file path, facts data) of bundled set `set_id`."""
    manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
    info = next((s for s in manifest if s.get('id') == set_id), None)
    if not info:
        sys.exit(f'No set {set_id!r} in lists/manifest.json (ids: {", ".join(s["id"] for s in manifest)}).')
    if 'facts' not in info:
        sys.exit(f'Set {set_id!r} has no "facts" file in lists/manifest.json: add "facts": "facts/{set_id}.json" first.')
    questions = json.load(open(os.path.join(ROOT, 'lists', info['file']), encoding='utf-8'))
    path = os.path.join(ROOT, 'lists', info['facts'])
    data = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    for part in ('entities', 'facts', 'templates'):
        data.setdefault(part, [])
    return questions, path, data


def dump(data):
    """One row per entity / fact / template, so a review diff shows each change on its own line."""
    parts = []
    for part in ('entities', 'facts', 'templates'):
        rows = ',\n'.join('    ' + json.dumps(r, ensure_ascii=False) for r in data.get(part, []))
        parts.append(f'  "{part}": [\n{rows}\n  ]' if rows else f'  "{part}": []')
    return '{\n' + ',\n'.join(parts) + '\n}\n'


def related_parts(name):
    """{"of", "relation"} of a "related" answer ("Pharaoh's daughter"), or {}."""
    m = RELATED.match(name)
    return {'of': m.group(1), 'relation': m.group(2).lower()} if m else {}


def new_entity(name, type_, all_draft, entities):
    entity = {'id': new_id(name, type_, entities), 'name': name, 'type': type_}
    if type_ == 'related':
        entity.update(related_parts(name))
    if type_ not in ('number', 'verse'):
        parts = LIST_SPLIT.split(name)
        if len(parts) > 1 and '(' not in name and all(p[:1].isupper() or p[:1].isdigit() for p in parts):
            entity['list'] = True
        elif DESCRIPTION.search(name):
            entity['description'] = True
    if all_draft:
        entity['draft'] = True
    return entity


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    set_id = sys.argv[1]
    questions, path, data = load_set(set_id)
    entities = data['entities']

    answers = {}  # (answer, type) -> every question with it is a draft
    for q in questions:
        k = (re.sub(r'\s+', ' ', q['answer'].strip()), q.get('answerType'))
        answers[k] = answers.get(k, True) and q.get('draft') is True

    def covered(name):
        return any(key(name) in [key(s) for s in spellings(e)] for e in entities)

    added, folded = [], []
    # Plain answers first, so a possessive finds its base entity.
    for (name, type_), all_draft in sorted(answers.items(), key=lambda kv: bool(POSSESSIVE.match(kv[0][0]))):
        if covered(name):
            continue
        m = POSSESSIVE.match(name)
        base = m and next((e for e in entities if e.get('type') == type_ and key(e['name']) == key(m.group(1))), None)
        if base:
            base.setdefault('aliases', []).append(name)
            folded.append(f'{name} -> {base["name"]}')
            continue
        entity = new_entity(name, type_, all_draft, entities)
        insert(entities, entity)
        added.append(entity)

    open(path, 'w', encoding='utf-8').write(dump(data))
    print(f'{os.path.relpath(path, ROOT)}: {len(entities)} entities, from {set_id}')
    print(f'  added {len(added)}, folded {len(folded)} spelling(s) into an existing entity')
    for e in added:
        print(f'    new: {e["id"]} {e["name"]!r} ({e["type"]})')
    for line in folded:
        print('    alias: ' + line)
    for flag in ('description', 'list', 'draft'):
        flagged = [e['name'] for e in added if e.get(flag)]
        if flagged:
            print(f'  {len(flagged)} new marked {flag}: check these')
    counts = {}
    for e in entities:
        counts[e.get('type')] = counts.get(e.get('type'), 0) + 1
    print('  by type: ' + ', '.join(f'{t} {n}' for t, n in sorted(counts.items(), key=str)))


if __name__ == '__main__':
    main()
