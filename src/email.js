/* ============================================
   TUGA HARDWARE — Email Module (Resend API)
   Branded transactional emails via fetch.
   ============================================ */

const FROM_EMAIL = 'Tuga Hardware <orders@tugahardware.com>';
const SUPPORT_EMAIL = 'support@tugahardware.com';

// Must match SITE.deliveryWindow in build/lib/layout.mjs, which feeds every
// page on the site. Orders ship direct from the manufacturer.
const DELIVERY_WINDOW = '10 to 20 working days';

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
  const { orderId, reference, items, discount, total, shippingAddress, invoiceUrl } = orderDetails;
  // Customers quote this to support. Fall back to the provider's id only for
  // an order recorded before references existed.
  const orderNumber = reference || orderId;

  // Build line-item rows
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};">${item.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${BRAND.darkText};text-align:right;">&pound;${(item.unitPrice / 100).toFixed(2)}</td>
    </tr>
  `).join('');

  // `discount` is the bulk-discount PERCENT (from checkout metadata), not an
  // amount — the unit prices in the rows above already have it applied.
  const discountRow = Number(discount) > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 0;font-size:13px;color:${BRAND.copper};font-weight:600;">Bulk discount of ${Number(discount)}% applied — prices above already include it</td>
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
      <strong>Order number:</strong> ${escapeHtml(orderNumber)}
    </p>
    ${invoiceUrl ? `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.darkText};">
      <a href="${escapeHtml(invoiceUrl)}" style="color:${BRAND.copper};font-weight:600;">Download your invoice</a>
    </p>` : ''}

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
        Your order ships direct from the manufacturer. Please allow
        ${DELIVERY_WINDOW} for delivery. We will email you a tracking
        number as soon as it ships.
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
    subject: `Order confirmed — ${orderNumber}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Shipping notification email
// ---------------------------------------------------------------------------
export async function sendShippingNotification(env, email, { reference, trackingNumber, carrier }) {
  const tracking = encodeURIComponent(trackingNumber);
  const trackingUrl = carrier && carrier.toLowerCase().includes('royal mail')
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${tracking}`
    : `https://track.aftership.com/${tracking}`;

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">Your order has shipped</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.mutedText};">Good news — your Tuga Hardware order ${escapeHtml(reference)} is on its way.</p>

    <div style="padding:24px;background-color:${BRAND.cream};border-radius:6px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.mutedText};text-transform:uppercase;letter-spacing:1px;">Tracking number</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.green};letter-spacing:1px;">${escapeHtml(trackingNumber)}</p>
      ${carrier ? `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.darkText};">Carrier: ${escapeHtml(carrier)}</p>` : ''}
      <a href="${trackingUrl}" style="display:inline-block;padding:12px 32px;background-color:${BRAND.copper};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Track your order</a>
    </div>

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:${BRAND.green};">Delivery estimate</h3>
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        Most orders arrive within ${DELIVERY_WINDOW} of being placed.
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
    subject: `Your Tuga Hardware order ${reference} has shipped`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Buyer's guide, sent to whoever signs up on the site
// ---------------------------------------------------------------------------
// The signup form promises "how 6, 8 and 10 inch actually compare in the
// hand, what IP and MIL ratings mean in practice, and the questions worth
// asking before you spend". Every claim here is also on the site (the home
// page FAQ and product pages); keep them in step. No prices, so nothing here
// goes stale when the catalogue changes.
export async function sendBuyersGuide(env, email) {
  const h = (text) => `<h3 style="margin:28px 0 8px;font-size:16px;color:${BRAND.green};">${text}</h3>`;
  const p = (text) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:${BRAND.darkText};">${text}</p>`;
  const li = (items) => `<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.65;color:${BRAND.darkText};">${items.map((i) => `<li style="margin-bottom:6px;">${i}</li>`).join('')}</ul>`;
  const site = 'https://www.tugahardware.com';

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.green};">The rugged tablet buyer's guide</h2>
    <p style="margin:0 0 8px;font-size:15px;color:${BRAND.mutedText};">One page, as promised. Useful whether or not you buy from us.</p>

    ${h('1. Pick the size first')}
    ${p('Nearly everyone chooses on size, so start there and let the specification follow.')}
    ${li([
      '<strong>6 inch (Tuga A6):</strong> goes in a pocket. Right if you mostly take photos, log jobs and stay in touch.',
      '<strong>8 inch (Tuga A8):</strong> what most tradespeople settle on. Big enough to fill in a form or follow a drawing, small enough for one hand and a van door pocket.',
      '<strong>10 inch (Tuga A10):</strong> for people who read drawings all day: blueprints, BIM viewers, full spreadsheets.',
    ])}
    ${p('If you are unsure, the 8 inch is the safe choice. Every size also comes in a Windows version.')}

    ${h('2. What IP67, IP68 and IP69K mean')}
    ${p('All three mean fully dust tight. The second digit is water. IP67 survives 1 metre of immersion for 30 minutes. IP68 goes deeper and longer. IP69K adds resistance to high pressure, high temperature jets, which matters if your kit gets jet washed rather than just rained on.')}
    ${p('For most UK trades IP67 is genuinely enough. IP68 and IP69K are the margin you want if the device lives outdoors.')}

    ${h('3. What "drop tested" should mean')}
    ${p('Look for MIL-STD-810H or 810G. It is a published test method, not a marketing phrase: repeated 1.2 to 1.5 metre drops onto plywood over concrete, on every face and corner, with the device still working afterwards. It does not make a device indestructible. It means the housing, corners and screen are engineered for the drop that kills a consumer tablet.')}

    ${h('4. Android or Windows')}
    ${p('Android if you use apps: job management, forms, photos, maps, cloud tools. That covers most trades and it is cheaper. Windows only if a specific piece of desktop software has no mobile version: diagnostic tools, legacy databases, GIS, CAD viewers or network drives. Windows devices cost roughly twice as much.')}

    ${h('5. Questions worth asking before you spend')}
    ${li([
      'Will I read drawings on it, or mostly take photos and fill in forms? That decides the size.',
      'Is there one piece of software I must run that only exists on Windows? If not, Android.',
      'Will it get rained on, or hosed down? That decides IP68 or IP69K.',
      'Can I read the screen outside? Look for 500 nits or more.',
      'Will the battery last my longest day, not my average one?',
      'Does it need to live in a vehicle mount or a dock?',
      'How many does the team need? Our discounts start at two devices and apply automatically.',
    ])}

    <div style="margin-top:32px;padding:20px;background-color:${BRAND.cream};border-radius:6px;">
      <p style="margin:0;font-size:14px;color:${BRAND.darkText};line-height:1.6;">
        Still not sure? Reply to this email with what you do and where the device will be used, and we will tell you which size fits, including when the honest answer is the cheapest one.
        <br><br>
        <a href="${site}/products/" style="color:${BRAND.copper};font-weight:600;">Compare the range</a>
      </p>
    </div>

    <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mutedText};">You asked for this guide on tugahardware.com. This is the only email you will get from that form.</p>
  `;

  return sendEmail(env, {
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: "Your rugged tablet buyer's guide",
    html: emailWrapper("Buyer's guide — Tuga Hardware", bodyHtml),
  });
}

// ---------------------------------------------------------------------------
// Enquiry from the contact form
// ---------------------------------------------------------------------------
export async function sendEnquiry(env, { name, email, topic, message }) {
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
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Low-level Resend API call
// ---------------------------------------------------------------------------
async function sendEmail(env, { to, subject, html, replyTo }) {
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
