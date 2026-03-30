/* ============================================
   TUGA HARDWARE — Main JS
   Navigation, animations, cookie consent
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initScrollAnimations();
  initCookieBanner();
});

/* --- Navigation --- */
function initNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // Mobile toggle
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Update cart count in nav
  updateNavCartCount();
}

function updateNavCartCount() {
  const countEl = document.querySelector('.nav-cart-count');
  if (!countEl) return;
  const cart = JSON.parse(localStorage.getItem('tuga-cart') || '[]');
  const total = cart.reduce((sum, item) => sum + item.quantity, 0);
  countEl.textContent = total;
  countEl.classList.toggle('hidden', total === 0);
}

/* --- Scroll Animations --- */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

/* --- Cookie Banner --- */
function initCookieBanner() {
  const banner = document.querySelector('.cookie-banner');
  if (!banner) return;
  if (localStorage.getItem('tuga-cookies') === 'accepted') return;

  banner.classList.add('show');

  banner.querySelector('.cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem('tuga-cookies', 'accepted');
    banner.classList.remove('show');
  });

  banner.querySelector('.cookie-decline')?.addEventListener('click', () => {
    localStorage.setItem('tuga-cookies', 'declined');
    banner.classList.remove('show');
  });
}

/* --- Toast Notification --- */
function showToast(message, duration = 3000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* --- Utility --- */
function formatPrice(pence) {
  return '£' + (pence).toFixed(0);
}
