# Weekly works-with routine: the prompt

The scheduled cloud task that writes one works-with page a week runs this
prompt. It is kept here, next to `WORKS-WITH-QUEUE.md`, so the automation
changes with the queue and the page schema it depends on. If the schema in
`build/build.mjs` (the WORKS WITH section) or the rules in the queue file
change, change this prompt and paste it into the routine at
claude.ai/code/routines.

---

You are writing this week's works-with page for tugahardware.com, a UK online shop selling rugged Android and Windows tablets and handhelds to tradespeople and maintenance teams. A works-with page matches one software product's published device requirements to the Tuga devices and says, with sources, which device fits. The repository is destellotech/tuga-hardware. Your job ends at opening a pull request. NEVER push to main, merge a PR, or enable auto-merge. There is no gh CLI: use the GitHub MCP tools (mcp__github__list_pull_requests, mcp__github__create_pull_request; load them with ToolSearch if needed) for GitHub, plain git for commits and pushes, and WebSearch and WebFetch for research. If the repository is not checked out, add it with add_repo and clone it.

Steps:

1. Work from an up-to-date main (git fetch origin main; git checkout -B works-with/<slug> origin/main once you know the slug). Read build/editorial/WORKS-WITH-QUEUE.md (the queue and its rules), three existing pages in build/content/works-with/ (for example commusoft.json, maintainx.json and bigchange.json) for the exact JSON shape and voice, the WORKS WITH section of build/build.mjs for what the build reads, data/products.json for every Tuga spec, price and accessory, and src/store-config.js for store facts.

2. Guard rails. Stop without changes, saying why, if three or more open pull requests have a head branch starting with works-with/.

3. Keep the queue fed. If fewer than three rows are todo, append six candidates: UK or UK-relevant field service, job management, construction, inspection or CMMS products not already in build/content/works-with/, each checked with a web search for a published device requirements page (help centre article, Google Play listing or Microsoft Store page). Put the URL you found in the Notes column. No source, no row.

4. Take the first todo row. Research what the vendor publishes: minimum Android or Windows version, RAM, storage, screen, connectivity, offline mode, scanning (camera, NFC, Bluetooth), rooted-device policy, supported browsers for a web app, and anything about tablets versus phones. Use the vendor's own help centre, the Google Play and Microsoft Store listings and the vendor's site; note the date on each page. If you cannot find a published requirement for the platform, set the row to skip with the reason and stop; do not guess.

5. Write build/content/works-with/<slug>.json with exactly these fields: slug, software, vendor, vendor_url, title (under 65 characters), meta_description (140 to 160 characters, lead with the requirement and the device that meets it), target_query, h1, intro (3 paragraphs: who the vendor is and who uses the product, what the field app is used for on site, what this page does), requirements (one object per published requirement: requirement, detail with the source's own wording and date, source_url), recommended (objects with device_id from tuga-a10, tuga-a8, tuga-w10 or tuga-a6 only, role "primary" for one of them and "alternative" for the rest, and why: a paragraph matching that device's products.json specs to the requirements, including the trade-off), setup_steps (five or six plain steps a new user takes on the device, from the vendor's own onboarding docs), accessories (strings naming the accessory, its price from products.json and the devices it fits), faq (four or five q and a pairs), not_recommended_note (which Tuga devices do not fit and why, from the published requirements), disclaimer ("<Software> is a product of <Vendor>. Tuga Hardware is an independent hardware seller and is not affiliated with or endorsed by <Vendor>."), and sources (every URL you relied on). British English, no em or en dashes, no hype words.

6. Fact rules. Every Tuga spec, price and accessory must come from data/products.json; if it does not list something (a W10 operating temperature, an A8 drop rating), do not state it. Never say an app was tested, certified or verified on a Tuga device; the page matches published requirements to published specs and tells the reader to trial the app. Never invent statistics, customer names, quotes or testimonials. Quote the vendor's requirement with its date, and say so when a requirement is not published. Store facts: free delivery to UK addresses in 7 to 10 working days, "No VAT to add", 12-month warranty, 30-day returns, team discounts 3% at 2 devices, 5% at 3 to 4, 8% at 5 to 9, 10% at 10 or more.

7. Run npm ci (npm install if that fails), npm run build and npm run check. The build warns and skips a malformed entry: make sure yours is not skipped and that works-with/<slug>.html exists with the h1, the requirements with their source links and the recommended devices. Links and a11y must pass; drift passes once committed.

8. In WORKS-WITH-QUEUE.md set the row to pr. Commit the JSON, the regenerated output (works-with/, sitemap.xml, llms.txt and the works-with index) and the queue file, push works-with/<slug> with git push -u origin works-with/<slug>, and open a pull request against main titled 'Works with: <Software> (queue row <n>)'. In the body: a 2 to 3 sentence summary, each requirement with its source URL and date, each Tuga fact with the products.json field it came from, any queue rows you added, and anything a human should double-check. End the body with: Generated with Claude Code (https://claude.com/claude-code).

If anything blocks you (no published requirements, build failure you cannot fix, push rejected), stop and explain clearly in your final message rather than working around it.
