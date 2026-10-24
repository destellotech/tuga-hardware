-- Server-side page view counts (src/pageviews.js), in the tuga-backoffice D1
-- database. One row per day, page, referring site, country and device type;
-- nothing that identifies a visitor.
--   wrangler d1 execute tuga-backoffice --remote --file schema/pageviews.sql
CREATE TABLE IF NOT EXISTS pageviews (
  day      TEXT    NOT NULL,             -- YYYY-MM-DD, UTC
  path     TEXT    NOT NULL,             -- canonical path, e.g. /products/tuga-a8
  referrer TEXT    NOT NULL DEFAULT '',  -- referring host; '' = direct or internal
  country  TEXT    NOT NULL DEFAULT '',  -- ISO code from Cloudflare
  device   TEXT    NOT NULL DEFAULT '',  -- mobile | desktop
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer, country, device)
);

-- Verified crawler hits (src/pageviews.js countCrawl): Googlebot, Bingbot and
-- the rest, by day and page. Says whether the search engines have found a
-- page without waiting for Search Console. The worker creates this table on
-- first use if it is missing, so applying this file is belt and braces.
CREATE TABLE IF NOT EXISTS crawls (
  day      TEXT    NOT NULL,             -- YYYY-MM-DD, UTC
  path     TEXT    NOT NULL,             -- canonical path
  bot      TEXT    NOT NULL,             -- Googlebot, Bingbot, or Cloudflare's verified-bot category
  hits     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, bot)
);

-- Page-shaped requests that got a 404 (src/pageviews.js countMiss), with the
-- referring host, so broken inbound links and old URLs show up. Crawlers are
-- counted here on purpose: a search engine hitting a dead URL is the signal.
CREATE TABLE IF NOT EXISTS misses (
  day      TEXT    NOT NULL,
  path     TEXT    NOT NULL,             -- capped at 200 characters
  referrer TEXT    NOT NULL DEFAULT '',  -- referring host; '' = direct or unknown
  hits     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer)
);
