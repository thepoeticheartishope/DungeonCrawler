// Random picks shared by every rule that needs one: a shuffled copy of a
// list and a whole number in a range. Both use Math.random, so tests that
// fix it get the same floor every time. No DOM access here.

// A shuffled copy of `list` (Fisher-Yates); the list itself is untouched.
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A whole number from lo to hi, both ends included.
export function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
