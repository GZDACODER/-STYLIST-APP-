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

### Later: when you have a domain

1. Buy a domain (about $10 to $15 a year from places like Cloudflare, Porkbun or
   Namecheap, or in Vercel under **Domains**).
2. In Resend, go to **Domains → Add domain**, type it, and add the DNS records
   Resend shows you where you bought the domain. It can take a few minutes to an
   hour to show **Verified**.
3. In Vercel, change `EMAIL_FROM` to an address on that domain, like
   `GZ Stylist App <bookings@yoursalonapp.com>`, and redeploy.

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
