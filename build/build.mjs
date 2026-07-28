/* ==========================================================================
   Static site generator for tugahardware.com

   Run:  node build/build.mjs      (or `npm run build`)

   Every .html file in the repo is written by this script. Edit the templates
   here, not the generated output — the next build will overwrite it.

   Why generate rather than render client-side: product pages used to be empty
   shells filled in by JavaScript, which meant Google indexed a blank page for
   every product. Everything below ships as real HTML.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  SITE,
  ROOT,
  devices,
  androidRange,
  windowsRange,
  accessories,
  variantsOf,
  esc,
  money,
  icons,
  imgPath,
  productUrl,
  page,
} from './lib/layout.mjs';

import {
  eyebrow,
  sectionHead,
  breadcrumbs,
  productCard,
  productGrid,
  sizeLadder,
  compareTable,
  specSheet,
  trustStrip,
  faq,
  capture,
  ctaBanner,
  accessoryCard,
} from './lib/blocks.mjs';

const written = [];

function write(relPath, contents) {
  const full = join(ROOT, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents, 'utf8');
  written.push(relPath);
}

/* ==========================================================================
   ORGANISATION SCHEMA — attached to every page via the home page + PDPs
   ========================================================================== */

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.origin}/#organization`,
  name: SITE.name,
  url: SITE.origin,
  email: SITE.email,
  description: SITE.description,
  areaServed: { '@type': 'Country', name: 'United Kingdom' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: SITE.email,
    areaServed: 'GB',
    availableLanguage: 'English',
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE.origin}/#website`,
  url: SITE.origin,
  name: SITE.name,
  publisher: { '@id': `${SITE.origin}/#organization` },
};

const breadcrumbSchema = (trail) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.label,
    ...(c.href ? { item: `${SITE.origin}${c.href}` } : {}),
  })),
});

/* ==========================================================================
   HOME
   ========================================================================== */

const HOME_FAQ = [
  {
    q: 'Which size should I get: 6, 8 or 10 inch?',
    a: 'Six inch goes in a pocket and is right if you mostly take photos, log jobs and stay in touch. Eight inch is what most tradespeople settle on: big enough to fill in a form or follow a drawing, small enough for one hand and a van door pocket. Ten inch is for people who genuinely read drawings all day: blueprints, BIM viewers, full spreadsheets. If you are unsure, the 8 inch is the safe choice.',
  },
  {
    q: 'What is the difference between IP67, IP68 and IP69K?',
    a: 'All three mean fully dust tight. The second digit is water: IP67 survives 1 metre of immersion for 30 minutes, IP68 goes deeper and longer, and IP69K adds resistance to high pressure, high temperature jets, which matters if your kit gets jet washed rather than just rained on. For most UK trades IP67 is genuinely enough; IP68 and IP69K are the margin you want if the device lives outdoors.',
  },
  {
    q: 'Do these actually survive being dropped?',
    a: 'They are tested to MIL-STD-810H or 810G, which includes repeated 1.2 to 1.5 metre drops onto plywood over concrete. That is a real standard rather than marketing language. It does not make a device indestructible. It means the housing, corners and screen are engineered for the kind of drop that kills a consumer tablet.',
  },
  {
    q: 'Android or Windows?',
    a: 'Android if you are using apps: job management, forms, photos, maps, cloud tools. That covers most trades and it is cheaper. Windows only if you need actual desktop software that has no mobile version: diagnostic tools, legacy databases, GIS, CAD viewers or network drives. Windows devices cost roughly twice as much, so do not buy one unless a specific piece of software forces your hand.',
  },
  {
    q: 'How long does delivery take and what does it cost?',
    a: 'Delivery is free across mainland UK on every order, with no minimum. Orders placed before 2pm on a working day are dispatched the same day and typically arrive within two to three working days.',
  },
  {
    q: 'What if it is not right for me?',
    a: 'You have 30 days to send it back for a full refund, for any reason, including simply picking the wrong size. Every device also carries a 12-month warranty against defects.',
  },
  {
    q: 'Do you do discounts for teams?',
    a: 'Yes, and they apply automatically at checkout with no codes or phone calls: 3% off at 2 devices, 5% at 3 to 4, 8% at 5 to 9 and 10% at 10 or more. You can mix and match any models. The tier is based on the total number of devices in the basket.',
  },
];

const homeFaq = faq(HOME_FAQ, { heading: 'Questions worth asking before you buy' });

const TRADES = [
  {
    icon: icons.bolt(24),
    name: 'Electricians',
    copy: 'EICR and certification apps, compliance photos, job sign-off. Sealed against the dust in a consumer unit and the damp in a meter cupboard.',
    pick: 'tuga-a8',
  },
  {
    icon: icons.building(24),
    name: 'Construction',
    copy: 'Site plans, snag lists and daily reports. A big screen you can read a drawing on, in a body that survives a fall off the scaffold boards.',
    pick: 'tuga-a10',
  },
  {
    icon: icons.wrench(24),
    name: 'Field service',
    copy: 'Job sheets, customer signature, photo evidence, parts lookup. One device that does the whole visit without going back to the van.',
    pick: 'tuga-a8',
  },
  {
    icon: icons.truck(24),
    name: 'Logistics & delivery',
    copy: 'Proof of delivery, route tracking and barcode scanning from the cab. Vehicle mountable and charging while you drive.',
    pick: 'tuga-a6',
  },
  {
    icon: icons.factory(24),
    name: 'Engineering & utilities',
    copy: 'Diagnostic software, GIS and network tools that never made it to mobile. Ethernet on board for plugging straight into plant.',
    pick: 'tuga-w10',
  },
  {
    icon: icons.leaf(24),
    name: 'Agriculture & grounds',
    copy: 'Crop records, livestock tracking and field mapping. Rated for mud, frost and the pressure washer afterwards.',
    pick: 'tuga-a10',
  },
];

