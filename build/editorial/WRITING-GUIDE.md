# Writing a Tuga Hardware guide

Rules for anyone (human or agent) adding a post to tugahardware.com/blog.

## Where things live

- Post source: `build/content/blog/<slug>.html`, an HTML fragment (no
  `<html>`, `<head>` or layout). The build wraps it in the page template,
  adds the hero image, schema, CTA and "More guides".
- Hero image: add the slug to `BLOG_IMAGES` in `build/build.mjs`. New photos
  go in `img/blog/` as `.webp`, then run `npm run images`. Without a new
  photo, reuse an existing one and leave the "Placeholders" comment above it.
- Never hand-edit generated `.html` at the repo root, `blog/`, `products/`,
  `sitemap.xml` or `feed.xml`. Run `npm run build` and commit the output.

## Fragment format

```html
<!--meta
title: Title Case Headline, Under ~65 Characters
description: One or two sentences, 140 to 160 characters, plain and specific.
date: YYYY-MM-DD
-->
<p>First paragraph, unindented.</p>

        <p>Everything after it indented 8 spaces, like the existing posts.</p>

        <h2>Section</h2>
```

Use `<h2>` and `<h3>` only (the page supplies the `<h1>`), plus `<p>`,
`<ul>`/`<ol>`, `<strong>` and `<a>`. No inline styles, classes or images.
Use the date the post is written.

## Voice

- British English (colour, metre, tyre). Prices in pounds.
- Plain, direct and honest, written for sole traders and small firms. The
  guides page promises they are "useful whether or not you buy from us", so
  give real advice, including when a cheaper option or another product is
  the better choice.
- Lead with the answer, then explain. Short paragraphs.
- No em dashes. Avoid hype words ("revolutionary", "game changer",
  "unleash", "seamless"). Avoid AI tells like "In today's fast-paced world"
  or "it's important to note".
- About 1,200 to 1,800 words.

## Facts: the hard rules

- Every Tuga spec, price and feature must come from `data/products.json`.
  If a field is missing (for example the W10 has no MIL-STD rating listed),
  do not state it. Variant products (`isVariant: true`) link to their base
  product page.
- Product URLs are `/products/<slug>`. The scanner variants share the base
  slug.
- Never invent statistics, studies, survey numbers, customer quotes,
  testimonials or reviews. Fake reviews were deliberately removed from the
  site as a legal risk. Use general, verifiable statements instead of
  numbers you cannot source.
- No legal, regulatory or financial advice beyond general signposting.
- Do not name or criticise competitors by brand.

## Links

- 2 to 4 links to existing guides (`/blog/<slug>`) where genuinely
  relevant, and links to the products discussed.
- Optionally edit one or two older posts to link to the new one, where it
  fits naturally. Keep those edits small.
- After `npm run build`, check every internal link in the new post points
  at a file that exists (`/blog/x` → `blog/x.html`, `/products/x` →
  `products/x.html`, `/contact` → `contact.html`, `/bulk` → `bulk.html`).

## Before opening the PR

1. `npm install` (first time), then `npm run build` succeeds.
2. `blog/index.html` lists the new post with its title and description, and
   no card has an empty `<h2></h2>`.
3. The diff only touches the new fragment, `build/build.mjs` (image map),
   regenerated blog pages, `sitemap.xml`, and the calendar row. If unrelated
   generated files change, find out why before committing.
