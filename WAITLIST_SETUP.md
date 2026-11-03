# Waitlist setup (step 7)

When no times work, clients can join your **waitlist** from your booking page.
When a time opens up, the app emails them a **Claim this time** link.
Do everything below in Safari on your iPad.

## How it works

- **Joining:** on the booking page, a client picks a service, taps **Join the
  waitlist**, chooses the days and times of day that suit them (or none, for
  "any time"), and confirms their phone number with a code, just like booking.
- **A time opens up** when a booking is cancelled (by you on the **Bookings** tab,
  or by the client on the booking page), when you post new times on the
  **Openings** tab, when you switch a "Regulars only" time to "Everyone", or when
  someone doesn't pay their deposit in time.
- **Regulars first:** waitlisted Regulars are emailed straight away. Everyone else
  is emailed after the head start you pick on the **Waitlist** tab (30 minutes to
  start with), but only if the time is still free. If no Regular wants that time,
  everyone is emailed straight away.
- **Claiming:** the first person to tap **Claim this time** and confirm gets it.
  Everyone else who taps their link sees "Sorry, this time was just taken". If the
  service has a deposit, they pay it on Stripe as usual, and if they don't pay,
  the time opens up again.
- A client comes off the waitlist when they book that service, when they tap
  **Leave the waitlist** in any email, when you remove them, or after 90 days.
- Clients can now **cancel their own bookings** on your booking page (after they
  confirm their phone number). You get an email when they do. Deposits aren't
  refunded automatically.

## Part 1: Run the SQL (Supabase)

1. Open `supabase/migrations/0008_waitlist.sql` on GitHub, tap **Raw**, select
   all and copy.
2. In Supabase go to **SQL Editor → New query**, paste, and tap **Run**.
   You should see "Success. No rows returned".
3. Do the same with `supabase/migrations/0009_waitlist_retry.sql` (it makes
   failed emails try again every 15 minutes).

## Part 2: Email (Resend)

The app sends waitlist emails itself, through **Resend** (the free plan is fine).

1. Sign up or sign in at **resend.com**.
2. **API Keys → Create API key**. Name it `stylist-app-waitlist`, permission
   **Sending access**, and tap **Add**. Copy the key (it starts with `re_`). You
   only see it once, so paste it into Notes for a moment.

### No domain yet? Use Resend's test address for now

Emails have to come from an address on a domain you own (like
`bookings@yoursalonapp.com`). Until you have one, use Resend's test sender:

```
GZ Stylist App <onboarding@resend.dev>
```

**The catch:** with the test sender, Resend only delivers to **the email address
you signed up to Resend with**. That's enough to try everything yourself (join
the waitlist with that email), but **real clients won't get waitlist emails**
until you add a domain. Emails to anyone else are refused by Resend; the app
tries them 3 times and then gives up, and nothing else breaks.

### When you're ready for real clients: your own domain

