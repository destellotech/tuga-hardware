/* Worker tests: run with `npm test`.

   Stripe, PayPal, Resend, KV and the static-asset binding are all faked, so
   these run offline and never touch a real account. */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../src/api.js';
import worker from '../src/worker.js';
import { PRODUCTS } from '../src/catalogue.generated.js';
import { readFileSync } from 'node:fs';

const REF = /^TUGA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
const catalogue = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));

// --- fakes -----------------------------------------------------------------

let kvStore, calls, sessions, paypalOrders, emails, taxRate, emailFails;

const kv = {
  get: async (k) => kvStore.get(k) ?? null,
  put: async (k, v) => void kvStore.set(k, v),
};

beforeEach(() => {
  kvStore = new Map();
  calls = [];
  sessions = {};
  paypalOrders = {};
  emails = [];
  taxRate = null;
  emailFails = false;
});

globalThis.fetch = async (input, opts = {}) => {
  const url = String(input);
  calls.push({ url, opts });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

  if (url === 'https://api.stripe.com/v1/checkout/sessions' && opts.method === 'POST') {
    return json({ id: 'cs_test_new', url: 'https://checkout.stripe.com/pay/cs_test_new' });
  }
  if (url.startsWith('https://api.stripe.com/v1/tax_rates/')) {
    return taxRate ? json(taxRate) : json({ error: { message: 'No such tax rate' } }, 404);
  }
  let m = url.match(/checkout\/sessions\/([^?]+)\?/);
  if (m) return json(sessions[m[1]] ?? { error: { message: 'missing' } }, sessions[m[1]] ? 200 : 404);
  if (url.startsWith('https://api.stripe.com/v1/payment_intents/')) return json({});
  if (url.includes('webhook_endpoints')) return json({ data: [] });
  if (url === 'https://api.resend.com/emails') {
    if (emailFails) return new Response('down', { status: 500 });
    emails.push(JSON.parse(opts.body));
    return json({ id: 'em_1' });
  }
  if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 'tok' });
  if (url.endsWith('/v2/checkout/orders') && opts.method === 'POST') {
    paypalOrders.created = JSON.parse(opts.body);
    return json({ id: 'PAYPALORDER01', links: [{ rel: 'approve', href: 'https://www.paypal.com/checkoutnow' }] });
  }
  m = url.match(/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/);
  if (m) {
    const order = paypalOrders[m[1]];
    if (m[2]) {
      order.status = 'COMPLETED';
      return json(order);
    }
    return json(order);
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const baseEnv = () => ({
  SITE_URL: 'https://www.tugahardware.com',
  STRIPE_SECRET_KEY: 'sk_test_x',
  RESEND_API_KEY: 're_x',
  PAYPAL_LIVE: 'true',
  PAYPAL_CLIENT_ID: 'id',
  PAYPAL_CLIENT_SECRET: 'secret',
  ADMIN_TOKEN: 'owner-secret',
  ORDERS: kv,
});

async function call(method, path, { body, env = baseEnv(), headers = {} } = {}) {
  const res = await handleRequest(
    new Request(`https://www.tugahardware.com${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env
  );
  return { status: res.status, body: await res.json() };
}

const lastStripeParams = () =>
  new URLSearchParams(calls.filter((c) => c.url === 'https://api.stripe.com/v1/checkout/sessions').at(-1).opts.body);

const paidSession = (id, extra = {}) => ({
  id,
  status: 'complete',
  payment_status: 'paid',
  payment_intent: 'pi_1',
  currency: 'gbp',
  amount_subtotal: 37900,
  amount_total: 37900,
  metadata: {},
  customer_details: {
    email: 'buyer@example.co.uk',
    phone: '+447700900123',
    business_name: 'Sparks Ltd',
    tax_ids: [{ type: 'gb_vat', value: 'GB123456789' }],
  },
  collected_information: {
    shipping_details: { name: 'A Buyer', address: { line1: '1 High St', city: 'Leeds', postal_code: 'LS1 1AA', country: 'GB' } },
  },
  line_items: { data: [{ description: 'Tuga A8', quantity: 1, price: { unit_amount: 37900 }, amount_total: 37900 }] },
  ...extra,
});

// --- catalogue -------------------------------------------------------------

test('the Worker charges exactly the prices in products.json', () => {
  for (const item of [...catalogue.products, ...catalogue.accessories]) {
    assert.equal(PRODUCTS[item.id].price, Math.round(item.price * 100), item.id);
    assert.equal(PRODUCTS[item.id].device, !item.id.startsWith('acc-'), item.id);
  }
  assert.equal(Object.keys(PRODUCTS).length, catalogue.products.length + catalogue.accessories.length);
});

// --- Stripe checkout -------------------------------------------------------

test('checkout carries an order number, phone and VAT collection, and an invoice', async () => {
  const r = await call('POST', '/api/create-checkout-session', {
    body: { items: [{ id: 'tuga-a8', quantity: 2 }, { id: 'acc-stylus' }] },
  });
  assert.equal(r.status, 200);
  const p = lastStripeParams();
  const ref = p.get('metadata[order_ref]');
  assert.match(ref, REF);
  assert.equal(p.get('client_reference_id'), ref);
  assert.equal(p.get('payment_intent_data[description]'), `Tuga Hardware order ${ref}`);
  assert.equal(p.get('phone_number_collection[enabled]'), 'true');
  assert.equal(p.get('tax_id_collection[enabled]'), 'true');
  assert.equal(p.get('invoice_creation[enabled]'), 'true');
  assert.equal(p.get('invoice_creation[invoice_data][custom_fields][0][value]'), ref);
  assert.equal(p.get('payment_method_types[0]'), null, 'the Stripe dashboard chooses payment methods');
  assert.deepEqual(p.getAll('shipping_address_collection[allowed_countries][0]'), ['GB']);
  assert.deepEqual(p.getAll('shipping_address_collection[allowed_countries][1]'), ['IE']);
  // Two devices earn 3% off devices only.
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), String(Math.round(37900 * 0.97)));
  assert.equal(p.get('line_items[1][price_data][unit_amount]'), '1600');
  assert.equal(p.get('line_items[0][tax_rates][0]'), null);
});

test('a VAT rate is attached only if it is active, inclusive and 20%', async () => {
  taxRate = { active: true, inclusive: false, percentage: 20 };
  await call('POST', '/api/create-checkout-session', {
    body: { items: [{ id: 'tuga-a6' }] },
    env: { ...baseEnv(), STRIPE_VAT_RATE_ID: 'txr_exclusive' },
  });
  assert.equal(lastStripeParams().get('line_items[0][tax_rates][0]'), null);

  taxRate = { active: true, inclusive: true, percentage: 20 };
  await call('POST', '/api/create-checkout-session', {
    body: { items: [{ id: 'tuga-a6' }] },
    env: { ...baseEnv(), STRIPE_VAT_RATE_ID: 'txr_inclusive' },
  });
  const p = lastStripeParams();
  assert.equal(p.get('line_items[0][tax_rates][0]'), 'txr_inclusive');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '29900', 'an inclusive rate never changes the price');
});

test('basket problems come back as a 409 the customer can act on', async () => {
  const unknown = await call('POST', '/api/create-checkout-session', { body: { items: [{ id: 'constructor' }] } });
  assert.equal(unknown.status, 409);
  const qty = await call('POST', '/api/create-checkout-session', { body: { items: [{ id: 'tuga-a8', quantity: 500 }] } });
  assert.equal(qty.status, 409);
  assert.match(qty.body.error, /between 1 and 99/);
});

test('out-of-stock items are refused', async () => {
  PRODUCTS['tuga-w8'].stock = 'out_of_stock';
  try {
    const r = await call('POST', '/api/create-checkout-session', { body: { items: [{ id: 'tuga-w8' }] } });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /Tuga W8 is out of stock/);
  } finally {
    PRODUCTS['tuga-w8'].stock = 'in_stock';
  }
});

// --- confirming orders -----------------------------------------------------

test('a paid session is recorded once, emailed once, and indexed by order number', async () => {
  sessions.cs_test_a = paidSession('cs_test_a', {
    metadata: { order_ref: 'TUGA-7K3M-9QX2' },
    invoice: { id: 'in_1', hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1/test_x' },
  });
  const r = await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_a' } });
  assert.equal(r.body.status, 'confirmed');
  assert.equal(r.body.reference, 'TUGA-7K3M-9QX2');
  assert.equal(r.body.invoiceUrl, 'https://invoice.stripe.com/i/acct_1/test_x');
  assert.equal(kvStore.get('ref:TUGA-7K3M-9QX2'), 'cs_test_a');

  const saved = JSON.parse(kvStore.get('order:cs_test_a'));
  assert.equal(saved.customerPhone, '+447700900123');
  assert.deepEqual(saved.taxIds, [{ type: 'gb_vat', value: 'GB123456789' }]);

  assert.equal(emails.length, 1);
  assert.equal(emails[0].subject, 'Order confirmed — TUGA-7K3M-9QX2');
  assert.match(emails[0].html, /Download your invoice/);
  assert.match(emails[0].html, /10 to 20 working days/);

  await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_a' } });
  assert.equal(emails.length, 1, 'no second email');
});

test('a session without an order number gets a stable one; a tampered one is ignored', async () => {
  sessions.cs_test_old = paidSession('cs_test_old');
  const a = await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_old' } });
  kvStore.clear();
  const b = await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_old' } });
  assert.match(a.body.reference, REF);
  assert.equal(a.body.reference, b.body.reference);

  sessions.cs_test_bad = paidSession('cs_test_bad', { metadata: { order_ref: '<script>' } });
  const c = await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_bad' } });
  assert.match(c.body.reference, REF);
});

test('a delayed payment is "processing" until Stripe says it cleared', async () => {
  sessions.cs_test_bacs = paidSession('cs_test_bacs', { payment_status: 'unpaid', metadata: { order_ref: 'TUGA-BACS-2222' } });
  const r = await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_bacs' } });
  assert.equal(r.body.status, 'processing');
  assert.equal(emails.length, 0);
  assert.equal(kvStore.has('order:cs_test_bacs'), false, 'nothing recorded until paid');

  sessions.cs_test_open = paidSession('cs_test_open', { status: 'open', payment_status: 'unpaid' });
  assert.equal((await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_open' } })).body.status, 'unpaid');
});

// --- PayPal ----------------------------------------------------------------

test('PayPal carries the order number and refuses countries we do not deliver to', async () => {
  await call('POST', '/api/create-paypal-order', { body: { items: [{ id: 'tuga-a10' }] } });
  const unit = paypalOrders.created.purchase_units[0];
  assert.match(unit.invoice_id, REF);

  const order = (country) => ({
    id: 'PAYPALORDER01',
    status: 'APPROVED',
    payer: { email_address: 'pp@example.com' },
    purchase_units: [{
      invoice_id: unit.invoice_id,
      amount: { value: '449.00', currency_code: 'GBP' },
      items: unit.items,
      shipping: { address: { country_code: country } },
      payments: { captures: [{ id: 'CAP1' }] },
    }],
  });

  paypalOrders.PAYPALORDER01 = order('US');
  const refused = await call('POST', '/api/confirm-order', { body: { paypalOrderId: 'PAYPALORDER01' } });
  assert.equal(refused.body.status, 'undeliverable');
  assert.equal(calls.some((c) => c.url.endsWith('/capture')), false, 'never captured');

  paypalOrders.PAYPALORDER01 = order('GB');
  const ok = await call('POST', '/api/confirm-order', { body: { paypalOrderId: 'PAYPALORDER01' } });
  assert.equal(ok.body.status, 'confirmed');
  assert.equal(ok.body.reference, unit.invoice_id);
});

// --- buyer's guide ---------------------------------------------------------

test("the buyer's guide is emailed, at most once a day per address", async () => {
  const first = await call('POST', '/api/subscribe', { body: { email: 'Someone@Example.com' } });
  assert.deepEqual(first.body, { ok: true, sent: true });
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to[0], 'Someone@Example.com');
  assert.match(emails[0].subject, /buyer's guide/);
  assert.match(emails[0].html, /IP67, IP68 and IP69K/);

  const again = await call('POST', '/api/subscribe', { body: { email: 'someone@example.com' } });
  assert.equal(again.body.sent, true);
  assert.equal(emails.length, 1, 'not sent twice');
});

test('a failed guide email is reported honestly and the address kept', async () => {
  emailFails = true;
  const r = await call('POST', '/api/subscribe', { body: { email: 'later@example.com' } });
  assert.deepEqual(r.body, { ok: true, sent: false });
  assert.ok(kvStore.has('subscriber:later@example.com'));
});

// --- owner tools -----------------------------------------------------------

test('owner routes need the admin token', async () => {
  assert.equal((await call('GET', '/api/admin/orders')).status, 401);
  assert.equal((await call('GET', '/api/stripe-check')).status, 401);
  assert.equal((await call('GET', '/api/admin/orders', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const off = await call('GET', '/api/admin/orders', { env: { ...baseEnv(), ADMIN_TOKEN: undefined } });
  assert.equal(off.status, 503);
});

test('an order can be listed, marked shipped, and the customer emailed once', async () => {
  const auth = { Authorization: 'Bearer owner-secret' };
  sessions.cs_test_ship = paidSession('cs_test_ship', { metadata: { order_ref: 'TUGA-SH2P-2345' } });
  await call('POST', '/api/confirm-order', { body: { sessionId: 'cs_test_ship' } });

  const list = await call('GET', '/api/admin/orders', { headers: auth });
  assert.equal(list.body.count, 1);
  assert.equal(list.body.orders[0].reference, 'TUGA-SH2P-2345');
  assert.equal(list.body.orders[0].phone, '+447700900123');

  const bad = await call('POST', '/api/admin/ship', { headers: auth, body: { reference: 'TUGA-SH2P-2345', trackingNumber: '<b>' } });
  assert.equal(bad.status, 422);

  const body = { reference: 'tuga-sh2p-2345', trackingNumber: 'AB123456789GB', carrier: 'Royal Mail' };
  const shipped = await call('POST', '/api/admin/ship', { headers: auth, body });
  assert.equal(shipped.body.emailed, true);
  const mail = emails.at(-1);
  assert.equal(mail.subject, 'Your Tuga Hardware order TUGA-SH2P-2345 has shipped');
  assert.match(mail.html, /royalmail\.com\/track-your-item#\/tracking-results\/AB123456789GB/);

  const repeat = await call('POST', '/api/admin/ship', { headers: auth, body });
  assert.equal(repeat.body.emailed, false, 'no duplicate shipping email');

  const after = await call('GET', '/api/admin/orders', { headers: auth });
  assert.equal(after.body.count, 0, 'no longer pending');
  assert.equal(JSON.parse(kvStore.get('order:cs_test_ship')).status, 'shipped');
});

// --- rate limiting ---------------------------------------------------------

test('forms and checkout are rate limited when the binding is present', async () => {
  let allowed = 1;
  const env = { ...baseEnv(), FORM_LIMITER: { limit: async () => ({ success: allowed-- > 0 }) } };
  assert.equal((await call('POST', '/api/subscribe', { body: { email: 'a@example.com' }, env })).status, 200);
  const limited = await call('POST', '/api/subscribe', { body: { email: 'a@example.com' }, env });
  assert.equal(limited.status, 429);
});

// --- worker: headers, redirects and 404 ------------------------------------

const assets = {
  fetch: async (req) => {
    const path = new URL(req.url).pathname;
    if (path === '/about') return new Response('<h1>About</h1>', { headers: { 'Content-Type': 'text/html' } });
    if (path === '/404') return new Response('<h1>Not here</h1>', { headers: { 'Content-Type': 'text/html' } });
    if (path === '/css/style.min.css') return new Response('body{}', { headers: { 'Content-Type': 'text/css' } });
    return new Response(null, { status: 404 });
  },
};
const get = (path, host = 'www.tugahardware.com') =>
  worker.fetch(new Request(`https://${host}${path}`), { ...baseEnv(), ASSETS: assets }, {});

test('every response carries the security headers', async () => {
  for (const res of [await get('/about'), await get('/css/style.min.css'), await get('/about', 'tugahardware.com')]) {
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('strict-transport-security'), /max-age=/);
  }
});

test('unknown pages get the 404 page with a 404 status; missing files stay plain', async () => {
  const page = await get('/no-such-page');
  assert.equal(page.status, 404);
  assert.match(await page.text(), /Not here/);
  const file = await get('/img/missing.webp');
  assert.equal(file.status, 404);
  assert.equal(await file.text(), '');
});

test('redirects still work: canonical host, .html, legacy product URLs', async () => {
  assert.equal((await get('/about', 'tugahardware.com')).headers.get('location'), 'https://www.tugahardware.com/about');
  assert.equal((await get('/about.html')).headers.get('location'), 'https://www.tugahardware.com/about');
  assert.equal((await get('/products/tuga-t8')).headers.get('location'), 'https://www.tugahardware.com/products/tuga-a8');
});
