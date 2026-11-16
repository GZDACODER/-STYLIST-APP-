# Billing setup (stylists paying Clientele)

Stylists pay Clientele a monthly or yearly plan through Stripe. This uses
**Clientele's own Stripe account**, the same one as deposits (same
`STRIPE_SECRET_KEY` and the same webhook). Stylists' own Stripe accounts are
only for their clients' deposits.

Do all of this in Stripe's **test mode** first (the "Test mode" switch at the
top of the Stripe dashboard).

## Plan and prices

Prices live in one file: `lib/plans.js`.

| | Monthly | Yearly (2 months free) |
| --- | --- | --- |
| All-in (every feature) | $25 | $250 |
| Each team member | $12.50 | $125 |

There's one plan. Team members are a quantity on a second item of the same
subscription (0 by default), so 2 team members on a monthly plan is
$25 + 2 × $12.50 = $50/month. Changes are prorated.

New stylists get a 14-day free trial with everything on and no card needed.
Clientele keeps 3% + 30¢ of each deposit a client pays (about what Stripe
charges for the card payment), so deposits cost Clientele nothing.

You don't have to make the prices in Stripe yourself. The first time someone
opens the payment page, the app makes the products and prices
(`clientele_allin_month`, `clientele_allin_year`, `clientele_team_month`,
`clientele_team_year`) and archives the old ones (`clientele_base_*`,
`clientele_regulars_*`, `clientele_waitlist_*`, `clientele_bundle_*`) so
nobody new can pick them. Anyone already paying an old price keeps it, and
gets every feature.

**Prefer to make the prices by hand?** Make them in Stripe, then add their
ids in Vercel as `STRIPE_PRICE_ALLIN_MONTH`, `STRIPE_PRICE_ALLIN_YEAR`,
`STRIPE_PRICE_TEAM_MONTH` and `STRIPE_PRICE_TEAM_YEAR`; the app uses those
instead.

**To change a price later:** change it in `lib/plans.js`. The next payment page
makes a new Stripe price and retires the old one. Stylists already paying keep
their old price until you move them (Stripe → the customer → Update
subscription).

**Customer portal:** if plan switching is turned on in Stripe → Settings →
Billing → Customer portal, list only the All-in prices there (or turn
switching off), so the old plans can't be picked.

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
2. In that account, go to **Settings → Plan & billing**, pick Monthly or
   Yearly (and team members, if any), and tap **Continue to payment**.
3. On Stripe's page, pay with the test card `4242 4242 4242 4242`, any future
   date, any CVC and any ZIP.
4. Back in Settings, the plan should show **On**. Because the account is still
   in its trial, Stripe shows the subscription as "trialing", and the first
   charge happens when the trial ends.
5. Tap **Manage billing**. Stripe's page opens. Cancel there, and the
   subscription runs until the end of the period.

To test a declined card, use `4000 0000 0000 0341`. To end a trial straight
away, open the subscription in Stripe and use **⋯ → End trial now**.

## Team members

On a paid plan, **Settings → Plan & billing → Team members** sets how many
team members the plan pays for. It updates the Stripe subscription straight
away, prorated for the rest of the period (Stripe → the customer → upcoming
invoice shows it). Staff seats will use the same helper (`setTeamMembers` in
`lib/billing.js`).

## What happens when a plan lapses

- Everything that needs a plan pauses: Regulars-only mode and the waitlist
  turn off, and no new "Regulars only" openings, invite links or standing
  appointments can be made.
- Existing openings and bookings stay as they are, and the people already on
  the waitlist are kept.
- **Failed payment:** Stripe retries for about a week (status "past due"), and
  everything stays on during that time.
- When the stylist pays again, everything is available again, and they switch
  Regulars-only mode or the waitlist back on in Settings.

## Going live later

When you're ready for real payments, switch Stripe to live mode and repeat
step 1 (customer portal) and step 2 (webhook events) there. Then put the live
keys in Vercel, as DEPOSITS_SETUP.md describes.
