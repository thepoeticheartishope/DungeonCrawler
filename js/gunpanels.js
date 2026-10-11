// The gun's panels over the map (gun plan step 5): the reload choices,
// the question (the one question panel from questionview.js, moved here),
// and the damage bar. Each slides up over the lower part of the map, so
// the player can still see what's coming; one shows at a time. main.js
// opens them and passes in the actions they call (pickReload,
// cancelReload, stopBar), like exchangeview.js. What a reload offers is
// gun.js reloadOffers(); what a stopped bar does is gun.js settleShot();
// this only draws and listens. Until step 6 only the DEV panel opens them.

import { TIMER_SECONDS, DAMAGE_BAR_SWEEP_MS, DAMAGE_BAR_SLOW_SWEEP_MS } from './config.js';
import { maxWager } from './modifiers.js';
import { escapeHtml } from './quiz.js';
import { mountQuestionPanel } from './questionview.js';
import { t } from './text.js';

const els = {};
let actions = {};
// The damage bar's marker while it sweeps: { start, period, x, frame }.
// View-only, like the map's animation clocks, so not in state.
let sweep = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Looks up the panels and hooks up their buttons and keys: 1-3 pick a
// reload, Escape cancels it; Space or F stops the damage bar, as does the
// SELECT button (main.js, via stopBarSweep). A tap on the bar does
// nothing: a finger landing somewhere new each time stopped it unevenly
// and hid the marker. Call once, from main.js.
export function initGunPanels({ pickReload, cancelReload, stopBar }) {
  actions = { pickReload, cancelReload, stopBar };
  els.reload = document.getElementById('reloadPanel');
  els.reloadTitle = document.getElementById('reloadTitle');
  els.reloadChoices = document.getElementById('reloadChoices');
  els.reloadCancel = document.getElementById('reloadCancel');
  els.question = document.getElementById('mapQuestionPanel');
  els.questionSlot = document.getElementById('mapQuestionSlot');
  els.aim = document.getElementById('aimPanel');
  els.bar = document.getElementById('damageBar');
  els.hit = document.getElementById('damageHit');
  els.weak = document.getElementById('damageWeak');
  els.marker = document.getElementById('damageMarker');

  els.bar.setAttribute('aria-label', t('gun.bar.label'));
  els.reloadCancel.addEventListener('click', () => actions.cancelReload());
  document.addEventListener('keydown', (e) => {
    const shown = mapPanelShown();
    if (shown === 'aim' && (e.key === ' ' || e.key === 'f' || e.key === 'F')) {
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

// Which panel is over the map: 'reload', 'question', 'aim', or null.
export function mapPanelShown() {
  if (!els.reload) return null;
  if (!els.reload.hidden) return 'reload';
  if (!els.question.hidden) return 'question';
  if (!els.aim.hidden) return 'aim';
  return null;
}

// Shows only `panel` (or none).
function showOnly(panel) {
  [els.reload, els.question, els.aim].forEach(p => { p.hidden = p !== panel; });
}

// The reload choices from gun.js reloadOffers(): the category the reload
// asks from, then each offer, plain to hardest, with its modifier tags and,
// when fewer rounds fit than it loads, how many do.
export function showReloadPanel({ category, offers }) {
  els.reloadTitle.textContent = category && category.label
    ? t('gun.reload.title', { category: category.label })
    : t('gun.reload.titlePlain');
  els.reloadChoices.innerHTML = '';
  offers.forEach((offer, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span>' +
      '<span class="choice-label">' + escapeHtml(t('gun.reload.offer', { rounds: offer.rounds })) + '</span>' +
      offer.modifiers.map(mod =>
        '<span class="mod-tag" title="' + escapeHtml(t('mod.' + mod) + ': ' + t('mod.' + mod + '.tip', { max: maxWager(), secs: TIMER_SECONDS })) + '">' +
          escapeHtml(t('mod.' + mod + '.tag')) + '</span>').join('') +
      (offer.room < offer.rounds ? '<span class="reload-room">' + escapeHtml(t('gun.reload.room', { room: offer.room })) + '</span>' : '');
    btn.addEventListener('click', () => actions.pickReload(offer, category));
    els.reloadChoices.appendChild(btn);
  });
  showOnly(els.reload);
  if (els.reloadChoices.firstChild) els.reloadChoices.firstChild.focus();
}

// Moves the question panel over the map and shows it. `answers` are the
// question panel's handlers (questionview.js mountQuestionPanel): what a
// right or wrong answer does here.
export function showQuestionOnMap(answers) {
  mountQuestionPanel(els.questionSlot, answers);
  showOnly(els.question);
}

// Opens the damage bar for the landed shot waiting in state.battle.aim:
// the hit zone is `hitHalf` either side of the centre, the weak point
// `weakWidth`. The marker sweeps end to end and back until the player
// stops it.
export function showDamageBar(aim) {
  els.hit.style.left = (0.5 - aim.hitHalf) * 100 + '%';
  els.hit.style.width = aim.hitHalf * 200 + '%';
  els.weak.style.left = (0.5 - aim.weakWidth) * 100 + '%';
  els.weak.style.width = aim.weakWidth * 200 + '%';
  showOnly(els.aim);
  els.bar.focus();
  cancelAnimationFrame(sweep && sweep.frame);
  sweep = {
    start: performance.now(),
    period: reducedMotion.matches ? DAMAGE_BAR_SLOW_SWEEP_MS : DAMAGE_BAR_SWEEP_MS,
    x: 0,
    frame: 0,
  };
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
// position (0 to 1, centre 0.5) goes to stopBar. Only once per bar.
function stopSweep() {
  if (!sweep) return;
  cancelAnimationFrame(sweep.frame);
  const x = sweep.x;
  sweep = null;
  actions.stopBar(x);
}

// Hides every panel and stops the bar.
export function closeMapPanels() {
  if (sweep) cancelAnimationFrame(sweep.frame);
  sweep = null;
  showOnly(null);
}