function tradeCard(t) {
  const device = devices.find((d) => d.id === t.pick);
  return `
          <a class="trade-card reveal" href="${productUrl(device)}">
            <div class="feature-icon">${t.icon}</div>
            <h3>${esc(t.name)}</h3>
            <p>${esc(t.copy)}</p>
            <span class="trade-pick">We'd pick the <strong>${esc(device.name)}</strong></span>
          </a>`;
}

const hero = () => {
  const lead = devices.find((d) => d.id === 'tuga-a8');
  return `
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-content">
          ${eyebrow('Rugged Android & Windows tablets')}
          <h1 class="hero-title">Hard Shell.<br><span class="accent">Long Life.</span></h1>
          <p class="hero-sub">Waterproof, drop-tested tablets and handhelds for UK trades. Built for rain, dust, concrete and a twelve-hour shift, not for a desk.</p>
          <div class="hero-ctas">
            <a class="btn btn-inverse btn-lg" href="/products/">Browse the range</a>
            <a class="btn btn-outline-light btn-lg" href="#pick-a-size">Help me pick a size</a>
          </div>
          <div class="hero-specs">
            <div class="hero-spec">
              <span class="hero-spec-value">IP68</span>
              <span class="hero-spec-label">Sealed</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">810H</span>
              <span class="hero-spec-label">Drop tested</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">10,600<span style="font-size:0.5em">mAh</span></span>
              <span class="hero-spec-label">Max battery</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">${money(Math.min(...devices.map((d) => d.price)))}</span>
              <span class="hero-spec-label">From</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-image-frame">
            <img src="${imgPath(lead, 1)}" alt="Tuga A8 rugged Android tablet" width="600" height="750" fetchpriority="high">
          </div>
          <span class="hero-annotation hero-annotation-1">Sunlight readable</span>
          <span class="hero-annotation hero-annotation-2">Glove mode</span>
          <span class="hero-annotation hero-annotation-3">Full-shift battery</span>
        </div>
      </div>
    </section>`;
};

const homeBody = `
${hero()}

${trustStrip()}

    <section class="section" id="pick-a-size">
      <div class="container">
${sectionHead({
  tag: 'Start here',
  title: 'Pick the size, not the spec sheet',
  lede: 'Three Android devices, drawn to scale. Nearly everyone chooses on size, so start there and let the specifications follow. Windows versions of each size are available if your software demands it.',
})}
${sizeLadder(androidRange)}
        <p class="lede" style="margin-top:2.5rem">
          Need full Windows instead? <a class="link-arrow" href="/products/?os=windows">See the Windows range</a>
        </p>
      </div>
    </section>

    <section class="section section-deep">
      <div class="container">
${sectionHead({
  tag: 'Every model',
  title: 'The whole range on one page',
  lede: 'Six devices, three sizes, two operating systems. No configurator, no quote request. The price you see is the price you pay.',
})}
${compareTable()}
        <div style="margin-top:2rem">
          <a class="btn btn-primary" href="/products/">Browse all devices</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
${sectionHead({
  tag: 'Why rugged',
  title: 'What you are actually paying for',
  lede: 'Rugged is a word that gets used loosely. Here is what it means on our devices, in terms you can check.',
  wide: true,
})}

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="/img/blog/blog-waterproof.webp" alt="Rugged tablet being used in wet conditions" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Sealed, not splash resistant</h3>
            <p>An IP68 rating means the housing is fully dust tight and survives sustained immersion, not that it tolerates a light shower. The devices with IP69K on top are rated for high pressure, high temperature jets, which is the difference between a tablet that survives rain and one that survives being hosed down at the end of the day.</p>
            <ul class="editorial-list">
              <li>Gasket-sealed ports and a sealed speaker membrane</li>
              <li>Touchscreen calibrated to work with wet fingers and gloves</li>
              <li>Rated from &minus;20&deg;C to 60&deg;C, so it starts on a frosty morning</li>
            </ul>
          </div>
        </article>

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="/img/blog/blog-construction.webp" alt="Rugged tablet in use on a construction site" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Drop tested to a real standard</h3>
            <p>MIL-STD-810H is a published military test method, not a marketing phrase. The drop procedure means repeated falls from 1.2 to 1.5 metres onto plywood over concrete, across every face and corner, with the device still functioning afterwards.</p>
            <p>In practice that comes from reinforced corners, a rubberised over-mould and a screen recessed behind a raised bezel, so the glass does not take the first hit when it lands face down.</p>
          </div>
        </article>

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="/img/blog/blog-field-engineer.webp" alt="Field engineer using a rugged tablet outdoors" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Screens you can read outside, batteries that last the shift</h3>
            <p>A standard tablet runs about 400 nits, which washes out the moment you step outdoors. Ours run 500 to 800 nits with an anti-reflective treatment, so you are not cupping a hand over the screen to read a job number.</p>
            <p>Batteries are 10,000mAh and up on the Android range, comfortably a full shift with heavy use, and usually two days of normal use. There is nothing clever about it; there is simply room inside a rugged body for a much larger cell.</p>
          </div>
        </article>
      </div>
    </section>

    <section class="section section-deep">
      <div class="container">
${sectionHead({
  tag: 'Find your fit',
  title: 'Built for your trade',
  lede: 'Different trades break devices in different ways. Here is where we would start for each.',
})}
        <div class="card-grid">
          ${TRADES.map(tradeCard).join('\n')}
        </div>
      </div>
    </section>

    <section class="section section-dark">
      <div class="container">
${sectionHead({
  tag: 'How we work',
  title: 'A small UK operation, and honest about it',
  lede: 'We are not going to pretend to be a household name. Here is exactly what you get from buying here instead of from a marketplace listing.',
  wide: true,
})}
        <div class="promise-grid">
          <div class="promise reveal">
            <h3>Specs you can verify</h3>
            <p>Every claim on this site is a published rating you can check: IP number, MIL-STD method, battery capacity in mAh, brightness in nits. No invented durability scores.</p>
          </div>
          <div class="promise reveal">
            <h3>One price, shown up front</h3>
            <p>No quote forms, no minimum order, no enterprise licensing. Free UK delivery on everything, and team discounts applied automatically at checkout.</p>
          </div>
          <div class="promise reveal">
            <h3>30 days to change your mind</h3>
            <p>Including if you simply picked the wrong size. Send it back for a full refund. Every device carries a 12-month warranty against defects.</p>
          </div>
          <div class="promise reveal">
            <h3>You reach a person</h3>
            <p>Support is a UK email address answered by someone who has handled the devices. Ask us which size suits your work before you spend anything.</p>
          </div>
        </div>
      </div>
    </section>

${capture()}

${homeFaq.html}

${ctaBanner()}
`;

