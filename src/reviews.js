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
        if (metadata.status === 'refunded' || metadata.status === 'cancelled') continue;
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
      if (order.status === 'refunded' || order.status === 'cancelled') continue;

      const age = now - Date.parse(order.paidAt);
      if (!(age >= REVIEW_DELAY_DAYS * DAY_MS && age <= REVIEW_MAX_AGE_DAYS * DAY_MS)) continue;

      const token = crypto.randomUUID();
      try {
        await env.ORDERS.put(`reviewtoken:${token}`, order.orderId, {
          expirationTtl: 120 * 24 * 60 * 60,
        });
        await sendReviewRequest(env, order.customerEmail, {
          items: order.items,
          reviewUrl: `${env.SITE_URL}/review?t=${token}`,
        });
        await updateOrder(env.ORDERS, order.orderId, {
          reviewRequestedAt: new Date().toISOString(),
        });
        sent++;
      } catch (err) {
        // Leave reviewRequestedAt unset so tomorrow's run tries again.
        console.error('Review request failed for', order.orderId, err);
      }
    }
  } while (cursor);

  console.log(`Review requests sent: ${sent}`);
  return { sent };
}
