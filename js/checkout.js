/* ============================================
   TUGA HARDWARE — Checkout Integration
   Stripe Checkout + PayPal Buttons
   ============================================ */

async function initiateCheckout(method) {
  const products = await loadProducts();
  const totals = TugaCart.calculateTotals(products);

  if (totals.items.length === 0) {
    showToast('Your cart is empty');
    return;
  }

  if (method === 'stripe') {
    initiateStripeCheckout(totals);
  } else if (method === 'paypal') {
    initiatePayPalCheckout(totals);
  }
}

/* --- Stripe Checkout --- */
async function initiateStripeCheckout(totals) {
  try {
    const lineItems = totals.items.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lineItems,
        discount: totals.discount.percent
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    window.location.href = url;
  } catch (err) {
    console.error('Stripe checkout error:', err);
    showToast('Checkout temporarily unavailable. Please try again.');
  }
}

/* --- PayPal Checkout --- */
async function initiatePayPalCheckout(totals) {
  try {
    const lineItems = totals.items.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    const response = await fetch('/api/create-paypal-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lineItems,
        discount: totals.discount.percent,
        total: totals.total
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create PayPal order');
    }

    const { approvalUrl } = await response.json();
    window.location.href = approvalUrl;
  } catch (err) {
    console.error('PayPal checkout error:', err);
    showToast('Checkout temporarily unavailable. Please try again.');
  }
}
