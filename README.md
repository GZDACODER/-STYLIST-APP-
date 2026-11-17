# Clientele: booking for hair stylists

A phone-friendly booking app where stylists can let their **regular clients
book first**. Stylists only pay for the add-on features they switch on.

Built with **Next.js** (the website), **Supabase** (logins and the database),
and hosted on **Vercel**.

## What works so far

- **Sign up / log in** for stylists (business name, email, password).
- **Services**: add services (name, price, minutes).
- **Availability**: weekly working hours, days off, blocked dates, and a calendar.
- **Clients**: a client list with Regular / New / Blocked status and search.
- **Openings**: open times for booking, marked **Everyone** or **Regulars only**
  (per opening or per day), plus your public booking link.
- **Public booking page** at `/book/your-link`: clients pick a service and a time,
  confirm their mobile number with a text message code (or their email, as a
  backup), and book. No app or account needed. iPhones fill in the code with one tap.
  Regulars (matched by phone number) also see the "Regulars only" times.
- **Automatic Regulars**: clients become Regulars after a number of completed
  appointments you pick in Settings (3 to start with).
- **Forgot password** (`/forgot-password`, linked from Log in): emails a link
  that logs the pro in and opens **Choose a new password** (`/reset-password`).
- **Trial feedback** (step 38 SQL `0043_trial_feedback.sql`): from day 3 of the
  free trial, Home asks "How's Clientele working for you?" (Not now hides it
  for 3 days). `/dashboard/feedback` has five questions: overall 1–5, how likely
  to keep using it, what needs updating, what would make life easier, and open
  notes. Answers are saved in `trial_feedback`, emailed to `ADMIN_EMAILS`, and
  listed at `/dashboard/admin/feedback` (only for logins in `ADMIN_EMAILS`).
  Pros can send more any time (Plan & billing, Home).
- **Example data for new pros** (`lib/examples.js`, step 37 SQL
  `0042_examples.sql`): new sign-ups see realistic examples in every tab
  (services, clients incl. a Regular and an Invited client, an invite link,
  bookings upcoming/completed/owed/no-show/cancelled/late cancel, a slot kept
  for Regulars, openings incl. Regulars-only, waitlist, notes, wrap-up, events
  incl. a repeating one that blocks bookings, an intake form and signed waiver),
  each tagged **Example**. They're drawn by the dashboard only, never saved, so
  they can't reach the booking page, invites, waitlist, emails, texts, Stripe,
  stats or limits. Each tab's examples hide once it has real data; opening one
  explains it and links to the blank form. Settings → Business has **Clear all
  examples** / **Restore examples** (`stylists.show_examples`: on for new
  accounts, off for existing ones).
- **Home** (`/dashboard`, where log in lands, first in the menu): greeting,
  business name, View booking page and Copy link; cards for today's bookings,
  this week's revenue, deposits collected, new clients this month and the
  waitlist; **Up next** (next 3 bookings); **Needs attention** (visits to wrap
  up, balances owed, standing visits to check, waitlist email problems, missing
  intake forms, Stripe not connected, plan ending/paused); quick actions; and a
  setup checklist for new accounts that hides once done. The day view is
  **Today** (`/dashboard/today`). The homepage stays the homepage when logged
  in, with **View dashboard** in place of Log in.
- **Settings** is split into sections (Business, Booking page, Services, Hours &
  days off, Holidays, Regulars, Deposits, Forms, Plan & billing, Email): on iPad
  the list is on the left and the section on the right; on phones the list is
  its own screen and each section has a back arrow (`components/dash/SettingsShell.js`,
  `lib/settingsSections.js`).
- **Bookings**: see upcoming bookings (with deposit paid or not) and cancel them.
  The client is emailed straight away that it's cancelled, with a Book another
  time link (replies go to the business).
  Clients can also cancel their own bookings from the booking page.
