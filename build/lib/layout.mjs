/* ==========================================================================
   Site config, helpers and the page shell.

   Every HTML file on the site is produced by page() below, so the header,
   footer, meta tags and script tags can only ever be defined in one place.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..');

/* Content-hash the shared assets so their URLs change when they do. The
   worker serves css/js with a one-year immutable cache; without a version
   in the URL a deploy would never reach returning visitors. */
const assetHash = (rel) =>
  createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 10);

const CSS_V = assetHash('css/style.css');
const JS_V = assetHash('js/app.js');

export const SITE = {
  name: 'Tuga Hardware',
  // Canonical host. Everything else 301s here — see src/worker.js.
  origin: 'https://www.tugahardware.com',
  tagline: 'Hard Shell. Long Life.',
  email: 'support@tugahardware.com',
  description:
    'Rugged tablets and handhelds built for UK tradespeople. IP68 waterproof, MIL-STD-810H drop tested, all-day battery. Free UK delivery.',
};

export const data = JSON.parse(
  readFileSync(join(ROOT, 'data', 'products.json'), 'utf8')
);

/** Devices, excluding scanner variants, in catalogue order. */
export const devices = data.products
  .filter((p) => !p.isVariant)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

export const androidRange = devices.filter((p) => p.category === 'android');
export const windowsRange = devices.filter((p) => p.category === 'windows');
export const accessories = data.accessories;

export const variantsOf = (id) =>
  data.products.filter((p) => p.isVariant && p.variantOf === id);

export const productBySlug = (slug) => devices.find((p) => p.slug === slug);

/* --- helpers ------------------------------------------------------------ */

/** Escape a string for interpolation into HTML text or an attribute. */
export const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const money = (n) => `£${Number(n).toLocaleString('en-GB')}`;

export const imgPath = (product, n = 1) =>
  `/img/products/${product.imageBase}-${n}.webp`;

export const productUrl = (product) => `/products/${product.slug}`;

/** Turn a spec key like `ip_rating` into `IP Rating`. */
export const specLabel = (key) => {
  const overrides = {
    ip_rating: 'IP rating',
    mil_std: 'Drop standard',
    os: 'Operating system',
    cpu: 'Processor',
    ram: 'Memory',
    display_brightness: 'Brightness',
    expandable_storage: 'Expandable storage',
    operating_temp: 'Operating temperature',
  };
  if (overrides[key]) return overrides[key];
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

/** Render a list of JSON-LD objects into script tags. */
export const jsonLd = (blocks) =>
  blocks
    .filter(Boolean)
    .map(
      (b) =>
        `<script type="application/ld+json">${JSON.stringify(b, null, 2)}</script>`
    )
    .join('\n  ');

/* --- icons -------------------------------------------------------------- */

const svg = (paths, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  droplet: (s) => svg('<path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>', s),
  shield: (s) =>
    svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', s),
  shieldCheck: (s) =>
    svg(
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
      s
    ),
  battery: (s) =>
    svg(
      '<rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="10" x2="23" y2="14"/>',
      s
    ),
  sun: (s) =>
    svg(
      '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
      s
    ),
  signal: (s) =>
    svg(
      '<path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/>',
      s
    ),
  thermometer: (s) =>
    svg('<path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/>', s),
  truck: (s) =>
    svg(
      '<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      s
    ),
  refresh: (s) =>
    svg(
      '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>',
      s
    ),
  lock: (s) =>
    svg(
      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
      s
    ),
  chat: (s) =>
    svg('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>', s),
  cart: (s) =>
    svg(
      '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
      s
    ),
  check: (s) => svg('<path d="M20 6L9 17l-5-5"/>', s),
  arrowRight: (s) => svg('<path d="M5 12h14M12 5l7 7-7 7"/>', s),
  menu: (s) =>
    svg(
      '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
      s
    ),
  close: (s) =>
    svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s),
  bolt: (s) => svg('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', s),
  building: (s) =>
    svg(
      '<rect x="1" y="12" width="6" height="10"/><rect x="9" y="8" width="6" height="14"/><rect x="17" y="4" width="6" height="18"/>',
      s
    ),
  wrench: (s) =>
    svg(
      '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
      s
    ),
  factory: (s) =>
    svg(
      '<path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/><rect x="9" y="12" width="6" height="8"/>',
      s
    ),
  leaf: (s) =>
    svg(
      '<path d="M12 22c-4 0-8-2-8-6 0-2 1-4 3-5l1-1c1-2 2-5 4-8 2 3 3 6 4 8l1 1c2 1 3 3 3 5 0 4-4 6-8 6z"/>',
      s
    ),
  box: (s) =>
    svg(
      '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      s
    ),
  ruler: (s) =>
    svg(
      '<rect x="2" y="7" width="20" height="10" rx="2"/><line x1="7" y1="7" x2="7" y2="11"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="17" y1="7" x2="17" y2="11"/>',
      s
    ),
};

/* --- chrome ------------------------------------------------------------- */

const NAV_LINKS = [
  { href: '/products/', label: 'Tablets', key: 'products' },
  { href: '/accessories', label: 'Accessories', key: 'accessories' },
  { href: '/bulk', label: 'Bulk Orders', key: 'bulk' },
  { href: '/blog/', label: 'Guides', key: 'blog' },
  { href: '/about', label: 'About', key: 'about' },
  { href: '/contact', label: 'Contact', key: 'contact' },
];