write(
  'index.html',
  page({
    title: 'Tuga Hardware | Rugged Tablets for UK Tradespeople',
    description:
      'Rugged Android and Windows tablets built for UK tradespeople. IP68 waterproof, MIL-STD-810H drop tested, all-day battery. From £299 with free UK delivery.',
    path: '/',
    active: null,
    ogImage: imgPath(devices.find((d) => d.id === 'tuga-a8'), 1),
    schema: [orgSchema, websiteSchema, homeFaq.schema],
    body: homeBody,
  })
);

/* ==========================================================================
   PRODUCTS INDEX
   ========================================================================== */

const productsTrail = [{ label: 'Home', href: '/' }, { label: 'Tablets' }];

write(
  'products/index.html',
  page({
    title: 'All Rugged Tablets & Handhelds | Tuga Hardware',
    description:
      'The full Tuga range: 6, 8 and 10 inch rugged tablets and handhelds in Android and Windows. IP68 rated, drop tested, free UK delivery and 30-day returns.',
    path: '/products/',
    active: 'products',
    schema: [
      breadcrumbSchema(productsTrail),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Tuga Hardware rugged devices',
        itemListElement: devices.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE.origin}${productUrl(p)}`,
          name: p.name,
        })),
      },
    ],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(productsTrail)}
        ${eyebrow('The range')}
        <h1>Rugged tablets &amp; handhelds</h1>
        <p class="lede">Six devices across three sizes. Android for app-based work, Windows where desktop software forces it. Every one is sealed, drop tested and shipped free.</p>
      </div>
    </section>

${trustStrip()}

    <section class="section">
      <div class="container">
        <div class="filters" role="group" aria-label="Filter by operating system">
          <button class="filter-btn is-active" data-filter="all">All devices</button>
          <button class="filter-btn" data-filter="android">Android</button>
          <button class="filter-btn" data-filter="windows">Windows</button>
        </div>
${productGrid(devices)}
        <p class="lede" data-empty-state hidden>No devices match that filter.</p>
      </div>
    </section>

    <section class="section section-deep">
      <div class="container">
${sectionHead({
  tag: 'Side by side',
  title: 'Compare every model',
  lede: 'The specifications that actually differ between devices, in one table.',
})}
${compareTable()}
      </div>
    </section>

${capture()}

${ctaBanner({
  title: 'Not sure which one?',
  text: 'Tell us what you do and how you work, and we will tell you which size to buy, including if the answer is the cheapest one.',
  primary: { href: '/contact', label: 'Ask us' },
  secondary: { href: '/blog/', label: 'Read the guides' },
})}
`,
  })
);

/* ==========================================================================
   PRODUCT DETAIL PAGES
   ========================================================================== */

