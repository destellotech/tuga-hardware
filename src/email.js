/* ============================================
   TUGA HARDWARE — Email Module (Resend API)
   Branded transactional emails via fetch.
   ============================================ */

const FROM_EMAIL = 'Tuga Hardware <orders@tugahardware.com>';

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
            <p style="margin:0;font-size:13px;color:${BRAND.cream};">Tuga Hardware Ltd &bull; United Kingdom</p>
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
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};">${item.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:right;">&pound;${(item.unitPrice / 100).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRow = discount > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px 0;font-size:14px;color:${BRAND.copper};font-weight:600;">Bulk discount</td>
      <td style="padding:8px 0;font-size:14px;color:${BRAND.copper};text-align:right;font-weight:600;">&minus;&pound;${(discount / 100).toFixed(2)}</td>
    </tr>
  ` : '';

  const shippingBlock = shippingAddress ? `
    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 12px;font-size:15px;color:${BRAND.green};">Shipping to</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        ${shippingAddress.name || ''}<br>
        ${shippingAddress.line1 || ''}<br>
        ${shippingAddress.line2 ? shippingAddress.line2 + '<br>' : ''}
        ${shippingAddress.city || ''} ${shippingAddress.postal_code || ''}<br>
        ${shippingAddress.country || 'GB'}
      </p>
    </div>
  ` : '';

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">Order confirmed</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};">Thanks for your order. Here is your summary.</p>

    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.darkText};">
      <strong>Order:</strong> ${orderId}
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
        <td style="padding:14px 0 0;font-size:16px;font-weight:700;color:${BRAND.green};text-align:right;">&pound;${(total / 100).toFixed(2)}</td>
      </tr>
    </table>

    ${shippingBlock}

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">What happens next?</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        Your order is being processed and will ship within 2 business days.
        Typical delivery to the UK is 10 to 20 working days. We will email you
        a tracking number once your order has shipped.
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
  });
}

// ---------------------------------------------------------------------------
// Shipping notification email
// ---------------------------------------------------------------------------
export async function sendShippingNotification(env, email, trackingNumber, carrier) {
  const trackingUrl = carrier && carrier.toLowerCase().includes('royal mail')
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`
    : `https://track.aftership.com/${trackingNumber}`;

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">Your order has shipped</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};">Good news — your Tuga Hardware order is on its way.</p>

    <div style="padding:24px;background-color:${BRAND.cream};border-radius:6px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.mutedText};text-transform:uppercase;letter-spacing:1px;">Tracking number</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.green};letter-spacing:1px;">${trackingNumber}</p>
      ${carrier ? `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.darkText};">Carrier: ${carrier}</p>` : ''}
      <a href="${trackingUrl}" style="display:inline-block;padding:12px 32px;background-color:${BRAND.copper};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Track your order</a>
    </div>

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">Delivery estimate</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        UK delivery typically takes 10 to 20 working days from dispatch.
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
  });
}

// ---------------------------------------------------------------------------
// Low-level Resend API call
// ---------------------------------------------------------------------------
async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend API error (${res.status}):`, body);
    throw new Error(`Email send failed: ${res.status}`);
  }

  return res.json();
}
