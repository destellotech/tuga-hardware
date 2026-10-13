/* ============================================
   TUGA HARDWARE — API Route Handler
   Stripe Checkout, PayPal Orders, Webhooks.
   All calls use native fetch — zero npm deps.
   ============================================ */

import { sendOrderConfirmation, sendEnquiry } from './email.js';
import { saveOrder, getOrder, updateOrder } from './orders.js';
import { SALES_PAUSED, SALES_PAUSED_MESSAGE, SHIPPING_COUNTRIES } from './store-config.js';

// ---------------------------------------------------------------------------
// Product catalogue (prices in pence / GBP)
// ---------------------------------------------------------------------------
// Prices MUST match data/products.json. The client sends only ids and
// quantities; every order is re-priced here so a tampered basket cannot
// change what gets charged.
// `device: true` marks the items that count toward a bulk discount tier.
// Accessories are deliberately excluded — otherwise nine £8 adapters would
// unlock 10% off a £449 tablet.
const PRODUCTS = {
  // Devices — Android
  'tuga-a6':            { name: 'Tuga A6',                        price: 29900, device: true },
  'tuga-a8':            { name: 'Tuga A8',                        price: 37900, device: true },
  'tuga-a10':           { name: 'Tuga A10',                       price: 44900, device: true },
  // Devices — Windows
  'tuga-wh6':           { name: 'Tuga WH6',                       price: 69900, device: true },
  'tuga-w8':            { name: 'Tuga W8',                        price: 62900, device: true },
  'tuga-w10':           { name: 'Tuga W10',                       price: 64900, device: true },
  'tuga-wh6-scanner':   { name: 'Tuga WH6 with Barcode Scanner',  price: 77900, device: true },
  'tuga-w8-scanner':    { name: 'Tuga W8 with 2D Scanner',        price: 69900, device: true },
  'tuga-w10-scanner':   { name: 'Tuga W10 with 2D Scanner',       price: 72900, device: true },
  // Accessories
  'acc-charging-dock':    { name: 'Charging Dock',                            price: 4999 },
  'acc-vehicle-mount':    { name: 'Vehicle Mounting Dock',                    price: 10900 },
  'acc-hand-strap':       { name: 'Hand Strap',                               price: 2400 },
  'acc-stylus':           { name: 'Capacitive Stylus',                        price: 1499 },
  'acc-screen-protector': { name: 'Tempered Glass Screen Protector (2 Pack)', price: 1400 },
  'acc-car-charger':      { name: '12V DC Car Charger',                       price: 2600 },
  'acc-carry-case':       { name: 'Rugged Carry Case',                        price: 3400 },
  'acc-wh6-cradle':       { name: 'WH6 Charging Cradle',                      price: 7900 },
  'acc-belt-holster':     { name: 'Belt Holster',                             price: 2200 },
  'acc-car-mount':        { name: 'Car Phone Mount',                          price: 1700 },
  'acc-otg-adapter':      { name: 'USB-C to USB-A OTG Adapter',               price: 800 },
  'acc-shoulder-strap':   { name: 'Shoulder Strap',                           price: 1900 },
  // Warranty add-ons: one per device unit. Never discounted, never a device.
  // Total Care is sold on a quote and proforma only, so it has no SKU here.
  'wty-3yr-tuga-a10': { name: "3-Year Warranty for Tuga A10", price: 6500, warrantyFor: 'tuga-a10', tier: '3yr' },
  'wty-3yr-tuga-w10': { name: "3-Year Warranty for Tuga W10", price: 7900, warrantyFor: 'tuga-w10', tier: '3yr' },
  'wty-3yr-tuga-a6': { name: "3-Year Warranty for Tuga A6", price: 6500, warrantyFor: 'tuga-a6', tier: '3yr' },
  'wty-3yr-tuga-a8': { name: "3-Year Warranty for Tuga A8", price: 6500, warrantyFor: 'tuga-a8', tier: '3yr' },
  'wty-3yr-tuga-w8': { name: "3-Year Warranty for Tuga W8", price: 7900, warrantyFor: 'tuga-w8', tier: '3yr' },
  'wty-3yr-tuga-wh6': { name: "3-Year Warranty for Tuga WH6", price: 8900, warrantyFor: 'tuga-wh6', tier: '3yr' },
};

/** Scanner variants carry their base device's warranty. */
const baseDeviceId = (id) => id.replace(/-scanner$/, '');

/**
 * Map a provider line-item name back to our product id. Stripe and PayPal
 * only echo the name we sent, which is PRODUCTS[id].name.
 */
const productIdForName = (name) =>
  Object.keys(PRODUCTS).find((id) => PRODUCTS[id].name === name) ?? null;

/**
 * Normalise a client basket into priced lines.
 *
 * The client only ever sends ids and quantities — prices come from PRODUCTS
 * above, so a tampered basket cannot change what is charged. Accepts both
 * `id` and `productId` for the item key.
 *
 * @throws if an id is unknown or a quantity is not a sane integer.
 */
/** A problem with what the customer sent, shown to them as a 400. */
class BasketError extends Error {}

function resolveBasket(items) {
  return items.map((item) => {
    const id = item.productId ?? item.id;
    const product = PRODUCTS[id];
    if (!product) throw new BasketError(`Unknown product: ${id}`);

    // A missing quantity means 1; anything else must be a sane integer.
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new BasketError(`Invalid quantity for ${id}`);
    }

    return { id, product, quantity };
  });
}

/**
 * A warranty line is only valid for a device in the same basket, one per
 * unit. Throws with a message the basket page can show.
 */
