// Exercises pageviewStats, siteStats, countOrdersSince and newReferrers
// (src/pageviews.js) against real SQLite tables built from
// schema/pageviews.sql, through a minimal D1-shaped wrapper, and a
// KV-shaped fake for the orders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pageviewStats, siteStats, countOrdersSince, newReferrers } from '../src/pageviews.js';

const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);

function d1() {
  const db = new DatabaseSync(':memory:');
  // The schema file creates pageviews, crawls and misses.
  db.exec(readFileSync(new URL('../schema/pageviews.sql', import.meta.url), 'utf8'));
  const add = (ago, path, country, device, views, referrer = '') =>
    db.prepare('INSERT INTO pageviews (day, path, referrer, country, device, views) VALUES (?, ?, ?, ?, ?, ?)')
      .run(day(ago), path, referrer, country, device, views);
  // This 7-day window: 17 UK views and 30 from elsewhere.
  add(0, '/', 'GB', 'mobile', 4);
  add(2, '/products/tuga-a8', 'GB', 'desktop', 6, 'google.com');
  add(1, '/', 'US', 'desktop', 30);
  add(1, '/blog/mil-std-810h-explained', 'GB', 'mobile', 3, 'google.co.uk');
  add(1, '/cart', 'GB', 'mobile', 2);
  add(0, '/order-confirmation', 'GB', 'mobile', 1);
  add(0, '/', 'GB', 'desktop', 1, 'forum.example.org');
  // The 7 days before: 6 UK views (5 on the A8 page, 1 Bing landing on the
  // guide) and 3 from elsewhere.
  add(9, '/products/tuga-a8', 'GB', 'desktop', 5);
  add(8, '/blog/mil-std-810h-explained', 'GB', 'desktop', 1, 'bing.com');
  add(10, '/', 'SG', 'desktop', 3);
  // Older than both windows: must not appear anywhere, except as the
  // lookback that makes google.com an old referrer.
  add(20, '/', 'GB', 'desktop', 99, 'google.com');

  const crawl = (ago, path, bot, hits) =>
    db.prepare('INSERT INTO crawls (day, path, bot, hits) VALUES (?, ?, ?, ?)').run(day(ago), path, bot, hits);
  crawl(3, '/blog/mil-std-810h-explained', 'Googlebot', 2);
  crawl(1, '/works-with/jobber', 'Googlebot', 1);
  crawl(2, '/', 'Bingbot', 4);
  crawl(12, '/for/construction', 'Googlebot', 9);

  const miss = (ago, path, referrer, hits) =>
    db.prepare('INSERT INTO misses (day, path, referrer, hits) VALUES (?, ?, ?, ?)').run(day(ago), path, referrer, hits);
  miss(2, '/products/tuga-t8', 'google.com', 5);
  miss(4, '/old-page', '', 1);

  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
        run: async () => ({ success: true, results: db.prepare(sql).run(...args) }),
      }),
    }),
  };
}

/** A KV-shaped fake: list() pages keys with metadata, get() reads legacy ones. */
function kv(entries) {
  return {
    list: async ({ prefix }) => ({
      keys: entries.filter((e) => e.name.startsWith(prefix)).map(({ name, metadata }) => ({ name, metadata })),
      list_complete: true,
    }),
    get: async (name) => {
      const e = entries.find((x) => x.name === name);
      return e ? JSON.stringify(e.value) : null;
    },
  };
}

test('UK-only stats compare this period with the one before', async () => {
  const r = await pageviewStats({ DB: d1() }, 7, { uk: true });
  assert.equal(r.uk, true);
  assert.equal(r.total, 17);
  assert.equal(r.previous.total, 6);
  assert.equal(r.byDay.length, 7, 'every day in the window, zero-filled');
  assert.equal(r.byDay[6].day, day(0));
  assert.deepEqual(r.byDay[6], { day: day(0), views: 6, uk: 6, mobile: 5 });
  assert.deepEqual(r.byDay[5], { day: day(1), views: 5, uk: 5, mobile: 5 });
  assert.deepEqual(r.byDay[3], { day: day(3), views: 0, uk: 0, mobile: 0 });
  assert.deepEqual(r.pages.slice(0, 2), [{ path: '/products/tuga-a8', views: 6, previous: 5 }, { path: '/', views: 5, previous: 0 }]);
  assert.deepEqual(r.referrers[0], { referrer: 'google.com', views: 6 });
  // Countries always show every visit, so the UK share stays visible.
  assert.deepEqual(r.countries.map((c) => c.country), ['US', 'GB']);
});

