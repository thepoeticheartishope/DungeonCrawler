// The player's book on the room view (room view plan step D, moved out of
// roomview.js; book plan, 2026-10-28): the shut book tucked under his arm
// (holdBook, drawn by drawBook). The gun it once stood for went with combat
// (dungeon removal step C): there is nothing to aim at on the ship, so the
// book never opens. roomview.js hands over its picture first
// (startGunFrame). Reads nothing and changes nothing.

// The shut book tucked under his arm: K spine, C cover, P page edges.
const SHUT_BOOK = ['KCCCC', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCP', 'KCCCC'];
const TUCK_AHEAD = 2;     // how far ahead of his forearm's middle the shut book sits, in picture pixels
const BOOK_COLOURS = { P: '#dde8ea', L: '#7f9396', S: '#4a5759', E: '#a3aeb0', C: '#8a6440', K: '#5a3e26' };

let bctx = null; // the picture being drawn into

// roomview.js starts each frame here, before the player's stick man is drawn.
export function startGunFrame(picture) {
  bctx = picture;
}

// Points the book's drawing at `picture` for a while (roomview.js redraws
// the player into a mask), leaving the rest of the frame as it is.
export function drawBookInto(picture) {
  bctx = picture;
}

// Where the book sits for the player's stick man looking the way `ax`:
// shut and tucked under his arm, against his side between `elbow` and
// `hand`; the arm is drawn over it so his hand holds it from outside
// instead of vanishing into it (Timothy 2026-10-28). Gives back
// { at, flip, hand } (at: the book's top-left; flip: drawn mirrored,
// facing left; hand: where his hand is).
export function holdBook(ax, elbow, hand) {
  return tucked(elbow, hand, ax, 0);
}

// The shut book under his arm, `up` pixels higher as he lifts it to open
// it: its middle halfway down his forearm and TUCK_AHEAD pixels the way he
// looks (ax), so it shows in front of his body, its page edges forward.
function tucked(elbow, hand, ax, up) {
  const mid = [(elbow[0] + hand[0]) / 2 + ax * TUCK_AHEAD, (elbow[1] + hand[1]) / 2 - up];
  const at = [Math.round(mid[0] - SHUT_BOOK[0].length / 2), Math.round(mid[1] - SHUT_BOOK.length / 2)];
  return { at, flip: ax < 0, hand: [hand[0], hand[1] - up] };
}

// Draws the book holdBook gave back into the picture, shut under his arm.
export function drawBook(book) {
  const dot = (x, y, ch) => {
    bctx.fillStyle = BOOK_COLOURS[ch];
    bctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  SHUT_BOOK.forEach((row, r) => [...row].forEach((ch, c) => dot(book.at[0] + (book.flip ? row.length - 1 - c : c), book.at[1] + r, ch)));
}