- **Waitlist**: when no times work, clients join a waitlist for a service and the
  days and times they'd like. When a time opens up, they're emailed a one-tap
  "Claim this time" link, Regulars first. First to claim gets it, deposits still
  apply. Text messages can be switched on later. See **[WAITLIST_SETUP.md](./WAITLIST_SETUP.md)**.
- **Regulars only mode**: one switch hides every time and the waitlist from new
  clients. Cancelled Regulars bookings stay Regulars-only. Private one-time
  **invite links** let a specific new client book anyway, and they show as
  Invited. See **[REGULARS_ONLY_SETUP.md](./REGULARS_ONLY_SETUP.md)**.
- **Settings**: business name, booking link, time zone (Central Time by default),
  Regulars, and deposits.
- **Your business** (in Settings): a cover photo for the booking page's black
  panel, plus optional Instagram and Location links shown in the booking page's
  top bar. Run `supabase/migrations/0014_cover_and_links.sql` first; it also
  creates the public "covers" storage bucket.
- **Your first name** (optional, in Settings and on sign-up): used in the
  dashboard greeting ("Good afternoon, Gabrielle"). Run
  `supabase/migrations/0015_first_name.sql` first.
- **Plans (billing part 1)**: each stylist has a plan: Clientele ($15/mo), plus the
  Regulars First ($10/mo) and Waitlist ($7/mo) add-ons, or All-in ($29/mo). Prices
  live in `lib/plans.js`. New stylists get a 14-day trial with everything on;
  existing accounts are free. A paused add-on can't be switched on or used for
  anything new (the database refuses it). Run `supabase/migrations/0017_plans.sql`.
  Stylists pick and pay for a plan in Settings (Stripe Checkout), and manage or
  cancel it on Stripe's billing page. See **[BILLING_SETUP.md](./BILLING_SETUP.md)**.
- **Clients**: one slim row per client (name, phone, Regular/Invited, next
  appointment); tap a row for the full card. **Merge** combines two cards for
  the same person (visits, deposits, standing appointments, notes and Regular
  status all move over), and cards sharing an email or phone are flagged as
  possible duplicates. Run `supabase/migrations/0028_merge_clients.sql` first.
- **Notes**: a tab gathering what happened at each visit from the last 12
  months, by client or by day: how it went, a note, no-shows and the amount
  still owed. Notes can be written there or on Wrap up visits, and show in the
  client's History. Run `supabase/migrations/0029_visit_notes.sql` first.
- **Reschedule**: clients move their own booking to another open time (same
  service) from "Your upcoming appointments" or the Reschedule link in their
  emails. Same rules as booking (Regulars-only times only for Regulars), up to
  2 moves, not inside the notice period set in Settings (24 hours to start).
  The deposit stays with the booking, the old time goes to the waitlist, and
  the client and business are emailed. Run `supabase/migrations/0030_reschedule.sql`.
- **Reports**: revenue, visits, no-show rate and deposits for this month, last
  month, the last 3 months or this year, compared with the period before;
  revenue by week or month split Regulars / New; bookings (cancelled, moved,
  not marked), deposits after Clientele's fee, and balances owed. In the side
  menu, and linked from Today. No SQL needed (see `lib/reports.js`).
- **Portfolio photos**: up to 12 photos of your work (Settings, Your business),
  with captions and your own order, shown as a strip on the booking page;
  clients tap one to see it full-size. Run `supabase/migrations/0031_portfolio.sql`
  (it also creates the public "portfolio" storage bucket).
- **Intake form & waiver** (Settings): up to 20 questions and a waiver for the
  services you pick. Clients fill it in while booking (once; editing the form
  or "Ask again" on a client card asks again) and sign by ticking "I agree"
  and typing their name. Answers show on the client card; the Calendar shows
  whether it's on file. Run `supabase/migrations/0033_intake.sql`.
  Waitlist "Claim this time" pages ask for it too (saved for the person on
  the waitlist, so it counts for their later bookings). Run
  `supabase/migrations/0037_claim_intake.sql`.
