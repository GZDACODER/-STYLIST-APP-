# Supabase setup (do this once)

Everything here happens in Safari on supabase.com. No computer needed.

## 1. Create a project

1. Go to **supabase.com** and sign in (GitHub login is easiest).
2. Tap **New project**.
3. Name: `stylist-app`. Make a strong **database password** and save it
   in your password manager. (You won't need it often, but you can't see it again.)
4. Pick the **region** closest to you and your clients.
5. Tap **Create new project** and wait a minute or two while it sets up.

## 2. Create the database tables

This makes two tables: `stylists` (one per stylist account) and `services`
(name, price, minutes). It also adds **security rules** so each stylist can only
see and change their own data.

1. In this GitHub repo, open `supabase/migrations/0001_stylists_and_services.sql`.
2. Tap the **Raw** button, then select all the text and copy it.
3. In Supabase, open **SQL Editor** in the left menu (tap the ☰ menu icon if you
   don't see it), then tap **New query**.
4. Paste, then tap **Run**.
5. You should see "Success. No rows returned." Running it again later is safe.

To check it worked: open **Table Editor**. You should see `stylists` and `services`.

## 3. Copy your two keys

1. Tap the **Connect** button at the top of the project page (or go to
   **Project Settings → API Keys**).
2. Copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
3. Copy the **Publishable key**. It starts with `sb_publishable_`. If your
   project only shows an **anon** `public` key, use that one instead. It works the same way.

These two values are safe to use in the website. **Never** copy the
`secret` or `service_role` key anywhere in this project.

You'll paste them into Netlify (see README step 3).

## 4. Tell Supabase your website address

This is needed so the "confirm your email" link opens your site.

1. Go to **Authentication → URL Configuration**.
2. **Site URL**: your Netlify address, e.g. `https://your-site.netlify.app`.
   (Don't have one yet? Come back after README step 3.)
3. Under **Redirect URLs**, tap **Add URL** and add:
   - `https://your-site.netlify.app/**`
   - `http://localhost:3000/**` (only needed if you ever run the app on a computer)
4. Save.

## 5. Email confirmation (choose one)

Go to **Authentication → Sign In / Providers → Email**.

- **Confirm email ON** (default, recommended for real use): new stylists get an
  email and must tap the link before they can log in.
- **Confirm email OFF** (handy while testing): sign-up logs you straight in.

Note: Supabase's free email sender only sends a few emails per hour. That's fine
for testing. Before real launch we'll connect a proper email service.

## Seeing your data

- **Authentication → Users**: every stylist who signed up.
- **Table Editor → services**: every service stylists have added.
