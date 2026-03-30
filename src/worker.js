/* ============================================
   TUGA HARDWARE — Cloudflare Worker Entry Point
   Routes requests to the API handler or falls
   through to the static-asset binding.
   ============================================ */

import { handleRequest } from './api.js';

export default {
  async fetch(request, env, ctx) {
    // Try the API handler first.
    // It returns a Response for /api/* and /webhooks/* routes,
    // or null for everything else.
    const apiResponse = await handleRequest(request, env);
    if (apiResponse) {
      return apiResponse;
    }

    // Not an API route — let the Cloudflare asset binding serve static files.
    // The `assets` config in wrangler.toml handles this automatically.
    // If the asset binding is available, use it; otherwise fall through.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback: 404 for unknown routes when no asset binding is present
    return new Response('Not Found', { status: 404 });
  },
};