- **Holidays & your own events** (Calendar): US federal holidays and busy
  days for beauty pros (Mother's Day, Valentine's Day, Black Friday...) show on
  the month view, worked out for every year in `lib/holidays.js`. Stylists add
  their own events from any day ("+ Add event"): all day or a set time, one-off
  or repeating every week, every 2 weeks, every month or every year, optionally
  until a date, and a single date of a repeating event can be removed. Ticking
  **Block bookings** takes that time off the booking page (and the waitlist and
  reschedule); bookings already made stay, and the stylist is warned about any
  at that time. Run `supabase/migrations/0034_calendar_events.sql`.
  Standing appointments skip times an event blocks (shown on Today as "Not
  held", and booked once the event is removed); visits already booked are
  flagged on Today to move, skip or keep. Run
  `supabase/migrations/0036_standing_skip_events.sql`.
  The Today page shows today's holiday and events in the timeline with the
  appointments, and (on wide screens) the rest of the week's events.
  Events have a colour, repeat every day, every week or every 2 weeks on chosen
  days, or monthly on a date or a weekday ("2nd Tuesday", "last Friday"), and a
  repeating event can be edited or deleted for this date, this and following, or
  all dates. **Close on holidays**: tap a federal holiday on the Calendar for
  "Closed this holiday" (that date only, saved as a blocked date "Closed –
  Thanksgiving") or "Close every year"; all of them are listed in Settings →
  Holidays. A closed holiday has no bookings, waitlist offers or
  standing visits, and is shaded like a day off.
  The Openings page shows which parts of an opening are blocked. Run
  `supabase/migrations/0039_calendar_extras.sql`, then
  `0040_standing_skip_closed_holidays.sql` (standing visits skip a holiday
  closed for one date too).
- **Make the Switch** (`/switch`): the guide for pros moving from another app:
  why switch, what comes over (the client list) and what doesn't (booked
  appointments), seven steps, a message to copy and send clients, and common
  questions. Linked from the homepage's Switching section and footer. The
  homepage's Pricing also lists what's never extra. No SQL needed.
- **My Pros** (`/my`, for clients): sign in with the same email code as the
  booking pages and see every pro you've booked with on Clientele: the next
  appointment (Reschedule or cancel), the last visit, and **Book again**, which
  opens that pro's page with the service and the first open day picked. The
  booking form fills in name and phone from last time. Can be added to a
  phone's home screen (`app/my/app.webmanifest`). Linked from booking pages,
  the "You're booked" screen and booking emails. Run
  `supabase/migrations/0035_my_pros.sql`.
- **Assistant** (a chat button in the bottom corner of every dashboard page):
  ask about your schedule or tell it what to change in your own words. It reads the schedule and proposes changes (add a
  calendar event, block days off, cancel a booking) that only happen when you
  tap Confirm. Uses Claude; needs `ANTHROPIC_API_KEY` in Vercel. A paid add-on
  ($10/mo or $100/yr, included in the trial; Settings → Plan & billing). Run
  `supabase/migrations/0038_assistant_addon.sql`. See
  **[ASSISTANT_SETUP.md](./ASSISTANT_SETUP.md)**.
- **Private emails on the booking page**: a client's email is shown shortened
  there ("tau…@gmail.com"). The dashboard always shows the full email.
- **Deposits with Stripe**: each stylist connects their own Stripe account, turns
  deposits on, and sets a dollar amount or percent per service, plus a
  cancellation policy. Clients pay the deposit on Stripe before the booking is
  confirmed; if they don't pay, the time isn't held. See **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**.
- **Refund a deposit** (Calendar): "Refund deposit" on a cancelled booking, or in
  any booking's details while its deposit is paid. The whole deposit goes back
  to the client's card from the stylist's Stripe balance (Clientele's fee isn't
  returned), the booking is marked refunded, and the client is emailed. If
  Stripe refuses (for example, not enough in the stylist's balance), nothing
  changes and the reason is shown. No SQL needed (see `refundDeposit` in
  `lib/stripe.js`).

Each stylist only ever sees their own data. The database enforces this.

## Getting it running from an iPad

You can't run the code on an iPad itself, so **Vercel** builds it for us. The
live site is **https://www.clientelesuite.com** (Vercel project
`stylist-app-uran`). Every push to `main` rebuilds it automatically; other
branches get a private Preview copy.

### 1. Set up Supabase

Follow **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** steps 1–3, then
**[BOOKING_SETUP.md](./BOOKING_SETUP.md)**, **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**
**[PHONE_SETUP.md](./PHONE_SETUP.md)** (text message codes with Twilio; switched off for now)
**[WAITLIST_SETUP.md](./WAITLIST_SETUP.md)** (waitlist emails)
and **[REGULARS_ONLY_SETUP.md](./REGULARS_ONLY_SETUP.md)** (Regulars only and invites). Run every file in `supabase/migrations/`
in number order. Keep the
Project URL and the publishable key handy.

### 2. Connect this repo to Vercel

1. Go to **vercel.com** and sign in with GitHub.
2. Tap **Add New → Project** and import this repository.
3. Vercel detects Next.js on its own. Leave the build settings as they are.

### 3. Add your keys to Vercel

In Vercel: **Project → Settings → Environment Variables**. Tick **Production**
(and **Preview** if you want Preview copies to work too):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key |
| `NEXT_PUBLIC_SITE_URL` | `https://www.clientelesuite.com` |

Then **Deployments → newest → ⋯ → Redeploy**. (Changed keys only take effect
after a redeploy.)

For deposits and subscriptions you'll add more secret keys (`STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`). **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**
walks you through it. The Assistant add-on needs `ANTHROPIC_API_KEY`.

Now do **SUPABASE_SETUP.md steps 4 and 5** with your site address.

### 4. Try it

Open your site → **Create a stylist account** → add a service.

### 5. Deposits

Follow **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)** to set up Stripe.

