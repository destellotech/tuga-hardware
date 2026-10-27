/* ============================================
   TUGA HARDWARE — Server-side page view counts
   The worker sees every page request before any
   browser blocker can, so these numbers include
   visitors who block Google Analytics or decline
   cookies. Nothing is stored on the visitor's
   device and nothing identifies them: no IP, no
   user agent, no cookie. Each row is a daily
   counter per page, referrer site, country and
   device type, so it needs no consent.

   Only requests shaped like a browser navigation
   are counted (isPageView), so the trend is
   people, not crawlers with a browser user agent.

   Two sidecar tables, same database: crawls
   (verified search engine hits, so we can see
   what Google has found) and misses (404s for
   page-shaped URLs, so broken links show up).

   Tables (D1 binding DB): see schema/pageviews.sql.
   Without the binding, counting is skipped.
   ============================================ */

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|uptime|headless|lighthouse|pingdom|curl|wget|python|go-http|java\/|node-fetch|axios|okhttp|httpclient|scrapy/i;
const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i;

/**
 * The day the stricter filter below went live. Rows before it include
 * crawlers that copied a browser user agent, so the Visits screen marks
 * the boundary rather than comparing across it. Update when deploying.
 */
export const STRICT_SINCE = '2026-10-24';

/**
 * True when this request/response pair is a real person opening a page.
 *
 * A scraper that copies a browser's user agent rarely copies the rest of
 * what a browser sends on a navigation, so the request has to look like one
 * end to end: an Accept header that asks for HTML, an Accept-Language, and,
 * where the browser sends Sec-Fetch headers (every current browser does),
 * a top-level navigation rather than a prefetch or an embed. Cloudflare's
 * verified-bot category always rules a request out, and so does a low bot
 * score where the plan provides one.
 */
export function isPageView(request, response) {
  if (request.method !== 'GET' || response.status !== 200) return false;
  if (!(response.headers.get('Content-Type') || '').includes('text/html')) return false;

  const h = (name) => request.headers.get(name) || '';
  const ua = h('User-Agent');
  if (!ua || BOT_UA.test(ua)) return false;
  // Every browser's user agent starts this way; most HTTP libraries' do not.
  if (!ua.startsWith('Mozilla/5.0')) return false;
  if (!h('Accept').includes('text/html')) return false;
  if (!h('Accept-Language')) return false;

  // Browsers mark navigations; prefetches, embeds and fetches are not views.
  const mode = h('Sec-Fetch-Mode');
  if (mode && mode !== 'navigate') return false;
  const dest = h('Sec-Fetch-Dest');
  if (dest && dest !== 'document') return false;
  const purpose = h('Sec-Purpose') || h('Purpose');
  if (/prefetch|prerender/.test(purpose)) return false;

  const cf = request.cf || {};
  if (cf.verifiedBotCategory) return false;
  const bm = cf.botManagement;
  if (bm) {
    if (bm.verifiedBot) return false;
    // Bot score runs 1 (certainly automated) to 99 (certainly human); 0 is
    // "not scored". Under 30 is Cloudflare's "likely automated" band.
    if (typeof bm.score === 'number' && bm.score > 0 && bm.score < 30) return false;
  }
  return true;
}

/** The referring site's host, '' for direct visits and links within the site. */
function referrerHost(request, ownHost) {
  const ref = request.headers.get('Referer');
  if (!ref) return '';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return host === ownHost.replace(/^www\./, '') ? '' : host;
  } catch {
    return '';
  }
}

/**
 * Count a page view in the background. Never delays or breaks the page:
 * the write runs under waitUntil and any error is only logged.
 */
export function countPageView(request, response, env, ctx) {
  if (!env.DB || !isPageView(request, response)) return;

  const url = new URL(request.url);
  const ua = request.headers.get('User-Agent') || '';
  const row = [
    new Date().toISOString().slice(0, 10),
    url.pathname,
    referrerHost(request, url.hostname),
    request.cf?.country || '',
    MOBILE_UA.test(ua) ? 'mobile' : 'desktop',
  ];

  ctx.waitUntil(
    env.DB.prepare(
      `INSERT INTO pageviews (day, path, referrer, country, device, views) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(day, path, referrer, country, device) DO UPDATE SET views = views + 1`
    )
      .bind(...row)
      .run()
      .catch((err) => console.error('Page view count failed:', err))
  );
}

