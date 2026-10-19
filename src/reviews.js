/* ============================================
   TUGA HARDWARE — Review requests (daily cron)

   Once an order is old enough to have arrived and been used, email the
   buyer one link to leave a review. Each order is asked exactly once.
   ============================================ */

import { sendReviewRequest } from './email.js';
import { updateOrder } from './orders.js';

// Delivery takes 7 to 10 working days (DELIVERY in store-config.js), so wait
// for the slowest delivery plus a fortnight of actual use.
const REVIEW_DELAY_DAYS = 28;

// Orders older than this are never asked: the request would feel random.
const REVIEW_MAX_AGE_DAYS = 90;

// Keep one run well inside the Worker's subrequest limit.
const MAX_PER_RUN = 25;

// Cap record reads per run so a large store never exhausts the Worker's
// KV operation limit. Keys with metadata are skipped without a read.
const MAX_READS_PER_RUN = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sendReviewRequests(env) {
  if (!env.ORDERS || !env.RESEND_API_KEY) {
    console.log('Review requests skipped: ORDERS or RESEND_API_KEY missing');
    return { sent: 0 };
  }

  const now = Date.now();
  let sent = 0;
  let reads = 0;
  let cursor;

  do {
    const page = await env.ORDERS.list({ prefix: 'order:', cursor });
    cursor = page.list_complete ? undefined : page.cursor;

    for (const { name, metadata } of page.keys) {
      if (sent >= MAX_PER_RUN || reads >= MAX_READS_PER_RUN) return { sent };

      // Orders saved since metadata was added can be ruled out from the list
      // alone. Older keys have none and are read once, then rewritten with it
      // when their review request is sent.
      if (metadata) {
        if (metadata.reviewRequestedAt || !metadata.paidAt) continue;
        if (['refunded', 'cancelled', 'disputed'].includes(metadata.status)) continue;
        const metaAge = now - Date.parse(metadata.paidAt);
        if (!(metaAge >= REVIEW_DELAY_DAYS * DAY_MS && metaAge <= REVIEW_MAX_AGE_DAYS * DAY_MS)) continue;
      }

      reads++;
      const raw = await env.ORDERS.get(name);
      if (!raw) continue;
      const order = JSON.parse(raw);

      // Backfill metadata on legacy keys once, so later runs skip them unread.
      if (!metadata) {
        try {
          await env.ORDERS.put(name, raw, {
            metadata: {
              paidAt: order.paidAt || order.createdAt || null,
              reviewRequestedAt: order.reviewRequestedAt || null,
              status: order.status || null,
            },
          });
        } catch (err) {
          console.error('Could not backfill metadata for', name, err);
        }
      }

      if (order.reviewRequestedAt || !order.customerEmail || !order.paidAt) continue;
      if (['refunded', 'cancelled', 'disputed'].includes(order.status)) continue;

      const age = now - Date.parse(order.paidAt);
      if (!(age >= REVIEW_DELAY_DAYS * DAY_MS && age <= REVIEW_MAX_AGE_DAYS * DAY_MS)) continue;

      const token = crypto.randomUUID();
      // Mark the order before sending. If the mark were written after the
      // send and that write failed, tomorrow's run would email the customer
      // again; a mark with no email behind it is the lesser harm, and the
      // send failure below clears it so the next run can retry.
      let marked = false;
      try {
        await env.ORDERS.put(`reviewtoken:${token}`, order.orderId, {
          expirationTtl: 120 * 24 * 60 * 60,
        });
        await updateOrder(env.ORDERS, order.orderId, {
          reviewRequestedAt: new Date().toISOString(),
        });
        marked = true;
        await sendReviewRequest(env, order.customerEmail, {
          items: order.items,
          reviewUrl: `${env.SITE_URL}/review?t=${token}`,
          // Resend drops a repeat with the same key, so even a retry of
          // this run cannot send twice.
          idempotencyKey: `review-${order.orderId}`,
        });
        sent++;
      } catch (err) {
        console.error('Review request failed for', order.orderId, err);
        if (marked) {
          await updateOrder(env.ORDERS, order.orderId, { reviewRequestedAt: null })
            .catch((e) => console.error('Could not clear review mark for', order.orderId, e));
        }
      }
    }
  } while (cursor);

  console.log(`Review requests sent: ${sent}`);
  return { sent };
}