test('everywhere stats count all countries and carry the UK split per day', async () => {
  const r = await pageviewStats({ DB: d1() }, 7, { uk: false });
  assert.equal(r.total, 47);
  assert.equal(r.previous.total, 9);
  assert.deepEqual(r.byDay[5], { day: day(1), views: 35, uk: 5, mobile: 5 });
  assert.equal(r.pages[0].path, '/');
  assert.equal(r.pages[0].views, 35);
});

test('without a database binding the shape is still complete', async () => {
  const r = await pageviewStats({}, 30);
  assert.equal(r.total, 0);
  assert.deepEqual(r.byDay, []);
  assert.equal(r.previous.total, 0);
  assert.ok(r.strictSince);
  const s = await siteStats({}, 30);
  assert.deepEqual(s.landing, []);
  assert.equal(s.funnel.products, 0);
  assert.deepEqual(s.crawls, { byBot: [], recent: [] });
});

test('search landing pages come from search engine referrers only, with the previous period', async () => {
  const s = await siteStats({ DB: d1() }, 7, { uk: true });
  // google.com and google.co.uk count; forum.example.org does not.
  assert.deepEqual(s.landing, [
    { path: '/products/tuga-a8', views: 6, previous: 0 },
    { path: '/blog/mil-std-810h-explained', views: 3, previous: 1 },
  ]);
});

test('the funnel counts product, basket and confirmation views in the period', async () => {
  const uk = await siteStats({ DB: d1() }, 7, { uk: true });
  assert.deepEqual(uk.funnel, { products: 6, productsMobile: 0, cart: 2, confirmations: 1 });
  const all = await siteStats({ DB: d1() }, 7, { uk: false });
  assert.equal(all.funnel.products, 6, 'the US views are on the home page, not a product');
});

test('crawl activity is never filtered by country and lists content pages by last fetch', async () => {
  const s = await siteStats({ DB: d1() }, 7, { uk: true });
  assert.deepEqual(s.crawls.byBot, [{ bot: 'Bingbot', hits: 4 }, { bot: 'Googlebot', hits: 3 }]);
  // The home page is not a content page; the construction page is too old.
  assert.deepEqual(s.crawls.recent, [
    { path: '/works-with/jobber', day: day(1), hits: 1 },
    { path: '/blog/mil-std-810h-explained', day: day(3), hits: 2 },
  ]);
});

test('dead URLs are listed with their referrer, most hit first', async () => {
  const s = await siteStats({ DB: d1() }, 7);
  assert.deepEqual(s.misses, [
    { path: '/products/tuga-t8', referrer: 'google.com', hits: 5 },
    { path: '/old-page', referrer: '', hits: 1 },
  ]);
});

test('new referrers are hosts with no visits in the lookback', async () => {
  const r = await newReferrers({ DB: d1() }, 7, 28);
  // google.co.uk and the forum are new; google.com sent a visit 20 days ago.
  assert.deepEqual(r.map((x) => x.referrer), ['google.co.uk', 'forum.example.org']);
});

test('orders in the period are counted from key metadata, reading only legacy keys', async () => {
  const since = day(6);
  const store = kv([
    { name: 'order:a', metadata: { paidAt: `${day(1)}T10:00:00Z`, status: 'paid' } },
    { name: 'order:b', metadata: { paidAt: `${day(2)}T10:00:00Z`, status: 'refunded' } },
    { name: 'order:c', metadata: { paidAt: `${day(30)}T10:00:00Z`, status: 'paid' } },
    { name: 'order:d', metadata: { paidAt: null, status: 'pending' } },
    { name: 'order:e', value: { paidAt: `${day(3)}T10:00:00Z`, status: 'paid' } },
    { name: 'order:f', value: { createdAt: `${day(0)}T10:00:00Z`, status: 'paid' } },
    { name: 'review:x', metadata: { paidAt: `${day(0)}T10:00:00Z`, status: 'paid' } },
  ]);
  assert.equal(await countOrdersSince(store, since), 3);
  assert.equal(await countOrdersSince(store, since, { maxReads: 1 }), 2, 'the read cap holds');
  assert.equal(await countOrdersSince(null, since), null);
});
