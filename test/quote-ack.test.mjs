// Unit tests for the pure parts of the quote acknowledgement email
// (src/quote-ack.js) against the live catalogue and discount tiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devicePriceRows, discountTierLines, discountSentence, idempotencyKeyFor, pounds } from '../src/quote-ack.js';
import { PRODUCTS, DISCOUNT_TIERS } from '../src/api.js';

test('pounds formats whole and fractional pence the way the site does', () => {
  assert.equal(pounds(34900), '£349');
  assert.equal(pounds(4999), '£49.99');
  assert.equal(pounds(800), '£8');
});

test('price rows list every sellable device, in catalogue order, and nothing else', () => {
  const rows = devicePriceRows(PRODUCTS);
  assert.deepEqual(rows.map((r) => r.id), [
    'tuga-a6', 'tuga-a8', 'tuga-a10', 'tuga-wh6', 'tuga-w8', 'tuga-w10',
    'tuga-wh6-scanner', 'tuga-w8-scanner', 'tuga-w10-scanner',
  ]);
  assert.deepEqual(rows[0], { id: 'tuga-a6', name: 'Tuga A6', price: '£349' });
  assert.deepEqual(rows[8], { id: 'tuga-w10-scanner', name: 'Tuga W10 with 2D Scanner', price: '£729' });
  assert.ok(rows.every((r) => !r.id.startsWith('acc-') && !r.id.startsWith('wty-') && !r.id.startsWith('upg-')));
});

test('discount wording is derived from the tiers and matches the site copy', () => {
  assert.deepEqual(discountTierLines(DISCOUNT_TIERS), ['3% off at 2 devices', '5% at 3 to 4', '8% at 5 to 9', '10% at 10 or more']);
  assert.equal(discountSentence(DISCOUNT_TIERS), '3% off at 2 devices, 5% at 3 to 4, 8% at 5 to 9 and 10% at 10 or more');
});

test('a tier that spans one quantity reads as that quantity alone', () => {
  assert.deepEqual(discountTierLines([{ min: 2, percent: 3 }, { min: 3, percent: 5 }]), ['3% off at 2 devices', '5% at 3 or more']);
  assert.deepEqual(discountTierLines([{ min: 3, percent: 5 }, { min: 4, percent: 8 }, { min: 10, percent: 10 }]), ['5% off at 3 devices', '8% at 4 to 9', '10% at 10 or more']);
});

test('idempotency keys are plain, bounded and stable', () => {
  const key = idempotencyKeyFor('quote-ack', '2026-10-24T09:00:00.000Z', 'Someone@Example.co.uk');
  assert.equal(key, 'quote-ack-2026-10-24T09-00-00-000Z-Someone-Example-co-uk');
  assert.equal(idempotencyKeyFor('x', 'y'.repeat(400)).length, 200);
});
