/* ============================================
   TUGA HARDWARE — Product Rendering
   Loads products.json, renders cards & pages
   ============================================ */

let productsData = [];
let accessoriesData = [];

async function loadProducts() {
  try {
    const res = await fetch('/data/products.json');
    const data = await res.json();
    productsData = data.products;
    accessoriesData = data.accessories || [];
    return productsData;
  } catch (err) {
    console.error('Failed to load products:', err);
    return [];
  }
}

/* --- Product Card HTML --- */
function renderProductCard(product) {
  const badgeHTML = product.badge
    ? `<div class="product-card-badge">${product.badge}</div>`
    : '';

  const specsHTML = [
    product.specs.ip_rating,
    product.specs.mil_std,
    product.specs.battery,
    product.specs.os
  ].filter(Boolean).map(spec => `<span class="spec-tag">${spec}</span>`).join('');

  return `
    <a href="/products/${product.slug}.html" class="product-card" data-category="${product.category}">
      ${badgeHTML}
      <div class="product-card-image">
        <img src="/img/products/${product.slug.replace('tuga-', '')}-1.webp" alt="${product.name} rugged ${product.formFactor}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="product-card-body">
        <div class="product-card-category">${product.formFactor === 'handheld' ? 'Rugged Handheld' : 'Rugged Tablet'} // ${product.specs.screen}</div>
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-tagline">${product.tagline}</div>
        <div class="product-card-specs">${specsHTML}</div>
        <div class="product-card-footer">
          <div class="product-card-price"><span class="currency">£</span>${product.price}</div>
          <span class="product-card-cta">View Details <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
        </div>
      </div>
    </a>
  `;
}

/* --- Homepage Product Showcase --- */
async function renderHomepageProducts() {
  const container = document.getElementById('products-showcase');
  if (!container) return;

  const products = await loadProducts();
  const grid = container.querySelector('.products-grid');
  if (!grid) return;

  const tabBtns = container.querySelectorAll('.tab-btn');

  function filterProducts(category) {
    const baseProducts = products.filter(p => !p.isVariant);
    const filtered = category === 'all'
      ? baseProducts
      : baseProducts.filter(p => p.category === category);
    grid.innerHTML = filtered.map(renderProductCard).join('');
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProducts(btn.dataset.category);
    });
  });

  filterProducts('all');
}

/* --- Catalogue Page --- */
async function renderCataloguePage() {
  const container = document.getElementById('catalogue-grid');
  if (!container) return;

  const products = await loadProducts();
  const filterBtns = document.querySelectorAll('.catalogue-filters .tab-btn');

  function filterProducts(category) {
    const baseProducts = products.filter(p => !p.isVariant);
    const filtered = category === 'all'
      ? baseProducts
      : baseProducts.filter(p => p.category === category);
    container.innerHTML = filtered.map(renderProductCard).join('');
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProducts(btn.dataset.category);
    });
  });

  filterProducts('all');
}

