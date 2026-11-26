# Home: "Fill your book" — design

Date: 2026-11-26 · Status: draft for owner approval · Part 1 of 2 (part 2, the landing page, follows and reuses this look)

## Intent and the why

Stylists (independent pros: stylists, barbers, tattoo artists, tutors) set Clientele up and then forget it exists. The owner wants Home (`/dashboard`, where login lands) to be the screen they're glad to open every day, so they keep using Clientele (retention).

Asked what a stylist should see on a slow Tuesday morning that makes them glad they opened it, the owner said: **getting their book filled and seeing their money grow.** The owner also asked for it to feel **luxury, interactive, unique and eye-catching**.

So Home's job is to show, at a glance, **how full this week is** and **how this month's money is growing**, and to turn both into **one-tap moves** that fill the book or bring money in.

## Goals

- First glance (no scrolling, on a phone too) answers "how full is my week?" and "is my money growing?"
- Each visit offers 1–3 concrete, real one-tap moves to fill the book or collect money, built from the pro's own data.
- It feels alive: things animate in, respond to touch and hover, and celebrate wins (a fully booked week, a month ahead of last).
- Luxury, in the existing design system (cream and gold, frosted glass, Cormorant headings, Inter text, gold primary / ghost secondary buttons). Unique to Clientele, not a generic dashboard.

## Non-goals

- No monthly money goal (that was approach B; maybe later as an option).
- No streaks, points or daily checklist (approach C).
- No change to Today, Calendar, Money or Insights, beyond being linked to.
- The landing page is part 2, designed after this.

## Anti-goals (failure even if it works)

- **Buttons that don't do anything new.** Example: "Tell your waitlist". The waitlist is already contacted automatically within a minute of a time opening, so that button would be fake.
- **Numbers that disagree** with Money, Insights or Today for the same period.
- **A slower Home.** It must not add sequential database trips; it currently loads in ~0.2s.
- **Motion that gets in the way:** repeated on every visit, blocking taps, or ignoring reduced motion.
- **A new pro's empty Home.** With no data it must still look good, using the app's existing example data, tagged Example.

## Constraints

- **Data:** no new tables, columns or SQL, and no changes to existing actions or routes. Use what exists:
  - openings
  - bookings
  - payments (via `lib/moneyTab.js` `earnings()`, the same rules as Money)
  - clients
  - the Insights "overdue" logic (`lib/insights.js`)
  - waitlist counts
- **One-tap moves may only use existing actions:**
  - `inviteBack` (`reports/actions.js`, max once per 30 days per client)
  - `remindBalance` (`money/actions.js`)
  - the Add opening slide-over (`/dashboard/openings#add-opening`)
  - Share booking link (`shell/ShareCta`)
  - plain links to existing pages
- **Speed:** Home's reads run together (`Promise.all`), with the login from `getUser()` (`lib/supabase/user.js`).
- **Everything already in the redesign:**
  - phone rules: 44px targets, a bottom tab bar, safe areas
  - reduced motion
  - WCAG AA contrast
  - Next.js 16: read `node_modules/next/dist/docs/` before writing code (AGENTS.md)
- **Tips:** every changed page keeps its tips (`lib/guides.js` "home" guide, updated for the new parts).
- **Trades:** words come from the trade template (`words`): e.g. "sessions" for tutors and tattoo, "clients" vs "students".

## Approaches considered

- **A — "Your week" fill meter + money curve + Fill your book moves.** *Chosen by the owner.* Hits both goals at first glance, turns them into action, and uses only existing data.
- **B — Monthly money goal ring first.** Very motivating, but needs a new goal setting (a new column) and stays empty until the pro sets a goal. Deferred.
- **C — Daily game plan (3 moves, streaks).** The strongest habit loop, but the most "app-like", and needs enough data every day to always offer 3 good moves. Not chosen.

## The design (approach A)

### Layout, top to bottom

