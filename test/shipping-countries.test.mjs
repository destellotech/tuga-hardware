// Where checkout delivers (src/store-config.js): everywhere Stripe accepts
// except the countries in NO_DELIVERY, which /shipping-returns names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHIPPING_COUNTRIES, NO_DELIVERY } from '../src/store-config.js';

test('delivers to the main markets and to none of the excluded countries', () => {
  for (const c of ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'DE', 'FR', 'AE', 'ZA']) assert.ok(SHIPPING_COUNTRIES.includes(c), c);
  for (const c of Object.keys(NO_DELIVERY)) assert.ok(!SHIPPING_COUNTRIES.includes(c), c);
});

test('the shipping page names every excluded country by its reason group', () => {
  const page = readFileSync(new URL('../build/content/legal/shipping-returns.html', import.meta.url), 'utf8');
  for (const name of ['Russia', 'Belarus', 'Afghanistan', 'Myanmar', 'Venezuela', 'Yemen', 'Saint Helena', 'Tuvalu']) {
    assert.ok(page.includes(name), name);
  }
  const listed = Object.values(NO_DELIVERY).filter((r) => r !== 'uninhabited' && r !== 'unknown').length;
  assert.equal(listed, 32);
});
