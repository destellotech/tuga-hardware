# Blog writing guide

Rules for posts on tugahardware.com. The weekly drafting routine reads this file and follows it strictly.

## Audience

UK tradespeople (electricians, plumbers, builders, surveyors, field engineers) and the small firms that buy for them. Practical, time-poor, sceptical of marketing.

## Format

- One file per post: `build/content/blog/<slug>.html`. Short, keyword-led slug, lower case, hyphens.
- Start with the meta block, exactly as existing posts do:

  ```
  <!--meta
  title: ...
  description: ...
  date: YYYY-MM-DD
  -->
  ```
- Title under 70 characters. Description 120 to 160 characters, plain sentence, no quotes.
- Body is an HTML fragment: `<p>`, `<h2>`, `<ul>`/`<li>`, `<a>`. No `<h1>` (the template adds it), no inline styles, no scripts.
- Open with a short paragraph naming the problem the reader has. Use `<h2>` headings every 200 to 300 words.
- Length: roughly 1,200 to 1,800 words.
- End with a short, honest next step and one link to a relevant product page or `/contact` or `/bulk`.
- Read the existing posts in `build/content/blog/` first and match their structure. Do not repeat a topic already covered.

## Voice

- British spelling (colour, metre, organisation, tyre).
- Plain, direct, second person. Short sentences. Say what a thing is and what it means on site.
- No em dashes. Use commas, full stops or brackets.
- No hype words: revolutionary, game-changing, cutting-edge, ultimate, unbeatable, best-in-class, seamless, supercharge, and similar.
- Be willing to say a rugged tablet is not the right choice when it isn't.

## Fact rules

- Every Tuga spec and price must come from `data/products.json`. Do not state a spec, price, rating, battery size, weight or feature that is not in that file. Re-read it for each post.
- General standards facts (e.g. what IP67 means) are fine if well established. When unsure, leave it out.
- Never invent statistics, studies, quotes, reviews, testimonials, customer names or case studies.
- Do not make claims about competitors' products.
- Do not promise delivery times, warranty terms or stock. Link to the relevant page instead.

## Links

- Internal links only, in site form: `/blog/<slug>`, `/products/<slug>`, `/contact`, `/bulk`. Each must resolve to an existing file (`blog/<slug>.html`, `products/<slug>.html`, `contact.html`, `bulk.html`).
- One or two product links in a post is plenty. No external links unless to a standards body.

## Images

Add the slug to `BLOG_IMAGES` in `build/build.mjs`, reusing the best-fitting existing image. Do not add new image files in a drafting run.

## Process

One post per run, one PR per post, never more than one unreviewed blog PR open. Draft PRs only; a human reviews and merges.
