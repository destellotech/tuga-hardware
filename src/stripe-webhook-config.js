/* ============================================
   TUGA HARDWARE: keep the Stripe webhook subscribed to what the worker
   handles.

   Which events Stripe sends to /webhooks/stripe is configured in Stripe's
   dashboard, which only a person can open. When the code gains a handler
   (checkout.session.expired for saved-basket emails, src/api.js) that
   dashboard step is the one thing that can be forgotten, and nothing then
   arrives. So the daily cron reads the endpoint with the key the worker
   already holds and adds any event it handles but is not subscribed to.
   It never creates an endpoint, never removes an event, and leaves an
   endpoint subscribed to '*' alone. A restricted key without webhook
   write access makes the update fail; that is logged and the dashboard
   route still works.
   ============================================ */

/** Every event handleStripeWebhook (src/api.js) acts on. */
export const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded',
  'charge.dispute.created',
];

/** The endpoint that points at this site's /webhooks/stripe, www or bare. */
export function findSiteEndpoint(endpoints, siteUrl) {
  const target = `${siteUrl}/webhooks/stripe`;
  const accepted = new Set([target, target.replace('://www.', '://')]);
  return (endpoints || []).find((e) => accepted.has(e.url)) || null;
}

/** Required events the endpoint does not yet receive; none if it takes everything. */
export function missingEvents(endpoint, required = REQUIRED_EVENTS) {
  const have = endpoint?.enabled_events || [];
  if (have.includes('*')) return [];
  return required.filter((e) => !have.includes(e));
}

/**
 * Read the site's endpoint and add whatever is missing. Returns what it
 * did so a test or a digest can report it; throws nothing.
 */
export async function ensureStripeWebhookEvents(env, fetchFn = fetch) {
  if (!env.STRIPE_SECRET_KEY || !env.SITE_URL) return { ok: false, reason: 'not configured', added: [] };
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  try {
    const res = await fetchFn('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Stripe webhook check: Stripe rejected the request', res.status);
      return { ok: false, reason: `list ${res.status}`, added: [] };
    }
    const endpoint = findSiteEndpoint(data.data, env.SITE_URL);
    if (!endpoint) {
      console.warn(`Stripe webhook check: no endpoint points at ${env.SITE_URL}/webhooks/stripe`);
      return { ok: false, reason: 'no endpoint', added: [] };
    }
    const missing = missingEvents(endpoint);
    if (!missing.length) return { ok: true, endpoint: endpoint.id, added: [] };

    const params = new URLSearchParams();
    [...endpoint.enabled_events, ...missing].forEach((e, i) => params.append(`enabled_events[${i}]`, e));
    const upd = await fetchFn(`https://api.stripe.com/v1/webhook_endpoints/${encodeURIComponent(endpoint.id)}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!upd.ok) {
      console.error(`Stripe webhook check: could not add ${missing.join(', ')} to ${endpoint.id} (${upd.status})`);
      return { ok: false, reason: `update ${upd.status}`, endpoint: endpoint.id, added: [] };
    }
    console.log(`Stripe webhook ${endpoint.id}: now also receives ${missing.join(', ')}`);
    return { ok: true, endpoint: endpoint.id, added: missing };
  } catch (err) {
    console.error('Stripe webhook check failed:', err);
    return { ok: false, reason: 'error', added: [] };
  }
}
