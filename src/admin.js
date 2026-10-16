/* ============================================
   TUGA HARDWARE — Admin API (/api/admin/*)
   Back office for the /admin page: stock, goods
   in (purchase orders), goods out (sales orders),
   customers, suppliers and the movement ledger.
   Every route needs the ADMIN_TOKEN bearer token;
   the router in api.js checks it before calling in.
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
import {
  PURCHASE_STATUSES,
  SALE_STATUSES,
  MOVE_TYPES,
  getRecord,
  putRecord,
  deleteRecord,
  listRecords,
  nextId,
  recordMove,
  listMoves,
  landedUnitCosts,
} from './records.js';
import { getOrder, updateOrder } from './orders.js';
import {
  WARRANTY_PLANS,
  PLAN_WINDOW_DAYS,
  makeWarranty,
  allocatePlans,
  fileWebOrder,
  buildDigest,
  listRegistrations,
  markRegistrationHandled,
} from './backoffice.js';
import { sendShippingNotification } from './email.js';
import { routedStore } from './store.js';

const BY = 'Admin';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

class Invalid extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const fail = (message, status = 400) => json({ error: message }, status);
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
/** Whole pence from a pence number; the page converts pounds before sending. */
const pence = (v) => {
  const n = Math.round(Number(v) || 0);
  return n < 0 ? 0 : n;
};
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v || '') ? String(v).slice(0, 10) : '');
const todayIso = () => new Date().toISOString().slice(0, 10);
/** A movement timestamp from a YYYY-MM-DD the user picked, else now. */
const moveAt = (day) => (isoDate(day) && isoDate(day) !== todayIso() ? `${isoDate(day)}T12:00:00.000Z` : new Date().toISOString());

/**
 * @param {Request} request
 * @param {object} env
 * @param {{models: Record<string,string>, catalogue: Record<string,{name:string,price:number,device?:boolean}>}} ctx
 */
export async function handleAdmin(request, env, ctx) {
  if (!env.ORDERS) return fail('The ORDERS KV binding is missing', 500);
  const kv = routedStore(env);
  const url = new URL(request.url);
  const [resource, rawId, action, sub] = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  const body = method === 'POST' || method === 'PUT' || method === 'PATCH' ? await request.json().catch(() => null) : null;
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && !body) return fail('Request body is not valid JSON');

  try {
    switch (resource) {
      case 'meta':
        return json({
          models: ctx.models,
          catalogue: ctx.catalogue,
          deviceStatuses: DEVICE_STATUSES,
          purchaseStatuses: PURCHASE_STATUSES,
          saleStatuses: SALE_STATUSES,
          moveTypes: MOVE_TYPES,
          warrantyPlans: WARRANTY_PLANS,
          planWindowDays: PLAN_WINDOW_DAYS,
        });
      case 'attention':
        if (method === 'GET') return json({ sections: await buildDigest(kv) });
        break;
      case 'registrations':
        if (method === 'GET') return json({ registrations: await registrations(kv) });
        if (method === 'POST' && rawId === 'handle') return await handleRegistration(kv, body);
        break;
      case 'sync-web':
        if (method === 'POST') return await syncWebOrders(kv, ctx);
        break;
      case 'devices':
        return await devices(kv, method, rawId, action, sub, body, ctx);
      case 'customers':
        return await customers(kv, method, rawId, body);
      case 'suppliers':
        return await suppliers(kv, method, rawId, body);
      case 'purchases':
        return await purchases(kv, method, rawId, action, body, ctx);
      case 'sales':
        return await sales(kv, method, rawId, action, body, ctx, env);
      case 'orders':
        return await webOrders(kv, method, rawId, action, body);
      case 'moves':
        if (method === 'GET') return json({ moves: await listMoves(kv) });
        break;
      case 'import':
        if (method === 'POST') return await importRecords(kv, body, ctx);
        break;
    }
  } catch (err) {
    if (err instanceof Invalid) return fail(err.message, err.status);
    console.error('Admin API error:', err);
    return fail('Something went wrong on the server', 500);
  }
  return fail('Not Found', 404);
}

