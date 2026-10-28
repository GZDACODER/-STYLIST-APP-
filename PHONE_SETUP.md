# Text message codes setup (step 6)

Clients now confirm their **mobile number** with a 6-digit text message code
(email still works as a backup). This needs a **Twilio** account (it sends the
texts) connected to **Supabase**. Do everything below in Safari on your iPad.

We use **Twilio Verify**, not a plain Twilio phone number. Verify sends texts
from Twilio's own already-registered numbers, so you **don't** have to do the
US carrier registration ("A2P 10DLC"), which takes weeks and costs extra.

## Part 1: Run the SQL (Supabase)

1. Open `supabase/migrations/0007_phone_codes.sql` on GitHub, tap **Raw**,
   select all and copy.
2. In Supabase go to **SQL Editor → New query**, paste, tap **Run**.
   You should see "Success. No rows returned".

## Part 2: Twilio

### 2.1 Make an account

1. Go to **twilio.com** and tap **Sign up** (or **Start for free**).
2. Confirm your email, then confirm your own mobile number with the code they text you.
3. If it asks questions about what you're building, pick things like
   **Verify / two-factor authentication**, **With code**, **JavaScript**. The answers
   don't change anything important.

### 2.2 Copy your Account SID and Auth Token

1. On the Twilio **Console** home page, scroll to **Account Info**.
2. Copy the **Account SID** (starts with `AC`) into Notes.
3. Tap **Show** next to **Auth Token** and copy that too. Treat it like a password.

### 2.3 Create a Verify service

1. In the left menu, tap **Explore products** (or the **+**), find **Verify**, and open it.
   Then go to **Verify → Services**.
2. Tap **Create new**.
3. **Friendly name**: your business name, for example `GZ Stylist`.
   Clients see this in the text: *"Your GZ Stylist verification code is: 123456"*.
4. Turn on the **SMS** channel. You can leave the others off.
5. Tap **Continue**. If it asks about **Fraud Guard**, leave it **on**.
6. On the service page, copy the **Service SID** (starts with `VA`) into Notes.
7. Check **Code length** is **6** (that's the default).

### 2.4 Upgrade from the free trial (before real clients use it)

A trial Twilio account can only text numbers you've verified yourself. That's
fine for testing with your own phone, but clients won't get codes until you upgrade.

1. Tap **Upgrade** at the top of the Console (or **Admin → Account billing**).
2. Add a card and some credit ($20 is the minimum and lasts a long time).

It costs about 5 cents per client who confirms (see twilio.com/en-us/verify/pricing).

To text a friend's phone while still on the trial, add their number under
**Phone Numbers → Manage → Verified Caller IDs** first.

## Part 3: Connect Twilio to Supabase

1. In Supabase go to **Authentication → Sign In / Providers**.
2. Tap **Phone**.
3. Turn on **Enable Phone provider**.
4. **SMS provider**: choose **Twilio Verify** (not plain "Twilio").
5. Paste:
   - **Twilio Account SID**: the `AC...` one
   - **Twilio Auth Token**: the token
   - **Twilio Verify Service SID**: the `VA...` one
6. Make sure **Enable phone confirmations** is **ON**.
7. Tap **Save**.
8. Still in **Sign In / Providers**, check **Allow new users to sign up** is **ON**
   (a client's first code creates their login).

### Raise the text limit

Supabase only allows a few texts per hour at first.

1. Go to **Authentication → Rate Limits**.
2. Find the limit for **SMS messages** sent per hour and raise it (for example to `100`).
3. Tap **Save**.

### Optional: a test number that doesn't cost anything

In **Authentication → Sign In / Providers → Phone**, under **Test Phone Numbers and OTPs**,
you can add a pretend number and code, like `15555550123=123456`. Typing
`(555) 555-0123` on the booking page then accepts the code `123456` without sending
a real text. (No real text means the code won't pop up above the keyboard. Use
your real number to test that.)

## Part 4: Netlify

Nothing to add. The Twilio keys live in Supabase, not in Netlify. Netlify rebuilds
the site by itself after the new code reaches GitHub.

## Part 5: Try it

1. On your **iPhone**, open your booking link in Safari (find it on the **Openings** tab).
2. Pick a service and time, type your mobile number, tap **Text me a code**.
3. When the text arrives, the code appears **above the keyboard** ("From Messages").
   Tap it. The page confirms by itself.

On an iPad, the code only pops up if the iPad gets your texts
(iPhone **Settings → Apps → Messages → Text Message Forwarding**).

If a client doesn't get the text, they can tap **Use email instead**.

## Regulars

- **Settings → Regulars**: pick how many **completed** appointments make a client
  a Regular automatically (3 to start with, or **Never**). An appointment counts
  once its end time has passed. Cancelled ones don't count.
- This starts working as soon as you run the SQL, so clients who already had
  3 appointments become Regulars the next time you open the Clients tab, or the next
  time they open your booking page.
- You can still change anyone on the **Clients** tab. If you take someone off
  Regular by hand, the app won't make them a Regular again automatically.
- Clients are matched by **phone number**, so put your regulars' mobile numbers
  on the Clients tab. Any way of writing it works: `(555) 123-4567`, `555.123.4567`
  or `+1 555 123 4567`.

## How it stays secure

- Only a phone number someone **proved** with a text code (or an email they proved
  with an email code) can make them a Regular. Typing a regular's number into a
  form isn't enough.
- A blocked client is blocked whether they confirm by phone or by email. A blocked
  client's number or email typed into the form also stops the booking.
- The Twilio keys are only stored in Supabase, never in the app's code.
