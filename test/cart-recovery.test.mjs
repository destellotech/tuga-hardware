// What an expired Stripe Checkout Session must carry before a recovery
// email is sent (recoveryFromExpiredSession in src/api.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryFromExpiredSession } from '../src/api.js';

const expired = (over = {}) => ({
  id: 'cs_test_123',
  status: 'expired',
  currency: 'gbp',
  amount_total: 37900,
  customer_details: { email: 'buyer@example.com', name: 'Sam Carter' },
  consent: { promotions: 'opt_in' },
  after_expiration: { recovery: { enabled: true, url: 'https://checkout.stripe.com/c/pay/recover_1', expires_at: Math.floor(Date.now() / 1000) + 30 * 86400 } },
  ...over,
});

test('a consenting customer with an address and a link gets a recovery', () => {
  assert.deepEqual(recoveryFromExpiredSession(expired()), {
    sessionId: 'cs_test_123',
    email: 'buyer@example.com',
    name: 'Sam Carter',
    url: 'https://checkout.stripe.com/c/pay/recover_1',
    amountTotal: 37900,
    currency: 'gbp',
  });
});

test('no consent, no address, no link or a dead link means no email', () => {
  assert.equal(recoveryFromExpiredSession(expired({ consent: { promotions: 'opt_out' } })), null);
  assert.equal(recoveryFromExpiredSession(expired({ consent: null })), null);
  assert.equal(recoveryFromExpiredSession(expired({ customer_details: null, customer_email: null })), null);
  assert.equal(recoveryFromExpiredSession(expired({ after_expiration: { recovery: { enabled: true, url: null } } })), null);
  assert.equal(recoveryFromExpiredSession(expired({ after_expiration: { recovery: { enabled: true, url: 'https://x', expires_at: 1 } } })), null);
});

test('only expired sessions qualify', () => {
  assert.equal(recoveryFromExpiredSession(expired({ status: 'complete' })), null);
  assert.equal(recoveryFromExpiredSession(null), null);
});

test('a session-level customer_email is accepted when customer_details is empty', () => {
  const r = recoveryFromExpiredSession(expired({ customer_details: {}, customer_email: 'trade@example.com' }));
  assert.equal(r.email, 'trade@example.com');
  assert.equal(r.name, '');
});