function productPage(p) {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Tablets', href: '/products/' },
    { label: p.name },
  ];

  const variants = variantsOf(p.id);
  const related = devices.filter((d) => d.id !== p.id).slice(0, 3);
  const compatible = accessories.filter((a) => a.compatibleWith.includes(p.id));

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    sku: p.id.toUpperCase(),
    image: p.images.map((_, i) => `${SITE.origin}${imgPath(p, i + 1)}`),
    brand: { '@type': 'Brand', name: SITE.name },
    category: p.category === 'android' ? 'Rugged Android Tablet' : 'Rugged Windows Tablet',
    offers: {
      '@type': 'Offer',
      url: `${SITE.origin}${productUrl(p)}`,
      price: p.price,
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${SITE.origin}/#organization` },
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'GBP' },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'GB',
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'GB',
        returnPolicyCategory:
          'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    additionalProperty: Object.entries(p.specs).map(([k, v]) => ({
      '@type': 'PropertyValue',
      name: k.replace(/_/g, ' '),
      value: v,
    })),
  };

  const body = `
    <div class="container">
${breadcrumbs(trail)}
    </div>

    <div class="container">
      <div class="pdp">
        <div class="pdp-gallery">
          <div class="gallery-main">
            <img id="gallery-image" src="${imgPath(p, 1)}" alt="${esc(p.name)} rugged ${p.formFactor}" width="800" height="800" fetchpriority="high">
          </div>
          <div class="gallery-thumbs" role="group" aria-label="Product images">
            ${p.images
              .map(
                (_, i) => `
            <button type="button" class="gallery-thumb${i === 0 ? ' is-active' : ''}" data-gallery-src="${imgPath(p, i + 1)}" aria-label="View image ${i + 1}">
              <img src="${imgPath(p, i + 1)}" alt="" width="150" height="150" loading="lazy">
            </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="buy-panel">
          <p class="pdp-kicker">${p.formFactor === 'handheld' ? 'Rugged handheld' : 'Rugged tablet'} / ${esc(p.sizeLabel)}&Prime; / ${esc(p.specs.os)}</p>
          <h1 class="pdp-title">${esc(p.name)}</h1>
          <p class="pdp-tagline">${esc(p.tagline)}</p>

          <div class="pdp-price-row">
            <span class="pdp-price">${money(p.price)}</span>
            ${p.compareAtPrice ? `<span class="pdp-price-was">${money(p.compareAtPrice)}</span>` : ''}
            <span class="pdp-price-note">Includes VAT. Free UK delivery</span>
          </div>

          <p class="pdp-desc">${esc(p.longDescription)}</p>

          <div class="buy-row">
            <div class="qty">
              <button type="button" data-qty-step="-1" aria-label="Decrease quantity">&minus;</button>
              <input type="number" id="qty" value="1" min="1" max="99" aria-label="Quantity">
              <button type="button" data-qty-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn-primary btn-lg" data-add-to-cart="${p.id}" data-qty-source="qty">
              ${icons.cart(18)} Add to basket
            </button>
          </div>

          <div class="pdp-assurance">
            <div>${icons.truck(16)}<span>Free UK delivery</span></div>
            <div>${icons.shieldCheck(16)}<span>12-month warranty</span></div>
            <div>${icons.refresh(16)}<span>30-day returns</span></div>
            <div>${icons.lock(16)}<span>Secure checkout</span></div>
          </div>

          <div class="bulk-nudge">
            <span>Buying for a team? 2+ units discount automatically.</span>
            <a class="btn btn-sm btn-outline" href="/bulk">See tiers</a>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <section class="pdp-section">
        <div class="pdp-columns">
          <div>
            ${eyebrow('Why this one')}
            <h2 class="title-sm">What it is good at</h2>
            <ul class="check-list" style="margin-top:1.5rem">
              ${p.highlights.map((h) => `<li>${icons.check(16)}<span>${esc(h)}</span></li>`).join('\n              ')}
            </ul>
          </div>
          <div>
            ${eyebrow('In the box')}
            <h2 class="title-sm">What arrives</h2>
            <ul class="check-list" style="margin-top:1.5rem">
              ${p.inBox.map((h) => `<li>${icons.check(16)}<span>${esc(h)}</span></li>`).join('\n              ')}
            </ul>
          </div>
        </div>
      </section>

      <section class="pdp-section">
        ${eyebrow('The detail')}
        <h2 class="title-sm" style="margin-bottom:2rem">Specification</h2>
${specSheet(p)}
        <div style="margin-top:2rem">
          <h3 class="title-xs" style="margin-bottom:1rem">Features</h3>
          <div class="spec-chips">
            ${p.features.map((f) => `<span class="chip">${esc(f)}</span>`).join('\n            ')}
          </div>
        </div>
      </section>

      ${
        variants.length
          ? `
      <section class="pdp-section">
        ${eyebrow('Variants')}
        <h2 class="title-sm" style="margin-bottom:2rem">Also available with a scanner</h2>
        ${variants
          .map(
            (v) => `
        <div class="variant-row reveal">
          <div>
            <h3>${esc(v.name)}</h3>
            <p>${esc(v.description)}</p>
          </div>
          <div class="variant-action">
            <span class="variant-price">${money(v.price)}</span>
            <button class="btn btn-sm btn-copper" data-add-to-cart="${v.id}">Add to basket</button>
          </div>
        </div>`
          )
          .join('\n')}
      </section>`
          : ''
      }

      ${
        compatible.length
          ? `
      <section class="pdp-section">
        ${eyebrow('Goes with it')}
        <h2 class="title-sm" style="margin-bottom:2rem">Accessories that fit</h2>
        <div class="card-grid">
          ${compatible.slice(0, 4).map(accessoryCard).join('\n')}
        </div>
      </section>`
          : ''
      }

      <section class="pdp-section">
        ${eyebrow('Compare')}
        <h2 class="title-sm" style="margin-bottom:2rem">How it sits in the range</h2>
${compareTable()}
      </section>

      <section class="pdp-section">
        ${eyebrow('You might also consider')}
        <h2 class="title-sm" style="margin-bottom:2rem">Other devices</h2>
${productGrid(related)}
      </section>
    </div>

