/* ============================================
   TUGA HARDWARE — Order Management (KV Store)
   CRUD operations for orders stored in
   Cloudflare Workers KV.
   ============================================ */

// Key prefix keeps the namespace tidy if the KV is shared
const PREFIX = 'order:';

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
