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
    catalogue = [...data.products, ...data.accessories, ...(data.warranties || [])];
    knownIds = new Set(catalogue.map((p) => p.id));
    return catalogue;
  }

  const findItem = (list, id) => list.find((p) => p.id === id);

  /* Which payment buttons to offer. PayPal is only shown when the Worker
     reports live credentials — otherwise clicking it would send the customer
     to a sandbox page they cannot pay on. Card is always assumed available so
     a failed probe never leaves the basket with no way to check out. */
  let paymentMethods = { card: true, paypal: false };

  async function loadPaymentMethods() {
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) paymentMethods = await res.json();
    } catch {
      /* Keep the default. */
    }
  }

  /* -------------------------------------------------------------------- cart */

  /* Product ids renamed since launch. Mirrors LEGACY_PATHS in src/worker.js:
     a basket saved before the rename still holds the old id, which the
     catalogue (and the server) no longer recognise. Scanner variants and
     plans carry the device id inside theirs, so the prefix is swapped. */
  const LEGACY_IDS = {
    'tuga-h6': 'tuga-a6',
    'tuga-t8': 'tuga-a8',
    'tuga-t10': 'tuga-a10',
  };

  const currentId = (id) => {
    for (const [from, to] of Object.entries(LEGACY_IDS)) {
      const m = id.match(new RegExp(`^(wty-[a-z0-9]+-)?${from}(-scanner)?$`));
      if (m) return `${m[1] || ''}${to}${m[2] || ''}`;
    }
    return id;
  };

  /* Ids in the live catalogue, once it has loaded. Until then read() can only
     rename legacy ids; pruneCart() drops anything still unknown. */
  let knownIds = null;

  const Cart = {
    KEY: 'tuga-cart',

    read() {
      try {
        const raw = JSON.parse(localStorage.getItem(this.KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        // Clamp quantities so corrupted storage can't produce NaN totals, and
        // merge lines that a legacy rename turns into the same id.
        const items = [];
        raw
          .filter((i) => i && typeof i.id === 'string')
          .forEach((i) => {
            const id = currentId(i.id);
            if (knownIds && !knownIds.has(id)) return;
            const quantity = Math.max(1, Math.floor(Number(i.quantity)) || 1);
            const existing = items.find((x) => x.id === id);
            if (existing) existing.quantity += quantity;
            else items.push({ id, quantity });
          });
        items.forEach((i) => (i.quantity = Math.min(99, i.quantity)));
        return items;
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
      if (deviceUnits >= 5) return { percent: 8, label: '5 to 9 units' };
      if (deviceUnits >= 3) return { percent: 5, label: '3 to 4 units' };
      if (deviceUnits >= 2) return { percent: 3, label: '2 units' };
      return { percent: 0, label: null };
    },

    totals(products) {
      const entries = [];
      let deviceUnits = 0;

      this.read().forEach((entry) => {
        const product = findItem(products, entry.id);
        if (!product) return;
        const isDevice = !/^(acc|wty)-/.test(String(product.id));
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

  /* Rewrite a stored basket that holds legacy or unknown ids, so the badge,
     the basket page and checkout all see the same lines. */
  async function pruneCart() {
    let stored;
    try {
      stored = localStorage.getItem(Cart.KEY);
    } catch {
      return;
    }
    if (!stored || stored === '[]') return;
    try {
      await getCatalogue();
    } catch {
      return;
    }
    const cleaned = Cart.read();
    if (JSON.stringify(cleaned) !== stored) Cart.write(cleaned);
  }

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

      // A product page can offer a warranty for the device being added; it is
      // one line per device unit, so it takes the same quantity. Only the main
      // Add to basket inside the buy box reads the chooser: accessory and
      // scanner-variant buttons elsewhere on the page never add a plan, and
      // the plan must cover the device actually being added.
      const box = btn.closest('[data-buy-box]');
      const chooser = box ? box.querySelector('[data-warranty-choice]:checked') : null;
      let warrantySku = chooser?.value || '';

      let products = null;
      try {
        products = await getCatalogue();
      } catch {
        /* Fall back to the id convention below. */
      }

      if (warrantySku) {
        const base = id.replace(/-scanner$/, '');
        const plan = products ? findItem(products, warrantySku) : null;
        const covers = plan ? plan.warrantyFor === base : warrantySku.endsWith(`-${base}`);
        if (/^(acc|wty)-/.test(id) || !covers) warrantySku = '';
      }

      Cart.add(id, qty);
      if (warrantySku) Cart.add(warrantySku, qty);

      const product = products ? findItem(products, id) : null;
      toast(`${product ? product.name : 'Item'}${warrantySku ? ' and warranty' : ''} added to basket`);
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
      : p.warrantyFor
        ? '<span class="cart-item-glyph" aria-hidden="true">✓</span>'
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

  /* Under a device with no (or not enough) 3-Year Warranty in the basket,
     offer it once with a single button. Scanner variants share the base
     device's warranty, so the offer sits under whichever line comes first. */
  function warrantyOffer(line, lines, products) {
    const p = line.product;
    if (/^(acc|wty)-/.test(p.id)) return '';
    const base = p.id.replace(/-scanner$/, '');
    const wty = products.find((x) => x.warrantyFor === base);
    if (!wty) return '';
    const firstForBase = lines.find((l) => l.product.id.replace(/-scanner$/, '') === base);
    if (firstForBase !== line) return '';

    const units = lines
      .filter((l) => !/^(acc|wty)-/.test(l.product.id) && l.product.id.replace(/-scanner$/, '') === base)
      .reduce((n, l) => n + l.quantity, 0);
    const covered = lines.find((l) => l.product.id === wty.id)?.quantity || 0;
    const missing = units - covered;
    if (missing <= 0) return '';

    const device = findItem(products, base)?.name || p.name;
    return `
      <div class="cart-offer">
        <div class="cart-offer-text">
          <p class="cart-offer-title">Cover ${missing === 1 ? 'it' : `all ${missing}`} for 3 years <span class="pick-tag">Recommended</span></p>
          <p class="cart-offer-meta">36 months against defects on your ${device}, including battery defects. UK carriage paid both ways on accepted claims. <a href="/warranty">How it works</a></p>
        </div>
        <button type="button" class="btn btn-outline cart-offer-btn" data-add-warranty="${wty.id}" data-qty="${missing}">
          Add for ${money(wty.price * missing)}
        </button>
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
          ? `<div class="summary-row"><span>Bulk discount on devices (${totals.tier.percent}%, ${totals.tier.label})</span><span>&minus;${money(totals.discount)}</span></div>`
          : ''
      }
      <div class="summary-row summary-row-total">
        <span>Total</span>
        <span>${money(totals.total)}</span>
      </div>
      ${nextTier ? `<p class="summary-note">${nextTier}</p>` : ''}
      ${
        document.body.hasAttribute('data-sales-paused')
          ? `<p class="summary-note" role="status">We have paused new orders while we move to UK stock. Email <a href="mailto:support@tugahardware.com">support@tugahardware.com</a> and we will tell you as soon as a device is available.</p>`
          : `<div class="checkout-actions">
        <button class="btn btn-primary btn-lg btn-block" data-checkout="stripe">Checkout securely</button>
        ${
          paymentMethods.paypal
            ? '<button class="btn btn-outline btn-block" data-checkout="paypal">Pay with PayPal</button>'
            : ''
        }
      </div>`
      }
      <p class="summary-note" data-checkout-status hidden></p>`;
  }

  async function renderCart() {
    const layout = $('[data-cart-layout]');
    const emptyEl = $('[data-cart-empty]');
    if (!layout || !emptyEl) return;

    let products;
    try {
      [products] = await Promise.all([getCatalogue(), loadPaymentMethods()]);
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

    $('[data-cart-items]').innerHTML = totals.lines
      .map((line) => cartItemRow(line) + warrantyOffer(line, totals.lines, products))
      .join('');
    $('[data-cart-summary]').innerHTML = cartSummary(totals);
  }

  function initCartPage() {
    const layout = $('[data-cart-layout]');
    if (!layout) return;

    renderCart();
    document.addEventListener('cart:change', renderCart);

    layout.addEventListener('click', (e) => {
      const offer = e.target.closest('[data-add-warranty]');
      if (offer) {
        Cart.add(offer.dataset.addWarranty, Number(offer.dataset.qty) || 1);
        toast('3-Year Warranty added');
        return;
      }

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

    // Mirror the server's warranty rule so the shopper gets a clear message
    // here instead of a failed redirect.
    try {
      const products = await getCatalogue();
      const units = {};
      items.forEach((i) => {
        if (/^(acc|wty)-/.test(i.id)) return;
        const base = i.id.replace(/-scanner$/, '');
        units[base] = (units[base] || 0) + i.quantity;
      });
      for (const i of items) {
        const p = findItem(products, i.id);
        if (!p || !p.warrantyFor) continue;
        if (i.quantity > (units[p.warrantyFor] || 0)) {
          setStatus(`${p.name} covers one device each. Reduce it to match the number of ${p.warrantyFor.replace('tuga-', 'Tuga ').toUpperCase()} units in the basket.`);
          return;
        }
      }
    } catch {
      /* The server checks again; never block checkout on a catalogue fetch. */
    }

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

  /* A mailto: link to support with the subject and body filled in, so a
     customer can send an enquiry with one tap when our own email fails. */
  const mailto = (subject, body) =>
    `mailto:support@tugahardware.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function initForms() {
    const contact = $('[data-contact-form]');
    if (contact) {
      // Product pages link here with ?quote=<product name> for business quotes.
      const params = new URLSearchParams(window.location.search);
      if (params.has('quote')) {
        const topic = $('#topic', contact);
        if (topic && topic.options.length) topic.selectedIndex = 0;
        const product = params.get('quote');
        const message = $('#message', contact);
        if (message && !message.value) {
          message.value = product
            ? `Quote request: ${product}\nQuantity: \nDelivery postcode: \n`
            : 'Quote request\nDevices and quantities: \nDelivery postcode: \n';
        }
      }
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
          const data = await res.json().catch(() => ({}));

          status.hidden = false;
          if (data.emailed === false) {
            // Stored, but the enquiry email did not go out: hand the customer
            // a ready-made email so it still reaches us today.
            const body = [payload.message || '', '', `Name: ${payload.name || ''}`]
              .concat(payload.company ? [`Company: ${payload.company}`] : [])
              .join('\n');
            status.className = 'form-status form-status-err';
            status.innerHTML =
              'Your message is saved, but our email system did not confirm it. Please also email ' +
              `<a href="${mailto(payload.topic || 'Enquiry', body)}">support@tugahardware.com</a> so it reaches us today.`;
          } else {
            contact.reset();
            status.className = 'form-status form-status-ok';
            status.textContent = 'Thanks. We will reply within one working day.';
          }
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

        // A request for personal size advice: the server emails it to
        // support and says whether that email went out.
        const btn = $('button[type="submit"]', form);
        const honeypot = $('[name="website"]', form);
        const address = email.value;
        if (btn) btn.disabled = true;

        try {
          const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: address, website: honeypot ? honeypot.value : '' }),
          });
          if (!res.ok) throw new Error();
          const data = await res.json().catch(() => ({}));

          form.reset();
          if (!note) return;
          if (data.emailed === false) {
            note.innerHTML =
              `Please email <a href="${mailto('Size advice request', `Please recommend a size for me. My email is ${address}.`)}">support@tugahardware.com</a> and we will reply today.`;
          } else {
            note.textContent = 'Thanks. We will email you a size recommendation within one working day.';
          }
        } catch {
          if (note) {
            note.innerHTML =
              'That did not send. Email <a href="mailto:support@tugahardware.com?subject=Size%20advice%20request">support@tugahardware.com</a> and we will reply today.';
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    });
  }

  /* ------------------------------------------------------- order confirmation */

  function initOrderSummary() {
    const target = $('[data-order-summary]');
    if (!target) return;

    const title = $('[data-order-title]');
    const lede = $('[data-order-lede]');
    const show = (heading, text, note) => {
      if (title) title.textContent = heading;
      if (lede) lede.textContent = text;
      target.innerHTML = note || '';
    };

    // Stripe returns ?session_id=cs_..., PayPal ?provider=paypal&token=<order id>.
    const params = new URL(window.location).searchParams;
    const sessionId = params.get('session_id');
    const paypalOrderId = params.get('provider') === 'paypal' ? params.get('token') : null;
    if (!sessionId && !paypalOrderId) {
      show(
        'No order reference',
        'We could not find an order reference on this page. If you have just paid, check your email or contact support@tugahardware.com.',
        ''
      );
      return;
    }

    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    // The server verifies the payment with the provider (and, for PayPal,
    // collects it) before we tell the customer the order is placed.
    show('Checking your order', 'Checking your payment with ' + (sessionId ? 'our card processor' : 'PayPal') + '. This takes a few seconds.', '');

    const attempt = (tries) =>
      fetch('/api/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { sessionId } : { paypalOrderId }),
      })
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (ok && data.status === 'confirmed') {
            // The basket has served its purpose once the order is placed.
            localStorage.removeItem(Cart.KEY);
            paintCount();
            const paidBy = data.provider === 'paypal' ? 'PayPal' : 'card';
            const ref = data.orderId ? String(data.orderId) : '';
            const keep = `Keep this page${ref ? `: your order reference is ${ref}` : ''}.`;

            // Only promise an email we know went out. A Stripe receipt is a
            // payment receipt, not our order confirmation.
            let text;
            if (data.emailSent === true && data.emailVia !== 'stripe-receipt') {
              text = 'A confirmation email with your order number and delivery details is on its way.';
            } else if (data.emailVia === 'stripe-receipt') {
              text = `Stripe has emailed your payment receipt. ${keep} We will email your order confirmation from support@tugahardware.com.`;
            } else {
              text = `${keep} We will email your confirmation from support@tugahardware.com within one working day.`;
            }

            // Mirrors the plan block in the confirmation email (src/email.js)
            // and clause 34 of the Plan Terms.
            const plan = data.hasPlan
              ? '<p class="order-plan-note"><strong>3-Year Warranty:</strong> if you bought as a consumer, you can cancel the plan within 45 days of purchase for a full refund if you have made no claim; business buyers have 30 days. <a href="/warranty-terms">Plan Terms</a></p>'
              : '';

            show(
              'Order confirmed',
              text,
              (ref
                ? `<p class="order-ref">Order reference <strong data-order-ref>${esc(ref)}</strong></p>`
                : '') +
                `<p class="mono">Paid by ${paidBy}. Please allow 7 to 10 working days for delivery.</p>` +
                plan
            );
          } else if (ok && data.status === 'unsupported_country') {
            show(
              'We deliver to the UK only',
              'Your PayPal delivery address is outside the UK, so we have not taken payment and nothing has been charged. If you have a UK delivery address, change it in PayPal and try again.',
              '<p class="mono"><a href="/cart">Back to basket</a></p>'
            );
          } else if (ok && data.status === 'unpaid') {
            show(
              'Payment not completed',
              'We could not see a completed payment for this order, so nothing has been charged. Your basket is still saved if you want to try again.',
              '<p class="mono"><a href="/cart">Back to basket</a></p>'
            );
          } else {
            throw new Error(data.error || 'confirm failed');
          }
        })
        .catch(() => {
          if (tries > 1) return new Promise((r) => setTimeout(r, 2000)).then(() => attempt(tries - 1));
          show(
            'We are checking your order',
            'Your payment went through to the payment provider, but we could not confirm it just now. Please do not pay again. Contact support and we will confirm your order by email.',
            '<p class="mono"><a href="/contact">Contact support</a></p>'
          );
        });

    attempt(3);
  }

  /* ------------------------------------------------------------------- init */

  function init() {
    paintCount();
    pruneCart();
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