// ---------------------------------------------------------------------------
// Devices (stock units)
// ---------------------------------------------------------------------------
async function devices(kv, method, rawId, action, sub, body, ctx) {
  if (!rawId && method === 'GET') return json({ devices: await listDevices(kv) });
  if (!rawId && method === 'POST') {
    const device = await receiveUnit(kv, body, ctx, {});
    return json({ device }, 201);
  }
  const serial = normaliseSerial(rawId);
  if (method === 'GET' && !action) {
    const device = await getDevice(kv, serial);
    if (!device) return fail('No device with that serial', 404);
    const moves = (await listMoves(kv)).filter((m) => m.serial === serial);
    return json({ device, moves });
  }
  if (method === 'PATCH' && !action) return editDevice(kv, serial, body, ctx);
  if (method === 'DELETE' && !action) {
    const device = await getDevice(kv, serial);
    if (!device) return fail('No device with that serial', 404);
    await deleteDevice(kv, serial);
    await recordMove(kv, { type: 'adjust', serial, model: device.model, note: 'Deleted from stock records' });
    return json({ ok: true });
  }
  if (method === 'POST' && action === 'return') return bookReturn(kv, serial, body);
  if (method === 'PUT' && action === 'warranty') return setWarranty(kv, serial, body);
  if (method === 'POST' && action === 'claims') return addClaim(kv, serial, body);
  if (method === 'PATCH' && action === 'claims' && sub != null) return updateClaim(kv, serial, Number(sub), body);
  return fail('Not Found', 404);
}

/**
 * Validate and store one received unit, logging a goods-in movement.
 * `link` carries the purchase order fields when receiving against a PO.
 */
async function receiveUnit(kv, body, ctx, link) {
  const serial = normaliseSerial(body.serial);
  const imei1 = normaliseImei(body.imei1);
  const imei2 = normaliseImei(body.imei2);
  const model = clip(body.model, 40);
  const status = body.status || 'in_stock';

  if (!isValidSerial(serial)) throw new Invalid(`"${body.serial || ''}" does not look like a serial number`);
  if (!ctx.models[model]) throw new Invalid('Pick a model');
  if (!DEVICE_STATUSES[status]) throw new Invalid('Unknown status');
  for (const imei of [imei1, imei2]) {
    if (imei && !isValidImei(imei)) throw new Invalid(`IMEI ${imei} fails its check digit — check for a typo`);
  }
  if (imei1 && imei1 === imei2) throw new Invalid('IMEI 1 and IMEI 2 are the same');
  if (await getDevice(kv, serial)) throw new Invalid(`Serial ${serial} is already in stock records`, 409);
  for (const imei of [imei1, imei2]) {
    const holder = await serialForImei(kv, imei);
    if (holder) throw new Invalid(`IMEI ${imei} is already recorded on ${holder}`, 409);
  }

  const receivedAt = isoDate(body.receivedAt) || todayIso();
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
      supplier: clip(link.supplierName || body.supplier, 80),
      supplierId: link.supplierId || '',
      poId: link.poId || '',
      unitCost: link.unitCost ?? (body.unitCost != null ? pence(body.unitCost) : null),
      notes: clip(body.notes, 1000),
      receivedAt,
    },
    BY
  );
  await recordMove(kv, {
    type: 'in',
    serial,
    model,
    ref: link.poId || '',
    party: device.supplier,
    cost: device.unitCost,
    at: moveAt(receivedAt),
  });
  return device;
}

async function editDevice(kv, serial, body, ctx) {
  const changes = {};
  if ('status' in body) {
    if (!DEVICE_STATUSES[body.status]) return fail('Unknown status', 422);
    changes.status = body.status;
  }
  if ('model' in body) {
    if (!ctx.models[body.model]) return fail('Pick a model', 422);
    changes.model = body.model;
  }
  if ('assignedTo' in body) changes.assignedTo = clip(body.assignedTo, 80);
  if ('orderId' in body) changes.orderId = clip(body.orderId, 80);
  if ('notes' in body) changes.notes = clip(body.notes, 1000);
  if ('unitCost' in body) changes.unitCost = body.unitCost === null || body.unitCost === '' ? null : pence(body.unitCost);

  const device = await updateDevice(kv, serial, changes, BY);
  return device ? json({ device }) : fail('No device with that serial', 404);
}

/** A unit coming back from a customer: back on the shelf, or set aside. */
async function bookReturn(kv, serial, body) {
  const device = await getDevice(kv, serial);
  if (!device) return fail('No device with that serial', 404);
  if (device.status !== 'sold' && device.status !== 'assigned') return fail('Only a sold or assigned unit can be returned', 422);
  const status = body.status === 'in_stock' || body.status === 'faulty' ? body.status : 'returned';
  const ref = device.saleId || device.orderId || '';
  const party = device.assignedTo || '';

  // A unit back for a refund leaves its warranty behind; the next sale starts a new one.
  await updateDevice(kv, serial, { status, assignedTo: '', warranty: null }, BY, `Returned by ${party || 'customer'}${body.note ? ` · ${clip(body.note, 200)}` : ''}`);
  await recordMove(kv, { type: 'return', serial, model: device.model, ref, party, note: clip(body.note, 200), at: moveAt(body.at) });

  // A sale whose every unit has come back is a returned sale.
  if (device.saleId) {
    const sale = await getRecord(kv, 'sales', device.saleId);
    if (sale) {
      const stillOut = [];
      for (const s of sale.dispatch?.serials || []) {
        const d = await getDevice(kv, s);
        if (d && d.status === 'sold') stillOut.push(s);
      }
      if (!stillOut.length) await putRecord(kv, 'sales', { ...sale, status: 'returned' });
    }
  }
  return json({ device: await getDevice(kv, serial) });
}

