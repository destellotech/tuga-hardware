/* ==========================================================================
   Reusable content blocks shared across pages.
   ========================================================================== */

import {
  esc,
  money,
  icons,
  imgPath,
  productUrl,
  specLabel,
  devices,
} from './layout.mjs';

/* --- small pieces -------------------------------------------------------- */

export const eyebrow = (text) => `<span class="eyebrow">${esc(text)}</span>`;

export const sectionHead = ({ tag, title, lede, center = false, wide = false }) => `
        <div class="section-head${center ? ' section-head-center' : ''}${wide ? ' section-head-wide' : ''} reveal">
          ${tag ? eyebrow(tag) : ''}
          <h2 class="title-md">${title}</h2>
          ${lede ? `<p class="lede">${lede}</p>` : ''}
        </div>`;

export const breadcrumbs = (trail) => `
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          ${trail
            .map((c, i) =>
              c.href
                ? `<a href="${c.href}">${esc(c.label)}</a>`
                : `<span aria-current="page">${esc(c.label)}</span>`
            )
            .join('\n          <span class="sep" aria-hidden="true">/</span>\n          ')}
        </nav>`;

/* --- product card -------------------------------------------------------- */

export function productCard(p) {
  const chips = [
    p.specs.ip_rating,
    p.specs.mil_std,
    p.specs.battery,
    p.specs.os,
  ].filter(Boolean);

  return `
          <a class="product-card reveal" href="${productUrl(p)}" data-category="${p.category}">
            ${p.badge ? `<span class="product-badge${p.badge === 'Most Popular' ? ' product-badge-copper' : ''}">${esc(p.badge)}</span>` : ''}
            <div class="product-card-media">
              <img src="${imgPath(p, 1)}" alt="${esc(p.name)} rugged ${p.formFactor}" loading="lazy" width="600" height="450">
            </div>
            <div class="product-card-body">
              <p class="product-card-kicker">${p.formFactor === 'handheld' ? 'Handheld' : 'Tablet'} / ${esc(p.sizeLabel)}&Prime; / ${p.category === 'android' ? 'Android' : 'Windows'}</p>
              <h3 class="product-card-name">${esc(p.name)}</h3>
              <p class="product-card-tagline">${esc(p.tagline)}</p>
              <div class="spec-chips">
                ${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('\n                ')}
              </div>
              <div class="product-card-foot">
                <span class="product-price">${money(p.price)}</span>
                <span class="product-card-cta">View ${icons.arrowRight(14)}</span>
              </div>
            </div>
          </a>`;
}

export const productGrid = (list) => `
        <div class="product-grid" data-product-grid>
          ${list.map(productCard).join('\n')}
        </div>`;

/* --- size ladder — the 6" / 8" / 10" selector ---------------------------- */

/**
 * The signature block. Devices are drawn at true relative scale so choosing a
 * size is a physical decision rather than an abstract one.
 */
export function sizeLadder(range) {
  return `
        <div class="ladder">
          ${range
            .map(
              (p) => `
            <a class="ladder-item reveal" href="${productUrl(p)}" data-size="${p.sizeClass}">
              <div class="ladder-stage">
                <div class="ladder-device">
                  <img src="${imgPath(p, 1)}" alt="${esc(p.name)}, ${esc(p.sizeLabel)} inch" loading="lazy" width="400" height="400">
                </div>
              </div>
              <span class="ladder-size">${esc(p.sizeLabel)}<sup>in</sup></span>
              <span class="ladder-name">${esc(p.name)}</span>
              <p class="ladder-for">${esc(p.shortFor)}</p>
              <div class="ladder-meta">
                <span class="chip">${esc(p.specs.ip_rating)}</span>
                <span class="chip">${esc(p.specs.battery)}</span>
                <span class="chip">${esc(p.specs.weight)}</span>
              </div>
              <div class="ladder-foot">
                <span class="ladder-price"><small>From</small>${money(p.price)}</span>
                <span class="product-card-cta">View ${icons.arrowRight(14)}</span>
              </div>
            </a>`
            )
            .join('\n')}
        </div>`;
}

/* --- comparison table ---------------------------------------------------- */

export function compareTable(list = devices) {
  const rows = list
    .map(
      (p) => `
              <tr>
                <td><a href="${productUrl(p)}">${esc(p.name)}</a></td>
                <td class="cell-mono">${esc(p.sizeLabel)}&Prime; ${p.formFactor === 'handheld' ? 'handheld' : 'tablet'}</td>
                <td class="cell-mono">${esc(p.specs.os)}</td>
                <td class="cell-mono">${esc(p.specs.ip_rating)}</td>
                <td class="cell-mono">${esc(p.specs.battery)}</td>
                <td class="cell-mono">${esc(p.specs.weight)}</td>
                <td class="cell-price">${money(p.price)}</td>
              </tr>`
    )
    .join('');

  return `
        <div class="compare-wrap reveal">
          <table class="compare-table">
            <caption class="sr-only">Specification comparison of every Tuga device</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Size</th>
                <th scope="col">OS</th>
                <th scope="col">Sealing</th>
                <th scope="col">Battery</th>
                <th scope="col">Weight</th>
                <th scope="col">Price</th>
              </tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
        <p class="compare-scroll-hint">Scroll the table sideways to see every column &rarr;</p>`;
}

