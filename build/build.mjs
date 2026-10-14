/* ==========================================================================
   Static site generator for tugahardware.com

   Run:  node build/build.mjs      (or `npm run build`)

   Every .html file in the repo is written by this script. Edit the templates
   here, not the generated output — the next build will overwrite it.

   Why generate rather than render client-side: product pages used to be empty
   shells filled in by JavaScript, which meant Google indexed a blank page for
   every product. Everything below ships as real HTML.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  SITE,
  ROOT,
  data,
  devices,
  androidRange,
  windowsRange,
  accessories,
  warranty,
  warrantyTier,
  variantsOf,
  esc,
  money,
  icons,
  imgPath,
  responsive,
  versioned,
  productUrl,
  specLabel,
  page,
} from './lib/layout.mjs';

import {
  SALES_PAUSED,
  SALES_PAUSED_MESSAGE,
  TRADER,
  TRADER_STATEMENT,
  TRADER_ADDRESS_LINE,
  PRICE_NOTE,
  DELIVERY,
  QUOTE_TOPIC,
  quoteUrl,
} from '../src/store-config.js';

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
   WARRANTY — tiers from data/products.json, copy from build/content/warranty.json
   ========================================================================== */

const warrantyCopy = JSON.parse(readFileSync(join(ROOT, 'build', 'content', 'warranty.json'), 'utf8'));
const paidTiers = warranty.tiers.filter((t) => !t.included);
const fromPrice = (t) => Math.min(...Object.values(t.prices || { x: 0 }));
/** True when the 3-Year Warranty is sold for this device (scanner variants share the base id). */
const has3yr = (p) => warrantyTier('3yr')?.prices?.[p.id.replace(/-scanner$/, '')] !== undefined;

/** Total Care's two price bands for a device: fleets of minUnits to
    smallFleet.maxUnits pay the surcharge on top of the 10+ price. */
const careBands = (t, base) => {
  const large = t.prices?.[base];
  if (large === undefined) return null;
  const small = t.smallFleet ? large + t.smallFleet.surcharge : large;
  const smallMax = t.smallFleet?.maxUnits ?? t.minUnits;
  return { small, large, min: t.minUnits || 1, smallMax, largeMin: t.smallFleet ? smallMax + 1 : t.minUnits || 1 };
};
/** "5 to 9 devices: £309 per device; 10 or more: £279." */
const careBandText = (t, base) => {
  const b = careBands(t, base);
  if (!b) return '';
  return t.smallFleet
    ? `${b.min} to ${b.smallMax} devices: ${money(b.small)} per device; ${b.largeMin} or more: ${money(b.large)}.`
    : `${money(b.large)} per device.`;
};

/** The cover options under a product's buy box. Every tier is a radio: a
    paid checkout plan adds its SKU with the device; a quote-only tier turns
    the main button into a quote request (js/app.js, initCoverChooser). */
function warrantyChooser(p) {
  const base = p.id.replace(/-scanner$/, '');
  const paid = paidTiers.filter((t) => t.prices && t.prices[base] !== undefined);
  if (!paid.length) return '';
  const standard = warrantyTier('standard');
  return `
          <fieldset class="protect" data-warranty-chooser>
            <legend>${eyebrow('Cover')}</legend>
            <label class="protect-opt">
              <input type="radio" name="warranty" value="" data-warranty-choice checked>
              <span class="protect-text"><strong>${esc(standard?.name || 'Standard warranty')}</strong>${esc(standard?.summary || '12 months against defects')}</span>
              <span class="protect-price">Included</span>
            </label>
            ${paid
              .map((t) => {
                if (!t.quoteOnly) {
                  return `
            <label class="protect-opt">
              <input type="radio" name="warranty" value="wty-${t.id}-${base}" data-warranty-choice>
              <span class="protect-text"><strong>${esc(t.name)}${t.recommended ? ' <span class="pick-tag">Recommended</span>' : ''}</strong>${esc(t.chooser || t.summary)}</span>
              <span class="protect-price">+${money(t.prices[base])}<small>per device</small></span>
            </label>`;
                }
                const b = careBands(t, base);
                return `
            <label class="protect-opt">
              <input type="radio" name="warranty" value="" data-warranty-choice data-quote-tier="${esc(t.name)}" data-quote-min="${b.min}" data-quote-note="${esc(`${t.name} is for business fleets of ${b.min} or more. ${careBandText(t, base)}`)}">
              <span class="protect-text"><strong>${esc(t.name)}</strong>${esc(t.chooser || t.summary)} ${esc(careBandText(t, base))} On a quote.</span>
              <span class="protect-price">from ${money(b.large)}<small>per device</small></span>
            </label>`;
              })
              .join('')}
            <a class="protect-link" href="/warranty">Compare the plans and read the terms</a>
          </fieldset>`;
}

