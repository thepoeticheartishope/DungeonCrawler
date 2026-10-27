// The record book's page turn (record book plan step B): a page of the
// book (bookview.js) turns sideways over the spine, the way the Pocket
// Inventory pack's page flip does, drawn with CSS on copies of the page. A
// dog-ear lifts at the bottom-right corner, then the sheet turns over
// toward the spine in BOOK.frames stepped frames over BOOK.turnMs. Taps
// and keys wait while a page is turning, so nothing lands on the page going
// away. Reduced motion swaps the page with no turn. gunpanels.js
// turnAskPage() calls it.

import { BOOK } from './config.js';

let turning = false;

// Which turn frame `p` (0..1 of the turn's time) shows, as 0..1 in
// `frames` even steps: 0 at the start, 1 on the last frame.
export function turnFrame(p, frames) {
  const step = Math.min(frames - 1, Math.floor(Math.max(0, p) * frames));
  return step / (frames - 1);
}

// Whether a page is turning now.
export function pageTurning() {
  return turning;
}

// Turns `pageEl` (a .book-page) to whatever `change()` puts on it: forward
// (`dir` 1, the old page lifts away to the left) or back (-1, the new page
// comes over from the left). With reduced motion, or a turn already going,
// it just changes.
export function turnPage(pageEl, change, dir = 1) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || turning || !pageEl.offsetWidth) { change(); return; }
  const oldPage = copyPage(pageEl);
  change();
  const turn = document.createElement('div');
  turn.className = 'page-turn';
  turn.style.left = pageEl.offsetLeft + 'px';
  turn.style.top = pageEl.offsetTop + 'px';
  turn.style.width = pageEl.offsetWidth + 'px';
  turn.style.height = pageEl.offsetHeight + 'px';
  // Forward, the new page is the live one under the old copy. Back, the
  // old copy lies under and a copy of the new page comes over it.
  const over = dir > 0 ? oldPage : copyPage(pageEl);
  if (dir < 0) turn.appendChild(oldPage);
  const fold = document.createElement('div');
  fold.className = 'page-turn-shadow';
  const flap = document.createElement('div');
  flap.className = 'page-turn-flap';
  turn.append(over, fold, flap);
  pageEl.parentElement.appendChild(turn);
  over.scrollTop = dir > 0 ? oldPage.dataset.scroll : pageEl.scrollTop;
  if (dir < 0) oldPage.scrollTop = oldPage.dataset.scroll;

  turning = true;
  addEventListener('keydown', holdKey, true);
  const start = performance.now();
  const w = turn.offsetWidth, h = turn.offsetHeight;
  const frame = (now) => {
    const p = (now - start) / BOOK.turnMs;
    if (p >= 1) { finish(turn); return; }
    const t = turnFrame(p, BOOK.frames);
    drawTurn(over, fold, flap, dir > 0 ? t : 1 - t, w, h);
    requestAnimationFrame(frame);
  };
  drawTurn(over, fold, flap, dir > 0 ? 0 : 1, w, h);
  requestAnimationFrame(frame);
}

// A still copy of the page as it is now, for the turn to move: no ids
// (they stay the live page's), hidden from screen readers and inert.
function copyPage(pageEl) {
  const copy = pageEl.cloneNode(true);
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.removeAttribute('id');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  copy.classList.add('page-turn-copy');
  copy.dataset.scroll = pageEl.scrollTop;
  return copy;
}

// One frame of the turn at `t` (0 = the page still flat, 1 = turned
// away): `over` is clipped to what is left of the page on top, `flap`
// is the back of the sheet lifting, `fold` the shadow it casts on the page
// under it. `w` and `h` are the page's size in px.
function drawTurn(over, fold, flap, t, w, h) {
  const ear = BOOK.dogEarShare;
  if (t < ear) {
    const c = Math.round(w * (0.04 + (t / ear) * 0.2));
    over.style.clipPath = `polygon(0 0, ${w}px 0, ${w}px ${h - c}px, ${w - c}px ${h}px, 0 ${h}px)`;
    flap.style.clipPath = `polygon(${w - c}px ${h}px, ${w}px ${h - c}px, ${w - c}px ${h - c}px)`;
    flap.style.left = '0px';
    flap.style.width = w + 'px';
    flap.classList.remove('edge');
    fold.style.width = '0px';
    return;
  }
  const u = (t - ear) / (1 - ear);
  const xf = Math.round(w - u * w);
  const left = Math.max(0, Math.round(xf - (w - xf) * BOOK.flapLean));
  over.style.clipPath = `inset(0 ${w - xf}px 0 0)`;
  flap.style.clipPath = 'none';
  flap.style.left = left + 'px';
  flap.style.width = (xf - left) + 'px';
  flap.classList.toggle('edge', left > 0);
  fold.style.left = xf + 'px';
  fold.style.width = Math.min(8, w - xf) + 'px';
}

// The turn is over: the copies go and input comes back.
function finish(turn) {
  turn.remove();
  turning = false;
  removeEventListener('keydown', holdKey, true);
}

// A key pressed while a page turns does nothing.
function holdKey(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
}
