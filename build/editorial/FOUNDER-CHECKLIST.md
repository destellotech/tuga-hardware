# Dials only the founder can turn

Everything on this list needs an account, a decision or a signature that
the code cannot provide. Each item says what to do, where, and what it
unlocks. Items the code already supports are marked so.

## 1. Stock and the delivery promise

The single biggest conversion lever on the site is the line "7 to 10
working days". The move to UK stock is already anticipated in
`src/store-config.js` (DELIVERY). When devices are on a UK shelf, change
`DELIVERY.days`, `summary` and `short` there, rebuild and deploy: every
page, the API and the emails pick it up together.

## 2. Google Merchant Center (free listings and Shopping)

The build already writes a Google product feed. In Merchant Center, add
the feed, set UK delivery under Delivery settings (Google requires this for
the UK), and opt in to free listings under Growth, Manage programmes,
"surfaces across Google". Free listings show product pages in the Shopping
tab, Images and Lens at no cost. A small paid Shopping budget on "rugged
tablet" terms sits on top of the same feed. Google's current requirements:
https://support.google.com/merchants/answer/13889434

## 3. Abandoned checkout recovery

Stripe's dashboard version is a US-only beta, so it is not an option for a
UK account. The worker now does it through the API instead
(`after_expiration.recovery` on the Checkout Session and the
`checkout.session.expired` webhook). The worker now adds `checkout.session.expired` to the
`/webhooks/stripe` endpoint itself on the daily 09:00 UTC cron
(`src/stripe-webhook-config.js`), using the key it already holds, so no
dashboard visit is needed unless the key is a restricted one without
webhook write access, in which case the cron logs the refusal and the
event must be added by hand. Checkout now shows a "keep me updated" box; Stripe only shares the email of a customer who typed it in
and ticked that box, so the recovery email reaches a subset of
abandoners. Checkout pages now expire after three hours (the basket link
in the email then works for 30 days). Stripe's rules:
https://docs.stripe.com/payments/checkout/abandoned-carts

## 4. Business finance at checkout

Two UK providers fit a shop selling £349 to £779 devices to sole traders
and small firms. Kriya (now owned by Allica Bank) offers 30, 60 and 90 day
terms at checkout and integrates with Stripe. iwocaPay offers 1, 3 or 12
month instalments, pays the seller up front and carries the credit risk.
Neither publishes fees on the pages found; ask both. Start here:
https://www.iwoca.co.uk/iwocapay-seller-offer-pay-later and
https://openbankingtracker.com/embedded-finance/kriya

## 5. Cloudflare Web Analytics

Already live: the page shell puts the beacon on every page (66 of 66
checked), so Core Web Vitals and real-user timing are collecting with no
cookies. Read them in the Cloudflare dashboard under Web Analytics. (An
earlier version of this note said three pages; that was a truncated
check, not the site.)

## 6. Google Search Console and Bing Webmaster Tools

Verify www.tugahardware.com in both. Search Console shows what is indexed
and which queries bring people in; the weekly guide routine can then pick
topics from real demand. Bing Webmaster also covers Copilot. The IndexNow
script in `build/indexnow.mjs` already pings Bing on each deploy.

## 7. Google Business Profile

A free listing for Destello Tech Ltd at the Harlow address with the
tugahardware.com website attached. Cheap local trust, and reviews left
there count.

## 8. Marketplaces

eBay and Amazon UK listings for the six devices put them where buyers
already search. Both need business seller accounts, product identifiers
(GTINs where the manufacturer assigns them) and the same honest spec copy
as the product pages. Margin and returns handling are the trade-off.

## 9. Spare battery prices

The site now lists a spare battery for each device with a removable one,
on request. When you have supplier prices, add `price` to each
`acc-battery-*` entry in `data/products.json`, add the matching entries
to the PRODUCTS map in `src/api.js`, remove `quoteOnly`, rebuild and
deploy, and they become normal accessories with an Add to basket button.

## 10. Outreach

`build/editorial/OUTREACH.md` lists the software vendors' partner routes,
UK trade press and trade creators, with three email templates. Sending
them, and the sample units that go with them, is yours.

## 11. Alternatives pages

Pages like "Toughbook alternative" are high-intent searches, but the
writing guide bans naming competitors and the site has never done it.
If you want them, say so and the ban changes with it; until then nothing
is written.

## 12. The weekly routines

Two self-feeding routines now run: "Tuga weekly guide (self-feeding)" on
Mondays (prompt in `ROUTINE-PROMPT.md`, queue in `CALENDAR.md`) and "Tuga
weekly works-with page" on Wednesdays (prompt in `WORKS-WITH-ROUTINE.md`,
queue in `WORKS-WITH-QUEUE.md`). Each opens one PR a week for you to
review and stops while three of its PRs are open. The old "Tuga weekly
blog post" (created 9 October) cannot be switched off from a session, so
the calendar now queues new rows as `queued`, which the old routine does
not read, and it will find nothing to do. Delete it anyway at
https://claude.ai/code/routines when you are next there.
