/* ==========================================================================
   Tell Bing, Yandex, Seznam and the other IndexNow search engines about
   every URL in sitemap.xml, so new and changed pages are crawled quickly.

   Run after a deploy:  npm run indexnow
   By default only URLs whose sitemap <lastmod> is today (UTC) are sent, so
   unchanged pages are not resubmitted. Options:
     npm run indexnow -- --since=2026-10-01   URLs changed on or after a date
     npm run indexnow -- --all                every URL in the sitemap

   The key is the name of the <key>.txt file at the site root, which must be
   live at https://www.tugahardware.com/<key>.txt before this is run.
   Google does not take part in IndexNow; submit the sitemap in Search
   Console for Google.
   ========================================================================== */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'www.tugahardware.com';

const keyFile = readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file (32 hex characters + .txt) at the repo root');
const key = keyFile.replace(/\.txt$/, '');

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
  .map((m) => ({ loc: m[1], lastmod: m[2] || '' }));

const args = process.argv.slice(2);
const all = args.includes('--all');
const sinceArg = args.find((a) => a.startsWith('--since='));
const since = sinceArg ? sinceArg.slice('--since='.length) : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`--since must be YYYY-MM-DD, got ${since}`);

const urlList = entries.filter((e) => all || !e.lastmod || e.lastmod >= since).map((e) => e.loc);
if (!urlList.length) {
  console.log(`IndexNow: no URLs changed since ${since}; nothing to submit (use --all to send every URL)`);
  process.exit(0);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});

console.log(`IndexNow: submitted ${urlList.length} of ${entries.length} URLs${all ? '' : ` (changed since ${since})`}, HTTP ${res.status} ${res.statusText}`);
if (res.status >= 400) {
  console.log(await res.text());
  process.exit(1);
}
