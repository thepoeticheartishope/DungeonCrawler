"""Offline rules every bundled question set (and subject dictionary) must pass. Run it before every PR
that touches a question set; it exits non-zero on any problem.

    python3 tools/validate.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = {'name', 'relation', 'group', 'role', 'related', 'location', 'book', 'creature', 'object', 'theology', 'adjective', 'verb', 'number', 'verse', 'term'}
DIFFICULTIES = {'easy', 'medium', 'hard'}
# Keep in step with EXPLICIT_ANSWER_TERMS in js/config.js.
EXPLICIT = re.compile(r'\b(sex|sexual|rape[sd]?|incest\w*|adulter\w*|fornicat\w*|harlot\w*|whore\w*|prostitut\w*)\b', re.I)
SUBJECT = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
VERSE_ADDRESS = re.compile(r'^(\d )?[A-Za-z]+( of [A-Za-z]+)? \d+(:\d+(-\d+)?)?$')

errors = []
answers_by_subject = {}  # subject -> {(answer, answerType)}
manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
for set_info in manifest:
    path = os.path.join('lists', set_info['file'])
    data = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    subject = set_info.get('subject')
    if not isinstance(subject, str) or not SUBJECT.match(subject):
        errors.append(f'lists/manifest.json {set_info["id"]}: "subject" must be a lowercase name like "bible" or "comptia-aplus", got {subject!r}')
    is_bible = subject == 'bible'
    seen = {}
    subject_answers = answers_by_subject.setdefault(subject, set())
    for i, e in enumerate(data):
        subject_answers.add((' '.join(str(e.get('meaning', '')).split()).lower(), e.get('answerType')))
        tag = f'{path} #{i + 1}'
        def err(msg): errors.append(f'{tag}: {msg} | {str(e.get("term", ""))[:70]}')
        for field in ('term', 'meaning'):
            if not isinstance(e.get(field), str) or not e[field].strip():
                err(f'missing "{field}"')
        if e.get('answerType') not in TYPES:
            err(f'unknown answerType {e.get("answerType")!r}')
        if 'difficulty' in e and e['difficulty'] not in DIFFICULTIES:
            err(f'unknown difficulty {e["difficulty"]!r}')
        key = str(e.get('term', '')).strip().lower()
        if key in seen:
            err(f'same question text as #{seen[key]}')
        seen[key] = i + 1
        answers = [e.get('meaning', '')] + list(e.get('options') or [])
        if any(EXPLICIT.search(a or '') for a in answers):
            err('explicit term in an answer or option')
        if 'options' in e:
            if not isinstance(e['options'], list) or not 2 <= len(e['options']) <= 4:
                err('"options" must list 2 to 4 answers')
            elif e.get('meaning') not in e['options']:
                err('"options" must include the correct answer')
        if e.get('answerType') == 'verse' and not VERSE_ADDRESS.match(e.get('meaning', '')):
            err(f'verse answer {e.get("meaning")!r} is not an address like "Micah 1:1"')
        if 'draft' in e and e['draft'] is not True:
            err('"draft" must be true when present')
        if is_bible:
            if not isinstance(e.get('fact'), bool):
                err('missing "fact": true/false (run python3 tools/fact_check.py)')
            elif e['fact'] is False and not str(e.get('factNote', '')).strip():
                err('"fact": false needs a "factNote" saying why')

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