function validateWarranties(lines) {
  const deviceUnits = {};
  for (const line of lines) {
    if (!line.product.device) continue;
    const base = baseDeviceId(line.id);
    deviceUnits[base] = (deviceUnits[base] || 0) + line.quantity;
  }
  for (const line of lines) {
    const w = line.product.warrantyFor;
    if (!w) continue;
    const units = deviceUnits[w] || 0;
    if (line.quantity > units) {
      throw new BasketError(`${line.product.name} covers one device each: you have ${line.quantity} but ${units} matching ${units === 1 ? 'device' : 'devices'} in the basket`);
    }
  }
}

/** Bulk tiers are earned on devices only. */
function countDeviceUnits(lines) {
  return lines.reduce(
    (sum, line) => sum + (line.product.device ? line.quantity : 0),
    0
  );
}

// Bulk discount tiers: { minQty: discountPercent }
const DISCOUNT_TIERS = [
  { min: 10, percent: 10 },
  { min: 5,  percent: 8 },
  { min: 3,  percent: 5 },
  { min: 2,  percent: 3 },
];

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
};

function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function corsError(message, status = 400) {
  return corsResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Main router — returns a Response or null (null = let static assets handle)
// ---------------------------------------------------------------------------
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight for API routes
  if (request.method === 'OPTIONS' && (path.startsWith('/api/') || path.startsWith('/webhooks/'))) {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- API routes ---
  // While orders are paused (src/store-config.js), refuse new checkouts even
  // from a basket saved before the pause. Confirming an order that was
  // already paid still works.
  if (
    SALES_PAUSED &&
    request.method === 'POST' &&
    (path === '/api/create-checkout-session' || path === '/api/create-paypal-order')
  ) {
    return corsError(SALES_PAUSED_MESSAGE, 503);
  }
  if (request.method === 'POST' && path === '/api/create-checkout-session') {
    return handleStripeCheckout(request, env);
  }
  if (request.method === 'POST' && path === '/api/create-paypal-order') {
    return handlePayPalOrder(request, env);
  }
  if (request.method === 'POST' && path === '/api/confirm-order') {
    return handleConfirmOrder(request, env);
  }
  if (request.method === 'POST' && path === '/api/contact') {
    return handleContact(request, env);
  }
  if (request.method === 'POST' && path === '/api/subscribe') {
    return handleSubscribe(request, env);
  }
  if (request.method === 'POST' && path === '/api/trade-apply') {
    return handleTradeApply(request, env);
  }
  if (request.method === 'POST' && path === '/api/warranty-register') {
    return handleWarrantyRegister(request, env);
  }
  if (request.method === 'GET' && path === '/api/review') {
    return handleReviewLookup(url, env);
  }
  if (request.method === 'POST' && path === '/api/review') {
    return handleReviewSubmit(request, env);
  }
  if (request.method === 'GET' && path === '/api/payment-methods') {
    return corsResponse({ card: !SALES_PAUSED, paypal: !SALES_PAUSED && isPayPalLive(env), paused: SALES_PAUSED });
  }
  if (request.method === 'GET' && path === '/api/paypal-check') {
    return handlePayPalCheck(request, env);
  }
  if (request.method === 'GET' && path === '/api/email-check') {
    return handleEmailCheck(env);
  }
  if (request.method === 'GET' && path === '/api/stripe-check') {
    return handleStripeCheck(env);
  }
  if (request.method === 'POST' && path === '/webhooks/stripe') {
    return handleStripeWebhook(request, env);
  }
  if (request.method === 'POST' && path === '/webhooks/paypal') {
    return handlePayPalWebhook(request, env);
  }

  // Not an API route — return null so the worker can serve static assets
  return null;
}

// =========================================================================
// 1. STRIPE CHECKOUT SESSION
// =========================================================================
async function handleStripeCheckout(request, env) {
  try {
    const { items, discount } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return corsError('Cart is empty');
    }

    // Re-price server-side; the discount the client claims is ignored.
    const lines = resolveBasket(items);
    validateWarranties(lines);
    const discountPercent = getDiscountPercent(countDeviceUnits(lines));

    // Build Stripe line items
    const lineItems = lines.map(({ product, quantity }) => {
      // The tier discount applies to devices only, matching how it is earned.
      const unitPrice = product.device
        ? Math.round(product.price * (1 - discountPercent / 100))
        : product.price;

      return {
        price_data: {
          currency: 'gbp',
          product_data: { name: product.name },
          unit_amount: unitPrice,
        },
        quantity,
      };
    });

    // Create Stripe Checkout Session via the API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${env.SITE_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${env.SITE_URL}/cart`);
    // No payment_method_types: Checkout then offers every method switched on
    // in the Stripe dashboard (Settings > Payment methods) that suits the
    // basket, so Apple Pay, Google Pay and Klarna appear without a deploy.
    SHIPPING_COUNTRIES.forEach((country, i) => {
      params.append(`shipping_address_collection[allowed_countries][${i}]`, country);
    });

    // Encode each line item
    lineItems.forEach((li, i) => {
      params.append(`line_items[${i}][price_data][currency]`, li.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, li.price_data.unit_amount);
      params.append(`line_items[${i}][quantity]`, li.quantity);
    });

    // Store discount metadata for the webhook to read
    if (discountPercent > 0) {
      params.append('metadata[discount_percent]', discountPercent);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error('Stripe error:', JSON.stringify(session));
      return corsError('Failed to create checkout session', 500);
    }

    return corsResponse({ url: session.url });
  } catch (err) {
    if (err instanceof BasketError) return corsError(err.message, 400);
    console.error('Stripe checkout handler error:', err);
    return corsError('Internal server error', 500);
  }
}

