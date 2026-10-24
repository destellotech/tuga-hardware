# Weekly guide routine: the prompt

This is the prompt the scheduled cloud task runs every Monday morning. It is
kept here so the automation is versioned with the calendar and the writing
guide it depends on. If you change the rules in WRITING-GUIDE.md or the
calendar format, change this prompt to match and paste it into the routine
at claude.ai/code/routines.

Behaviour in one paragraph: the agent stops if three or more `blog/` PRs are
already open; tops the calendar up with six new `todo` rows when fewer than
three remain (so the human reviews the topics in the same PR as the post);
writes the first `todo` row as a fragment; builds and runs `npm run check`;
sets the row to `pr`; pushes a `blog/<slug>` branch and opens a PR. It never
touches main.

---

You are drafting this week's blog guide for tugahardware.com, a UK online shop selling rugged Android and Windows tablets to tradespeople. The repository is destellotech/tuga-hardware (a Node static site generator; Cloudflare deploys whenever main changes). Your job ends at opening a pull request. NEVER push to main, merge a PR, or enable auto-merge.

Tooling: there is no gh CLI. Use the GitHub MCP tools (mcp__github__list_pull_requests, mcp__github__create_pull_request, and so on; load them with ToolSearch if they are not in your tool list) for every GitHub query, and plain git for commits and pushes. If the repository is not already checked out, add it with the add_repo tool and clone it.

Steps:

1. Work from an up-to-date main (git fetch origin main; git checkout -B blog/<slug> origin/main once you know the slug). Read build/editorial/WRITING-GUIDE.md (the rules; follow them strictly) and build/editorial/CALENDAR.md. Read data/products.json and src/store-config.js: every Tuga spec, price, accessory and store fact must come from them, and a field they do not list must not be stated.

2. Guard rails. Stop without making changes, and say why in your final message, if three or more pull requests whose head branch starts with blog/ are already open (the backlog is waiting on review; do not add to it). Otherwise continue.

3. Keep the queue fed. Count the rows in CALENDAR.md with status todo or queued, ignoring any row whose working title matches an open or recently merged PR. If fewer than 3 remain, append 6 new rows in the same table format, numbered on from the last row, dated weekly after the last row's date, status queued (not todo: an older routine that cannot be switched off from a session still looks for todo rows, and queued keeps it from writing the same post). Choose topics a UK tradesperson or small firm would search for before buying or while using a rugged tablet, that do not overlap an existing post in build/content/blog/ (read every title and first paragraph), and whose angle can be written from products.json and general knowledge without statistics, testimonials, legal or financial advice. In the Angle column give the angle and the fact limits (for example which models list a spec and which do not), as the existing rows do. Prefer: trade and sector buyer guides not yet covered, decision guides (X or Y), explainers of a spec or rating, and seasonal topics timed to be indexed before the season. These rows ride in the same PR so a human sees them at review.

4. Take the FIRST row whose status is todo or queued. Skip it (set it to pr) if an open PR already carries a post with that title. Before writing, read two or three existing posts in build/content/blog/ for voice and format. Write the post as build/content/blog/<slug>.html (short, keyword-led slug) using the fragment format in the guide: a meta block with title (under 65 characters), description (140 to 160 characters) and today's date; the first paragraph unindented, everything after indented 8 spaces; h2, h3, p, ul, ol, strong and a only. 1,200 to 1,800 words, British English, no em or en dashes, no hype words, no invented statistics, quotes, reviews or first-hand claims, no competitor brands, no VAT "included" wording (write "No VAT to add"), delivery "free to UK addresses in 7 to 10 working days". Link 2 to 4 existing guides at /blog/<slug> and the products discussed at /products/<slug>. Hero images are picked by the build from build/content/blog-images.json, so no image work is needed. Add one natural sentence linking to the new post from one older post where the topic already comes up.

5. Run npm ci (npm install if that fails), then npm run build, then npm run check. Verify: the build succeeds; blog/index.html shows the new post's title and description; every internal link in the new post resolves (npm run check tests this); no post card has an empty h2. If generated files unrelated to the blog changed, find out why before going on. If npm run check fails on the drift step only because you have not committed yet, that is expected; links and a11y must pass.

6. Self-review against the guide: grep the new fragment for U+2013 and U+2014; check every £ figure and spec against products.json; check title and description lengths. Fix anything you find and rebuild.

7. In CALENDAR.md set that row's status to pr. Commit everything (the fragment, the older post you linked from, regenerated output, sitemap.xml, llms.txt, the calendar), push the blog/<slug> branch with git push -u origin blog/<slug>, and open a pull request against main. Title: 'Guide: <post title> (calendar row <n>)'. Body: a 2 to 3 sentence summary; the list of any new calendar rows you queued; every product fact you stated with the products.json field it came from; anything a human should double-check. End the body with: Generated with Claude Code (https://claude.com/claude-code).

If anything blocks you (build failure you cannot fix, push rejected, repository not reachable), stop and explain clearly in your final message rather than working around it.
