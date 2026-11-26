# Landing page: a live, playable Home in the hero — design

Date: 2026-11-26 · Status: draft for owner approval · Part 2 of 2. Part 1 is Home "Fill your book": `docs/superpowers/specs/2026-11-26-home-fill-your-book-design.md`, now live.

## Intent and the why

The owner asked for the whole experience to feel **luxury, interactive, unique and eye-catching**, so stylists stay. Part 1 made Home show **a book filling up and money growing**, with one-tap moves to make both happen. This part brings that same promise to clientelesuite.com, so a visiting stylist understands Clientele in five seconds and starts a free trial.

The owner chose approach A: a **live, playable Home in the hero**. The visitor taps a move and watches the result: the week's bars fill to "Fully booked", or the money line rises.

## Goals

- The hero's picture becomes the real Home components (week meter, money curve, moves) running on a **sample studio**, playable without logging in.
- The core promise lands in under 5 seconds:
  - tap → the book fills / the money grows
  - then "Start free trial"
- It looks and feels like the app: the same cards, gold bars, serif figures and motion.
- Works and feels great on a phone, with 44px tap targets and no sideways scroll.

## Non-goals

- No changes below the hero, except:
  - removing the outdated `dash-home` screenshot
  - adding one line under the hero inviting people to try it
- No real data, no login, no emails, no saved state.
- No change to the logged-in Home.

## Anti-goals (failure even if it works)

- **A slower landing page.** Lighthouse phone must stay **≥ 95** (it's 95 now) and accessibility 100. No new libraries.
- **Anything that looks like real customer data** or a real business. The sample studio is clearly a sample, tagged "Sample studio".
- **A demo that dead-ends:**
  - buttons that do nothing
  - navigation to app pages a visitor can't open
  - a finished state with no way to replay
- **Motion that ignores reduced-motion settings** or blocks taps.

## Constraints

- Reuse `WeekMeter` and `MoneyCurve` from `app/(studio)/dashboard/home/`. They need small, backwards-compatible options:
  - turn off calendar navigation
  - turn off the Money link
  - allow a "Sample" tag instead of "Example"
- The logged-in Home must behave exactly as it does now.
- The `.hf-*` styles move out of the dashboard-only stylesheet into a file both places load (e.g. `app/(studio)/dashboard/home/homeFill.css`), with variable fallbacks so they work outside `.db`. The dashboard's look stays the same.
- A new demo-only moves component (no server actions) lives with the landing page.
- **The sample studio follows the visitor's trade** (owner's decision).
  - There are four samples, built from each trade's template (`lib/templates`): its words (clients/students, appointments/sessions) and its preset services and prices, as the landing page's trade switcher already uses them.
  - Hair stylist is the default.
  - Examples always match the trade: silk press only for stylists (a standing owner rule).
- Next.js 16: read `node_modules/next/dist/docs/` before Next-specific code.

## Approaches (chosen: A)

- **A — Live, playable Home in the hero.** *Chosen.* Unique, interactive, and sells the exact promise. The most work, kept light by reusing the existing components (no new libraries).
- **B — A scroll story** that fills the week and draws the line as you scroll. Elegant but passive: nothing to touch.
- **C — Refresh only:** new screenshots of the new Home plus a little motion. Quick, but not much more eye-catching than today.

## The design

### Hero layout

- **Desktop:** the copy (headline, "Your regulars come first", plane "Start free trial", "Try the live demo") stays on the left. On the right, a frosted window holds the live Home:
  - This week (fill meter)
  - This month (money curve)
  - 3 demo moves
- **Phone:** the copy, then the live Home stacked, then a small hint.

```
 Run your whole business            ┌ clientelesuite.com/dashboard ─────────┐
 from one place.                    │ THIS WEEK            NOVEMBER          │
 Your regulars come first.          │ 64% booked           $2,140  ↑ 12%     │
                                    │ ▇▇ ▇▇ ▆▆ ▃▃ ▅▅ ░░ ·   ╱‾‾ ‥‥            │
 [✈ Start free trial] [Try the      │ Fill your book                         │
                      live demo]    │ [Share your link] [Send reminder] [Invite back] │
                                    └ Sample studio · tap a move ───────────┘
```

