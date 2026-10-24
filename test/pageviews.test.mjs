// Unit tests for the server-side page view filter (src/pageviews.js).
// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPageView } from '../src/pageviews.js';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': CHROME,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

const req = (headers = {}, { method = 'GET', cf } = {}) => ({
  method,
  headers: new Headers({ ...BROWSER_HEADERS, ...headers }),
  cf,
});
const res = (status = 200, type = 'text/html; charset=utf-8') => ({
  status,
  headers: new Headers({ 'Content-Type': type }),
});
const without = (name) => {
  const h = { ...BROWSER_HEADERS };
  delete h[name];
  return { method: 'GET', headers: new Headers(h) };
};

test('a browser navigation to an HTML page counts', () => {
  assert.equal(isPageView(req(), res()), true);
});

test('an old browser without Sec-Fetch headers still counts', () => {
  const r = without('Sec-Fetch-Mode');
  r.headers.delete('Sec-Fetch-Dest');
  assert.equal(isPageView(r, res()), true);
});

test('only successful GETs for HTML count', () => {
  assert.equal(isPageView(req({}, { method: 'HEAD' }), res()), false);
  assert.equal(isPageView(req(), res(404)), false);
  assert.equal(isPageView(req(), res(200, 'application/json')), false);
});

test('known crawler user agents are left out', () => {
  assert.equal(isPageView(req({ 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), res()), false);
  assert.equal(isPageView(req({ 'User-Agent': 'curl/8.4.0' }), res()), false);
  assert.equal(isPageView(req({ 'User-Agent': 'python-requests/2.32' }), res()), false);
});

test('a script with a browser user agent but no browser headers is left out', () => {
  assert.equal(isPageView(without('Accept-Language'), res()), false);
  assert.equal(isPageView(req({ Accept: '*/*' }), res()), false);
  assert.equal(isPageView(req({ 'User-Agent': 'Go-http-client/2.0' }), res()), false);
  assert.equal(isPageView(req({ 'User-Agent': 'MyFetcher/1.0 (+https://example.com)' }), res()), false);
});

test('prefetches, prerenders and embedded loads are not views', () => {
  assert.equal(isPageView(req({ 'Sec-Fetch-Dest': 'iframe' }), res()), false);
  assert.equal(isPageView(req({ 'Sec-Fetch-Mode': 'cors' }), res()), false);
  assert.equal(isPageView(req({ 'Sec-Purpose': 'prefetch' }), res()), false);
  assert.equal(isPageView(req({ Purpose: 'prefetch' }), res()), false);
});

test('Cloudflare bot signals rule a request out when present', () => {
  assert.equal(isPageView(req({}, { cf: { verifiedBotCategory: 'Search Engine Crawler' } }), res()), false);
  assert.equal(isPageView(req({}, { cf: { botManagement: { verifiedBot: true } } }), res()), false);
  assert.equal(isPageView(req({}, { cf: { botManagement: { score: 5 } } }), res()), false);
  assert.equal(isPageView(req({}, { cf: { botManagement: { score: 85 } } }), res()), true);
  assert.equal(isPageView(req({}, { cf: { botManagement: { score: 0 } } }), res()), true);
  assert.equal(isPageView(req({}, { cf: { country: 'GB' } }), res()), true);
});
