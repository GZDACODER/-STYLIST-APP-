# Text message codes setup (step 6)

Clients now confirm their **mobile number** with a 6-digit text message code
(email still works as a backup). This needs a **Twilio** account (it sends the
texts) connected to **Supabase**. Do everything below in Safari on your iPad.

This guide uses Supabase's regular **Twilio** SMS provider, which works on
Twilio's **free trial**.

**What the free trial can and can't do:**

- It can only text numbers you've **verified** in Twilio (your own number is
  verified when you sign up, and you can add a few more). Everyone else gets no
  text, so for now real clients should use **Use email instead**.
- Every text starts with "Sent from your Twilio trial account".
- Before real clients can get texts, you'll need to upgrade and register your
  number with US carriers (see "Later: going live" at the bottom).

## Part 1: Run the SQL (Supabase)

1. Open `supabase/migrations/0007_phone_codes.sql` on GitHub, tap **Raw**,
   select all and copy.
2. In Supabase go to **SQL Editor → New query**, paste, tap **Run**.
   You should see "Success. No rows returned".

## Part 2: Twilio

### 2.1 Make an account

1. Go to **twilio.com** and tap **Sign up** (or **Start for free**).
2. Confirm your email, then confirm your own mobile number with the code they
   text you. That makes your number a **verified** number, so it can get codes.
3. If it asks what you're building, pick things like **SMS**, **Verification /
   one-time passwords**, **With code**. The answers don't change anything important.

### 2.2 Get a free trial phone number

1. On the Twilio **Console** home page, tap **Get a phone number** (or go to
   **Phone Numbers → Manage → Buy a number** and pick one with **SMS**).
   On the trial, it's paid for with your free trial credit.
2. Write the number down in Notes in this format, with no spaces or dashes:
   `+15551234567`.

### 2.3 Copy your Account SID and Auth Token

1. On the Console home page, scroll to **Account Info**.
2. Copy the **Account SID** (starts with `AC`) into Notes.
3. Tap **Show** next to **Auth Token** and copy that too. Treat it like a password.

### 2.4 Add other phones you want to test with (optional)

On the trial, Twilio only texts verified numbers. To test with a friend's or
another phone:

1. Go to **Phone Numbers → Manage → Verified Caller IDs**.
2. Tap **Add a new Caller ID**, type the number, and have them read you the code
   Twilio sends.

## Part 3: Connect Twilio to Supabase

1. In Supabase go to **Authentication → Sign In / Providers**.
2. Tap **Phone**.
3. Turn on **Enable Phone provider**.
4. **SMS provider**: choose **Twilio** (not "Twilio Verify").
5. Paste:
   - **Twilio Account SID**: the `AC...` one
   - **Twilio Auth Token**: the token
   - **Twilio Message Service SID**: your Twilio phone number, like `+15551234567`.
     (Despite the name, a phone number works here. If you later make a Messaging
     Service in Twilio, you can paste its `MG...` SID instead.)
6. Make sure **Enable phone confirmations** is **ON**.
7. Set **SMS OTP Expiry** to `600` (that's 10 minutes, in seconds).
8. Set **SMS OTP Length** to `6`. The booking page expects 6 digits.
9. Set **SMS Message** to:

   ```
   Your booking code is {{ .Code }}
   ```

   Keep the word "code" in it. That's part of how iPhones spot the code to
   show above the keyboard.
10. Tap **Save**.
11. Still in **Sign In / Providers**, check **Allow new users to sign up** is **ON**
    (a client's first code creates their login).

### Raise the text limit

Supabase only allows a few texts per hour at first.

1. Go to **Authentication → Rate Limits**.
2. Find the limit for **SMS messages** sent per hour and raise it (for example to `100`).
3. Tap **Save**.

### Optional: a test number that doesn't use any credit

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
2. Pick a service and time, type your mobile number (the one you verified in
   Twilio), and tap **Text me a code**.
3. When the text arrives, the code appears **above the keyboard** ("From Messages").
   Tap it. The page confirms by itself.

On an iPad, the code only pops up if the iPad gets your texts
(iPhone **Settings → Apps → Messages → Text Message Forwarding**).

### If the text doesn't arrive

1. In Twilio, go to **Monitor → Logs → Messaging** and tap the latest message.
2. Look at its status and error code:
   - **21608**: the number isn't verified. Add it in **Verified Caller IDs** (Part 2.4).
   - **30034** or **30032**: US carriers blocked it because the number isn't
     registered yet. Try buying a **toll-free** number instead (Phone Numbers →
     Buy a number → **Toll-free**), and put that in Supabase instead.
   - **21408**: texting to that country is off. Turn it on in
     **Messaging → Settings → Geo permissions**.
3. If nothing appears in the Twilio log at all, check the Supabase settings in Part 3
   (especially that the provider is **Twilio** and the phone number starts with `+1`).

Clients can always tap **Use email instead**.

## Later: going live for all clients

When you're ready for every client to get texts:

1. **Upgrade** Twilio (tap **Upgrade** at the top of the Console and add a card).
   This removes the "trial account" text and the verified-numbers-only rule.
2. **Register** your number with US carriers. For one stylist, the easiest is a
   **toll-free number** plus **toll-free verification** (Phone Numbers → Regulatory
   Compliance → Toll-Free Verifications). It's free to submit and usually takes a
   few days to a couple of weeks. A regular local number needs "A2P 10DLC"
   registration instead, which has small fees.
3. Nothing changes in the app. If you get a new number, paste it into Supabase
   (Part 3, step 5).

Each text costs about 1 cent (see twilio.com/en-us/sms/pricing/us).

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