// ---------------------------------------------------------------------------
// Warranty register and claims
// ---------------------------------------------------------------------------
async function setWarranty(kv, serial, body) {
  const device = await getDevice(kv, serial);
  if (!device) return fail('No device with that serial', 404);
  if (!WARRANTY_PLANS[body.plan]) return fail('Unknown plan', 422);
  const start = isoDate(body.start) || device.warranty?.start;
  if (!start) return fail('Give the start date (the dispatch date)', 422);
  const warranty = makeWarranty(body.plan, start, {
    ref: clip(body.ref, 60) || device.warranty?.ref || '',
    note: clip(body.note, 300),
    setAt: new Date().toISOString(),
  });
  const updated = await updateDevice(kv, serial, { warranty }, BY, `Warranty: ${WARRANTY_PLANS[warranty.plan].name}, ${warranty.start} to ${warranty.end}${warranty.note ? ` · ${warranty.note}` : ''}`);
  return json({ device: updated });
}

async function addClaim(kv, serial, body) {
  const device = await getDevice(kv, serial);
  if (!device) return fail('No device with that serial', 404);
  const fault = clip(body.fault, 1000);
  if (!fault) return fail('Describe the fault', 422);
  const claim = { openedAt: isoDate(body.at) || todayIso(), fault, status: 'open', outcome: '', notes: '', closedAt: '' };
  const claims = [...(device.claims || []), claim];
  const updated = await updateDevice(kv, serial, { claims }, BY, `Warranty claim opened: ${fault.slice(0, 120)}`);
  return json({ device: updated });
}

const CLAIM_OUTCOMES = ['repaired', 'replaced', 'refunded', 'declined', 'no fault found'];

async function updateClaim(kv, serial, index, body) {
  const device = await getDevice(kv, serial);
  if (!device) return fail('No device with that serial', 404);
  const claims = [...(device.claims || [])];
  if (!claims[index]) return fail('No such claim', 404);
  const c = { ...claims[index] };
  if ('notes' in body) c.notes = clip(body.notes, 2000);
  if (body.status === 'closed') {
    if (!CLAIM_OUTCOMES.includes(body.outcome)) return fail('Pick an outcome', 422);
    c.status = 'closed';
    c.outcome = body.outcome;
    c.closedAt = isoDate(body.closedAt) || todayIso();
  } else if (body.status === 'open') {
    c.status = 'open';
    c.outcome = '';
    c.closedAt = '';
  }
  claims[index] = c;
  const event = c.status === 'closed' ? `Warranty claim closed: ${c.outcome}` : 'Warranty claim updated';
  return json({ device: await updateDevice(kv, serial, { claims }, BY, event) });
}

/** Website registrations, each matched to the unit it names if we hold it. */
async function registrations(kv) {
  const regs = await listRegistrations(kv);
  const bySerial = new Map((await listDevices(kv)).map((d) => [d.serial, d]));
  return regs.map((r) => {
    const d = bySerial.get(normaliseSerial(r.serial));
    return { ...r, matched: Boolean(d), deviceStatus: d?.status || '', holder: d?.assignedTo || '' };
  });
}

/** Mark a registration dealt with; when it names a unit we hold, record who registered it. */
async function handleRegistration(kv, body) {
  const key = String(body.key || '');
  if (!key.startsWith('warranty:')) return fail('Unknown registration', 404);
  const reg = await markRegistrationHandled(kv, key, clip(body.note, 300));
  if (!reg) return fail('Unknown registration', 404);
  const serial = normaliseSerial(reg.serial);
  if (body.link && (await getDevice(kv, serial))) {
    await updateDevice(
      kv,
      serial,
      { registeredTo: { name: reg.name, email: reg.email, orderRef: reg.orderRef, at: reg.receivedAt } },
      BY,
      `Registered on the website by ${reg.name || reg.email}`
    );
  }
  return json({ registration: reg });
}