// =========================================================================
// 2. PAYPAL CREATE ORDER
// =========================================================================
async function handlePayPalOrder(request, env) {
  try {
    // Refuse rather than hand back a sandbox URL a customer cannot pay on.
    if (!isPayPalLive(env)) {
      return corsError('PayPal is not available right now', 503);
    }

    const { items, discount, total } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return corsError('Cart is empty');
    }

    // Validate and recalculate server-side (never trust the client total)
    const lines = resolveBasket(items);
    validateWarranties(lines);
    const discountPercent = getDiscountPercent(countDeviceUnits(lines));

    let subtotalPence = 0;
    const paypalItems = lines.map(({ product, quantity }) => {
      const unitPrice = product.device
        ? Math.round(product.price * (1 - discountPercent / 100))
        : product.price;
      subtotalPence += unitPrice * quantity;

      return {
        name: product.name,
        unit_amount: {
          currency_code: 'GBP',
          value: (unitPrice / 100).toFixed(2),
        },
        quantity: String(quantity),
      };
    });

    const totalGBP = (subtotalPence / 100).toFixed(2);

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken(env);

    // Create PayPal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'GBP',
          value: totalGBP,
          breakdown: {
            item_total: { currency_code: 'GBP', value: totalGBP },
          },
        },
        items: paypalItems,
      }],
      application_context: {
        brand_name: 'Tuga Hardware',
        shipping_preference: 'GET_FROM_FILE',
        user_action: 'PAY_NOW',
        return_url: `${env.SITE_URL}/order-confirmation?provider=paypal`,
        cancel_url: `${env.SITE_URL}/cart`,
      },
    };

    const paypalRes = await fetch(`${getPayPalBaseUrl(env)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const order = await paypalRes.json();

    if (!paypalRes.ok) {
      console.error('PayPal error:', JSON.stringify(order));
      return corsError('Failed to create PayPal order', 500);
    }

    // Find the approval link
    const approveLink = order.links.find(l => l.rel === 'approve');
    if (!approveLink) {
      return corsError('PayPal approval link not found', 500);
    }

    return corsResponse({ approvalUrl: approveLink.href, orderId: order.id });
  } catch (err) {
    if (err instanceof BasketError) return corsError(err.message, 400);
    console.error('PayPal order handler error:', err);
    return corsError('Internal server error', 500);
  }
}

// =========================================================================
// 3. ORDER RECORDING (shared by the webhooks and the confirmation page)
// =========================================================================
//
// Both providers reach us two ways: the customer's browser lands on
// /order-confirmation and calls /api/confirm-order, and the provider sends a
// webhook. Either can arrive first, or only one may arrive at all (a webhook
// that is not registered, or a customer who closes the tab), so both paths
// run the same idempotent recorder: verify the payment with the provider,
// then save and email exactly once per order.

/**
 * Has our own confirmation (with the order summary and, for a plan, the
 * 45-day cancellation notice) gone out? Records written before receiptVia
 * existed marked a Stripe receipt as emailSentAt with emailVia
 * 'stripe-receipt'; that receipt carries neither, so it does not count.
 */
const confirmationSent = (record) =>
  Boolean(record?.emailSentAt) && record.emailVia !== 'stripe-receipt';

/** Has Stripe already been asked to email its own receipt for this order? */
const receiptSent = (record) =>
  Boolean(record?.receiptSentAt) || record?.emailVia === 'stripe-receipt';

/**
 * Save and email an order unless it has already been recorded.
 * Returns the stored record.
 */
async function recordOrder(env, orderDetails) {
  let record = null;
  if (env.ORDERS) {
    record = await getOrder(env.ORDERS, orderDetails.orderId);
    // Recorded and confirmed by email already: nothing to do. Recorded but
    // never confirmed (the email service was down, even if Stripe sent its
    // receipt): fall through and retry our own confirmation only.
    if (confirmationSent(record)) return record;
  }

  if (!record) {
    console.log(`${orderDetails.provider} order received:`, orderDetails.orderId);
    record = orderDetails;
    if (env.ORDERS) {
      record = await saveOrder(env.ORDERS, orderDetails.orderId, orderDetails);
    }
  }

  if (!orderDetails.customerEmail) {
    console.error('Order has no customer email, confirmation not sent:', orderDetails.orderId);
  } else {
    let updates = null;

    if (env.RESEND_API_KEY) {
      try {
        await sendOrderConfirmation(env, orderDetails.customerEmail, orderDetails);
        updates = { emailSentAt: new Date().toISOString(), emailVia: 'resend' };
      } catch (emailErr) {
        // Log but do not fail: the payment is already taken.
        console.error('Email send failed:', emailErr);
      }
    } else {
      console.error('RESEND_API_KEY is not set:', orderDetails.orderId);
    }

    // Fallback for card orders: have Stripe email its own receipt. Setting
    // receipt_email on a live payment sends one regardless of dashboard
    // settings, including on a payment that has already succeeded.
    // (PayPal always emails its own receipt to the payer.)
    // The receipt is NOT our confirmation: it has no plan notice, so it is
    // tracked separately (receiptVia) and the next confirm-order or webhook
    // call retries the Resend confirmation. Ask Stripe only once.
    if (!updates && orderDetails.provider === 'stripe' && orderDetails.paymentIntent && !receiptSent(record)) {
      try {
        await sendStripeReceipt(orderDetails.paymentIntent, orderDetails.customerEmail, env);
        updates = { receiptSentAt: new Date().toISOString(), receiptVia: 'stripe-receipt' };
      } catch (err) {
        console.error('Stripe receipt fallback failed:', err);
      }
    }

    if (updates) {
      // A legacy record that counted the receipt as the confirmation keeps
      // that fact under the new fields.
      if (record.emailVia === 'stripe-receipt' && updates.emailVia === 'resend') {
        updates.receiptSentAt = record.receiptSentAt || record.emailSentAt;
        updates.receiptVia = 'stripe-receipt';
      }
      record = { ...record, ...updates };
      if (env.ORDERS) {
        await updateOrder(env.ORDERS, orderDetails.orderId, updates)
          .catch((err) => console.error('Could not mark email sent:', err));
      }
    }
  }

  return record;
}

/**
 * Verify a Stripe Checkout Session is paid, then record it.
 * Returns { paid: false } for a session that has not been paid.
 */
async function recordStripeOrder(sessionId, env) {
  const session = await fetchStripeSession(sessionId, env);
  if (session.error) throw new Error(`Stripe session lookup failed: ${session.error.message}`);
  if (session.payment_status !== 'paid') return { paid: false };

  // Listed separately: an expanded session carries at most 10 line items.
  const lineItems = await fetchStripeLineItems(sessionId, env);

  // Newer Stripe API versions moved shipping under collected_information.
  const shipping = session.collected_information?.shipping_details || session.shipping_details;

  const order = await recordOrder(env, {
    orderId: session.id,
    provider: 'stripe',
    paymentIntent: session.payment_intent,
    customerEmail: session.customer_details?.email,
    shippingAddress: shipping?.address
      ? { name: shipping.name, ...shipping.address }
      : null,
    items: lineItems.map(li => ({
      id: productIdForName(li.description),
      name: li.description,
      quantity: li.quantity,
      unitPrice: li.price?.unit_amount || li.amount_total / li.quantity,
      total: li.amount_total,
    })),
    subtotal: session.amount_subtotal,
    total: session.amount_total,
    discount: session.metadata?.discount_percent || 0,
    currency: session.currency?.toUpperCase() || 'GBP',
    status: 'pending',
    paidAt: new Date().toISOString(),
  });

  return { paid: true, order };
}

/**
 * Capture an approved PayPal order if it is not captured yet, then record it.
 * Returns { paid: false } for an order the customer has not approved.
 */
async function recordPayPalOrder(orderId, env) {
  let order = await fetchPayPalOrder(orderId, env);

  // PayPal takes the address from the buyer's account and cannot be limited
  // to the UK up front, so refuse to capture an order shipping anywhere else.
  // An approved order that is never captured expires and nothing is charged.
  if (order.status === 'APPROVED') {
    const country = order.purchase_units?.[0]?.shipping?.address?.country_code;
    if (!SHIPPING_COUNTRIES.includes(country)) {
      console.warn(`PayPal order ${orderId} not captured: ships to ${country || 'unknown'}`);
      return { paid: false, reason: 'country' };
    }
  }

  if (order.status === 'APPROVED') {
    try {
      await capturePayPalOrder(orderId, env);
    } catch (err) {
      // The webhook and the confirmation page can race to capture; losing
      // that race is fine as long as the order ends up COMPLETED.
      console.warn('PayPal capture did not succeed, re-checking order:', err.message);
    }
    order = await fetchPayPalOrder(orderId, env);
  }
  if (order.status !== 'COMPLETED') return { paid: false };

  const purchaseUnit = order.purchase_units?.[0] || {};
  const shipping = purchaseUnit.shipping || {};

  const record = await recordOrder(env, {
    orderId: order.id,
    provider: 'paypal',
    captureId: purchaseUnit.payments?.captures?.[0]?.id,
    customerEmail: order.payer?.email_address,
    shippingAddress: shipping.address
      ? {
          name: shipping.name?.full_name,
          line1: shipping.address.address_line_1,
          line2: shipping.address.address_line_2,
          city: shipping.address.admin_area_2,
          postal_code: shipping.address.postal_code,
          country: shipping.address.country_code,
        }
      : null,
    items: purchaseUnit.items?.map(item => ({
      id: productIdForName(item.name),
      name: item.name,
      quantity: parseInt(item.quantity, 10),
      unitPrice: Math.round(parseFloat(item.unit_amount?.value || '0') * 100),
      total: Math.round(parseFloat(item.unit_amount?.value || '0') * 100) * parseInt(item.quantity, 10),
    })) || [],
    total: Math.round(parseFloat(purchaseUnit.amount?.value || '0') * 100),
    currency: purchaseUnit.amount?.currency_code || 'GBP',
    status: 'pending',
    paidAt: new Date().toISOString(),
  });

  return { paid: true, order: record };
}

/**
 * Called by /order-confirmation with whatever the provider put on the
 * return URL: Stripe's session_id, or PayPal's token (the order id).
 */
async function handleConfirmOrder(request, env) {
  try {
    const { sessionId, paymentIntentId, paypalOrderId } = await request.json();

    let result;
    if (typeof sessionId === 'string' && /^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
      result = await recordStripeOrder(sessionId, env);
    } else if (typeof paymentIntentId === 'string' && /^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      // The pi_ reference is what Stripe's own emails and dashboard show.
      const found = await findStripeSessionByPaymentIntent(paymentIntentId, env);
      if (!found) return corsError('No checkout found for that payment', 404);
      result = await recordStripeOrder(found, env);
    } else if (typeof paypalOrderId === 'string' && /^[A-Z0-9]{10,30}$/.test(paypalOrderId)) {
      result = await recordPayPalOrder(paypalOrderId, env);
    } else {
      return corsError('Missing or invalid order reference');
    }

    if (!result.paid) {
      return corsResponse({ status: result.reason === 'country' ? 'unsupported_country' : 'unpaid' });
    }

    // Only what the confirmation page shows: no address or email.
    const { order } = result;
    // emailSent is true only for our own confirmation; a Stripe receipt is
    // reported through emailVia so the page can say what actually arrived.
    const emailSent = confirmationSent(order);
    return corsResponse({
      status: 'confirmed',
      orderId: order.orderId,
      provider: order.provider,
      total: order.total,
      currency: order.currency,
      emailSent,
      emailVia: emailSent ? 'resend' : receiptSent(order) ? 'stripe-receipt' : null,
      hasPlan: (order.items || []).some((item) =>
        String(item.id || productIdForName(item.name) || '').startsWith('wty-')),
    });
  } catch (err) {
    console.error('Confirm order error:', err);
    return corsError('Could not confirm the order', 502);
  }
}

// =========================================================================
// 4. STRIPE WEBHOOK
// =========================================================================
async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return corsError('Missing Stripe signature', 400);
  }

  const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Stripe webhook signature invalid: check STRIPE_WEBHOOK_SECRET matches the endpoint in Stripe');
    return corsError('Invalid signature', 401);
  }

  const event = JSON.parse(rawBody);

  if (event.type === 'checkout.session.completed') {
    try {
      await recordStripeOrder(event.data.object.id, env);
    } catch (err) {
      // A 500 makes Stripe retry, which is what we want for a transient failure.
      console.error('Stripe webhook error:', err);
      return corsError('Could not record order', 500);
    }
  }

  return corsResponse({ received: true });
}

// =========================================================================
// 5. PAYPAL WEBHOOK (backup for customers who never reach the return page)
// =========================================================================
async function handlePayPalWebhook(request, env) {
  const rawBody = await request.text();

  const isValid = await verifyPayPalWebhook(request, rawBody, env);
  if (!isValid) {
    console.error('PayPal webhook verification failed: check PAYPAL_WEBHOOK_ID matches the webhook in the PayPal developer dashboard');
    return corsError('Invalid webhook', 401);
  }

  const event = JSON.parse(rawBody);

  if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    // CAPTURE.COMPLETED carries the capture; its parent order id is in
    // supplementary_data. Either way we re-read the order from PayPal.
    const orderId = event.event_type === 'CHECKOUT.ORDER.APPROVED'
      ? event.resource?.id
      : event.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      try {
        await recordPayPalOrder(orderId, env);
      } catch (err) {
        console.error('PayPal webhook error:', err);
        return corsError('Could not record order', 500);
      }
    }
  }

  return corsResponse({ received: true });
}

// =========================================================================
// CONTACT + SUBSCRIBE
// =========================================================================

/**
 * Contact form. Emails support and never leaks whether the send succeeded
 * for reasons other than a genuine failure.
 */
async function handleContact(request, env) {
  try {
    const { name, email, company, topic, message, website } = await request.json();

    // Honeypot: real users never fill a hidden field.
    if (website) return corsResponse({ ok: true, emailed: true });

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsError('A valid email address is required', 422);
    }
    if (!message || message.trim().length < 5) {
      return corsError('Please include a message', 422);
    }

    const enquiry = {
      name: String(name || '').slice(0, 120),
      email: String(email).slice(0, 160),
      company: String(company || '').slice(0, 160),
      topic: String(topic || 'Enquiry').slice(0, 80),
      message: String(message).slice(0, 4000),
      receivedAt: new Date().toISOString(),
    };

    // Persist first. Email delivery depends on RESEND_API_KEY and a verified
    // sending domain; if either is missing we still want the enquiry, not a
    // 500 and a customer who thinks nobody read it.
    let stored = false;
    if (env.ORDERS) {
      try {
        await env.ORDERS.put(
          `enquiry:${enquiry.receivedAt}:${enquiry.email}`,
          JSON.stringify(enquiry)
        );
        stored = true;
      } catch (kvErr) {
        console.error('Could not store enquiry:', kvErr);
      }
    }

    const emailed = await deliverEnquiry(env, enquiry);
    // Only fail the request if the message is now nowhere at all.
    if (!emailed && !stored) return corsError('Could not send the message', 500);

    // emailed: false tells the page the message is kept but support has not
    // been notified yet, so it can say so rather than promise a quick reply.
    return corsResponse({ ok: true, emailed });
  } catch (err) {
    console.error('Contact form error:', err);
    return corsError('Could not send the message', 500);
  }
}

/**
 * Email preflight. Reports whether order emails can be sent, without
 * sending one: the API key is present and the sending domain is verified.
 */
async function handleEmailCheck(env) {
  if (!env.RESEND_API_KEY) {
    return corsResponse({ ok: false, verdict: 'RESEND_API_KEY is not set, so no order emails are sent.' });
  }

  const sendingDomain = 'tugahardware.com';
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // A "sending access" key cannot list domains, but may still send fine.
      const restricted = data.name === 'restricted_api_key';
      return corsResponse({
        ok: restricted ? null : false,
        status: res.status,
        verdict: restricted
          ? 'The key is send-only, so the domain status cannot be read. Check it in the Resend dashboard.'
          : `Resend rejected the API key: ${data.message || res.status}. Create a new key in Resend and set it with \`wrangler secret put RESEND_API_KEY\`.`,
      });
    }

    const domain = (data.data || []).find((d) => d.name === sendingDomain);
    return corsResponse({
      ok: domain?.status === 'verified',
      domain: sendingDomain,
      domainStatus: domain?.status ?? 'not added',
      verdict: domain?.status === 'verified'
        ? 'Order emails can be sent.'
        : `${sendingDomain} is not verified in Resend, so emails from orders@${sendingDomain} are refused.`,
    });
  } catch (err) {
    return corsResponse({ ok: false, verdict: 'Could not reach Resend.' });
  }
}

