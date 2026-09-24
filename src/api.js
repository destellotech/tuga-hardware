/* ============================================
   TUGA HARDWARE — API Route Handler
   Stripe Checkout, PayPal Orders, Webhooks.
   All calls use native fetch — zero npm deps.
   ============================================ */

import { sendOrderConfirmation, sendShippingNotification, sendBuyersGuide, sendEnquiry } from './email.js';
import {
  saveOrder,
  getOrder,
  updateOrder,
  listPendingOrders,
  getOrderByReference,
  newOrderReference,
  isOrderReference,
  referenceFromOrderId,
} from './orders.js';

// ---------------------------------------------------------------------------
// Product catalogue (prices in pence / GBP)
// ---------------------------------------------------------------------------
// Generated from data/products.json by the build, so the prices charged can
// never drift from the prices shown. The client sends only ids and
// quantities; every order is re-priced here so a tampered basket cannot
// change what gets charged.
import { PRODUCTS } from './catalogue.generated.js';

/**
 * Normalise a client basket into priced lines.
 *
 * The client only ever sends ids and quantities — prices come from PRODUCTS
 * above, so a tampered basket cannot change what is charged. Accepts both
 * `id` and `productId` for the item key.
 *
 * @throws BasketError if an id is unknown, an item is out of stock, or a
 *   quantity is not a sane integer. Its message is safe to show the customer.
 */
function resolveBasket(items) {
  return items.map((item) => {
    const id = item.productId ?? item.id;
    const product = Object.hasOwn(PRODUCTS, id) ? PRODUCTS[id] : null;
    if (!product) throw new BasketError('Your basket has an item we no longer sell. Remove it and try again');
    if (product.stock === 'out_of_stock') {
      throw new BasketError(`${product.name} is out of stock. Remove it from your basket to check out`);
    }

    // A missing quantity means 1; anything else must be a sane integer.
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new BasketError(`The quantity for ${product.name} must be between 1 and 99`);
    }

    return { id, product, quantity };
  });
}

/** Where we deliver. Stripe enforces it at checkout; PayPal is checked
 *  before capture, since its checkout accepts any address. Keep in step with
 *  the Shipping & Returns page and the Terms. */
const DELIVERY_COUNTRIES = ['GB', 'IE'];

