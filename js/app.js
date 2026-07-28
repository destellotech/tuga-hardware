/* ==========================================================================
   Tuga Hardware — front-end behaviour

   One file, loaded with `defer` on every page. Each init() bails immediately
   if its markup is not present, so the same bundle serves every page.

   Pages are fully rendered at build time; nothing here is required to read
   the content. This layer only adds interaction.
   ========================================================================== */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const money = (n) =>
    '£' +
    Number(n).toLocaleString('en-GB', {
      minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
      maximumFractionDigits: 2,
    });

  /* ---------------------------------------------------------------- catalogue */

  let catalogue = null;

  async function getCatalogue() {
    if (catalogue) return catalogue;
    const res = await fetch('/data/products.json');
    if (!res.ok) throw new Error('Could not load the product catalogue');
    const data = await res.json();
    catalogue = [...data.products, ...data.accessories];
    return catalogue;
  }

  const findItem = (list, id) => list.find((p) => p.id === id);

  /* -------------------------------------------------------------------- cart */

  const Cart = {
    KEY: 'tuga-cart',

    read() {
      try {
        const raw = JSON.parse(localStorage.getItem(this.KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        // Clamp quantities so corrupted storage can't produce NaN totals.
        return raw
          .filter((i) => i && typeof i.id === 'string')
          .map((i) => ({
            id: i.id,
            quantity: Math.min(99, Math.max(1, Math.floor(Number(i.quantity)) || 1)),
          }));
      } catch {
        return [];
      }
    },

    write(items) {
      localStorage.setItem(this.KEY, JSON.stringify(items));
      paintCount();
      document.dispatchEvent(new CustomEvent('cart:change'));
    },

    add(id, qty = 1) {
      const items = this.read();
      const existing = items.find((i) => i.id === id);
      if (existing) existing.quantity += qty;
      else items.push({ id, quantity: qty });
      this.write(items);
    },

    setQty(id, qty) {
      const items = this.read();
      const item = items.find((i) => i.id === id);
      if (!item) return;
      item.quantity = Math.max(1, Math.min(99, qty));
      this.write(items);
    },

    remove(id) {
      this.write(this.read().filter((i) => i.id !== id));
    },

    count() {
      return this.read().reduce((sum, i) => sum + i.quantity, 0);
    },

    /* Mirrors getDiscountPercent() in src/api.js. The server recalculates
       every order, so this is display only — but the two must agree or the
       basket total will not match the checkout total. Tiers are earned by
       devices only, and only device prices are discounted. */
    tier(deviceUnits) {
      if (deviceUnits >= 10) return { percent: 10, label: '10+ units' };
      if (deviceUnits >= 5) return { percent: 8, label: '5–9 units' };
      if (deviceUnits >= 3) return { percent: 5, label: '3–4 units' };
      if (deviceUnits >= 2) return { percent: 3, label: '2 units' };
      return { percent: 0, label: null };
    },

    totals(products) {
      const entries = [];
      let deviceUnits = 0;

      this.read().forEach((entry) => {
        const product = findItem(products, entry.id);
        if (!product) return;
        const isDevice = !String(product.id).startsWith('acc-');
        if (isDevice) deviceUnits += entry.quantity;
        entries.push({ ...entry, product, isDevice });
      });

      const tier = this.tier(deviceUnits);

      /* Mirror the server exactly (src/api.js): the discount is applied by
         rounding each DEVICE unit price in pence, not by rounding the
         aggregate — otherwise the basket total drifts pennies away from
         what Stripe/PayPal actually charge. */
      let subtotalPence = 0;
      let totalPence = 0;

      const lines = entries.map((e) => {
        const unitPence = Math.round(e.product.price * 100);
        const chargedUnitPence =
          e.isDevice && tier.percent > 0
            ? Math.round(unitPence * (1 - tier.percent / 100))
            : unitPence;

        subtotalPence += unitPence * e.quantity;
        totalPence += chargedUnitPence * e.quantity;

        return { ...e, lineTotal: (unitPence * e.quantity) / 100 };
      });

      const units = lines.reduce((sum, l) => sum + l.quantity, 0);

      return {
        lines,
        subtotal: subtotalPence / 100,
        units,
        deviceUnits,
        tier,
        discount: (subtotalPence - totalPence) / 100,
        total: totalPence / 100,
      };
    },
  };

  function paintCount() {
    const n = Cart.count();
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = n;
      el.classList.toggle('hidden', n === 0);
    });
  }

  /* ------------------------------------------------------------------- toast */

  let toastTimer;

  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* -------------------------------------------------------------------- nav */

  function initNav() {
    const header = $('#site-header');
    const toggle = $('#nav-toggle');
    const nav = $('#primary-nav');

    if (header) {
      const onScroll = () =>
        header.classList.toggle('is-scrolled', window.scrollY > 12);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      // The mobile drawer hangs off the bottom of the header.
      const setOffset = () =>
        document.documentElement.style.setProperty(
          '--header-offset',
          header.getBoundingClientRect().bottom + 'px'
        );
      setOffset();
      window.addEventListener('resize', setOffset);
      window.addEventListener('scroll', setOffset, { passive: true });
    }

    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    $$('a', nav).forEach((a) => a.addEventListener('click', close));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) close();
    });
  }

  /* ----------------------------------------------------------------- reveal */

  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;

    const showAll = () => items.forEach((el) => el.classList.add('is-visible'));

    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      showAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    items.forEach((el) => io.observe(el));

    // Failsafe: the animation is decoration, the content is not. If the
    // observer is throttled (hidden tab, odd embedder), reveal everything
    // rather than ever leaving sections invisible.
    setTimeout(() => {
      items.forEach((el) => {
        if (!el.classList.contains('is-visible')) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, 3000);
  }

  /* ---------------------------------------------------------------- cookies */

  function initCookies() {
    const banner = $('#cookie-banner');
    if (!banner) return;
    if (localStorage.getItem('tuga-cookies')) return;

    setTimeout(() => banner.classList.add('is-visible'), 900);

    const dismiss = (choice) => () => {
      localStorage.setItem('tuga-cookies', choice);
      banner.classList.remove('is-visible');
    };

    $('[data-cookie-accept]', banner)?.addEventListener('click', dismiss('accepted'));
    $('[data-cookie-decline]', banner)?.addEventListener('click', dismiss('declined'));
  }

  /* --------------------------------------------------------------- quantity */

  function initQty() {
    $$('[data-qty-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.qty')?.querySelector('input');
        if (!input) return;
        const step = Number(btn.dataset.qtyStep);
        const next = Math.max(1, Math.min(99, (parseInt(input.value, 10) || 1) + step));
        input.value = next;
      });
    });
  }

  /* ------------------------------------------------------------ add to cart */

  function initAddToCart() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-add-to-cart]');
      if (!btn) return;
      e.preventDefault();

      const id = btn.dataset.addToCart;
      let qty = 1;

      if (btn.dataset.qtySource) {
        const input = document.getElementById(btn.dataset.qtySource);
        qty = Math.max(1, parseInt(input?.value, 10) || 1);
      }

      Cart.add(id, qty);

      try {
        const products = await getCatalogue();
        const product = findItem(products, id);
        toast(`${product ? product.name : 'Item'} added to basket`);
      } catch {
        toast('Added to basket');
      }
    });
  }

  /* ---------------------------------------------------------------- gallery */

  function initGallery() {
    const main = $('#gallery-image');
    const thumbs = $$('.gallery-thumb');
    if (!main || !thumbs.length) return;

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        main.src = thumb.dataset.gallerySrc;
        thumbs.forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
      });
    });
  }

  /* ---------------------------------------------------------------- filters */

  function initFilters() {
    const buttons = $$('.filter-btn');
    const grid = $('[data-product-grid]');
    if (!buttons.length || !grid) return;

    const cards = $$('.product-card', grid);
    const empty = $('[data-empty-state]');

    const apply = (filter) => {
      let shown = 0;
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        apply(btn.dataset.filter);

        const url = new URL(window.location);
        if (btn.dataset.filter === 'all') url.searchParams.delete('os');
        else url.searchParams.set('os', btn.dataset.filter);
        history.replaceState(null, '', url);
      });
    });

    // Honour ?os=windows so the homepage can deep-link into a filtered view.
    const wanted = new URL(window.location).searchParams.get('os');
    const preset = buttons.find((b) => b.dataset.filter === wanted);
    if (preset) preset.click();
  }

  /* -------------------------------------------------------------------- FAQ */

  function initFaq() {
    $$('[data-faq]').forEach((item) => {
      const btn = $('.faq-q', item);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ------------------------------------------------------------- cart page */

  function cartItemRow(line) {
    const p = line.product;
    const image = p.imageBase
      ? `<img src="/img/products/${p.imageBase}-1.webp" alt="" width="120" height="120" loading="lazy">`
      : '<span aria-hidden="true">◧</span>';

    return `
      <div class="cart-item" data-line="${p.id}">
        <div class="cart-item-media">${image}</div>
        <div>
          <p class="cart-item-name">${p.name}</p>
          <p class="cart-item-meta">${p.tagline || p.description || ''}</p>
          <div class="cart-item-controls">
            <div class="qty">
              <button type="button" data-line-step="-1" aria-label="Decrease quantity for ${p.name}">&minus;</button>
              <input type="number" value="${line.quantity}" min="1" max="99" data-line-qty aria-label="Quantity for ${p.name}">
              <button type="button" data-line-step="1" aria-label="Increase quantity for ${p.name}">+</button>
            </div>
            <button class="cart-remove" data-line-remove aria-label="Remove ${p.name}">Remove</button>
            <span class="cart-item-price">${money(line.lineTotal)}</span>
          </div>
        </div>
      </div>`;
  }

  function cartSummary(totals) {
    const d = totals.deviceUnits;
    const nextTier =
      d === 1
        ? 'Add one more device for 3% off both'
        : d >= 2 && d < 5
          ? `Add ${5 - d} more ${5 - d === 1 ? 'device' : 'devices'} for 8% off`
          : d >= 5 && d < 10
            ? `Add ${10 - d} more ${10 - d === 1 ? 'device' : 'devices'} for 10% off`
            : null;

    return `
      <h2>Order summary</h2>
      <div class="summary-row">
        <span>Subtotal (${totals.units} ${totals.units === 1 ? 'item' : 'items'})</span>
        <span>${money(totals.subtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Delivery</span>
        <span class="summary-free">Free</span>
      </div>
      ${
        totals.discount > 0
          ? `<div class="summary-row"><span>Bulk discount on devices (${totals.tier.percent}% — ${totals.tier.label})</span><span>&minus;${money(totals.discount)}</span></div>`
          : ''
      }
      <div class="summary-row summary-row-total">
        <span>Total</span>
        <span>${money(totals.total)}</span>
      </div>
      ${nextTier ? `<p class="summary-note">${nextTier}</p>` : ''}
      <div class="checkout-actions">
        <button class="btn btn-primary btn-lg btn-block" data-checkout="stripe">Checkout securely</button>
        <button class="btn btn-outline btn-block" data-checkout="paypal">Pay with PayPal</button>
      </div>
      <p class="summary-note" data-checkout-status hidden></p>`;
  }

  async function renderCart() {
    const layout = $('[data-cart-layout]');
    const emptyEl = $('[data-cart-empty]');
    if (!layout || !emptyEl) return;

    let products;
    try {
      products = await getCatalogue();
    } catch {
      emptyEl.hidden = false;
      return;
    }

    const totals = Cart.totals(products);

    if (!totals.lines.length) {
      emptyEl.hidden = false;
      layout.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    layout.hidden = false;

    $('[data-cart-items]').innerHTML = totals.lines.map(cartItemRow).join('');
    $('[data-cart-summary]').innerHTML = cartSummary(totals);
  }

  function initCartPage() {
    const layout = $('[data-cart-layout]');
    if (!layout) return;

    renderCart();
    document.addEventListener('cart:change', renderCart);

    layout.addEventListener('click', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row) return;
      const id = row.dataset.line;

      if (e.target.closest('[data-line-remove]')) {
        Cart.remove(id);
        toast('Removed from basket');
        return;
      }

      const step = e.target.closest('[data-line-step]');
      if (step) {
        const input = $('[data-line-qty]', row);
        const next = (parseInt(input.value, 10) || 1) + Number(step.dataset.lineStep);
        if (next < 1) return;
        Cart.setQty(id, next);
      }
    });

    layout.addEventListener('change', (e) => {
      const input = e.target.closest('[data-line-qty]');
      if (!input) return;
      const row = input.closest('[data-line]');
      Cart.setQty(row.dataset.line, parseInt(input.value, 10) || 1);
    });

    layout.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-checkout]');
      if (!btn) return;
      await checkout(btn.dataset.checkout, btn);
    });
  }

  /* ---------------------------------------------------------------- checkout */

  async function checkout(provider, btn) {
    const status = $('[data-checkout-status]');
    const items = Cart.read();
    if (!items.length) return;

    const setStatus = (msg) => {
      if (!status) return;
      status.hidden = !msg;
      status.textContent = msg || '';
    };

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Redirecting…';
    setStatus('');

    const endpoint =
      provider === 'paypal'
        ? '/api/create-paypal-order'
        : '/api/create-checkout-session';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Checkout is unavailable');

      // Stripe returns {url}; the PayPal handler returns {approvalUrl}.
      const redirect = payload.url || payload.approvalUrl || payload.approveUrl;
      if (!redirect) throw new Error('No checkout URL was returned');

      window.location.href = redirect;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      setStatus(
        `${err.message}. Email ${'support@tugahardware.com'} and we will take the order manually.`
      );
    }
  }

  /* ------------------------------------------------------------------ forms */

  function initForms() {
    const contact = $('[data-contact-form]');
    if (contact) {
      contact.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = $('[data-form-status]', contact);
        const btn = $('button[type="submit"]', contact);

        if (!contact.checkValidity()) {
          contact.reportValidity();
          return;
        }

        const payload = Object.fromEntries(new FormData(contact).entries());
        btn.disabled = true;
        btn.textContent = 'Sending…';

        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error();

          contact.reset();
          status.className = 'form-status form-status-ok';
          status.hidden = false;
          status.textContent = 'Thanks — we will reply within one working day.';
        } catch {
          status.className = 'form-status form-status-err';
          status.hidden = false;
          status.innerHTML =
            'That did not send. Email <a href="mailto:support@tugahardware.com">support@tugahardware.com</a> instead and we will pick it up.';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send message';
        }
      });
    }

    $$('[data-capture-form]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const note = form.parentElement.querySelector('[data-capture-note]');
        const email = $('input[type="email"]', form);

        if (!email.checkValidity()) {
          email.reportValidity();
          return;
        }

        try {
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value }),
          });
        } catch {
          /* Non-critical — never block the user on a newsletter signup. */
        }

        form.reset();
        if (note) note.textContent = 'Sent. Check your inbox in a minute or two.';
      });
    });
  }

  /* ------------------------------------------------------- order confirmation */

  function initOrderSummary() {
    const target = $('[data-order-summary]');
    if (!target) return;
    // The basket has served its purpose once the order is placed.
    localStorage.removeItem(Cart.KEY);
    paintCount();

    // Stripe returns ?session_id=cs_..., PayPal ?provider=paypal — neither is
    // a customer-friendly reference, so just confirm which provider paid.
    const params = new URL(window.location).searchParams;
    const provider = params.get('session_id')
      ? 'card'
      : params.get('provider') === 'paypal'
        ? 'PayPal'
        : null;
    if (provider) {
      target.innerHTML = `<p class="mono">Paid by ${provider}. Your order number is in the confirmation email.</p>`;
    }
  }

  /* ------------------------------------------------------------------- init */

  function init() {
    paintCount();
    initNav();
    initReveal();
    initCookies();
    initQty();
    initAddToCart();
    initGallery();
    initFilters();
    initFaq();
    initCartPage();
    initForms();
    initOrderSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