${ctaBanner({
  title: 'Still deciding?',
  text: 'Email us what you do and we will tell you which of the three sizes fits your day, even if that means pointing you at a cheaper one.',
  primary: { href: '/contact', label: 'Ask a question' },
  secondary: { href: '/products/', label: 'See all devices' },
})}
`;

  return page({
    title: `${p.name}: ${p.sizeLabel} inch Rugged ${p.category === 'android' ? 'Android' : 'Windows'} ${p.formFactor === 'handheld' ? 'Handheld' : 'Tablet'} | Tuga Hardware`,
    description: p.description,
    path: productUrl(p),
    active: 'products',
    ogType: 'product',
    ogImage: imgPath(p, 1),
    schema: [orgSchema, productSchema, breadcrumbSchema(trail)],
    body,
  });
}

devices.forEach((p) => write(`products/${p.slug}.html`, productPage(p)));

/* ==========================================================================
   ACCESSORIES
   ========================================================================== */

const accTrail = [{ label: 'Home', href: '/' }, { label: 'Accessories' }];

write(
  'accessories.html',
  page({
    title: 'Accessories for Rugged Tablets | Tuga Hardware',
    description:
      'Docks, mounts, straps, cases and cables for Tuga rugged tablets and handhelds. Free UK delivery on every order.',
    path: '/accessories',
    active: 'accessories',
    schema: [breadcrumbSchema(accTrail)],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(accTrail)}
        ${eyebrow('Accessories')}
        <h1>The bits that make it work on site</h1>
        <p class="lede">Mounts, docks, straps and cables that fit the devices we sell. Nothing here is a generic listing. Each one is matched to specific models.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="card-grid">
          ${accessories.map(accessoryCard).join('\n')}
        </div>
      </div>
    </section>

${ctaBanner({
  title: 'Need something that is not listed?',
  text: 'If you need a specific mount, dock or cable for a fleet rollout, tell us the requirement and we will source it.',
  primary: { href: '/contact', label: 'Get in touch' },
  secondary: { href: '/products/', label: 'Browse devices' },
})}
`,
  })
);

/* ==========================================================================
   BULK
   ========================================================================== */

const bulkTrail = [{ label: 'Home', href: '/' }, { label: 'Bulk orders' }];

const BULK_FAQ = [
  {
    q: 'Do I need to contact you to get the discount?',
    a: 'No. Add the units to your basket and the discount is applied at checkout automatically. There are no codes and no sales call.',
  },
  {
    q: 'Can I mix different models in one order?',
    a: 'Yes. The tier is based on the total number of devices in the basket, not per model. Three A8s and two A6s is five devices, which is the 8% tier. Accessories do not count toward the tier, but you can add them to the same order.',
  },
  {
    q: 'Can you invoice us instead of taking card payment?',
    a: 'For orders of ten units or more we can raise a proforma invoice for bank transfer. Email us with what you need and a company address and we will send one over.',
  },
  {
    q: 'Do bulk orders still get the warranty and returns?',
    a: 'Yes. The same 12-month warranty and 30-day returns apply to every unit regardless of order size.',
  },
];

const bulkFaq = faq(BULK_FAQ, { heading: 'Bulk order questions', tag: 'FAQ' });

write(
  'bulk.html',
  page({
    title: 'Bulk Orders & Team Discounts | Tuga Hardware',
    description:
      'Automatic team discounts on rugged tablets: 3% at 2 units, 5% at 3-4, 8% at 5-9 and 10% at 10+. No codes, no quote forms, free UK delivery.',
    path: '/bulk',
    active: 'bulk',
    schema: [breadcrumbSchema(bulkTrail), bulkFaq.schema],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(bulkTrail)}
        ${eyebrow('Bulk orders')}
        <h1>Kitting out a team, without the procurement theatre</h1>
        <p class="lede">Discounts apply automatically at checkout. No codes, no minimum order, no phone call with a salesperson who wants to understand your journey.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="stat-grid">
          <div class="stat reveal"><span class="stat-value">3%</span><span class="stat-label">2 units</span></div>
          <div class="stat reveal"><span class="stat-value">5%</span><span class="stat-label">3 to 4 units</span></div>
          <div class="stat reveal"><span class="stat-value">8%</span><span class="stat-label">5 to 9 units</span></div>
          <div class="stat reveal"><span class="stat-value">10%</span><span class="stat-label">10+ units</span></div>
        </div>
      </div>
    </section>

    <section class="section section-deep">
      <div class="container">
        <div class="editorial">
          <div class="editorial-media editorial-media-contain">
            <img src="${imgPath(devices.find((d) => d.id === 'tuga-a10'), 1)}" alt="Tuga A10 rugged tablet" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            ${eyebrow('How it works')}
            <h3>Three steps, no forms</h3>
            <ul class="editorial-list">
              <li>Add the devices your team needs to the basket, mixing and matching any models</li>
              <li>The tier is calculated on the total number of devices and applied at checkout</li>
              <li>Everything ships free, with the same warranty and returns as a single unit</li>
            </ul>
            <p style="margin-top:1.5rem">Ordering ten or more? You get 10% automatically, and we can raise a proforma invoice for bank transfer if your accounts department prefers it.</p>
            <div style="margin-top:2rem">
              <a class="btn btn-primary" href="/products/">Start an order</a>
              <a class="btn btn-outline" href="/contact" style="margin-left:0.5rem">Request an invoice</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
${sectionHead({
  tag: 'The range',
  title: 'What to put in the basket',
  lede: 'For most teams the 8 inch Android is the right default, with a couple of 10 inch units for whoever handles the drawings.',
})}
${compareTable()}
      </div>
    </section>

${bulkFaq.html}

${ctaBanner({
  title: 'Fleet order or framework agreement?',
  text: 'If you are buying for more than fifty devices, or need staged delivery, asset tagging or a specific configuration, email us and we will work it out properly.',
  primary: { href: '/contact', label: 'Talk to us' },
  secondary: null,
})}
`,
  })
);

/* ==========================================================================
   ABOUT
   ========================================================================== */

const aboutTrail = [{ label: 'Home', href: '/' }, { label: 'About' }];

write(
  'about.html',
  page({
    title: 'About Tuga Hardware | Rugged Tablets for UK Trades',
    description:
      'Why Tuga Hardware exists: professional-grade rugged tablets sold direct at honest prices, without enterprise contracts or consumer-grade compromises.',
    path: '/about',
    active: 'about',
    schema: [breadcrumbSchema(aboutTrail), orgSchema],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(aboutTrail)}
        ${eyebrow('About')}
        <h1>The gap between a £1,800 Toughbook and a cracked iPad</h1>
        <p class="lede">That gap is where we sit, and it is why the company exists.</p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          <p>If you work on site, you have two obvious options and neither is good. You can buy an enterprise rugged tablet from a traditional supplier, sign a support contract, wait for a quote, and pay somewhere between £1,500 and £3,000 for hardware whose specification does not remotely justify the price. Or you can buy a consumer tablet, put a thick case on it, and replace it every few months when the screen goes or the charging port fills with dust.</p>

          <p>The first option is priced for fleet buyers with procurement departments. The second is not built for the work. Most UK tradespeople are neither, so they end up paying too much or buying twice.</p>

          <h2>What we actually do</h2>

          <p>We select rugged devices that hit a genuine standard (a published IP rating, a real MIL-STD drop test method, a battery measured in mAh rather than adjectives) and sell them direct at a price with one margin on it instead of four. There is no configurator, no quote request and no minimum order. The price on the page is the price you pay, and delivery is free.</p>

          <p>We are deliberately narrow. Six devices, three sizes, two operating systems. It is easier to know six products properly than to list six hundred and know none of them.</p>

          <h2>What we will not do</h2>

          <p>We do not publish invented durability scores or made-up review counts. Every claim on this site is a specification you can check against the manufacturer's own documentation, and where a device is rated IP67 rather than IP68 we say so rather than rounding up.</p>

          <p>We also will not sell you the expensive one by default. Windows devices cost roughly twice what the Android equivalents do, and most trades genuinely do not need them. If you email us and the honest answer is the cheapest device in the range, that is the answer you will get.</p>

          <h2>Based in the UK</h2>

          <p>Prices are in pounds and include VAT. Delivery is free across mainland UK. Support is a UK email address answered by someone who has handled the hardware, not a ticket queue in another timezone. If something goes wrong inside the 12-month warranty, we sort it out.</p>

          <h2>Still early</h2>

          <p>We are a young operation and we would rather say that than pretend otherwise. What that means for you in practice: you get direct access to the people running it, decisions get made quickly, and if you tell us something about the range is wrong, we can actually change it.</p>
        </div>

        <div style="margin-top:3rem; display:flex; gap:0.75rem; flex-wrap:wrap">
          <a class="btn btn-primary" href="/products/">Browse the range</a>
          <a class="btn btn-outline" href="/contact">Ask us anything</a>
        </div>
      </div>
    </section>

${ctaBanner()}
`,
  })
);

