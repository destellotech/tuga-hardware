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
  data,
  devices,
  androidRange,
  windowsRange,
  accessories,
  variantsOf,
  esc,
  money,
  icons,
  imgPath,
  responsive,
  versioned,
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
    a: 'Delivery is free to every UK address, with no minimum. Devices ship direct from the manufacturer, which is a large part of why the prices are what they are, so allow 10 to 20 working days. We email a tracking number as soon as your order ships. If you need a device sooner than that, email us before you order and we will tell you honestly whether it is possible.',
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
    page: '/for/electricians',
    copy: 'EICR and certification apps, compliance photos, job sign-off. Sealed against the dust in a consumer unit and the damp in a meter cupboard.',
    pick: 'tuga-a8',
  },
  {
    icon: icons.building(24),
    name: 'Construction',
    page: '/for/construction',
    copy: 'Site plans, snag lists and daily reports. A big screen you can read a drawing on, in a body that survives a fall off the scaffold boards.',
    pick: 'tuga-a10',
  },
  {
    icon: icons.wrench(24),
    name: 'Field service',
    page: '/for/field-service',
    copy: 'Job sheets, customer signature, photo evidence, parts lookup. One device that does the whole visit without going back to the van.',
    pick: 'tuga-a8',
  },
  {
    icon: icons.truck(24),
    name: 'Logistics & delivery',
    page: '/for/logistics',
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
    copy: 'Crop records, livestock tracking and field mapping. Sealed against mud, rain and frost, with a big screen for maps.',
    pick: 'tuga-a10',
  },
];

