/* ============================================
   TUGA HARDWARE — Reviews System
   Loads reviews.json, renders stars & reviews
   ============================================ */

let reviewsData = {};

async function loadReviews() {
  try {
    const res = await fetch('/data/reviews.json');
    const data = await res.json();
    reviewsData = data.reviews;
    return reviewsData;
  } catch (err) {
    console.error('Failed to load reviews:', err);
    return {};
  }
}

/* --- Star Rating HTML --- */
function renderStars(rating, size = 14) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3;
  const empty = 5 - full - (half ? 1 : 0);
  let html = '';

  for (let i = 0; i < full; i++) {
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#c4856c" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }
  if (half) {
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="none">
      <defs><clipPath id="half-star"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#c4856c" clip-path="url(#half-star)"/>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="#c4856c" stroke-width="1.5"/>
    </svg>`;
  }
  for (let i = 0; i < empty; i++) {
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#c4856c" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }

  return html;
}

/* --- Star Rating Badge for Product Cards --- */
function getProductRatingHTML(productId) {
  const review = reviewsData[productId];
  if (!review) return '';
  return `
    <div class="product-card-rating">
      <span class="stars">${renderStars(review.average, 13)}</span>
      <span class="rating-text">${review.average} (${review.count})</span>
    </div>
  `;
}

/* --- Reviews Section for Product Page --- */
function renderReviewsSection(productId) {
  const review = reviewsData[productId];
  if (!review || !review.items || review.items.length === 0) return '';

  const reviewsHTML = review.items.map(r => `
    <div class="review-item">
      <div class="review-header">
        <div class="review-stars">${renderStars(r.rating, 15)}</div>
        <span class="review-author">${r.author}</span>
        ${r.verified ? '<span class="review-verified">Verified Purchase</span>' : ''}
      </div>
      <h4 class="review-title">${r.title}</h4>
      <p class="review-body">${r.body}</p>
      <span class="review-date">${formatReviewDate(r.date)}</span>
    </div>
  `).join('');

  return `
    <section class="reviews-section" id="reviews">
      <div class="reviews-header">
        <div>
          <p class="section-tag">// Customer Reviews</p>
          <h2 class="reviews-title">Rated ${review.average} from ${review.count} reviews</h2>
        </div>
        <div class="reviews-summary-stars">${renderStars(review.average, 22)}</div>
      </div>
      <div class="reviews-list">
        ${reviewsHTML}
      </div>
    </section>
  `;
}

/* --- Product Review Schema (JSON-LD) --- */
function injectReviewSchema(product, review) {
  if (!review) return;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "brand": { "@type": "Brand", "name": "Tuga Hardware" },
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "GBP",
      "availability": "https://schema.org/InStock",
      "url": `https://tugahardware.com/products/${product.slug}.html`
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": review.average,
      "reviewCount": review.count,
      "bestRating": 5,
      "worstRating": 1
    },
    "review": review.items.slice(0, 3).map(r => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": r.author },
      "datePublished": r.date,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": r.rating,
        "bestRating": 5
      },
      "name": r.title,
      "reviewBody": r.body
    }))
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/* --- Helpers --- */
function formatReviewDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* --- Init: Load reviews on page load --- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadReviews();

  // Inject star ratings into product cards (after products render)
  setTimeout(() => {
    document.querySelectorAll('.product-card').forEach(card => {
      const href = card.getAttribute('href') || '';
      const slug = href.match(/products\/(.+)\.html/)?.[1];
      if (slug && reviewsData[slug]) {
        const footer = card.querySelector('.product-card-footer');
        if (footer) {
          const ratingDiv = document.createElement('div');
          ratingDiv.innerHTML = getProductRatingHTML(slug);
          footer.parentNode.insertBefore(ratingDiv.firstElementChild, footer);
        }
      }
    });
  }, 500);
});