/* ==========================================================================
   CONTACT
   ========================================================================== */

const contactTrail = [{ label: 'Home', href: '/' }, { label: 'Contact' }];

write(
  'contact.html',
  page({
    title: 'Contact Tuga Hardware | UK Rugged Tablet Support',
    description:
      'Questions about which rugged tablet suits your trade, bulk orders or an existing order? Email UK-based support and get a straight answer.',
    path: '/contact',
    active: 'contact',
    schema: [breadcrumbSchema(contactTrail), orgSchema],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(contactTrail)}
        ${eyebrow('Contact')}
        <h1>Ask before you spend</h1>
        <p class="lede">Tell us what you do and how you work and we will tell you which size fits, including when the honest answer is the cheapest device in the range.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="editorial" style="align-items:start">
          <div class="editorial-body">
            <h3 class="title-xs">Email us directly</h3>
            <p style="margin-top:0.75rem"><a class="link-arrow" href="mailto:${SITE.email}">${SITE.email}</a></p>
            <p style="margin-top:1.5rem">We answer within one working day, usually much sooner. For order questions, include your order number and we will pull it up.</p>

            <h3 class="title-xs" style="margin-top:2.5rem">What we can help with</h3>
            <ul class="editorial-list">
              <li>Which of the three sizes suits your trade</li>
              <li>Whether you genuinely need Windows or Android will do</li>
              <li>Bulk pricing, proforma invoices and fleet rollouts</li>
              <li>Warranty claims, returns and existing orders</li>
              <li>Accessory compatibility and vehicle mounting</li>
            </ul>
          </div>

          <div>
            <form class="form" data-contact-form novalidate>
              <!-- Honeypot: hidden from humans, checked server-side -->
              <div class="field" style="position:absolute;left:-9999px" aria-hidden="true">
                <label for="website">Website</label>
                <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
              </div>
              <div class="field">
                <label for="name">Your name</label>
                <input type="text" id="name" name="name" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="topic">What is it about?</label>
                <select id="topic" name="topic">
                  <option>Choosing a device</option>
                  <option>Bulk or fleet order</option>
                  <option>An existing order</option>
                  <option>Warranty or return</option>
                  <option>Something else</option>
                </select>
              </div>
              <div class="field">
                <label for="message">Message</label>
                <textarea id="message" name="message" required placeholder="Tell us what you do and where the device will be used."></textarea>
              </div>
              <button class="btn btn-primary btn-lg" type="submit">Send message</button>
              <p class="form-status hidden" data-form-status role="status"></p>
            </form>
          </div>
        </div>
      </div>
    </section>
`,
  })
);

/* ==========================================================================
   CART + ORDER CONFIRMATION
   ========================================================================== */

write(
  'cart.html',
  page({
    title: 'Your Basket | Tuga Hardware',
    description: 'Review your basket and check out securely. Free UK delivery and automatic team discounts on every order.',
    path: '/cart',
    noindex: true,
    schema: [],
    body: `
    <section class="page-header">
      <div class="container">
        ${eyebrow('Basket')}
        <h1>Your basket</h1>
      </div>
    </section>

    <div class="container">
      <div class="cart-empty" data-cart-empty hidden>
        <h2 class="title-md">Nothing in the basket yet</h2>
        <p>Six devices across three sizes, from ${money(Math.min(...devices.map((d) => d.price)))}. Free UK delivery on all of them.</p>
        <a class="btn btn-primary btn-lg" href="/products/">Browse the range</a>
      </div>

      <div class="cart-layout" data-cart-layout hidden>
        <div data-cart-items></div>
        <aside class="cart-summary" data-cart-summary aria-label="Order summary"></aside>
      </div>
    </div>
`,
  })
);

write(
  'order-confirmation.html',
  page({
    title: 'Order Confirmed | Tuga Hardware',
    description: 'Your Tuga Hardware order is confirmed.',
    path: '/order-confirmation',
    noindex: true,
    schema: [],
    body: `
    <section class="section">
      <div class="container-narrow" style="text-align:center">
        <div class="feature-icon" style="margin:0 auto 1.5rem; width:3.5rem; height:3.5rem">${icons.check(28)}</div>
        <h1 class="title-lg">Order confirmed</h1>
        <p class="lede" style="margin-inline:auto">Thank you. A confirmation email is on its way with your order number and delivery details. Orders placed before 2pm on a working day are dispatched the same day.</p>
        <div data-order-summary style="margin-top:2rem"></div>
        <div style="margin-top:2.5rem; display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap">
          <a class="btn btn-primary" href="/products/">Continue browsing</a>
          <a class="btn btn-outline" href="/contact">Contact support</a>
        </div>
      </div>
    </section>
`,
  })
);

/* ==========================================================================
   LEGAL / POLICY PAGES — content lifted from the previous build
   ========================================================================== */

/* Prose lives as fragments under build/content/ — extracted once from the
   original hand-written pages by extract-content.mjs. Never read the
   generated output back in; that made rebuilds destructive. */
const liftProse = (name) =>
  readFileSync(join(ROOT, 'build', 'content', 'legal', name), 'utf8').trim();

const legalPages = [
  {
    file: 'privacy.html',
    title: 'Privacy Policy | Tuga Hardware',
    h1: 'Privacy Policy',
    description:
      'How Tuga Hardware collects, uses and protects your personal data, and the rights you have under UK GDPR.',
    path: '/privacy',
  },
  {
    file: 'terms.html',
    title: 'Terms & Conditions | Tuga Hardware',
    h1: 'Terms & Conditions',
    description:
      'The terms that apply when you buy rugged tablets and accessories from Tuga Hardware.',
    path: '/terms',
  },
  {
    file: 'shipping-returns.html',
    title: 'Shipping & Returns | Tuga Hardware',
    h1: 'Shipping & Returns',
    description:
      'Free UK delivery, same-day dispatch before 2pm, and 30-day returns on every Tuga Hardware order.',
    path: '/shipping-returns',
  },
];

const legalContent = legalPages.map((p) => ({ ...p, prose: liftProse(p.file) }));

legalContent.forEach((p) => {
  const trail = [{ label: 'Home', href: '/' }, { label: p.h1 }];
  write(
    p.file,
    page({
      title: p.title,
      description: p.description,
      path: p.path,
      schema: [breadcrumbSchema(trail)],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(trail)}
        <h1>${esc(p.h1)}</h1>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <div class="prose">
${p.prose}
        </div>
      </div>
    </section>
`,
    })
  );
});

