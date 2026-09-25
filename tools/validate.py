"""Offline rules every bundled question set must pass. Runs on every PR
(.github/workflows/validate.yml) and exits non-zero on any problem.

    python3 tools/validate.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = {'name', 'location', 'book', 'creature', 'object', 'theology', 'adjective', 'verb', 'number', 'verse', 'term'}
DIFFICULTIES = {'easy', 'medium', 'hard'}
# Keep in step with EXPLICIT_ANSWER_TERMS in js/config.js.
EXPLICIT = re.compile(r'\b(sex|sexual|rape[sd]?|incest\w*|adulter\w*|fornicat\w*|harlot\w*|whore\w*|prostitut\w*)\b', re.I)
VERSE_ADDRESS = re.compile(r'^(\d )?[A-Za-z]+( of [A-Za-z]+)? \d+(:\d+(-\d+)?)?$')

errors = []
manifest = json.load(open(os.path.join(ROOT, 'lists', 'manifest.json'), encoding='utf-8'))
for set_info in manifest:
    path = os.path.join('lists', set_info['file'])
    data = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
    is_bible = set_info['id'].startswith('bible')
    seen = {}
    for i, e in enumerate(data):
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

if errors:
    print(f'{len(errors)} problem(s):')
    for line in errors:
        print('  ' + line)
    sys.exit(1)
print('All question sets pass.')