See **[Send from your own domain](#send-from-your-own-domain)** near the end.

## Part 3: Make a secret for the every-minute check

Every minute, Supabase pings your site so it can check for newly opened times
(and for when the Regulars' head start is over). A secret password makes sure
only Supabase can start that check.

Make up a long random password: at least 30 letters and numbers, no spaces.
An easy way: in the **Passwords** app, tap **+**, then tap the password box and
choose **Strong Password**, then copy it into Notes. You'll paste it twice:
once in Vercel (Part 4) and once in Supabase (Part 5).

## Part 4: Add the keys to Vercel

In Vercel, open your project, then **Settings → Environment Variables**. Add
these three (leave **Environments** on all of them):

| Key | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_...` key from Part 2 |
| `EMAIL_FROM` | `GZ Stylist App <onboarding@resend.dev>` for now (see Part 2) |
| `CRON_SECRET` | the random password from Part 3 |

`SUPABASE_SECRET_KEY` from the deposits step is needed too. If you skipped deposits,
add it now (DEPOSITS_SETUP.md, step 5 shows where to find it).

Vercel only uses new keys after a fresh deploy: go to **Deployments**, tap the
**⋯** next to the newest one, and tap **Redeploy**.

## Part 5: Turn on the every-minute check (Supabase)

Vercel's free plan only runs scheduled jobs once a day, so Supabase does the
timing instead. It's included in Supabase's free plan.

1. Open `supabase/waitlist_every_minute.sql` on GitHub and tap **Raw**. Select
   all and copy it.
2. In Supabase go to **SQL Editor → New query** and paste it.
3. Near the top, change the two values (keep the quote marks around them):
   - `https://YOUR-APP.vercel.app` → your Vercel address, like
     `https://gz-stylist-app.vercel.app` (find it on your Vercel project's main
     page, under **Domains**)
   - `PASTE-YOUR-CRON-SECRET-HERE` → the password from Part 3, exactly as in Vercel
4. Tap **Run**. You should see "Success".

If you ever change your Vercel address or the password, change it in this SQL
and run it again.

### Check it's working

After a couple of minutes, run this in a new SQL Editor query:

```sql
select status_code, left(content::text, 80) as answer, created
from net._http_response
order by created desc
limit 5;
```

- `200` with `{"told":0}` (or a number): working.
- `200` with `"skipped"`: the email keys aren't in Vercel yet, or you haven't redeployed.
- `401`: the password in Supabase doesn't match `CRON_SECRET` in Vercel.
- `404`: the Vercel address is wrong.
- Nothing at all: wait another minute and check the SQL in step 3 ran without an error.

## Part 6: Try it

1. Log in and open the new **Waitlist** tab. Make sure **Let clients join a
   waitlist** is ticked, and pick how long Regulars get first pick. Tap **Save**.
2. On the **Openings** tab, open a short time tomorrow, then book it yourself from
   your booking link (use a private Safari tab) so there are no free times left.
3. In the private tab, pick the service again. Under the times, tap **Join the
   waitlist**, pick some days and times, confirm your phone number, and join.
   Use the email address you signed up to Resend with (see Part 2).
4. Back in the dashboard, go to **Bookings** and **Cancel booking** on that booking.
5. Within a minute, you get an email: **A time opened up**. Tap **Claim this time**,
   then **Claim this time** again on the page. You're booked.

To test the Regulars head start, mark yourself a **Regular** on the Clients tab
(matched by phone number) and join with a second phone number or email as a
non-regular. The Regular is emailed first; the other one after the head start.

### If no email arrives

The **Waitlist** tab shows a red note under a client when their email couldn't
be sent, with Resend's reason. The app tries again every 15 minutes for up to a
day, so once you fix the problem the email goes out by itself.

Common reasons:

- **"You can only send testing emails to your own email address"**: you're using
  the test sender (`onboarding@resend.dev`) and the client's email isn't the one
  you signed up to Resend with. Fix: send from your own domain (below).
- **"The ... domain is not verified"**: `EMAIL_FROM` uses a domain Resend hasn't
  verified yet. Check **Domains** in Resend says **Verified**.
- **"API key is invalid"**: `RESEND_API_KEY` in Vercel is wrong or was deleted.
- **"Invalid `from` field"**: `EMAIL_FROM` must look exactly like
  `GZ Stylist App <bookings@yourdomain.com>` (no quote marks around it).

Other things to check:

1. Check your spam folder.
2. In Resend, open **Emails** (or **Logs**). If the email is there with an error,
   it says why (often the `EMAIL_FROM` address isn't on your verified domain).
   If it says the address isn't allowed, you're using the test sender and
   emailing someone other than your Resend account's own email (see Part 2).
3. If nothing is there, check the three keys in Vercel are spelled exactly as above,
   and that you redeployed after adding them. The **Waitlist** tab shows a warning
   if the app can't find the email keys.
4. Check the every-minute check is working (Part 5). Cancelling a booking or
   posting times emails people straight away even without it, but the second
   round (everyone else, after the Regulars' head start) is only sent by the
   every-minute check.

## Send from your own domain

The test sender only delivers to your own Resend email. To email real clients,
send from a domain you own. Do this in Safari; it takes about 20 minutes plus
waiting for the domain to verify.

### Step 1: Buy a domain (about $10 to $15 a year)

1. Pick a place to buy it: **Cloudflare** (dash.cloudflare.com → **Domain
   Registration → Register Domains**), **Porkbun**, **Namecheap**, or right in
   Vercel (your project → **Settings → Domains → Buy**).
2. Search for a name, like `cutsbysam.com`, and buy it. Write down where you
   bought it; that's where you'll add Resend's records.

### Step 2: Add the domain to Resend

1. Go to **resend.com → Domains → Add domain**.
2. Type a **sending subdomain**, like `mail.cutsbysam.com` (Resend recommends a
   subdomain so your main domain stays clean). Pick the region closest to you
   (**us-east-1** is fine in the US) and tap **Add**.
3. Resend shows a list of **DNS records** (usually 3 or 4: one **MX**, one or two
   **TXT** for SPF and DKIM, and sometimes a TXT for DMARC). Keep this page open.

### Step 3: Add Resend's records where you bought the domain

Open the DNS settings for your domain in a second Safari tab:

- **Cloudflare:** your domain → **DNS → Records → Add record**.
- **Porkbun:** **Domain Management** → your domain → **DNS**.
- **Namecheap:** **Domain List → Manage → Advanced DNS → Add new record**.
- **Vercel:** **Settings → Domains** → your domain → **DNS Records**.

For **each** record on Resend's page, add one record with the same:

- **Type** (MX or TXT)
- **Name** (also called Host). Copy it exactly, like `send.mail` or
  `resend._domainkey.mail`. Some sites add your domain on the end by themselves;
  if the site shows the full name after you save (like
  `send.mail.cutsbysam.com`), that's right.
- **Value** (also called Content or Target). Tap the copy button on Resend's
  page and paste. DKIM values are long; paste the whole thing.
- **Priority** for the MX record: the number Resend shows (usually `10`).
- On Cloudflare, leave **Proxy status** as **DNS only**.

Save each one.

### Step 4: Verify

1. Back on Resend's domain page, tap **Verify DNS records** (or **Verify**).
2. It usually shows **Verified** within a few minutes, sometimes up to a few
   hours. Refresh now and then. If a record says **Failed**, compare its Name and
   Value with what you typed (a missing letter or an extra space is the usual
   cause), fix it, and tap Verify again.

### Step 5: Change EMAIL_FROM in Vercel

1. In Vercel, open your project → **Settings → Environment Variables**.
2. Find `EMAIL_FROM`, tap **⋯ → Edit**, and change it to an address on your
   verified domain, like:

   ```
   GZ Stylist App <bookings@mail.cutsbysam.com>
   ```

   The part before `@` can be anything; it doesn't need to be a real inbox.
   Clients' replies go to your stylist login email.
3. Tap **Save**, then **Deployments → ⋯ → Redeploy**. New values only work after
   a redeploy.

### Step 6: Check the waitlist emails go out

Emails that failed earlier are tried again by themselves every 15 minutes for up
to a day, so within 15 minutes of redeploying they should arrive. To send them
straight away, or if more than a day has passed, run
`supabase/migrations/0009_waitlist_retry.sql` again in Supabase (it gives failed
emails a fresh start; nobody gets a duplicate). Then check the Waitlist tab: the
red note disappears and it says "Told about ... times".

## Later: text messages too

Waitlist messages are email only for now. Once Twilio has approved your number
for texting real clients (PHONE_SETUP.md, "Later: going live"), switch texts on:

1. In Vercel (**Settings → Environment Variables**), add these:

   | Key | Value |
   | --- | --- |
   | `TEXT_MESSAGES` | `on` |
   | `TWILIO_ACCOUNT_SID` | your Twilio Account SID (starts with `AC`) |
   | `TWILIO_AUTH_TOKEN` | your Twilio Auth Token |
   | `TWILIO_FROM` | your Twilio number, like `+15551234567` (or a Messaging Service SID starting with `MG`) |

   These are the same values you put into Supabase in PHONE_SETUP.md, Part 3.
2. **Redeploy** (Deployments → **⋯** → **Redeploy**).

From then on, the waitlist form shows a **Text me too** box. Clients who tick it
get a text as well as the email (or just a text, if they leave the email empty).
Clients who joined before you switched texts on keep getting emails only. Twilio
handles "STOP" replies for you. To switch texts off again, delete `TEXT_MESSAGES`
(or set it to `off`) and redeploy.

## How it stays secure

- Joining the waitlist needs a phone number (or email) proved with a code, the
  same as booking. Only what was proved can make someone a Regular.
- Each **Claim this time** link has a long secret code, and only works for that
  one client and that one time. Claims go through the same checks as booking
  (blocked clients, the 3-booking limit, deposits), and two people can't claim the
  same time.
- Only the app's server (with the secret key) can run the waitlist check or see
  who to email.
