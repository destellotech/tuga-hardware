/* ============================================
   TUGA HARDWARE — Cloudflare Worker entry point

   Order of business per request:
     1. API / webhook routes
     2. One redirect to the final URL: https, canonical host, pretty path,
        legacy product URLs
     3. Static assets, with security headers on HTML; page views are
        counted here (src/pageviews.js)
     4. Anything else: the generated 404 page with a real 404 status
   ============================================ */

import { handleRequest, recheckProcessingPayments } from './api.js';
import { sendReviewRequests } from './reviews.js';
import { ADMIN_PAGE } from './admin-page.js';
import { sendDailyDigest } from './backoffice.js';
import { countPageView, countCrawl, countMiss } from './pageviews.js';

const CANONICAL_HOST = 'www.tugahardware.com';

/**
 * The Android range was renamed from H6/T8/T10 to a single A-series so the
 * 6" / 8" / 10" ladder reads consistently. Old URLs 301 to the new ones.
 * Keys are extensionless with no trailing slash — canonicalPath() strips
 * both before this map is consulted.
 */
const LEGACY_PATHS = {
  '/products/tuga-h6': '/products/tuga-a6',
  '/products/tuga-t8': '/products/tuga-a8',
  '/products/tuga-t10': '/products/tuga-a10',
  '/products': '/products/',
  '/blog': '/blog/',
  '/works-with': '/works-with/',
  '/compare': '/compare/',
};

/**
 * Paths that are real directory indexes (a folder with an index.html). These
 * keep their trailing slash; every other path loses it.
 */
const DIRECTORY_INDEXES = new Set(['/', '/products/', '/blog/', '/works-with/', '/compare/']);

/** Headers for every HTML page. No CSP: Stripe and PayPal load their own scripts. */
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

function redirect(url, status = 301) {
  return new Response(null, {
    status,
    headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * The canonical form of a path: extensionless, /x/index → /x/, no trailing
 * slash except on a real directory index, then any legacy rename. Doing all
 * of it before redirecting means an old URL reaches its destination in one
 * 301 instead of a chain.
 */
function canonicalPath(pathname) {
  let p = pathname;

  // Canonical URLs are extensionless (matching the asset binding's
  // html_handling). Turn /about.html into /about with a proper 301 rather
  // than letting the asset layer answer with a 307.
  if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  if (p.endsWith('/index')) p = p.slice(0, -'index'.length);

  if (p.endsWith('/') && !DIRECTORY_INDEXES.has(p)) {
    p = p.replace(/\/+$/, '') || '/';
  }

  return LEGACY_PATHS[p] || p || '/';
}

/** Copy a response so its headers are mutable, adding the HTML security headers. */
function withHtmlHeaders(response, status = response.status) {
  const out = new Response(response.body, {
    status,
    statusText: status === response.status ? response.statusText : '',
    headers: new Headers(response.headers),
  });
  const type = out.headers.get('Content-Type') || '';
  if (type.includes('text/html')) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      out.headers.set(name, value);
    }
  }
  return out;
}

/**
 * The generated /404.html (build/build.mjs), served with a 404 status. The
 * miss is counted (src/pageviews.js) on the live site so dead URLs surface
 * in the back office; `ctx` is absent for the local and preview hosts.
 */
async function notFound(request, env, ctx) {
  if (ctx) countMiss(request, env, ctx);
  if (env.ASSETS) {
    // Ask for the extensionless path: the asset layer 307s /404.html to /404.
    const pageUrl = new URL('/404', request.url);
    const page = await env.ASSETS.fetch(new Request(pageUrl, { method: 'GET' }));
    if (page.ok) {
      const response = withHtmlHeaders(page, 404);
      response.headers.set('Cache-Control', 'no-store');
      return request.method === 'HEAD'
        ? new Response(null, { status: 404, headers: response.headers })
        : response;
    }
  }
  return new Response('Not Found', { status: 404 });
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

    // --- 2. One redirect to the final URL ----------------------------------
    // Split-host indexing (apex vs www) halves the value of every backlink,
    // and a page must never be served over plain http. Skip host and scheme
    // in local development, where the host is localhost. Path and query are
    // kept.
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.workers.dev');

    const target = new URL(url);
    if (!isLocal) {
      target.protocol = 'https:';
      target.hostname = CANONICAL_HOST;
      target.port = '';
    }
    target.pathname = canonicalPath(url.pathname);

    if (target.href !== url.href) {
      return redirect(target);
    }

    // --- 2b. Stock admin page ---------------------------------------------
    // The page itself holds no data; everything it shows comes from
    // /api/admin/*, which needs ADMIN_TOKEN.
    if (url.pathname === '/admin') {
      const page = withHtmlHeaders(new Response(ADMIN_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      page.headers.set('Cache-Control', 'no-store');
      page.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return page;
    }

    // --- 3. Static assets --------------------------------------------------
    // /404 is the not-found page itself; never serve it as a 200.
    if (env.ASSETS && url.pathname !== '/404') {
      const response = await env.ASSETS.fetch(request);

      if (response.status === 404) {
        // A head-to-head page typed the wrong way round (/compare/b-vs-a)
        // 301s to the page that exists. Slugs contain hyphens, so split on
        // the literal '-vs-' rather than on '-'.
        const pair = url.pathname.startsWith('/compare/')
          ? url.pathname.slice('/compare/'.length).split('-vs-')
          : [];
        if (pair.length === 2 && pair.every((s) => s && !s.includes('/'))) {
          const swapped = new URL(`/compare/${pair[1]}-vs-${pair[0]}${url.search}`, url);
          const probe = await env.ASSETS.fetch(new Request(swapped, { method: 'GET' }));
          if (probe.ok) return redirect(swapped);
        }
        return notFound(request, env, isLocal ? null : ctx);
      }

      // Long-cache assets only when the URL carries a content hash (?v=), so a
      // file replaced in place can never be pinned for a year; bare URLs get a
      // day. Let HTML revalidate so deploys land.
      if (response.ok && /\.(?:css|js|webp|jpe?g|svg|woff2?|mp4|webm)$/.test(url.pathname)) {
        const headers = new Headers(response.headers);
        headers.set(
          'Cache-Control',
          url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=86400, must-revalidate'
        );
        return new Response(response.body, { status: response.status, headers });
      }

      const page = withHtmlHeaders(response);
      // The workers.dev host serves a full copy of the site for previews; keep
      // it out of search results so it cannot compete with www.
      if (url.hostname.endsWith('.workers.dev')) page.headers.set('X-Robots-Tag', 'noindex, nofollow');
      // Count real visits, and verified crawler fetches, on the live site
      // only, not previews or local runs.
      if (!isLocal) {
        countPageView(request, page, env, ctx);
        countCrawl(request, page, env, ctx);
      }
      return page;
    }

    // --- 4. Not found ------------------------------------------------------
    return notFound(request, env, isLocal ? null : ctx);
  },

  // Daily cron (see [triggers] in wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReviewRequests(env));
    ctx.waitUntil(recheckProcessingPayments(env));
    ctx.waitUntil(sendDailyDigest(env));
  },
};