/* ==========================================================================
   BLOG
   ========================================================================== */

const BLOG_IMAGES = {
  'best-rugged-tablets-construction': 'blog-construction.webp',
  'ip68-vs-ip67-waterproof-rating': 'blog-waterproof.webp',
  'rugged-vs-consumer-tablet-cost': 'blog-cost.webp',
  'best-tablets-field-engineers': 'blog-field-engineer.webp',
  'why-tradespeople-switching-rugged-tablets': 'blog-tradespeople.webp',
  'why-rugged-tablets-expensive': 'blog-expensive.webp',
  'best-budget-rugged-tablets-under-400': 'blog-budget.webp',
  'do-you-need-enterprise-rugged-tablet': 'blog-enterprise.webp',
};

/** Read a blog fragment from build/content/blog/. */
function readPost(file) {
  const slug = file.replace(/\.html$/, '');
  const raw = readFileSync(join(ROOT, 'build', 'content', 'blog', file), 'utf8');

  const meta = (raw.match(/<!--meta\n([\s\S]*?)\n-->/) || [])[1] ?? '';
  const field = (name) =>
    (meta.match(new RegExp(`^${name}: (.*)$`, 'm')) || [])[1]?.trim() ?? '';

  const body = raw.replace(/<!--meta\n[\s\S]*?\n-->/, '').trim();

  return {
    slug,
    title: field('title'),
    description: field('description'),
    date: field('date') || '2026-03-01',
    body,
    image: `/img/blog/${BLOG_IMAGES[slug] ?? 'blog-construction.webp'}`,
  };
}

const posts = readdirSync(join(ROOT, 'build', 'content', 'blog'))
  .filter((f) => f.endsWith('.html'))
  .map(readPost)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

