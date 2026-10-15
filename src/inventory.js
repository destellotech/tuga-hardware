/* ============================================
   TUGA HARDWARE — Device Inventory (KV Store)
   One record per physical unit, keyed by serial
   number, in the same ORDERS namespace as orders.
   ============================================ */

const PREFIX = 'device:';
// IMEI → serial pointers, so a label scanned twice is caught as a duplicate.
const IMEI_PREFIX = 'imei:';

export const DEVICE_STATUSES = {
  in_stock: 'In stock',
  reserved: 'Reserved',
  assigned: 'Assigned',
  sold: 'Sold',
  returned: 'Returned',
  faulty: 'Faulty',
};

/**
 * Facts stored as KV key metadata so the stock list is one list() call
 * rather than a read per device. KV caps metadata at 1024 bytes, so this
 * stays to short fields.
 */
const deviceMeta = (d) => ({
  model: d.model,
  status: d.status,
  assignedTo: (d.assignedTo || '').slice(0, 80),
  orderId: (d.orderId || '').slice(0, 80),
  imei1: d.imei1 || '',
  receivedAt: d.receivedAt,
});

export const normaliseSerial = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
export const normaliseImei = (s) => String(s || '').replace(/\D/g, '');

export function isValidSerial(serial) {
  return /^[A-Z0-9][A-Z0-9\-/]{3,39}$/.test(serial);
}

/** IMEIs are 15 digits with a Luhn check digit, which catches most typos. */
export function isValidImei(imei) {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[14 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export async function getDevice(kv, serial) {
  const raw = await kv.get(`${PREFIX}${serial}`);
  return raw ? JSON.parse(raw) : null;
}

/** The serial already holding this IMEI, or null. */
export async function serialForImei(kv, imei) {
  return imei ? kv.get(`${IMEI_PREFIX}${imei}`) : null;
}

async function putDevice(kv, device) {
  await kv.put(`${PREFIX}${device.serial}`, JSON.stringify(device), { metadata: deviceMeta(device) });
}

/** Store a newly received unit. The caller has checked for duplicates. */
export async function receiveDevice(kv, fields, by) {
  const now = new Date().toISOString();
  const device = {
    ...fields,
    status: fields.status || 'in_stock',
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, by, event: 'Received', status: fields.status || 'in_stock' }],
  };
  await putDevice(kv, device);
  for (const imei of [device.imei1, device.imei2]) {
    if (imei) await kv.put(`${IMEI_PREFIX}${imei}`, device.serial);
  }
  return device;
}

/**
 * Merge changes into a device and log what moved in its history. Serial and
 * IMEIs are fixed once received: a wrong one means delete and re-receive.
 */
export async function updateDevice(kv, serial, changes, by) {
  const device = await getDevice(kv, serial);
  if (!device) return null;

  const labels = { status: 'Status', assignedTo: 'Assigned to', orderId: 'Order', model: 'Model', notes: 'Notes' };
  const moved = [];
  for (const [field, label] of Object.entries(labels)) {
    if (field in changes && (changes[field] || '') !== (device[field] || '')) {
      moved.push(field === 'notes' ? 'Notes edited' : `${label}: ${changes[field] || '(none)'}`);
      device[field] = changes[field];
    }
  }
  if (!moved.length) return device;

  device.updatedAt = new Date().toISOString();
  device.history = [...(device.history || []), { at: device.updatedAt, by, event: moved.join(' · '), status: device.status }];
  await putDevice(kv, device);
  return device;
}

export async function deleteDevice(kv, serial) {
  const device = await getDevice(kv, serial);
  if (!device) return false;
  await kv.delete(`${PREFIX}${serial}`);
  for (const imei of [device.imei1, device.imei2]) {
    if (imei) await kv.delete(`${IMEI_PREFIX}${imei}`);
  }
  return true;
}

/** Every device as { serial, ...metadata }, newest received first. */
export async function listDevices(kv) {
  const devices = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: PREFIX, cursor });
    for (const key of page.keys) {
      devices.push({ serial: key.name.slice(PREFIX.length), ...(key.metadata || {}) });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return devices.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
}
