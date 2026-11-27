# Stripe: switching Clientele from test mode to live

Right now the live site (www.clientelesuite.com) runs on Stripe **test** keys.
Plans, deposits, balances and gift cards all go through test mode, so no real
money moves. Do these steps in order. Steps 1–5 are yours, in Stripe and
Vercel. Step 6 is a small database clean-up Claude does once you say the keys
are switched. Step 7 is one real-money check.

## 1. Activate the Stripe account for live payments
Stripe Dashboard → **Activate payments** (top banner) or Settings → Business.
- Business details, your bank account for payouts, identity check.
- Statement descriptor: what shows on card statements, e.g. `CLIENTELE`.
- Wait until the dashboard no longer shows "activate".

- **Public business name:** Settings → Business → Public details. Clients see
  this at the top of every checkout page. It currently reads "Go stylist app";
  set it to **Clientele**.
- **Payment methods:** Settings → Payment methods. Checkout currently offers
  Card, Cash App Pay, Klarna, Amazon Pay and Bank (ACH) for deposits. A booking
  is only held ~35 minutes while the client pays, and bank payments take days
  to clear, so turn **off** Bank/ACH and Klarna. Keep Card, Apple Pay, Google
  Pay and Link (Cash App / Amazon Pay are fine either way).

## 2. Turn on Connect in live mode (pros get deposits paid to them)
Dashboard, **live mode** (toggle "Test mode" off) → **Connect**.
- Finish the **platform profile**: Clientele is a platform for independent pros
  (stylists, barbers, tattoo artists, tutors) who take booking deposits.
- Clientele makes pros' accounts as **Express** accounts, collects Stripe's fees
  itself (`fees_collector: application`). Stripe covers pros' negative balances (`losses_collector: stripe`, "Managed Risk"), which live Stripe requires for this platform; disputes on deposits still land on your platform balance first
  (`losses_collector: application`). In plain words: if a client disputes a
  deposit and the pro's balance can't cover it, Clientele's Stripe balance pays.
  Stripe asks you to accept this when Connect goes live.
- Connect → Settings → **Branding**: name "Clientele", icon, gold `#a8874d`.
  Pros see this on Stripe's setup pages.
- Clientele's fee on each deposit is 3% + 30¢ (`lib/plans.js`), which covers
  Stripe's card fee. Nothing to set in Stripe for this; the app adds it.

## 3. Customer portal (pros manage their plan and card)
Live mode → Settings → Billing → **Customer portal** → turn it on and save.
Allow: update payment method, view invoices, cancel subscription (at period
end). The portal setup is separate in test and live mode, so do it in live.

## 4. Live webhook
Live mode → Developers → **Webhooks** → Add endpoint.
- URL: `https://www.clientelesuite.com/api/stripe/webhook`
- Events to send:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.paused`
  - `customer.subscription.resumed`
  - `charge.dispute.created`
  - `charge.dispute.updated`
  - `charge.dispute.closed`
- After saving, copy its **Signing secret** (`whsec_…`).

## 5. Swap the keys in Vercel
Vercel → the Clientele project → Settings → **Environment Variables**,
**Production** environment:
- `STRIPE_SECRET_KEY` → the live secret key (`sk_live_…`, Developers → API keys).
  A restricted key is fine if it can do Checkout, Customers, Subscriptions,
  Prices, Products, Billing portal, Connect accounts/links, Refunds, Disputes.
- `STRIPE_WEBHOOK_SECRET` → the live `whsec_…` from step 4.
- Leave **Preview** on the test keys, so test deploys never touch real money.
- Plan prices: nothing to do. The app creates the live Prices the first time
  someone subscribes (`lib/billing.js`). Only if you made Prices by hand, set
  `STRIPE_PRICE_ALLIN_MONTH`, `_ALLIN_YEAR`, `_TEAM_MONTH`, `_TEAM_YEAR`.
- Then **Redeploy** production (Deployments → latest → Redeploy) so the new
  keys are used.

## 6. Clear the old test records (Claude does this)
Tell Claude "the Stripe keys are live". The database still holds test-mode ids:
2 connected accounts, 1 customer and 1 subscription. Live Stripe doesn't know
them, so those pros would see errors. Claude clears them (only the Stripe ids;
nothing else changes) and your own account stays comped.

## 7. One real check with a real card
- On your own pro account: Settings → Deposits → **Connect Stripe**, finish
  the real setup with your bank.
- Book your own page with a real card and a small deposit, then cancel and
  refund it. Check: the deposit shows in Money, the refund reaches the card,
  and the payout shows in your Stripe Express dashboard.
- Subscribe a test pro account to the plan with a real card, then cancel it
  in the customer portal.

Done: tell Claude, and the launch-readiness run re-checks the live flows.
