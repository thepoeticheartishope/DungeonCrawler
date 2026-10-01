// THE UNFOLDING (code name: exchange): the thing on every rest floor that
// takes myelin for an item. offers() says what it holds right now and
// buy() trades. main.js opens its screen (exchangeview.js) when the player
// bumps it and draws the events buy() returns. Prices and items are
// EXCHANGE_ITEMS in config.js; wording is exchange.* in text.js.
// No DOM access here.

import { state } from './state.js';
import { EXCHANGE_ITEMS, EXCHANGE_SLACK_TURNS, MAX_HEARTS_CAP } from './config.js';
import { silenceOldestHaunt } from './haunts.js';

// Items the player can buy only once on each rest floor, so one big haul
// in the darkness can't buy a run's worth of them at one stop.
const ONCE_PER_REST = ['maxStability', 'slack'];

// Every item in EXCHANGE_ITEMS order as { id, price, offered, reason }.
// `offered` is false when buying it would do nothing (or is used up for
// this rest); `reason` then names why (exchange.why.* in text.js), so the
// screen can say so instead of hiding the item. Affording it is a
// separate question: buy() answers that, so the player can try.
export function offers() {
  return EXCHANGE_ITEMS.map(item => {
    const reason = whyNot(item.id);
    return { id: item.id, price: item.price, offered: !reason, reason };
  });
}

// Why an item can't be had right now, or null if it can.
function whyNot(id) {
  if (ONCE_PER_REST.includes(id) && state.floor.exchangeBought.has(id)) return 'bought';
  if (id === 'silence' && state.run.haunts.size === 0) return 'noHaunts';
  if (id === 'heal' && state.run.hearts >= state.run.maxHearts) return 'fullStability';
  if (id === 'maxStability' && state.run.maxHearts >= MAX_HEARTS_CAP) return 'atCap';
  // The epilogue is the last floor: there's no next depth to give turns to.
  if (id === 'slack' && state.run.roomIndex >= state.run.order.length) return 'noDepth';
  return null;
}

// Trades myelin for one item. Events:
//   notOffered { item, reason }   offers() has it as not offered
//   cannotAfford { item, price }  not enough myelin; nothing changes
//   itemBought { item, price }    myelin spent and the item applied
//   hauntSilenced { question }    after itemBought, for 'silence'
// Myelin goes down here; renderHud() (after drawEvents) shows it.
export function buy(id) {
  const offer = offers().find(o => o.id === id);
  if (!offer) return [];
  if (!offer.offered) return [{ type: 'notOffered', item: id, reason: offer.reason }];
  if (state.run.coinsTotal < offer.price) return [{ type: 'cannotAfford', item: id, price: offer.price }];

  state.run.coinsTotal -= offer.price;
  if (ONCE_PER_REST.includes(id)) state.floor.exchangeBought.add(id);
  const events = [{ type: 'itemBought', item: id, price: offer.price }];
  if (id === 'heal') state.run.hearts++;
  // Timothy: more room to hold, not a heal. The new point starts empty.
  else if (id === 'maxStability') state.run.maxHearts++;
  else if (id === 'slack') state.run.bonusSlack += EXCHANGE_SLACK_TURNS;
  else if (id === 'silence') events.push({ type: 'hauntSilenced', question: silenceOldestHaunt() });
  return events;
}