function tradeCard(t) {
  const device = devices.find((d) => d.id === t.pick);
  return `
          <a class="trade-card reveal" href="${t.page ?? productUrl(device)}">
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
            <a class="btn btn-outline-light btn-lg" href="/which-tuga">Help me choose</a>
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
        <figure class="hero-drawing">
          <img src="${imgPath(lead, 2)}" alt="Dimensioned drawing of the Tuga A8 showing ports, buttons and case dimensions" width="800" height="291" fetchpriority="high">
          <figcaption>
            <span><strong>${esc(lead.name)}</strong></span>
            <span>${esc(lead.sizeLabel)}&Prime; ${esc(lead.specs.ip_rating)}</span>
            <span>${esc(lead.specs.battery)}</span>
            <span>${money(lead.price)}</span>
          </figcaption>
        </figure>
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
  lede: 'Three Android devices, one for each size. Nearly everyone chooses on size first, so start there and let the specifications follow. Every size also comes in a Windows version, <a href="#windows">further down the page</a>.',
})}
${sizeLadder(androidRange)}
      </div>
    </section>

    <section class="section section-deep" id="windows">
      <div class="container">
${sectionHead({
  tag: 'Windows range',
  title: 'The same three sizes, running full Windows 11 Pro',
  lede: 'Buy these only if a specific piece of desktop software forces your hand: diagnostic tools, legacy databases, GIS, CAD viewers or a network drive. They cost roughly twice the Android equivalents, and for most trades Android does the job.',
  wide: true,
})}
${productGrid(windowsRange)}
      </div>
    </section>

    <section class="section">
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
            <img src="${versioned('/img/blog/blog-waterproof.webp')}" alt="Rugged tablet being used in wet conditions" loading="lazy" width="800" height="600">
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
            <img src="${versioned('/img/blog/blog-construction.webp')}" alt="Rugged tablet in use on a construction site" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Drop tested to a real standard</h3>
            <p>MIL-STD-810H is a published military test method, not a marketing phrase. The drop procedure means repeated falls from 1.2 to 1.5 metres onto plywood over concrete, across every face and corner, with the device still functioning afterwards.</p>
            <p>In practice that comes from reinforced corners, a rubberised over-mould and a screen recessed behind a raised bezel, so the glass does not take the first hit when it lands face down.</p>
          </div>
        </article>

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="${versioned('/img/blog/blog-field-engineer.webp')}" alt="Field engineer using a rugged tablet outdoors" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Screens you can read outside, batteries that last the shift</h3>
            <p>A standard tablet runs about 400 nits, which washes out the moment you step outdoors. The A6, A8, WH6 and W8 run 500 to 800 nits, so you are not cupping a hand over the screen to read a job number. The A10 is the exception at 350 nits: it is built for reading drawings in a van or site cabin, and if you work in direct sun all day the A8 is the better buy.</p>
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
        <p class="lede">Six devices across three sizes. Android for app-based work, Windows where desktop software forces it. Every one is sealed, drop tested and shipped free. Not sure? <a class="link-arrow" href="/which-tuga">Answer four questions</a></p>
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
        // Shipped direct from the manufacturer: 10 to 20 working days.
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 10, maxValue: 20, unitCode: 'DAY' },
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
            <button type="button" class="gallery-zoom" data-zoom aria-label="Enlarge image">${icons.zoom(18)}</button>
            <img id="gallery-image" src="${imgPath(p, 1)}" alt="${esc(p.name)} rugged ${p.formFactor}" width="800" height="800" fetchpriority="high">
          </div>
          <div class="gallery-thumbs" role="group" aria-label="Product images">
            ${p.images
              .map(
                (_, i) => `
            <button type="button" class="gallery-thumb${i === 0 ? ' is-active' : ''}" data-gallery-src="${imgPath(p, i + 1)}" aria-label="View image ${i + 1}">
              <img src="${imgPath(p, i + 1)}"${responsive(imgPath(p, i + 1), '74px')} alt="" width="150" height="150" loading="lazy">
            </button>`
              )
              .join('')}
          </div>
          ${
            /* Optional abuse-test footage: "video": { "src", "poster", "caption" }
               in products.json. Short, silent loops work best. */
            p.video
              ? `
          <figure class="pdp-video">
            <video src="${versioned(p.video.src)}"${p.video.poster ? ` poster="${versioned(p.video.poster)}"` : ''} autoplay muted loop playsinline preload="metadata" aria-label="${esc(p.video.caption || `${p.name} video`)}"></video>
            ${p.video.caption ? `<figcaption>${esc(p.video.caption)}</figcaption>` : ''}
          </figure>`
              : ''
          }
        </div>

        <dialog class="lightbox" data-lightbox aria-label="${esc(p.name)} images">
          <button type="button" class="lightbox-close" data-lightbox-close aria-label="Close">${icons.close(22)}</button>
          <button type="button" class="lightbox-nav lightbox-prev" data-lightbox-step="-1" aria-label="Previous image">&larr;</button>
          <img data-lightbox-image src="" alt="${esc(p.name)}">
          <button type="button" class="lightbox-nav lightbox-next" data-lightbox-step="1" aria-label="Next image">&rarr;</button>
        </dialog>

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
    a: 'Yes. <a href="/trade">Open a trade account</a> to order on invoice and pay by bank transfer. For a one-off order of ten units or more we can also raise a proforma invoice: email us what you need and a company address.',
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

    <section class="section section-deep" id="calculator">
      <div class="container">
${sectionHead({
  tag: 'Calculator',
  title: 'Price up your team',
  lede: 'Set the quantities and the discount works itself out, exactly as checkout will charge it. Add the lot to the basket, or print a quote for whoever signs it off.',
})}
        <div class="calc" data-calc>
          <div class="calc-quote-head">
            <strong>${esc(SITE.name)}: quotation</strong>
            <span>${SITE.origin.replace('https://', '')} / ${SITE.email}</span>
            <span data-calc-date></span>
          </div>
          <div class="compare-wrap">
            <table class="compare-table calc-table">
              <caption class="sr-only">Bulk order calculator</caption>
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Line total</th>
                </tr>
              </thead>
              <tbody>
                ${data.products
                  .slice()
                  .sort((a, b) => {
                    const oa = devices.find((d) => d.id === (a.variantOf ?? a.id))?.order ?? 99;
                    const ob = devices.find((d) => d.id === (b.variantOf ?? b.id))?.order ?? 99;
                    return oa - ob || (a.isVariant ? 1 : 0) - (b.isVariant ? 1 : 0);
                  })
                  .map(
                    (p) => `
                <tr data-calc-row="${p.id}" data-price="${p.price}">
                  <td><a href="${productUrl(p.isVariant ? devices.find((d) => d.id === p.variantOf) : p)}">${esc(p.name)}</a></td>
                  <td class="cell-mono" data-calc-unit>${money(p.price)}</td>
                  <td>
                    <div class="qty qty-sm">
                      <button type="button" data-calc-step="-1" aria-label="One fewer ${esc(p.name)}">&minus;</button>
                      <input type="number" value="0" min="0" max="99" inputmode="numeric" data-calc-qty aria-label="Quantity of ${esc(p.name)}">
                      <button type="button" data-calc-step="1" aria-label="One more ${esc(p.name)}">+</button>
                    </div>
                  </td>
                  <td class="cell-price" data-calc-line></td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="calc-summary" aria-live="polite">
            <div class="calc-figures">
              <div><span class="stat-label">Devices</span><strong data-calc-units>0</strong></div>
              <div><span class="stat-label">Discount</span><strong data-calc-tier>0%</strong></div>
              <div><span class="stat-label">You save</span><strong data-calc-saving>£0</strong></div>
              <div><span class="stat-label">Total inc. VAT</span><strong data-calc-total>£0</strong></div>
            </div>
            <p class="calc-note" data-calc-note>Add two or more devices to unlock a discount. Delivery is free.</p>
            <p class="calc-vat" data-calc-vat></p>
            <div class="calc-actions">
              <button type="button" class="btn btn-primary" data-calc-add disabled>Add to basket</button>
              <button type="button" class="btn btn-outline" data-calc-print disabled>Print a quote</button>
              <a class="btn btn-outline" href="/trade">Pay on invoice instead</a>
            </div>
          </div>
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
            <p style="margin-top:1.5rem">Ordering ten or more? You get 10% automatically. If your accounts department would rather pay on invoice, <a href="/trade">open a trade account</a>.</p>
            <div style="margin-top:2rem">
              <a class="btn btn-primary" href="/products/">Start an order</a>
              <a class="btn btn-outline" href="/trade" style="margin-left:0.5rem">Pay on invoice</a>
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
   WHICH TUGA? — a four-question picker
   ========================================================================== */

/* Only what the picker needs, inlined so it works without a second fetch.
   The recommendation logic lives in js/app.js (initPicker). */
const pickerData = data.products.map((p) => {
  const base = p.isVariant ? devices.find((d) => d.id === p.variantOf) : p;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    os: base.category,
    size: base.sizeClass,
    variantOf: p.variantOf ?? null,
    url: productUrl(base),
    image: imgPath(base, 1),
    tagline: p.isVariant ? p.description : base.tagline,
    ip: base.specs.ip_rating,
    battery: base.specs.battery,
    weight: base.specs.weight,
  };
});

