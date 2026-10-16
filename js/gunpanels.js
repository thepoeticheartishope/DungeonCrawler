// The gun's panels (gun plan step 5): the reload choices and the question
// (the one question panel from questionview.js, moved here) on the ask
// screen, which takes the map's and the controls' place, like the battle
// screen (a relay's question shows there too); and the dial (kill or
// maim plan; the Struggle's too), for now laid flat as a strip on the
// map's bottom edge, so the minion stays in view: READY first, then one
// lap is one sweep across. One shows at a time. main.js opens them and
// passes in the actions they call (pickReload, cancelReload, readyBar,
// backBar, stopBar, stopStruggle), like exchangeview.js. What a reload
// offers is gun.js reloadOffers(); what a stopped dial does is gun.js
// settleShot() (or settleStruggle()); this only draws and listens.

import { TIMER_SECONDS, DIAL_REDUCED_SCALE } from './config.js';
import { maxWager } from './modifiers.js';
import { escapeHtml } from './quiz.js';
import { mountQuestionPanel } from './questionview.js';
import { t } from './text.js';

const els = {};
let actions = {};
// The dial's marker while it runs: { start, period, laps, x, frame }
// (laps: how many before it stops by itself, 0 for no limit). View-only,
// like the map's animation clocks, so not in state.
let sweep = null;
// What the bar is for while it shows: 'aim' (a shot's dial) or 'struggle'.
let barMode = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Looks up the panels and hooks up their buttons and keys: 1-3 pick a
// reload, Escape cancels it; Space or F starts the dial at READY and stops
// it once it runs, as does the SELECT button (main.js, via pressBar);
// Escape before READY puts the gun down (backBar). A tap on the running
// dial does nothing: a finger landing somewhere new each time stopped it
// unevenly and hid the marker. Call once, from main.js.
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
  els.aim = document.getElementById('aimPanel');
  els.bar = document.getElementById('damageBar');
  els.hit = document.getElementById('damageHit');
  els.marker = document.getElementById('damageMarker');
  els.prompt = document.getElementById('aimPrompt');
  els.legend = document.getElementById('damageLegend');

  els.bar.setAttribute('aria-label', t('gun.dial.label'));
  els.reloadCancel.addEventListener('click', () => actions.cancelReload());
  document.addEventListener('keydown', (e) => {
    const shown = mapPanelShown();
    if ((shown === 'aim' || shown === 'struggle') && (e.key === ' ' || e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      pressBar();
    } else if (shown === 'aim' && !sweep && e.key === 'Escape') {
      e.preventDefault();
      actions.backBar();
    } else if (shown === 'reload' && e.key === 'Escape') {
      e.preventDefault();
      actions.cancelReload();
    } else if (shown === 'reload') {
      const btn = els.reloadChoices.children[['1', '2', '3'].indexOf(e.key)];
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
}

// Which panel shows: 'reload' or 'question' (on the ask screen), 'aim'
// (a shot's dial over the map), 'struggle' (the same bar as the
// Struggle dial), or null.
export function mapPanelShown() {
  if (!els.reload) return null;
  if (!els.reload.hidden) return 'reload';
  if (!els.question.hidden) return 'question';
  if (!els.aim.hidden) return barMode;
  return null;
}

// Shows only `panel` (or none). The reload choices and the question take
// the ask screen in place of the map and the controls.
function showOnly(panel) {
  [els.reload, els.question, els.aim].forEach(p => { p.hidden = p !== panel; });
  const asking = panel === els.reload || panel === els.question;
  els.ask.hidden = !asking;
  els.room.classList.toggle('asking', asking);
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

// Opens the dial for the landed shot waiting in state.battle.aim, at
// READY (kill or maim plan): nothing of the dial shows yet, so the player
// can settle but not study it. A shot in the dark (gun.js fireDark) says
// which way it is harder.
export function showDamageBar(aim) {
  openReady('aim', aim.dark ? t('gun.dial.dark.' + aim.dark) + ' · ' + t('gun.dial.ready') : t('gun.dial.ready'));
}

// READY was pressed (gun.js readyShot): the dial's zones show, each marked
// with what it does, a key for the kinds on it, and the marker starts,
// one lap of `aim.lapMs` a sweep across (DIAL_REDUCED_SCALE times as long
// under reduced motion). At its lap limit it stops by itself.
export function runDamageBar(aim) {
  aim.zones.forEach(zone => {
    const el = document.createElement('div');
    el.className = 'damage-zone damage-' + zone.tier + ' rolled';
    el.style.left = zone.from * 100 + '%';
    el.style.width = (zone.to - zone.from) * 100 + '%';
    el.textContent = t('gun.dial.zone.' + (zone.harm || zone.tier));
    els.bar.insertBefore(el, els.marker);
  });
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
  startBar('aim', aim.lapMs, aim.lapLimit);
}

// Takes the last dial's zones off the bar.
function clearZones() {
  els.bar.querySelectorAll('.rolled').forEach(el => el.remove());
}

// Opens the Struggle dial on the same bar at READY (no BACK: it already
// has the player). `count` above 1 shows in the prompt, so the player
// sees why this one is harder. A minion has reached the player with no
// energy left (gun.js struggleDial).
export function showStruggleBar({ count }) {
  openReady('struggle', count > 1 ? t('gun.struggle.readyAgain', { count }) : t('gun.struggle.ready'));
}

// READY on the Struggle dial (gun.js readyStruggle): its one zone shows
// and the marker starts, one lap of `lapMs` a sweep across.
export function runStruggleBar({ zone, lapMs, count }) {
  els.hit.hidden = false;
  els.hit.style.left = zone.from * 100 + '%';
  els.hit.style.width = (zone.to - zone.from) * 100 + '%';
  els.prompt.textContent = count > 1 ? t('gun.struggle.promptAgain', { count }) : t('gun.struggle.prompt');
  startBar('struggle', lapMs, 0);
}

// Shows the bar for `mode` at READY: empty, no marker, `prompt` over it.
function openReady(mode, prompt) {
  clearZones();
  els.hit.hidden = true;
  els.legend.hidden = true;
  els.marker.hidden = true;
  els.prompt.textContent = prompt;
  barMode = mode;
  els.bar.setAttribute('aria-label', t(mode === 'struggle' ? 'gun.struggle.label' : 'gun.dial.label'));
  els.aim.classList.toggle('struggle', mode === 'struggle');
  cancelAnimationFrame(sweep && sweep.frame);
  sweep = null;
  showOnly(els.aim);
}

// Starts the marker on the bar already showing for `mode`: one end to the
// other every `lapMs` (DIAL_REDUCED_SCALE times as long under reduced
// motion), stopping by itself after `laps` sweeps (0: never).
function startBar(mode, lapMs, laps) {
  const period = lapMs * (reducedMotion.matches ? DIAL_REDUCED_SCALE : 1);
  els.marker.hidden = false;
  cancelAnimationFrame(sweep && sweep.frame);
  sweep = { start: performance.now(), period, laps, x: 0, frame: 0 };
  moveMarker(sweep.start);
}

// One frame of the sweep: there and back, at an even speed, so the
// player can learn its timing. Past its lap limit it fires where it is.
function moveMarker(now) {
  if (!sweep) return;
  const u = (now - sweep.start) / sweep.period;
  if (sweep.laps && u >= sweep.laps) { stopSweep(); return; }
  const v = u % 2;
  sweep.x = v < 1 ? v : 2 - v;
  els.marker.style.left = sweep.x * 100 + '%';
  sweep.frame = requestAnimationFrame(moveMarker);
}

// SELECT, Space or F on the dial: at READY it starts it (main.js readyBar
// runs the rule, then runDamageBar or runStruggleBar); running, it stops it.
export function pressBar() {
  if (sweep) stopSweep();
  else actions.readyBar(barMode);
}

// The player stopped the dial: the marker holds where it stopped, and the
// position (0 to 1) goes to stopBar, or to stopStruggle for the Struggle
// dial. Only once per dial.
function stopSweep() {
  if (!sweep) return;
  cancelAnimationFrame(sweep.frame);
  const x = sweep.x;
  sweep = null;
  if (barMode === 'struggle') actions.stopStruggle(x);
  else actions.stopBar(x);
}

// Hides every panel and stops the dial.
export function closeMapPanels() {
  if (sweep) cancelAnimationFrame(sweep.frame);
  sweep = null;
  showOnly(null);
}
