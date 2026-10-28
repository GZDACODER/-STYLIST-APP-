# Regulars First: booking for hair stylists

A phone-friendly booking app where stylists can let their **regular clients
book first**. Stylists only pay for the add-on features they switch on.

Built with **Next.js** (the website), **Supabase** (logins and the database),
and hosted on **Netlify**.

## What works so far (Step 1)

- A stylist can **sign up** (business name, email, password) and **log in / log out**.
- On the **dashboard**, a stylist can **add services** (name, price, minutes) and delete them.
- Each stylist only ever sees their own services. The database enforces this.

## Getting it running from an iPad

You can't run the code on an iPad itself, so we let **Netlify** build it for us.
Every time new code is pushed to GitHub, Netlify rebuilds the site automatically.

### 1. Set up Supabase

Follow **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** steps 1–3. Keep the
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
  signup/                 ← "/signup" page + its form
  login/                  ← "/login" page + its form
  dashboard/              ← "/dashboard": add / list / delete services
    actions.js            ← server code that saves and deletes services
  auth/
    actions.js            ← server code for sign up, log in, log out
    confirm/route.js      ← where the "confirm your email" link lands
components/               ← small reusable pieces (buttons, messages)
lib/supabase/             ← code that connects to Supabase
proxy.js                  ← runs before each page: keeps you logged in,
                            sends logged-out visitors to /login
supabase/migrations/      ← database setup (paste into Supabase SQL Editor)
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

- Client accounts and a "regulars" list per stylist
- Stylist availability and openings
- Regulars-only booking + early access to new openings before they go public
- Add-on features stylists can switch on (and only pay for what they use)