/**
 * Stripe preflight. Reports whether a live webhook endpoint points at this
 * site and listens for completed checkouts. Returns no ids or secrets.
 */
async function handleStripeCheck(env) {
  if (!env.STRIPE_SECRET_KEY) {
    return corsResponse({ ok: false, verdict: 'STRIPE_SECRET_KEY is not set.' });
  }

  const target = `${env.SITE_URL}/webhooks/stripe`;
  // The worker serves webhooks on the bare domain too, so either host works.
  const accepted = [target, target.replace('://www.', '://')];
  try {
    const res = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return corsResponse({ ok: false, status: res.status, verdict: 'Stripe rejected the request.' });
    }

    const endpoint = (data.data || []).find((e) => accepted.includes(e.url));
    const listens = endpoint && (endpoint.enabled_events.includes('*') ||
      endpoint.enabled_events.includes('checkout.session.completed'));

    return corsResponse({
      ok: Boolean(endpoint && endpoint.status === 'enabled' && listens),
      mode: env.STRIPE_SECRET_KEY.startsWith('sk_live_') || env.STRIPE_SECRET_KEY.startsWith('rk_live_') ? 'live' : 'test',
      endpointFound: Boolean(endpoint),
      endpointStatus: endpoint?.status ?? null,
      listensForCheckoutCompleted: Boolean(listens),
      webhookSecretSet: Boolean(env.STRIPE_WEBHOOK_SECRET),
      // Near-misses on our own domain (e.g. no www) are the usual mistake.
      otherSiteEndpoints: (data.data || []).filter((e) => e !== endpoint && e.url.includes('tugahardware')).map((e) => e.url),
      endpointUrl: endpoint?.url ?? null,
      verdict: !endpoint
        ? `No Stripe webhook points at ${target}.`
        : !listens
          ? 'The webhook exists but does not listen for checkout.session.completed.'
          : endpoint.status !== 'enabled'
            ? 'The webhook exists but is disabled.'
            : 'Webhook configured. If orders still fail, STRIPE_WEBHOOK_SECRET may not match this endpoint.',
    });
  } catch (err) {
    return corsResponse({ ok: false, verdict: 'Could not reach Stripe.' });
  }
}

