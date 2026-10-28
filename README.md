# Regulars First: booking for hair stylists

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
  confirm their email with a code, and book. No app or account needed.
  Verified regulars also see the "Regulars only" times.
- **Bookings**: see upcoming bookings and cancel them.
- **Settings**: business name, booking link, and time zone (Central Time by default).

Each stylist only ever sees their own data. The database enforces this.

## Getting it running from an iPad

You can't run the code on an iPad itself, so we let **Netlify** build it for us.
Every time new code is pushed to GitHub, Netlify rebuilds the site automatically.

### 1. Set up Supabase

Follow **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** steps 1–3, then
**[BOOKING_SETUP.md](./BOOKING_SETUP.md)**. Run every file in `supabase/migrations/`
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

When it finishes, Netlify gives you an address like `https://your-site.netlify.app`.
Now do **SUPABASE_SETUP.md steps 4 and 5** with that address.

### 4. Try it

Open your Netlify address → **Create a stylist account** → add a service.

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
    openings/             ← "Openings" tab + booking link
    clients/              ← "Clients" tab
    availability/         ← "Availability" tab
    settings/             ← "Settings" tab (name, link, time zone)
  book/[slug]/            ← the public booking page clients use
components/               ← small reusable pieces (buttons, messages)
lib/                      ← shared helpers; lib/supabase/ connects to Supabase
proxy.js                  ← runs before each page: keeps logins fresh,
                            sends logged-out visitors to /login
supabase/migrations/      ← database setup (paste each into Supabase SQL Editor)
.env.example              ← the names of the keys the app needs
```

## If you ever use a computer

```bash
npm install
```

```bash
cp .env.example .env.local
```

Put your two keys in `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000.

## Coming next

- Emails to the client and stylist when a booking is made or cancelled
- Clients cancelling or changing their own booking
- Add-on features stylists can switch on (and only pay for what they use)