/** YYYY-MM-DD in UTC for a timestamp. */
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Which search engine crawler a request is, or '' for none. The user agent
 * name wins because it is more specific than Cloudflare's category
 * ("Search Engine Crawler" covers all of them); the category catches the
 * verified bots we do not name. Scrapers claiming to be Googlebot are a
 * known trick, so where Cloudflare gives a verification signal at all, a
 * named bot only counts when that signal agrees.
 */
const CRAWLER_UA = /(Googlebot|Bingbot|DuckDuckBot|Applebot|YandexBot)/i;
const CRAWLER_NAMES = { googlebot: 'Googlebot', bingbot: 'Bingbot', duckduckbot: 'DuckDuckBot', applebot: 'Applebot', yandexbot: 'YandexBot' };

export function classifyCrawler(request) {
  const cf = request.cf || {};
  const hasSignal = 'verifiedBotCategory' in cf || Boolean(cf.botManagement);
  const verified = Boolean(cf.verifiedBotCategory) || Boolean(cf.botManagement?.verifiedBot);
  const m = CRAWLER_UA.exec(request.headers.get('User-Agent') || '');
  if (m && (!hasSignal || verified)) return CRAWLER_NAMES[m[1].toLowerCase()];
  if (cf.verifiedBotCategory) return String(cf.verifiedBotCategory);
  return '';
}

/**
 * The crawls and misses tables arrived after pageviews, so production may
 * not have them yet. Create them once per isolate, the first time a writer
 * needs them, and keep the promise so every later write just awaits it.
 */
const SIDECAR_DDL = [
  'CREATE TABLE IF NOT EXISTS crawls (day TEXT NOT NULL, path TEXT NOT NULL, bot TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path, bot))',
  "CREATE TABLE IF NOT EXISTS misses (day TEXT NOT NULL, path TEXT NOT NULL, referrer TEXT NOT NULL DEFAULT '', hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path, referrer))",
];
let sidecarReady = null;
function ensureSidecarTables(db) {
  if (!sidecarReady) {
    sidecarReady = Promise.all(SIDECAR_DDL.map((sql) => db.prepare(sql).run())).catch((err) => {
      sidecarReady = null; // so the next write tries again
      throw err;
    });
  }
  return sidecarReady;
}

/**
 * Count a verified crawler fetching a page that exists. Same background
 * pattern as countPageView: never delays the response, errors only logged.
 */
export function countCrawl(request, response, env, ctx) {
  if (!env.DB || request.method !== 'GET' || response.status !== 200) return;
  if (!(response.headers.get('Content-Type') || '').includes('text/html')) return;
  const bot = classifyCrawler(request);
  if (!bot) return;
  const url = new URL(request.url);
  ctx.waitUntil(
    ensureSidecarTables(env.DB)
      .then(() =>
        env.DB.prepare(
          `INSERT INTO crawls (day, path, bot, hits) VALUES (?, ?, ?, 1)
           ON CONFLICT(day, path, bot) DO UPDATE SET hits = hits + 1`
        )
          .bind(dayOf(Date.now()), url.pathname.slice(0, 200), bot)
          .run()
      )
      .catch((err) => console.error('Crawl count failed:', err))
  );
}

/** File extensions that mean an asset, not a page; their 404s are noise. */
const ASSET_EXT = /\.(?:css|js|mjs|map|json|xml|txt|webp|jpe?g|png|gif|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|pdf|zip)$/i;

/** True when a 404 is for something that looks like a page URL. */
export function isPageMiss(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  return !ASSET_EXT.test(new URL(request.url).pathname);
}

/**
 * Count a 404 for a page-shaped URL, with the referring host. Bots are
 * counted on purpose: a crawler hitting an old URL is exactly the thing
 * to redirect. The path is capped so a junk URL cannot bloat the table.
 */
export function countMiss(request, env, ctx) {
  if (!env.DB || !isPageMiss(request)) return;
  const url = new URL(request.url);
  ctx.waitUntil(
    ensureSidecarTables(env.DB)
      .then(() =>
        env.DB.prepare(
          `INSERT INTO misses (day, path, referrer, hits) VALUES (?, ?, ?, 1)
           ON CONFLICT(day, path, referrer) DO UPDATE SET hits = hits + 1`
        )
          .bind(dayOf(Date.now()), url.pathname.slice(0, 200), referrerHost(request, url.hostname))
          .run()
      )
      .catch((err) => console.error('Miss count failed:', err))
  );
}

