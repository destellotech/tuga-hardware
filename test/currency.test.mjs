// The local price hint (src/currency.js): which currency a visitor sees and
// how the stored ECB rates are kept fresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currencyFor, localeFor, getRates } from '../src/currency.js';

const kv = (initial) => {
  const store = new Map(initial ? [['fx:GBP', JSON.stringify(initial)]] : []);
  return { ORDERS: { get: async (k) => store.get(k) ?? null, put: async (k, v) => store.set(k, v) }, store };
};
const ratesFetch = (calls) => async () => {
  calls.push(1);
  return { ok: true, json: async () => ({ base: 'GBP', date: '2026-10-27', rates: { EUR: 1.2, USD: 1.33 } }) };
};

test('maps countries to the currency they pay in, and none for GBP or unknown', () => {
  assert.equal(currencyFor('DE'), 'EUR');
  assert.equal(currencyFor('BG'), 'EUR');
  assert.equal(currencyFor('US'), 'USD');
  assert.equal(currencyFor('GB'), null);
  assert.equal(currencyFor('NG'), null);
  assert.equal(currencyFor(null), null);
});

test('answers with the rate for the visitor currency, or no currency', () => {
  const rates = { date: '2026-10-27', rates: { EUR: 1.2 } };
  assert.deepEqual(localeFor('FR', rates), { country: 'FR', currency: 'EUR', rate: 1.2, date: '2026-10-27' });
  assert.deepEqual(localeFor('US', rates), { country: 'US', currency: null });
  assert.deepEqual(localeFor('GB', rates), { country: 'GB', currency: null });
});

test('uses stored rates under a day old without fetching', async () => {
  const now = Date.now();
  const env = kv({ date: 'd', rates: { EUR: 1.1 }, fetchedAt: now - 1000 });
  const calls = [];
  const doc = await getRates(env, ratesFetch(calls), now);
  assert.equal(doc.rates.EUR, 1.1);
  assert.equal(calls.length, 0);
});

test('refetches day-old rates and stores them', async () => {
  const now = Date.now();
  const env = kv({ date: 'd', rates: { EUR: 1.1 }, fetchedAt: now - 2 * 864e5 });
  const calls = [];
  const doc = await getRates(env, ratesFetch(calls), now);
  assert.equal(doc.rates.EUR, 1.2);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(env.store.get('fx:GBP')).rates.EUR, 1.2);
});

test('keeps showing rates up to a week old when the source is down, then stops', async () => {
  const now = Date.now();
  const down = async () => ({ ok: false, status: 503 });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal((await getRates(kv({ rates: { EUR: 1.1 }, fetchedAt: now - 3 * 864e5 }), down, now)).rates.EUR, 1.1);
    assert.equal(await getRates(kv({ rates: { EUR: 1.1 }, fetchedAt: now - 8 * 864e5 }), down, now), null);
    assert.equal(await getRates(kv(null), down, now), null);
  } finally {
    console.warn = warn;
  }
});
