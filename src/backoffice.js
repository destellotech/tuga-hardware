/* ============================================
   TUGA HARDWARE — Back-office automation
   - Files every web order as a customer and a
     TUGA sales order, so checkout fills the books.
   - Warranty register rules (Plan Terms 6, 7, 44):
     cover runs from the dispatch date; a paid plan
     can be added within 30 days of dispatch.
   - The daily "needs attention" email.
   ============================================ */

import { getRecord, createRecord, listRecords } from './records.js';
import { listDevices } from './inventory.js';
import { updateOrder } from './orders.js';
import { sendDigest } from './email.js';
import { routedStore } from './store.js';
import { pageviewStats, siteStats, countOrdersSince, newReferrers } from './pageviews.js';

// ---------------------------------------------------------------------------
// Warranty plans. Months match data/products.json warranty.tiers.
// ---------------------------------------------------------------------------
export const WARRANTY_PLANS = {
  standard: { name: 'Standard 12-month', months: 12 },
  '3yr': { name: '3-Year Warranty', months: 36 },
  care: { name: 'Total Care', months: 36 },
};

/** Days after dispatch in which a paid plan can be bought at the published price (Plan Terms 7). */
export const PLAN_WINDOW_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD plus whole months, clamped to the month's last day. */
export function addMonths(isoDay, months) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function addDays(isoDay, days) {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function makeWarranty(plan, start, extra = {}) {
  const p = WARRANTY_PLANS[plan] ? plan : 'standard';
  return { plan: p, start, end: addMonths(start, WARRANTY_PLANS[p].months), ...extra };
}

/** Scanner variants carry their base device's plan (wty-3yr-tuga-w10 covers tuga-w10-scanner). */
const baseModel = (model) => String(model || '').replace(/-scanner$/, '');

/**
 * Which plan each dispatched unit gets: the order's 3-Year Warranty lines
 * are handed out to units of the matching model, the rest get the standard
 * warranty. `chosen` (serial → plan) overrides, for Total Care or a plan
 * agreed off the website.
 *
 * @param {{model: string, serial: string}[]} units
 * @param {{productId?: string, qty: number}[]} lines
 */
export function allocatePlans(units, lines, chosen = {}) {
  const paid = {};
  for (const l of lines || []) {
    const m = /^wty-3yr-(.+)$/.exec(l.productId || '');
    if (m) paid[m[1]] = (paid[m[1]] || 0) + (l.qty || 0);
  }
  const out = {};
  for (const u of units) {
    if (!WARRANTY_PLANS[chosen[u.serial]]) continue;
    out[u.serial] = chosen[u.serial];
    const b = baseModel(u.model);
    if (chosen[u.serial] === '3yr' && paid[b]) paid[b]--;
  }
  for (const u of units) {
    if (out[u.serial]) continue;
    const b = baseModel(u.model);
    if (paid[b] > 0) {
      out[u.serial] = '3yr';
      paid[b]--;
    } else {
      out[u.serial] = 'standard';
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Web orders → customer + sales order
// ---------------------------------------------------------------------------
function addressText(a) {
  if (!a) return '';
  return [a.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country && a.country !== 'GB' ? a.country : '']
    .filter(Boolean)
    .join('\n');
}

/** The customer with this email as a contact, or a new one made from the order. */
async function customerForOrder(kv, order) {
  const email = String(order.customerEmail || '').trim().toLowerCase();
  if (email) {
    for (const c of await listRecords(kv, 'customers')) {
      if ((c.email || '').toLowerCase() === email) return getRecord(kv, 'customers', c.id);
    }
  }
  const name = order.customerName || order.shippingAddress?.name || email || 'Web customer';
  const address = addressText(order.shippingAddress);
  return createRecord(kv, 'customers', {
    company: '',
    vatNumber: '',
    contacts: [{ name, email: order.customerEmail || '', phone: order.customerPhone || '', role: '' }],
    billingAddress: address,
    deliveryAddress: address,
    notes: `Created from web order ${order.orderId}.`,
  });
}

/**
 * File a paid web order as a sales order (and its customer). Idempotent:
 * an order already carrying saleId is left alone. Returns the sale id.
 *
 * @param {KVNamespace} kv
 * @param {object} order  the stored order:<id> record
 * @param {Record<string, {name: string, device?: boolean}>} catalogue
 */
export async function fileWebOrder(kv, order, catalogue) {
  if (order.saleId) return order.saleId;
  const customer = await customerForOrder(kv, order);
  const lines = (order.items || []).map((i) => ({
    productId: catalogue[i.id] ? i.id : '',
    description: i.name || (catalogue[i.id] && catalogue[i.id].name) || '',
    qty: i.quantity || 1,
    unitPrice: Math.round(i.unitPrice ?? (i.total || 0) / (i.quantity || 1)),
  }));
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const total = order.total ?? subtotal;
  const sale = await createRecord(kv, 'sales', {
    channel: 'web',
    webOrderId: order.orderId,
    customerId: customer.id,
    customerName: customer.company || customer.contacts?.[0]?.name || '',
    contactName: order.customerName || order.shippingAddress?.name || '',
    orderedAt: (order.paidAt || order.createdAt || new Date().toISOString()).slice(0, 10),
    lines,
    subtotal,
    discount: Math.max(0, subtotal - total),
    shippingCharge: Math.max(0, total - subtotal),
    vat: 0,
    total,
    units: lines.reduce((n, l) => n + (catalogue[l.productId]?.device ? l.qty : 0), 0),
    paymentMethod: order.provider === 'paypal' ? 'PayPal' : 'Card',
    paymentRef: order.orderId,
    paidAt: (order.paidAt || '').slice(0, 10),
    invoiceNumber: '',
    deliveryAddress: addressText(order.shippingAddress) || customer.deliveryAddress || '',
    status: 'paid',
    notes: Number(order.discount) > 0 ? `Website order with ${order.discount}% bulk discount.` : 'Website order.',
  });
  await updateOrder(kv, order.orderId, { saleId: sale.id }).catch((err) => console.error('Could not link sale to order:', err));
  return sale.id;
}

// ---------------------------------------------------------------------------
// Daily "needs attention" email
// ---------------------------------------------------------------------------
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Everything that wants a person today, as titled lists of lines. */
export async function buildDigest(kv) {
  const now = today();
  const sections = [];

  const toShip = [];
  for (const s of await listRecords(kv, 'sales')) {
    if (s.status === 'paid') toShip.push(`${s.id} · ${s.customerName} · ordered ${s.orderedAt}`);
  }
  if (toShip.length) sections.push({ title: 'Paid and waiting to ship', lines: toShip, link: '#/sales' });

  const devices = await listDevices(kv);
  const claims = devices.filter((d) => d.claimsOpen > 0).map((d) => `${d.serial} · ${d.assignedTo || 'unassigned'} · ${d.claimsOpen} open`);
  if (claims.length) sections.push({ title: 'Open warranty claims', lines: claims, link: '#/warranty' });

  const windowClosing = [];
  const expiring = [];
  for (const d of devices) {
    if (!d.wStart || d.status !== 'sold') continue;
    const since = daysBetween(d.wStart, now);
    if (d.wPlan === 'standard' && since >= PLAN_WINDOW_DAYS - 7 && since <= PLAN_WINDOW_DAYS) {
      windowClosing.push(`${d.serial} · ${d.assignedTo || ''} · 3-Year plan can be added until ${addDays(d.wStart, PLAN_WINDOW_DAYS)}`);
    }
    const left = daysBetween(now, d.wEnd);
    if (left >= 0 && left <= 30) expiring.push(`${d.serial} · ${d.assignedTo || ''} · ${WARRANTY_PLANS[d.wPlan]?.name || d.wPlan} ends ${d.wEnd}`);
  }
  if (windowClosing.length) sections.push({ title: 'Plan window closing this week', lines: windowClosing, link: '#/warranty' });
  if (expiring.length) sections.push({ title: 'Warranties ending in the next 30 days', lines: expiring, link: '#/warranty' });

  const regs = (await listRegistrations(kv)).filter((r) => !r.handledAt);
  if (regs.length) {
    sections.push({ title: 'Warranty registrations to check', lines: regs.map((r) => `${r.serial} · ${r.name || r.email}`), link: '#/warranty' });
  }
  return sections;
}

/**
 * The week on the website, as one digest section: UK views against the
 * week before, where people landed from search, who linked to us for the
 * first time, orders against product views, what the crawlers fetched and
 * which URLs are dead. Numbers first on every line, so it reads on a phone.
 * Sent on Mondays (see sendDailyDigest); skipped without the D1 binding.
 */
export async function buildSiteDigest(env, days = 7) {
  if (!env.DB) return null;
  const [views, site, fresh] = await Promise.all([
    pageviewStats(env, days, { uk: true }),
    siteStats(env, days, { uk: true }),
    newReferrers(env, days, 28),
  ]);
  const orders = await countOrdersSince(env.ORDERS, views.since).catch(() => null);

  const pct = (now, before) => {
    if (!before) return now ? 'up from 0' : 'no change';
    const n = Math.round((100 * (now - before)) / before);
    return n === 0 ? 'no change' : `${n > 0 ? 'up' : 'down'} ${Math.abs(n)}%`;
  };
  const lines = [];
  lines.push(
    `${views.total} UK page views, ${pct(views.total, views.previous.total)} on the ${days} days before (${views.previous.total})` +
      (orders == null ? '' : `; ${orders} order${orders === 1 ? '' : 's'} paid` + (orders ? `, ${Math.round(site.funnel.products / orders)} product views per order` : '')) +
      `; ${site.funnel.products} product page views, ${site.funnel.cart} basket views`
  );
  for (const p of views.pages.slice(0, 5)) lines.push(`${p.views} views (was ${p.previous}) · ${p.path}`);
  if (site.landing.length) lines.push('From search:');
  for (const p of site.landing.slice(0, 5)) lines.push(`${p.views} from search (was ${p.previous}) · ${p.path}`);
  for (const r of fresh.slice(0, 3)) lines.push(`${r.views} visits · new referrer: ${r.referrer}`);
  if (site.crawls.byBot.length) {
    lines.push(site.crawls.byBot.map((b) => `${b.hits} ${b.bot}`).join(', ') + ' crawler hits');
  } else {
    lines.push('0 verified crawler hits');
  }
  for (const m of site.misses.slice(0, 5)) lines.push(`${m.hits} x 404 · ${m.path}${m.referrer ? ` (from ${m.referrer})` : ''}`);
  return { title: `Last ${days} days on the site`, lines, link: '#/visits' };
}

export async function sendDailyDigest(env) {
  if (!env.ORDERS || !env.RESEND_API_KEY) return;
  try {
    const sections = await buildDigest(routedStore(env));
    // Mondays carry the week's site numbers as well.
    if (new Date().getUTCDay() === 1) {
      const site = await buildSiteDigest(env).catch((err) => {
        console.error('Site digest failed:', err);
        return null;
      });
      if (site) sections.push(site);
    }
    if (sections.length) await sendDigest(env, sections);
  } catch (err) {
    console.error('Daily digest failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Warranty registrations from the website form (warranty:<serial>:<time>)
// ---------------------------------------------------------------------------
export async function listRegistrations(kv) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: 'warranty:', cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const regs = await Promise.all(keys.slice(0, 300).map(async (key) => {
    const raw = await kv.get(key);
    return raw ? { key, ...JSON.parse(raw) } : null;
  }));
  return regs.filter(Boolean).sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
}

export async function markRegistrationHandled(kv, key, note) {
  const raw = await kv.get(key);
  if (!raw) return null;
  const reg = { ...JSON.parse(raw), handledAt: new Date().toISOString(), handledNote: note || '' };
  await kv.put(key, JSON.stringify(reg));
  return reg;
}

