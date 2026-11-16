# Assistant setup

The dashboard's **Assistant** is a chat that pops up from a round button in the
bottom corner of every dashboard page. A pro asks about their schedule and makes
changes in their own words ("block off Friday afternoon", "who's booked
tomorrow?", "I'm on vacation Dec 22 to Jan 2"). It uses Claude (Anthropic's
API, model `claude-opus-5-5`). Nothing changes until the pro taps **Confirm**.

## Switch it on

1. Go to **console.anthropic.com** and sign in (or create an account).
2. Add a payment method under **Billing**, and set a monthly spend limit
   (**Limits**) you're comfortable with.
3. Go to **API Keys → Create Key**. Name it "Clientele" and copy the key.
4. In **Vercel → your project → Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` with that key, for **Production** (and Preview if you
   want it there too).
5. Redeploy (Deployments → the latest → Redeploy).

Until the key is set, the chat button doesn't appear. Nothing else changes.

## What it can do

- **Read:** the schedule for up to 31 days at a time (bookings, events,
  blocked days, open times, working hours, holidays), and look up clients.
- **Propose, then do once confirmed:** add a calendar event (with or without
  Block bookings), block whole days off, cancel a booking. These go through the
  same server code as the dashboard's own buttons.
- **Can't:** move bookings, take or refund payments, or message clients.

## Price (a paid add-on)

The Assistant is an optional add-on: **$15/month or $150/year** (`lib/plans.js`),
billed on the pro's Clientele subscription.

- **Free trial:** included. It turns off when the trial ends unless they add it.
- **Choosing a plan:** a tickbox, **Add the Assistant**, in Settings → Plan & billing.
- **Already paying:** **Add the Assistant** / **Remove the Assistant** in the same
  place, prorated for the rest of the period.
- **Founding (free) accounts:** they pay for it too, with their own small checkout
  (monthly or yearly). Removing it stops it at the end of what they've paid for.
- The chat button only shows, and requests are only answered, when it's on their
  plan. Run `supabase/migrations/0038_assistant_addon.sql` (step 33) first.

The add-on and the homepage line about it only appear once `ANTHROPIC_API_KEY` is
set. Stripe makes the "Assistant" prices itself the first time someone adds it
(or set `STRIPE_PRICE_ASSISTANT_MONTH` / `STRIPE_PRICE_ASSISTANT_YEAR` in Vercel).

## Cost to Clientele

Claude Opus 5.5 is $4 per million input tokens and $20 per million output
tokens. A typical request (a question, or a change with a schedule lookup)
costs roughly 2 to 5 cents; a long chat costs more because the whole
conversation is sent each time. The Anthropic Console shows exact usage. Set a
spend limit there.

## Privacy

Each request sends the business's schedule details it needs (client names,
services, times) to Anthropic to answer. Conversations aren't stored by
Clientele: they live in the browser tab until "New chat" or the tab closes.
The Privacy Policy (sections 4, 5 and 6) says this.
