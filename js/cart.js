/* ============================================
   TUGA HARDWARE — Cart Logic
   localStorage-based cart system
   ============================================ */

const TugaCart = {
  STORAGE_KEY: 'tuga-cart',

  getCart() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },

  saveCart(cart) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    updateNavCartCount();
  },

  addItem(productId, quantity = 1) {
    const cart = this.getCart();
    const existing = cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ id: productId, quantity });
    }
    this.saveCart(cart);
    return cart;
  },

  removeItem(productId) {
    let cart = this.getCart();
    cart = cart.filter(item => item.id !== productId);
    this.saveCart(cart);
    return cart;
  },

  updateQuantity(productId, quantity) {
    const cart = this.getCart();
    const item = cart.find(item => item.id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
    }
    this.saveCart(cart);
    return cart;
  },

  clearCart() {
    this.saveCart([]);
  },

  getItemCount() {
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  },

  getDeviceCount() {
    // Only count devices (not accessories) for bulk discount
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  },

  getDiscountTier(deviceCount) {
    if (deviceCount >= 10) return { percent: 10, label: '10+ units: 10% off' };
    if (deviceCount >= 5) return { percent: 8, label: '5-9 units: 8% off' };
    if (deviceCount >= 3) return { percent: 5, label: '3-4 units: 5% off' };
    if (deviceCount >= 2) return { percent: 3, label: '2 units: 3% off' };
    return { percent: 0, label: null };
  },

  calculateTotals(products) {
    const cart = this.getCart();
    let subtotal = 0;
    const items = [];

    cart.forEach(cartItem => {
      const product = products.find(p => p.id === cartItem.id);
      if (product) {
        const lineTotal = product.price * cartItem.quantity;
        subtotal += lineTotal;
        items.push({
          ...cartItem,
          product,
          lineTotal
        });
      }
    });

    const deviceCount = this.getDeviceCount();
    const discount = this.getDiscountTier(deviceCount);
    const discountAmount = subtotal * (discount.percent / 100);
    const total = subtotal - discountAmount;

    return {
      items,
      subtotal,
      discount,
      discountAmount,
      total,
      deviceCount,
      shipping: 0 // Free UK shipping
    };
  }
};

/* --- Cart Page Renderer --- */
function renderCartPage(products) {
  const cartItemsEl = document.querySelector('.cart-items');
  const cartSummaryEl = document.querySelector('.cart-summary');
  const cartEmptyEl = document.querySelector('.cart-empty');
  const cartFilledEl = document.querySelector('.cart-filled');

  if (!cartItemsEl) return;

  const totals = TugaCart.calculateTotals(products);

  if (totals.items.length === 0) {
    if (cartEmptyEl) cartEmptyEl.style.display = 'block';
    if (cartFilledEl) cartFilledEl.style.display = 'none';
    return;
  }

  if (cartEmptyEl) cartEmptyEl.style.display = 'none';
  if (cartFilledEl) cartFilledEl.style.display = 'grid';

  // Render items
  cartItemsEl.innerHTML = totals.items.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-image">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="4" y="3" width="16" height="18" rx="2"/>
          <line x1="8" y1="7" x2="16" y2="7"/>
        </svg>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product.name}</div>
        <div class="cart-item-variant">${item.product.tagline}</div>
        <div class="cart-item-controls">
          <div class="quantity-selector">
            <button onclick="changeCartQty('${item.id}', -1)" aria-label="Decrease quantity">&minus;</button>
            <input type="number" value="${item.quantity}" min="1" max="99" onchange="setCartQty('${item.id}', this.value)" aria-label="Quantity">
            <button onclick="changeCartQty('${item.id}', 1)" aria-label="Increase quantity">+</button>
          </div>
          <div class="cart-item-price">£${item.lineTotal}</div>
          <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  // Render summary
  if (cartSummaryEl) {
    let discountHTML = '';
    if (totals.discount.percent > 0) {
      discountHTML = `
        <div class="cart-summary-row" style="color: var(--green-700);">
          <span>Bulk discount (${totals.discount.percent}%)</span>
          <span>&minus;£${totals.discountAmount.toFixed(0)}</span>
        </div>
      `;
    }

    let discountNote = '';
    if (totals.deviceCount < 2) {
      discountNote = '<div class="cart-discount-note">Add 2+ devices for automatic bulk discount</div>';
    } else if (totals.deviceCount < 5) {
      discountNote = `<div class="cart-discount-note">Add ${5 - totals.deviceCount} more for 8% off</div>`;
    }

    cartSummaryEl.innerHTML = `
      <h2>Order Summary</h2>
      <div class="cart-summary-row">
        <span>Subtotal (${totals.deviceCount} items)</span>
        <span>£${totals.subtotal}</span>
      </div>
      <div class="cart-summary-row">
        <span>Shipping</span>
        <span style="color: var(--green-700); font-weight: 600;">FREE</span>
      </div>
      ${discountHTML}
      <div class="cart-summary-row cart-summary-total">
        <span>Total</span>
        <span class="price">£${totals.total.toFixed(0)}</span>
      </div>
      ${discountNote}
      <div class="cart-checkout-btns">
        <button class="btn btn-primary btn-lg" onclick="initiateCheckout('stripe')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Checkout with Card
        </button>
        <button class="btn btn-outline btn-lg" onclick="initiateCheckout('paypal')" style="background: #ffc439; color: #003087; border-color: #ffc439;">
          Pay with PayPal
        </button>
      </div>
      <div class="cart-trust">
        <span>🔒 Secure checkout</span>
        <span>🚚 Free UK delivery</span>
        <span>↩️ 30-day returns</span>
      </div>
    `;
  }
}

function changeCartQty(productId, delta) {
  const cart = TugaCart.getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    TugaCart.updateQuantity(productId, newQty);
    loadCartPage();
  }
}

function setCartQty(productId, value) {
  const qty = parseInt(value, 10);
  if (qty < 1 || isNaN(qty)) return;
  TugaCart.updateQuantity(productId, qty);
  loadCartPage();
}

function removeFromCart(productId) {
  TugaCart.removeItem(productId);
  loadCartPage();
  showToast('Item removed from cart');
}

function loadCartPage() {
  fetch('/data/products.json')
    .then(res => res.json())
    .then(data => renderCartPage(data.products))
    .catch(err => console.error('Failed to load products:', err));
}

// Init cart page if on cart.html
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.cart-page')) {
    loadCartPage();
  }
});
