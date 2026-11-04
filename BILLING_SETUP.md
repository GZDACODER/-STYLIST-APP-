# Billing setup (stylists paying Clientele)

Stylists pay Clientele a monthly or yearly plan through Stripe. This uses
**Clientele's own Stripe account**, the same one as deposits (same
`STRIPE_SECRET_KEY` and the same webhook). Stylists' own Stripe accounts are
only for their clients' deposits.

Do all of this in Stripe's **test mode** first (the "Test mode" switch at the
top of the Stripe dashboard).

## Plans and prices

Prices live in one file: `lib/plans.js`.

| Plan | Monthly | Yearly (2 months free) |
| --- | --- | --- |
| Clientele (base) | $15 | $150 |
| Regulars First add-on | $10 | $100 |
| Waitlist add-on | $7 | $70 |
| All-in (everything) | $29 | $290 |

New stylists get a 14-day free trial with everything on and no card needed.
Clientele keeps 2% of each deposit a client pays.

You don't make the prices in Stripe yourself. The first time someone opens the
payment page, the app makes the products and prices in Stripe. They're
named `clientele_base_month`, `clientele_bundle_year` and so on.

**To change a price later:** change it in `lib/plans.js`. The next payment page
makes a new Stripe price and retires the old one. Stylists already paying keep
their old price until you move them (Stripe → the customer → Update
subscription).

## 1. Customer portal (done)

Stripe → **Settings → Billing → Customer portal**: active, with payment methods
and "cancel at end of period" on. This is the page that **Manage billing** in
Settings opens.

## 2. Add the subscription events to your webhook

1. Stripe (test mode) → **Developers → Webhooks** → open your existing
   endpoint (`.../api/stripe/webhook`).
2. Tap **⋯ → Update details** (or **Edit destination**), then **Select events**.
3. Keep the events that are already there, and add these five:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
4. Save. The signing secret doesn't change, so Vercel needs nothing new.

## 3. Test it

Your own account is a free founding account, so it never sees the plan
picker. Test with a new stylist account:

1. Sign up a test stylist with another email address (for example
   `you+test@gmail.com`). It starts a 14-day trial.
2. In that account, go to **Settings → Your plan**, pick a plan, and tap
   **Continue to payment**.
3. On Stripe's page, pay with the test card `4242 4242 4242 4242`, any future
   date, any CVC and any ZIP.
4. Back in Settings, the plan should show **On**. Because the account is still
   in its trial, Stripe shows the subscription as "trialing", and the first
   charge happens when the trial ends.
5. Tap **Manage billing**. Stripe's page opens. Cancel there, and the
   subscription runs until the end of the period.

To test a declined card, use `4000 0000 0000 0341`. To end a trial straight
away, open the subscription in Stripe and use **⋯ → End trial now**.

## What happens when a plan lapses

- **Regulars First paused:**
  - Regulars-only mode turns off.
  - No new "Regulars only" openings or invite links can be made.
  - Existing openings and bookings stay as they are.
- **Waitlist paused:**
  - The waitlist turns off.
  - New people can't join, and nobody is emailed.
  - The people already on it are kept.
- **Failed payment:** Stripe retries for about a week (status "past due"), and
  everything stays on during that time.
- When the stylist pays again, the add-ons are available again, and they switch
  Regulars-only mode or the waitlist back on in Settings.

## Going live later

When you're ready for real payments, switch Stripe to live mode and repeat
step 1 (customer portal) and step 2 (webhook events) there. Then put the live
keys in Vercel, as DEPOSITS_SETUP.md describes.
