"""Offline rules every bundled question set (and subject dictionary) must pass. Run it before every PR
that touches a question set; it exits non-zero on any problem.

    python3 tools/validate.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = {'name', 'relation', 'group', 'role', 'related', 'location', 'book', 'creature', 'object', 'theology', 'adjective', 'verb', 'number', 'verse', 'term',
         'port', 'protocol', 'device', 'tool', 'networkType', 'record', 'standard', 'config', 'connection', 'cable', 'connector', 'interface', 'memory', 'storage', 'raid', 'board', 'component', 'display', 'printer', 'printSetting', 'pdl', 'accessory', 'mobileSetting', 'cellular', 'virtualization', 'cloud', 'cloudModel', 'cloudService', 'cpuFeature', 'causePC', 'causeDrive', 'causeDisplay', 'causeMobile', 'causeNetwork', 'causePrinter'}  # CompTIA; keep in step with ANSWER_TYPE_GROUPS in js/config.js
DIFFICULTIES = {'easy', 'medium', 'hard'}
# Keep in step with EXPLICIT_ANSWER_TERMS in js/config.js.
EXPLICIT = re.compile(r'\b(sex|sexual|rape[sd]?|incest\w*|adulter\w*|fornicat\w*|harlot\w*|whore\w*|prostitut\w*)\b', re.I)
SUBJECT = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
VERSE_ADDRESS = re.compile(r'^(\d )?[A-Za-z]+( of [A-Za-z]+)? \d+(:\d+(-\d+)?)?$')
# A CompTIA question's source names only the exam and the public objective
# ("220-1201 2.5"), never an instructor-guide lesson: the questions are our
# own, not taken from CompTIA's course books (Timothy). Its category is the
# exam domain of that objective (2.5 -> domain 2, Networking). Add an exam
# here before its first question goes in.
COMPTIA_DOMAINS = {
    '220-1201': {'1': 'Mobile Devices', '2': 'Networking', '3': 'Hardware',
                 '4': 'Virtualization & Cloud', '5': 'Troubleshooting'},
}
COMPTIA_SOURCE = re.compile(r'^(\d{3}-\d{4}) (\d+)\.\d+$')

errors = []
answers_by_subject = {}  # subject -> {(answer, answerType)}
manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
for set_info in manifest:
    path = os.path.join('lists', set_info['file'])
    data = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    subject = set_info.get('subject')
    if not isinstance(subject, str) or not SUBJECT.match(subject):
        errors.append(f'lists/manifest.json {set_info["id"]}: "subject" must be a lowercase name like "bible" or "comptia-aplus", got {subject!r}')
    is_comptia = subject.startswith('comptia')
    seen = {}
    subject_answers = answers_by_subject.setdefault(subject, set())
    for i, e in enumerate(data):
        subject_answers.add((' '.join(str(e.get('answer', '')).split()).lower(), e.get('answerType')))
        tag = f'{path} #{i + 1}'
        def err(msg): errors.append(f'{tag}: {msg} | {str(e.get("question", ""))[:70]}')
        for field in ('question', 'answer'):
            if not isinstance(e.get(field), str) or not e[field].strip():
                err(f'missing "{field}"')
        # Old field names (renamed 2026-11-06: term -> question,
        # meaning -> answer, factNote -> note; the fact flag was dropped).
        for old in ('term', 'meaning', 'factNote', 'fact'):
            if old in e:
                err(f'old field "{old}" (use question / answer / note; fact is gone)')
        if 'note' in e and (not isinstance(e['note'], str) or not e['note'].strip()):
            err('"note" must be a non-empty string when present')
        if e.get('answerType') not in TYPES:
            err(f'unknown answerType {e.get("answerType")!r}')
        if 'label' in e:
            # Facts moved to their own file (facts list plan step B, 2026-11-06).
            err('"label" is gone: put the fact in the set\'s facts file (lists/facts/<id>.json)')
        if 'difficulty' in e and e['difficulty'] not in DIFFICULTIES:
            err(f'unknown difficulty {e["difficulty"]!r}')
        image = e.get('image')
        if image and not re.match(r'^(https?:|data:)', image) and not os.path.isfile(os.path.join(ROOT, 'lists', image)):
            err(f'image not found: lists/{image}')
        # A picture question is told apart by its picture ("Which tool is
        # shown?" with a different image each time).
        key = (str(e.get('question', '')).strip().lower(), e.get('image') or '')
        if key in seen:
            err(f'same question text as #{seen[key]}')
        seen[key] = i + 1
        answers = [e.get('answer', '')] + list(e.get('options') or [])
        if any(EXPLICIT.search(a or '') for a in answers):
            err('explicit term in an answer or option')
        if 'options' in e:
            if not isinstance(e['options'], list) or not 2 <= len(e['options']) <= 4:
                err('"options" must list 2 to 4 answers')
            elif e.get('answer') not in e['options']:
                err('"options" must include the correct answer')
        if e.get('answerType') == 'verse' and not VERSE_ADDRESS.match(e.get('answer', '')):
            err(f'verse answer {e.get("answer")!r} is not an address like "Micah 1:1"')
        if 'draft' in e and e['draft'] is not True:
            err('"draft" must be true when present')
        if is_comptia:
            source = COMPTIA_SOURCE.match(str(e.get('source', '')))
            domains = COMPTIA_DOMAINS.get(source.group(1), {}) if source else {}
            if not source:
                err(f'source {e.get("source")!r} is not like "220-1201 2.5" (exam and objective only, no lesson)')
            elif source.group(2) not in domains:
                err(f'no domain {source.group(2)} for exam {source.group(1)} in COMPTIA_DOMAINS')
            elif e.get('category') != domains[source.group(2)]:
                err(f'category {e.get("category")!r} should be {domains[source.group(2)]!r} (domain {source.group(2)})')

# A set's facts (lists/facts/<id>.json, named by "facts" in its manifest
# entry; facts list plan steps B and C1) are optional. The file is one object
# of Subject-Predicate-Object triples:
#   { "entities":  [{ "id", "name", "type", "aliases"? }],
#     "facts":     [{ "subject", "predicate", "object", "source"? }],
#     "templates": [{ "predicate", "label"?, "ask_object"?, "ask_subject"?,
#                     "category"?, "difficulty"?, "min"?, "max"? }] }
# Ids are lowercase words joined by "_" and unique. `type` is an answerType
# word. `subject` is an entity id; `object` is an entity id or a number (no
# quotes). No fact twice. A fact's label (its template's, or the fallback
# "<subject name> <predicate>") is 1-34 characters and no two are the same,
# as Inference shows it. Inference uses the whole-number objects of 1 or more.
ENTITY_ID = re.compile(r'^[a-z0-9]+(_[a-z0-9]+)*$')
ENTITY_FIELDS = {'id', 'name', 'type', 'aliases'}
TRIPLE_FIELDS = {'subject', 'predicate', 'object', 'source'}
TEMPLATE_FIELDS = {'predicate', 'label', 'ask_object', 'ask_subject', 'category', 'difficulty', 'min', 'max'}
for set_info in manifest:
    if 'facts' not in set_info:
        continue
    path = os.path.join('lists', str(set_info['facts']))
    if not os.path.isfile(os.path.join(ROOT, path)):
        errors.append(f'lists/manifest.json {set_info["id"]}: facts file not found: {path}')
        continue
    data = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    if not isinstance(data, dict):
        errors.append(f'{path}: must be one object {{ "entities", "facts", "templates" }} (the old plain list is gone)')
        continue
    for extra in sorted(set(data) - {'entities', 'facts', 'templates'}):
        errors.append(f'{path}: unknown part {extra!r} (entities / facts / templates)')
    is_comptia = str(set_info.get('subject', '')).startswith('comptia')

    entities = {}
    for i, e in enumerate(data.get('entities', [])):
        tag = f'{path} entity #{i + 1}'
        if not isinstance(e, dict):
            errors.append(f'{tag}: an entity must be {{"id": ..., "name": ..., "type": ...}}')
            continue
        eid = e.get('id')
        if not isinstance(eid, str) or not ENTITY_ID.match(eid):
            errors.append(f'{tag}: id must be lowercase words joined by "_": {eid!r}')
        elif eid in entities:
            errors.append(f'{tag}: id {eid!r} is used twice')
        else:
            entities[eid] = e
        if not isinstance(e.get('name'), str) or not e['name'].strip():
            errors.append(f'{tag}: "name" must be text')
        if e.get('type') not in TYPES:
            errors.append(f'{tag}: unknown type {e.get("type")!r} (use an answerType word)')
        if 'aliases' in e and not (isinstance(e['aliases'], list) and all(isinstance(a, str) and a.strip() for a in e['aliases'])):
            errors.append(f'{tag}: "aliases" must be a list of text')
        for extra in sorted(set(e) - ENTITY_FIELDS):
            errors.append(f'{tag}: unknown field {extra!r} (id / name / type / aliases)')

    templates = {}
    for i, tp in enumerate(data.get('templates', [])):
        tag = f'{path} template #{i + 1}'
        if not isinstance(tp, dict) or not isinstance(tp.get('predicate'), str) or not tp['predicate'].strip():
            errors.append(f'{tag}: a template must have a "predicate"')
            continue
        if tp['predicate'] in templates:
            errors.append(f'{tag}: predicate {tp["predicate"]!r} has two templates')
        templates[tp['predicate']] = tp
        for key in ('label', 'ask_object', 'ask_subject', 'category'):
            if key in tp and (not isinstance(tp[key], str) or not tp[key].strip()):
                errors.append(f'{tag}: "{key}" must be text when present')
        if 'difficulty' in tp and tp['difficulty'] not in DIFFICULTIES:
            errors.append(f'{tag}: unknown difficulty {tp["difficulty"]!r}')
        for key in ('min', 'max'):
            if key in tp and (isinstance(tp[key], bool) or not isinstance(tp[key], int)):
                errors.append(f'{tag}: "{key}" must be a whole number')
        for extra in sorted(set(tp) - TEMPLATE_FIELDS):
            errors.append(f'{tag}: unknown field {extra!r}')

    triples, labels = {}, {}
    for i, f in enumerate(data.get('facts', [])):
        tag = f'{path} fact #{i + 1}'
        if not isinstance(f, dict):
            errors.append(f'{tag}: a fact must be {{"subject": ..., "predicate": ..., "object": ...}}')
            continue
        subject, predicate, obj = f.get('subject'), f.get('predicate'), f.get('object')
        ok = True
        if subject not in entities:
            errors.append(f'{tag}: subject {subject!r} is not an entity id')
            ok = False
        if not isinstance(predicate, str) or not ENTITY_ID.match(predicate):
            errors.append(f'{tag}: predicate must be lowercase words joined by "_": {predicate!r}')
            ok = False
        if isinstance(obj, bool) or not isinstance(obj, (int, float, str)):
            errors.append(f'{tag}: "object" must be an entity id or a number: {obj!r}')
            ok = False
        elif isinstance(obj, str) and obj not in entities:
            hint = ' (write the number without quotes)' if re.fullmatch(r'\s*-?\d+(\.\d+)?\s*', obj) else ''
            errors.append(f'{tag}: object {obj!r} is not an entity id{hint}')
            ok = False
        if 'source' in f and (not isinstance(f['source'], str) or not f['source'].strip()):
            errors.append(f'{tag}: "source" must be text when present')
        if is_comptia and not COMPTIA_SOURCE.match(str(f.get('source', ''))):
            errors.append(f'{tag}: source {f.get("source")!r} is not like "220-1201 2.5"')
        for extra in sorted(set(f) - TRIPLE_FIELDS):
            errors.append(f'{tag}: unknown field {extra!r} (subject / predicate / object / source)')
        if not ok:
            continue
        key = (subject, predicate, obj)
        if key in triples:
            errors.append(f'{tag}: the same fact as #{triples[key]}')
        else:
            triples[key] = i + 1
        # The label as the game builds it (js/sets.js factsFromTriples).
        obj_text = str(obj) if not isinstance(obj, str) else str(entities[obj].get('name', '')).strip()
        tp = templates.get(predicate, {})
        label = tp['label'].strip() if isinstance(tp.get('label'), str) and tp['label'].strip() else None
        name = str(entities[subject].get('name', '')).strip()
        label = label.replace('{subject}', name).replace('{object}', obj_text) if label else f'{name} {predicate.replace("_", " ")}'
        if len(label) > 34:
            errors.append(f'{tag}: label must be 1-34 characters: {label!r}')
        elif label.lower() in labels and isinstance(obj, (int, float)):
            errors.append(f'{tag}: label {label!r} is already fact #{labels[label.lower()]}')
        elif isinstance(obj, (int, float)):
            labels[label.lower()] = i + 1

# A subject's dictionary (lists/dictionaries/<subject>.json, built by
# tools/build_dictionary.py) is optional; when there is one, every answer of
# the subject's sets must be in it, by its term or an "aka" spelling.
for subject, answers in answers_by_subject.items():
    path = os.path.join('lists', 'dictionaries', f'{subject}.json')
    if not subject or not os.path.exists(os.path.join(ROOT, path)):
        continue
    entries = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    spellings = {}
    for i, e in enumerate(entries):
        tag = f'{path} #{i + 1} {str(e.get("term", ""))[:50]!r}'
        if not isinstance(e.get('term'), str) or not e['term'].strip():
            errors.append(f'{tag}: missing "term"')
            continue
        if e.get('type') not in TYPES:
            errors.append(f'{tag}: unknown type {e.get("type")!r}')
        if e.get('type') == 'related' and not (str(e.get('of', '')).strip() and str(e.get('relation', '')).strip()):
            errors.append(f'{tag}: a "related" entry needs "of" and "relation" ("Pharaoh\'s daughter": of Pharaoh, relation daughter)')
        for flag in ('description', 'list', 'draft'):
            if flag in e and e[flag] is not True:
                errors.append(f'{tag}: "{flag}" must be true when present')
        for spelling in [e['term']] + list(e.get('aka') or []):
            k = (' '.join(spelling.split()).lower(), e.get('type'))
            if k in spellings:
                errors.append(f'{tag}: {spelling!r} is already entry #{spellings[k]}')
            spellings[k] = i + 1
    for answer, answer_type in sorted(answers - spellings.keys(), key=str):
        errors.append(f'{path}: no entry for answer {answer!r} ({answer_type}); run python3 tools/build_dictionary.py {subject}')

if errors:
    print(f'{len(errors)} problem(s):')
    for line in errors:
        print('  ' + line)
    sys.exit(1)
print('All question sets and dictionaries pass.')
