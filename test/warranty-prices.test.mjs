// Scanner versions cost more to cover: each paid tier prices them at the base
// device's price plus the tier's scannerSurcharge. These tests keep
// data/products.json, the checkout catalogue in src/api.js and the Plan Terms
// in step, and check that a scanner version's plan is matched to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCTS } from '../src/api.js';
import { allocatePlans } from '../src/backoffice.js';
import { uncoveredDevices } from '../src/warranty-reminders.js';

const data = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const terms = JSON.parse(readFileSync(new URL('../build/content/warranty-terms.json', import.meta.url), 'utf8'));
const variants = data.products.filter((p) => p.isVariant);
const paidTiers = data.warranty.tiers.filter((t) => !t.included);

test('every paid tier prices each scanner version at the base price plus the surcharge', () => {
  for (const t of paidTiers) {
    assert.ok(t.scannerSurcharge > 0, `${t.id} has a scanner surcharge`);
    for (const v of variants) {
      assert.equal(t.prices[v.id], t.prices[v.variantOf] + t.scannerSurcharge, `${t.id} ${v.id}`);
    }
  }
});

test('every 3-Year Warranty in products.json is sold at the same price by the checkout', () => {
  const tier = data.warranty.tiers.find((t) => t.id === '3yr');
  const skus = Object.keys(PRODUCTS).filter((id) => id.startsWith('wty-'));
  assert.equal(data.warranties.length, skus.length);
  for (const w of data.warranties) {
    assert.deepEqual(
      { name: PRODUCTS[w.id]?.name, price: PRODUCTS[w.id]?.price, warrantyFor: PRODUCTS[w.id]?.warrantyFor },
      { name: w.name, price: w.price * 100, warrantyFor: w.warrantyFor },
      w.id
    );
    assert.equal(tier.prices[w.warrantyFor], w.price, `${w.id} matches the tier price`);
  }
  for (const v of variants) assert.ok(PRODUCTS[`wty-3yr-${v.id}`], `${v.id} has its own plan`);
});

test('the Plan Terms state each scanner version price', () => {
  const clause8 = terms.clauses.find((c) => c.startsWith('8. '));
  for (const t of paidTiers) {
    for (const v of variants) assert.ok(clause8.includes(`£${t.prices[v.id]}`), `${t.id} ${v.id} £${t.prices[v.id]}`);
  }
});

test('a scanner version needs its own plan; a leftover base plan from an older order still covers it', () => {
  assert.deepEqual(uncoveredDevices([
    { id: 'tuga-w10-scanner', quantity: 1 },
    { id: 'tuga-w10', quantity: 1 },
    { id: 'wty-3yr-tuga-w10', quantity: 1 },
  ]), [{ id: 'tuga-w10-scanner', name: 'Tuga W10 with 2D Scanner', quantity: 1, planId: 'wty-3yr-tuga-w10-scanner', planPrice: 9400 }]);
  assert.deepEqual(uncoveredDevices([
    { id: 'tuga-w10-scanner', quantity: 1 },
    { id: 'wty-3yr-tuga-w10', quantity: 1 },
  ]), []);
});

test('plans are allocated to their own model first, then to scanner versions from base plans', () => {
  const units = [{ model: 'tuga-w10-scanner', serial: 'S1' }, { model: 'tuga-w10', serial: 'B1' }];
  assert.deepEqual(allocatePlans(units, [{ productId: 'wty-3yr-tuga-w10-scanner', qty: 1 }]), { S1: '3yr', B1: 'standard' });
  assert.deepEqual(allocatePlans(units, [{ productId: 'wty-3yr-tuga-w10', qty: 1 }]), { S1: 'standard', B1: '3yr' });
  assert.deepEqual(allocatePlans(units.slice(0, 1), [{ productId: 'wty-3yr-tuga-w10', qty: 1 }]), { S1: '3yr' });
});