/**
 * Send an enquiry to support. Returns whether the email went out; a failure
 * is logged, never thrown, because the caller has usually stored it already.
 */
async function deliverEnquiry(env, enquiry) {
  try {
    await sendEnquiry(env, enquiry);
    return true;
  } catch (mailErr) {
    console.error('Enquiry email failed:', mailErr);
    return false;
  }
}

/**
 * "Not sure which size?" form: a request for personal size advice. Stored in
 * KV as before and sent to support through the enquiry email so someone
 * replies. Same contract as /api/contact: { ok, emailed }.
 */
async function handleSubscribe(request, env) {
  try {
    const { email, website, message, page } = await request.json();

    // Honeypot: real users never fill a hidden field.
    if (website) return corsResponse({ ok: true, emailed: true });

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsError('A valid email address is required', 422);
    }

    const advice = {
      email: email.slice(0, 160),
      topic: 'Size advice request',
      message: [
        'Please send personal advice on which tablet size suits this customer.',
        message ? `Note: ${String(message).slice(0, 2000)}` : '',
        page ? `Sent from: ${String(page).slice(0, 200)}` : '',
      ].filter(Boolean).join('\n'),
      createdAt: new Date().toISOString(),
    };

    let stored = false;
    if (env.ORDERS) {
      try {
        await env.ORDERS.put(
          `subscriber:${advice.email.toLowerCase()}`,
          JSON.stringify({ email: advice.email, topic: advice.topic, createdAt: advice.createdAt })
        );
        stored = true;
      } catch (kvErr) {
        console.error('Could not store size advice request:', kvErr);
      }
    }

    const emailed = await deliverEnquiry(env, advice);
    if (!emailed && !stored) return corsError('Could not send the request', 500);

    return corsResponse({ ok: true, emailed });
  } catch (err) {
    console.error('Subscribe error:', err);
    return corsError('Could not send the request', 500);
  }
}

