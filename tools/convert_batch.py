"""One command per step for turning a photographed card batch into questions.

    python3 tools/convert_batch.py photos FRONT.jpg BACK.jpg
        Have these photos been converted before? (compares file hashes with
        tools/batches.json, so a re-sent photo under a new name is caught)

    python3 tools/convert_batch.py add BATCH.json --front FRONT.jpg --back BACK.jpg [--set quiz-bowl]
        BATCH.json is a list of new entries (term, meaning, category,
        difficulty, source, answerType, draft) transcribed from the photos.
        Refuses exact duplicates, lists likely near-duplicates to judge,
        appends the rest, records the batch, bumps CACHE_NAME, then runs check.

    python3 tools/convert_batch.py check
        For the questions that are new compared with origin/main: the KJV
        check, fact labels (tools/fact_check.py) with anything still needing
        review, and tools/validate.py. Re-run after fixing or reviewing.

    python3 tools/convert_batch.py pr NUMBER
        Record the PR number on the latest batch in tools/batches.json.
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from bible_text import tokens

BATCHES = os.path.join(HERE, 'batches.json')
PHOTO_ROOT = os.path.expanduser('~/ForClaude/For Quiz Set')
SETS = {'quiz-bowl': 'lists/bible-quiz-bowl.json', 'trivia': 'lists/bible-trivia.json'}
SW = 'service-worker.js'
BASE = os.environ.get('CONVERT_BASE', 'origin/main')  # questions on this ref count as already there
STOP = set('the a an of and or to in on for his her their its was were is be by with as at from that this who what '
           'which did does do how many name following say said says bible book'.split())


def load(path, default=None):
    full = os.path.join(ROOT, path)
    return json.load(open(full, encoding='utf-8')) if os.path.exists(full) else default


def save(path, data):
    open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(json.dumps(data, indent=2, ensure_ascii=False))


def on_main(path):
    try:
        return subprocess.run(['git', 'show', f'{BASE}:{path}'], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None


def md5(path):
    return hashlib.md5(open(path, 'rb').read()).hexdigest()


def rel_photo(path):
    full = os.path.abspath(os.path.expanduser(path))
    return os.path.relpath(full, PHOTO_ROOT) if full.startswith(PHOTO_ROOT + os.sep) else full


def words(s):
    return {w for w in tokens(s) if w not in STOP}


def norm(s):
    return re.sub(r'^(the|a|an) ', '', s.strip().lower().rstrip('.'))


def mentions(text, phrase):
    return re.search(r'\b' + re.escape(phrase) + r'\b', text.lower()) is not None


# ---- photos
def seen_photos():
    out = {}
    for b in load('tools/batches.json', []):
        for side in ('front', 'back'):
            out.setdefault(b['md5'][side], []).append(f"{b[side]} ({side}, PR #{b.get('pr') or '?'})")
    return out


def cmd_photos(a):
    known, fresh = seen_photos(), True
    for p in (a.front, a.back):
        hits = known.get(md5(p))
        print(f'{rel_photo(p)}: ' + ('ALREADY CONVERTED as ' + '; '.join(hits) if hits else 'new'))
        fresh &= not hits
    return 0 if fresh else 1


# ---- add
def cmd_add(a):
    set_path = SETS[a.set]
    batch = json.load(open(a.batch, encoding='utf-8'))
    data = load(set_path)
    if cmd_photos(a):
        print('Stopping: photos were converted before (pass --force to add anyway).')
        if not a.force:
            return 1
    have = {e['term'].strip().lower(): i + 1 for i, e in enumerate(data)}
    exact = [e['term'] for e in batch if e['term'].strip().lower() in have]
    seen, self_dups = set(), []
    for e in batch:
        k = e['term'].strip().lower()
        if k in seen:
            self_dups.append(e['term'])
        seen.add(k)
    if exact or self_dups:
        for t in exact:
            print(f'EXACT DUPLICATE of {os.path.basename(set_path)} #{have[t.strip().lower()]}: {t}')
        for t in self_dups:
            print(f'REPEATED IN BATCH: {t}')
        return 1

    # Near-duplicates: same answer with overlapping wording, very similar
    # wording, or a reverse pair (each answer named in the other's question).
    existing = [(i + 1, e, words(e['term']), norm(e['meaning'])) for i, e in enumerate(data)]
    flagged = 0
    for e in batch:
        w, ans = words(e['term']), norm(e['meaning'])
        for num, old, ow, oans in existing:
            j = len(w & ow) / max(1, len(w | ow))
            same_answer = ans == oans
            reverse = bool(ans and oans and mentions(old['term'], ans) and mentions(e['term'], oans))
            if (same_answer and j >= 0.25) or j >= 0.6 or reverse:
                why = 'same answer' if same_answer else 'reverse pair' if reverse else 'similar wording'
                print(f'  NEAR ({why}, {j:.2f}) #{num}: {old["term"][:80]} => {old["meaning"]}\n'
                      f'      new: {e["term"][:80]} => {e["meaning"]}')
                flagged += 1
    print(f'{flagged} near-duplicate candidate(s) to judge (policy: skip only true duplicates).')

    data += batch
    save(set_path, data)
    batches = load('tools/batches.json', [])
    batches.append({'date': datetime.date.today().isoformat(), 'front': rel_photo(a.front), 'back': rel_photo(a.back),
                    'md5': {'front': md5(a.front), 'back': md5(a.back)}, 'set': set_path,
                    'added': len(batch), 'pr': None})
    save('tools/batches.json', batches)
    print(f'Added {len(batch)} to {set_path} and recorded the batch.')
    bump_cache()
    return cmd_check(a)


def bump_cache():
    sw = open(os.path.join(ROOT, SW), encoding='utf-8').read()
    main_sw = on_main(SW) or ''
    m = re.search(r"const CACHE_NAME = '([^']*?)(\d+)';", sw)
    mm = re.search(r"const CACHE_NAME = '([^']*?)(\d+)';", main_sw)
    if m and mm and m.group(0) == mm.group(0):
        new = f"const CACHE_NAME = '{m.group(1)}{int(m.group(2)) + 1}';"
        open(os.path.join(ROOT, SW), 'w', encoding='utf-8').write(sw.replace(m.group(0), new))
        print(f'CACHE_NAME bumped: {new}')
    else:
        print('CACHE_NAME already differs from origin/main; left as is.')


# ---- check
def new_indexes():
    """{set path: {1-based index of each question not on origin/main}}"""
    out = {}
    for path in SETS.values():
        main = on_main(path)
        old = {e['term'] for e in json.loads(main)} if main else set()
        out[path] = {i + 1 for i, e in enumerate(load(path, [])) if e['term'] not in old}
    return out


def run(script, *args):
    return subprocess.run([sys.executable, os.path.join(HERE, script), *args], cwd=ROOT,
                          capture_output=True, text=True)


def filtered(text, new):
    """Keep report lines (and their indented continuation lines) about new
    questions, with each '== section: N' header recounted for just those."""
    out, keep, header = [], False, None
    for line in text.splitlines():
        m = re.search(r'(bible-[\w-]+\.json) #(\d+)', line)
        if line.startswith('==') or 'NEEDS REVIEW' in line:
            header = len(out)
            out.append(re.sub(r': \d+$', ': 0', line) if line.startswith('==') else line)
            keep = False
        elif m:
            keep = int(m.group(2)) in new.get('lists/' + m.group(1), ())
            if keep:
                out.append(line)
                if header is not None and out[header].startswith('=='):
                    name, n = out[header].rsplit(': ', 1)
                    out[header] = f'{name}: {int(n) + 1}'
        elif keep and line.startswith('      '):
            out.append(line)
    return out


def cmd_check(a=None):
    new = new_indexes()
    total = sum(len(v) for v in new.values())
    print(f'\n### {total} question(s) new compared with {BASE}')
    if not total:
        return 0
    print('\n### KJV check (new questions only; "answer not in cited passage" is advisory)')
    print('\n'.join(filtered(run('kjv_check.py').stdout, new)))
    print('\n### Fact labels')
    fc = run('fact_check.py')
    if fc.returncode:
        print(fc.stdout + fc.stderr)
        return 1
    print(fc.stdout.splitlines()[0])
    review = filtered(fc.stdout, new)
    review = [l for l in review if not l.startswith('==') and 'NEEDS REVIEW' not in l]
    print(f'Needing review in this batch: {sum(1 for l in review if "auto=" in l)}'
          + (' (add each to tools/fact_review.json, then re-run check)' if review else ''))
    print('\n'.join(review))
    for path, idx in new.items():
        if idx:
            data = load(path)
            batch = [data[i - 1] for i in sorted(idx)]
            print(f'{path}: {sum(e.get("fact") is True for e in batch)} fact / '
                  f'{sum(e.get("fact") is False for e in batch)} not fact, '
                  f'{sum(1 for e in batch if e.get("draft"))} draft')
    print('\n### validate')
    v = run('validate.py')
    print((v.stdout + v.stderr).strip())
    return v.returncode


def cmd_pr(a):
    batches = load('tools/batches.json', [])
    batches[-1]['pr'] = a.number
    save('tools/batches.json', batches)
    print(f"Recorded PR #{a.number} for {batches[-1]['front']} / {batches[-1]['back']}")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('photos'); s.add_argument('front'); s.add_argument('back')
    s = sub.add_parser('add'); s.add_argument('batch'); s.add_argument('--front', required=True)
    s.add_argument('--back', required=True); s.add_argument('--set', choices=SETS, default='quiz-bowl')
    s.add_argument('--force', action='store_true')
    sub.add_parser('check')
    s = sub.add_parser('pr'); s.add_argument('number', type=int)
    a = p.parse_args()
    sys.exit({'photos': cmd_photos, 'add': cmd_add, 'check': cmd_check, 'pr': cmd_pr}[a.cmd](a))


if __name__ == '__main__':
    main()
