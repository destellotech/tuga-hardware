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