/**
 * Is PayPal pointed at real money?
 *
 * The integration defaults to PayPal's sandbox, which returns a
 * sandbox.paypal.com approval URL that a real customer cannot pay on. The
 * cart asks this before offering PayPal, so a half-configured integration
 * shows no button rather than a dead end at checkout.
 */
function isPayPalLive(env) {
  return (
    env.PAYPAL_LIVE === 'true' &&
    Boolean(env.PAYPAL_CLIENT_ID) &&
    Boolean(env.PAYPAL_CLIENT_SECRET)
  );
}

/**
 * Preflight: can the stored PayPal credentials authenticate?
 *
 * Tries the token endpoint on BOTH environments and reports which one the
 * credentials belong to, so PAYPAL_LIVE can be set from evidence rather than
 * flipped and hoped for. Returns only PayPal's error code — never the
 * credentials themselves.
 */
async function handlePayPalCheck(request, env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    return corsResponse({
      configured: false,
      hint: 'Set the PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET secrets.',
    });
  }

  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);

  const probe = async (base) => {
    try {
      const res = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, error: data.error ?? null };
    } catch (err) {
      return { ok: false, status: 0, error: 'request_failed' };
    }
  };

  const [live, sandbox] = await Promise.all([
    probe('https://api-m.paypal.com'),
    probe('https://api-m.sandbox.paypal.com'),
  ]);

  return corsResponse({
    configured: true,
    currentMode: env.PAYPAL_LIVE === 'true' ? 'live' : 'sandbox',
    live,
    sandbox,
    verdict: live.ok
      ? 'Live credentials. PAYPAL_LIVE can be set to "true".'
      : sandbox.ok
        ? 'These are SANDBOX credentials. Create a Live REST app at developer.paypal.com and replace the secrets before setting PAYPAL_LIVE to "true".'
        : 'Neither environment accepted these credentials.',
  });
}

