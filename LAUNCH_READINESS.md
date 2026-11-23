# Getting ready for growth (saved for later)

Noted on Nov 22, 2026 after asking "If I get 700 users will the site crash?"
Short answer: the site itself won't crash. The limits of the free plans are what break first.

## Your steps (accounts and settings)

- [x] **Supabase sign-up emails** (done: they already go through Resend, and the templates now match the site).
- [ ] **Resend paid plan** (about $20/mo). The free plan allows about 100 emails a day.
- [ ] **Supabase Pro** (about $25/mo). Adds daily backups and more database and photo storage.
- [ ] **Vercel Pro** (about $20/mo). The free Hobby plan isn't allowed for a paying business.
- [ ] **Usage alerts** in Supabase, Resend and Vercel, and a **monthly spending limit** in Anthropic (for the Assistant).
- [ ] **Free uptime monitor** (UptimeRobot or Better Stack) on clientelesuite.com that texts you if it goes down.
- [ ] **If an update breaks the site:** in Vercel, open Deployments and use Instant Rollback to go back to the last good version.
- [ ] **Invite pros in batches** (for example 50 a week) rather than all at once.
- [ ] Finish **Stripe live mode**, the **business email** and **Twilio** before charging people.

Prices are approximate; check each site's pricing page.

## Things Claude can build when you're ready

- [ ] Load-test a test copy of the site (not the live site) with hundreds of pretend users.
- [ ] A daily cap on Assistant use for each pro.
- [ ] An Admin page showing emails sent, storage used and sign-ups against each plan's limits.

## Saved for later: speed and mobile performance pass (audited Nov 23, 2026)

Lighthouse (mobile) found every page between 84 and 97, but missing the 2.5s
LCP target (2.5-3.0s). Plan, in order of impact:
1. Fonts: stop preloading all 5 font files (190 KB) on every page; trim the serif
   weights; draw the "Clientele" logo as an image instead of a font.
2. Load heavy parts only when opened (Wrap up's 68 KB photo resizer, Assistant,
   Stripe, import, Calendar Month/List, Control Room).
3. Booking page and dashboard: run database calls in parallel, cache services,
   templates, settings and holidays.
4. SQL indexes for bookings by date/status, clients by phone, waitlist, notes.
5. Skeleton loaders, pressed states, optimistic updates with undo.
6. Mobile checks (44px taps, no sideways scroll), fix the client sign-in CLS 0.12.
7. Installable app (PWA) with an offline message.
8. Vercel Speed Insights, a 170 KB budget check, speed in the Control Room and
   the nightly autopilot.