/* ==========================================================================
   ORGANISATION SCHEMA — attached to every page via the home page + PDPs
   ========================================================================== */

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.origin}/#organization`,
  name: SITE.name,
  legalName: TRADER.legalName,
  url: SITE.origin,
  email: SITE.email,
  telephone: '+44 1279 912065',
  description: SITE.description,
  // Country only: the registered office appears on the legal pages, not in
  // structured data.
  address: {
    '@type': 'PostalAddress',
    addressCountry: TRADER.address.country,
  },
  identifier: {
    '@type': 'PropertyValue',
    propertyID: 'Companies House company number',
    value: TRADER.companyNumber,
  },
  areaServed: { '@type': 'Country', name: 'United Kingdom' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: SITE.email,
    telephone: '+44 1279 912065',
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
   COMPARE PAIRS — build/content/compare/<a>-vs-<b>.json

   One file per head-to-head page (/compare/<a>-vs-<b>). Every fact on those
   pages is generated from data/products.json; the JSON holds only the
   opinion: verdict, when to choose which, FAQ, which guides to read next.
   The list is read here, before the product pages, because each product
   page links to every pair it appears in. The pages themselves are written
   further down, after the blog, because "Read next" needs the posts.
   ========================================================================== */

const COMPARE_DIR = join(ROOT, 'build', 'content', 'compare');
const COMPARE_GROUPS = ['size', 'android', 'windows'];

/** Device name without the brand: "Tuga A8" -> "A8". */
const shortName = (p) => p.name.replace(/^Tuga\s+/, '');

/** Strip tags from a prose field, for places that take plain text. */
const plainText = (html) => String(html).replace(/<[^>]+>/g, '');

/**
 * Escape a prose field from a compare JSON, then let <strong> and
 * <a href="/..."> (or https://...) back through. Any other tag, or an <a>
 * with extra attributes, is a mistake in the content file, so throw rather
 * than ship it as visible angle brackets.
 */
function prose(text, where) {
  const out = esc(text)
    .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>')
    .replace(/&lt;a href=&quot;((?:\/|https:\/\/)[^&\s]*?)&quot;&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, '</a>');
  const stray = out.match(/&lt;\/?[a-zA-Z][^&]*&gt;/);
  if (stray) {
    const tag = stray[0].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    throw new Error(`${where}: only <strong> and <a href="/..."> are allowed in prose, found ${tag}`);
  }
  return out;
}

/** Read and validate one pair file. Throws with the file name and the fault. */
function readComparePair(file) {
  const where = `build/content/compare/${file}`;
  const fail = (msg) => {
    throw new Error(`${where}: ${msg}`);
  };

  let json;
  try {
    json = JSON.parse(readFileSync(join(COMPARE_DIR, file), 'utf8'));
  } catch (e) {
    fail(`not valid JSON (${e.message})`);
  }

  const known = devices.map((d) => d.slug).join(', ');
  const a = devices.find((d) => d.slug === json.a);
  const b = devices.find((d) => d.slug === json.b);
  if (!a) fail(`"a" must be a base device slug (${known}), got ${JSON.stringify(json.a)}`);
  if (!b) fail(`"b" must be a base device slug (${known}), got ${JSON.stringify(json.b)}`);
  if (a === b) fail(`"a" and "b" are both ${a.slug}`);
  if (a.order > b.order) {
    fail(
      `"a" must come before "b" in catalogue order, but ${a.slug} is ${a.order} and ${b.slug} is ${b.order}. ` +
        `Swap a and b, swap chooseA and chooseB, and rename the file ${b.slug}-vs-${a.slug}.json`
    );
  }
  const expected = `${a.slug}-vs-${b.slug}.json`;
  if (file !== expected) fail(`file name must match a and b: rename it ${expected}`);
  if (!COMPARE_GROUPS.includes(json.group)) {
    fail(`"group" must be one of ${COMPARE_GROUPS.join(', ')}, got ${JSON.stringify(json.group)}`);
  }

  for (const key of ['title', 'description', 'summary', 'lede']) {
    if (typeof json[key] !== 'string' || !json[key].trim()) fail(`"${key}" must be a non-empty string`);
  }
  for (const key of ['verdict', 'chooseA', 'chooseB', 'faq', 'guides']) {
    if (!Array.isArray(json[key]) || !json[key].length) fail(`"${key}" must be a non-empty array`);
  }
  for (const key of ['verdict', 'chooseA', 'chooseB', 'guides']) {
    if (!json[key].every((x) => typeof x === 'string' && x.trim())) fail(`every item in "${key}" must be a non-empty string`);
  }
  json.faq.forEach((f, i) => {
    if (!f || typeof f.q !== 'string' || !f.q.trim() || typeof f.a !== 'string' || !f.a.trim()) {
      fail(`faq[${i}] needs "q" and "a" strings`);
    }
  });
  json.guides.forEach((g) => {
    if (!/^\/blog\/[a-z0-9-]+$/.test(g)) fail(`"guides" must be /blog/<slug> paths, got ${JSON.stringify(g)}`);
  });

  if (json.title.length > 65) console.warn(`${where}: title is ${json.title.length} characters; keep it under about 65`);
  if (json.description.length < 140 || json.description.length > 160) {
    console.warn(`${where}: description is ${json.description.length} characters; aim for 140 to 160`);
  }

  const slug = `${a.slug}-vs-${b.slug}`;
  return { ...json, a, b, slug, path: `/compare/${slug}`, where, label: `${shortName(a)} vs ${shortName(b)}` };
}

const comparePairs = (existsSync(COMPARE_DIR) ? readdirSync(COMPARE_DIR) : [])
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map(readComparePair)
  // Neighbouring sizes first (A6 vs A8 before A6 vs A10), then catalogue order.
  .sort((x, y) => x.b.order - x.a.order - (y.b.order - y.a.order) || x.a.order - y.a.order);

/** Every pair a device appears in, for the "Head to head" line on its page. */
const pairsFor = (p) => comparePairs.filter((c) => c.a.id === p.id || c.b.id === p.id);

/** "Head to head: A8 vs A10 · A6 vs A8", or nothing when no pair exists yet. */
const compareLinks = (p) => {
  const pairs = pairsFor(p);
  if (!pairs.length) return '';
  return `
        <p class="compare-links">Head to head: ${pairs
          .map((c) => `<a href="${c.path}">${esc(c.label)}</a>`)
          .join(' &middot; ')}</p>`;
};

/* ==========================================================================
   HOME
   ========================================================================== */

const HOME_FAQ = [
  {
    q: 'Which size should I get: 6, 8 or 10 inch?',
    a: 'Six inch goes in a pocket and is right if you mostly scan barcodes, take photos, log jobs and stay in touch. Eight inch is the middle ground: big enough to fill in a form or follow a drawing, small enough for one hand and a van door pocket. Ten inch is for people who genuinely read drawings all day: blueprints, BIM viewers, full spreadsheets. If you are unsure, the 10.1 inch A10 is our pick for Android apps.',
  },
  {
    q: 'What is the difference between IP67, IP68 and IP69K?',
    a: 'All three mean fully dust tight. The second digit is water: IP67 survives 1 metre of immersion for 30 minutes, IP68 goes deeper and longer, and IP69K adds resistance to high pressure, high temperature jets, which matters if your kit gets jet washed rather than just rained on. For most UK trades IP67 is genuinely enough; IP68 is the margin you want if the device lives outdoors. None of our devices is rated IP69K, so do not jet wash them.',
  },
  {
    q: 'Do these actually survive being dropped?',
    a: 'Four of the six are tested to MIL-STD-810H or 810G, which includes repeated 1.2 to 1.5 metre drops onto plywood over concrete. That is a real standard rather than marketing language. The A6 is rated by its maker for 1.5 metre drops but has no MIL-STD rating, and the W10 has none either, so treat them with more care if they live on a scaffold. It does not make a device indestructible. It means the housing, corners and screen are engineered for the kind of drop that kills a consumer tablet.',
  },
  {
    q: 'Android or Windows?',
    a: 'Android if you are using apps: job management, forms, photos, maps, cloud tools. That covers most trades and it is cheaper. Windows only if you need actual desktop software that has no mobile version: diagnostic tools, legacy databases, GIS, CAD viewers or network drives. Windows devices cost roughly twice as much, so do not buy one unless a specific piece of software forces your hand.',
  },
  {
    q: 'How long does delivery take and what does it cost?',
    a: DELIVERY.summary,
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
    copy: 'Proof of delivery, route tracking and barcode scanning from the cab. A dash mount and a 12V car charger between drops.',
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
          <p class="hero-sub">Sealed, rugged tablets and handhelds for UK trades. Built for rain, dust, concrete and a twelve-hour shift, not for a desk.</p>
          <div class="hero-ctas">
            <a class="btn btn-inverse btn-lg" href="/products/">Browse the range</a>
            <a class="btn btn-outline-light btn-lg" href="/which-tuga">Help me choose</a>
          </div>
          <div class="hero-specs">
            <div class="hero-spec">
              <span class="hero-spec-value">IP65+</span>
              <span class="hero-spec-label">Every model sealed</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">810H</span>
              <span class="hero-spec-label">Most models drop tested</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">10,000<span style="font-size:0.5em">mAh</span></span>
              <span class="hero-spec-label">Max battery</span>
            </div>
            <div class="hero-spec">
              <span class="hero-spec-value">${money(Math.min(...devices.map((d) => d.price)))}</span>
              <span class="hero-spec-label">From</span>
            </div>
          </div>
        </div>
        <figure class="hero-drawing">
          <img src="${imgPath(lead, 2)}" alt="Dimensioned drawing of the Tuga A8 showing ports, buttons and case dimensions" width="800" height="288" fetchpriority="high">
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
  lede: 'Three Android devices, one for each size. Size makes the biggest difference day to day, so start there and let the specifications follow. Every size also comes in a Windows version, <a href="#windows">further down the page</a>.',
})}
${sizeLadder(androidRange)}
      </div>
    </section>

    <section class="section section-deep" id="windows">
      <div class="container">
