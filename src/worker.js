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
 */
const LEGACY_PATHS = {
  '/products/tuga-h6.html': '/products/tuga-a6.html',
  '/products/tuga-t8.html': '/products/tuga-a8.html',
  '/products/tuga-t10.html': '/products/tuga-a10.html',
  '/products.html': '/products/',
  '/blog.html': '/blog/',
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

    // --- 1. One canonical origin ------------------------------------------
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

    // --- 2. Legacy paths ---------------------------------------------------
    const legacy = LEGACY_PATHS[url.pathname];
    if (legacy) {
      url.pathname = legacy;
      return redirect(url);
    }

    // --- 3. API and webhooks ----------------------------------------------
    const apiResponse = await handleRequest(request, env);
    if (apiResponse) return apiResponse;

    // --- 4. Static assets --------------------------------------------------
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
