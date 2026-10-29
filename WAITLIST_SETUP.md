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

The app sends waitlist emails itself, through **Resend**. If you already set up
Resend for login codes (BOOKING_SETUP.md, step 4), you've done most of this.

1. Sign in at **resend.com** (the free plan is fine).
2. **Domains:** your domain must show **Verified**. If you haven't added it yet,
   tap **Add domain**, type your domain (like `yoursalonapp.com`), and add the DNS
   records Resend shows you where you bought the domain. It can take a few
   minutes to an hour to verify.
3. **API Keys → Create API key**. Name it `stylist-app-waitlist`, permission
   **Sending access**, and tap **Add**. Copy the key (it starts with `re_`). You
   only see it once, so paste it into Notes for a moment.

## Part 3: Make a secret for the every-minute check

Every minute, Netlify checks for newly opened times (and for when the Regulars'
head start is over). A secret word makes sure only Netlify can start that check.

Make up a long random password: at least 30 letters and numbers, no spaces.
An easy way: in the **Passwords** app, tap **+**, then tap the password box and
choose **Strong Password**, then copy it. (You don't need to save it there.)

## Part 4: Add the keys to Netlify

In Netlify: **Project configuration → Environment variables → Add a variable**.
Add these three (tick **Contains secret values** where Netlify offers it):

| Key | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_...` key from Part 2 |
| `EMAIL_FROM` | who the email is from, like `GZ Stylist App <bookings@yoursalonapp.com>` (the address must be on your verified domain) |
| `CRON_SECRET` | the random password from Part 3 |

`SUPABASE_SECRET_KEY` from the deposits step is needed too. If you skipped deposits,
add it now (DEPOSITS_SETUP.md, step 5 shows where to find it).

Then go to **Deploys → Trigger deploy → Deploy project** and wait for it to finish.

### Check the every-minute check is running

In Netlify, go to **Logs & metrics → Functions** (or **Functions** in the menu) and
tap **waitlist-check**. It should say it's **Scheduled** and runs every minute.
After a minute or two you'll see it in the log. Netlify only runs it on your live
site, not on preview links.

## Part 5: Try it

1. Log in and open the new **Waitlist** tab. Make sure **Let clients join a
   waitlist** is ticked, and pick how long Regulars get first pick. Tap **Save**.
2. On the **Openings** tab, open a short time tomorrow, then book it yourself from
   your booking link (use a private Safari tab) so there are no free times left.
3. In the private tab, pick the service again. Under the times, tap **Join the
   waitlist**, pick some days and times, confirm your phone number, and join.
   Use an email address you can check.
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
3. If nothing is there, check the three keys in Netlify are spelled exactly as above,
   and that you redeployed after adding them. The **Waitlist** tab shows a warning
   if the app can't find the email keys.

## Later: text messages too

Waitlist messages are email only for now. Once Twilio has approved your number
for texting real clients (PHONE_SETUP.md, "Later: going live"), switch texts on:

1. In Netlify, add these variables:

   | Key | Value |
   | --- | --- |
   | `TEXT_MESSAGES` | `on` |
   | `TWILIO_ACCOUNT_SID` | your Twilio Account SID (starts with `AC`) |
   | `TWILIO_AUTH_TOKEN` | your Twilio Auth Token |
   | `TWILIO_FROM` | your Twilio number, like `+15551234567` (or a Messaging Service SID starting with `MG`) |

   These are the same values you put into Supabase in PHONE_SETUP.md, Part 3.
2. **Trigger deploy** again.

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