/**
 * Totals for the last `days` days (today included) for the admin Visits
 * screen, with the same-length period before it for comparison. With
 * `uk` true, every figure except the country table counts GB visits only,
 * which is the trend worth watching for a UK-first shop: crawlers and
 * scrapers mostly come from elsewhere.
 */
export async function pageviewStats(env, days = 30, { uk = false } = {}) {
  const since = dayOf(Date.now() - (days - 1) * 86400000);
  const prevSince = dayOf(Date.now() - (2 * days - 1) * 86400000);
  const empty = {
    days, since, uk, total: 0, byDay: [], pages: [], referrers: [], countries: [], devices: [],
    previous: { since: prevSince, total: 0 }, strictSince: STRICT_SINCE,
  };
  if (!env.DB) return empty;

  const where = uk ? "AND country = 'GB'" : '';
  const query = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results);
  const [byDayRows, pages, referrers, countries, devices, prevPages] = await Promise.all([
    query(
      `SELECT day, SUM(views) AS views,
              SUM(CASE WHEN country = 'GB' THEN views ELSE 0 END) AS uk,
              SUM(CASE WHEN device = 'mobile' THEN views ELSE 0 END) AS mobile
       FROM pageviews WHERE day >= ? ${where} GROUP BY day ORDER BY day`,
      since
    ),
    query(`SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? ${where} GROUP BY path ORDER BY views DESC LIMIT 25`, since),
    query(`SELECT referrer, SUM(views) AS views FROM pageviews WHERE day >= ? AND referrer != '' ${where} GROUP BY referrer ORDER BY views DESC LIMIT 15`, since),
    query('SELECT country, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY country ORDER BY views DESC LIMIT 15', since),
    query(`SELECT device, SUM(views) AS views FROM pageviews WHERE day >= ? ${where} GROUP BY device ORDER BY views DESC`, since),
    query(`SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? AND day < ? ${where} GROUP BY path`, prevSince, since),
  ]);

  // Every day in the window, zero-filled, so a quiet day shows as a gap in
  // the chart rather than vanishing from it.
  const have = new Map(byDayRows.map((r) => [r.day, r]));
  const byDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOf(Date.now() - i * 86400000);
    const r = have.get(day);
    byDay.push({ day, views: r?.views || 0, uk: r?.uk || 0, mobile: r?.mobile || 0 });
  }

  const prevByPath = new Map(prevPages.map((r) => [r.path, r.views]));
  for (const p of pages) p.previous = prevByPath.get(p.path) || 0;

  return {
    ...empty,
    total: byDay.reduce((n, d) => n + d.views, 0),
    byDay, pages, referrers, countries, devices,
    previous: { since: prevSince, total: prevPages.reduce((n, r) => n + r.views, 0) },
  };
}

/** Referrers that mean a visitor arrived from a search result. */
const SEARCH_WHERE =
  "(referrer LIKE 'google.%' OR referrer LIKE '%bing.com' OR referrer = 'duckduckgo.com' OR referrer LIKE '%ecosia.org' OR referrer LIKE '%yahoo.com')";

/** Paths whose crawl dates say whether the content work is being found. */
const CONTENT_WHERE = "(path LIKE '/blog/%' OR path LIKE '/works-with/%' OR path LIKE '/for/%' OR path LIKE '/compare/%')";

/**
 * The second half of the Visits screen: where search sends people, how
 * views turn into orders, what the crawlers have fetched, and which URLs
 * are dead. Landing pages and the funnel follow the UK switch; crawls and
 * misses never do, since those are about machines, not customers.
 */