/* --- spec sheet (PDP) ---------------------------------------------------- */

export function specSheet(p) {
  const rows = Object.entries(p.specs)
    .map(
      ([k, v]) => `
              <tr>
                <th scope="row">${esc(specLabel(k))}</th>
                <td>${esc(v)}</td>
              </tr>`
    )
    .join('');

  return `
          <div class="spec-sheet reveal">
            <div class="spec-sheet-head">
              <h2>Full specification</h2>
              <span>${esc(p.name)}</span>
            </div>
            <table class="spec-table">
              <caption class="sr-only">Full specification for the ${esc(p.name)}</caption>
              <tbody>${rows}
              </tbody>
            </table>
          </div>`;
}

/* --- trust strip --------------------------------------------------------- */

export const trustStrip = () => `
    <section class="trust-strip" aria-label="What every order includes">
      <div class="container trust-strip-inner">
        <div class="trust-item">${icons.truck(20)}<span>Free UK delivery</span></div>
        <div class="trust-item">${icons.shieldCheck(20)}<span>12-month warranty</span></div>
        <div class="trust-item">${icons.refresh(20)}<span>30-day returns</span></div>
        <div class="trust-item">${icons.lock(20)}<span>Secure checkout</span></div>
        <div class="trust-item">${icons.chat(20)}<span>UK-based support</span></div>
      </div>
    </section>`;

/* --- FAQ ----------------------------------------------------------------- */

/**
 * Renders an accordion and returns the matching FAQPage schema so the two can
 * never drift apart.
 */
export function faq(items, { heading = 'Common questions', tag = 'FAQ' } = {}) {
  const html = `
    <section class="section" aria-labelledby="faq-heading">
      <div class="container-narrow">
        ${eyebrow(tag)}
        <h2 class="title-md" id="faq-heading">${esc(heading)}</h2>
        <div class="faq-list" style="margin-top: 2.5rem;">
          ${items
            .map(
              (item, i) => `
          <div class="faq-item" data-faq>
            <h3>
              <button type="button" class="faq-q" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}">
                <span>${esc(item.q)}</span>
                <span class="faq-icon" aria-hidden="true"></span>
              </button>
            </h3>
            <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}">
              <div><p>${item.a}</p></div>
            </div>
          </div>`
            )
            .join('')}
        </div>
      </div>
    </section>`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        // Strip tags — schema wants plain text.
        text: item.a.replace(/<[^>]+>/g, ''),
      },
    })),
  };

  return { html, schema };
}

/* --- lead capture -------------------------------------------------------- */

export const capture = () => `
    <section class="section">
      <div class="container">
        <div class="capture reveal">
          <div>
            <h2>Not sure which size you need?</h2>
            <p>We will send you the one-page buyer's guide: how 6, 8 and 10 inch actually compare in the hand, what IP and MIL ratings mean in practice, and the questions worth asking before you spend.</p>
          </div>
          <div>
            <form class="capture-form" data-capture-form novalidate>
              <label class="sr-only" for="capture-email">Email address</label>
              <input type="email" id="capture-email" name="email" placeholder="you@yourcompany.co.uk" autocomplete="email" required>
              <button class="btn btn-copper" type="submit">Send it</button>
            </form>
            <p class="capture-note" data-capture-note>One email. No newsletter, no reselling your address.</p>
          </div>
        </div>
      </div>
    </section>`;

/* --- closing CTA --------------------------------------------------------- */

export const ctaBanner = ({
  title = 'Stop replacing broken tablets.',
  text = 'A consumer tablet on a building site is a consumable. Buy the thing that was designed for the job and stop paying for it twice a year.',
  primary = { href: '/products/', label: 'Browse the range' },
  secondary = { href: '/bulk', label: 'Kitting out a team?' },
} = {}) => `
    <section class="section-dark">
      <div class="container cta-banner">
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        <div class="cta-actions">
          <a class="btn btn-inverse btn-lg" href="${primary.href}">${esc(primary.label)}</a>
          ${secondary ? `<a class="btn btn-outline-light btn-lg" href="${secondary.href}">${esc(secondary.label)}</a>` : ''}
        </div>
      </div>
    </section>`;

/* --- accessory card ------------------------------------------------------ */

export function accessoryCard(a) {
  const names = a.compatibleWith
    .map((id) => devices.find((p) => p.id === id)?.name)
    .filter(Boolean);

  return `
          <div class="accessory-card reveal">
            <div class="accessory-icon">${icons.box(22)}</div>
            <h3>${esc(a.name)}</h3>
            <p>${esc(a.description)}</p>
            <p class="accessory-compat">Fits: ${esc(names.join(', '))}</p>
            <div class="accessory-foot">
              <span class="accessory-price">${money(a.price)}</span>
              <button class="btn btn-sm btn-outline" data-add-to-cart="${a.id}">Add to basket</button>
            </div>
          </div>`;
}
