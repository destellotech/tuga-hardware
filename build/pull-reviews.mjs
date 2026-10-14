/* ==========================================================================
   Pull submitted reviews into data/reviews.json for moderation.

   Run:  ADMIN_TOKEN=... npm run reviews

   New reviews arrive with "status": "pending". Set each one to:
     "published"  shown on the product page and in its schema
     "removed"    kept here with a "reason", never shown

   The DMCC Act 2024 bans hiding genuine negative reviews, so only remove a
   review that is unlawful, abusive, not about the product, or not from a
   real buyer, and write down which in "reason". Then run `npm run build`
   and commit. Decisions already made here are never overwritten.
   ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data', 'reviews.json');
const SITE = process.env.SITE_URL || 'https://www.tugahardware.com';
const token = process.env.ADMIN_TOKEN;

if (!token) {
  console.error('Set ADMIN_TOKEN (the Worker secret of the same name) and run again.');
  process.exit(1);
}

const res = await fetch(`${SITE}/api/reviews-export`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`Export failed: HTTP ${res.status}. Check ADMIN_TOKEN matches the Worker secret.`);
  process.exit(1);
}
const { reviews } = await res.json();

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const known = new Set(data.reviews.map((r) => r.id));
let added = 0;
for (const r of reviews) {
  if (known.has(r.id)) continue;
  data.reviews.push({ ...r, status: 'pending' });
  added++;
}
data.reviews.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');

const pending = data.reviews.filter((r) => r.status === 'pending').length;
console.log(`${added} new review(s) added. ${pending} pending moderation in data/reviews.json.`);
