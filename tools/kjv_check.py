"""Check Bible questions against the KJV text (the cards were written for it).

    python3 tools/kjv_check.py

Reports, without changing anything:
  - citations that point to a book/chapter/verse that doesn't exist
  - sources it can't read as a citation (fine for notes like "1 & 2 Kings")
  - "Which verse says…?" quotes that don't match their answer verse
  - other quoted phrases not found in the cited verses
  - one-word answers not found in the cited passage — many of these are
    expected (authors, counts, modern words for KJV ones like tumors /
    emerods), so read them as prompts to double-check, not errors.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bible_text import BIBLE_SETS, parse_refs, ref_errors, kjv_passage, tokens

def coverage(quote, text):
    q, t = tokens(quote), set(tokens(text))
    return sum(1 for w in q if w in t) / max(1, len(q))

def quotes(term):
    return re.findall(r'["“]([^"”]{12,})["”]', term)

sections = {k: [] for k in ['invalid citation', 'unreadable source', 'verse quote mismatch',
                            'quote not in cited verses', 'answer not in cited passage']}
for path in BIBLE_SETS:
    for i, e in enumerate(json.load(open(path, encoding='utf-8'))):
        tag = f'{os.path.basename(path)} #{i + 1}'
        refs, bad = parse_refs(e.get('source'))
        sections['unreadable source'] += [f'{tag} [{e.get("source")}] "{b}"' for b in bad]
        sections['invalid citation'] += [f'{tag} [{e.get("source")}] {err}' for err in ref_errors(refs)]
        if e.get('answerType') == 'verse':
            arefs, abad = parse_refs(e['meaning'])
            errs = ref_errors(arefs)
            if abad or errs:
                sections['invalid citation'].append(f'{tag} answer "{e["meaning"]}" {errs or abad}')
            elif quotes(e['term']) and coverage(quotes(e['term'])[0], kjv_passage(arefs)) < 0.9:
                sections['verse quote mismatch'].append(
                    f'{tag} {e["meaning"]}: "{quotes(e["term"])[0][:70]}"\n      KJV: {kjv_passage(arefs)[:160]}')
        elif refs:
            for q in quotes(e['term']):
                if len(tokens(q)) >= 4 and coverage(q, kjv_passage(refs)) < 0.75:
                    sections['quote not in cited verses'].append(f'{tag} [{e.get("source")}] "{q[:70]}"')
        if refs and e.get('answerType') not in ('verse', 'number', 'book') and not e.get('draft'):
            a = re.sub(r'^(the|a|an) ', '', re.sub(r"'s$", '', e['meaning'].strip().rstrip('.')).lower())
            if len(a.split()) == 1 and len(a) > 2 and tokens(a) and tokens(a)[0] not in set(tokens(kjv_passage(refs, True))):
                sections['answer not in cited passage'].append(f'{tag} [{e.get("source")}] "{e["meaning"]}" | {e["term"][:70]}')

for name, lines in sections.items():
    print(f'\n== {name}: {len(lines)}')
    for line in lines:
        print('  ' + line)
