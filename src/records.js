/* ============================================
   TUGA HARDWARE — Back-office records (KV Store)
   Customers, suppliers, purchase orders (goods in),
   sales orders (goods out) and the stock movement
   ledger. Same ORDERS namespace as web orders.
   ============================================ */

/**
 * Each record type: its KV prefix, how new ids look, and the short summary
 * kept in key metadata so a list is one list() call. KV caps metadata at
 * 1024 bytes, so summaries stay small.
 */
const short = (v, n = 60) => String(v ?? '').slice(0, n);

export const TYPES = {
  customers: {
    prefix: 'customer:',
    idPrefix: 'C-',
    pad: 4,
    meta: (r) => ({
      name: short(r.company || r.contacts?.[0]?.name),
      contact: short(r.contacts?.[0]?.name),
      email: short(r.contacts?.[0]?.email, 80),
    }),
  },
  suppliers: {
    prefix: 'supplier:',
    idPrefix: 'S-',
    pad: 4,
    meta: (r) => ({ name: short(r.name), contact: short(r.contact) }),
  },
  purchases: {
    prefix: 'purchase:',
    idPrefix: 'PO-',
    pad: 4,
    meta: (r) => ({
      supplierName: short(r.supplierName),
      supplierRef: short(r.supplierRef, 40),
      orderedAt: r.orderedAt || '',
      status: r.status,
      units: r.units || 0,
      received: r.received || 0,
      total: r.amountPaid || 0,
    }),
  },
  sales: {
    prefix: 'sale:',
    idPrefix: 'TUGA-',
    pad: 4,
    meta: (r) => ({
      customerName: short(r.customerName),
      orderedAt: r.orderedAt || '',
      status: r.status,
      units: r.units || 0,
      total: r.total || 0,
    }),
  },
};

export const PURCHASE_STATUSES = {
  ordered: 'Ordered',
  part_received: 'Part received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const SALE_STATUSES = {
  quote: 'Quote',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const MOVE_TYPES = { in: 'Goods in', out: 'Goods out', return: 'Return', adjust: 'Adjustment' };

export async function getRecord(kv, type, id) {
  const raw = await kv.get(`${TYPES[type].prefix}${id}`);
  return raw ? JSON.parse(raw) : null;
}

export async function putRecord(kv, type, record) {
  record.updatedAt = new Date().toISOString();
  if (!record.createdAt) record.createdAt = record.updatedAt;
  await kv.put(`${TYPES[type].prefix}${record.id}`, JSON.stringify(record), { metadata: TYPES[type].meta(record) });
  return record;
}

export async function deleteRecord(kv, type, id) {
  await kv.delete(`${TYPES[type].prefix}${id}`);
}

async function listKeys(kv, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

/** Every record of a type as { id, ...summary }. */
export async function listRecords(kv, type) {
  const { prefix } = TYPES[type];
  return (await listKeys(kv, prefix)).map((k) => ({ id: k.name.slice(prefix.length), ...(k.metadata || {}) }));
}

/**
 * The next id for a type: one past the highest number in use. Fine for one
 * person working at a time; KV has no atomic counter.
 */
export async function nextId(kv, type) {
  const { idPrefix, pad } = TYPES[type];
  let max = 0;
  for (const r of await listRecords(kv, type)) {
    const n = r.id.startsWith(idPrefix) ? parseInt(r.id.slice(idPrefix.length), 10) : NaN;
    if (n > max) max = n;
  }
  return idPrefix + String(max + 1).padStart(pad, '0');
}

// ---------------------------------------------------------------------------
// Stock movement ledger: one entry per unit per movement, never edited.
// ---------------------------------------------------------------------------
const MOVE_PREFIX = 'move:';

/**
 * @param {{type: string, serial: string, model: string, ref?: string,
 *          party?: string, note?: string, at?: string, cost?: number, price?: number}} move
 */
export async function recordMove(kv, move) {
  const at = move.at || new Date().toISOString();
  const entry = { ...move, at, loggedAt: new Date().toISOString() };
  const key = `${MOVE_PREFIX}${at}:${move.serial}:${Math.random().toString(36).slice(2, 6)}`;
  const meta = {
    type: entry.type,
    serial: short(entry.serial, 40),
    model: short(entry.model, 30),
    ref: short(entry.ref, 40),
    party: short(entry.party),
    note: short(entry.note, 120),
    at,
  };
  await kv.put(key, JSON.stringify(entry), { metadata: meta });
  return entry;
}

/** All movements, newest first, from key metadata alone. */
export async function listMoves(kv) {
  return (await listKeys(kv, MOVE_PREFIX))
    .map((k) => ({ ...(k.metadata || {}) }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

/**
 * Landed cost per unit for each purchase line: the amount actually paid
 * (goods, shipping, import tax, fees) split across lines by their value.
 * Destello is not VAT registered, so import VAT is a cost, not reclaimable.
 */
export function landedUnitCosts(po) {
  const goods = (po.lines || []).reduce((s, l) => s + (l.unitCost || 0) * (l.qty || 0), 0);
  const paid = po.amountPaid || goods + (po.shipping || 0) + (po.tax || 0) + (po.fees || 0);
  return (po.lines || []).map((l) => {
    if (!goods || !l.qty) return 0;
    const share = ((l.unitCost || 0) * l.qty) / goods;
    return Math.round((paid * share) / l.qty);
  });
}