### The sample studio (starting state)

*(My call.)* The sample is a **fixed fixture, not tied to the visitor's real date**. "Today" is always **Wednesday the 18th** of the current month name. That way:
- it renders identically on the server and in the browser (no shift)
- it never shows a past day being filled or "$2,140 on the 1st"

The fixture:
- **This week:** about 64% booked.
  - Mon–Tue: past, mostly booked.
  - Wed: today.
  - Thu: mostly full.
  - Fri: half full.
  - Sat: a little.
  - Sun: closed.
- **This month:** about $2,140 earned by the 18th, ~12% ahead of last month's dotted line.
- **Moves:**
  1. "$85 owed by Maya for a silk press" → **Send reminder**
  2. "Tasha usually comes every 4 weeks. It's been 6." → **Invite back**
  3. "6 hours still open this week." → **Share your link**

### What each tap does (all local, nothing sent)

- **Send reminder:**
  - The card shows "✓ Reminder sent (sample)".
  - About a second later, "Maya paid $85": the month total counts up by $85, the line extends, and the chip updates.
- **Invite back:**
  - "✓ Invited (sample)".
  - Tasha books Friday: Friday's bar grows, the week % counts up, and the money rises by the service price.
- **Share your link:**
  - "✓ Link shared (sample)".
  - The open slots fill one by one (~1.5s total) until the meter reads **"Fully booked this week"** with the one-time gold shimmer, and the money rises.
- **Order:** *(my call)* the moves work in any order, and each card stays with its "✓ … (sample)" note.
  - Share your link fills all remaining open time from Wednesday on.
  - Invite back books Tasha into the first open slot. If the week is already full, the card says "Tasha booked next week", and only the money rises.
  - Fully booked and the final line are reached whatever the order, as long as Share your link has been tapped.
- **After all three:** a small "Play again" link resets the sample.
- **Throughout:** "Start free trial" stays visible next to the demo. After the last tap, a line appears: "That's your week in Clientele. Start free trial →".

### Motion

- Bars glide to their new height (CSS transition, ~0.6s) and numbers count up (existing `useCountUp`).
- With reduced motion, changes happen instantly with no shimmer.
- The page-load entrance plays on every visit to the landing page, not once per day. Visitors are new, and the demo is the show.

### Interaction details

- **Week bars:** hover or tap shows that day's numbers, as in the app. The second tap does nothing (no navigation).
- **Money card:** no "Money →" link; the "Sample studio" tag sits there instead.
- **Accessibility:** a status line announces each result (e.g. "Tasha booked Friday. 72% booked").

### Trade *(owner's decision; the sync mechanism is my call)*

- The demo shows a small trade selector in its footer: "Sample: Hair stylist · Barber · Tattoo · Tutor". Picking one switches the sample studio instantly, resetting the moves.
- The selector stays in sync with the "Made for your trade" switcher below, in both directions:
  - picking a trade in either place updates the other
  - via a small shared client signal (a window event or a context in the page), no reload
- Each trade's sample uses its own names, services and words. For example:
  - barber: "$35 owed by Marcus for a skin fade"
  - tattoo: deposits and sessions
  - tutor: "students" and "sessions"

### Links and images *(my calls)*

- Both hero screenshots go: `dash-home` and the overlaid `dash-today-phone`. The live Home replaces them on every screen size. `dash-today-phone.webp` stays in the repo, because the feature tabs use it.
- "Try the live demo" still opens the full demo dashboard (`/demo`).
- The new hint under the hero says "Tap a move to try it here". It points to the hero.

### Below the hero

- Unchanged, except the hero no longer uses `dash-home.webp`; delete it if nothing else uses it.
- The feature tabs keep their screenshots.

### Speed

- The live Home renders on the server with its starting numbers (no layout shift), then hydrates.
- It replaces the hero image, so the page downloads less.
- Lighthouse phone ≥ 95 and accessibility 100 are verified after deploy.

## Left to the builder

- Exact sample numbers and service prices (must look realistic; from the stylist template where possible).
- The file and component structure. Suggested: `app/(home)/LiveHome.js` (client) plus `app/(home)/DemoMoves.js`.
- How the shared `.hf-*` CSS file is split and imported.
- Timing details within the stated ranges.
