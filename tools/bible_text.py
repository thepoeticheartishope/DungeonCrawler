"""Shared helpers for the question-set tools: book names, citation parsing,
the KJV text (downloaded once), and ASV / WEB verses from bible-api.com
(cached). Nothing here is used by the game itself.

Downloads and caches live in tools/.cache/ (git-ignored).
"""
import json, os, re, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

# Public-domain KJV as JSON. Book names in this file are Portuguese; the verse
# text is the English KJV, so books are mapped by canonical order below.
KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'

NAMES = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel",
 "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
 "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
 "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke",
 "John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
 "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter",
 "2 Peter","1 John","2 John","3 John","Jude","Revelation"]

ALIASES = {n.lower(): n for n in NAMES}
ALIASES.update({
 'gen':'Genesis','ex':'Exodus','exod':'Exodus','lev':'Leviticus','num':'Numbers','deut':'Deuteronomy','josh':'Joshua',
 'judg':'Judges','1 sam':'1 Samuel','2 sam':'2 Samuel','1 chron':'1 Chronicles','2 chron':'2 Chronicles','neh':'Nehemiah',
 'est':'Esther','ps':'Psalms','psalm':'Psalms','prov':'Proverbs','eccl':'Ecclesiastes','ecc':'Ecclesiastes',
 'song':'Song of Solomon','song of sol':'Song of Solomon','song of songs':'Song of Solomon','is':'Isaiah','isa':'Isaiah',
 'jer':'Jeremiah','lam':'Lamentations','ezek':'Ezekiel','dan':'Daniel','hos':'Hosea','obad':'Obadiah','mic':'Micah',
 'nah':'Nahum','hab':'Habakkuk','zeph':'Zephaniah','hag':'Haggai','zech':'Zechariah','mal':'Malachi','matt':'Matthew',
 'rom':'Romans','1 cor':'1 Corinthians','2 cor':'2 Corinthians','gal':'Galatians','eph':'Ephesians','phil':'Philippians',
 'philipp':'Philippians','col':'Colossians','1 thess':'1 Thessalonians','2 thess':'2 Thessalonians','1 tim':'1 Timothy',
 '2 tim':'2 Timothy','philem':'Philemon','heb':'Hebrews','jas':'James','1 pet':'1 Peter','2 pet':'2 Peter','rev':'Revelation',
})

BIBLE_SETS = ['lists/bible-quiz-bowl.json', 'lists/bible-trivia.json']


def book_of(s):
    return ALIASES.get(re.sub(r'\s+', ' ', s.strip().lower().rstrip('.')))


def parse_refs(src):
    """'Gen 19:32; Matt 2:6' -> ([(book, chapter, [verses] or None)], [unparsed pieces])."""
    out, bad, book = [], [], None
    for part in (src or '').split(';'):
        part = part.strip()
        if not part:
            continue
        m = re.match(r'^((?:[123]\s)?[A-Za-z][A-Za-z .]*?)\s+(\d.*)$', part)
        if m and book_of(m.group(1)):
            book, rest = book_of(m.group(1)), m.group(2)
        elif re.match(r'^\d', part) and book:
            rest = part
        else:
            bad.append(part)
            continue
        rest = rest.replace(' ', '')
        mr = re.match(r'^(\d+)-(\d+)$', rest)
        m2 = re.match(r'^(\d+)(?::([\d,\-]+))?$', rest)
        if mr:
            out += [(book, c, None) for c in range(int(mr.group(1)), int(mr.group(2)) + 1)]
        elif m2:
            vs = []
            for seg in (m2.group(2) or '').split(','):
                if '-' in seg:
                    a, b = seg.split('-')[:2]
                    if a.isdigit() and b.isdigit():
                        vs += list(range(int(a), int(b) + 1))
                elif seg.isdigit():
                    vs.append(int(seg))
            out.append((book, int(m2.group(1)), vs or None))
        else:
            bad.append(part)
    return out, bad


