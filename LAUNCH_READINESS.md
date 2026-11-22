# Getting ready for growth (saved for later)

Noted on Nov 22, 2026 after asking "If I get 700 users will the site crash?"
Short answer: the site itself won't crash. The limits of the free plans are what break first.

## Your steps (accounts and settings)

- [ ] **Supabase sign-up emails.** In Supabase, go to Authentication → Emails → SMTP settings and send through Resend. Supabase's built-in sender only manages a few emails an hour, so new pros would miss their confirmation email.
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
