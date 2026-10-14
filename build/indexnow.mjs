/* ==========================================================================
   Tell Bing, Yandex, Seznam and the other IndexNow search engines about
   every URL in sitemap.xml, so new and changed pages are crawled quickly.

   Run after a deploy:  npm run indexnow

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
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});

console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status} ${res.statusText}`);
if (res.status >= 400) {
  console.log(await res.text());
  process.exit(1);
}
