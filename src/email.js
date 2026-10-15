/* ============================================
   TUGA HARDWARE — Email Module (Resend API)
   Branded transactional emails via fetch.
   ============================================ */

import { DELIVERY, TRADER, TRADER_ADDRESS_LINE, TRADER_STATEMENT } from './store-config.js';

const FROM_EMAIL = 'Tuga Hardware <orders@tugahardware.com>';
const SUPPORT_EMAIL = 'support@tugahardware.com';

// Brand colours (inline CSS — email clients strip <style> blocks)
const BRAND = {
  green: '#052e16',
  copper: '#c4856c',
  cream: '#faf7f2',
  darkText: '#1a1a1a',
  mutedText: '#666666',
};

// ---------------------------------------------------------------------------
// Shared HTML wrapper
// ---------------------------------------------------------------------------
function emailWrapper(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:${BRAND.cream};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.cream};">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background-color:${BRAND.green};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:700;color:${BRAND.copper};letter-spacing:0.5px;">TUGA HARDWARE</h1>
            <p style="margin:6px 0 0;font-size:12px;color:${BRAND.cream};letter-spacing:2px;text-transform:uppercase;">Hard Shell. Long Life.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${BRAND.green};padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:${BRAND.cream};">${TRADER_STATEMENT}</p>
            <p style="margin:8px 0 0;font-size:12px;color:${BRAND.copper};">
              <a href="https://tugahardware.com" style="color:${BRAND.copper};text-decoration:none;">tugahardware.com</a> &bull;
              <a href="mailto:support@tugahardware.com" style="color:${BRAND.copper};text-decoration:none;">support@tugahardware.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Order confirmation email
