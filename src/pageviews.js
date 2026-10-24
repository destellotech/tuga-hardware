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

   Table (D1 binding DB): see schema/pageviews.sql.
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
 * Totals for the last `days` days (today included) for the admin Visits
 * screen, with the same-length period before it for comparison. With
 * `uk` true, every figure except the country table counts GB visits only,
 * which is the trend worth watching for a UK-only shop: crawlers and
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