const wordmark = () =>
  `<span class="wordmark-tuga">TUGA</span><span class="wordmark-hardware">Hardware</span>`;

const header = (active) => `
  <div class="announce">
    <strong>Free UK delivery</strong><span class="announce-sep">/</span>12-month warranty<span class="announce-sep">/</span>30-day returns<span class="announce-sep">/</span>Bulk discounts from 2 units
  </div>
  <header class="site-header" id="site-header">
    <div class="container header-inner">
      <a href="/" class="wordmark" aria-label="${esc(SITE.name)} home">${wordmark()}</a>
      <nav class="primary-nav" id="primary-nav" aria-label="Main">
        ${NAV_LINKS.map(
          (l) =>
            `<a href="${l.href}"${active === l.key ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`
        ).join('\n        ')}
      </nav>
      <div class="header-actions">
        <a href="/cart" class="cart-link" aria-label="Basket">
          ${icons.cart(21)}
          <span class="cart-count hidden" data-cart-count>0</span>
        </a>
        <button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="primary-nav">
          ${icons.menu(22)}
        </button>
      </div>
    </div>
  </header>`;

const footer = () => `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-about">
          <a href="/" class="wordmark" aria-label="${esc(SITE.name)} home">${wordmark()}</a>
          <p>Rugged tablets and handhelds for UK trades. We pick the kit, test it, price it honestly and ship it free. No enterprise contracts, no sales calls.</p>
        </div>
        <div class="footer-col">
          <h3>Tablets</h3>
          <nav aria-label="Products">
            ${devices.map((p) => `<a href="${productUrl(p)}">${esc(p.name)}</a>`).join('\n            ')}
            <a href="/accessories">Accessories</a>
          </nav>
        </div>
        <div class="footer-col">
          <h3>Company</h3>
          <nav aria-label="Company">
            <a href="/about">About</a>
            <a href="/blog/">Guides</a>
            <a href="/bulk">Bulk orders</a>
            <a href="/contact">Contact</a>
          </nav>
        </div>
        <div class="footer-col">
          <h3>Support</h3>
          <nav aria-label="Support">
            <a href="/shipping-returns">Shipping &amp; returns</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms &amp; conditions</a>
            <a href="mailto:${SITE.email}">${SITE.email}</a>
          </nav>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-legal">&copy; ${new Date().getFullYear()} ${esc(SITE.name)}. All rights reserved.</p>
        <div class="footer-payments" aria-label="Accepted payment methods">
          ${['Visa', 'Mastercard', 'Amex', 'PayPal']
            .map(
              (brand) =>
                `<svg width="40" height="26" viewBox="0 0 40 26" role="img" aria-label="${brand}"><rect width="40" height="26" rx="4" fill="rgba(247,244,239,0.1)" stroke="rgba(247,244,239,0.18)"/><text x="20" y="16.5" fill="#f7f4ef" font-size="7" font-family="monospace" text-anchor="middle" letter-spacing="0.5">${brand.toUpperCase()}</text></svg>`
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </footer>

  <div class="cookie-banner" id="cookie-banner" role="dialog" aria-label="Cookie notice" aria-live="polite">
    <p>We use one cookie to remember your basket, plus cookieless visit counts that cannot identify you. Nothing is sold or shared. <a href="/privacy">Privacy policy</a>.</p>
    <div class="cookie-actions">
      <button class="btn btn-sm btn-inverse" data-cookie-accept>Accept</button>
      <button class="btn btn-sm btn-outline-light" data-cookie-decline>Decline</button>
    </div>
  </div>`;

/* --- the page shell ----------------------------------------------------- */

/**
 * Build a complete HTML document.
 *
 * @param {object} opts
 * @param {string} opts.title      Full <title> text.
 * @param {string} opts.description Meta description.
 * @param {string} opts.path       Absolute site path, e.g. `/products/tuga-a8.html`.
 * @param {string} [opts.active]   Nav key to mark as current.
 * @param {string} [opts.ogType]   Open Graph type. Defaults to `website`.
 * @param {string} [opts.ogImage]  Absolute-from-root image path.
 * @param {Array}  [opts.schema]   JSON-LD objects.
 * @param {string} [opts.bodyClass]
 * @param {string} opts.body       Page markup, inside <main>.
 */
export function page({
  title,
  description,
  path,
  active,
  ogType = 'website',
  ogImage = '/img/products/t8-1.webp',
  schema = [],
  bodyClass = '',
  noindex = false,
  body,
}) {
  const canonical = `${SITE.origin}${path}`;
  const absImage = `${SITE.origin}${ogImage}`;

  return `<!DOCTYPE html>
<!-- Generated by build/build.mjs. Edit the templates there, not this file. -->
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
  <meta name="theme-color" content="#052e16">

  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${absImage}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${absImage}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css?v=${CSS_V}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">

  ${jsonLd(schema)}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <a href="#main" class="skip-link">Skip to content</a>
${header(active)}

  <main id="main">
${body}
  </main>

${footer()}

  <script src="/js/app.js?v=${JS_V}" defer></script>

  <!-- Cloudflare Web Analytics: cookieless, no fingerprinting, no personal
       data. Kept accurate in the cookie notice and privacy policy. -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "a78fa81439c044abbd4e788762a301aa"}'></script>
</body>
</html>
`;
}