posts.forEach((post) => {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Guides', href: '/blog/' },
    { label: post.title.replace(/<[^>]+>/g, '') },
  ];

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.replace(/<[^>]+>/g, ''),
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    image: `${SITE.origin}${post.image}`,
    mainEntityOfPage: `${SITE.origin}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.origin },
    publisher: { '@id': `${SITE.origin}/#organization` },
  };

  write(
    `blog/${post.slug}.html`,
    page({
      title: `${post.title.replace(/<[^>]+>/g, '')} | Tuga Hardware`,
      description: post.description,
      path: `/blog/${post.slug}`,
      active: 'blog',
      ogType: 'article',
      ogImage: post.image,
      schema: [orgSchema, articleSchema, breadcrumbSchema(trail)],
      body: `
    <div class="container-narrow">
${breadcrumbs(trail)}
      <header class="post-header">
        ${eyebrow('Guide')}
        <h1>${post.title}</h1>
        <div class="post-meta">
          <time datetime="${esc(post.date)}">${formatDate(post.date)}</time>
          <span>Tuga Hardware</span>
        </div>
      </header>
    </div>

    <div class="container-narrow">
      <div class="post-hero">
        <img src="${post.image}" alt="" loading="eager" width="1200" height="514">
      </div>

      <article class="prose">
${post.body}

        <div class="prose-cta">
          <h3>Rugged tablets from ${money(Math.min(...devices.map((d) => d.price)))}</h3>
          <p>IP68 sealed, MIL-STD drop tested, all-day battery. Free UK delivery, 30-day returns and a 12-month warranty on every device.</p>
          <a class="link-arrow" href="/products/">Browse the range</a>
        </div>
      </article>
    </div>

    <section class="section">
      <div class="container">
${sectionHead({ tag: 'Keep reading', title: 'More guides' })}
        <div class="post-grid">
          ${posts
            .filter((p) => p.slug !== post.slug)
            .slice(0, 3)
            .map(
              (p) => `
          <a class="post-card reveal" href="/blog/${p.slug}">
            <div class="post-card-media"><img src="${p.image}" alt="" loading="lazy" width="620" height="388"></div>
            <div class="post-card-body">
              <p class="post-card-date">${formatDate(p.date)}</p>
              <h3>${p.title}</h3>
              <p>${esc(p.description)}</p>
              <span class="product-card-cta">Read ${icons.arrowRight(14)}</span>
            </div>
          </a>`
            )
            .join('')}
        </div>
      </div>
    </section>

${ctaBanner()}
`,
    })
  );
});

const blogTrail = [{ label: 'Home', href: '/' }, { label: 'Guides' }];

write(
  'blog/index.html',
  page({
    title: 'Rugged Tablet Guides for UK Tradespeople | Tuga Hardware',
    description:
      'Practical guides on choosing a rugged tablet: IP ratings explained, real cost comparisons, and the best devices for construction, field service and trades.',
    path: '/blog/',
    active: 'blog',
    schema: [
      breadcrumbSchema(blogTrail),
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Tuga Hardware Guides',
        url: `${SITE.origin}/blog/`,
        publisher: { '@id': `${SITE.origin}/#organization` },
      },
    ],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(blogTrail)}
        ${eyebrow('Guides')}
        <h1>Straight answers about rugged kit</h1>
        <p class="lede">What the ratings actually mean, what the real cost of a cheap tablet is, and which device suits which trade. Written to be useful whether or not you buy from us.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="post-grid">
          ${posts
            .map(
              (p) => `
          <a class="post-card reveal" href="/blog/${p.slug}">
            <div class="post-card-media"><img src="${p.image}" alt="" loading="lazy" width="620" height="388"></div>
            <div class="post-card-body">
              <p class="post-card-date">${formatDate(p.date)}</p>
              <h2>${p.title}</h2>
              <p>${esc(p.description)}</p>
              <span class="product-card-cta">Read ${icons.arrowRight(14)}</span>
            </div>
          </a>`
            )
            .join('')}
        </div>
      </div>
    </section>

${capture()}

${ctaBanner()}
`,
  })
);

/* ==========================================================================
   SITEMAP + ROBOTS
   ========================================================================== */

const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: '/', priority: '1.0', freq: 'weekly' },
  { loc: '/products/', priority: '0.9', freq: 'weekly' },
  ...devices.map((p) => ({
    loc: productUrl(p),
    priority: '0.9',
    freq: 'weekly',
  })),
  { loc: '/accessories', priority: '0.7', freq: 'monthly' },
  { loc: '/bulk', priority: '0.7', freq: 'monthly' },
  { loc: '/blog/', priority: '0.7', freq: 'weekly' },
  ...posts.map((p) => ({
    loc: `/blog/${p.slug}`,
    priority: '0.6',
    freq: 'monthly',
  })),
  { loc: '/about', priority: '0.5', freq: 'yearly' },
  { loc: '/contact', priority: '0.5', freq: 'yearly' },
  { loc: '/shipping-returns', priority: '0.4', freq: 'yearly' },
  { loc: '/privacy', priority: '0.2', freq: 'yearly' },
  { loc: '/terms', priority: '0.2', freq: 'yearly' },
];

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE.origin}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
);

write(
  'robots.txt',
  `User-agent: *
Allow: /
Disallow: /cart
Disallow: /order-confirmation
Disallow: /api/

# AI crawlers are welcome. Being cited is how a small store gets found.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${SITE.origin}/sitemap.xml
`
);

/* A tiny mark for the browser tab. */
write(
  'favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#052e16"/>
  <text x="32" y="44" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="38" font-weight="800" fill="#c4856c" text-anchor="middle">T</text>
</svg>
`
);

/* ==========================================================================
   DONE
   ========================================================================== */

console.log(`Built ${written.length} files:`);
written.forEach((f) => console.log(`  ${f}`));
