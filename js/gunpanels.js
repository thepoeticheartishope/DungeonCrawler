// The gun's panels (gun plan step 5): the reload choices and the question
// (the one question panel from questionview.js, moved here) on the ask
// screen, which takes the map's and the controls' place, like the battle
// screen (a relay's question shows there too); and the dial (kill or
// maim plan step B; the Struggle's too), a veil over the map that fades in
// with READY in its middle, then the circle (drawn by dialview.js), and
// after a stop holds the result and fades out. One shows at a time.
// main.js opens them and passes in the actions they call (pickReload,
// cancelReload, readyBar, backBar, stopBar, stopStruggle), like
// exchangeview.js. What a reload offers is gun.js reloadOffers(); what a
// stopped dial does is gun.js settleShot() (or settleStruggle()); this
// only draws and listens.

import { TIMER_SECONDS, DIAL_FADE_IN_MS, DIAL_FADE_OUT_MS, DIAL_RESULT_MS } from './config.js';
import { initDialView, sizeDial, startDial, stopDial, dialRunning, showDialResult, clearDial } from './dialview.js';
import { maxWager } from './modifiers.js';
import { escapeHtml } from './quiz.js';
import { mountQuestionPanel } from './questionview.js';
import { t } from './text.js';
import { chargerShown, hideCharger } from './chargerview.js';
import { refreshBook, bookAsks, bookReading, bookTab, showAskTab } from './bookview.js';
import { turnPage } from './pageturn.js';

const els = {};
let actions = {};
// What the dial is for while it shows: 'aim' (a shot's dial) or 'struggle'.
let barMode = null;
// The fade-out's timers (view-only, like the dial's clock).
let fadeTimers = [];