/** File any web orders that predate auto-filing as sales orders. */
async function syncWebOrders(kv, ctx) {
  let filed = 0;
  let cursor;
  do {
    const page = await kv.list({ prefix: 'order:', cursor });
    for (const k of page.keys) {
      const order = await getOrder(kv, k.name.slice('order:'.length));
      if (order && !order.saleId) {
        const saleId = await fileWebOrder(kv, order, ctx.catalogue);
        // An order already dispatched from the old screen: carry that over.
        if (order.dispatch) {
          const sale = await getRecord(kv, 'sales', saleId);
          await putRecord(kv, 'sales', { ...sale, status: 'dispatched', dispatch: order.dispatch });
        }
        filed++;
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ filed });
}

// ---------------------------------------------------------------------------
// Customers and suppliers
// ---------------------------------------------------------------------------
function cleanCustomer(body, id) {
  const contacts = (Array.isArray(body.contacts) ? body.contacts : [])
    .map((c) => ({ name: clip(c.name, 80), email: clip(c.email, 120), phone: clip(c.phone, 40), role: clip(c.role, 60) }))
    .filter((c) => c.name || c.email || c.phone)
    .slice(0, 10);
  const r = {
    id,
    company: clip(body.company, 120),
    vatNumber: clip(body.vatNumber, 30),
    contacts,
    billingAddress: clip(body.billingAddress, 400),
    deliveryAddress: clip(body.deliveryAddress, 400),
    notes: clip(body.notes, 2000),
  };
  if (!r.company && !contacts.length) throw new Invalid('Give a company or at least one contact');
  return r;
}

async function customers(kv, method, id, body) {
  if (!id && method === 'GET') return json({ customers: await listRecords(kv, 'customers') });
  if (!id && method === 'POST') {
    const r = cleanCustomer(body, await nextId(kv, 'customers'));
    return json({ customer: await putRecord(kv, 'customers', r) }, 201);
  }
  const existing = await getRecord(kv, 'customers', id);
  if (!existing) return fail('No customer with that id', 404);
  if (method === 'GET') {
    const salesList = (await listRecords(kv, 'sales')).filter(Boolean);
    const theirSales = [];
    for (const s of salesList) {
      const full = await getRecord(kv, 'sales', s.id);
      if (full && full.customerId === id) theirSales.push(full);
    }
    const theirDevices = (await listDevices(kv)).filter((d) => d.customerId === id);
    return json({ customer: existing, sales: theirSales, devices: theirDevices });
  }
  if (method === 'PUT') {
    const r = { ...existing, ...cleanCustomer(body, id) };
    return json({ customer: await putRecord(kv, 'customers', r) });
  }
  if (method === 'DELETE') {
    for (const s of await listRecords(kv, 'sales')) {
      const full = await getRecord(kv, 'sales', s.id);
      if (full?.customerId === id) return fail(`This customer has sales order ${s.id}; delete that first`, 409);
    }
    await deleteRecord(kv, 'customers', id);
    return json({ ok: true });
  }
  return fail('Not Found', 404);
}

function cleanSupplier(body, id) {
  const r = {
    id,
    name: clip(body.name, 120),
    contact: clip(body.contact, 80),
    email: clip(body.email, 120),
    phone: clip(body.phone, 40),
    website: clip(body.website, 200),
    address: clip(body.address, 400),
    notes: clip(body.notes, 2000),
  };
  if (!r.name) throw new Invalid('Give the supplier a name');
  return r;
}

async function suppliers(kv, method, id, body) {
  if (!id && method === 'GET') return json({ suppliers: await listRecords(kv, 'suppliers') });
  if (!id && method === 'POST') {
    const r = cleanSupplier(body, await nextId(kv, 'suppliers'));
    return json({ supplier: await putRecord(kv, 'suppliers', r) }, 201);
  }
  const existing = await getRecord(kv, 'suppliers', id);
  if (!existing) return fail('No supplier with that id', 404);
  if (method === 'GET') {
    const pos = [];
    for (const p of await listRecords(kv, 'purchases')) {
      const full = await getRecord(kv, 'purchases', p.id);
      if (full?.supplierId === id) pos.push(full);
    }
    return json({ supplier: existing, purchases: pos });
  }
  if (method === 'PUT') return json({ supplier: await putRecord(kv, 'suppliers', { ...existing, ...cleanSupplier(body, id) }) });
  if (method === 'DELETE') {
    for (const p of await listRecords(kv, 'purchases')) {
      const full = await getRecord(kv, 'purchases', p.id);
      if (full?.supplierId === id) return fail(`This supplier has purchase order ${p.id}; delete that first`, 409);
    }
    await deleteRecord(kv, 'suppliers', id);
    return json({ ok: true });
  }
  return fail('Not Found', 404);
}

// ---------------------------------------------------------------------------
// Purchase orders (goods in)
// ---------------------------------------------------------------------------
function cleanLines(lines, priceField, ctx) {
  const out = (Array.isArray(lines) ? lines : [])
    .map((l) => {
      const productId = ctx.catalogue[l.productId] ? l.productId : '';
      return {
        productId,
        description: clip(l.description, 300) || (productId ? ctx.catalogue[productId].name : ''),
        qty: Math.max(0, Math.min(10000, Math.round(Number(l.qty) || 0))),
        [priceField]: pence(l[priceField]),
      };
    })
    .filter((l) => l.qty > 0 && (l.productId || l.description));
  if (!out.length) throw new Invalid('Add at least one line');
  return out;
}

const deviceUnits = (lines, ctx) => lines.reduce((n, l) => n + (ctx.catalogue[l.productId]?.device ? l.qty : 0), 0);

async function cleanPurchase(kv, body, id, ctx, existing) {
  const supplier = await getRecord(kv, 'suppliers', clip(body.supplierId, 20));
  if (!supplier) throw new Invalid('Pick a supplier');
  const lines = cleanLines(body.lines, 'unitCost', ctx);
  const status = PURCHASE_STATUSES[body.status] ? body.status : existing?.status || 'ordered';
  return {
    ...(existing || {}),
    id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierRef: clip(body.supplierRef, 80),
    orderedAt: isoDate(body.orderedAt) || todayIso(),
    paidAt: isoDate(body.paidAt),
    paymentMethod: clip(body.paymentMethod, 40),
    currency: 'GBP',
    lines,
    shipping: pence(body.shipping),
    tax: pence(body.tax),
    fees: pence(body.fees),
    amountPaid: pence(body.amountPaid),
    units: deviceUnits(lines, ctx),
    received: existing?.received || 0,
    status,
    notes: clip(body.notes, 2000),
  };
}

async function purchases(kv, method, id, action, body, ctx) {
  if (!id && method === 'GET') return json({ purchases: await listRecords(kv, 'purchases') });
  if (!id && method === 'POST') {
    const r = await cleanPurchase(kv, body, await nextId(kv, 'purchases'), ctx);
    return json({ purchase: await putRecord(kv, 'purchases', r) }, 201);
  }
  const po = await getRecord(kv, 'purchases', id);
  if (!po) return fail('No purchase order with that id', 404);

  if (method === 'GET') {
    const units = (await listDevices(kv)).filter((d) => d.poId === id);
    return json({ purchase: po, devices: units, landed: landedUnitCosts(po) });
  }
  if (method === 'PUT') {
    const r = await cleanPurchase(kv, body, id, ctx, po);
    return json({ purchase: await putRecord(kv, 'purchases', r) });
  }
  if (method === 'DELETE') {
    if (po.received) return fail('Units have been received against this order; it cannot be deleted', 409);
    await deleteRecord(kv, 'purchases', id);
    return json({ ok: true });
  }
  if (method === 'POST' && action === 'receive') {
    const units = Array.isArray(body.units) ? body.units : [];
    if (!units.length) return fail('Enter at least one unit', 422);
    const landed = landedUnitCosts(po);
    const received = [];
    // Validate every unit before storing any, so a typo on unit 3 does not
    // leave units 1 and 2 half-received.
    const seen = new Set();
    for (const u of units) {
      const line = po.lines[Number(u.line) || 0];
      if (!line || !ctx.models[line.productId]) throw new Invalid('Each unit must be against a device line on the order');
      const serial = normaliseSerial(u.serial);
      if (seen.has(serial)) throw new Invalid(`Serial ${serial} is entered twice`);
      seen.add(serial);
      if (!isValidSerial(serial)) throw new Invalid(`"${u.serial || ''}" does not look like a serial number`);
      if (await getDevice(kv, serial)) throw new Invalid(`Serial ${serial} is already in stock records`, 409);
    }
    for (const u of units) {
      const lineIndex = Number(u.line) || 0;
      const line = po.lines[lineIndex];
      received.push(
        await receiveUnit(
          kv,
          { ...u, model: line.productId, receivedAt: body.receivedAt },
          ctx,
          { poId: po.id, supplierId: po.supplierId, supplierName: po.supplierName, unitCost: landed[lineIndex] }
        )
      );
    }
    po.received = (po.received || 0) + received.length;
    po.status = po.received >= po.units ? 'received' : 'part_received';
    await putRecord(kv, 'purchases', po);
    return json({ purchase: po, devices: received });
  }
  return fail('Not Found', 404);
}

// ---------------------------------------------------------------------------
// Sales orders (goods out)
// ---------------------------------------------------------------------------
async function cleanSale(kv, body, id, ctx, existing) {
  const customer = await getRecord(kv, 'customers', clip(body.customerId, 20));
  if (!customer) throw new Invalid('Pick a customer');
  const lines = cleanLines(body.lines, 'unitPrice', ctx);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const shippingCharge = pence(body.shippingCharge);
  const vat = pence(body.vat);
  const discount = Math.min(pence(body.discount), subtotal);
  const status = SALE_STATUSES[body.status] ? body.status : existing?.status || 'awaiting_payment';
  return {
    ...(existing || {}),
    id,
    customerId: customer.id,
    customerName: customer.company || customer.contacts?.[0]?.name || '',
    contactName: clip(body.contactName, 80),
    orderedAt: isoDate(body.orderedAt) || todayIso(),
    lines,
    subtotal,
    discount,
    shippingCharge,
    vat,
    total: subtotal - discount + shippingCharge + vat,
    units: deviceUnits(lines, ctx),
    paymentMethod: clip(body.paymentMethod, 40),
    paymentRef: clip(body.paymentRef, 60),
    paidAt: isoDate(body.paidAt),
    invoiceNumber: clip(body.invoiceNumber, 40),
    deliveryAddress: clip(body.deliveryAddress, 400) || customer.deliveryAddress || customer.billingAddress || '',
    status,
    notes: clip(body.notes, 2000),
  };
}

async function sales(kv, method, rawId, action, body, ctx, env) {
  if (!rawId && method === 'GET') {
    return json({ sales: await listRecords(kv, 'sales') });
  }
  if (!rawId && method === 'POST') {
    const wanted = clip(body.id, 30).toUpperCase();
    if (wanted && !/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(wanted)) return fail('Order numbers use letters, digits and dashes', 422);
    if (wanted && (await getRecord(kv, 'sales', wanted))) return fail(`Order ${wanted} already exists`, 409);
    const r = await cleanSale(kv, body, wanted || (await nextId(kv, 'sales')), ctx);
    return json({ sale: await putRecord(kv, 'sales', r) }, 201);
  }
  const id = rawId.toUpperCase();
  const sale = await getRecord(kv, 'sales', id);
  if (!sale) return fail('No sales order with that id', 404);

  if (method === 'GET') {
    const units = [];
    for (const serial of sale.dispatch?.serials || []) {
      const d = await getDevice(kv, serial);
      if (d) units.push(d);
    }
    const cost = units.reduce((s, d) => s + (d.unitCost || 0), 0);
    const costKnown = units.length > 0 && units.every((d) => d.unitCost != null);
    return json({ sale, devices: units, cost: costKnown ? cost : null });
  }
  if (method === 'PUT') {
    const r = await cleanSale(kv, body, id, ctx, sale);
    return json({ sale: await putRecord(kv, 'sales', r) });
  }
  if (method === 'DELETE') {
    if (sale.dispatch) return fail('This order has been dispatched; cancel it instead of deleting', 409);
    await deleteRecord(kv, 'sales', id);
    return json({ ok: true });
  }
  if (method === 'POST' && action === 'dispatch') {
    if (sale.dispatch) return fail('Already dispatched', 409);
    const serials = await checkUnitsFree(kv, body.serials, id);
    const at = moveAt(body.at);
    const day = at.slice(0, 10);
    // Spread the order's device revenue over the units, for margin per unit.
    const deviceRevenue = sale.lines.reduce((s, l) => s + (ctx.catalogue[l.productId]?.device ? l.unitPrice * l.qty : 0), 0);
    const perUnit = serials.length ? Math.round(deviceRevenue / Math.max(serials.length, sale.units || 1)) : 0;
    const units = await Promise.all(serials.map((serial) => getDevice(kv, serial)));
    const plans = allocatePlans(units, sale.lines, body.plans || {});
    for (const serial of serials) {
      const warranty = makeWarranty(plans[serial], day, { ref: id, setAt: new Date().toISOString() });
      const d = await updateDevice(
        kv,
        serial,
        { status: 'sold', orderId: id, saleId: id, customerId: sale.customerId, assignedTo: sale.customerName, soldPrice: perUnit, warranty },
        BY,
        `Dispatched on ${id} to ${sale.customerName} · ${WARRANTY_PLANS[warranty.plan].name} until ${warranty.end}`
      );
      await recordMove(kv, { type: 'out', serial, model: d.model, ref: id, party: sale.customerName, price: perUnit, cost: d.unitCost, at });
    }
    sale.dispatch = {
      at,
      courier: clip(body.courier, 60),
      tracking: clip(body.tracking, 80),
      serials,
    };
    sale.status = 'dispatched';

    // Keep the web order in step, and email the customer their tracking.
    if (sale.webOrderId) {
      await updateOrder(kv, sale.webOrderId, { status: 'dispatched', dispatch: sale.dispatch }).catch((err) => console.error('Could not update web order:', err));
    }
    if (body.notifyCustomer && sale.dispatch.tracking) {
      const email = await customerEmail(kv, sale);
      if (!email) {
        sale.dispatch.notified = 'no email on file';
      } else if (!env.RESEND_API_KEY) {
        sale.dispatch.notified = 'email not configured';
      } else {
        try {
          await sendShippingNotification(env, email, sale.dispatch.tracking, sale.dispatch.courier);
          sale.dispatch.notified = email;
        } catch (err) {
          console.error('Shipping email failed:', err);
          sale.dispatch.notified = 'sending failed';
        }
      }
    }
    await putRecord(kv, 'sales', sale);
    return json({ sale });
  }
  return fail('Not Found', 404);
}

/** The email of the order's named contact, else the customer's first one. */
async function customerEmail(kv, sale) {
  const c = await getRecord(kv, 'customers', sale.customerId);
  const contacts = c?.contacts || [];
  const named = contacts.find((p) => p.email && p.name && p.name === sale.contactName);
  return (named || contacts.find((p) => p.email))?.email || '';
}

/** Normalise a list of serials and check each is a unit we hold and can send. */
async function checkUnitsFree(kv, list, ref) {
  const serials = [...new Set((list || []).map(normaliseSerial).filter(Boolean))];
  for (const serial of serials) {
    const device = await getDevice(kv, serial);
    if (!device) throw new Invalid(`Serial ${serial} is not in stock records — receive it first`);
    if (device.status === 'sold' && device.orderId !== ref) throw new Invalid(`Serial ${serial} is already sold on ${device.orderId}`, 409);
  }
  return serials;
}

// ---------------------------------------------------------------------------
// Web orders (Stripe / PayPal, stored by the checkout as order:<id>)
// ---------------------------------------------------------------------------
async function webOrders(kv, method, id, action, body) {
  if (!id && method === 'GET') {
    const ids = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: 'order:', cursor });
      ids.push(...page.keys.map((k) => k.name.slice('order:'.length)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    // Fine at today's volume; move to D1 before it isn't.
    const orders = (await Promise.all(ids.slice(0, 200).map((oid) => getOrder(kv, oid)))).filter(Boolean);
    return json({
      orders: orders
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
          saleId: o.saleId || '',
        }))
        .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')),
    });
  }
  if (id && action === 'dispatch' && method === 'POST') {
    const order = await getOrder(kv, id);
    if (!order) return fail('No order with that id', 404);
    if (order.dispatch) return fail('Already dispatched', 409);
    const serials = await checkUnitsFree(kv, body.serials, id);
    const customer = order.shippingAddress?.name || order.customerEmail || '';
    const at = moveAt(body.at);
    const units = await Promise.all(serials.map((serial) => getDevice(kv, serial)));
    const plans = allocatePlans(units, (order.items || []).map((i) => ({ productId: i.id, qty: i.quantity })), body.plans || {});
    for (const serial of serials) {
      const warranty = makeWarranty(plans[serial], at.slice(0, 10), { ref: id, setAt: new Date().toISOString() });
      const d = await updateDevice(kv, serial, { status: 'sold', orderId: id, assignedTo: customer, warranty }, BY, `Dispatched on web order to ${customer} · ${WARRANTY_PLANS[warranty.plan].name} until ${warranty.end}`);
      await recordMove(kv, { type: 'out', serial, model: d.model, ref: id, party: customer, cost: d.unitCost, at });
    }
    const updated = await updateOrder(kv, id, {
      status: 'dispatched',
      dispatch: { at, courier: clip(body.courier, 60), tracking: clip(body.tracking, 80), serials },
    });
    return json({ order: updated });
  }
  return fail('Not Found', 404);
}

