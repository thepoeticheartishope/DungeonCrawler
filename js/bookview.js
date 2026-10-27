// The record book (record book plan, ideas/record-book-plan.md outside the
// repo): the ask screen (#askScreen) drawn as a slate book with a ringed
// spine, a dark page, and on its left edge the light tube (tubeart.js)
// showing the battery. gunpanels.js calls refreshBook() whenever it opens
// the ask screen. The clock is paused while the book is open, so the tube
// holds still here. Reads state only.

import { state } from './state.js';
import { LIGHT_BATTERY_MAX } from './config.js';
import { batteryInPlay } from './battery.js';
import { drawTube, TUBE_W, TUBE_H } from './tubeart.js';
import { t } from './text.js';

const els = {
  book: document.getElementById('askScreen'),
  strip: document.getElementById('bookStrip'),
  tube: document.getElementById('bookTube'),
  readout: document.getElementById('bookReadout'),
};
els.tube.width = TUBE_W;
els.tube.height = TUBE_H;
const tubeCtx = els.tube.getContext('2d');

// Redraws the book from state: its paper and the tube. The tube's strip
// is hidden while the battery is out of play (Comfort mode, DEV), as the
// HUD's battery is, and before the first floor (DEV -> Book paper).
export function refreshBook() {
  els.book.dataset.paper = state.settings.bookPaper;
  const inPlay = batteryInPlay() && Boolean(state.floor.light);
  els.strip.hidden = !inPlay;
  if (!inPlay) return;
  const light = state.floor.light;
  drawTube(tubeCtx, { charge: light.charge, max: LIGHT_BATTERY_MAX, lit: light.on });
  const left = Math.ceil(light.charge);
  els.readout.textContent = light.locked
    ? t('book.empty')
    : '#'.repeat(left) + '-'.repeat(Math.max(LIGHT_BATTERY_MAX - left, 0));
}