// Looks up the panels and hooks up their buttons and keys: 1-3 pick a
// reload, Escape cancels it; Space or F starts the dial at READY and stops
// it once it runs, as does the SELECT button (main.js, via pressBar), and
// a tap on READY starts it; Escape or BACK before READY puts the gun down
// (backBar). A tap on the running dial does nothing: a finger landing
// somewhere new each time stopped it unevenly and hid the marker. Call
// once, from main.js.
export function initGunPanels({ pickReload, cancelReload, readyBar, backBar, stopBar, stopStruggle }) {
  actions = { pickReload, cancelReload, readyBar, backBar, stopBar, stopStruggle };
  els.reload = document.getElementById('reloadPanel');
  els.reloadTitle = document.getElementById('reloadTitle');
  els.reloadChoices = document.getElementById('reloadChoices');
  els.reloadCancel = document.getElementById('reloadCancel');
  els.room = document.getElementById('roomScreen');
  els.ask = document.getElementById('askScreen');
  els.askTitle = document.getElementById('askTitle');
  els.question = document.getElementById('askQuestionPanel');
  els.questionSlot = document.getElementById('askQuestionSlot');
  els.page = document.getElementById('bookPage');
  els.close = document.getElementById('bookClose');
  els.aim = document.getElementById('aimPanel');
  els.stage = document.getElementById('dialStage');
  els.canvas = document.getElementById('dialCanvas');
  els.buttons = document.getElementById('dialButtons');
  els.ready = document.getElementById('dialReady');
  els.back = document.getElementById('dialBack');
  els.prompt = document.getElementById('aimPrompt');
  els.legend = document.getElementById('damageLegend');
  initDialView(els.canvas);

  els.ready.addEventListener('click', () => pressBar());
  els.back.addEventListener('click', () => actions.backBar());
  addEventListener('resize', () => { if (!els.aim.hidden || els.aim.classList.contains('fading')) fitDial(); });
  els.reloadCancel.addEventListener('click', () => actions.cancelReload());
  document.addEventListener('keydown', (e) => {
    const shown = mapPanelShown();
    if ((shown === 'aim' || shown === 'struggle') && (e.key === ' ' || e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      pressBar();
    } else if (shown === 'aim' && !dialRunning() && e.key === 'Escape') {
      e.preventDefault();
      actions.backBar();
    } else if (shown === 'reload' && e.key === 'Escape') {
      e.preventDefault();
      actions.cancelReload();
    } else if (shown === 'reload' && bookTab() === 'ask') {
      const btn = els.reloadChoices.children[['1', '2', '3'].indexOf(e.key)];
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
}

// Which panel shows: 'reload' or 'question' (on the ask screen), 'aim'
// (a shot's dial over the map), 'struggle' (the same veil as the
// Struggle dial), 'charger' (CHARGE.SYS over the map, chargerview.js),
// 'book' (the record book read from the map for LOG or MAP, bookview.js),
// or null. A dial fading out after its stop no longer counts: the player
// can move on.
export function mapPanelShown() {
  if (!els.reload) return null;
  if (!els.reload.hidden) return 'reload';
  if (!els.question.hidden) return 'question';
  if (!els.aim.hidden) return barMode;
  if (chargerShown()) return 'charger';
  if (bookReading()) return 'book';
  return null;
}

// Shows only `panel` (or none). The reload choices and the question take
// the ask screen in place of the map and the controls, drawn as the record
// book (bookview.js), refreshed each time it opens. Any of them ends a
// book read from the map.
function showOnly(panel) {
  [els.reload, els.question, els.aim].forEach(p => { p.hidden = p !== panel; });
  const asking = panel === els.reload || panel === els.question;
  if (panel !== els.question && heldClose) dropHeld();
  bookAsks(asking);
  els.ask.hidden = !asking;
  els.room.classList.toggle('asking', asking);
  if (asking) refreshBook();
}

// The reload choices from gun.js reloadOffers(): the category the reload
// asks from, then each offer, plain to hardest, with its modifier tags and,
// when less fits than it gives, how much does.
export function showReloadPanel({ category, offers }) {
  els.askTitle.textContent = t('ask.title.reload');
  els.reloadTitle.textContent = category && category.label
    ? t('gun.reload.title', { category: category.label })
    : t('gun.reload.titlePlain');
  els.reloadChoices.innerHTML = '';
  offers.forEach((offer, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span>' +
      '<span class="choice-label">' + escapeHtml(t('gun.reload.offer', { energy: offer.energy })) + '</span>' +
      offer.modifiers.map(mod =>
        '<span class="mod-tag" title="' + escapeHtml(t('mod.' + mod) + ': ' + t('mod.' + mod + '.tip', { max: maxWager(), secs: TIMER_SECONDS })) + '">' +
          escapeHtml(t('mod.' + mod + '.tag')) + '</span>').join('') +
      (offer.room < offer.energy ? '<span class="reload-room">' + escapeHtml(t('gun.reload.room', { room: offer.room })) + '</span>' : '');
    btn.addEventListener('click', () => actions.pickReload(offer, category));
    els.reloadChoices.appendChild(btn);
  });
  showOnly(els.reload);
  if (els.reloadChoices.firstChild) els.reloadChoices.firstChild.focus();
}

// Moves the question panel to the ask screen and shows it, titled for
// `kind` ('reload' or 'relay'). `answers` are the question panel's
// handlers (questionview.js mountQuestionPanel): what a right or wrong
// answer does here.
export function showQuestionScreen(answers, kind) {
  els.askTitle.textContent = t('ask.title.' + kind);
  mountQuestionPanel(els.questionSlot, answers);
  showOnly(els.question);
}

// Turns the book's page (record book plan step B, pageturn.js) to what
// `change` puts on the ask screen: a reload's offers turning to its
// question. `dir` 1 turns forward, -1 back.
export function turnAskPage(change, dir = 1) {
  turnPage(els.page, change, dir);
}

// What closes the book once an answer is in (holdAskScreen), or null.
let heldClose = null;

// Holds the ask screen open once an answer is in (record book plan step
// C), so the struck pick and the written answer can be read: a tap on the
// book or any key closes it and runs `onClose` (which settles the answer
// and closes the ask screen). The clock stays paused until then. The
// listeners go on after this event is done, so the tap or key that gave
// the answer doesn't close it too.
export function holdAskScreen(onClose) {
  showAskTab();
  heldClose = onClose;
  els.close.hidden = false;
  setTimeout(() => {
    if (heldClose !== onClose) return;
    els.ask.addEventListener('click', closeHeldAsk);
    addEventListener('keydown', closeOnKey, true);
  }, 0);
}

// Whether the ask screen is held open after an answer.
export function askHeld() {
  return heldClose !== null;
}

// Closes the book held open after an answer (a tap, a key, DEV -> Auto-win).
export function closeHeldAsk() {
  const close = heldClose;
  if (!close) return;
  dropHeld();
  close();
}

// Lets go of a held book without closing it: closeHeldAsk, or the ask
// screen closed some other way (showOnly), so the next answer isn't stuck.
function dropHeld() {
  heldClose = null;
  els.close.hidden = true;
  els.ask.removeEventListener('click', closeHeldAsk);
  removeEventListener('keydown', closeOnKey, true);
}

// A key closes the held book, and goes no further (it would answer the
// next question or move the player otherwise). Shift and the like alone
// don't count.
function closeOnKey(e) {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closeHeldAsk();
}

// Opens the dial for the landed shot waiting in state.battle.aim, at
// READY (kill or maim plan): the veil fades in with READY and BACK in its
// middle and nothing of the dial, so the player can settle but not study
// it. A shot in the dark (gun.js fireDark) says which way it is harder.
export function showDamageBar(aim) {
  openReady('aim', aim.dark ? t('gun.dial.dark.' + aim.dark) + ' · ' + t('gun.dial.ready') : t('gun.dial.ready'));
}

// READY was pressed (gun.js readyShot): the circle shows with its zones,
// each marked with what it does, a key for the kinds on it, and the marker
// already going round (the kind's traits with it, dialview.js). At its lap
// limit it stops by itself.
export function runDamageBar(aim) {
  const m = aim.target;
  const hits = m && m.guard ? ['guard'] : m && m.downed ? ['finish'] : ['kill', 'maim'];
  const harms = ['jam', 'loud', 'lunge'].filter(harm => aim.zones.some(z => z.harm === harm));
  els.legend.innerHTML = '';
  [...hits, ...harms, 'miss'].forEach(kind => {
    const span = document.createElement('span');
    span.textContent = t('gun.dial.key.' + kind);
    els.legend.appendChild(span);
  });
  els.legend.hidden = false;
  els.prompt.textContent = aim.dark ? t('gun.dial.dark.' + aim.dark) : t('gun.dial.prompt');
  runDial({ zones: aim.zones, lapMs: aim.lapMs, lapLimit: aim.lapLimit, traits: aim.traits, darkArc: aim.darkArc, guard: !!(m && m.guard) });
}

// Opens the Struggle dial on the same veil at READY (no BACK: it already
// has the player). `count` above 1 shows in the prompt, so the player
// sees why this one is harder. A minion has reached the player with no
// energy left (gun.js struggleDial).
export function showStruggleBar({ count }) {
  openReady('struggle', count > 1 ? t('gun.struggle.readyAgain', { count }) : t('gun.struggle.ready'));
}

// READY on the Struggle dial (gun.js readyStruggle): its one zone shows
// and the marker starts, one lap in `lapMs`.
export function runStruggleBar({ zone, lapMs, count }) {
  els.prompt.textContent = count > 1 ? t('gun.struggle.promptAgain', { count }) : t('gun.struggle.prompt');
  runDial({ zones: [zone], lapMs, lapLimit: 0, struggle: true });
}

// Shows the veil for `mode` at READY, fading in: READY (and BACK for a
// shot) in its middle, `prompt` over it.
function openReady(mode, prompt) {
  endFade();
  clearDial();
  els.legend.hidden = true;
  els.canvas.hidden = true;
  els.buttons.hidden = false;
  els.back.hidden = mode === 'struggle';
  els.prompt.textContent = prompt;
  barMode = mode;
  els.canvas.setAttribute('aria-label', t(mode === 'struggle' ? 'gun.struggle.label' : 'gun.dial.label'));
  els.aim.classList.toggle('struggle', mode === 'struggle');
  els.aim.classList.remove('on');
  els.aim.style.setProperty('--dial-fade', DIAL_FADE_IN_MS + 'ms');
  showOnly(els.aim);
  void els.aim.offsetWidth;
  els.aim.classList.add('on');
  els.ready.focus();
}

// Swaps READY for the circle and starts its marker.
function runDial(spec) {
  els.buttons.hidden = true;
  els.canvas.hidden = false;
  fitDial();
  startDial(spec, stopSweep);
}

// Sizes the circle to the room the veil leaves it.
function fitDial() {
  sizeDial(els.stage.clientWidth, els.stage.clientHeight);
}

// SELECT, Space, F or a tap on READY: at READY it starts the dial (main.js
// readyBar runs the rule, then runDamageBar or runStruggleBar); running,
// it stops it.
export function pressBar() {
  if (dialRunning()) stopSweep();
  else if (!els.buttons.hidden) actions.readyBar(barMode);
}

// The dial stopped (the player, or its lap limit): the position in the
// zones' frame (0 to 1) goes to stopBar, or to stopStruggle for the
// Struggle dial. Only once per dial.
function stopSweep() {
  const position = stopDial();
  if (position === null) return;
  if (barMode === 'struggle') actions.stopStruggle(position);
  else actions.stopBar(position);
}

// After a stop: the dial is done for the game at once (mapPanelShown says
// null, input is free), but the veil stays, with `word` (what the shot
// did) in the circle's middle, for DIAL_RESULT_MS, then fades out over
// DIAL_FADE_OUT_MS. With no word (BACK) it fades out straight away.
export function fadeDial(word) {
  if (els.aim.hidden) return;
  endFade();
  showDialResult(word);
  els.aim.classList.add('fading');
  showOnly(null);
  const hold = word ? DIAL_RESULT_MS : 0;
  els.aim.style.setProperty('--dial-fade', DIAL_FADE_OUT_MS + 'ms');
  fadeTimers = [
    setTimeout(() => els.aim.classList.remove('on'), hold),
    setTimeout(endFade, hold + DIAL_FADE_OUT_MS),
  ];
}

// Ends a fade-out at once: the veil goes and the dial is cleared.
function endFade() {
  fadeTimers.forEach(clearTimeout);
  fadeTimers = [];
  if (!els.aim.classList.contains('fading')) return;
  els.aim.classList.remove('fading', 'on');
  clearDial();
}

// Hides every panel (CHARGE.SYS too) and stops the dial at once.
export function closeMapPanels() {
  hideCharger();
  endFade();
  clearDial();
  els.aim.classList.remove('on');
  showOnly(null);
}
