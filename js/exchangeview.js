// THE UNFOLDING's screen: what the player holds, each item with its price
// (and why it isn't offered, if it isn't), and the last thing that
// happened. main.js opens it when the player bumps THE UNFOLDING and
// passes in the actions it calls (buyItem, leaveExchange), like
// devpanel.js. What can be bought is exchange.js offers(); this only draws.

import { state } from './state.js';
import { offers } from './exchange.js';
import { escapeHtml } from './quiz.js';
import { t } from './text.js';

const els = {};
let actions = {};

// Looks up the screen's elements and hooks up its buttons and keys:
// 1-4 buy the matching item, Escape looks away. Call once, from main.js.
export function initExchangeView({ buyItem, leaveExchange }) {
  actions = { buyItem, leaveExchange };
  els.screen = document.getElementById('exchangeScreen');
  els.held = document.getElementById('exchangeHeld');
  els.items = document.getElementById('exchangeItems');
  els.note = document.getElementById('exchangeNote');
  els.leaveBtn = document.getElementById('exchangeLeaveBtn');

  els.leaveBtn.addEventListener('click', () => actions.leaveExchange());
  document.addEventListener('keydown', (e) => {
    if (!els.screen.classList.contains('show')) return;
    if (e.key === 'Escape') { e.preventDefault(); actions.leaveExchange(); return; }
    const btn = els.items.children[['1', '2', '3', '4'].indexOf(e.key)];
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });
}

// Draws the screen from state: myelin held, the items, and `note` (the
// line the last trade added up to, or nothing). Items not offered stay
// listed, dimmed, with the reason, so the player learns what it can do.
// An item the player can't afford stays pressable: trying is how they
// find out it won't turn toward them.
export function renderExchange(note) {
  els.held.textContent = t('exchange.held', { gold: state.run.coinsTotal });
  els.items.innerHTML = '';
  offers().forEach((offer, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.disabled = !offer.offered;
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span>' +
      '<span class="choice-label">' + escapeHtml(t('exchange.item.' + offer.id)) +
        (offer.reason ? '<span class="exchange-why">' + escapeHtml(t('exchange.why.' + offer.reason)) + '</span>' : '') +
      '</span>' +
      '<span class="exchange-price">' + escapeHtml(t('exchange.price', { price: offer.price })) + '</span>';
    btn.addEventListener('click', () => actions.buyItem(offer.id));
    els.items.appendChild(btn);
  });
  els.note.textContent = note || '';
}