// ---------------------------------------------------------------------------
// Import: bring a set of records in at once (a customer, the supplier, the
// purchase and sale behind a unit already in stock). Customers, suppliers,
// purchases and sales are upserted by id; devices are merged by serial;
// moves are appended. Runs in order so later sections can link to earlier.
// ---------------------------------------------------------------------------
async function importRecords(kv, body, ctx) {
  const done = { customers: 0, suppliers: 0, purchases: 0, sales: 0, devices: 0, moves: 0 };
  const idOk = (id) => /^[A-Z0-9][A-Z0-9-]{1,29}$/.test(String(id || ''));

  for (const c of body.customers || []) {
    if (!idOk(c.id)) throw new Invalid(`Customer id "${c.id}" is not valid`);
    const existing = await getRecord(kv, 'customers', c.id);
    await putRecord(kv, 'customers', { ...(existing || {}), ...cleanCustomer(c, c.id) });
    done.customers++;
  }
  for (const s of body.suppliers || []) {
    if (!idOk(s.id)) throw new Invalid(`Supplier id "${s.id}" is not valid`);
    const existing = await getRecord(kv, 'suppliers', s.id);
    await putRecord(kv, 'suppliers', { ...(existing || {}), ...cleanSupplier(s, s.id) });
    done.suppliers++;
  }
  for (const p of body.purchases || []) {
    if (!idOk(p.id)) throw new Invalid(`Purchase id "${p.id}" is not valid`);
    const existing = await getRecord(kv, 'purchases', p.id);
    const r = await cleanPurchase(kv, p, p.id, ctx, existing);
    if (p.received != null) r.received = Math.max(0, Math.round(Number(p.received) || 0));
    await putRecord(kv, 'purchases', r);
    done.purchases++;
  }
  for (const s of body.sales || []) {
    const sid = String(s.id || '').toUpperCase();
    if (!idOk(sid)) throw new Invalid(`Sales order id "${s.id}" is not valid`);
    const existing = await getRecord(kv, 'sales', sid);
    const r = await cleanSale(kv, s, sid, ctx, existing);
    if (s.dispatch) {
      r.dispatch = {
        at: s.dispatch.at || new Date().toISOString(),
        courier: clip(s.dispatch.courier, 60),
        tracking: clip(s.dispatch.tracking, 80),
        serials: (s.dispatch.serials || []).map(normaliseSerial),
      };
    }
    await putRecord(kv, 'sales', r);
    done.sales++;
  }
  for (const d of body.devices || []) {
    const serial = normaliseSerial(d.serial);
    const existing = await getDevice(kv, serial);
    if (!existing) {
      const link = { poId: d.poId, supplierId: d.supplierId, supplierName: d.supplier, unitCost: d.unitCost == null ? null : pence(d.unitCost) };
      await receiveUnit(kv, d, ctx, link);
    }
    {
      const changes = {};
      for (const f of ['status', 'assignedTo', 'orderId', 'notes', 'model']) if (f in d) changes[f] = clip(d[f], f === 'notes' ? 1000 : 80);
      for (const f of ['poId', 'supplierId', 'customerId', 'saleId']) if (f in d) changes[f] = clip(d[f], 30);
      for (const f of ['unitCost', 'soldPrice']) if (f in d) changes[f] = d[f] == null ? null : pence(d[f]);
      if (changes.status && !DEVICE_STATUSES[changes.status]) throw new Invalid(`Unknown status for ${serial}`);
      if ('supplier' in d) changes.supplier = clip(d.supplier, 80);
      if (d.warranty && WARRANTY_PLANS[d.warranty.plan] && isoDate(d.warranty.start)) {
        changes.warranty = makeWarranty(d.warranty.plan, isoDate(d.warranty.start), { ref: clip(d.warranty.ref, 60) });
      }
      await updateDevice(kv, serial, changes, BY, d.event ? clip(d.event, 200) : 'Imported details');
    }
    await backfillMoves(kv, serial);
    done.devices++;
  }
  for (const m of body.moves || []) {
    if (!MOVE_TYPES[m.type]) throw new Invalid(`Unknown movement type "${m.type}"`);
    await recordMove(kv, {
      type: m.type,
      serial: normaliseSerial(m.serial),
      model: clip(m.model, 30),
      ref: clip(m.ref, 40),
      party: clip(m.party, 80),
      note: clip(m.note, 200),
      cost: m.cost == null ? undefined : pence(m.cost),
      price: m.price == null ? undefined : pence(m.price),
      at: m.at,
    });
    done.moves++;
  }
  return json({ imported: done });
}

/**
 * A unit linked to a purchase or a sale by import should show in the ledger
 * like one booked through the screens. Adds only what is missing, so
 * importing the same file twice changes nothing.
 */
async function backfillMoves(kv, serial) {
  const d = await getDevice(kv, serial);
  if (!d) return;
  const mine = (await listMoves(kv)).filter((m) => m.serial === serial);
  if (!mine.some((m) => m.type === 'in')) {
    await recordMove(kv, {
      type: 'in', serial, model: d.model, ref: d.poId || '', party: d.supplier || '', cost: d.unitCost,
      at: d.receivedAt ? `${d.receivedAt}T12:00:00.000Z` : undefined,
    });
  }
  if (d.status === 'sold' && d.saleId && !mine.some((m) => m.type === 'out')) {
    const sale = await getRecord(kv, 'sales', d.saleId);
    await recordMove(kv, {
      type: 'out', serial, model: d.model, ref: d.saleId, party: sale?.customerName || d.assignedTo || '',
      price: d.soldPrice, cost: d.unitCost, at: sale?.dispatch?.at,
    });
  }
}