// =========================================================================
// TRADE ACCOUNTS, WARRANTY REGISTRATION, REVIEWS
// =========================================================================
//
// All three follow the contact form's rule: persist to KV first, then email
// support, and only fail the request if the submission is now nowhere.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim a value to a string of at most `max` characters. */
const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Store a submission and email support about it.
 * Returns a Response: ok if either the store or the email succeeded.
 */
async function storeAndNotify(env, key, record, enquiry) {
  let stored = false;
  if (env.ORDERS) {
    try {
      await env.ORDERS.put(key, JSON.stringify(record));
      stored = true;
    } catch (kvErr) {
      console.error(`Could not store ${key}:`, kvErr);
    }
  }

  try {
    await sendEnquiry(env, enquiry);
  } catch (mailErr) {
    console.error(`Notification email failed for ${key}:`, mailErr);
    if (!stored) return corsError('Could not send the form', 500);
  }

  return corsResponse({ ok: true });
}

/**
 * Trade account application. Approval is manual: support reads the
 * application, checks the company, and replies with invoice terms.
 */
async function handleTradeApply(request, env) {
  try {
    const body = await request.json();
    if (body.website) return corsResponse({ ok: true }); // honeypot

    const application = {
      company: clip(body.company, 160),
      name: clip(body.name, 120),
      email: clip(body.email, 160),
      phone: clip(body.phone, 40),
      companyNumber: clip(body.companyNumber, 20),
      vatNumber: clip(body.vatNumber, 20),
      devices: clip(body.devices, 40),
      message: clip(body.message, 4000),
      receivedAt: new Date().toISOString(),
      status: 'new',
    };

    if (!EMAIL_RE.test(application.email)) {
      return corsError('A valid email address is required', 422);
    }
    if (application.company.length < 2) {
      return corsError('Please give your company name', 422);
    }

    const lines = [
      `Company: ${application.company}`,
      `Contact: ${application.name}`,
      `Phone: ${application.phone || 'not given'}`,
      `Companies House number: ${application.companyNumber || 'not given'}`,
      `VAT number: ${application.vatNumber || 'not given'}`,
      `Devices per year: ${application.devices || 'not given'}`,
      '',
      application.message,
    ];

    return storeAndNotify(
      env,
      `trade:${application.receivedAt}:${application.email.toLowerCase()}`,
      application,
      {
        name: application.name || application.company,
        email: application.email,
        topic: 'Trade account application',
        message: lines.join('\n'),
      }
    );
  } catch (err) {
    console.error('Trade application error:', err);
    return corsError('Could not send the form', 500);
  }
}

/** Warranty registration: ties a serial number to a customer. */
async function handleWarrantyRegister(request, env) {
  try {
    const body = await request.json();
    if (body.website) return corsResponse({ ok: true }); // honeypot

    const registration = {
      name: clip(body.name, 120),
      email: clip(body.email, 160),
      model: clip(body.model, 40),
      serial: clip(body.serial, 40).toUpperCase(),
      orderRef: clip(body.orderRef, 80),
      purchaseDate: clip(body.purchaseDate, 10),
      receivedAt: new Date().toISOString(),
    };

    if (!EMAIL_RE.test(registration.email)) {
      return corsError('A valid email address is required', 422);
    }
    if (!PRODUCTS[registration.model]?.device) {
      return corsError('Please choose your model', 422);
    }
    if (!/^[A-Z0-9][A-Z0-9 \-/]{3,39}$/.test(registration.serial)) {
      return corsError('That does not look like a serial number', 422);
    }
    if (registration.purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(registration.purchaseDate)) {
      registration.purchaseDate = '';
    }

    return storeAndNotify(
      env,
      `warranty:${registration.serial}:${registration.receivedAt}`,
      registration,
      {
        name: registration.name,
        email: registration.email,
        topic: 'Warranty registration',
        message: [
          `Model: ${PRODUCTS[registration.model].name}`,
          `Serial: ${registration.serial}`,
          `Order reference: ${registration.orderRef || 'not given'}`,
          `Purchase date: ${registration.purchaseDate || 'not given'}`,
        ].join('\n'),
      }
    );
  } catch (err) {
    console.error('Warranty registration error:', err);
    return corsError('Could not send the form', 500);
  }
}

/**
 * Resolve a review token (sent in the review-request email) to its order.
 * Tokens are random and single-purpose, so the link reveals nothing on its
 * own and cannot be guessed from an order id.
 */
async function orderForReviewToken(token, env) {
  if (!env.ORDERS || typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) return null;
  const orderId = await env.ORDERS.get(`reviewtoken:${token}`);
  if (!orderId) return null;
  return getOrder(env.ORDERS, orderId);
}

/** What the review page shows before submitting: item names only. */
async function handleReviewLookup(url, env) {
  const order = await orderForReviewToken(url.searchParams.get('t'), env);
  if (!order) return corsError('This review link has expired or is not valid', 404);

  const existing = await env.ORDERS.get(`review:${order.orderId}`);
  return corsResponse({
    items: (order.items || []).map((i) => i.name),
    alreadyReviewed: Boolean(existing),
  });
}

