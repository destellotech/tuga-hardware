// Unit tests for the 3-Year Warranty reminder cron (src/warranty-reminders.js):
// which orders are due under the 30-days-from-dispatch rule, and one run
// against a mocked KV store and a mocked Resend endpoint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderDue, uncoveredDevices, sendWarrantyReminders, WINDOW_DAYS } from '../src/warranty-reminders.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-30T09:00:00Z');
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString();

const order = (over = {}) => ({
  orderId: 'TUGA-0101',
  customerEmail: 'buyer@example.com',
  customerName: 'Sam',
  status: 'dispatched',
  paidAt: daysAgo(40),
  dispatch: { at: daysAgo(22) },
  items: [{ id: 'tuga-a8', name: 'Tuga A8', quantity: 1 }],
  ...over,
});

test('the window is the 30 days from dispatch that warranty.json publishes', () => {
  assert.equal(WINDOW_DAYS, 30);
});

test('uncovered devices are counted per base model against warranty lines', () => {
  assert.deepEqual(uncoveredDevices([
    { id: 'tuga-a8', name: 'Tuga A8', quantity: 2 },
    { id: 'wty-3yr-tuga-a8', name: '3-Year Warranty for Tuga A8', quantity: 1 },
    { id: 'tuga-w10-scanner', name: 'Tuga W10 with 2D Scanner', quantity: 1 },
    { id: 'acc-car-charger', name: '12V DC Car Charger', quantity: 1 },
  ]), [
    { id: 'tuga-a8', name: 'Tuga A8', quantity: 1, planId: 'wty-3yr-tuga-a8', planPrice: 6500 },
    { id: 'tuga-w10', name: 'Tuga W10', quantity: 1, planId: 'wty-3yr-tuga-w10', planPrice: 7900 },
  ]);
});

test('a line with no stored id is matched by its catalogue name', () => {
  assert.deepEqual(uncoveredDevices([{ name: 'Tuga A6', quantity: 1 }]).map((d) => d.id), ['tuga-a6']);
  assert.deepEqual(uncoveredDevices([{ name: 'Something else', quantity: 1 }]), []);
});

test('an order 22 days after a recorded dispatch is due, with the window end date', () => {
  const due = reminderDue(order(), NOW);
  assert.ok(due);
  assert.deepEqual(due.devices.map((d) => d.id), ['tuga-a8']);
  assert.equal(due.windowEnd.toISOString(), new Date(Date.parse(daysAgo(22)) + 30 * DAY).toISOString());
});

test('with a recorded dispatch the reminder runs from day 20 to day 30 only', () => {
  assert.equal(reminderDue(order({ dispatch: { at: daysAgo(19) } }), NOW), null, 'too early');
  assert.ok(reminderDue(order({ dispatch: { at: daysAgo(20) } }), NOW), 'first day');
  assert.ok(reminderDue(order({ dispatch: { at: daysAgo(30) } }), NOW), 'last day');
  assert.equal(reminderDue(order({ dispatch: { at: daysAgo(31) } }), NOW), null, 'window shut');
});

test('without a recorded dispatch the payment date stands in, with a shorter window and no end date', () => {
  assert.equal(reminderDue(order({ dispatch: undefined, paidAt: daysAgo(23) }), NOW), null, 'too early');
  const due = reminderDue(order({ dispatch: undefined, paidAt: daysAgo(24) }), NOW);
  assert.ok(due);
  assert.equal(due.windowEnd, null);
  assert.ok(reminderDue(order({ dispatch: undefined, paidAt: daysAgo(31) }), NOW), 'last day');
  assert.equal(reminderDue(order({ dispatch: undefined, paidAt: daysAgo(32) }), NOW), null, 'might already be shut');
  assert.equal(reminderDue(order({ dispatch: undefined, paidAt: undefined }), NOW), null, 'no dates at all');
});

test('orders that must never be reminded', () => {
  assert.equal(reminderDue(order({ warrantyReminderAt: daysAgo(1) }), NOW), null, 'already reminded');
  assert.equal(reminderDue(order({ customerEmail: null }), NOW), null, 'no email');
  for (const status of ['refunded', 'cancelled', 'disputed']) {
    assert.equal(reminderDue(order({ status }), NOW), null, status);
  }
  assert.equal(reminderDue(order({ items: [{ id: 'acc-hand-strap', name: 'Hand Strap', quantity: 1 }] }), NOW), null, 'no device');
  assert.equal(reminderDue(order({ items: [
    { id: 'tuga-a8', name: 'Tuga A8', quantity: 1 },
    { id: 'wty-3yr-tuga-a8', name: '3-Year Warranty for Tuga A8', quantity: 1 },
  ] }), NOW), null, 'every device already covered');
});

/** A KV namespace with list, get and put, enough for the cron. */
function mockKv(records) {
  const store = new Map(Object.entries(records).map(([k, v]) => [k, { value: JSON.stringify(v), metadata: null }]));
  return {
    store,
    list: async ({ prefix }) => ({
      keys: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([name, { metadata }]) => ({ name, metadata })),
      list_complete: true,
    }),
    get: async (k) => store.get(k)?.value ?? null,
    put: async (k, value, opts = {}) => { store.set(k, { value, metadata: opts.metadata || null }); },
  };
}

test('one run reminds the due order once, marks it, and uses an idempotency key', async () => {
  const kv = mockKv({
    'order:TUGA-0101': order(),
    'order:TUGA-0102': order({ orderId: 'TUGA-0102', dispatch: { at: daysAgo(5) } }),
    'order:TUGA-0103': order({ orderId: 'TUGA-0103', status: 'refunded' }),
  });
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ id: 'email_1' }) }; };
  try {
    const env = { ORDERS: kv, RESEND_API_KEY: 'test', SITE_URL: 'https://www.example.test' };
    assert.deepEqual(await sendWarrantyReminders(env, { now: NOW }), { sent: 1 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'wty-reminder-TUGA-0101');
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(body.to, ['buyer@example.com']);
    assert.match(body.html, /Tuga A8/);
    assert.match(body.html, /£65 per device/);
    assert.match(body.html, /example\.test\/warranty-terms/);
    assert.doesNotMatch(body.html, /[\u2013\u2014]/, 'no em or en dashes');

    const saved = JSON.parse(kv.store.get('order:TUGA-0101').value);
    assert.equal(saved.warrantyReminderAt, new Date(NOW).toISOString());
    assert.equal(kv.store.get('order:TUGA-0101').metadata.warrantyReminderAt, saved.warrantyReminderAt, 'mark is in key metadata too');

    // A second run on the same day sends nothing more.
    assert.deepEqual(await sendWarrantyReminders(env, { now: NOW }), { sent: 0 });
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a failed send clears the mark so the next run can retry', async () => {
  const kv = mockKv({ 'order:TUGA-0101': order() });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  try {
    const env = { ORDERS: kv, RESEND_API_KEY: 'test' };
    assert.deepEqual(await sendWarrantyReminders(env, { now: NOW }), { sent: 0 });
    assert.equal(JSON.parse(kv.store.get('order:TUGA-0101').value).warrantyReminderAt, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the cron is a no-op without the store or the email key', async () => {
  assert.deepEqual(await sendWarrantyReminders({}, { now: NOW }), { sent: 0 });
});
