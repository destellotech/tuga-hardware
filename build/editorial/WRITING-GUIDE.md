# Writing a Tuga Hardware guide

Rules for anyone (human or agent) adding a post to tugahardware.com/blog.

## Where things live

- Post source: `build/content/blog/<slug>.html`, an HTML fragment (no
  `<html>`, `<head>` or layout). The build wraps it in the page template,
  adds the hero image, schema, CTA and "More guides".
- Hero image: picked automatically from the pool in
  `build/content/blog-images.json` by matching each photo's tags against the
  post's slug and title, so a new post needs no image work. To force a
  photo, add `image: <file>.webp` to the meta block. To add a photo, put a
  landscape `.webp` (about 1600 px wide) in `img/blog/`, run `npm run
  images`, and add it to the manifest with its tags and credit. Only use
  photos under a licence that allows commercial use (Pexels, Unsplash).
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
- No em dashes or en dashes. Avoid hype words ("revolutionary", "game changer",
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
- Store-wide facts live in `src/store-config.js`; copy them, never improvise:
  - Delivery is free to UK addresses only, in 7 to 10 working days. Never
    mention Ireland or international shipping, same-day dispatch, UK stock
    or "direct from the manufacturer".
  - Destello Tech Ltd is not VAT registered. Write "No VAT to add"; never
    say prices "include VAT" or mention VAT invoices.
- No popularity, best-seller or "most trades choose" claims, and no
  superlatives about our own devices ("the best", "unbeatable"). "Best X
  for Y" titles are fine for buyer guides, but the body compares on specs.
- No first-hand claims we cannot back: "we tested", "in our experience",
  "our customers tell us".
- Work out price gaps and ratios from products.json every time. They vary:
  scanner versions cost £70 more on the W8 and £80 more on the WH6 and W10,
  and Windows is not "double" Android across the range.
- The operating system differs by model: the WH6 runs Windows 11 IoT, the
  W8 and W10 Windows 11 Pro. Say "Windows 11" when talking about the range.
- If products.json does not list something (voice calls, vibration
  testing, dimensions for the A8, software update periods), do not
  state it. Tell readers to check their own apps on the device rather than
  implying they will run.
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
3. The diff only touches the new fragment, `build/content/blog-images.json` (only if you added a photo),
   regenerated blog pages, `sitemap.xml`, and the calendar row. If unrelated
   generated files change, find out why before committing.
