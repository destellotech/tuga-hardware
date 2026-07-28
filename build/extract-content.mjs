/* ==========================================================================
   One-off migration: pull article/legal prose out of the ORIGINAL hand-written
   pages (from git HEAD, before the generator first overwrote them) and store
   it as fragments under build/content/. The generator builds from these
   fragments from now on, so rebuilding is idempotent.

   Safe to re-run only while git HEAD still holds the pre-generator pages;
   after that the fragments in build/content are the source of truth and this
   script is historical.
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEAD = 'f3c6cbe'; // last commit before the generator rewrite

const show = (path) =>
  execFileSync('git', ['show', `${HEAD}:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

const clean = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<div class="blog-cta-box">[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="blog-cta-box">[\s\S]*?<\/div>/gi, '')
    .replace(/\sclass="btn[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/* --- blog posts ---------------------------------------------------------- */

const posts = [
  'best-budget-rugged-tablets-under-400',
  'best-rugged-tablets-construction',
  'best-tablets-field-engineers',
  'do-you-need-enterprise-rugged-tablet',
  'ip68-vs-ip67-waterproof-rating',
  'rugged-vs-consumer-tablet-cost',
  'why-rugged-tablets-expensive',
  'why-tradespeople-switching-rugged-tablets',
];

mkdirSync(join(ROOT, 'build', 'content', 'blog'), { recursive: true });
mkdirSync(join(ROOT, 'build', 'content', 'legal'), { recursive: true });

for (const slug of posts) {
  const raw = show(`blog/${slug}.html`);

  const title = (raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.trim();
  const description = (raw.match(/<meta name="description" content="([^"]*)"/i) || [])[1] ?? '';
  const date = (raw.match(/datetime="([^"]*)"/i) || [])[1] ?? '2026-03-01';

  let body =
    (raw.match(/<div class="blog-post-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/i) || [])[1] ||
    (raw.match(/<article class="blog-post-content">([\s\S]*?)<\/article>/i) || [])[1];

  if (!body) {
    // Fallback: everything between the post header and the end of main.
    body = (raw.split(/<\/header>/i)[1] || '').split(/<\/main>/i)[0] || '';
    body = body.replace(/(?:\s*<\/(?:div|section|article)>\s*)+$/gi, '');
  }

  body = clean(body);
  const paragraphs = (body.match(/<p[ >]/g) || []).length;
  if (paragraphs < 5) {
    throw new Error(`Extraction for ${slug} looks wrong: only ${paragraphs} paragraphs`);
  }

  const fragment = `<!--meta
title: ${title}
description: ${description}
date: ${date}
-->
${body}
`;
  writeFileSync(join(ROOT, 'build', 'content', 'blog', `${slug}.html`), fragment, 'utf8');
  console.log(`blog/${slug}: ${paragraphs} paragraphs`);
}

/* --- legal pages --------------------------------------------------------- */

for (const file of ['privacy.html', 'terms.html', 'shipping-returns.html']) {
  const raw = show(file);
  const afterH1 = raw.split(/<\/h1>/i)[1] ?? '';
  let inner = afterH1.split('</main>')[0] ?? '';
  inner = inner.replace(/(?:\s*<\/(?:div|section|article|header|main)>\s*)+$/gi, '');
  inner = clean(inner);

  const paragraphs = (inner.match(/<p[ >]/g) || []).length;
  if (paragraphs < 5) {
    throw new Error(`Extraction for ${file} looks wrong: only ${paragraphs} paragraphs`);
  }

  writeFileSync(join(ROOT, 'build', 'content', 'legal', file), inner + '\n', 'utf8');
  console.log(`${file}: ${paragraphs} paragraphs`);
}

console.log('Done.');
