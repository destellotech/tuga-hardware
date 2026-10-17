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

   Table (D1 binding DB): see schema/pageviews.sql.
   Without the binding, counting is skipped.
   ============================================ */

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|uptime|headless|lighthouse|pingdom|curl|wget|python|go-http|java\/|node-fetch|axios|okhttp|httpclient|scrapy/i;
const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i;

/**
 * True when this request/response pair is a real person opening a page:
 * a GET for an HTML page that loaded, not a prefetch, not a known bot.
 */
function isPageView(request, response) {
  if (request.method !== 'GET' || response.status !== 200) return false;
  if (!(response.headers.get('Content-Type') || '').includes('text/html')) return false;

  const ua = request.headers.get('User-Agent') || '';
  if (!ua || BOT_UA.test(ua)) return false;
  if (request.cf?.verifiedBotCategory) return false;

  // Browsers mark navigations; prefetches and embeds are not views.
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest && dest !== 'document') return false;
  const purpose = request.headers.get('Sec-Purpose') || request.headers.get('Purpose') || '';
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return false;

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

/** Totals for the last `days` days (today included), for the admin Visits screen. */
export async function pageviewStats(env, days = 30) {
  if (!env.DB) return { days, total: 0, byDay: [], pages: [], referrers: [], countries: [], devices: [] };
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const query = (sql) => env.DB.prepare(sql).bind(since).all().then((r) => r.results);
  const [byDay, pages, referrers, countries, devices] = await Promise.all([
    query('SELECT day, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY day ORDER BY day'),
    query('SELECT path, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 25'),
    query("SELECT referrer, SUM(views) AS views FROM pageviews WHERE day >= ? AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 15"),
    query('SELECT country, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY country ORDER BY views DESC LIMIT 15'),
    query('SELECT device, SUM(views) AS views FROM pageviews WHERE day >= ? GROUP BY device ORDER BY views DESC'),
  ]);

  return { days, since, total: byDay.reduce((n, d) => n + d.views, 0), byDay, pages, referrers, countries, devices };
}