const pickerStep = (n, name, question, hint, options) => `
          <fieldset class="picker-step" data-picker-step="${n}"${n > 1 ? ' hidden' : ''}>
            <legend>
              <span class="picker-count">Question ${n} of 4</span>
              <span class="picker-question">${question}</span>
            </legend>
            ${hint ? `<p class="picker-hint">${hint}</p>` : ''}
            <div class="picker-options">
              ${options
                .map(
                  (o) => `
              <label class="picker-option">
                <input type="radio" name="${name}" value="${o.value}">
                <span class="picker-option-title">${o.title}</span>
                <span class="picker-option-text">${o.text}</span>
              </label>`
                )
                .join('')}
            </div>
            ${n > 1 ? '<button type="button" class="picker-back" data-picker-back>&larr; Back</button>' : ''}
          </fieldset>`;

const pickerTrail = [{ label: 'Home', href: '/' }, { label: 'Which Tuga?' }];

write(
  'which-tuga.html',
  page({
    title: 'Which Rugged Tablet Should I Buy? | Tuga Hardware',
    description:
      'Four questions, one answer. Find the right rugged tablet or handheld for your trade: Android or Windows, 6, 8 or 10 inch, with or without a scanner.',
    path: '/which-tuga',
    active: 'products',
    schema: [breadcrumbSchema(pickerTrail)],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(pickerTrail)}
        ${eyebrow('Which Tuga?')}
        <h1>Four questions, one answer</h1>
        <p class="lede">No spec sheets. Tell us how you work and we will point you at one device, including when the right answer is the cheapest one.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <form class="picker" data-picker novalidate>
${pickerStep(1, 'os', 'What does it need to run?', 'If every tool you use has an app, Android does the job for about half the price.', [
  { value: 'android', title: 'Apps', text: 'Job sheets, forms, photos, maps, email, cloud tools.' },
  { value: 'windows', title: 'Windows software', text: 'Desktop programs with no app version: diagnostics, GIS, CAD viewers, network drives.' },
  { value: 'unsure', title: 'Not sure', text: 'We will assume apps. You can always ask us before buying.' },
])}
${pickerStep(2, 'size', 'Where does it live during the day?', null, [
  { value: '6', title: 'Pocket or belt', text: 'Photos, sign-off, comms. Out of the way until you need it.' },
  { value: '8', title: 'One hand, van door pocket', text: 'Forms and drawings at a readable size. What most trades choose.' },
  { value: '10', title: 'On the bonnet or a trestle', text: 'Plans, PDFs and spreadsheets at full size, read for long stretches.' },
])}
${pickerStep(3, 'scan', 'Do you scan barcodes?', null, [
  { value: 'lots', title: 'All day', text: 'Stock, parcels, assets. Scanning is the job.' },
  { value: 'some', title: 'Now and then', text: 'The odd serial number or parts label.' },
  { value: 'none', title: 'No', text: 'Not part of the work.' },
])}
${pickerStep(4, 'qty', 'How many do you need?', 'Team discounts apply automatically at checkout. No codes, no sales call.', [
  { value: '1', title: 'Just me', text: 'One device.' },
  { value: '2', title: 'A small crew', text: '2 to 4 devices, 3% to 5% off.' },
  { value: '5', title: 'A team', text: '5 to 9 devices, 8% off.' },
  { value: '10', title: 'A fleet', text: '10 or more, 10% off.' },
])}
        </form>

        <div class="picker-result" data-picker-result hidden aria-live="polite"></div>

        <noscript><p class="lede">The picker needs JavaScript. The short version: Android 8 inch (the <a href="/products/tuga-a8">Tuga A8</a>) suits most trades. <a href="/contact">Ask us</a> if you are unsure.</p></noscript>
      </div>
    </section>

    <script type="application/json" id="picker-data">${JSON.stringify(pickerData).replace(/</g, '\\u003c')}</script>

${ctaBanner({
  title: 'Rather ask a person?',
  text: 'Email us what you do and where the device will be used. We answer within one working day.',
  primary: { href: '/contact', label: 'Ask us' },
  secondary: { href: '/products/', label: 'See every device' },
})}
`,
  })
);

/* ==========================================================================
   TRADE ACCOUNTS
   ========================================================================== */

const tradeTrail = [{ label: 'Home', href: '/' }, { label: 'Trade accounts' }];

const honeypot = `
              <div class="field" style="position:absolute;left:-9999px" aria-hidden="true">
                <label for="website">Website</label>
                <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
              </div>`;

const TRADE_FAQ = [
  {
    q: 'Who can open a trade account?',
    a: 'Any UK registered business, sole traders included. We check the company details you give us and reply within one working day.',
  },
  {
    q: 'What payment terms do you offer?',
    a: 'Approved accounts can order on invoice and pay by bank transfer. Terms depend on the business and order size; we agree them when we approve the account. Card checkout stays available for every order.',
  },
  {
    q: 'Do trade prices include VAT?',
    a: 'Prices on the site include UK VAT, and we issue a VAT invoice for any order on request, so a VAT registered business can reclaim it. UK business to business sales are still charged VAT; it is not removed at checkout.',
  },
  {
    q: 'Does a trade account change the discount?',
    a: 'The automatic team discounts (up to 10% at ten devices) apply to everyone. For larger rollouts, staged deliveries or framework agreements, tell us what you need on the form and we will quote properly.',
  },
];

const tradeFaq = faq(TRADE_FAQ, { heading: 'Trade account questions' });

write(
  'trade.html',
  page({
    title: 'Trade Accounts: Pay on Invoice | Tuga Hardware',
    description:
      'Open a Tuga Hardware trade account: order rugged tablets on invoice, pay by bank transfer, VAT invoices on every order. For UK businesses and sole traders.',
    path: '/trade',
    active: 'bulk',
    schema: [breadcrumbSchema(tradeTrail), tradeFaq.schema],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(tradeTrail)}
        ${eyebrow('Trade accounts')}
        <h1>Order on invoice, pay by bank transfer</h1>
        <p class="lede">For businesses that would rather not put a fleet of tablets on someone's personal card. Apply once, then order the way your accounts department likes.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="editorial" style="align-items:start">
          <div class="editorial-body">
            <h2 class="title-xs">What you get</h2>
            <ul class="editorial-list">
              <li>Order on invoice and pay by bank transfer</li>
              <li>VAT invoices for every order, on request</li>
              <li>The same automatic team discounts, up to 10% at ten devices</li>
              <li>One named contact who knows your order history</li>
              <li>Help with staged deliveries and mixed fleets</li>
            </ul>
            <p style="margin-top:1.5rem">Just want a few units now? You do not need an account. <a class="link-arrow" href="/bulk">Use the bulk calculator</a></p>
          </div>

          <div>
            <form class="form" data-api-form="/api/trade-apply" data-success="Thanks. We will check the details and reply within one working day." novalidate>
${honeypot}
              <div class="field">
                <label for="company">Company name</label>
                <input type="text" id="company" name="company" autocomplete="organization" required>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="name">Your name</label>
                  <input type="text" id="name" name="name" autocomplete="name" required>
                </div>
                <div class="field">
                  <label for="phone">Phone</label>
                  <input type="tel" id="phone" name="phone" autocomplete="tel">
                </div>
              </div>
              <div class="field">
                <label for="email">Work email</label>
                <input type="email" id="email" name="email" autocomplete="email" required>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="companyNumber">Companies House no.</label>
                  <input type="text" id="companyNumber" name="companyNumber" inputmode="text" placeholder="Optional">
                </div>
                <div class="field">
                  <label for="vatNumber">VAT number</label>
                  <input type="text" id="vatNumber" name="vatNumber" placeholder="Optional">
                </div>
              </div>
              <div class="field">
                <label for="devices">Devices per year, roughly</label>
                <select id="devices" name="devices">
                  <option>Fewer than 10</option>
                  <option>10 to 49</option>
                  <option>50 to 199</option>
                  <option>200 or more</option>
                </select>
              </div>
              <div class="field">
                <label for="message">Anything we should know?</label>
                <textarea id="message" name="message" placeholder="What the devices are for, payment terms you need, delivery sites."></textarea>
              </div>
              <button class="btn btn-primary btn-lg" type="submit">Apply for an account</button>
              <p class="form-status hidden" data-form-status role="status"></p>
            </form>
          </div>
        </div>
      </div>
    </section>

${tradeFaq.html}
`,
  })
);