${sectionHead({
  tag: 'Windows range',
  title: 'The same three sizes, running full Windows 11',
  lede: 'Buy these only if a specific piece of desktop software forces your hand: diagnostic tools, legacy databases, GIS, CAD viewers or a network drive. They cost noticeably more than the Android models, and for most trades Android does the job.',
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
  lede: 'Six devices, three sizes, two operating systems. Buy one online at the price shown, or ask for a business quote and pay by bank transfer.',
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
            <img src="${versioned('/img/blog/blog-waterproof.webp')}"${responsive('/img/blog/blog-waterproof.webp', '(max-width: 820px) 92vw, 556px')} alt="Rugged tablet being used in wet conditions" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Sealed against dust and water</h3>
            <p>Every device is rated at least IP65: fully dust tight and protected against water jets from any direction. Most go further. An IP67 or IP68 rating means the housing survives immersion, not just a light shower, which is the difference between a tablet that survives a downpour and one that survives being dropped in a puddle. None is rated IP69K for high pressure jet washing, so wipe them down rather than hose them.</p>
            <ul class="editorial-list">
              <li>Gasket-sealed ports and a sealed speaker membrane</li>
              <li>Touchscreen calibrated to work with wet fingers and gloves</li>
              <li>Android models rated from &minus;20&deg;C, so they start on a frosty morning</li>
            </ul>
          </div>
        </article>

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="${versioned('/img/blog/blog-construction.webp')}"${responsive('/img/blog/blog-construction.webp', '(max-width: 820px) 92vw, 556px')} alt="Rugged tablet in use on a construction site" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Drop tested to a real standard</h3>
            <p>Four of the six devices carry a MIL-STD-810H or 810G rating; the A6 and the W10 do not, though the A6 is rated by its maker for 1.5 metre drops. MIL-STD-810H is a published military test method, not a marketing phrase. The drop procedure means repeated falls from 1.2 to 1.5 metres onto plywood over concrete, across every face and corner, with the device still functioning afterwards.</p>
            <p>In practice that comes from reinforced corners, a rubberised over-mould and a screen recessed behind a raised bezel, so the glass does not take the first hit when it lands face down.</p>
          </div>
        </article>

        <article class="editorial reveal">
          <div class="editorial-media">
            <img src="${versioned('/img/blog/blog-field-engineer.webp')}"${responsive('/img/blog/blog-field-engineer.webp', '(max-width: 820px) 92vw, 556px')} alt="Field engineer using a rugged tablet outdoors" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            <h3>Screens you can read outside, batteries that last the shift</h3>
            <p>A standard tablet runs about 400 nits, which washes out the moment you step outdoors. The A8 runs 800 nits, so you are not cupping a hand over the screen to read a job number. The A10 is 350 nits, which suits drawings indoors and in the van more than bright sun. Each product page lists the maker's figure.</p>
            <p>The A8 and A10 tablets carry 8,000mAh to 10,000mAh, against roughly 5,000mAh in a typical phone. There is nothing clever about it; there is simply room inside a rugged body for a much larger cell. The A6 handheld is phone sized at 5,050mAh, but its battery is removable, so a charged spare takes over mid shift. Real run time depends on screen brightness and signal, so treat the capacity as a comparison, not a promise of hours.</p>
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
            <p>No minimum order and no enterprise licensing. Free UK delivery on everything, team discounts applied automatically at checkout, and a quote with a proforma invoice for any business that wants to pay by bank transfer.</p>
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
      'Rugged Android and Windows tablets built for UK tradespeople. IP65 to IP68 sealed, most models drop tested to MIL-STD-810H or 810G. From £349 with free UK delivery.',
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
      'The full Tuga range: 6, 8 and 10 inch rugged tablets and handhelds in Android and Windows. IP65 to IP68 sealed, most drop tested to MIL-STD-810H or 810G, free UK delivery and 30-day returns.',
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
        <p class="lede">Six devices across three sizes. Android for app-based work, Windows where desktop software forces it. Every one is sealed to at least IP65 and delivered free, and all but the A6 and W10 are drop tested to MIL-STD-810H or 810G. Not sure which? <a class="link-arrow" href="/which-tuga">Answer four questions</a></p>
      </div>
    </section>

${trustStrip()}

    <section class="section">
      <div class="container">
        <div class="filters" role="group" aria-label="Filter by operating system">
          <button class="filter-btn is-active" data-filter="all" aria-pressed="true">All devices</button>
          <button class="filter-btn" data-filter="android" aria-pressed="false">Android</button>
          <button class="filter-btn" data-filter="windows" aria-pressed="false">Windows</button>
        </div>
        <h2 class="sr-only">All devices</h2>
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
        <p class="compare-links" style="margin-top:var(--space-m)">Comparing two? <a href="/compare/">See the head to head pages</a>: a verdict, every specification side by side and the price gap.</p>
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

/* ==========================================================================
   VERIFIED REVIEWS — data/reviews.json (filled by build/pull-reviews.mjs)

   Only reviews with status "published" are shown. A review counts for every
   device in its order; scanner variants count for their base device.
   ========================================================================== */

const reviewData = JSON.parse(readFileSync(join(ROOT, 'data', 'reviews.json'), 'utf8'));

const baseIdForName = (name) => {
  const p = data.products.find((x) => x.name === name);
  if (!p) return null;
  return p.isVariant ? p.variantOf : p.id;
};

const reviewsFor = (p) =>
  reviewData.reviews.filter(
    (r) => r.status === 'published' && (r.items || []).some((n) => baseIdForName(n) === p.id)
  );

const stars = (n) =>
  `<span class="review-stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span aria-hidden="true">${'★'.repeat(5 - n)}</span></span>`;

const reviewMonth = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function reviewSection(p, list) {
  if (!list.length) return '';
  const avg = list.reduce((t, r) => t + r.rating, 0) / list.length;
  return `
      <section class="pdp-section" id="reviews">
        ${eyebrow('Verified buyers')}
        <h2 class="title-sm" style="margin-bottom:1rem">What buyers say about the ${esc(p.name)}</h2>
        <p class="review-summary">${stars(Math.round(avg))} <strong>${avg.toFixed(1)} out of 5</strong> from ${list.length} verified ${list.length === 1 ? 'review' : 'reviews'}. We publish every genuine review, good or bad.</p>
        <div class="review-list">
          ${list
            .map(
              (r) => `
          <article class="review-card">
            ${stars(r.rating)}
            ${r.title ? `<h3>${esc(r.title)}</h3>` : ''}
            ${r.body ? `<p>${esc(r.body)}</p>` : ''}
            <p class="review-meta">${esc(r.displayName)}${r.trade ? `, ${esc(r.trade)}` : ''} / ${reviewMonth(r.createdAt)}${r.verifiedPurchase ? ' / Verified purchase' : ''}</p>
          </article>`
            )
            .join('')}
        </div>
      </section>`;
}

function productPage(p) {
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Tablets', href: '/products/' },
    { label: p.name },
  ];

  const variants = variantsOf(p.id);
  const related = devices.filter((d) => d.id !== p.id).slice(0, 3);
  const compatible = accessories.filter((a) => a.compatibleWith.includes(p.id));
  const reviews = reviewsFor(p);

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
      availability: SALES_PAUSED ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
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
        // Matches DELIVERY.days: 7 to 10 working days in total.
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 6, maxValue: 7, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'GB',
        returnPolicyCategory:
          'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
    },
    ...(reviews.length
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (reviews.reduce((t, r) => t + r.rating, 0) / reviews.length).toFixed(1),
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 10).map((r) => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            author: { '@type': 'Person', name: r.displayName },
            datePublished: (r.createdAt || '').slice(0, 10),
            ...(r.title ? { name: r.title } : {}),
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
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
            <img id="gallery-image" src="${imgPath(p, 1)}"${responsive(imgPath(p, 1), '(max-width: 820px) 92vw, 560px')} alt="${esc(p.name)} rugged ${p.formFactor}" width="1200" height="900" fetchpriority="high">
          </div>
          ${p.images.length > 1 ? `<div class="gallery-thumbs" role="group" aria-label="Product images">
            ${p.images
              .map(
                (_, i) => `
            <button type="button" class="gallery-thumb${i === 0 ? ' is-active' : ''}" aria-pressed="${i === 0}" data-gallery-src="${imgPath(p, i + 1)}" data-gallery-srcset="${(responsive(imgPath(p, i + 1), 'x').match(/srcset="([^"]*)"/) || [])[1] || ''}" aria-label="View image ${i + 1}">
              <img src="${imgPath(p, i + 1)}"${responsive(imgPath(p, i + 1), '74px')} alt="" width="150" height="150" loading="lazy">
            </button>`
              )
              .join('')}
          </div>` : ''}
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

        <div class="buy-panel" data-buy-box>
          <p class="pdp-kicker">${p.formFactor === 'handheld' ? 'Rugged handheld' : 'Rugged tablet'} / ${esc(p.sizeLabel)}&Prime; / ${esc(p.specs.os)}${p.badge ? ` <span class="pick-tag">${esc(p.badge)}</span>` : ''}</p>
          <h1 class="pdp-title">${esc(p.name)}</h1>
          <p class="pdp-tagline">${esc(p.tagline)}</p>

          <div class="pdp-price-row">
            <span class="pdp-price">${money(p.price)}</span>
            ${p.compareAtPrice ? `<span class="pdp-price-was">${money(p.compareAtPrice)}</span>` : ''}
            <span class="pdp-price-note">${esc(PRICE_NOTE)}. ${esc(DELIVERY.short)}</span>
          </div>

          <p class="pdp-desc">${esc(p.longDescription)}</p>

          ${
            SALES_PAUSED
              ? `<div class="buy-row">
            <p class="pdp-paused" role="status">${esc(SALES_PAUSED_MESSAGE)}</p>
            <a class="btn btn-primary btn-lg" href="${quoteUrl(p.name)}">Ask about availability</a>
          </div>`
              : `${warrantyChooser(p)}
          <div class="buy-row">
            <div class="qty">
              <button type="button" data-qty-step="-1" aria-label="Decrease quantity">&minus;</button>
              <input type="number" id="qty" value="1" min="1" max="99" aria-label="Quantity">
              <button type="button" data-qty-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn-primary btn-lg" data-add-to-cart="${p.id}" data-qty-source="qty" data-device-name="${esc(p.name)}" aria-describedby="cover-note">
              <span class="buy-icon" aria-hidden="true">${icons.cart(18)}</span><span class="buy-icon buy-icon-quote" aria-hidden="true">${icons.chat(18)}</span> <span data-buy-label>Add to basket</span>
            </button>
          </div>
          <p class="cover-note" id="cover-note" aria-live="polite" data-cover-note></p>
          <p class="pdp-quote">Buying for a business? <a href="${quoteUrl(p.name)}">Get a quote and pay by bank transfer</a>. Trial units welcome.</p>`
          }

          <div class="pdp-assurance">
            <div>${icons.truck(16)}<span>${esc(DELIVERY.short)}</span></div>
            <div>${icons.shieldCheck(16)}<span><a href="/warranty">${has3yr(p) ? '12-month warranty, 3-year option' : '12-month warranty'}</a></span></div>
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
            ${SALES_PAUSED ? '' : `<button class="btn btn-sm btn-copper" data-add-to-cart="${v.id}">Add to basket</button>`}
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

${reviewSection(p, reviews)}

      <section class="pdp-section">
        ${eyebrow('Compare')}
        <h2 class="title-sm" style="margin-bottom:2rem">How it sits in the range</h2>${compareLinks(p)}
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
        <h2 class="sr-only">All accessories</h2>
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
    a: 'Yes, for any business order, including a single trial unit. Ask for a quote with what you need and your company billing and delivery addresses, and we will send a proforma invoice for bank transfer. We can also complete your supplier setup forms. If you buy regularly, <a href="/trade">apply for a trade account</a> to order on invoice.',
  },
  {
    q: 'Do bulk orders still get the warranty and returns?',
    a: 'Yes. The same 12-month warranty and 30-day returns apply to every unit regardless of order size. Business fleets of five or more devices, on any model, can ask for a Total Care quote: a swap unit dispatched the same working day for claims accepted by 14:00. See the <a href="/warranty">warranty page</a>.',
  },
];

const bulkFaq = faq(BULK_FAQ, { heading: 'Bulk order questions', tag: 'FAQ' });