1. **Header** (kept): greeting and date, Pro ID, View booking page, gold "Share booking link" with the plane.
2. **Hero row, two frosted cards** (8 + 4 columns on desktop, stacked on phones):
   - **This week** (8 cols): the fill meter.
   - **This month** (4 cols): the money curve.
3. **Fill your book**: 1–3 move cards in a row (one column on phones).
4. **Up next** and **Needs attention**, as today.
5. **More** and **Admin** folds, as today.

The old five-tile stats row is removed. Where its figures go *(my call)*:
- today's appointment count joins the greeting line ("3 appointments today")
- week revenue is covered by the hero
- deposits move under the month total
- new clients this month and the waitlist count go in the More fold as two plain lines

```
 Good morning, Tasha                         [Share booking link ✈]
 ┌─────────────── This week ───────────────┐ ┌──── November ─────┐
 │  72% booked                              │ │ $2,483    ↑ 18%   │
 │  ▇▇▇  ▇▇▇  ▇▇▅  ▇▂░  ▇▇░  ░░░  ·        │ │       ╱‾‾ this mo │
 │  Mon  Tue  Wed  Thu  Fri  Sat  Sun       │ │   ╱‥‥‥ last month │
 │  14 booked · 5 open times left           │ │ ahead of October  │
 └──────────────────────────────────────────┘ └───────────────────┘
 Fill your book
 ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
 │ Maya is 3 weeks  │ │ $150 owed by     │ │ Next week has no │
 │ overdue          │ │ Jordan           │ │ open times yet   │
 │ [Invite back]    │ │ [Send reminder]  │ │ [Add opening]    │
 └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### This week (fill meter)

- **Week:** Monday to Sunday containing today, in the pro's time zone, the same as Today's `weekRange`.
- **Fill %:**
  - booked minutes = confirmed bookings this week, end minus start
  - offered minutes = this week's openings, end minus start
  - fill = booked ÷ max(offered, booked), capped at 100%
  - Pending-deposit holds don't count. Openings and bookings may overlap; offered is the openings' total.
- **Bars:** one per day. Height = that day's booked ÷ that day's offered.
  - Days with no openings show a short dotted stub.
  - Past days are dimmed.
  - Today is outlined in gold.
- **Interaction:**
  - Hover or focus (desktop) or tap (phone) shows a tooltip: "Thu · 3 booked · 2 open times".
  - Tapping a day opens that day in Calendar. If Calendar can't open a given date, link to Calendar and leave it to the builder.
- **Line under the bars:** "14 booked · 5 open times left". "Open times left" means remaining bookable start times. If that's costly to compute, use open hours left ("6 hours open") and note the choice.
- **Wins:**
  - At 100% the card says "Fully booked this week" with a one-time gold shimmer.
  - At 0 offered, the card says "No open times this week" and the bars show their dotted stubs; Fill your book then leads with Add opening.

### This month (money curve)

- **Total:** this month's earnings to date, computed with `earnings()` exactly as Money does, so the numbers match Money's month view.
- **Curve:** running total by day for this month, drawn over last month's running total (dotted).
- **Change chip:** "↑ 18%" or "↓ 6%" compared with last month **up to the same day of the month**.
  - *(My call.)* Both months use `earnings()`: the figure printed beside the chip, and the same one Money shows. Only the "same days" date rule comes from Insights. Insights' % counts service revenue alone, so it can differ. The card is labelled "Earned", never "Revenue", so the two never claim to be the same number. "Last month's full total" for the win line is also `earnings()`.
  - Gold when ahead, plain ink when behind. No red or alarm.
  - Hidden when last month has no data.
- **Under the total:** "$X paid online as deposits" (Money's deposits figure), so deposits stay on Home after the stats row goes. *(My call.)*
- **Interaction:** hovering or tapping a point shows "Nov 12 · $1,240 so far (Oct 12: $1,050)". Tapping the card opens Money.
- **Win:** when this month passes last month's full total, show "Best month since …" once, if the data supports it. Otherwise "Ahead of October".

### Fill your book (moves)

Up to **3** move cards, picked from the candidates below in priority order. A candidate shows only when real data supports it.

1. **Balance owed** (money in): the largest balance owed, using Money's rules (`owedOn`).
   - Text: "$150 owed by Jordan for Knotless braids".
   - Button: **Send reminder** (`remindBalance`). Shown only if the client has an email; otherwise **Open Money**.
2. **Overdue regular** (refill the book): the top overdue client from the Insights logic who has an email and wasn't invited back in the last 30 days.
   - Text: "Maya usually comes every 4 weeks. It's been 7".
   - Button: **Invite back** (`inviteBack`).
   - When there's more than one overdue client, a link reads "+3 more in Insights".
3. **Thin week ahead:** the next 7 days have fewer than N open times (builder picks N, e.g. 3) or none.
   - Text: "Next week has no open times yet".
   - Button: **Add opening** (opens the slide-over).
4. **Open times not filling:** this week still has open times.
   - Text: "5 open times left this week. Share your link".
   - Button: **Share booking link** (`ShareCta`).
   - Always available as the fallback.

Button behaviour:
- Each button shows its result inline ("Sent ✓", or the action's own error message).
- The card fades into a "done" state for this visit without reloading the page.
- Demo accounts get the existing demo-locked message.

### Feel: luxury, interactive, unique

- **Frosted cards** as elsewhere. The hero cards get a slightly richer treatment: a soft gold inner edge and a large serif figure (72%, $2,483).
- **Entrance:**
  - Bars grow from zero in sequence (Mon → Sun).
  - The curve draws left to right.
  - The figures count up, about 0.8s in total.
  - Plays **once per day per browser** (remembered in `localStorage`, with try/catch). Later visits that day show the end state at once.
  - With reduced motion: no motion at all.
- **Hover:** subtle lift on cards; tooltips on bars and curve points.
- **Phone:** tap for tooltips. The hero cards stack; the bars stay readable (7 bars, at least 32px wide). Nothing scrolls sideways.
- **Unique touch:** the week meter reads like a page of an appointment book. A thin gold hairline marks "now" on today's bar. The figure is in the Cormorant serif. It's not a generic chart-library look: hand-drawn SVG and CSS, no chart library.

### New pros and examples

*(My call.)* Decided **per card**, only when examples are on (`examplesOn`). A card never mixes example and real numbers.
- **This week:** example bars only when the week has **no real openings and no real bookings**. Real openings with no bookings show the real 0% (that's useful: "nothing booked yet, share your link").
- **This month:** example curve only when there are **no earnings this month or last month**.
- **Fill your book:** when the pro has **no services or no openings ahead**, the moves become setup steps:
  - "Add your services" → Services
  - "Open some times" → Add opening
  - "Share your link"
  Otherwise, real moves.
- Each example card carries the Example tag, as Home does today.
- The existing setup checklist ("Get set up") stays, above the hero, until it's complete.

### Tips

Update the "home" guide in `lib/guides.js` with three steps: This week, This month, Fill your book.

## Left to the builder

- Exact SQL/query shapes, as long as all reads run in one parallel batch and match Money/Insights rules.
- The "open times left" definition (bookable start times vs open hours), stated in a code comment.
- The thin-week threshold N.
- Exact animation timings and easing (within ~0.8s total).
- Component and file structure (e.g. `dashboard/home/WeekMeter.js`, `MoneyCurve.js`, `FillMoves.js` as client components, fed by the Home server page).
- Calendar deep link to a specific day, if one already exists.

## Verification

- **Matching numbers:** Home's month total equals Money → Month for the same account, and the fill numbers match Today and Calendar for the week. Checked on the test accounts and on the demo with the screenshot seed (`scripts/homepage-demo-seed.sql`, removed after).
- **Every move button**, on a test account. Then restore anything changed: invite-back time, reminder time.
- **Lighthouse on phone:** Home stays at 95 or above.
- **Server time:** within ~0.05s of today's time.
- **Screenshots** at desktop, tablet and phone, with reduced motion on and off.
