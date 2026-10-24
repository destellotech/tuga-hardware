// Unit tests for the crawler classification and the 404 counter's page
// filter (src/pageviews.js). Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrawler, isPageMiss, countCrawl, countMiss } from '../src/pageviews.js';

const req = (ua, cf, { method = 'GET', url = 'https://www.tugahardware.com/blog/x', referer } = {}) => ({
  method,
  url,
  headers: new Headers({ 'User-Agent': ua, ...(referer ? { Referer: referer } : {}) }),
  cf,
});
const html = { status: 200, headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }) };

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BINGBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

test('named crawlers are classified by name', () => {
  assert.equal(classifyCrawler(req(GOOGLEBOT)), 'Googlebot');
  assert.equal(classifyCrawler(req(BINGBOT)), 'Bingbot');
  assert.equal(classifyCrawler(req('DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)')), 'DuckDuckBot');
  assert.equal(classifyCrawler(req('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)')), 'Applebot');
  assert.equal(classifyCrawler(req('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)')), 'YandexBot');
});

test('a browser is not a crawler', () => {
  assert.equal(classifyCrawler(req(CHROME)), '');
  assert.equal(classifyCrawler(req(CHROME, { country: 'GB' })), '');
});

test('a verified bot we do not name takes its Cloudflare category', () => {
  assert.equal(classifyCrawler(req('Mozilla/5.0 (compatible; SeznamBot/4.0)', { verifiedBotCategory: 'Search Engine Crawler' })), 'Search Engine Crawler');
});

test('a Googlebot user agent that Cloudflare says is unverified is not Googlebot', () => {
  // The request carries a bot signal (the category key exists, empty), so
  // the name alone is not trusted.
  assert.equal(classifyCrawler(req(GOOGLEBOT, { verifiedBotCategory: '' })), '');
  assert.equal(classifyCrawler(req(GOOGLEBOT, { botManagement: { verifiedBot: false, score: 1 } })), '');
  // With verification it counts, under its own name rather than the category.
  assert.equal(classifyCrawler(req(GOOGLEBOT, { verifiedBotCategory: 'Search Engine Crawler' })), 'Googlebot');
  assert.equal(classifyCrawler(req(GOOGLEBOT, { botManagement: { verifiedBot: true } })), 'Googlebot');
});

test('only page-shaped 404s are counted', () => {
  const at = (path, method = 'GET') => isPageMiss(req(CHROME, undefined, { url: `https://www.tugahardware.com${path}`, method }));
  assert.equal(at('/products/tuga-t8'), true);
  assert.equal(at('/old-page'), true);
  assert.equal(at('/old-page', 'HEAD'), true);
  assert.equal(at('/old-page', 'POST'), false);
  assert.equal(at('/img/missing.webp'), false);
  assert.equal(at('/css/old.css'), false);
  assert.equal(at('/fonts/x.woff2'), false);
  assert.equal(at('/sitemap-old.xml'), false);
});

/** A D1-shaped recorder: every statement run is captured with its bindings. */
function recorder() {
  const runs = [];
  return {
    runs,
    db: { prepare: (sql) => ({ bind: (...args) => ({ run: async () => runs.push({ sql, args }) }), run: async () => runs.push({ sql, args: [] }) }) },
    ctx: { waitUntil: (p) => runs.push(p) },
  };
}

test('countCrawl writes one upsert for a crawler and nothing for a browser', async () => {
  const r = recorder();
  countCrawl(req(GOOGLEBOT), html, { DB: r.db }, r.ctx);
  await Promise.all(r.runs.filter((x) => x instanceof Promise));
  const upserts = r.runs.filter((x) => x.sql && x.sql.includes('INTO crawls'));
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0].args.slice(1), ['/blog/x', 'Googlebot']);

  const b = recorder();
  countCrawl(req(CHROME), html, { DB: b.db }, b.ctx);
  assert.equal(b.runs.length, 0, 'no background work scheduled at all');
});

test('countMiss records the referring host and caps the path', async () => {
  const r = recorder();
  const long = '/' + 'a'.repeat(400);
  countMiss(req(CHROME, undefined, { url: `https://www.tugahardware.com${long}`, referer: 'https://www.google.com/' }), { DB: r.db }, r.ctx);
  await Promise.all(r.runs.filter((x) => x instanceof Promise));
  const upserts = r.runs.filter((x) => x.sql && x.sql.includes('INTO misses'));
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].args[1].length, 200);
  assert.equal(upserts[0].args[2], 'google.com');
});