/* ==========================================================================
   WARRANTY REGISTRATION
   ========================================================================== */

const warrantyTrail = [{ label: 'Home', href: '/' }, { label: 'Register your warranty' }];

write(
  'warranty.html',
  page({
    title: 'Register Your Warranty | Tuga Hardware',
    description:
      'Register your Tuga rugged tablet or handheld against its serial number, so a warranty claim takes one email instead of a search for the receipt.',
    path: '/warranty',
    schema: [breadcrumbSchema(warrantyTrail)],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(warrantyTrail)}
        ${eyebrow('Warranty')}
        <h1>Register your device</h1>
        <p class="lede">Every device has a 12-month warranty whether you register or not. Registering ties the serial number to you, so if something goes wrong a claim is one email rather than a hunt for the receipt.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="editorial" style="align-items:start">
          <div class="editorial-body">
            <h2 class="title-xs">Finding the serial number</h2>
            <ul class="editorial-list">
              <li>On the label on the box, next to the barcode</li>
              <li>Android: Settings, About tablet (or About phone), Status, Serial number</li>
              <li>Windows: Settings, System, About, or run <code>wmic bios get serialnumber</code></li>
            </ul>
            <h2 class="title-xs" style="margin-top:2.5rem">Registering a fleet?</h2>
            <p style="margin-top:0.75rem">Email <a href="mailto:${SITE.email}">${SITE.email}</a> a spreadsheet of serial numbers with your order reference and we will register them all at once.</p>
          </div>

          <div>
            <form class="form" data-api-form="/api/warranty-register" data-success="Registered. Keep this email address handy: it is how we will find the device if you ever need to claim." novalidate>
${honeypot}
              <div class="field-row">
                <div class="field">
                  <label for="name">Your name</label>
                  <input type="text" id="name" name="name" autocomplete="name" required>
                </div>
                <div class="field">
                  <label for="email">Email address</label>
                  <input type="email" id="email" name="email" autocomplete="email" required>
                </div>
              </div>
              <div class="field">
                <label for="model">Model</label>
                <select id="model" name="model" required>
                  <option value="">Choose your device</option>
                  ${data.products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('\n                  ')}
                </select>
              </div>
              <div class="field">
                <label for="serial">Serial number</label>
                <input type="text" id="serial" name="serial" required autocapitalize="characters" spellcheck="false" minlength="4" maxlength="40">
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="orderRef">Order reference</label>
                  <input type="text" id="orderRef" name="orderRef" placeholder="Optional">
                </div>
                <div class="field">
                  <label for="purchaseDate">Purchase date</label>
                  <input type="date" id="purchaseDate" name="purchaseDate">
                </div>
              </div>
              <button class="btn btn-primary btn-lg" type="submit">Register device</button>
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
   REVIEW — reached only from the review-request email (src/reviews.js)
   ========================================================================== */

write(
  'review.html',
  page({
    title: 'Leave a Review | Tuga Hardware',
    description: 'Tell other tradespeople how your Tuga is holding up.',
    path: '/review',
    noindex: true,
    schema: [],
    body: `
    <section class="page-header">
      <div class="container-narrow">
        ${eyebrow('Review')}
        <h1>How is it holding up?</h1>
        <p class="lede" data-review-lede>Loading your order&hellip;</p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <form class="form" data-review-form hidden novalidate>
          <fieldset class="stars" aria-required="true">
            <legend class="field-legend">Overall rating</legend>
            ${[5, 4, 3, 2, 1]
              .map(
                (n) => `<input type="radio" id="star-${n}" name="rating" value="${n}"><label for="star-${n}" title="${n} star${n > 1 ? 's' : ''}"><span class="sr-only">${n} star${n > 1 ? 's' : ''}</span></label>`
              )
              .join('')}
          </fieldset>
          <div class="field">
            <label for="title">Headline</label>
            <input type="text" id="title" name="title" maxlength="120" placeholder="e.g. Survived a fall off the scaffold">
          </div>
          <div class="field">
            <label for="body">Your review</label>
            <textarea id="body" name="body" maxlength="4000" placeholder="What you use it for, what it has survived, anything you would change."></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="displayName">Name to show</label>
              <input type="text" id="displayName" name="displayName" maxlength="60" placeholder="e.g. Dan, Leeds">
            </div>
            <div class="field">
              <label for="trade">Your trade</label>
              <input type="text" id="trade" name="trade" maxlength="60" placeholder="e.g. Electrician">
            </div>
          </div>
          <p class="form-note">We publish every genuine review, good or bad, marked as a verified purchase. We only remove reviews that are abusive or not about the product.</p>
          <button class="btn btn-primary btn-lg" type="submit">Submit review</button>
          <p class="form-status hidden" data-form-status role="status"></p>
        </form>
      </div>
    </section>
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
        <h1 class="title-lg" data-order-title>Order confirmed</h1>
        <p class="lede" style="margin-inline:auto" data-order-lede>Thank you. A confirmation email is on its way with your order number. Devices ship direct from the manufacturer, so allow 10 to 20 working days for delivery; we email a tracking number as soon as yours ships.</p>
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
      'Free UK delivery direct from the manufacturer in 10 to 20 working days, tracked, with 30-day returns on every Tuga Hardware order.',
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
      ogImage: versioned(post.image),
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
        <img src="${versioned(post.image)}"${responsive(post.image, '(max-width: 820px) 94vw, 780px')} alt="" loading="eager" width="1200" height="514">
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
            <div class="post-card-media"><img src="${versioned(p.image)}"${responsive(p.image, '(max-width: 700px) 92vw, 400px')} alt="" loading="lazy" width="620" height="388"></div>
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
            <div class="post-card-media"><img src="${versioned(p.image)}"${responsive(p.image, '(max-width: 700px) 92vw, 400px')} alt="" loading="lazy" width="620" height="388"></div>
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
   TRADE LANDING PAGES — /for/<trade>, prose in build/content/trades/
   ========================================================================== */

/** Read a trade fragment: a meta comment, then body HTML. */
function readTrade(file) {
  const raw = readFileSync(join(ROOT, 'build', 'content', 'trades', file), 'utf8').replace(/\r\n/g, '\n');
  const meta = (raw.match(/<!--meta\n([\s\S]*?)\n-->/) || [])[1] ?? '';
  const field = (name) =>
    (meta.match(new RegExp(`^${name}: (.*)$`, 'm')) || [])[1]?.trim() ?? '';

  const pick = devices.find((d) => d.id === field('pick'));
  if (!pick) throw new Error(`build/content/trades/${file}: unknown pick "${field('pick')}"`);

  return {
    slug: file.replace(/\.html$/, ''),
    title: field('title'),
    description: field('description'),
    h1: field('h1'),
    lede: field('lede'),
    pick,
    also: field('also')
      .split(',')
      .map((id) => devices.find((d) => d.id === id.trim()))
      .filter(Boolean),
    body: raw.replace(/<!--meta\n[\s\S]*?\n-->/, '').trim(),
  };
}

const trades = readdirSync(join(ROOT, 'build', 'content', 'trades'))
  .filter((f) => f.endsWith('.html'))
  .map(readTrade);

trades.forEach((t) => {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Tablets', href: '/products/' },
    { label: t.h1 },
  ];

  write(
    `for/${t.slug}.html`,
    page({
      title: t.title,
      description: t.description,
      path: `/for/${t.slug}`,
      active: 'products',
      ogImage: imgPath(t.pick, 1),
      schema: [orgSchema, breadcrumbSchema(trail)],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(trail)}
        ${eyebrow('By trade')}
        <h1>${esc(t.h1)}</h1>
        <p class="lede">${esc(t.lede)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="trade-pick-panel reveal">
          <div class="trade-pick-media">
            <img src="${imgPath(t.pick, 1)}"${responsive(imgPath(t.pick, 1), '(max-width: 820px) 80vw, 360px')} alt="${esc(t.pick.name)}" width="400" height="400">
          </div>
          <div>
            ${eyebrow("What we'd buy")}
            <h2 class="title-sm">${esc(t.pick.name)}</h2>
            <p class="pdp-tagline">${esc(t.pick.tagline)}</p>
            <p class="trade-pick-specs mono">${esc(t.pick.sizeLabel)}&Prime; / ${esc(t.pick.specs.ip_rating)} / ${esc(t.pick.specs.battery)} / ${esc(t.pick.specs.weight)}</p>
            <div class="trade-pick-actions">
              <span class="pdp-price">${money(t.pick.price)}</span>
              <button class="btn btn-primary" data-add-to-cart="${t.pick.id}">${icons.cart(18)} Add to basket</button>
              <a class="btn btn-outline" href="${productUrl(t.pick)}">Full spec</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container-narrow">
        <article class="prose">
${t.body}
        </article>
      </div>
    </section>

    ${
      t.also.length
        ? `<section class="section section-deep">
      <div class="container">
${sectionHead({ tag: 'Also worth a look', title: 'The alternatives' })}
${productGrid(t.also)}
      </div>
    </section>`
        : ''
    }

${ctaBanner({
  title: 'Kitting out the whole crew?',
  text: 'Discounts apply automatically from two devices, up to 10% at ten. Or open a trade account and pay on invoice.',
  primary: { href: '/bulk#calculator', label: 'Price up your team' },
  secondary: { href: '/trade', label: 'Trade accounts' },
})}
`,
    })
  );
});

