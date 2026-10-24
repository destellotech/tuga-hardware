// Exercises pageviewStats (src/pageviews.js) against a real SQLite table
// built from schema/pageviews.sql, through a minimal D1-shaped wrapper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pageviewStats } from '../src/pageviews.js';

const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema/pageviews.sql', import.meta.url), 'utf8'));
  const add = (ago, path, country, device, views, referrer = '') =>
    db.prepare('INSERT INTO pageviews (day, path, referrer, country, device, views) VALUES (?, ?, ?, ?, ?, ?)')
      .run(day(ago), path, referrer, country, device, views);
  // This 7-day window: 10 UK views and 30 from elsewhere.
  add(0, '/', 'GB', 'mobile', 4);
  add(2, '/products/tuga-a8', 'GB', 'desktop', 6, 'google.com');
  add(1, '/', 'US', 'desktop', 30);
  // The 7 days before: 5 UK views on the A8 page, 3 from elsewhere.
  add(9, '/products/tuga-a8', 'GB', 'desktop', 5);
  add(10, '/', 'SG', 'desktop', 3);
  // Older than both windows: must not appear anywhere.
  add(20, '/', 'GB', 'desktop', 99);
  return {
    prepare: (sql) => ({
      bind: (...args) => ({ all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }) }),
    }),
  };
}

test('UK-only stats compare this period with the one before', async () => {
  const r = await pageviewStats({ DB: d1() }, 7, { uk: true });
  assert.equal(r.uk, true);
  assert.equal(r.total, 10);
  assert.equal(r.previous.total, 5);
  assert.equal(r.byDay.length, 7, 'every day in the window, zero-filled');
  assert.equal(r.byDay[6].day, day(0));
  assert.deepEqual(r.byDay[6], { day: day(0), views: 4, uk: 4, mobile: 4 });
  assert.deepEqual(r.byDay[5], { day: day(1), views: 0, uk: 0, mobile: 0 });
  assert.deepEqual(r.pages, [{ path: '/products/tuga-a8', views: 6, previous: 5 }, { path: '/', views: 4, previous: 0 }]);
  assert.deepEqual(r.referrers, [{ referrer: 'google.com', views: 6 }]);
  // Countries always show every visit, so the UK share stays visible.
  assert.deepEqual(r.countries.map((c) => c.country), ['US', 'GB']);
});

test('everywhere stats count all countries and carry the UK split per day', async () => {
  const r = await pageviewStats({ DB: d1() }, 7, { uk: false });
  assert.equal(r.total, 40);
  assert.equal(r.previous.total, 8);
  assert.deepEqual(r.byDay[5], { day: day(1), views: 30, uk: 0, mobile: 0 });
  assert.equal(r.pages[0].path, '/');
  assert.equal(r.pages[0].views, 34);
});

test('without a database binding the shape is still complete', async () => {
  const r = await pageviewStats({}, 30);
  assert.equal(r.total, 0);
  assert.deepEqual(r.byDay, []);
  assert.equal(r.previous.total, 0);
  assert.ok(r.strictSince);
});
