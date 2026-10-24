// The Monday "Last 7 days on the site" digest section (src/backoffice.js),
// built against in-memory SQLite tables and a KV-shaped fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { buildSiteDigest } from '../src/backoffice.js';

const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);

function env() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema/pageviews.sql', import.meta.url), 'utf8'));
  const add = (ago, path, country, views, referrer = '') =>
    db.prepare('INSERT INTO pageviews (day, path, referrer, country, device, views) VALUES (?, ?, ?, ?, ?, ?)')
      .run(day(ago), path, referrer, country, 'desktop', views);
  add(1, '/products/tuga-a8', 'GB', 8, 'google.com');
  add(2, '/', 'GB', 4);
  add(3, '/cart', 'GB', 2);
  add(2, '/', 'US', 50);
  add(9, '/', 'GB', 6);
  add(1, '/blog/x', 'GB', 1, 'trade-forum.example');
  db.prepare('INSERT INTO crawls (day, path, bot, hits) VALUES (?, ?, ?, ?)').run(day(1), '/blog/x', 'Googlebot', 7);
  db.prepare('INSERT INTO misses (day, path, referrer, hits) VALUES (?, ?, ?, ?)').run(day(1), '/products/tuga-t8', 'google.com', 3);
  const DB = {
    prepare: (sql) => ({
      bind: (...args) => ({ all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }) }),
    }),
  };
  const ORDERS = {
    list: async () => ({ keys: [{ name: 'order:a', metadata: { paidAt: `${day(1)}T09:00:00Z`, status: 'paid' } }], list_complete: true }),
    get: async () => null,
  };
  return { DB, ORDERS };
}

test('the site digest leads with the UK week and keeps every line numbers-first', async () => {
  const s = await buildSiteDigest(env(), 7);
  assert.equal(s.title, 'Last 7 days on the site');
  assert.equal(s.link, '#/visits');
  assert.equal(s.lines[0], '15 UK page views, up 150% on the 7 days before (6); 1 order paid, 8 product views per order; 8 product page views, 2 basket views');
  assert.ok(s.lines.includes('8 views (was 0) · /products/tuga-a8'));
  assert.ok(s.lines.includes('From search:'));
  assert.ok(s.lines.includes('8 from search (was 0) · /products/tuga-a8'));
  assert.ok(s.lines.includes('1 visits · new referrer: trade-forum.example'));
  assert.ok(s.lines.includes('7 Googlebot crawler hits'));
  assert.ok(s.lines.includes('3 x 404 · /products/tuga-t8 (from google.com)'));
  for (const line of s.lines) assert.ok(!/[\u2013\u2014]/.test(line), `no dashes: ${line}`);
  assert.ok(s.lines.length <= 20, 'fits the digest email without truncation');
});

test('without the D1 binding there is no section', async () => {
  assert.equal(await buildSiteDigest({ ORDERS: {} }, 7), null);
});
