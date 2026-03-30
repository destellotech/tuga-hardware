/* ============================================
   TUGA HARDWARE — API Route Handler
   Stripe Checkout, PayPal Orders, Webhooks.
   All calls use native fetch — zero npm deps.
   ============================================ */

import { sendOrderConfirmation } from './email.js';
import { saveOrder } from './orders.js';

// ---------------------------------------------------------------------------
// Product catalogue (prices in pence / GBP)
// ---------------------------------------------------------------------------
const PRODUCTS = {
  'tuga-h6':            { name: 'Tuga H6',                        price: 36900 },
  'tuga-t8':            { name: 'Tuga T8',                        price: 44900 },
  'tuga-t10':           { name: 'Tuga T10',                       price: 29900 },
  'tuga-wh6':           { name: 'Tuga WH6',                       price: 79900 },
  'tuga-w8':            { name: 'Tuga W8',                        price: 62900 },
  'tuga-w10':           { name: 'Tuga W10',                       price: 64900 },
  'tuga-wh6-scanner':   { name: 'Tuga WH6 with Barcode Scanner',  price: 87900 },
  'tuga-w8-scanner':    { name: 'Tuga W8 with 2D Scanner',        price: 69900 },
  'tuga-w10-scanner':   { name: 'Tuga W10 with 2D Scanner',       price: 72900 },
};

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
  if (request.method === 'POST' && path === '/api/create-checkout-session') {
    return handleStripeCheckout(request, env);
  }
  if (request.method === 'POST' && path === '/api/create-paypal-order') {
    return handlePayPalOrder(request, env);
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

    // Validate items and compute total quantity for bulk discount
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const discountPercent = getDiscountPercent(totalQty);

    // Build Stripe line items
    const lineItems = items.map(item => {
      const product = PRODUCTS[item.productId];
      if (!product) throw new Error(`Unknown product: ${item.productId}`);

      // Apply bulk discount to unit price
      const unitPrice = Math.round(product.price * (1 - discountPercent / 100));

      return {
        price_data: {
          currency: 'gbp',
          product_data: { name: product.name },
          unit_amount: unitPrice,
        },
        quantity: item.quantity || 1,
      };
    });

    // Create Stripe Checkout Session via the API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${env.SITE_URL}/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${env.SITE_URL}/cart.html`);
    params.append('payment_method_types[0]', 'card');
    params.append('shipping_address_collection[allowed_countries][0]', 'GB');
    params.append('shipping_address_collection[allowed_countries][1]', 'IE');

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
    console.error('Stripe checkout handler error:', err);
    return corsError('Internal server error', 500);
  }
}

// =========================================================================
// 2. PAYPAL CREATE ORDER
// =========================================================================
async function handlePayPalOrder(request, env) {
  try {
    const { items, discount, total } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return corsError('Cart is empty');
    }

    // Validate and recalculate server-side (never trust the client total)
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const discountPercent = getDiscountPercent(totalQty);

    let subtotalPence = 0;
    const paypalItems = items.map(item => {
      const product = PRODUCTS[item.productId];
      if (!product) throw new Error(`Unknown product: ${item.productId}`);

      const qty = item.quantity || 1;
      const unitPrice = Math.round(product.price * (1 - discountPercent / 100));
      subtotalPence += unitPrice * qty;

      return {
        name: product.name,
        unit_amount: {
          currency_code: 'GBP',
          value: (unitPrice / 100).toFixed(2),
        },
        quantity: String(qty),
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
        return_url: `${env.SITE_URL}/order-confirmation.html?provider=paypal`,
        cancel_url: `${env.SITE_URL}/cart.html`,
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
    console.error('PayPal order handler error:', err);
    return corsError('Internal server error', 500);
  }
}

// =========================================================================
// 3. STRIPE WEBHOOK
// =========================================================================
async function handleStripeWebhook(request, env) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return corsError('Missing Stripe signature', 400);
    }

    // Verify the webhook signature
    const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return corsError('Invalid signature', 401);
    }

    const event = JSON.parse(rawBody);

    // We only care about successful payments
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Retrieve the full session with line items from Stripe
      const fullSession = await fetchStripeSession(session.id, env);

      const orderDetails = {
        orderId: session.id,
        provider: 'stripe',
        paymentIntent: session.payment_intent,
        customerEmail: session.customer_details?.email,
        shippingAddress: session.shipping_details?.address
          ? {
              name: session.shipping_details.name,
              ...session.shipping_details.address,
            }
          : null,
        items: fullSession.line_items?.data?.map(li => ({
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
      };

      console.log('Stripe order received:', orderDetails.orderId);

      // Save to KV (if the binding exists)
      if (env.ORDERS) {
        await saveOrder(env.ORDERS, orderDetails.orderId, orderDetails);
      }

      // Send confirmation email
      if (orderDetails.customerEmail && env.RESEND_API_KEY) {
        try {
          await sendOrderConfirmation(env, orderDetails.customerEmail, orderDetails);
        } catch (emailErr) {
          // Log but do not fail the webhook — payment is already captured
          console.error('Email send failed:', emailErr);
        }
      }
    }

    // Always return 200 to Stripe so it does not retry
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    // Still return 200 to avoid Stripe retries on transient errors
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// =========================================================================
// 4. PAYPAL WEBHOOK
// =========================================================================
async function handlePayPalWebhook(request, env) {
  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);

    // Verify the webhook with PayPal
    const isValid = await verifyPayPalWebhook(request, rawBody, env);
    if (!isValid) {
      console.error('PayPal webhook verification failed');
      return corsError('Invalid webhook', 401);
    }

    // Handle order capture completion
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = event.resource;

      // For PAYMENT.CAPTURE.COMPLETED, the resource is the capture object
      // For CHECKOUT.ORDER.APPROVED, we need to capture the order first
      if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
        await capturePayPalOrder(resource.id, env);
      }

      const purchaseUnit = resource.purchase_units?.[0] || {};
      const payer = resource.payer || {};
      const shipping = purchaseUnit.shipping || {};

      const orderDetails = {
        orderId: resource.id,
        provider: 'paypal',
        customerEmail: payer.email_address,
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
      };

      console.log('PayPal order received:', orderDetails.orderId);

      // Save to KV
      if (env.ORDERS) {
        await saveOrder(env.ORDERS, orderDetails.orderId, orderDetails);
      }

      // Send confirmation email
      if (orderDetails.customerEmail && env.RESEND_API_KEY) {
        try {
          await sendOrderConfirmation(env, orderDetails.customerEmail, orderDetails);
        } catch (emailErr) {
          console.error('Email send failed:', emailErr);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
 * Verify Stripe webhook signature using HMAC-SHA256.
 * Implements the same algorithm as Stripe's official SDK.
 */
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  try {
    // Parse the signature header
    const parts = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key.trim()] = value;
      return acc;
    }, {});

    const timestamp = parts.t;
    const expectedSig = parts.v1;

    if (!timestamp || !expectedSig) return false;

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
    return timingSafeEqual(computedSig, expectedSig);
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
async function fetchStripeSession(sessionId, env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`,
    {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
    }
  );
  return res.json();
}

// ---------------------------------------------------------------------------
// PayPal helpers
// ---------------------------------------------------------------------------

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