_kjv = None
def kjv():
    """{book: [[verse text, ...] per chapter]} — downloaded to tools/.cache on first use."""
    global _kjv
    if _kjv is None:
        path = os.path.join(CACHE_DIR, 'kjv.json')
        if not os.path.exists(path):
            urllib.request.urlretrieve(KJV_URL, path)
        books = json.loads(open(path, 'rb').read().decode('utf-8-sig'))
        assert len(books) == 66
        _kjv = {NAMES[i]: [[re.sub(r'[{}]', '', v) for v in ch] for ch in b['chapters']] for i, b in enumerate(books)}
    return _kjv


def ref_errors(refs):
    text, errs = kjv(), []
    for book, ch, vs in refs:
        chs = text[book]
        if not 1 <= ch <= len(chs):
            errs.append(f'{book} has no chapter {ch} (has {len(chs)})')
            continue
        errs += [f'{book} {ch} has no verse {v} (has {len(chs[ch-1])})' for v in (vs or []) if not 1 <= v <= len(chs[ch-1])]
    return errs


def kjv_passage(refs, whole_chapter=False):
    text, out = kjv(), []
    for book, ch, vs in refs:
        chs = text[book]
        if not 1 <= ch <= len(chs):
            continue
        verses = chs[ch - 1]
        out += [verses[v - 1] for v in vs if v <= len(verses)] if vs and not whole_chapter else verses
    return ' '.join(out)


def api_refs(refs):
    """One bible-api.com request per (chapter[:verse range]) piece."""
    for book, ch, vs in refs:
        if vs:
            yield f'{book} {ch}:{min(vs)}-{max(vs)}' if len(vs) > 1 else f'{book} {ch}:{vs[0]}'
        else:
            yield f'{book} {ch}'


_cache_path = os.path.join(CACHE_DIR, 'translations.json')
_cache = json.load(open(_cache_path)) if os.path.exists(_cache_path) else {}
def fetch(ref, translation):
    """Verse text from bible-api.com ('asv', 'web', 'kjv', ...), cached. None if unreachable."""
    key = f'{translation}|{ref}'
    if key in _cache:
        return _cache[key]
    url = 'https://bible-api.com/' + urllib.parse.quote(ref) + '?translation=' + translation
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                _cache[key] = ' '.join(json.load(r)['text'].split())
            json.dump(_cache, open(_cache_path, 'w'))
            time.sleep(2.1)  # stay well inside the API's rate limit
            return _cache[key]
        except urllib.error.HTTPError as e:
            if e.code == 404:
                _cache[key] = ''
                return ''
            time.sleep(10 * (attempt + 1))
        except Exception:
            time.sleep(10 * (attempt + 1))
    return None


def passage(refs, translation):
    parts = [fetch(r, translation) for r in api_refs(refs)]
    return None if any(p is None for p in parts) else ' '.join(parts)


# ---- Word matching that ignores spelling differences between translations
VARIANTS = {'elisabeth':'elizabeth','elias':'elijah','eliseus':'elisha','jeremias':'jeremiah','esaias':'isaiah','noe':'noah',
 'zacharias':'zechariah','zachariah':'zechariah','barjona':'barjonah','jonas':'jonah','osee':'hosea','sion':'zion',
 'agar':'hagar','core':'korah','marcus':'mark','timotheus':'timothy','silvanus':'silas','jehovah':'lord','yahweh':'lord',
 'lapidoth':'lappidoth','juda':'judah','judas':'judah','colour':'color','colours':'colors','baptizer':'baptist',
 'artemis':'diana','nations':'gentiles'}
NUMBER_WORDS = {'1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine','10':'ten',
 '12':'twelve','13':'thirteen','14':'fourteen','20':'twenty','30':'thirty','40':'forty','50':'fifty','70':'seventy','1000':'thousand'}
STOP = set('the a an of and or to in on for his her their its was were is be by with as at from that this who what which '
           'he she it they them him not should all so could'.split())


def stem(w):
    w = VARIANTS.get(w, w)
    for suf in ('ings', 'ing', 'ers', 'ed', 'es', 's'):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[:-len(suf)]
    return w


def tokens(s):
    s = s.lower().replace('-', '').replace('’', "'")
    s = re.sub(r"'s\b", '', s)
    return [stem(w) for w in re.findall(r'[a-z0-9]+', s)]


def answer_keywords(answer):
    return [NUMBER_WORDS.get(w, w) for w in tokens(answer) if w not in STOP]
