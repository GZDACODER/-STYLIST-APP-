# Clientele build log

A plain-English record of each step: what was built, the SQL step run (if
any), how it was tested live, and what happened. Newest at the bottom.

## House rules for every change

- Every dashboard page and Settings section has first-visit tips and a "?"
  help button (lib/guides.js; PageHeader `guide`, or SETTINGS_GUIDES for
  Settings). New pages get theirs in the same change.
- Pros are in control: nothing changes a pro's data without their permission
  (Support access, logged and emailed).
- SQL is run by Claude through the Supabase Management API and saved in
  supabase/migrations/. Steps are numbered in order.
- Each change: build, PR, CI, merge, wait for the live deploy, then test on a
  phone-sized screen with the test accounts.
- Deploys: wait for the production build to finish before pushing the
  working branch (once, a simultaneous push made Vercel build only a preview).

## Log

| Date | Step | SQL | Tested live | Result |
|---|---|---|---|---|
| Nov 23 | Request inbox and photos at booking (PR 135, 136) | 56 | Request with photo, approve, emails | Works. Booking via the link needs the client's email code (left for the owner). |
| Nov 23 | Public profiles: profile page and Settings (PR 137, 138) | 57 | Preview while off, publish, share image, 404 when off | Works. Open times changed to one per day. |
| Nov 23 | Reviews: approve, reply, report, Control Room tab (PR 139) | 58 | Approve, reply, report as a visitor | Works. Only completed visits can be rated. |
| Nov 23 | Search: /find and homepage box (PR 140) | 59 | Name, Pro ID, type and city filters | Works. Owner confirmed. |
| Nov 23 | Opening alerts: Notify me (PR 141, 142) | 60 | Follow, code, new opening, alert, unsubscribe and undo | Works. Fixed: the code was in the email subject (and the email log). |
| Nov 24 | My look photo consent (PR 143, 144) | 61 | Ask, yes, show, no, new photo resets | Works. Fixed: "Page not found" after a photo is removed. |
| Nov 24 | Money tab (PR 145, 146) | 62 | Tip, balance paid, day/week/month/year, CSV and PDF | Works. Deploy hiccup: first merge only built a preview; redeployed. |
| Nov 24 | "Find your pro" moved to the homepage top bar (PR 147) | – | iPhone (icon) and iPad (text) | Works. Asked for by the owner. |
| Nov 24 | Reports becomes Insights (PR 148, 149) | 63 | Stats, grid, invite back email | Works. Fixed: bookings without a client card weren't counted; owed ignored Money payments. |
| Nov 24 | Support access levels, Support console, Activity page (PR 150) | 64 | Pro side on/off and Activity | Works. Console needs the owner's admin login; edit access left on Fresh Cuts Test for 24 hours to try. |
| Nov 24 | Settings merged 15 → 12 sections; tips on every page (PR 151) | – | 12 sections listed, old links redirect, tips on Money/Activity/Support | Holidays → Hours, Email → Business, Agreements → Plan. Old links redirect. |
| Nov 24 | Gift cards: buy on the booking page, Stripe, emails, redeem by code (PR 152) | 65 | Fresh Cuts Test (no Stripe): page says not selling; redeem $20 then $30 of a $50 test card, over-spend and wrong code refused | Works. The Stripe purchase itself couldn't be tested here (Stripe's page is blocked from the test machine; only Royal Suite has Stripe) – owner to try. Redemption is one database step so a card can't be spent twice. |
| Nov 24 | New Settings: Booking rules, Notifications, Your data (in Privacy & support); new-booking email to pros (PR 153) | 66 | Ink Test Studio: hourly starts showed on the booking page then reset; notifications saved; bookings CSV downloaded | Works. Default rules = old behavior (same 256 open times). Fixed: phone numbers in CSVs got a leading apostrophe (PR 154). Settings now 14 sections. |
| Nov 24 | Homepage rewrite (PR 155) | – | Local build, phone and iPad screenshots, Lighthouse mobile | New headline, Start free trial + Try the live demo, six suite tabs, trade switcher with per-trade demos (/demo?type=), updated pricing list. Live Lighthouse mobile: speed 96 (was 83), accessibility 100, best practices 100, SEO 100 (stopped preloading an unused font). Trade demo links checked, accessibility 96 → 100 (brighter small text), best practices and SEO 100. |
| Nov 24 | Full re-test of everything built in this session | – | 56 checks on the live site: homepage, search, profiles, requests, alerts, consent links, 22 dashboard pages with tips, Settings redirects, Money record/remove and downloads, Your data, Insights, demo read-only | All passed. The photo picker sits in the step after the client confirms their email (by design). |
| Nov 24 | Samples match the trade (PR 156, 157) | – | Each demo (hair, barber, tattoo, tutor): Money, Gift card and Profile hints and Insights sample reviews all match the trade; silk press only for stylists | Owner asked that examples match the service. Fixed hair-only text in Insights sample reviews, Today's running-late example, demo profile reviews, the import preview, and the Money, Gift card and Public profile hints. Sample reviews only on paid services; homepage pictures made trade-neutral. |
| Nov 24 | Template update 2 (tattoo): projects and healing check-ins (PR 158) | 67 | See next entry | New template features (on for tattoo, switchable for anyone). |
