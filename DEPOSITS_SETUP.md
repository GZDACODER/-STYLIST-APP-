# Deposits setup (step 5)

Everything here happens in Safari. Do the steps in order. It all runs in
Stripe's **test mode** first, so no real money moves until you switch it to live.

You'll collect **three secret keys** and put them in Netlify:

| Netlify key name | Where it comes from | Looks like |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → your endpoint | `whsec_...` |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys | `sb_secret_...` |

These three are **secret**. They only ever go in Netlify, never in the code and
never in a key name that starts with `NEXT_PUBLIC_`.

## 1. Run the SQL

Open `supabase/migrations/0006_deposits.sql`, tap **Raw**, copy all of it,
paste into Supabase **SQL Editor → New query**, and tap **Run**.
You should see "Success. No rows returned."

## 2. Make a Stripe account

1. Go to **dashboard.stripe.com/register** and sign up.
   Stripe asks you to "activate payments". **Skip that for now.** You don't
   need to finish it for test mode.
2. Make sure you're in **test mode**: look for a **Test mode** switch or a
   **Sandbox** label at the top of the dashboard. Everything below is done
   in test mode.

## 3. Turn on Stripe Connect

Connect is what lets each stylist get paid into **their own** Stripe account.
Your app is the "platform".

1. In the Stripe dashboard, search for **Connect** (search bar at the top) and
   tap **Get started**.
2. When it asks how payments work, choose **"You collect payments and pay
   recipients"** (a marketplace). If it asks which dashboard your users get,
   choose **Express**.
3. Stripe may ask you to fill in a **platform profile**. Fill it in. If it asks
   who handles fees and who covers losses (negative balances), choose
   **the platform** (you) for both. Stripe requires that for the kind of
   stylist accounts this app creates, so your platform covers it if a
   stylist's account can't pay back a refund or dispute.
   (The app uses Stripe's newer "Accounts v2" for stylist accounts.)
4. Go to **Settings → Connect → Branding** and add your app's name, an icon
   and a color. Stylists see this when they connect their account.

Stripe changes its menus from time to time. If a name doesn't match exactly,
look for the closest one.

## 4. Copy your Stripe secret key

1. Go to **Developers → API keys** (or search "API keys").
2. Next to **Secret key**, tap **Reveal** and copy it. It starts with `sk_test_`.

(You don't need the publishable `pk_test_` key. Clients pay on Stripe's own page.)

## 5. Copy your Supabase secret key

The app's server uses this to confirm bookings after Stripe says they're paid.

1. In Supabase, go to **Project Settings → API Keys**.
2. Under **Secret keys**, copy the key that starts with `sb_secret_`
   (tap **Create new secret key** if there isn't one). Older projects might only
   show a **service_role** key instead. That works too.

## 6. Add the keys to Netlify

In Netlify: **Project configuration → Environment variables → Add a variable**.
Add these (tick **Contains secret values** if Netlify offers it):

| Key | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the `sk_test_...` key from step 4 |
| `SUPABASE_SECRET_KEY` | the `sb_secret_...` key from step 5 |

Then go to **Deploys → Trigger deploy → Deploy project** and wait for it to finish.

## 7. Tell Stripe where to send payment updates (webhook)

When a client pays (or leaves without paying), Stripe tells your app by calling
a web address. This is what confirms the booking.

1. In Stripe, go to **Developers → Webhooks** (or search "Webhooks") and tap
   **Add destination** (or **Add endpoint**).
2. Events from: **Your account** (not "Connected accounts").
3. Select these two events (search for them):
   - `checkout.session.completed`
   - `checkout.session.expired`
4. Destination type: **Webhook endpoint**.
5. Endpoint URL: `https://your-site.netlify.app/api/stripe/webhook`
   (use your real Netlify address).
6. Create it. Then open it and **Reveal** the **Signing secret**. It starts with
   `whsec_`.
7. In Netlify, add one more variable: `STRIPE_WEBHOOK_SECRET` = that `whsec_...`
   value. Then **Trigger deploy** again.

## 8. Connect your stylist account to Stripe

1. Open your site, log in, and go to **Settings**.
2. Under **Get paid with Stripe**, tap **Connect Stripe**.
3. Stripe asks for details. In test mode, use fake test details:
   - Phone: `000 000 0000`, and code `000000` if it texts you a code
   - Date of birth: `01/01/1901`
   - SSN (last 4 or full): `0000` or `000-00-0000`
   - Address line 1: `address_full_match`, any real-looking city/state/ZIP
   - Bank routing number: `110000000`, account number: `000123456789`
   - If you see a **"Use test account"** or **"Skip this form"** button, you can
     tap that instead.
4. You come back to Settings. It should say **Connected**. If it says
   "Stripe is checking your details", wait a minute and refresh.

Every stylist who signs up to your app does this same step for their own account.

## 9. Turn deposits on

Still on **Settings**, in **Deposits**:

1. Tick **Take deposits when clients book online**.
2. For each service, choose **Dollar amount** or **Percent of price** and type
   the amount. The line underneath shows what the client pays now.
3. Type your **cancellation policy**. Clients must agree to it before paying.
4. Tap **Save deposits**.

## 10. Try a booking

1. Open your booking link (Openings tab) in a private Safari tab.
2. Pick a service with a deposit, a time, and confirm your email.
3. Tick the cancellation policy box and tap **Pay $… deposit**.
4. On Stripe's page, use the test card `4242 4242 4242 4242`, any future date,
   any 3-digit CVC and any ZIP.
5. You land on **"You're booked!"**. On your **Bookings** tab, the booking
   shows **$… deposit paid**.

Also try leaving without paying (tap the back arrow on Stripe's page): the
booking page says the time wasn't booked, and the time is free again.

To see the payment: Stripe dashboard → **Payments** (your platform), and in
the app tap **Open Stripe** on Settings (the stylist's own account).

## How it works

- When a client taps **Pay deposit**, their time is **held for about 30 minutes**
  while Stripe's payment page is open, so nobody else can grab it mid-payment.
- **Paid:** the booking is confirmed.
- **Not paid** (they leave, or the 30 minutes run out): the booking isn't made
  and the time opens up again. It never shows on your Bookings tab as booked.
- While someone is paying, you see them under **Waiting for deposit** on the
  Bookings tab.
- In the rare case a payment finishes after the hold ran out and someone else
  booked the time, the deposit is **refunded automatically**.
- The deposit goes straight to the stylist's own Stripe account, and Stripe pays
  it out to their bank.
- If you cancel a booking that had a deposit, it **isn't refunded
  automatically**. If your policy says to refund, tap **Open Stripe** on Settings,
  find the payment, and refund it there.

## Going live later (real money)

Only when you're ready to take real payments:

1. In Stripe, **activate your account** (business and bank details).
2. Finish the Connect setup for live mode (platform profile, branding).
3. Switch Stripe out of test mode and copy the **live** secret key (`sk_live_...`).
4. Make a new webhook in live mode (same URL, same two events) and copy its
   new signing secret.
5. In Netlify, replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the
   live values and redeploy.
6. Stylists connect Stripe again with their real details (test-mode accounts
   don't carry over). To make this happen, clear each stylist's
   `stripe_account_id` and `stripe_charges_enabled` in Supabase's Table Editor
   (stylists table).
