/* ============================================
   TUGA HARDWARE — Cloudflare Worker entry point

   Order of business per request:
     1. Canonical host + trailing-slash redirects
     2. Legacy product URL redirects
     3. API / webhook routes
     4. Static assets
   ============================================ */

import { handleRequest } from './api.js';

const CANONICAL_HOST = 'www.tugahardware.com';

/**
 * The Android range was renamed from H6/T8/T10 to a single A-series so the
 * 6" / 8" / 10" ladder reads consistently. Old URLs 301 to the new ones.
 * Keys are extensionless — .html is stripped before this map is consulted.
 */
const LEGACY_PATHS = {
  '/products/tuga-h6': '/products/tuga-a6',
  '/products/tuga-t8': '/products/tuga-a8',
  '/products/tuga-t10': '/products/tuga-a10',
  '/products': '/products/',
  '/blog': '/blog/',
};

function redirect(url, status = 301) {
  return new Response(null, {
    status,
    headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=3600' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. Machine endpoints, before any redirect ------------------------
    // Stripe and PayPal do not follow redirects when delivering a webhook, and
    // a 301 turns a POST into a GET. Serve /api/ and /webhooks/ on whatever
    // host they were configured with so a stale apex URL still works.
    const isMachinePath =
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhooks/');

    if (isMachinePath) {
      const apiResponse = await handleRequest(request, env);
      if (apiResponse) return apiResponse;
      return new Response('Not Found', { status: 404 });
    }

    // --- 2. One canonical origin ------------------------------------------
    // Split-host indexing (apex vs www) halves the value of every backlink.
    // Skip in local development, where the host is localhost.
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.workers.dev');

    if (!isLocal && url.hostname !== CANONICAL_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return redirect(url);
    }

    // --- 3. Pretty URLs ----------------------------------------------------
    // Canonical URLs are extensionless (matching the asset binding's
    // html_handling). Turn /about.html into /about with a proper 301 rather
    // than letting the asset layer answer with a 307.
    if (url.pathname.endsWith('.html')) {
      let p = url.pathname.slice(0, -'.html'.length);
      if (p.endsWith('/index')) p = p.slice(0, -'index'.length);
      url.pathname = p || '/';
      return redirect(url);
    }

    // --- 4. Legacy paths ---------------------------------------------------
    const legacy = LEGACY_PATHS[url.pathname];
    if (legacy) {
      url.pathname = legacy;
      return redirect(url);
    }

    // --- 5. Static assets --------------------------------------------------
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);

      // Long-cache immutable assets; let HTML revalidate so deploys land.
      if (response.ok && /\.(?:css|js|webp|svg|woff2?)$/.test(url.pathname)) {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(response.body, { status: response.status, headers });
      }

      return response;
    }

    return new Response('Not Found', { status: 404 });
  },
};
