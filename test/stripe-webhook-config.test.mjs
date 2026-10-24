// The daily check that keeps the Stripe webhook subscribed to the events
// the worker handles (src/stripe-webhook-config.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_EVENTS, findSiteEndpoint, missingEvents, ensureStripeWebhookEvents } from '../src/stripe-webhook-config.js';

const SITE = 'https://www.tugahardware.com';
const ep = (events, url = `${SITE}/webhooks/stripe`) => ({ id: 'we_1', url, status: 'enabled', enabled_events: events });

test('finds the endpoint on the www or bare host and nothing else', () => {
  assert.equal(findSiteEndpoint([ep([], 'https://tugahardware.com/webhooks/stripe')], SITE).id, 'we_1');
  assert.equal(findSiteEndpoint([ep([], 'https://example.com/webhooks/stripe')], SITE), null);
  assert.equal(findSiteEndpoint(undefined, SITE), null);
});

test('missing events are the handled ones not yet subscribed; a wildcard needs nothing', () => {
  assert.deepEqual(missingEvents(ep(['checkout.session.completed'])), REQUIRED_EVENTS.filter((e) => e !== 'checkout.session.completed'));
  assert.deepEqual(missingEvents(ep(['*'])), []);
  assert.deepEqual(missingEvents(ep(REQUIRED_EVENTS)), []);
  assert.deepEqual(missingEvents(null).length, REQUIRED_EVENTS.length);
});

const fakeFetch = (endpoints, calls) => async (url, init = {}) => {
  calls.push({ url, init });
  if (!init.method) return { ok: true, status: 200, json: async () => ({ data: endpoints }) };
  return { ok: true, status: 200, json: async () => ({}) };
};

test('adds only the missing events, keeping the existing ones', async () => {
  const calls = [];
  const env = { STRIPE_SECRET_KEY: 'sk_test_x', SITE_URL: SITE };
  const r = await ensureStripeWebhookEvents(env, fakeFetch([ep(['checkout.session.completed', 'charge.refunded'])], calls));
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ['checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.dispute.created']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.stripe.com/v1/webhook_endpoints/we_1');
  const sent = new URLSearchParams(calls[1].init.body);
  assert.deepEqual([...sent.values()].sort(), [...REQUIRED_EVENTS].sort());
});

test('does nothing when the endpoint already receives everything, or is missing', async () => {
  let calls = [];
  const env = { STRIPE_SECRET_KEY: 'sk_test_x', SITE_URL: SITE };
  assert.deepEqual((await ensureStripeWebhookEvents(env, fakeFetch([ep(['*'])], calls))).added, []);
  assert.equal(calls.length, 1);
  calls = [];
  const r = await ensureStripeWebhookEvents(env, fakeFetch([], calls));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no endpoint');
  assert.equal(calls.length, 1);
  assert.equal((await ensureStripeWebhookEvents({}, fakeFetch([], []))).reason, 'not configured');
});