// ---------------------------------------------------------------------------
export async function sendOrderConfirmation(env, email, orderDetails) {
  const { orderId, items, subtotal, discount, total, shippingAddress } = orderDetails;

  // Build line-item rows
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};">${escapeHtml(item.name)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:center;">${escapeHtml(item.quantity)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:right;">&pound;${escapeHtml((Number(item.unitPrice) / 100).toFixed(2))}</td>
    </tr>
  `).join('');

  // `discount` is the bulk-discount PERCENT (from checkout metadata), not an
  // amount — the unit prices in the rows above already have it applied.
  const discountRow = Number(discount) > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 0;font-size:13px;color:${BRAND.copper};font-weight:600;">Bulk discount of ${escapeHtml(Number(discount))}% applied — prices above already include it</td>
    </tr>
  ` : '';

  // A paid plan is registered to the device serial at dispatch. Consumers who
  // buy an extended warranty must be told of their 45-day cancellation right
  // at purchase (Supply of Extended Warranties on Domestic Electrical Goods
  // Order 2005, article 8).
  const hasPlan = items.some((item) =>
    String(item.id || '').startsWith('wty-') || /^3-Year Warranty/.test(item.name || ''));
  const planBlock = hasPlan ? `
    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">Your 3-Year Warranty</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        The plan is registered to each device's serial number when it is dispatched,
        and you can ask us at any time for the serial, plan and end date we hold.
        The Plan Terms are at
        <a href="https://www.tugahardware.com/warranty-terms" style="color:${BRAND.copper};">tugahardware.com/warranty-terms</a>.
        If you bought as a consumer, you may cancel the plan within 45 days of
        purchase for a full refund if you have made no claim, by emailing
        <a href="mailto:support@tugahardware.com" style="color:${BRAND.copper};">support@tugahardware.com</a>;
        business buyers have 30 days. Your statutory rights are not affected.
      </p>
    </div>
  ` : '';

  const shippingBlock = shippingAddress ? `
    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 12px;font-size:15px;color:${BRAND.green};">Shipping to</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        ${escapeHtml(shippingAddress.name || '')}<br>
        ${escapeHtml(shippingAddress.line1 || '')}<br>
        ${shippingAddress.line2 ? escapeHtml(shippingAddress.line2) + '<br>' : ''}
        ${escapeHtml(shippingAddress.city || '')} ${escapeHtml(shippingAddress.postal_code || '')}<br>
        ${escapeHtml(shippingAddress.country || 'GB')}
      </p>
    </div>
  ` : '';

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">Order confirmed</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};">Thanks for your order. Here is your summary.</p>

    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.darkText};">
      <strong>Order:</strong> ${escapeHtml(orderId)}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr style="border-bottom:2px solid ${BRAND.green};">
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:${BRAND.green};text-transform:uppercase;">Item</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:${BRAND.green};text-transform:uppercase;text-align:center;">Qty</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:${BRAND.green};text-transform:uppercase;text-align:right;">Price</td>
      </tr>
      ${itemRows}
      ${discountRow}
      <tr>
        <td colspan="2" style="padding:14px 0 0;font-size:16px;font-weight:700;color:${BRAND.green};">Total</td>
        <td style="padding:14px 0 0;font-size:16px;font-weight:700;color:${BRAND.green};text-align:right;">&pound;${escapeHtml((Number(total) / 100).toFixed(2))}</td>
      </tr>
    </table>

    ${shippingBlock}

    ${planBlock}

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">What happens next?</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        Your order is being processed. ${DELIVERY.summary}
      </p>
    </div>

    <div style="margin-top:32px;padding:20px;border:1px solid ${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">Your right to cancel</h3>
      <p style="margin:0 0 12px;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        If you bought as a consumer, you may cancel this purchase within 14 days
        after the day you receive the device, without giving a reason, even if
        you have opened the box or switched it on. Tell us by email to
        <a href="mailto:support@tugahardware.com" style="color:${BRAND.copper};">support@tugahardware.com</a>
        or by post; you can use the form below but you do not have to. We refund
        you within 14 days of getting the goods back, or of your proof that you
        have sent them. Unless the item is faulty or we sent the wrong item, you
        pay the cost of returning it, and we may deduct for handling beyond what
        is needed to check the device works. On top of that legal right, everyone,
        consumer or business, can return an unused device in its original
        condition and packaging within 30 days of delivery for a full refund. A faulty
        device can be rejected for a full refund within 30 days of delivery.
        Your statutory rights are not affected.
      </p>
      <p style="margin:0;font-size:13px;color:${BRAND.mutedText};line-height:1.6;">
        <strong>Model cancellation form</strong> (complete and return this form only if you wish to cancel the contract)<br>
        To ${TRADER.legalName} trading as ${TRADER.tradingName}, ${TRADER_ADDRESS_LINE}, support@tugahardware.com:<br>
        I/We hereby give notice that I/We cancel my/our contract of sale of the following goods: ...<br>
        Ordered on / received on: ...<br>
        Name of consumer(s): ...<br>
        Address of consumer(s): ...<br>
        Signature of consumer(s) (only if this form is notified on paper): ...<br>
        Date: ...
      </p>
    </div>

    <p style="margin:32px 0 0;font-size:13px;color:${BRAND.mutedText};">
      Questions? Reply to this email or contact
      <a href="mailto:support@tugahardware.com" style="color:${BRAND.copper};">support@tugahardware.com</a>.
    </p>
  `;

  const html = emailWrapper('Order Confirmed — Tuga Hardware', bodyHtml);

  return sendEmail(env, {
    to: email,
    subject: `Order confirmed — ${orderId}`,
    html,
    replyTo: SUPPORT_EMAIL,
    // Resend drops a repeat send with the same key for 24 hours, so the
    // webhook and the confirmation page racing cannot email twice.
    idempotencyKey: `order-confirmation:${orderId}`,
  });
}

// ---------------------------------------------------------------------------
// Shipping notification email
// ---------------------------------------------------------------------------
export async function sendShippingNotification(env, email, trackingNumber, carrier) {
  const trackingUrl = carrier && carrier.toLowerCase().includes('royal mail')
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`
    : `https://track.aftership.com/${encodeURIComponent(trackingNumber)}`;

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">Your order has shipped</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};">Good news — your Tuga Hardware order is on its way.</p>

    <div style="padding:24px;background-color:${BRAND.cream};border-radius:6px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.mutedText};text-transform:uppercase;letter-spacing:1px;">Tracking number</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.green};letter-spacing:1px;">${escapeHtml(trackingNumber)}</p>
      ${carrier ? `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.darkText};">Carrier: ${escapeHtml(carrier)}</p>` : ''}
      <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 32px;background-color:${BRAND.copper};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Track your order</a>
    </div>

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">Delivery estimate</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        Your order should arrive within ${DELIVERY.days} of being placed.
        You can track progress using the link above.
      </p>
    </div>

    <p style="margin:32px 0 0;font-size:13px;color:${BRAND.mutedText};">
      Questions? Reply to this email or contact
      <a href="mailto:support@tugahardware.com" style="color:${BRAND.copper};">support@tugahardware.com</a>.
    </p>
  `;

  const html = emailWrapper('Your Order Has Shipped — Tuga Hardware', bodyHtml);

  return sendEmail(env, {
    to: email,
    subject: `Your Tuga Hardware order has shipped — ${trackingNumber}`,
    html,
    replyTo: SUPPORT_EMAIL,
  });
}

// ---------------------------------------------------------------------------
// Review request, sent once per order by the daily cron (src/reviews.js)
// ---------------------------------------------------------------------------
export async function sendReviewRequest(env, email, { items, reviewUrl }) {
  const names = (items || []).map((i) => escapeHtml(i.name)).join(', ') || 'your order';

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">How is it holding up?</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};line-height:1.6;">
      You have had your ${names} for a few weeks now. We are a small UK operation and
      honest reviews from people who actually use the kit are how other tradespeople
      decide whether to trust us. We read every review, good or bad.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${reviewUrl}" style="display:inline-block;padding:14px 36px;background-color:${BRAND.copper};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">Leave a review</a>
    </div>

    <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
      It takes about a minute. If something is wrong with the device, reply to this
      email instead and we will sort it out under your warranty.
    </p>

    <p style="margin:32px 0 0;font-size:12px;color:${BRAND.mutedText};">
      This is the only review email we will send about this order.
    </p>
  `;

  return sendEmail(env, {
    to: email,
    subject: 'How is your Tuga holding up?',
    html: emailWrapper('How is it holding up? — Tuga Hardware', bodyHtml),
    replyTo: SUPPORT_EMAIL,
  });
}