/* ==========================================================================
   llms.txt — a plain map of the site for AI assistants (llmstxt.org)
   ========================================================================== */

write(
  'llms.txt',
  `# ${SITE.name}

> ${SITE.description} Prices include VAT. Free UK delivery, 30-day returns, 12-month warranty. Automatic team discounts: 3% at 2 devices, 5% at 3 to 4, 8% at 5 to 9, 10% at 10 or more.

Small UK retailer of rugged Android and Windows tablets and handhelds for tradespeople. Six devices, three sizes (6, 8 and 10 inch). Android suits app-based work at roughly half the price; Windows only when desktop software requires it.

## Devices

${devices
  .map(
    (p) =>
      `- [${p.name}](${SITE.origin}${productUrl(p)}): ${money(p.price)}. ${p.sizeLabel} inch ${p.formFactor}, ${p.specs.os}, ${p.specs.ip_rating}${p.specs.mil_std ? `, ${p.specs.mil_std}` : ''}, ${p.specs.battery}, ${p.specs.weight}. ${p.shortFor}`
  )
  .join('\n')}

## Choosing

- [Which Tuga? picker](${SITE.origin}/which-tuga): four questions to a recommendation
${trades.map((t) => `- [${t.h1}](${SITE.origin}/for/${t.slug}): ${t.description}`).join('\n')}

## Buying

- [Bulk orders and calculator](${SITE.origin}/bulk): automatic team discounts
- [Trade accounts](${SITE.origin}/trade): order on invoice, pay by bank transfer
- [Accessories](${SITE.origin}/accessories)
- [Shipping and returns](${SITE.origin}/shipping-returns)
- [Contact](${SITE.origin}/contact): ${SITE.email}

## Guides

${posts.map((p) => `- [${p.title.replace(/<[^>]+>/g, '')}](${SITE.origin}/blog/${p.slug}): ${p.description}`).join('\n')}
`
);