/* --- Individual Product Page --- */
async function renderProductPage() {
  const container = document.getElementById('product-detail');
  if (!container) return;

  const products = await loadProducts();
  const slug = container.dataset.slug;
  const product = products.find(p => p.slug === slug);

  if (!product) {
    container.innerHTML = '<p>Product not found.</p>';
    return;
  }

  // Update page title
  document.title = `${product.name} — ${product.tagline} | Tuga Hardware`;

  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = product.description;

  // Specs table rows
  const specsHTML = Object.entries(product.specs).map(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<tr><td>${label}</td><td>${value}</td></tr>`;
  }).join('');

  // Features list
  const featuresHTML = product.features.map(f =>
    `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>${f}</li>`
  ).join('');

  // In the box
  const inBoxHTML = product.inBox.map(item =>
    `<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>${item}</li>`
  ).join('');

  // Related products
  const related = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);
  const relatedHTML = related.map(renderProductCard).join('');

  container.innerHTML = `
    <div class="breadcrumbs">
      <a href="/">Home</a>
      <span class="separator">/</span>
      <a href="/products/">Products</a>
      <span class="separator">/</span>
      <span>${product.name}</span>
    </div>

    <div class="product-detail">
      <div class="product-gallery">
        <div class="product-gallery-main" id="main-image">
          <img src="/img/products/${product.slug.replace('tuga-', '')}-1.webp" alt="${product.name}" id="gallery-main-img">
        </div>
        <div class="product-gallery-thumbs">
          <div class="thumb active" onclick="switchImage('${product.slug.replace('tuga-', '')}', 1, this)">
            <img src="/img/products/${product.slug.replace('tuga-', '')}-1.webp" alt="${product.name} view 1">
          </div>
          <div class="thumb" onclick="switchImage('${product.slug.replace('tuga-', '')}', 2, this)">
            <img src="/img/products/${product.slug.replace('tuga-', '')}-2.webp" alt="${product.name} view 2">
          </div>
          <div class="thumb" onclick="switchImage('${product.slug.replace('tuga-', '')}', 3, this)">
            <img src="/img/products/${product.slug.replace('tuga-', '')}-3.webp" alt="${product.name} view 3">
          </div>
        </div>
      </div>

      <div class="product-info">
        <h1>${product.name}</h1>
        <p class="tagline">${product.tagline}</p>
        ${reviewsData[product.id] ? `
        <a href="#reviews" class="product-card-rating" style="margin-bottom: 0.5rem; text-decoration: none;">
          <span class="stars">${renderStars(reviewsData[product.id].average, 16)}</span>
          <span class="rating-text">${reviewsData[product.id].average} out of 5 (${reviewsData[product.id].count} reviews)</span>
        </a>
        ` : ''}

        <div class="product-price-block">
          <span class="product-price">£${product.price}</span>
          ${product.compareAtPrice ? `<span class="product-compare-price">£${product.compareAtPrice}</span>` : ''}
        </div>

        <p class="product-description">${product.longDescription || product.description}</p>

        <div class="product-add-to-cart">
          <div class="quantity-selector">
            <button onclick="adjustProductQty(-1)" aria-label="Decrease">−</button>
            <input type="number" id="product-qty" value="1" min="1" max="99" aria-label="Quantity">
            <button onclick="adjustProductQty(1)" aria-label="Increase">+</button>
          </div>
          <button class="btn btn-primary btn-lg product-add-btn" onclick="addProductToCart('${product.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            Add to Cart
          </button>
        </div>

        <div class="product-trust-signals">
          <div class="product-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            12 Month Warranty
          </div>
          <div class="product-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            Free UK Delivery
          </div>
          <div class="product-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            30-Day Returns
          </div>
          <div class="product-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Secure Checkout
          </div>
        </div>

        <div class="bulk-banner">
          <p>Buying for a team? 5+ units get 8% off automatically.</p>
          <a href="/bulk.html" class="btn btn-sm btn-outline">Learn More</a>
        </div>

        <div class="product-specs">
          <h2>Specifications</h2>
          <table class="specs-table">
            ${specsHTML}
          </table>
        </div>

        <div class="product-features">
          <h2>Features</h2>
          <ul class="features-list">${featuresHTML}</ul>
        </div>

        <div class="product-inbox">
          <h3>What's in the Box</h3>
          <ul>${inBoxHTML}</ul>
        </div>
      </div>
    </div>

    ${renderVariantOption(product)}

    ${renderAccessoryRecommendations(product.id)}

    ${reviewsData[product.id] ? renderReviewsSection(product.id) : ''}

    ${related.length > 0 ? `
    <section class="products-section" style="padding-top: 4rem;">
      <p class="section-tag">// You Might Also Like</p>
      <h2 class="section-title">Related Products</h2>
      <div class="products-grid">${relatedHTML}</div>
    </section>
    ` : ''}
  `;

  // Inject Product Review schema
  if (reviewsData[product.id]) {
    injectReviewSchema(product, reviewsData[product.id]);
  }
}

/* --- Gallery Image Switching --- */
function switchImage(slug, num, thumbEl) {
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg) {
    mainImg.src = `/img/products/${slug}-${num}.webp`;
  }
  document.querySelectorAll('.product-gallery-thumbs .thumb').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

/* --- Product Page Helpers --- */
function adjustProductQty(delta) {
  const input = document.getElementById('product-qty');
  if (!input) return;
  const newVal = Math.max(1, parseInt(input.value, 10) + delta);
  input.value = newVal;
}

function addProductToCart(productId) {
  const qtyInput = document.getElementById('product-qty');
  const qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
  TugaCart.addItem(productId, qty);
  showToast(`Added to cart`);
}

function addAccessoryToCart(accessoryId) {
  TugaCart.addItem(accessoryId, 1);
  showToast('Added to cart');
}

/* --- Accessory Card HTML --- */
function renderAccessoryCard(acc) {
  const compatible = acc.compatibleWith.map(id => {
    const p = productsData.find(pr => pr.id === id);
    return p ? p.name : '';
  }).filter(Boolean).join(', ');

  return `
    <div class="accessory-card">
      <div class="accessory-card-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      </div>
      <div class="accessory-card-body">
        <h3 class="accessory-card-name">${acc.name}</h3>
        <p class="accessory-card-desc">${acc.description}</p>
        <p class="accessory-card-compat">Works with: ${compatible}</p>
        <div class="accessory-card-footer">
          <span class="accessory-card-price">£${acc.price}</span>
          <button class="btn btn-sm btn-primary" onclick="addAccessoryToCart('${acc.id}')">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
}

/* --- Accessories Page --- */
async function renderAccessoriesPage() {
  const grid = document.getElementById('accessories-grid');
  if (!grid) return;
  await loadProducts();
  grid.innerHTML = accessoriesData.map(renderAccessoryCard).join('');
}

/* --- You Might Also Need (Product Page) --- */
function renderAccessoryRecommendations(productId) {
  const compatible = accessoriesData.filter(acc => acc.compatibleWith.includes(productId));
  if (compatible.length === 0) return '';

  const cardsHTML = compatible.slice(0, 4).map(renderAccessoryCard).join('');
  return `
    <section class="accessories-section" style="padding-top: 3rem;">
      <p class="section-tag">// You Might Also Need</p>
      <h2 class="section-title" style="font-size: 1.5rem;">Accessories</h2>
      <div class="accessories-grid">${cardsHTML}</div>
    </section>
  `;
}

/* --- Scanner Variant Section (Product Page) --- */
function renderVariantOption(product) {
  const variants = productsData.filter(p => p.isVariant && p.variantOf === product.id);
  if (variants.length === 0) return '';

  return variants.map(v => `
    <div class="variant-option">
      <div class="variant-info">
        <h4>${v.name}</h4>
        <p>${v.description}</p>
      </div>
      <div class="variant-action">
        <span class="variant-price">£${v.price}</span>
        <button class="btn btn-sm btn-copper" onclick="addAccessoryToCart('${v.id}')">Add to Cart</button>
      </div>
    </div>
  `).join('');
}

/* --- Init --- */
document.addEventListener('DOMContentLoaded', async () => {
  // Load reviews first so they're available for rendering
  if (typeof loadReviews === 'function') {
    await loadReviews();
  }
  renderHomepageProducts();
  renderCataloguePage();
  renderProductPage();
  renderAccessoriesPage();
});
