// The gun's panels (gun plan step 5): the reload choices and the question
// (the one question panel from questionview.js, moved here) on the ask
// screen, which takes the map's and the controls' place, like the battle
// screen (a relay's question shows there too); and the damage bar (or
// the Struggle dial) as a strip on the map's bottom edge, so the minion
// stays in view. One shows at a time. main.js
// opens them and passes in the actions they call (pickReload,
// cancelReload, stopBar, stopStruggle), like exchangeview.js. What a reload offers is
// gun.js reloadOffers(); what a stopped bar does is gun.js settleShot()
// (or settleStruggle(), for the Struggle dial on the same bar);
// this only draws and listens. Until step 6 only the DEV panel opens them.

import { TIMER_SECONDS, DAMAGE_BAR_SWEEP_MS, DAMAGE_BAR_SLOW_SWEEP_MS, STRUGGLE_SWEEP_MS, STRUGGLE_SLOW_SWEEP_MS } from './config.js';
import { maxWager } from './modifiers.js';
import { escapeHtml } from './quiz.js';
import { mountQuestionPanel } from './questionview.js';
import { t } from './text.js';

const els = {};
let actions = {};
// The damage bar's marker while it sweeps: { start, period, x, frame }.
// View-only, like the map's animation clocks, so not in state.
let sweep = null;
// What the bar is for while it shows: 'aim' (the damage bar) or 'struggle'.
let barMode = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Looks up the panels and hooks up their buttons and keys: 1-3 pick a
// reload, Escape cancels it; Space or F stops the damage bar, as does the
// SELECT button (main.js, via stopBarSweep). A tap on the bar does
// nothing: a finger landing somewhere new each time stopped it unevenly
// and hid the marker. Call once, from main.js.
export function initGunPanels({ pickReload, cancelReload, stopBar, stopStruggle }) {
  actions = { pickReload, cancelReload, stopBar, stopStruggle };
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

  els.bar.setAttribute('aria-label', t('gun.bar.label'));
  els.reloadCancel.addEventListener('click', () => actions.cancelReload());
  document.addEventListener('keydown', (e) => {
    const shown = mapPanelShown();
    if ((shown === 'aim' || shown === 'struggle') && (e.key === ' ' || e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      stopSweep();
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
// (the damage bar over the map), 'struggle' (the same bar as the
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

// Opens the damage bar for the landed shot waiting in state.battle.aim:
// its zones (gun.js damageZones), each marked 1, 2 or X, and a key for the
// kinds of zone on this bar. The marker sweeps end to end and back until
// the player stops it.
export function showDamageBar(aim) {
  clearZones();
  els.hit.hidden = true;
  aim.zones.forEach(zone => {
    const el = document.createElement('div');
    el.className = 'damage-zone damage-' + zone.tier + ' rolled';
    el.style.left = zone.from * 100 + '%';
    el.style.width = (zone.to - zone.from) * 100 + '%';
    el.textContent = t('gun.bar.zone.' + zone.tier);
    els.bar.insertBefore(el, els.marker);
  });
  const tiers = ['hit', 'weak', 'penalty'].filter(tier => aim.zones.some(z => z.tier === tier));
  els.legend.innerHTML = '';
  [...tiers, 'graze'].forEach(tier => {
    const span = document.createElement('span');
    span.textContent = t('gun.bar.key.' + tier);
    els.legend.appendChild(span);
  });
  els.legend.hidden = false;
  els.prompt.textContent = t('gun.bar.prompt');
  startBar('aim', reducedMotion.matches ? DAMAGE_BAR_SLOW_SWEEP_MS : DAMAGE_BAR_SWEEP_MS);
}

// Takes the last damage bar's zones off the bar.
function clearZones() {
  els.bar.querySelectorAll('.rolled').forEach(el => el.remove());
}

// Opens the Struggle dial on the same bar: one zone, `hitHalf` either side
// of the centre, no weak point, and a much faster sweep, `sweepMs` end to
// end (gun.js struggleDial; slowed by the same share as the first dial
// under reduced motion). `count` above 1 shows in the prompt, so the
// player sees why this one is harder. A minion has reached the player
// with no energy left (gun.js settleStruggle).
export function showStruggleBar({ hitHalf, sweepMs, count }) {
  clearZones();
  els.hit.hidden = false;
  els.hit.style.left = (0.5 - hitHalf) * 100 + '%';
  els.hit.style.width = hitHalf * 200 + '%';
  els.legend.hidden = true;
  els.prompt.textContent = count > 1 ? t('gun.struggle.promptAgain', { count }) : t('gun.struggle.prompt');
  const slow = STRUGGLE_SLOW_SWEEP_MS / STRUGGLE_SWEEP_MS;
  startBar('struggle', reducedMotion.matches ? sweepMs * slow : sweepMs);
}

// Shows the bar for `mode` and starts the marker sweeping, one end to the
// other every `period` ms.
function startBar(mode, period) {
  barMode = mode;
  els.bar.setAttribute('aria-label', t(mode === 'struggle' ? 'gun.struggle.label' : 'gun.bar.label'));
  els.aim.classList.toggle('struggle', mode === 'struggle');
  showOnly(els.aim);
  cancelAnimationFrame(sweep && sweep.frame);
  sweep = { start: performance.now(), period, x: 0, frame: 0 };
  moveMarker(sweep.start);
}

// One frame of the sweep: there and back, at an even speed, so the
// player can learn its timing.
function moveMarker(now) {
  if (!sweep) return;
  const u = ((now - sweep.start) / sweep.period) % 2;
  sweep.x = u < 1 ? u : 2 - u;
  els.marker.style.left = sweep.x * 100 + '%';
  sweep.frame = requestAnimationFrame(moveMarker);
}

// SELECT pressed while the damage bar sweeps: stops it, as Space or F do.
export function stopBarSweep() {
  stopSweep();
}

// The player stopped the bar: the marker holds where it stopped, and the
// position (0 to 1) goes to stopBar, or to stopStruggle for
// the Struggle dial. Only once per bar.
function stopSweep() {
  if (!sweep) return;
  cancelAnimationFrame(sweep.frame);
  const x = sweep.x;
  sweep = null;
  if (barMode === 'struggle') actions.stopStruggle(x);
  else actions.stopBar(x);
}

// Hides every panel and stops the bar.
export function closeMapPanels() {
  if (sweep) cancelAnimationFrame(sweep.frame);
  sweep = null;
  showOnly(null);
}
