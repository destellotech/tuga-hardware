/* ============================================
   TUGA HARDWARE — Order Management (KV Store)
   CRUD operations for orders stored in
   Cloudflare Workers KV.
   ============================================ */

// Key prefix keeps the namespace tidy if the KV is shared
const PREFIX = 'order:';
const REF_PREFIX = 'ref:';

// ---------------------------------------------------------------------------
// Customer-facing order numbers
// ---------------------------------------------------------------------------
// The provider ids (cs_live_a1B2…, 5O190127TN…) are unreadable over the
// phone. Customers get TUGA-XXXX-XXXX instead. The alphabet has 32 symbols
// with 0/O and 1/I removed, so a reference survives being read aloud, and
// 32 divides 256 so a random byte maps onto it without bias.
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const REF_PATTERN = /^TUGA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

const formatReference = (bytes) => {
  const chars = Array.from(bytes.slice(0, 8), (b) => REF_ALPHABET[b % 32]).join('');
  return `TUGA-${chars.slice(0, 4)}-${chars.slice(4)}`;
};

/**
 * A fresh reference, chosen when checkout starts and stored with the payment
 * provider (Stripe metadata, PayPal invoice_id). The webhook and the return
 * page then both read the same value back, however they race.
 */
export function newOrderReference() {
  return formatReference(crypto.getRandomValues(new Uint8Array(8)));
}

/** True for a well-formed reference, e.g. one read back from a provider. */
export const isOrderReference = (value) =>
  typeof value === 'string' && REF_PATTERN.test(value);

/**
 * Deterministic fallback for a payment that carries no reference: one started
 * before references existed. Same provider id in, same reference out.
 */
export async function referenceFromOrderId(orderId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(orderId)));
  return formatReference(new Uint8Array(digest));
}

/**
 * Save an order to KV.
 * Also adds the order ID to a pending-orders index for quick listing.
 *
 * @param {KVNamespace} kv  - The bound ORDERS KV namespace
 * @param {string} orderId  - Unique order identifier (e.g. Stripe session ID)
 * @param {object} orderData - Full order payload
 */
export async function saveOrder(kv, orderId, orderData) {
  const record = {
    ...orderData,
    orderId,
    createdAt: new Date().toISOString(),
    status: orderData.status || 'pending',
  };

  // Store the order itself (expire after 90 days if desired)
  await kv.put(`${PREFIX}${orderId}`, JSON.stringify(record));

  // Index by the customer-facing number, so support can find an order in the
  // KV dashboard: key ref:TUGA-XXXX-XXXX holds the provider's order id.
  if (record.reference) {
    await kv.put(`${REF_PREFIX}${record.reference}`, orderId);
  }

  // Maintain a simple pending-orders index.
  // Workers KV does not support queries, so we keep a list of pending IDs.
  if (record.status === 'pending') {
    await addToPendingIndex(kv, orderId);
  }

  return record;
}

/**
 * Retrieve a single order by ID.
 */
export async function getOrder(kv, orderId) {
  const raw = await kv.get(`${PREFIX}${orderId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

/**
 * Update an existing order (partial update — merges fields).
 */
export async function updateOrder(kv, orderId, updates) {
  const existing = await getOrder(kv, orderId);
  if (!existing) throw new Error(`Order not found: ${orderId}`);

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await kv.put(`${PREFIX}${orderId}`, JSON.stringify(updated));

  if (updates.reference) {
    await kv.put(`${REF_PREFIX}${updates.reference}`, orderId);
  }

  // If status changed away from pending, remove from the pending index
  if (existing.status === 'pending' && updated.status !== 'pending') {
    await removeFromPendingIndex(kv, orderId);
  }

  return updated;
}

/**
 * List all orders currently awaiting fulfilment.
 * Returns an array of order objects.
 */
export async function listPendingOrders(kv) {
  const index = await getPendingIndex(kv);
  const orders = [];

  for (const id of index) {
    const order = await getOrder(kv, id);
    if (order && order.status === 'pending') {
      orders.push(order);
    }
  }

  return orders;
}

// ---------------------------------------------------------------------------
// Pending-orders index helpers
// ---------------------------------------------------------------------------
const PENDING_KEY = 'index:pending';

async function getPendingIndex(kv) {
  const raw = await kv.get(PENDING_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function addToPendingIndex(kv, orderId) {
  const index = await getPendingIndex(kv);
  if (!index.includes(orderId)) {
    index.push(orderId);
    await kv.put(PENDING_KEY, JSON.stringify(index));
  }
}

async function removeFromPendingIndex(kv, orderId) {
  const index = await getPendingIndex(kv);
  const filtered = index.filter(id => id !== orderId);
  await kv.put(PENDING_KEY, JSON.stringify(filtered));
}
