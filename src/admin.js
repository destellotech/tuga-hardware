/* ============================================
   TUGA HARDWARE — Admin API (/api/admin/*)
   Stock and orders for the /admin page. Every
   route needs the ADMIN_TOKEN bearer token; the
   router in api.js checks it before calling in.
   ============================================ */

import {
  DEVICE_STATUSES,
  normaliseSerial,
  normaliseImei,
  isValidSerial,
  isValidImei,
  getDevice,
  serialForImei,
  receiveDevice,
  updateDevice,
  deleteDevice,
  listDevices,
} from './inventory.js';
import { getOrder, updateOrder } from './orders.js';

const BY = 'Admin';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const fail = (message, status = 400) => json({ error: message }, status);
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/**
 * @param {Request} request
 * @param {object} env
 * @param {Record<string, string>} models  device product id → display name
 */
export async function handleAdmin(request, env, models) {
  if (!env.ORDERS) return fail('The ORDERS KV binding is missing', 500);
  const kv = env.ORDERS;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [resource, id, action] = parts;
  const method = request.method;

  try {
    if (resource === 'devices') {
      if (!id && method === 'GET') {
        return json({ devices: await listDevices(kv), models, statuses: DEVICE_STATUSES });
      }
      if (!id && method === 'POST') return receive(kv, await request.json(), models);

      const serial = normaliseSerial(id);
      if (method === 'GET') {
        const device = await getDevice(kv, serial);
        return device ? json({ device }) : fail('No device with that serial', 404);
      }
      if (method === 'PATCH') return edit(kv, serial, await request.json(), models);
      if (method === 'DELETE') {
        return (await deleteDevice(kv, serial)) ? json({ ok: true }) : fail('No device with that serial', 404);
      }
    }

    if (resource === 'orders') {
      if (!id && method === 'GET') return json({ orders: await listOrders(kv) });
      if (id && action === 'dispatch' && method === 'POST') return dispatch(kv, id, await request.json());
    }
  } catch (err) {
    if (err instanceof SyntaxError) return fail('Request body is not valid JSON');
    console.error('Admin API error:', err);
    return fail('Something went wrong on the server', 500);
  }

  return fail('Not Found', 404);
}

async function receive(kv, body, models) {
  const serial = normaliseSerial(body.serial);
  const imei1 = normaliseImei(body.imei1);
  const imei2 = normaliseImei(body.imei2);
  const model = clip(body.model, 40);
  const status = body.status || 'in_stock';

  if (!isValidSerial(serial)) return fail('That does not look like a serial number', 422);
  if (!models[model]) return fail('Pick a model', 422);
  if (!DEVICE_STATUSES[status]) return fail('Unknown status', 422);
  for (const imei of [imei1, imei2]) {
    if (imei && !isValidImei(imei)) return fail(`IMEI ${imei} fails its check digit — check for a typo`, 422);
  }
  if (imei1 && imei1 === imei2) return fail('IMEI 1 and IMEI 2 are the same', 422);

  if (await getDevice(kv, serial)) return fail(`Serial ${serial} is already in stock records`, 409);
  for (const imei of [imei1, imei2]) {
    const holder = await serialForImei(kv, imei);
    if (holder) return fail(`IMEI ${imei} is already recorded on ${holder}`, 409);
  }

  const device = await receiveDevice(
    kv,
    {
      serial,
      model,
      imei1,
      imei2,
      status,
      assignedTo: clip(body.assignedTo, 80),
      orderId: clip(body.orderId, 80),
      supplier: clip(body.supplier, 80),
      notes: clip(body.notes, 1000),
      receivedAt: /^\d{4}-\d{2}-\d{2}$/.test(body.receivedAt || '') ? body.receivedAt : new Date().toISOString().slice(0, 10),
    },
    BY
  );
  return json({ device }, 201);
}

async function edit(kv, serial, body, models) {
  const changes = {};
  if ('status' in body) {
    if (!DEVICE_STATUSES[body.status]) return fail('Unknown status', 422);
    changes.status = body.status;
  }
  if ('model' in body) {
    if (!models[body.model]) return fail('Pick a model', 422);
    changes.model = body.model;
  }
  if ('assignedTo' in body) changes.assignedTo = clip(body.assignedTo, 80);
  if ('orderId' in body) changes.orderId = clip(body.orderId, 80);
  if ('notes' in body) changes.notes = clip(body.notes, 1000);

  const device = await updateDevice(kv, serial, changes, BY);
  return device ? json({ device }) : fail('No device with that serial', 404);
}

/** Orders, newest first. Fine at today's volume; move to D1 before it isn't. */
async function listOrders(kv) {
  const ids = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: 'order:', cursor });
    ids.push(...page.keys.map((k) => k.name.slice('order:'.length)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const orders = (await Promise.all(ids.slice(0, 200).map((id) => getOrder(kv, id)))).filter(Boolean);
  return orders
    .map((o) => ({
      orderId: o.orderId,
      provider: o.provider,
      status: o.status,
      customerEmail: o.customerEmail,
      shippingAddress: o.shippingAddress,
      items: o.items || [],
      total: o.total,
      currency: o.currency,
      paidAt: o.paidAt || o.createdAt,
      dispatch: o.dispatch || null,
    }))
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

/** Mark an order dispatched and the listed units sold against it. */
async function dispatch(kv, orderId, body) {
  const order = await getOrder(kv, orderId);
  if (!order) return fail('No order with that id', 404);

  const serials = [...new Set((body.serials || []).map(normaliseSerial).filter(Boolean))];
  for (const serial of serials) {
    const device = await getDevice(kv, serial);
    if (!device) return fail(`Serial ${serial} is not in stock records — receive it first`, 422);
    if (device.status === 'sold' && device.orderId !== orderId) {
      return fail(`Serial ${serial} is already sold on order ${device.orderId}`, 409);
    }
  }

  const customer = order.shippingAddress?.name || order.customerEmail || '';
  for (const serial of serials) {
    await updateDevice(kv, serial, { status: 'sold', orderId, assignedTo: customer }, BY);
  }

  const updated = await updateOrder(kv, orderId, {
    status: 'dispatched',
    dispatch: {
      at: new Date().toISOString(),
      courier: clip(body.courier, 60),
      tracking: clip(body.tracking, 80),
      serials,
    },
  });
  return json({ order: updated });
}
