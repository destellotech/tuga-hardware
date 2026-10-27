/* ==========================================================================
   Reusable content blocks shared across pages.
   ========================================================================== */

import {
  esc,
  money,
  icons,
  imgPath,
  responsive,
  productUrl,
  specLabel,
  devices,
} from './layout.mjs';
import { SALES_PAUSED, quoteUrl } from '../../src/store-config.js';

/* --- small pieces -------------------------------------------------------- */

export const eyebrow = (text) => `<span class="eyebrow">${esc(text)}</span>`;

/* Title left, supporting copy right. A narrow single column leaves half the
   page empty, which is what makes a layout look unconsidered. */
export const sectionHead = ({ tag, title, lede, center = false, wide = false }) => `
        <div class="section-head${center ? ' section-head-center' : ''}${wide ? ' section-head-wide' : ''} reveal">
          <div class="section-head-title">
            ${tag ? eyebrow(tag) : ''}
            <h2 class="title-md">${title}</h2>
          </div>
          ${lede ? `<div class="section-head-body"><p class="lede">${lede}</p></div>` : ''}
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
            ${p.badge ? `<span class="product-badge${/^(Our pick|Recommended|Most)/i.test(p.badge) ? ' product-badge-copper' : ''}">${esc(p.badge)}</span>` : ''}
            <div class="product-card-media">
              <img src="${imgPath(p, 1)}"${responsive(imgPath(p, 1), '(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 380px')} alt="${esc(p.name)} rugged ${p.formFactor}" loading="lazy" width="600" height="450">
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
                  <img src="${imgPath(p, 1)}"${responsive(imgPath(p, 1), '(max-width: 860px) 60vw, 280px')} alt="${esc(p.name)}, ${esc(p.sizeLabel)} inch" loading="lazy" width="400" height="300">
                </div>
              </div>
              <span class="ladder-size">${esc(p.sizeLabel)}<sup>in</sup></span>
              <span class="ladder-name">${esc(p.name)}</span>
              <p class="ladder-for">${esc(p.shortFor)}</p>
              <div class="ladder-meta">
                <span class="chip">${esc(p.specs.ip_rating)}</span>
                <span class="chip">${esc(p.specs.battery)}</span>
                ${p.specs.weight ? `<span class="chip">${esc(p.specs.weight)}</span>` : ''}
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
                <td><a href="${productUrl(p)}">${esc(p.name)}</a>${p.badge ? ` <span class="pick-tag">${esc(p.badge)}</span>` : ''}</td>
                <td class="cell-mono">${esc(p.sizeLabel)}&Prime; ${p.formFactor === 'handheld' ? 'handheld' : 'tablet'}</td>
                <td class="cell-mono">${esc(p.specs.os)}</td>
                <td class="cell-mono">${esc(p.specs.ip_rating)}</td>
                <td class="cell-mono">${esc(p.specs.battery)}</td>
                <td class="cell-mono">${p.specs.weight ? esc(p.specs.weight) : 'Not listed'}</td>
                <td class="cell-price">${money(p.price)}</td>
              </tr>`
    )
    .join('');

  return `
        <div class="compare-wrap reveal" tabindex="0">
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
        <div class="trust-item">${icons.truck(20)}<span>Free worldwide delivery</span></div>
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
            <p>Leave your email and one of us will reply personally with the size we would pick for your work, and why. Tell us your trade in the reply and we will be more precise.</p>
          </div>
          <div>
            <form class="capture-form" data-capture-form novalidate>
              <!-- Honeypot: hidden from humans, checked server-side -->
              <div style="position:absolute;left:-9999px" aria-hidden="true">
                <label for="capture-website">Website</label>
                <input type="text" id="capture-website" name="website" tabindex="-1" autocomplete="off">
              </div>
              <label class="sr-only" for="capture-email">Email address</label>
              <input type="email" id="capture-email" name="email" placeholder="you@yourcompany.co.uk" autocomplete="email" required>
              <button class="btn btn-copper" type="submit">Ask us</button>
            </form>
            <p class="capture-note" data-capture-note>A reply from a person. No newsletter, no reselling your address.</p>
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

/**
 * A quote-only accessory (spare batteries, for now) has no price in the
 * catalogue and is never added to the basket: the card asks for a quote
 * with the accessory name prefilled instead. The Worker's PRODUCTS map does
 * not know these ids, so even a hand-crafted basket line would be refused.
 */
export function accessoryCard(a) {
  const names = a.compatibleWith
    .map((id) => devices.find((p) => p.id === id)?.name)
    .filter(Boolean);

  const foot = a.quoteOnly
    ? `<span class="accessory-price accessory-price-quote">Price on request</span>
              <a class="btn btn-sm btn-outline" href="${quoteUrl(a.name)}">Ask for a price</a>`
    : `<span class="accessory-price">${money(a.price)}</span>
              ${SALES_PAUSED ? '' : `<button class="btn btn-sm btn-outline" data-add-to-cart="${a.id}">Add to basket</button>`}`;

  return `
          <div class="accessory-card reveal">
            <div class="accessory-icon">${icons.box(22)}</div>
            <h3>${esc(a.name)}</h3>
            <p>${esc(a.description)}</p>
            <p class="accessory-compat">Fits: ${esc(names.join(', '))}</p>
            <div class="accessory-foot">
              ${foot}
            </div>
          </div>`;
}
