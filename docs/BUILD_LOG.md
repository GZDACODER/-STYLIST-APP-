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
| Nov 24 | Settings merged 15 → 12 sections; tips on every page | – | See next entry | Holidays → Hours, Email → Business, Agreements → Plan. Old links redirect. |