write(
  'bulk.html',
  page({
    title: 'Bulk Orders & Team Discounts | Tuga Hardware',
    description:
      'Automatic team discounts on rugged tablets: 3% at 2 units, 5% at 3-4, 8% at 5-9 and 10% at 10+. No codes, free UK delivery, and business quotes with proforma invoices.',
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
              <div><span class="stat-label">Total</span><strong data-calc-total>£0</strong></div>
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
            <img src="${imgPath(devices.find((d) => d.id === 'tuga-a10'), 1)}"${responsive(imgPath(devices.find((d) => d.id === 'tuga-a10'), 1), '(max-width: 820px) 92vw, 556px')} alt="Tuga A10 rugged tablet" loading="lazy" width="800" height="600">
          </div>
          <div class="editorial-body">
            ${eyebrow('How it works')}
            <h3>Three steps, no forms</h3>
            <ul class="editorial-list">
              <li>Add the devices your team needs to the basket, mixing and matching any models</li>
              <li>The tier is calculated on the total number of devices and applied at checkout</li>
              <li>Everything ships free, with the same warranty and returns as a single unit</li>
            </ul>
            <p style="margin-top:1.5rem">Prefer to pay by bank transfer, or want one unit to trial before the rest? Ask for a quote and we will send a proforma invoice and complete your supplier forms. Buying regularly? <a href="/trade">Apply for a trade account</a> to order on invoice.</p>
            <div style="margin-top:2rem">
              <a class="btn btn-primary" href="/products/">Start an order</a>
              <a class="btn btn-outline" href="/contact?quote=#enquiry" style="margin-left:0.5rem">Get a business quote</a>
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
  lede: 'Our pick for most teams is the 10.1 inch Android A10, with the W10 for anyone whose software only runs on Windows. The 6 inch A6, with its built-in barcode scanner, suits people who need a device in a pocket more than a screen for drawings.',
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
    scanner: Boolean(base.specs.scanner),
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
            <div class="picker-nav">
              <button type="button" class="btn btn-primary btn-sm" data-picker-next disabled>${n === 4 ? 'See my pick' : 'Next'}</button>
              ${n > 1 ? '<button type="button" class="picker-back" data-picker-back>&larr; Back</button>' : ''}
            </div>
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
${pickerStep(1, 'os', 'What does it need to run?', 'If every tool you use has an app, Android does the job for noticeably less.', [
  { value: 'android', title: 'Apps', text: 'Job sheets, forms, photos, maps, email, cloud tools.' },
  { value: 'windows', title: 'Windows software', text: 'Desktop programs with no app version: diagnostics, GIS, CAD viewers, network drives.' },
  { value: 'unsure', title: 'Not sure', text: 'We will assume apps. You can always ask us before buying.' },
])}
${pickerStep(2, 'size', 'Where does it live during the day?', null, [
  { value: '6', title: 'Pocket or belt', text: 'Scanning, photos, sign-off, comms. Out of the way until you need it.' },
  { value: '8', title: 'One hand, van door pocket', text: 'Forms and drawings at a readable size, still small enough for one hand.' },
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
    q: 'Do you charge VAT?',
    a: `No. ${TRADER.legalName} is not VAT registered, so no VAT is charged and there is none to reclaim: the price on the site is the total. Every order comes with an invoice for your records.`,
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
      'Open a Tuga Hardware trade account: order rugged tablets on invoice and pay by bank transfer. No VAT to add. For UK businesses and sole traders.',
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
              <li>An invoice for every order, and no VAT to add</li>
              <li>The same automatic team discounts, up to 10% at ten devices</li>
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

const warrantyTrail = [{ label: 'Home', href: '/' }, { label: 'Warranty', href: '/warranty' }, { label: 'Register your device' }];

write(
  'register-warranty.html',
  page({
    title: 'Register Your Warranty | Tuga Hardware',
    description:
      'Register your Tuga rugged tablet or handheld against its serial number, so a warranty claim takes one email instead of a search for the receipt.',
    path: '/register-warranty',
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
          <p class="form-note">We read every review. We may publish it on the site, good or bad, marked as a verified purchase, and we never publish reviews that are abusive or not about the product.</p>
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
        <h1>The gap between a four-figure enterprise tablet and a cracked consumer one</h1>
        <p class="lede">That gap is where we sit, and it is why the company exists.</p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          <p>If you work on site, you have two obvious options and neither is good. You can buy an enterprise rugged tablet from a traditional supplier, sign a support contract, wait for a quote, and pay somewhere between £1,500 and £3,000 for hardware whose specification does not remotely justify the price. Or you can buy a consumer tablet, put a thick case on it, and replace it every few months when the screen goes or the charging port fills with dust.</p>

          <p>The first option is priced for fleet buyers with procurement departments. The second is not built for the work. Most UK tradespeople are neither, so they end up paying too much or buying twice.</p>

          <h2>What we actually do</h2>

          <p>We select rugged devices that hit a genuine standard (a published IP rating, a real MIL-STD drop test method where the device has one, a battery measured in mAh rather than adjectives) and sell them direct at a price with one margin on it instead of four. There is no configurator and no minimum order. The price on the page is the price you pay, delivery is free, and businesses can ask for a quote and pay by bank transfer.</p>

          <p>We are deliberately narrow. Six devices, three sizes, two operating systems. It is easier to know six products properly than to list six hundred and know none of them.</p>

          <h2>What we will not do</h2>

          <p>We do not publish invented durability scores or made-up review counts. Every claim on this site is a specification you can check against the manufacturer's own documentation, and where a device is rated IP67 rather than IP68 we say so rather than rounding up.</p>

          <p>We also will not sell you the expensive one by default. Windows devices cost noticeably more than the Android ones, and most trades genuinely do not need them. If you email us and the honest answer is the cheapest device in the range, that is the answer you will get.</p>

          <h2>Based in the UK</h2>

          <p>Prices are in pounds and there is no VAT to add: ${esc(TRADER.legalName)} is not VAT registered, so the price on the page is the total. Delivery is free across the UK. Support is a UK email address answered by someone who has handled the hardware, not a ticket queue in another timezone. If something goes wrong inside the 12-month warranty, we sort it out.</p>

          <h2>Still early</h2>

          <p>${esc(TRADER_STATEMENT)}</p>

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
            <h2 class="title-xs">Email us directly</h2>
            <p style="margin-top:0.75rem"><a class="link-arrow" href="mailto:${SITE.email}">${SITE.email}</a></p>
            <p style="margin-top:1.5rem">We answer within one working day, usually much sooner. For order questions, include your order number and we will pull it up.</p>

            <h2 class="title-xs" style="margin-top:2.5rem">Or call us</h2>
            <p style="margin-top:0.75rem"><a class="link-arrow" href="${SITE.phoneHref}">${SITE.phone}</a></p>
            <h2 class="title-xs" style="margin-top:2.5rem">Who you are dealing with</h2>
            <p style="margin-top:0.75rem">${esc(TRADER.tradingName)} is a trading name of ${esc(TRADER.legalName)}, registered in ${esc(TRADER.registeredIn)}, company number ${esc(TRADER.companyNumber)}.</p>
            <p>Registered office: ${esc(TRADER_ADDRESS_LINE)}.</p>
            <p>${esc(TRADER.legalName)} is not VAT registered, so no VAT is charged.</p>

            <h2 class="title-xs" style="margin-top:2.5rem">What we can help with</h2>
            <ul class="editorial-list">
              <li>Which of the three sizes suits your trade</li>
              <li>Whether you genuinely need Windows or Android will do</li>
              <li>Bulk pricing, proforma invoices and fleet rollouts</li>
              <li>Warranty claims, returns and existing orders</li>
              <li>Accessory compatibility and vehicle mounting</li>
            </ul>
          </div>

          <div>
            <form class="form" id="enquiry" data-contact-form novalidate>
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
                  <option>${esc(QUOTE_TOPIC)}</option>
                  <option>Choosing a device</option>
                  <option>Bulk or fleet order</option>
                  <option>An existing order</option>
                  <option>Warranty or return</option>
                  <option>Something else</option>
                </select>
              </div>
              <div class="field">
                <label for="company">Company <span class="field-optional">(optional)</span></label>
                <input type="text" id="company" name="company" autocomplete="organization">
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
    title: 'Your Order | Tuga Hardware',
    description: 'Your Tuga Hardware order reference and confirmation status.',
    path: '/order-confirmation',
    noindex: true,
    schema: [],
    body: `
    <section class="section">
      <div class="container-narrow" style="text-align:center">
        <div class="feature-icon" style="margin:0 auto 1.5rem; width:3.5rem; height:3.5rem">${icons.check(28)}</div>
        <h1 class="title-lg" data-order-title>Checking your order</h1>
        <p class="lede" style="margin-inline:auto" data-order-lede>Checking your order...</p>
        <noscript><p class="lede" style="margin-inline:auto">If you have just paid, check your email for your receipt or contact <a href="mailto:support@tugahardware.com">support@tugahardware.com</a> with your name and the time you paid.</p></noscript>
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
   404 — src/worker.js serves this with status 404 for any unknown path
   ========================================================================== */

write(
  '404.html',
  page({
    title: 'Page Not Found | Tuga Hardware',
    description: 'We could not find that page. Browse the range, see which apps the tablets run, or get in touch.',
    path: '/404',
    noindex: true,
    schema: [],
    body: `
    <section class="section">
      <div class="container-narrow" style="text-align:center">
        <h1 class="title-lg">We could not find that page</h1>
        <p class="lede" style="margin-inline:auto">The link may be old, or the address mistyped. These will get you back on track.</p>
        <div style="margin-top:2.5rem; display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap">
          <a class="btn btn-primary" href="/products/">Browse the range</a>
          <a class="btn btn-outline" href="/works-with/">Works with your apps</a>
          <a class="btn btn-outline" href="/contact">Contact us</a>
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

/* ==========================================================================
   WARRANTY PAGE + PLAN TERMS
   ========================================================================== */

const planTerms = JSON.parse(readFileSync(join(ROOT, 'build', 'content', 'warranty-terms.json'), 'utf8'));
const warrantyDevices = devices.filter((d) => paidTiers.some((t) => t.prices?.[d.id] !== undefined));
const clauseText = (c) => c.replace(/^(\d+)\.\s+/, '');
const clauseNumber = (c) => (c.match(/^(\d+)\./) || [])[1];

{
  const trail = [{ label: 'Home', href: '/' }, { label: 'Warranty' }];
  const faqBlock = faq(warrantyCopy.faq, { heading: 'Warranty questions', tag: 'Questions' });
  const careTier = warrantyTier('care');
  const tierCard = (t) => {
    const points = warrantyCopy.tier_points[t.id] || [];
    const featured = t.id === 'care';
    const kicker = t.included ? 'Included' : t.minUnits ? `Business fleets of ${t.minUnits}+` : t.recommended ? 'Recommended' : 'Add-on';
    return `
          <article class="tier${featured ? ' tier-featured' : ''}${t.included ? ' tier-standard' : ''}${t.recommended ? ' tier-recommended' : ''} reveal">
            <p class="tier-kicker">${esc(kicker)}</p>
            <h2>${esc(t.name)}</h2>
            <p class="tier-price">${t.included ? 'With every device' : `From ${money(fromPrice(t))} <small>per device${t.smallFleet ? `, ${t.smallFleet.maxUnits + 1}+ devices; ${money(t.smallFleet.surcharge)} more at ${t.minUnits} to ${t.smallFleet.maxUnits}` : ''}</small>`}</p>
            <p class="tier-summary">${esc(warrantyCopy.taglines?.[t.id] || t.summary)}</p>
            <details class="tier-more">
              <summary>What's covered <span>${points.length} points</span></summary>
              <ul class="tier-points">
                ${points.map((x) => `<li>${esc(x)}</li>`).join('\n                ')}
              </ul>
            </details>
            ${
              t.quoteOnly
                ? `<p class="tier-cta"><a class="btn btn-inverse" href="${quoteUrl(t.name)}">Ask for a fleet quote</a></p>`
                : t.included
                  ? ''
                  : `<p class="tier-cta"><a class="btn btn-primary" href="/products/">Add it on any device page</a></p>`
            }
          </article>`;
  };

  write(
    'warranty.html',
    page({
      title: `${warrantyCopy.title} | Tuga Hardware`,
      description: warrantyCopy.meta_description,
      path: '/warranty',
      schema: [orgSchema, breadcrumbSchema(trail), faqBlock.schema],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(trail)}
        ${eyebrow('Warranty')}
        <h1>${esc(warrantyCopy.h1)}</h1>
        <p class="lede">${esc(warrantyCopy.lede)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="tier-grid">
          ${warranty.tiers.map(tierCard).join('')}
        </div>
        <aside class="callout" style="margin-top:var(--space-l)"><strong>Accidental damage.</strong> ${esc(warrantyCopy.care_note)}</aside>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container-narrow">
        <div class="prose">
          ${(warrantyCopy.intro || []).map((p) => `<p>${esc(p)}</p>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
${sectionHead({ tag: 'Prices', title: 'What each plan costs, per device', lede: 'The amounts payable today. Destello Tech Ltd is not VAT registered. Plans are never discounted and do not count toward the device discount tiers.' })}
        <div class="compare-wrap reveal">
          <table class="compare-table">
            <caption class="sr-only">Plan prices per device</caption>
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Device price</th>
                ${paidTiers.map((t) => `<th scope="col">${esc(t.name)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${warrantyDevices
                .map(
                  (d) => `
              <tr>
                <td><a href="${productUrl(d)}">${esc(d.name)}</a></td>
                <td class="cell-mono">${money(d.price)}</td>
                ${paidTiers
                  .map((t) =>
                    t.prices?.[d.id] !== undefined
                      ? `<td class="cell-price">${money(t.prices[d.id])}${t.quoteOnly ? `<small class="cell-note">${t.smallFleet ? `${t.smallFleet.maxUnits + 1}+ devices; ${money(careBands(t, d.id).small)} at ${t.minUnits} to ${t.smallFleet.maxUnits}` : `fleets of ${t.minUnits}+`}, on quote</small>` : ''}</td>`
                      : `<td class="cell-mono">Not offered</td>`
                  )
                  .join('')}
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
        ${careTier ? `<p class="disclaimer" style="margin-top:1rem">${esc(careTier.name)} is bought on a quote and proforma invoice for business fleets of ${careTier.minUnits} or more devices on any model, sole traders included${careTier.smallFleet ? `; fleets of ${careTier.minUnits} to ${careTier.smallFleet.maxUnits} devices pay ${money(careTier.smallFleet.surcharge)} more per device than the ${careTier.smallFleet.maxUnits + 1}+ prices shown` : ''}.</p>` : ''}
      </div>
    </section>

    <section class="section section-tint">
      <div class="container">
${sectionHead({ tag: 'Side by side', title: 'What each plan does', lede: 'Every line in the paid columns has a numbered clause in the Plan Terms.' })}
        <div class="compare-wrap reveal">
          <table class="compare-table compare-table-wrap">
            <caption class="sr-only">Comparison of the three cover levels</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">Standard</th>
                <th scope="col">3-Year Warranty</th>
                <th scope="col">Total Care</th>
              </tr>
            </thead>
            <tbody>
              ${warrantyCopy.comparison_rows
                .map(
                  (r) => `
              <tr>
                <th scope="row">${esc(r.label)}</th>
                <td>${esc(r.standard)}</td>
                <td>${esc(r.three_year)}</td>
                <td>${esc(r.total_care)}</td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        ${eyebrow('Claims')}
        <h2 class="title-md">How a claim works</h2>
        <ol class="step-list step-list-long">
          ${warrantyCopy.claim_steps
            .map((s) => {
              // Each step opens with a short title sentence: lift it out as a heading.
              const [, head, rest] = clauseText(s).match(/^([^.]{1,60}\.)\s*([\s\S]*)$/) || [, '', clauseText(s)];
              return `<li>${head ? `<strong>${esc(head.slice(0, -1))}</strong>` : ''}<span>${esc(rest)}</span></li>`;
            })
            .join('\n          ')}
        </ol>
      </div>
    </section>

${faqBlock.html}

    <section class="section section-tint">
      <div class="container-narrow">
        ${eyebrow('Information for consumers')}
        <h2 class="title-sm">If you are buying for yourself rather than a business</h2>
        <p class="consumer-info">${esc(warrantyCopy.consumer_info)}</p>
        <p class="disclaimer" style="margin-top:1.25rem">The full terms are the <a href="/warranty-terms">Plan Terms</a>, which also set out the standard warranty in clauses 44 to 49, and our <a href="/terms#warranty">Terms and Conditions</a>. Nothing on this page replaces them, and nothing in them is different from this page.</p>
      </div>
    </section>

${ctaBanner({
  title: 'Add it on the device page, or put it on the quote.',
  text: 'Choose the 3-Year Warranty, or ask for Total Care, under Cover on any device page. Business buyers can ask for either plan line by line on a proforma.',
  primary: { href: '/products/', label: 'Browse the range' },
  secondary: { href: quoteUrl('Total Care'), label: 'Ask for a fleet quote' },
})}
`,
    })
  );

  const termsTrail = [{ label: 'Home', href: '/' }, { label: 'Warranty', href: '/warranty' }, { label: 'Plan Terms' }];
  write(
    'warranty-terms.html',
    page({
      title: `${planTerms.title} | Tuga Hardware`,
      description: 'The numbered terms of the Tuga 3-Year Warranty, Tuga Total Care and the standard 12-month warranty.',
      path: '/warranty-terms',
      schema: [orgSchema, breadcrumbSchema(termsTrail)],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(termsTrail)}
        ${eyebrow('Plan Terms')}
        <h1>${esc(planTerms.title)}</h1>
        <p class="lede">${esc(planTerms.intro)}</p>
        <p class="post-meta"><span>Last updated: ${esc(planTerms.last_updated)}</span></p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <div class="prose clauses">
          ${planTerms.clauses
            .map((c) => {
              const n = clauseNumber(c);
              return n
                ? `<p id="clause-${n}"><strong>${n}.</strong> ${esc(clauseText(c))}</p>`
                : `<p id="schedule-1"><strong>${esc(c.split('.')[0])}.</strong> ${esc(c.slice(c.indexOf('.') + 1).trim())}</p>`;
            })
            .join('\n          ')}
        </div>
        <p class="disclaimer" style="margin-top:2rem">See also our <a href="/terms">Terms and Conditions</a>, <a href="/warranty">warranty page</a> and <a href="/shipping-returns">shipping and returns</a>.</p>
      </div>
    </section>
`,
    })
  );
}

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
      'Free UK delivery in 7 to 10 working days and 30-day returns on every Tuga Hardware order.',
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
  // Placeholders reusing existing heroes until dedicated photos are sourced.
  'mil-std-810h-explained': 'blog-construction.webp',
  'android-vs-windows-rugged-tablet': 'blog-field-engineer.webp',
  'rugged-tablet-barcode-scanner': 'blog-enterprise.webp',
  'rugged-tablet-cold-weather-battery': 'blog-waterproof.webp',
  'best-rugged-tablets-electricians': 'blog-tradespeople.webp',
  'best-rugged-tablets-plumbers-heating-engineers': 'blog-tradespeople.webp',
  'rugged-phone-or-rugged-tablet': 'blog-field-engineer.webp',
  '8-inch-or-10-inch-rugged-tablet': 'blog-construction.webp',
  'screen-brightness-nits-explained': 'blog-construction.webp',
  'mounting-a-tablet-in-a-van': 'blog-field-engineer.webp',
  '4g-5g-or-wifi-only-site-connectivity': 'blog-field-engineer.webp',
  'protect-customer-data-work-tablet': 'blog-enterprise.webp',
  'best-rugged-tablets-delivery-drivers-couriers': 'blog-tradespeople.webp',
  'how-long-should-a-rugged-tablet-last': 'blog-cost.webp',
  'best-rugged-tablets-landscapers-gardeners': 'blog-waterproof.webp',
  'going-paperless-tradesperson-guide': 'blog-tradespeople.webp',
  'buying-rugged-tablets-small-team': 'blog-enterprise.webp',
};

/** Read a blog fragment from build/content/blog/. */
function readPost(file) {
  const slug = file.replace(/\.html$/, '');
  // Normalise CRLF: Windows checkouts (core.autocrlf) otherwise break the
  // meta block regexes and every field silently comes back empty.
  const raw = readFileSync(join(ROOT, 'build', 'content', 'blog', file), 'utf8')
    .replace(/\r\n/g, '\n');

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
        <img src="${versioned(post.image)}"${responsive(post.image, '(max-width: 820px) 94vw, 780px')} alt="" loading="eager" fetchpriority="high" width="1200" height="514">
      </div>

      <article class="prose">
${post.body}

        <div class="prose-cta">
          <h3>Rugged tablets from ${money(Math.min(...devices.map((d) => d.price)))}</h3>
          <p>IP65 to IP68 sealed, most models MIL-STD drop tested. Free UK delivery, 30-day returns and a 12-month warranty on every device.</p>
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
   COMPARE — /compare/ and one head-to-head page per pair

   The pair list (comparePairs) is read and validated near the top of this
   file. Everything factual below is computed from data/products.json: the
   difference bullets, the spec table, the scanner variants and the
   accessories. Only the verdict, the choose lists, the FAQ and the guide
   picks come from the JSON.
   ========================================================================== */

const compareTrail = [{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare/' }];

const compareCta = () =>
  ctaBanner({
    title: 'Still torn?',
    text: 'Tell us what you do and we will say which one we would buy for it, including if that is the cheaper one.',
    primary: { href: '/which-tuga', label: 'Answer four questions' },
    secondary: { href: '/contact', label: 'Ask us' },
  });

/** First number in a spec string: "10000mAh" -> 10000, "1,197g" -> 1197. */
const specNumber = (s) => {
  const m = String(s ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** "1920 x 1200" -> 2304000, to say which screen is sharper. */
const pixels = (s) => {
  const m = String(s ?? '').match(/(\d+)\s*[x×]\s*(\d+)/i);
  return m ? Number(m[1]) * Number(m[2]) : null;
};

/** "IP rating" stays as is mid-sentence; "Memory" becomes "memory". */
const lowerLabel = (label) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/**
 * The headline differences in plain English, one sentence each, computed
 * from the two spec sheets. A value missing on either side is reported as
 * missing rather than guessed. Returns plain text; the caller escapes it.
 */
function compareDiffs(a, b) {
  const A = shortName(a);
  const B = shortName(b);
  const lines = [];

  const notListed = (label, va, vb) =>
    !va && !vb
      ? `${label} is not listed for the ${A} or the ${B}.`
      : va
        ? `${label} is not listed for the ${B}; the ${A} lists ${va}.`
        : `${label} is not listed for the ${A}; the ${B} lists ${vb}.`;

  /** A spec both sides state as a number: say which side has more (or less). */
  const numeric = (key, { parse = specNumber, higherWins, equal, wins }) => {
    const va = a.specs[key];
    const vb = b.specs[key];
    if (!va || !vb) return lines.push(notListed(specLabel(key), va, vb));
    const na = parse(va);
    const nb = parse(vb);
    if (na === null || nb === null) return lines.push(`${specLabel(key)}: ${va} on the ${A} vs ${vb} on the ${B}.`);
    if (na === nb) return lines.push(equal(va));
    const aWins = higherWins ? na > nb : na < nb;
    const [w, wv, l, lv] = aWins ? [A, va, B, vb] : [B, vb, A, va];
    return lines.push(wins(w, wv, l, lv, Math.abs(na - nb)));
  };

  /** A spec compared as text: the same, or both values stated. */
  const text = (key, { equal, differ }) => {
    const va = a.specs[key];
    const vb = b.specs[key];
    if (!va || !vb) return lines.push(notListed(specLabel(key), va, vb));
    return lines.push(va === vb ? equal(va) : differ(va, vb));
  };

  if (a.price === b.price) lines.push(`Both cost ${money(a.price)}.`);
  else {
    const [dear, cheap] = a.price > b.price ? [a, b] : [b, a];
    lines.push(
      `The ${shortName(dear)} costs ${money(dear.price - cheap.price)} more: ${money(dear.price)} against ${money(cheap.price)} for the ${shortName(cheap)}.`
    );
  }

  numeric('weight', {
    higherWins: false,
    equal: (v) => `Both weigh ${v}.`,
    wins: (w, wv, l, lv, gap) => `The ${w} is lighter by ${gap}g: ${wv} against ${lv} for the ${l}.`,
  });

  const sa = Number(a.sizeLabel);
  const sb = Number(b.sizeLabel);
  if (sa === sb) lines.push(`The screens are the same size: ${a.sizeLabel} inch on both.`);
  else {
    const [big, small] = sa > sb ? [a, b] : [b, a];
    lines.push(`The ${shortName(big)} has the bigger screen: ${big.sizeLabel} inch against ${small.sizeLabel} inch on the ${shortName(small)}.`);
  }

  numeric('resolution', {
    parse: pixels,
    higherWins: true,
    equal: (v) => `Both run at ${v}.`,
    wins: (w, wv, l, lv) => `The ${w} has the higher resolution: ${wv} against ${lv} on the ${l}.`,
  });

  numeric('display_brightness', {
    higherWins: true,
    equal: (v) => `Both are rated at ${v}.`,
    wins: (w, wv, l, lv) => `The ${w} is brighter: ${wv} against ${lv} on the ${l}.`,
  });

  numeric('battery', {
    higherWins: true,
    equal: (v) => `Both have a ${v} battery.`,
    wins: (w, wv, l, lv) => `The ${w} has the bigger battery: ${wv} against ${lv} on the ${l}.`,
  });

  text('ip_rating', {
    equal: (v) => `Both are sealed to ${v}.`,
    differ: (va, vb) => `The ${A} is sealed to ${va} and the ${B} to ${vb}.`,
  });

  text('mil_std', {
    equal: (v) => `Both are drop tested to ${v}.`,
    differ: (va, vb) => `The ${A} is drop tested to ${va} and the ${B} to ${vb}.`,
  });

  text('os', {
    equal: (v) => `Both run ${v}.`,
    differ: (va, vb) => `The ${A} runs ${va}; the ${B} runs ${vb}.`,
  });

  text('connectivity', {
    equal: (v) => `Both have the same connectivity: ${v}.`,
    differ: (va, vb) => `Connectivity: ${va} on the ${A} vs ${vb} on the ${B}.`,
  });

  return lines;
}

/** The union of both spec sheets: a's keys in order, then anything only b has. */
const specKeys = (a, b) => [...Object.keys(a.specs), ...Object.keys(b.specs).filter((k) => !(k in a.specs))];

/** Three-column spec table: label, device A, device B. Differing rows are marked. */
function vsTable(a, b, keys) {
  const cell = (v) => (v ? esc(v) : '<span class="vs-missing">Not listed</span>');
  const rows = keys
    .map(
      (k) => `
              <tr${a.specs[k] === b.specs[k] ? '' : ' class="is-diff"'}>
                <th scope="row">${esc(specLabel(k))}</th>
                <td>${cell(a.specs[k])}</td>
                <td>${cell(b.specs[k])}</td>
              </tr>`
    )
    .join('');

  return `
        <div class="compare-wrap reveal">
          <table class="spec-table vs-table">
            <caption class="sr-only">Full specification of the ${esc(a.name)} and the ${esc(b.name)}, side by side</caption>
            <thead>
              <tr>
                <th scope="col">Specification</th>
                <th scope="col">${esc(a.name)}</th>
                <th scope="col">${esc(b.name)}</th>
              </tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
        <p class="compare-scroll-hint">Scroll the table sideways to see every column &rarr;</p>`;
}

/** A "Read next" card: the same markup as the blog's "More guides" cards. */
const guideCard = (p) => `
          <a class="post-card reveal" href="/blog/${p.slug}">
            <div class="post-card-media"><img src="${versioned(p.image)}"${responsive(p.image, '(max-width: 700px) 92vw, 400px')} alt="" loading="lazy" width="620" height="388"></div>
            <div class="post-card-body">
              <p class="post-card-date">${formatDate(p.date)}</p>
              <h3>${p.title}</h3>
              <p>${esc(p.description)}</p>
              <span class="product-card-cta">Read ${icons.arrowRight(14)}</span>
            </div>
          </a>`;

const checkItem = (html) => `<li>${icons.check(16)}<span>${html}</span></li>`;

comparePairs.forEach((c) => {
  const { a, b } = c;
  const A = shortName(a);
  const B = shortName(b);
  const trail = [...compareTrail, { label: c.label }];

  const keys = specKeys(a, b);
  const same = keys.filter((k) => a.specs[k] && a.specs[k] === b.specs[k]);
  const sameText = same.length
    ? `Identical on both: ${same.map((k) => `${lowerLabel(specLabel(k))} (${a.specs[k]})`).join(', ')}.`
    : 'Nothing on the two specification sheets is identical.';

  // Scanner variants, each priced against its own base device.
  const variants = [...variantsOf(a.id).map((v) => [v, a]), ...variantsOf(b.id).map((v) => [v, b])];
  const noVariant = [a, b].filter((p) => !variantsOf(p.id).length);

  // Accessories: fits both, only A, only B. Empty lists are left out.
  const fitsA = accessories.filter((x) => x.compatibleWith.includes(a.id));
  const fitsB = accessories.filter((x) => x.compatibleWith.includes(b.id));
  const accessoryLists = [
    { title: 'Fits both', items: fitsA.filter((x) => fitsB.includes(x)) },
    { title: `Fits only the ${A}`, items: fitsA.filter((x) => !fitsB.includes(x)) },
    { title: `Fits only the ${B}`, items: fitsB.filter((x) => !fitsA.includes(x)) },
  ].filter((l) => l.items.length);

  // Read next: every guide must be a real post.
  const guides = c.guides.map((g) => {
    const slug = g.replace(/^\/blog\//, '');
    const post = posts.find((p) => p.slug === slug);
    if (!post) {
      throw new Error(`${c.where}: guide ${g} matches no post in build/content/blog/ (have: ${posts.map((p) => `/blog/${p.slug}`).join(', ')})`);
    }
    return post;
  });

  // The FAQ schema wants plain text, so it is built from the raw strings;
  // the HTML from the escaped ones.
  const faqOpts = { heading: `Questions about the ${A} and ${B}`, tag: 'FAQ' };
  const faqHtml = faq(c.faq.map((f) => ({ q: f.q, a: prose(f.a, c.where) })), faqOpts).html;
  const faqSchema = faq(c.faq, faqOpts).schema;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${a.name} vs ${b.name}`,
    itemListElement: [a, b].map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE.origin}${productUrl(p)}`,
      name: p.name,
    })),
  };

  const body = `
    <section class="page-header">
      <div class="container">
${breadcrumbs(trail)}
        ${eyebrow('Compare')}
        <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
        <p class="lede">${prose(c.lede, c.where)}</p>
      </div>
    </section>

${trustStrip()}

    <section class="section">
      <div class="container">
${sectionHead({ tag: 'Side by side', title: 'The two devices' })}
        <div class="compare-pair">
${productCard(a)}
${productCard(b)}
        </div>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container">
${sectionHead({ tag: 'Verdict', title: 'The short answer' })}
        <div class="prose">
          ${c.verdict.map((p) => `<p>${prose(p, c.where)}</p>`).join('\n          ')}
        </div>
        <div class="choose-grid">
          <div class="choose-card reveal">
            <h3>Choose the ${esc(a.name)} if</h3>
            <ul class="check-list">
              ${c.chooseA.map((x) => checkItem(prose(x, c.where))).join('\n              ')}
            </ul>
          </div>
          <div class="choose-card reveal">
            <h3>Choose the ${esc(b.name)} if</h3>
            <ul class="check-list">
              ${c.chooseB.map((x) => checkItem(prose(x, c.where))).join('\n              ')}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
${sectionHead({
  tag: 'Specification',
  title: 'What is different',
  lede: `Every line comes from the two specification sheets, the same figures as the product pages. Rows where the ${esc(A)} and ${esc(B)} differ are tinted.`,
})}
        <ul class="check-list vs-diff-list">
          ${compareDiffs(a, b).map((line) => checkItem(esc(line))).join('\n          ')}
        </ul>
        <p class="vs-same">${esc(sameText)}</p>
${vsTable(a, b, keys)}
      </div>
    </section>

    ${
      variants.length
        ? `<section class="section section-tint">
      <div class="container">
${sectionHead({ tag: 'Variants', title: 'Scanner versions', lede: 'Sold from the base product page, with the price gap over the standard device.' })}
        <div class="prose">
          ${variants
            .map(
              ([v, base]) =>
                `<p><strong>${esc(v.name)}</strong>, ${money(v.price)}: ${money(v.price - base.price)} more than the standard <a href="${productUrl(base)}">${esc(base.name)}</a> at ${money(base.price)}. ${esc(v.description)}</p>`
            )
            .join('\n          ')}
          ${noVariant.map((p) => `<p>There is no scanner version of the ${esc(p.name)}.</p>`).join('\n          ')}
        </div>
      </div>
    </section>`
        : ''
    }

    ${
      accessoryLists.length
        ? `<section class="section${variants.length ? '' : ' section-tint'}">
      <div class="container">
${sectionHead({ tag: 'Accessories', title: 'What fits which', lede: 'Every accessory is matched to specific models. These are the ones that fit each of the two.' })}
        <div class="pdp-columns">
          ${accessoryLists
            .map(
              (l) => `<div>
            <h3 class="title-xs" style="margin-bottom:1rem">${esc(l.title)}</h3>
            <ul class="check-list">
              ${l.items.map((x) => checkItem(`<a href="/accessories">${esc(x.name)} (${money(x.price)})</a>`)).join('\n              ')}
            </ul>
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>
    </section>`
        : ''
    }

${faqHtml}

    <section class="section section-deep">
      <div class="container">
${sectionHead({ tag: 'Guides', title: 'Read next' })}
        <div class="post-grid">
          ${guides.map(guideCard).join('')}
        </div>
      </div>
    </section>

${compareCta()}
`;

  write(
    `compare/${c.slug}.html`,
    page({
      title: `${c.title} | Tuga Hardware`,
      description: c.description,
      path: c.path,
      active: 'products',
      ogImage: imgPath(a, 1),
      schema: [orgSchema, breadcrumbSchema(trail), faqSchema, itemList],
      body,
    })
  );
});

/* The index: three groups of cards, then the whole range in one table. */

const COMPARE_SECTIONS = [
  {
    group: 'size',
    tag: 'Same size, different system',
    title: 'Android or Windows at each size',
    lede: 'Each size comes in an Android and a Windows version. These pages set the price gap against what the software actually needs.',
  },
  {
    group: 'android',
    tag: 'The Android range',
    title: 'Pick a size on Android',
    lede: 'Three Android devices, one per size. Screen space against pocketability, and what the extra money buys.',
  },
  {
    group: 'windows',
    tag: 'The Windows range',
    title: 'Pick a size on Windows',
    lede: 'Three Windows 11 devices, one per size. Ports, screen and weight against the price.',
  },
];

const compareCard = (c) => `
          <a class="compare-card reveal" href="${c.path}">
            <div class="compare-card-media">
              <img src="${imgPath(c.a, 1)}"${responsive(imgPath(c.a, 1), '120px')} alt="${esc(c.a.name)} rugged ${c.a.formFactor}" loading="lazy" width="120" height="90">
              <span class="compare-card-vs" aria-hidden="true">vs</span>
              <img src="${imgPath(c.b, 1)}"${responsive(imgPath(c.b, 1), '120px')} alt="${esc(c.b.name)} rugged ${c.b.formFactor}" loading="lazy" width="120" height="90">
            </div>
            <h3>${esc(c.a.name)} vs ${esc(c.b.name)}</h3>
            <p>${esc(plainText(c.summary))}</p>
            <div class="compare-card-foot">
              <p class="compare-card-prices"><span>${esc(shortName(c.a))} ${money(c.a.price)}</span><span>${esc(shortName(c.b))} ${money(c.b.price)}</span></p>
              <span class="product-card-cta">Compare ${icons.arrowRight(14)}</span>
            </div>
          </a>`;

const compareSections = COMPARE_SECTIONS.map((s) => ({ ...s, pairs: comparePairs.filter((c) => c.group === s.group) })).filter(
  (s) => s.pairs.length
);

write(
  'compare/index.html',
  page({
    title: 'Compare Tuga Rugged Tablets Head to Head | Tuga Hardware',
    description:
      'Side by side comparisons of the Tuga rugged tablet range: 8 inch against 10 inch, Android against Windows, with a verdict, every spec and the price gap.',
    path: '/compare/',
    active: 'products',
    schema: [
      breadcrumbSchema([{ label: 'Home', href: '/' }, { label: 'Compare' }]),
      ...(comparePairs.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'Tuga Hardware head to head comparisons',
              itemListElement: comparePairs.map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE.origin}${c.path}`,
                name: `${c.a.name} vs ${c.b.name}`,
              })),
            },
          ]
        : []),
    ],
    body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Compare' }])}
        ${eyebrow('Compare')}
        <h1>Which Tuga is right for you? Compare two at a time</h1>
        <p class="lede">Pick two and get a straight answer: which one to buy, when the other is the better choice, every specification side by side with the differences marked, and the price gap. The figures are the same ones on the product pages.</p>
      </div>
    </section>

${
  compareSections.length
    ? compareSections
        .map(
          (s, i) => `
    <section class="section${i % 2 ? ' section-tint' : ''}">
      <div class="container">
${sectionHead({ tag: s.tag, title: s.title, lede: s.lede })}
        <div class="compare-list">
          ${s.pairs.map(compareCard).join('\n')}
        </div>
      </div>
    </section>`
        )
        .join('\n')
    : `
    <section class="section">
      <div class="container-narrow">
        <p class="lede">The head to head pages are being written. Until they are up, the table below puts every device side by side, and <a href="/which-tuga">the picker</a> narrows it to one.</p>
      </div>
    </section>`
}

    <section class="section section-deep">
      <div class="container">
${sectionHead({ tag: 'Everything', title: 'All six, one table' })}
${compareTable()}
      </div>
    </section>

${compareCta()}
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

> ${SITE.description} No VAT to add. Free UK delivery, 30-day returns, 12-month warranty. Automatic team discounts: 3% at 2 devices, 5% at 3 to 4, 8% at 5 to 9, 10% at 10 or more.

Small UK retailer of rugged Android and Windows tablets and handhelds for tradespeople. Six devices, three sizes (6, 8 and 10 inch). Android suits app-based work and costs noticeably less; Windows only when desktop software requires it.

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

## Compare

- [Compare two devices head to head](${SITE.origin}/compare/): a verdict, every specification side by side and the price gap
${comparePairs.map((c) => `- [${c.a.name} vs ${c.b.name}](${SITE.origin}${c.path}): ${plainText(c.summary)}`).join('\n')}

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
      <g:availability>${SALES_PAUSED ? 'out_of_stock' : 'in_stock'}</g:availability>
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
        <g:min_transit_time>1</g:min_transit_time>
        <g:max_transit_time>3</g:max_transit_time>
      </g:shipping>
      <g:min_handling_time>6</g:min_handling_time>
      <g:max_handling_time>7</g:max_handling_time>
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
   WORKS WITH — one page per maintenance / field software package
   Content: build/content/works-with/<slug>.json (see PAGE_SCHEMA in the
   workflow that produced them). Every software claim carries a source URL;
   device recommendations may only use the ids in WORKS_WITH_DEVICES.
   ========================================================================== */

const WORKS_WITH_DEVICES = ['tuga-a10', 'tuga-w10', 'tuga-a6'];
const deviceById = (id) => devices.find((d) => d.id === id);

const worksWith = readdirSync(join(ROOT, 'build', 'content', 'works-with'))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'build', 'content', 'works-with', f), 'utf8')))
  .filter((w) => {
    const ok = w.slug && w.software && w.title && w.recommended?.length;
    if (!ok) console.warn(`works-with: skipping malformed entry ${w.slug ?? '(no slug)'}`);
    return ok;
  })
  .map((w) => ({
    ...w,
    recommended: w.recommended.filter((r) => WORKS_WITH_DEVICES.includes(r.device_id) && deviceById(r.device_id)),
  }))
  .sort((a, b) => a.software.localeCompare(b.software));

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const worksWithTrail = [{ label: 'Home', href: '/' }, { label: 'Works with', href: '/works-with/' }];

worksWith.forEach((w) => {
  const trail = [...worksWithTrail, { label: w.software }];
  const primary = w.recommended.find((r) => r.role === 'primary') || w.recommended[0];
  const primaryDevice = deviceById(primary.device_id);
  const faqBlock = w.faq?.length ? faq(w.faq, { heading: `${w.software} on a Tuga device`, tag: 'Questions' }) : null;

  const requirementRows = (w.requirements || [])
    .map(
      (r) => `
          <li class="req">
            <h3>${esc(r.requirement)}</h3>
            <p>${esc(r.detail)}${r.source_url ? ` <a class="req-source" href="${esc(r.source_url)}" rel="nofollow noopener" target="_blank">Source: ${esc(hostOf(r.source_url))}</a>` : ''}</p>
          </li>`
    )
    .join('');

  const picks = w.recommended
    .map((r) => {
      const d = deviceById(r.device_id);
      return `
        <article class="pick reveal">
          <div class="pick-card">${productCard(d)}</div>
          <div class="pick-body">
            ${eyebrow(r.role === 'primary' ? 'Our pick' : 'Alternative')}
            <h3>${esc(d.name)} <span class="pick-price">${money(d.price)}</span></h3>
            <p>${esc(r.why)}</p>
            <ul class="editorial-list">
              ${(r.fit || []).map((f) => `<li>${esc(f)}</li>`).join('\n              ')}
            </ul>
            <div class="pick-actions">
              <a class="btn btn-primary" href="${quoteUrl(d.name)}">Get a business quote</a>
              <a class="btn btn-outline" href="${productUrl(d)}">Full specification</a>
            </div>
          </div>
        </article>`;
    })
    .join('');

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE.origin}/works-with/${w.slug}`,
    name: w.title,
    description: w.meta_description,
    about: { '@type': 'SoftwareApplication', name: w.software, url: w.vendor_url, author: { '@type': 'Organization', name: w.vendor } },
    mentions: w.recommended.map((r) => ({ '@type': 'Product', name: deviceById(r.device_id).name, url: `${SITE.origin}${productUrl(deviceById(r.device_id))}` })),
    publisher: { '@id': `${SITE.origin}/#organization` },
  };

  write(
    `works-with/${w.slug}.html`,
    page({
      title: `${w.title} | Tuga Hardware`,
      description: w.meta_description,
      path: `/works-with/${w.slug}`,
      active: 'works-with',
      ogImage: imgPath(primaryDevice, 1),
      schema: [orgSchema, breadcrumbSchema(trail), webPageSchema, ...(faqBlock ? [faqBlock.schema] : [])],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs(trail)}
        ${eyebrow('Works with')}
        <h1>${esc(w.h1)}</h1>
        <p class="lede">${esc(w.intro?.[0] || w.meta_description)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          ${(w.intro || []).slice(1).map((p) => `<p>${esc(p)}</p>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container-narrow">
        ${eyebrow('Requirements')}
        <h2 class="title-md">What ${esc(w.software)} needs from a device</h2>
        <p class="lede">Each item below comes from ${esc(w.vendor)}'s own listing or documentation, with the source linked.</p>
        <ul class="req-list">${requirementRows}
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="container">
${sectionHead({ tag: 'Devices', title: `Which Tuga device fits ${esc(w.software)}`, lede: 'Picked on the published requirements above and nothing else.' })}
        <div class="pick-list">${picks}
        </div>
        ${w.not_recommended_note ? `<aside class="callout"><strong>Worth knowing.</strong> ${esc(w.not_recommended_note)}</aside>` : ''}
      </div>
    </section>

    <section class="section section-tint">
      <div class="container-narrow">
        <div class="setup-grid">
          <div>
            ${eyebrow('Setting up')}
            <h2 class="title-sm">Getting ${esc(w.software)} running</h2>
            <ol class="step-list">
              ${(w.setup_steps || []).map((s) => `<li>${esc(s)}</li>`).join('\n              ')}
            </ol>
          </div>
          ${
            w.accessories?.length
              ? `<div>
            ${eyebrow('Accessories')}
            <h2 class="title-sm">Worth adding</h2>
            <ul class="editorial-list">
              ${w.accessories.map((a) => `<li>${esc(a)}</li>`).join('\n              ')}
            </ul>
            <p style="margin-top:1rem"><a class="link-arrow" href="/accessories">All accessories</a></p>
          </div>`
              : ''
          }
        </div>
      </div>
    </section>

${faqBlock ? faqBlock.html : ''}

    <section class="section">
      <div class="container-narrow">
        <p class="disclaimer">${esc(w.disclaimer)}</p>
        ${
          w.sources?.length
            ? `<details class="sources">
          <summary>Sources checked for this page</summary>
          <ul>
            ${w.sources.map((s) => `<li><a href="${esc(s)}" rel="nofollow noopener" target="_blank">${esc(s)}</a></li>`).join('\n            ')}
          </ul>
        </details>`
            : ''
        }
      </div>
    </section>

${ctaBanner({
  title: 'Trial one unit before you kit out the team.',
  text: `Order a single ${primaryDevice.name} at ${money(primaryDevice.price)}, no VAT to add, with 30 days to send it back if it is not right. Business quotes and proforma invoices on request.`,
  primary: { href: quoteUrl(primaryDevice.name), label: 'Get a quote' },
  secondary: { href: productUrl(primaryDevice), label: `See the ${primaryDevice.name}` },
})}
`,
    })
  );
});

if (worksWith.length) {
  write(
    'works-with/index.html',
    page({
      title: 'Rugged tablets for maintenance and field software | Tuga Hardware',
      description:
        'Which Tuga rugged tablet runs your CMMS, EAM or inspection software. Published requirements checked against each device, with a trial unit and business quotes available.',
      path: '/works-with/',
      active: 'works-with',
      schema: [orgSchema, breadcrumbSchema(worksWithTrail)],
      body: `
    <section class="page-header">
      <div class="container">
${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Works with' }])}
        ${eyebrow('Works with')}
        <h1>Rugged tablets for the software your team already runs</h1>
        <p class="lede">Maintenance, asset management and inspection apps publish what they need from a device. We check those requirements against each Tuga tablet and say plainly which one fits, and where it does not.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="works-grid">
          ${worksWith
            .map((w) => {
              const p = w.recommended.find((r) => r.role === 'primary') || w.recommended[0];
              const d = deviceById(p.device_id);
              return `
          <a class="works-card reveal" href="/works-with/${esc(w.slug)}">
            <p class="product-card-kicker">${esc(w.vendor)}</p>
            <h2>${esc(w.software.split(' (')[0])}</h2>
            <p>${esc(w.meta_description)}</p>
            <span class="works-pick">Our pick: ${esc(d.name)}, ${money(d.price)}</span>
            <span class="product-card-cta">Read ${icons.arrowRight(14)}</span>
          </a>`;
            })
            .join('')}
        </div>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container-narrow">
        ${eyebrow('Not listed?')}
        <h2 class="title-md">Tell us what you run</h2>
        <p class="lede">Send the app name and the devices you have now. We will check the published requirements against the range and tell you which device fits, including when the answer is none of them.</p>
        <p style="margin-top:1.5rem"><a class="btn btn-primary" href="/contact?quote=#enquiry">Ask about your software</a></p>
      </div>
    </section>
`,
    })
  );
}

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
  { loc: '/compare/', priority: '0.8', freq: 'monthly' },
  ...comparePairs.map((c) => ({ loc: c.path, priority: '0.7', freq: 'monthly' })),
  ...trades.map((t) => ({ loc: `/for/${t.slug}`, priority: '0.7', freq: 'monthly' })),
  { loc: '/accessories', priority: '0.7', freq: 'monthly' },
  { loc: '/trade', priority: '0.6', freq: 'monthly' },
  { loc: '/register-warranty', priority: '0.4', freq: 'yearly' },
  { loc: '/bulk', priority: '0.7', freq: 'monthly' },
  { loc: '/warranty', priority: '0.7', freq: 'monthly' },
  { loc: '/warranty-terms', priority: '0.4', freq: 'yearly' },
  { loc: '/blog/', priority: '0.7', freq: 'weekly' },
  ...posts.map((p) => ({
    loc: `/blog/${p.slug}`,
    priority: '0.6',
    freq: 'monthly',
  })),
  ...(worksWith.length ? [{ loc: '/works-with/', priority: '0.8', freq: 'weekly' }] : []),
  ...worksWith.map((w) => ({
    loc: `/works-with/${w.slug}`,
    priority: '0.8',
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
