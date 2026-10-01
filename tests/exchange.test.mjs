// Unit tests for THE UNFOLDING (js/exchange.js) and where it stands on a
// rest floor (floor.js buildRestFloor()).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { MC_SAMPLE_DATA, MAX_HEARTS, MAX_HEARTS_CAP, EXCHANGE_ITEMS, EXCHANGE_SLACK_TURNS } from '../js/config.js';
import { offers, buy } from '../js/exchange.js';
import { buildFloor, buildRestFloor } from '../js/floor.js';
import { whatBlocks } from '../js/passage.js';
import { stepPlayer } from '../js/moves.js';
import { resetHaunts } from '../js/haunts.js';
import { TEXT } from '../js/text.js';

const priceOf = id => EXCHANGE_ITEMS.find(item => item.id === id).price;
const offerOf = id => offers().find(o => o.id === id);
const types = events => events.map(e => e.type);

// A run standing on a between rest after depth 1, with `gold` myelin,
// one heart down, and THE UNFOLDING's once-per-rest list empty.
function atRest(gold = 100) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.order = MC_SAMPLE_DATA.slice(0, 3);
  state.run.roomIndex = 1;
  state.run.resting = true;
  state.run.coinsTotal = gold;
  state.run.maxHearts = MAX_HEARTS;
  state.run.hearts = MAX_HEARTS - 1;
  state.run.bonusSlack = 0;
  state.run.loreQueue = [];
  resetHaunts();
  buildRestFloor('between');
}

test('every item has wording, and every reason it can give does too', () => {
  EXCHANGE_ITEMS.forEach(item => assert.ok('exchange.item.' + item.id in TEXT, item.id));
  ['bought', 'noHaunts', 'fullStability', 'atCap', 'noDepth'].forEach(r => assert.ok('exchange.why.' + r in TEXT, r));
});

test('buying spends myelin and heals one stability, up to the max', () => {
  atRest(10);
  assert.deepEqual(types(buy('heal')), ['itemBought']);
  assert.equal(state.run.coinsTotal, 10 - priceOf('heal'));
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(offerOf('heal').reason, 'fullStability');
  assert.deepEqual(types(buy('heal')), ['notOffered']);
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(state.run.coinsTotal, 10 - priceOf('heal'));
});

test('without enough myelin nothing changes', () => {
  atRest(priceOf('heal') - 1);
  assert.deepEqual(buy('heal'), [{ type: 'cannotAfford', item: 'heal', price: priceOf('heal') }]);
  assert.equal(state.run.hearts, MAX_HEARTS - 1);
  assert.equal(state.run.coinsTotal, priceOf('heal') - 1);
});

test('the opening coin buys nothing', () => {
  atRest(1);
  for (const offer of offers()) {
    assert.ok(buy(offer.id).every(e => e.type !== 'itemBought'), offer.id);
  }
  assert.equal(state.run.coinsTotal, 1);
});

test('+1 max stability does not heal, comes once per rest, and stops at the cap', () => {
  atRest(1000);
  buy('maxStability');
  assert.equal(state.run.maxHearts, MAX_HEARTS + 1);
  assert.equal(state.run.hearts, MAX_HEARTS - 1, 'it must not heal');
  assert.equal(offerOf('maxStability').reason, 'bought');
  for (let rest = 0; rest < 10; rest++) {
    buildRestFloor('between');
    buy('maxStability');
  }
  assert.equal(state.run.maxHearts, MAX_HEARTS_CAP);
  assert.equal(offerOf('maxStability').reason, 'atCap');
});

test('bought slack goes to the next depth only, and never on the epilogue', () => {
  atRest(1000);
  buy('slack');
  assert.equal(state.run.bonusSlack, EXCHANGE_SLACK_TURNS);
  assert.equal(offerOf('slack').reason, 'bought');
  state.run.resting = false;
  buildFloor();
  const withSlack = state.floor.lightSlack;
  assert.equal(state.run.bonusSlack, 0, 'spent by the depth it was bought for');
  assert.ok(withSlack >= EXCHANGE_SLACK_TURNS, 'the budget holds the bought turns');

  state.run.roomIndex = state.run.order.length;
  state.run.resting = true;
  buildRestFloor('epilogue');
  assert.equal(offerOf('slack').reason, 'noDepth');
});

test('silencing takes the oldest haunt and counts it as silenced', () => {
  atRest(10);
  assert.equal(offerOf('silence').reason, 'noHaunts');
  const [first, second] = MC_SAMPLE_DATA;
  state.run.haunts.set(first, 1);
  state.run.haunts.set(second, 2);
  state.run.haunts.set(first, 5); // missed again: still the oldest
  const events = buy('silence');
  assert.deepEqual(types(events), ['itemBought', 'hauntSilenced']);
  assert.equal(events[1].question, first);
  assert.ok(!state.run.haunts.has(first) && state.run.haunts.has(second));
  assert.equal(state.run.hauntsSilenced, 1);
});

test('every rest floor has THE UNFOLDING standing on its room floor, in the way, and nothing on it', () => {
  for (const kind of ['opening', 'between', 'epilogue']) {
    for (let i = 0; i < 20; i++) {
      atRest();
      buildRestFloor(kind);
      const f = state.floor;
      const x = f.exchange;
      assert.ok(x, kind + ': it is there');
      const same = p => p && p.row === x.row && p.col === x.col;
      assert.ok(!f.wallSet.has(key(x.row, x.col)));
      assert.ok(![f.stairs, f.coin, f.PLAYER_START, ...f.props].some(same), kind + ': shares a tile');
      assert.equal(whatBlocks(x.row, x.col).kind, 'exchange');
    }
  }
});

test('a depth has no exchange', () => {
  atRest();
  state.run.resting = false;
  buildFloor();
  assert.equal(state.floor.exchange, null);
});

test('bumping THE UNFOLDING opens it and spends no turn', () => {
  atRest();
  const x = state.floor.exchange;
  // Stand the player just south of it, facing north, and bump.
  state.floor.playerRow = x.row + 1;
  state.floor.playerCol = x.col;
  state.floor.wallSet.delete(key(x.row + 1, x.col));
  const events = stepPlayer(-1, 0);
  assert.ok(types(events).includes('exchangeOpened'));
  assert.ok(!types(events).includes('stepped'));
  assert.equal(state.floor.playerRow, x.row + 1);
});