/** A problem with the basket itself, as opposed to a payment provider. */
class BasketError extends Error {}

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

  // Per-visitor limit on the routes that send email or call a payment
  // provider, so a script cannot flood support's inbox or Stripe's API.
  const limitedRoutes = ['/api/create-checkout-session', '/api/create-paypal-order', '/api/contact', '/api/subscribe'];
  if (request.method === 'POST' && limitedRoutes.includes(path) && (await isRateLimited(request, env, path))) {
    return corsError('Too many attempts. Please wait a minute and try again', 429);
  }

  // --- API routes ---
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
  if (request.method === 'GET' && path === '/api/payment-methods') {
    return corsResponse({ card: true, paypal: isPayPalLive(env) });
  }

  // --- Owner-only routes: need `Authorization: Bearer <ADMIN_TOKEN>` ---
  // The preflight checks reveal live/test mode and which secrets are set,
  // so they sit behind the token with the order tools.
  const adminRoutes = {
    'GET /api/paypal-check': () => handlePayPalCheck(request, env),
    'GET /api/email-check': () => handleEmailCheck(env),
    'GET /api/stripe-check': () => handleStripeCheck(env),
    'GET /api/admin/orders': () => handleListOrders(env),
    'POST /api/admin/ship': () => handleMarkShipped(request, env),
  };
  const adminRoute = adminRoutes[`${request.method} ${path}`];
  if (adminRoute) {
    const denied = checkAdmin(request, env);
    return denied || adminRoute();
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

    // The customer-facing order number, fixed now so it can go on the
    // invoice and the card statement description as well as our email.
    const reference = newOrderReference();
    const vatRateId = await getInclusiveVatRateId(env);

    // Create Stripe Checkout Session via the API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${env.SITE_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${env.SITE_URL}/cart`);
    // No payment_method_types: the Stripe dashboard decides which methods
    // to offer (cards, wallets, Link, pay-later, bank methods). Methods that
    // settle later arrive via checkout.session.async_payment_succeeded.
    DELIVERY_COUNTRIES.forEach((country, i) =>
      params.append(`shipping_address_collection[allowed_countries][${i}]`, country));

    // Couriers want a phone number for a parcel this valuable.
    params.append('phone_number_collection[enabled]', 'true');

    // Trade buyers reclaim VAT: let them add a business name and VAT number,
    // and issue a proper invoice they can download after paying.
    params.append('tax_id_collection[enabled]', 'true');
    params.append('invoice_creation[enabled]', 'true');
    params.append('invoice_creation[invoice_data][custom_fields][0][name]', 'Order number');
    params.append('invoice_creation[invoice_data][custom_fields][0][value]', reference);
    params.append('invoice_creation[invoice_data][metadata][order_ref]', reference);

    params.append('client_reference_id', reference);
    params.append('metadata[order_ref]', reference);
    params.append('payment_intent_data[description]', `Tuga Hardware order ${reference}`);
    params.append('payment_intent_data[metadata][order_ref]', reference);

    // Encode each line item
    lineItems.forEach((li, i) => {
      params.append(`line_items[${i}][price_data][currency]`, li.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, li.price_data.unit_amount);
      params.append(`line_items[${i}][quantity]`, li.quantity);
      // An INCLUSIVE rate itemises the VAT already in the price on the
      // invoice without changing what is charged.
      if (vatRateId) params.append(`line_items[${i}][tax_rates][0]`, vatRateId);
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
    if (err instanceof BasketError) return corsError(err.message, 409);
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

    // Customer-facing order number. PayPal shows invoice_id in the payer's
    // receipt and the merchant dashboard, and hands it back on every lookup.
    const reference = newOrderReference();

    // Create PayPal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        invoice_id: reference,
        description: `Tuga Hardware order ${reference}`,
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
    if (err instanceof BasketError) return corsError(err.message, 409);
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
 * Save and email an order unless it has already been recorded.
 * Returns the stored record.
 */
async function recordOrder(env, orderDetails) {
  let record = null;
  if (env.ORDERS) {
    record = await getOrder(env.ORDERS, orderDetails.orderId);

    // An order first recorded before these fields existed, or before Stripe
    // had finalised its invoice, picks them up on the next confirmation.
    if (record) {
      const backfill = {};
      for (const key of ['reference', 'invoiceUrl']) {
        if (!record[key] && orderDetails[key]) backfill[key] = orderDetails[key];
      }
      if (Object.keys(backfill).length) {
        record = { ...record, ...backfill };
        await updateOrder(env.ORDERS, orderDetails.orderId, backfill)
          .catch((err) => console.error('Could not backfill order:', err));
      }
    }

    // Recorded and emailed already: nothing to do. Recorded but never
    // emailed (e.g. the email service was down): fall through and retry
    // the email only.
    if (record?.emailSentAt) return record;
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
    let emailVia = null;

    if (env.RESEND_API_KEY) {
      try {
        await sendOrderConfirmation(env, orderDetails.customerEmail, orderDetails);
        emailVia = 'resend';
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
    if (!emailVia && orderDetails.provider === 'stripe' && orderDetails.paymentIntent) {
      try {
        await sendStripeReceipt(orderDetails.paymentIntent, orderDetails.customerEmail, env);
        emailVia = 'stripe-receipt';
      } catch (err) {
        console.error('Stripe receipt fallback failed:', err);
      }
    }

    if (emailVia) {
      record = { ...record, emailSentAt: new Date().toISOString(), emailVia };
      if (env.ORDERS) {
        await updateOrder(env.ORDERS, orderDetails.orderId, { emailSentAt: record.emailSentAt, emailVia })
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
  if (session.payment_status !== 'paid') {
    // A completed session that is not yet paid used a method that settles
    // later (e.g. a bank debit). The order is placed; the money is not in.
    return { paid: false, processing: session.status === 'complete' };
  }

  // Newer Stripe API versions moved shipping under collected_information.
  const shipping = session.collected_information?.shipping_details || session.shipping_details;
  const customer = session.customer_details || {};

  // Sessions started before order numbers existed carry no order_ref; derive
  // one from the session id so every retry lands on the same number.
  const reference = isOrderReference(session.metadata?.order_ref)
    ? session.metadata.order_ref
    : await referenceFromOrderId(session.id);

  // Expanded below; null until Stripe finalises it, which is normally done
  // by the time the session reports paid.
  const invoice = session.invoice && typeof session.invoice === 'object' ? session.invoice : null;

  const order = await recordOrder(env, {
    orderId: session.id,
    reference,
    provider: 'stripe',
    paymentIntent: session.payment_intent,
    customerEmail: customer.email,
    customerPhone: customer.phone || null,
    businessName: customer.business_name || null,
    taxIds: (customer.tax_ids || []).map(({ type, value }) => ({ type, value })),
    invoiceId: invoice?.id ?? null,
    invoiceUrl: invoice?.hosted_invoice_url ?? null,
    shippingAddress: shipping?.address
      ? { name: shipping.name, ...shipping.address }
      : null,
    items: session.line_items?.data?.map(li => ({
      name: li.description,
      quantity: li.quantity,
      unitPrice: li.price?.unit_amount || li.amount_total / li.quantity,
      total: li.amount_total,
    })) || [],
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

  // PayPal lets the buyer pick any address. Refuse before taking the money,
  // rather than refunding an order we cannot deliver.
  const country = order.purchase_units?.[0]?.shipping?.address?.country_code;
  if (order.status === 'APPROVED' && country && !DELIVERY_COUNTRIES.includes(country)) {
    console.warn(`PayPal order ${orderId} not captured: delivery to ${country} is not offered`);
    return { paid: false, undeliverable: country };
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

  const reference = isOrderReference(purchaseUnit.invoice_id)
    ? purchaseUnit.invoice_id
    : await referenceFromOrderId(order.id);

  const record = await recordOrder(env, {
    orderId: order.id,
    reference,
    provider: 'paypal',
    captureId: purchaseUnit.payments?.captures?.[0]?.id,
    customerEmail: order.payer?.email_address,
    customerPhone: order.payer?.phone?.phone_number?.national_number || null,
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

    if (result.undeliverable) return corsResponse({ status: 'undeliverable' });
    if (!result.paid) return corsResponse({ status: result.processing ? 'processing' : 'unpaid' });

    // Only what the confirmation page shows: no address or email.
    const { order } = result;
    return corsResponse({
      status: 'confirmed',
      reference: order.reference ?? null,
      invoiceUrl: order.invoiceUrl ?? null,
      provider: order.provider,
      total: order.total,
      currency: order.currency,
      emailSent: Boolean(order.emailSentAt),
      emailVia: order.emailVia ?? null,
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

  // completed: paid now, or placed with a method that settles later.
  // async_payment_succeeded: one of those later payments has cleared.
  // recordStripeOrder only records a session once it is actually paid.
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    try {
      await recordStripeOrder(event.data.object.id, env);
    } catch (err) {
      // A 500 makes Stripe retry, which is what we want for a transient failure.
      console.error('Stripe webhook error:', err);
      return corsError('Could not record order', 500);
    }
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    // Nothing was charged and nothing was recorded; leave a trail in the logs
    // so a customer asking about it can be answered.
    const session = event.data.object;
    console.error('Delayed payment failed:', session.metadata?.order_ref || session.id, session.customer_details?.email || '');
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

/**
 * True when this visitor has used a limited route too often. Uses the
 * FORM_LIMITER rate-limiting binding in wrangler.toml; without it (local
 * dev, tests) nothing is limited. A limiter failure lets the request through
 * rather than blocking a real customer.
 */
async function isRateLimited(request, env, route) {
  if (!env.FORM_LIMITER) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  try {
    const { success } = await env.FORM_LIMITER.limit({ key: `${route}:${ip}` });
    return !success;
  } catch (err) {
    console.error('Rate limiter error:', err);
    return false;
  }
}

// =========================================================================
// OWNER TOOLS
// =========================================================================
//
//   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://www.tugahardware.com/api/admin/orders
//
//   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
//     -d '{"reference":"TUGA-7K3M-9QX2","trackingNumber":"AB123456789GB","carrier":"Royal Mail"}' \
//     https://www.tugahardware.com/api/admin/ship

/** Null when the request carries the admin token, else the response to send. */
function checkAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return corsError('Owner tools are off: set the ADMIN_TOKEN secret to use them', 503);
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return corsError('Unauthorized', 401);
  }
  return null;
}

/** Orders awaiting dispatch, oldest first, with what is needed to ship them. */
async function handleListOrders(env) {
  if (!env.ORDERS) return corsError('Order storage is not configured', 503);
  const orders = await listPendingOrders(env.ORDERS);
  orders.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return corsResponse({
    count: orders.length,
    orders: orders.map((o) => ({
      reference: o.reference ?? null,
      placedAt: o.paidAt ?? o.createdAt,
      provider: o.provider,
      email: o.customerEmail ?? null,
      phone: o.customerPhone ?? null,
      businessName: o.businessName ?? null,
      shippingAddress: o.shippingAddress ?? null,
      items: (o.items || []).map(({ name, quantity }) => ({ name, quantity })),
      total: o.total,
      currency: o.currency,
      confirmationEmailSent: Boolean(o.emailSentAt),
    })),
  });
}

/**
 * Mark an order shipped and email the customer its tracking number.
 * Repeating the same call does not email twice; pass "resend": true to.
 */
async function handleMarkShipped(request, env) {
  if (!env.ORDERS) return corsError('Order storage is not configured', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return corsError('Send a JSON body');
  }
  const reference = String(body.reference || '').trim().toUpperCase();
  const trackingNumber = String(body.trackingNumber || '').trim();
  const carrier = String(body.carrier || '').trim().slice(0, 60);

  if (!isOrderReference(reference)) return corsError('reference must look like TUGA-XXXX-XXXX', 422);
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{3,39}$/.test(trackingNumber)) {
    return corsError('trackingNumber must be 4 to 40 letters, digits, spaces or hyphens', 422);
  }

  const order = await getOrderByReference(env.ORDERS, reference);
  if (!order) return corsError(`No order ${reference}`, 404);
  if (!order.customerEmail) return corsError(`Order ${reference} has no customer email`, 409);

  const alreadySent = order.shippingEmailSentAt && order.trackingNumber === trackingNumber;
  if (alreadySent && body.resend !== true) {
    return corsResponse({ ok: true, reference, status: order.status, emailed: false, note: 'Already marked shipped with this tracking number' });
  }

  // Record the dispatch first: the parcel has gone whether or not the email does.
  await updateOrder(env.ORDERS, order.orderId, {
    status: 'shipped',
    shippedAt: order.shippedAt ?? new Date().toISOString(),
    trackingNumber,
    carrier: carrier || null,
  });

  try {
    await sendShippingNotification(env, order.customerEmail, { reference, trackingNumber, carrier });
  } catch (err) {
    console.error('Shipping email failed:', err);
    return corsResponse({ ok: false, reference, status: 'shipped', emailed: false, error: 'Marked shipped, but the email did not send. Call again with "resend": true.' }, 502);
  }

  await updateOrder(env.ORDERS, order.orderId, { shippingEmailSentAt: new Date().toISOString() })
    .catch((err) => console.error('Could not mark shipping email sent:', err));

  return corsResponse({ ok: true, reference, status: 'shipped', emailed: true });
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
    const { name, email, topic, message, website } = await request.json();

    // Honeypot: real users never fill a hidden field.
    if (website) return corsResponse({ ok: true });

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsError('A valid email address is required', 422);
    }
    if (!message || message.trim().length < 5) {
      return corsError('Please include a message', 422);
    }

    const enquiry = {
      name: String(name || '').slice(0, 120),
      email: String(email).slice(0, 160),
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

    try {
      await sendEnquiry(env, enquiry);
    } catch (mailErr) {
      console.error('Enquiry email failed:', mailErr);
      // Only fail the request if the message is now nowhere at all.
      if (!stored) return corsError('Could not send the message', 500);
    }

    return corsResponse({ ok: true });
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
    const listensAsync = endpoint && (endpoint.enabled_events.includes('*') ||
      endpoint.enabled_events.includes('checkout.session.async_payment_succeeded'));

    // Optional: whether invoices will itemise VAT (see getInclusiveVatRateId).
    let vatRate = 'not set: invoices show totals without a VAT line';
    if (env.STRIPE_VAT_RATE_ID) {
      try {
        const rate = await fetchStripeTaxRate(env.STRIPE_VAT_RATE_ID, env);
        vatRate = isUsableVatRate(rate)
          ? 'ok: active, inclusive 20%'
          : `refused: must be active, inclusive and 20% (active=${rate.active}, inclusive=${rate.inclusive}, percentage=${rate.percentage})`;
      } catch {
        vatRate = 'refused: Stripe could not find that tax rate';
      }
    }

    return corsResponse({
      vatRate,
      ok: Boolean(endpoint && endpoint.status === 'enabled' && listens),
      mode: env.STRIPE_SECRET_KEY.startsWith('sk_live_') || env.STRIPE_SECRET_KEY.startsWith('rk_live_') ? 'live' : 'test',
      endpointFound: Boolean(endpoint),
      endpointStatus: endpoint?.status ?? null,
      listensForCheckoutCompleted: Boolean(listens),
      // Without this, orders paid by a method that settles later (bank
      // debits) are only recorded if the customer returns to the site.
      listensForAsyncPaymentSucceeded: Boolean(listensAsync),
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
 * Buyer's-guide signup: emails the guide and keeps the address in KV, so
 * there is a list to export later and an unsent guide can be sent by hand.
 */
async function handleSubscribe(request, env) {
  try {
    const { email } = await request.json();
    if (typeof email !== 'string' || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsError('A valid email address is required', 422);
    }

    const key = `subscriber:${email.toLowerCase()}`;
    const existing = env.ORDERS ? JSON.parse((await env.ORDERS.get(key)) || 'null') : null;
    const record = { email, createdAt: existing?.createdAt ?? new Date().toISOString(), guideSentAt: existing?.guideSentAt ?? null };

    // Once a day per address at most: the form must not become a way to fill
    // a stranger's inbox. A repeat signup inside the window is told it was sent.
    const sentRecently = record.guideSentAt && Date.now() - Date.parse(record.guideSentAt) < 24 * 3600 * 1000;

    let sent = Boolean(sentRecently);
    if (!sentRecently && env.RESEND_API_KEY) {
      try {
        await sendBuyersGuide(env, email);
        record.guideSentAt = new Date().toISOString();
        sent = true;
      } catch (err) {
        console.error("Buyer's guide email failed:", err);
      }
    }

    // Keep the address either way, so an unsent guide can be sent by hand.
    if (env.ORDERS) await env.ORDERS.put(key, JSON.stringify(record));

    if (!sent && !env.ORDERS) return corsError('Could not send the guide', 502);
    return corsResponse({ ok: true, sent });
  } catch (err) {
    console.error('Subscribe error:', err);
    return corsError('Could not subscribe', 500);
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
 * The Stripe Tax Rate to itemise VAT on invoices, or null.
 *
 * Optional: set STRIPE_VAT_RATE_ID to a rate created in the Stripe dashboard
 * as 20% VAT, INCLUSIVE, GB. Prices on the site already include VAT, so an
 * inclusive rate only splits it out on the invoice. An exclusive rate would
 * add 20% on top of the basket total, so anything but an active inclusive
 * rate is refused here and checkout carries on without one.
 *
 * Cached per isolate: the rate is looked up once, not on every checkout.
 */
let vatRateCache = null;

async function getInclusiveVatRateId(env) {
  if (!env.STRIPE_VAT_RATE_ID) return null;
  if (vatRateCache?.id === env.STRIPE_VAT_RATE_ID) return vatRateCache.usable ? vatRateCache.id : null;

  try {
    const rate = await fetchStripeTaxRate(env.STRIPE_VAT_RATE_ID, env);
    const usable = isUsableVatRate(rate);
    if (!usable) {
      console.error('STRIPE_VAT_RATE_ID is not an active, inclusive 20% rate; invoices will not itemise VAT.');
    }
    vatRateCache = { id: env.STRIPE_VAT_RATE_ID, usable };
    return usable ? env.STRIPE_VAT_RATE_ID : null;
  } catch (err) {
    // Do not cache a network failure; try again on the next checkout.
    console.error('Could not look up the VAT rate:', err);
    return null;
  }
}

const isUsableVatRate = (rate) =>
  Boolean(rate && rate.active && rate.inclusive === true && Number(rate.percentage) === 20);

async function fetchStripeTaxRate(id, env) {
  const res = await fetch(`https://api.stripe.com/v1/tax_rates/${encodeURIComponent(id)}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe tax rate lookup failed: ${data.error?.message || res.status}`);
  return data;
}

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
 * Fetch a Stripe Checkout Session with expanded line items.
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

async function fetchStripeSession(sessionId, env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items&expand[]=invoice`,
    {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
    }
  );
  return res.json();
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
