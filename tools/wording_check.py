"""Wording check: lists the questions of a set that share a run of words with
CompTIA's course books, so we can reword them. Our questions must be in our
own words, not lifted from the instructor guides (Timothy). The course books
are not in the repo; pass their PDFs (or pdftotext .txt files) on the command
line. Needs pdftotext (poppler-utils) for PDFs. Reports only; changes nothing.

    python3 tools/wording_check.py lists/comptia-aplus.json ~/ForClaude/CompTIA_A+_Core1_Lessons_Split/*.pdf
    python3 tools/wording_check.py lists/comptia-aplus.json BOOK.pdf --words 6

Exits 1 when any question shares a run of RUN_WORDS (default 5) words.
"""
import argparse, json, re, subprocess, sys

RUN_WORDS = 5  # shorter runs catch plain technical phrases everyone uses ("an IPv4 address")


def words(text):
    """The text's words, lower case, with punctuation dropped."""
    return re.findall(r"[a-z0-9+/'-]+", text.lower())


def book_text(path):
    """A PDF's text (via pdftotext -layout) or a .txt file's text."""
    if path.lower().endswith('.pdf'):
        return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, check=True).stdout
    return open(path, encoding='utf-8', errors='replace').read()


def runs(seq, n):
    """Every run of n words in seq, as strings."""
    return [' '.join(seq[i:i + n]) for i in range(len(seq) - n + 1)]


parser = argparse.ArgumentParser()
parser.add_argument('set_file')
parser.add_argument('books', nargs='+')
parser.add_argument('--words', type=int, default=RUN_WORDS)
args = parser.parse_args()

book_runs = set()
for book in args.books:
    book_runs.update(runs(words(book_text(book)), args.words))

found = 0
for i, q in enumerate(json.load(open(args.set_file, encoding='utf-8'))):
    shared = [r for r in runs(words(q.get('term', '')), args.words) if r in book_runs]
    if shared:
        found += 1
        print(f'#{i + 1} {q["term"]}\n    shares: ' + ' | '.join(dict.fromkeys(shared)))
print(f'{found} question(s) share a {args.words}-word run with the books.')
sys.exit(1 if found else 0)