// ---------------------------------------------------------------------------
// New-order alert to the shop
// ---------------------------------------------------------------------------
/**
 * Tell the shop what was bought, who by and where it goes. Sent to
 * ORDER_ALERT_EMAIL if set (a [vars] entry in wrangler.toml), otherwise to
 * support@. Reply-to is the customer, so answering the alert reaches them.
 */
export async function sendNewOrderAlert(env, order) {
  const {
    orderId, provider, paymentIntent, captureId, customerEmail, customerName,
    customerPhone, shippingAddress, items = [], discount, total,
  } = order;
  const money = (pence) => `£${(Number(pence) / 100).toFixed(2)}`;
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px 6px 0;font:500 13px monospace;color:#8a8a82;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font:14px sans-serif;color:#1a1a18">${value}</td></tr>`;

  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center">${escapeHtml(item.quantity)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right">${money(item.total ?? item.unitPrice * item.quantity)}</td>
    </tr>`).join('');

  const a = shippingAddress || {};
  const address = shippingAddress
    ? [a.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
        .filter(Boolean).map(escapeHtml).join('<br>')
    : '—';

  const paymentUrl = provider === 'stripe' && paymentIntent
    ? `https://dashboard.stripe.com/payments/${encodeURIComponent(paymentIntent)}`
    : provider === 'paypal' && captureId
      ? `https://www.paypal.com/activity/payment/${encodeURIComponent(captureId)}`
      : null;
  const paymentLabel = provider === 'paypal' ? 'PayPal' : 'Card (Stripe)';
  const payment = paymentUrl
    ? `${paymentLabel} &middot; <a href="${escapeHtml(paymentUrl)}" style="color:${BRAND.copper}">view payment</a>`
    : paymentLabel;

  const summary = items
    .map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
    .join(', ');

  return sendEmail(env, {
    to: env.ORDER_ALERT_EMAIL || SUPPORT_EMAIL,
    replyTo: customerEmail || undefined,
    subject: `New order ${money(total)}: ${summary || 'see details'}`,
    html: `<div style="font-family:sans-serif;max-width:640px;color:#1a1a18">
      <h2 style="font-size:20px;color:${BRAND.green};margin:0 0 4px">New order: ${money(total)}</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#8a8a82">Paid and confirmed. Reference ${escapeHtml(orderId)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;font-size:12px;font-weight:600;text-transform:uppercase;color:${BRAND.green}">Item</td>
          <td style="padding:8px 0;font-size:12px;font-weight:600;text-transform:uppercase;color:${BRAND.green};text-align:center">Qty</td>
          <td style="padding:8px 0;font-size:12px;font-weight:600;text-transform:uppercase;color:${BRAND.green};text-align:right">Total</td>
        </tr>
        ${itemRows}
        ${Number(discount) > 0 ? `<tr><td colspan="3" style="padding:8px 0;font-size:13px;color:${BRAND.copper}">Bulk discount of ${escapeHtml(Number(discount))}% already applied</td></tr>` : ''}
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-size:16px;font-weight:700">Total paid</td>
          <td style="padding:12px 0 0;font-size:16px;font-weight:700;text-align:right">${money(total)}</td>
        </tr>
      </table>
      <table style="border-collapse:collapse;margin:24px 0 0">
        ${row('Customer', escapeHtml(customerName || '—'))}
        ${row('Email', customerEmail ? `<a href="mailto:${escapeHtml(customerEmail)}" style="color:${BRAND.copper}">${escapeHtml(customerEmail)}</a>` : '—')}
        ${customerPhone ? row('Phone', escapeHtml(customerPhone)) : ''}
        ${row('Ship to', address)}
        ${row('Payment', payment)}
        ${order.saleId ? row('Back office', `<a href="${escapeHtml(`${env.SITE_URL || ''}/admin#/sales/${encodeURIComponent(order.saleId)}`)}" style="color:${BRAND.copper}">${escapeHtml(order.saleId)}: dispatch, serials, warranty</a>`) : ''}
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#8a8a82">Reply to this email to reach the customer. Delivery promised: ${escapeHtml(DELIVERY.days)}.</p>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// Enquiry from the contact form / a buyer's-guide signup
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Daily "needs attention" digest to the shop (src/backoffice.js decides
// what goes in; nothing is sent on a quiet day)
// ---------------------------------------------------------------------------
/**
 * @param {{title: string, lines: string[], link: string}[]} sections
 */
export async function sendDigest(env, sections) {
  const base = `${env.SITE_URL || ''}/admin`;
  const count = sections.reduce((n, s) => n + s.lines.length, 0);
  const blocks = sections.map((s) => `
    <h3 style="margin:24px 0 8px;font-size:15px;color:${BRAND.green}">${escapeHtml(s.title)} (${s.lines.length})</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${s.lines.slice(0, 20).map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    ${s.lines.length > 20 ? `<p style="font-size:13px;color:#8a8a82">and ${s.lines.length - 20} more</p>` : ''}
    <p style="margin:6px 0 0;font-size:13px"><a href="${escapeHtml(base + s.link)}" style="color:${BRAND.copper}">Open in the back office</a></p>`).join('');

  return sendEmail(env, {
    to: env.ORDER_ALERT_EMAIL || SUPPORT_EMAIL,
    subject: `Tuga: ${count} thing${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`,
    idempotencyKey: `digest-${new Date().toISOString().slice(0, 10)}`,
    html: `<div style="font-family:sans-serif;max-width:640px;color:#1a1a18">
      <h2 style="font-size:20px;color:${BRAND.green};margin:0 0 4px">Today in the back office</h2>
      <p style="margin:0;font-size:13px;color:#8a8a82">Sent each morning when something needs you.</p>
      ${blocks}
    </div>`,
  });
}

export async function sendEnquiry(env, { name, email, company, topic, message }) {
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px;font:500 13px monospace;color:#8a8a82">${escapeHtml(label)}</td><td style="padding:6px 12px;font:14px sans-serif;color:#1a1a18">${escapeHtml(value)}</td></tr>`;

  return sendEmail(env, {
    to: SUPPORT_EMAIL,
    replyTo: email,
    subject: `[Tuga] ${topic || 'Enquiry'} — ${name || email}`,
    html: `<div style="font-family:sans-serif;max-width:640px">
      <h2 style="font-size:18px;color:#052e16">New enquiry from tugahardware.com</h2>
      <table style="border-collapse:collapse;margin:16px 0">
        ${row('Name', name || '—')}
        ${row('Email', email || '—')}
        ${row('Company', company || '—')}
        ${row('Topic', topic || '—')}
      </table>
      <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;color:#1a1a18">${escapeHtml(message || '')}</p>
    </div>`,
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Low-level Resend API call
// ---------------------------------------------------------------------------
async function sendEmail(env, { to, subject, html, replyTo, idempotencyKey }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend API error (${res.status}):`, body);
    throw new Error(`Email send failed: ${res.status}`);
  }

  return res.json();
}
