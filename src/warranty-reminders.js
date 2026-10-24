/* ============================================
   TUGA HARDWARE: 3-Year Warranty reminders (daily cron)

   The 3-Year Warranty can be added at the published price, with no
   inspection, with the device or within 30 days of dispatch. From day 31
   to the end of month 12 it can only be added after a remote diagnostic
   check of the device, which we may decline (build/content/warranty.json,
   "When to buy" and "Can I buy a plan later?"). So the reminder worth
   sending is the one that lands while the no-questions window is still
   open, not one at month 11 when the answer may be no.

   Each order is reminded at most once, only for the devices in it that
   have no 3-Year Warranty line of their own, and never when the payment
   was refunded, disputed or cancelled.
   ============================================ */

import { PRODUCTS } from './api.js';
import { sendWarrantyReminder } from './email.js';
import { updateOrder } from './orders.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The no-inspection window, from dispatch (warranty.json, "When to buy"). */
export const WINDOW_DAYS = 30;

// With a recorded dispatch date: remind on day 20, leaving ten days to act,
// and stop once the window has closed.
const AFTER_DISPATCH_FROM = 20;
const AFTER_DISPATCH_UNTIL = WINDOW_DAYS;

// Without one (an order dispatched before the back office recorded
// dispatches, or filed by hand): dispatch happens somewhere in the first
// 14 calendar days after payment (DELIVERY is 7 to 10 working days), so the
// window closes between day 31 and day 44. Day 24 leaves a week in the
// worst case; day 31 is the earliest the window could already be shut.
const AFTER_PAYMENT_FROM = 24;
const AFTER_PAYMENT_UNTIL = 31;

// A metadata-only bound for the list() pass: nothing outside this range of
// payment age can be due under either rule, so those keys are never read.
const META_MIN_AGE = AFTER_DISPATCH_FROM;
const META_MAX_AGE = 60;

const FLAGGED = ['refunded', 'cancelled', 'disputed'];

// Keep one run well inside the Worker's subrequest and KV limits.
const MAX_PER_RUN = 25;
const MAX_READS_PER_RUN = 400;

/** Scanner variants carry their base device's warranty. */
const baseDeviceId = (id) => id.replace(/-scanner$/, '');

/** A line's product id, from the id we stored or, failing that, its name. */
function productIdOf(item) {
  const id = item.productId ?? item.id;
  if (id && PRODUCTS[id]) return id;
  return Object.keys(PRODUCTS).find((key) => PRODUCTS[key].name === item.name) ?? null;
}

/**
 * The devices in an order with no 3-Year Warranty bought for them, by base
 * model: [{ id, name, quantity, planId, planPrice }]. A warranty line covers
 * one unit, so two A8s with one warranty leaves one A8 uncovered.
 */
export function uncoveredDevices(items = []) {
  const devices = new Map();
  const covered = new Map();
  for (const item of items) {
    const id = productIdOf(item);
    if (!id) continue;
    const product = PRODUCTS[id];
    const qty = Math.max(1, Number(item.quantity) || 1);
    if (product.device) {
      const base = baseDeviceId(id);
      devices.set(base, (devices.get(base) || 0) + qty);
    } else if (product.warrantyFor) {
      covered.set(product.warrantyFor, (covered.get(product.warrantyFor) || 0) + qty);
    }
  }
  const out = [];
  for (const [base, qty] of devices) {
    const planId = `wty-3yr-${base}`;
    const plan = PRODUCTS[planId];
    const left = qty - (covered.get(base) || 0);
    if (!plan || left <= 0) continue;
    out.push({ id: base, name: PRODUCTS[base].name, quantity: left, planId, planPrice: plan.price });
  }
  return out;
}

/**
 * Whether an order should be reminded right now, and about what. Returns
 * null when it should not, else { devices, windowEnd } where windowEnd is a
 * Date when the dispatch date is known and null when the email can only
 * say "within 30 days of dispatch".
 */
export function reminderDue(order, now = Date.now()) {
  if (!order || order.warrantyReminderAt || !order.customerEmail) return null;
  if (FLAGGED.includes(order.status)) return null;

  const devices = uncoveredDevices(order.items);
  if (!devices.length) return null;

  const dispatchedAt = Date.parse(order.dispatch?.at || '');
  const paidAt = Date.parse(order.paidAt || '');
  let from;
  let until;
  let windowEnd = null;
  if (!Number.isNaN(dispatchedAt)) {
    from = dispatchedAt + AFTER_DISPATCH_FROM * DAY_MS;
    until = dispatchedAt + AFTER_DISPATCH_UNTIL * DAY_MS;
    windowEnd = new Date(dispatchedAt + WINDOW_DAYS * DAY_MS);
  } else if (!Number.isNaN(paidAt)) {
    from = paidAt + AFTER_PAYMENT_FROM * DAY_MS;
    until = paidAt + AFTER_PAYMENT_UNTIL * DAY_MS;
  } else {
    return null;
  }
  if (now < from || now > until) return null;
  return { devices, windowEnd };
}

/** Rule a key out from its metadata alone, without reading the record. */
function metadataRulesOut(metadata, now) {
  if (!metadata) return false;
  if (metadata.warrantyReminderAt || !metadata.paidAt) return true;
  if (FLAGGED.includes(metadata.status)) return true;
  const age = now - Date.parse(metadata.paidAt);
  return !(age >= META_MIN_AGE * DAY_MS && age <= META_MAX_AGE * DAY_MS);
}

export async function sendWarrantyReminders(env, { now = Date.now() } = {}) {
  if (!env.ORDERS || !env.RESEND_API_KEY) {
    console.log('Warranty reminders skipped: ORDERS or RESEND_API_KEY missing');
    return { sent: 0 };
  }

  let sent = 0;
  let reads = 0;
  let cursor;

  do {
    const page = await env.ORDERS.list({ prefix: 'order:', cursor });
    cursor = page.list_complete ? undefined : page.cursor;

    for (const { name, metadata } of page.keys) {
      if (sent >= MAX_PER_RUN || reads >= MAX_READS_PER_RUN) return { sent };
      if (metadataRulesOut(metadata, now)) continue;

      reads++;
      const raw = await env.ORDERS.get(name);
      if (!raw) continue;
      const order = JSON.parse(raw);
      const due = reminderDue(order, now);
      if (!due) continue;

      // Mark before sending, as the review cron does: a mark with no email
      // behind it is the lesser harm, and a failed send clears it below so
      // tomorrow's run can try again.
      let marked = false;
      try {
        await updateOrder(env.ORDERS, order.orderId, { warrantyReminderAt: new Date(now).toISOString() });
        marked = true;
        await sendWarrantyReminder(env, order.customerEmail, {
          orderId: order.orderId,
          customerName: order.customerName,
          devices: due.devices,
          windowEnd: due.windowEnd,
          idempotencyKey: `wty-reminder-${order.orderId}`,
        });
        sent++;
      } catch (err) {
        console.error('Warranty reminder failed for', order.orderId, err);
        if (marked) {
          await updateOrder(env.ORDERS, order.orderId, { warrantyReminderAt: null })
            .catch((e) => console.error('Could not clear warranty reminder mark for', order.orderId, e));
        }
      }
    }
  } while (cursor);

  console.log(`Warranty reminders sent: ${sent}`);
  return { sent };
}