/* ==========================================================================
   GOOGLE SHOPPING FEED

   Point Merchant Center at https://www.tugahardware.com/feed.xml as a
   scheduled fetch. Only the six devices are listed: accessories and the
   scanner variants share a URL with another item, and Shopping requires a
   distinct landing page per offer.
   ========================================================================== */

/** Google's taxonomy ids. A6 is a phone; everything else is a tablet. */
const googleCategory = (p) =>
  p.formFactor === 'handheld' && p.category === 'android' ? 267 : 4745;

const feedItems = devices
  .map((p) => {
    const url = `${SITE.origin}${productUrl(p)}`;
    const extraImages = p.images
      .slice(1)
      .map(
        (_, i) =>
          `      <g:additional_image_link>${SITE.origin}${imgPath(p, i + 2)}</g:additional_image_link>`
      )
      .join('\n');

    return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(`${p.name} ${p.sizeLabel} inch Rugged ${p.category === 'android' ? 'Android' : 'Windows'} ${p.formFactor === 'handheld' ? 'Handheld' : 'Tablet'}`)}</g:title>
      <g:description>${esc(p.description)}</g:description>
      <g:link>${url}</g:link>
      <g:image_link>${SITE.origin}${imgPath(p, 1)}</g:image_link>
${extraImages}
      <g:availability>in_stock</g:availability>
      <g:price>${p.price}.00 GBP</g:price>
      <g:brand>${esc(SITE.name)}</g:brand>
      <g:mpn>${esc(p.id.toUpperCase())}</g:mpn>
      <g:condition>new</g:condition>
      <g:google_product_category>${googleCategory(p)}</g:google_product_category>
      <g:product_type>${esc(`Rugged Devices > ${p.category === 'android' ? 'Android' : 'Windows'} > ${p.sizeLabel} inch`)}</g:product_type>
      <g:shipping>
        <g:country>GB</g:country>
        <g:service>Free UK delivery</g:service>
        <g:price>0.00 GBP</g:price>
        <g:min_transit_time>10</g:min_transit_time>
        <g:max_transit_time>20</g:max_transit_time>
      </g:shipping>
    </item>`;
  })
  .join('\n');

write(
  'feed.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${SITE.origin}</link>
    <description>${esc(SITE.description)}</description>
${feedItems}
  </channel>
</rss>
`
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
  { loc: '/which-tuga', priority: '0.8', freq: 'monthly' },
  ...trades.map((t) => ({ loc: `/for/${t.slug}`, priority: '0.7', freq: 'monthly' })),
  { loc: '/accessories', priority: '0.7', freq: 'monthly' },
  { loc: '/trade', priority: '0.6', freq: 'monthly' },
  { loc: '/warranty', priority: '0.4', freq: 'yearly' },
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
Disallow: /review
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