export async function siteStats(env, days = 30, { uk = false } = {}) {
  const since = dayOf(Date.now() - (days - 1) * 86400000);
  const prevSince = dayOf(Date.now() - (2 * days - 1) * 86400000);
  const empty = {
    landing: [],
    funnel: { products: 0, productsMobile: 0, cart: 0, confirmations: 0 },
    crawls: { byBot: [], recent: [] },
    misses: [],
  };
  if (!env.DB) return empty;

  const where = uk ? "AND country = 'GB'" : '';
  const query = (sql, ...args) =>
    env.DB.prepare(sql).bind(...args).all().then((r) => r.results).catch((err) => {
      // The sidecar tables may not exist until the first crawl or 404 after
      // deploy; an empty list is the honest answer until then.
      console.error('Site stats query failed:', err);
      return [];
    });

  const [landing, prevLanding, funnelRows, byBot, recent, misses] = await Promise.all([
    query(`SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? AND ${SEARCH_WHERE} ${where} GROUP BY path ORDER BY views DESC LIMIT 15`, since),
    query(`SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? AND day < ? AND ${SEARCH_WHERE} ${where} GROUP BY path`, prevSince, since),
    query(
      `SELECT
         SUM(CASE WHEN path LIKE '/products/%' AND path != '/products/' THEN views ELSE 0 END) AS products,
         SUM(CASE WHEN path LIKE '/products/%' AND path != '/products/' AND device = 'mobile' THEN views ELSE 0 END) AS productsMobile,
         SUM(CASE WHEN path = '/cart' THEN views ELSE 0 END) AS cart,
         SUM(CASE WHEN path = '/order-confirmation' THEN views ELSE 0 END) AS confirmations
       FROM pageviews WHERE day >= ? ${where}`,
      since
    ),
    query('SELECT bot, SUM(hits) AS hits FROM crawls WHERE day >= ? GROUP BY bot ORDER BY hits DESC', since),
    query(`SELECT path, MAX(day) AS day, SUM(hits) AS hits FROM crawls WHERE day >= ? AND ${CONTENT_WHERE} GROUP BY path ORDER BY day DESC, hits DESC LIMIT 10`, since),
    query('SELECT path, referrer, SUM(hits) AS hits FROM misses WHERE day >= ? GROUP BY path, referrer ORDER BY hits DESC LIMIT 15', since),
  ]);

  const prevByPath = new Map(prevLanding.map((r) => [r.path, r.views]));
  for (const p of landing) p.previous = prevByPath.get(p.path) || 0;
  const f = funnelRows[0] || {};
  return {
    landing,
    funnel: { products: f.products || 0, productsMobile: f.productsMobile || 0, cart: f.cart || 0, confirmations: f.confirmations || 0 },
    crawls: { byBot, recent },
    misses,
  };
}

/**
 * Orders paid on or after `since` (YYYY-MM-DD), from the ORDERS KV in one
 * list pass. Keys carry paidAt and status as metadata (src/orders.js), so
 * most are decided without a read; the few legacy keys without metadata are
 * read, up to a cap, so a run can never exhaust the KV operation limit.
 * Returns null without the binding, so the screen can say "not available"
 * rather than "0".
 */
export async function countOrdersSince(kv, since, { maxReads = 50 } = {}) {
  if (!kv) return null;
  const sinceMs = Date.parse(`${since}T00:00:00Z`);
  const dead = new Set(['refunded', 'cancelled', 'disputed']);
  let orders = 0;
  let reads = 0;
  let cursor;
  do {
    const page = await kv.list({ prefix: 'order:', cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const { name, metadata } of page.keys) {
      let paidAt = metadata?.paidAt;
      let status = metadata?.status;
      if (!metadata) {
        if (reads >= maxReads) continue;
        reads++;
        const raw = await kv.get(name);
        if (!raw) continue;
        const order = JSON.parse(raw);
        paidAt = order.paidAt || order.createdAt;
        status = order.status;
      }
      if (!paidAt || dead.has(status)) continue;
      if (Date.parse(paidAt) >= sinceMs) orders++;
    }
  } while (cursor);
  return orders;
}

/**
 * Referring hosts seen in the last `days` days that had sent nothing in the
 * `lookback` days before: someone new has linked to the site.
 */
export async function newReferrers(env, days = 7, lookback = 28) {
  if (!env.DB) return [];
  const since = dayOf(Date.now() - (days - 1) * 86400000);
  const before = dayOf(Date.now() - (days + lookback - 1) * 86400000);
  return env.DB.prepare(
    `SELECT referrer, SUM(views) AS views FROM pageviews
     WHERE day >= ? AND referrer != ''
       AND referrer NOT IN (SELECT referrer FROM pageviews WHERE day >= ? AND day < ?)
     GROUP BY referrer ORDER BY views DESC LIMIT 10`
  ).bind(since, before, since).all().then((r) => r.results);
}