## How the code is organized

```
app/                      ← every folder here is a page (URL) on the site
  page.js                 ← home page "/"
  layout.js               ← wraps every page (shared look)
  globals.css             ← all the styling
  signup/, login/         ← stylist sign up and log in
  auth/                   ← server code for sign up / log in / log out
  dashboard/              ← the stylist's private area
    layout.js             ← header + tabs shared by every dashboard page
    page.js               ← "Services" tab
    bookings/             ← "Bookings" tab
    waitlist/             ← "Waitlist" tab
    openings/             ← "Openings" tab + booking link
    clients/              ← "Clients" tab
    availability/         ← "Availability" tab
    settings/             ← "Settings" tab (name, link, time zone, deposits)
    stripe/               ← connect a stylist's Stripe account
  book/[slug]/            ← the public booking page clients use
    claim/                ← "Claim this time" page (from waitlist emails)
    waitlist/             ← a client's waitlist spot / leave the waitlist
  api/waitlist/run/       ← the every-minute waitlist check
    paid/, unpaid/        ← where Stripe sends clients after paying (or not)
  api/stripe/webhook/     ← Stripe tells the app a deposit was paid
components/               ← small reusable pieces (buttons, messages)
lib/                      ← shared helpers; lib/supabase/ connects to Supabase,
                            lib/stripe.js handles deposits
proxy.js                  ← runs before each page: keeps logins fresh,
                            sends logged-out visitors to /login
supabase/migrations/      ← database setup (paste each into Supabase SQL Editor)
supabase/waitlist_every_minute.sql ← makes Supabase run the waitlist check every minute
.env.example              ← the names of the keys the app needs
```

## If you ever use a computer

```bash
npm install
```

```bash
cp .env.example .env.local
```

Put your keys in `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000.

## Coming next