/**
 * Store a review for moderation. Nothing is published automatically.
 * Moderation may only remove reviews that are unlawful, abusive or not about
 * the product: the DMCC Act 2024 bans hiding genuine negative reviews.
 */
async function handleReviewSubmit(request, env) {
  try {
    const body = await request.json();
    const order = await orderForReviewToken(body.t, env);
    if (!order) return corsError('This review link has expired or is not valid', 404);

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return corsError('Please choose a star rating', 422);
    }

    const review = {
      orderId: order.orderId,
      items: (order.items || []).map((i) => i.name),
      rating,
      title: clip(body.title, 120),
      body: clip(body.body, 4000),
      displayName: clip(body.displayName, 60) || 'Verified buyer',
      trade: clip(body.trade, 60),
      verifiedPurchase: true,
      paidAt: order.paidAt,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    return storeAndNotify(env, `review:${order.orderId}`, review, {
      name: review.displayName,
      email: order.customerEmail || SUPPORT_FALLBACK,
      topic: `New ${rating}-star review (awaiting moderation)`,
      message: [
        `Order: ${order.orderId}`,
        `Items: ${review.items.join(', ')}`,
        `Rating: ${rating}/5`,
        `Trade: ${review.trade || 'not given'}`,
        '',
        review.title,
        review.body,
      ].join('\n'),
    });
  } catch (err) {
    console.error('Review submit error:', err);
    return corsError('Could not save the review', 500);
  }
}

const SUPPORT_FALLBACK = 'support@tugahardware.com';

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Determine the bulk discount percentage for a given total quantity.
 */
function getDiscountPercent(totalQty) {
  for (const tier of DISCOUNT_TIERS) {
    if (totalQty >= tier.min) return tier.percent;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * Implements the same algorithm as Stripe's official SDK.
 */
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  try {
    // Parse the signature header
    // Stripe can send several v1 signatures (e.g. while a secret is rolled).
    let timestamp = null;
    const signatures = [];
    for (const part of signatureHeader.split(',')) {
      const [key, value] = part.split('=');
      if (key.trim() === 't') timestamp = value;
      if (key.trim() === 'v1' && value) signatures.push(value);
    }

    if (!timestamp || signatures.length === 0) return false;

    // Reject events older than 5 minutes (300 seconds)
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false;

    // Compute expected signature: HMAC-SHA256(secret, timestamp + '.' + rawBody)
    const payload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    return signatures.some((sig) => timingSafeEqual(computedSig, sig));
  } catch (err) {
    console.error('Stripe signature verification error:', err);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Ask Stripe to email its own receipt for a payment.
 */
async function sendStripeReceipt(paymentIntentId, email, env) {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ receipt_email: email }).toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Stripe receipt failed: ${data.error?.message || res.status}`);
  }
}

async function findStripeSessionByPaymentIntent(paymentIntentId, env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntentId)}&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe session search failed: ${data.error?.message}`);
  return data.data?.[0]?.id ?? null;
}

/**
 * Fetch a Stripe Checkout Session (line items come from fetchStripeLineItems).
 */
async function fetchStripeSession(sessionId, env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
    }
  );
  return res.json();
}

/**
 * Every line item of a Checkout Session. `expand[]=line_items` stops at 10,
 * which a team order with plans and accessories can pass, so page through
 * the list endpoint instead.
 */
async function fetchStripeLineItems(sessionId, env) {
  const items = [];
  let startingAfter = null;
  // A basket holds at most a few dozen lines; the cap only guards a loop.
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ limit: '100' });
    if (startingAfter) params.set('starting_after', startingAfter);
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?${params}`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`Stripe line items lookup failed: ${data.error?.message || res.status}`);
    const pageItems = data.data || [];
    items.push(...pageItems);
    if (!data.has_more || pageItems.length === 0) break;
    startingAfter = pageItems[pageItems.length - 1].id;
  }
  return items;
}

// ---------------------------------------------------------------------------
// PayPal helpers
// ---------------------------------------------------------------------------

async function fetchPayPalOrder(orderId, env) {
  const accessToken = await getPayPalAccessToken(env);
  const res = await fetch(`${getPayPalBaseUrl(env)}/v2/checkout/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('PayPal order lookup failed:', JSON.stringify(data));
    throw new Error('PayPal order lookup failed');
  }
  return data;
}

/**
 * Determine the PayPal API base URL.
 * Uses sandbox unless PAYPAL_LIVE is set to 'true'.
 */
function getPayPalBaseUrl(env) {
  return env.PAYPAL_LIVE === 'true'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Get a PayPal OAuth2 access token.
 */
async function getPayPalAccessToken(env) {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);

  const res = await fetch(`${getPayPalBaseUrl(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

/**
 * Capture a PayPal order (finalise the payment).
 */
async function capturePayPalOrder(orderId, env) {
  const accessToken = await getPayPalAccessToken(env);

  const res = await fetch(`${getPayPalBaseUrl(env)}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('PayPal capture failed:', JSON.stringify(data));
    throw new Error('PayPal capture failed');
  }

  return data;
}

/**
 * Verify a PayPal webhook notification.
 * Uses the PayPal webhook verification API endpoint.
 */
async function verifyPayPalWebhook(request, rawBody, env) {
  try {
    const accessToken = await getPayPalAccessToken(env);

    const verifyPayload = {
      auth_algo: request.headers.get('paypal-auth-algo'),
      cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'),
      transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID || '',
      webhook_event: JSON.parse(rawBody),
    };

    const res = await fetch(`${getPayPalBaseUrl(env)}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyPayload),
    });

    const result = await res.json();
    return result.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('PayPal webhook verification error:', err);
    return false;
  }
}
