# Clientele: booking for hair stylists

A phone-friendly booking app where stylists can let their **regular clients
book first**. Stylists only pay for the add-on features they switch on.

Built with **Next.js** (the website), **Supabase** (logins and the database),
and hosted on **Netlify**.

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
- **Bookings**: see upcoming bookings (with deposit paid or not) and cancel them.
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
- **Private emails on the booking page**: a client's email is shown shortened
  there ("tau…@gmail.com"). The dashboard always shows the full email.
- **Deposits with Stripe**: each stylist connects their own Stripe account, turns
  deposits on, and sets a dollar amount or percent per service, plus a
  cancellation policy. Clients pay the deposit on Stripe before the booking is
  confirmed; if they don't pay, the time isn't held. See **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**.

Each stylist only ever sees their own data. The database enforces this.

## Getting it running from an iPad

You can't run the code on an iPad itself, so we let **Netlify** build it for us.
Every time new code is pushed to GitHub, Netlify rebuilds the site automatically.

### 1. Set up Supabase

Follow **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** steps 1–3, then
**[BOOKING_SETUP.md](./BOOKING_SETUP.md)**, **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**
**[PHONE_SETUP.md](./PHONE_SETUP.md)** (text message codes with Twilio; switched off for now)
**[WAITLIST_SETUP.md](./WAITLIST_SETUP.md)** (waitlist emails)
and **[REGULARS_ONLY_SETUP.md](./REGULARS_ONLY_SETUP.md)** (Regulars only and invites). Run every file in `supabase/migrations/`
in number order. Keep the
Project URL and the publishable key handy.

### 2. Connect this repo to Netlify

1. Go to **app.netlify.com** and sign in with GitHub.
2. Tap **Add new project → Import an existing project → GitHub**.
3. Pick this repository. If your code is on a different branch than `main`,
   choose that branch.
4. Netlify detects Next.js on its own. Leave the build settings as they are.

### 3. Add your keys to Netlify

Before deploying (or right after, then redeploy), add two
**environment variables**. In Netlify: **Project configuration → Environment variables → Add a variable**:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key |

Then go to **Deploys → Trigger deploy → Deploy project**.

For deposits you'll add three more secret keys later (`STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`). **[DEPOSITS_SETUP.md](./DEPOSITS_SETUP.md)**
walks you through it.

When it finishes, Netlify gives you an address like `https://your-site.netlify.app`.
Now do **SUPABASE_SETUP.md steps 4 and 5** with that address.

### 4. Try it

Open your Netlify address → **Create a stylist account** → add a service.

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

- Emails to the client when a booking is made, and to the stylist for new bookings
- Clients changing their own booking
- Refunding a deposit from the Bookings tab
- Add-on features stylists can switch on (and only pay for what they use)
