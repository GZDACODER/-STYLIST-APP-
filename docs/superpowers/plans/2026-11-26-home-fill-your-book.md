# Home "Fill your book" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Home (`/dashboard`) into a luxury, interactive daily screen showing how full this week is, how this month's money is growing, and one-tap moves to fill the book.

**Architecture:**
- **Pure calculation module** (`lib/homeFill.js`, relative imports only, unit-tested with `node --test`): it turns rows into the week meter, the money curve and the ranked moves.
- **Home server page:** reads everything in one `Promise.all` and hands plain props to three client components (`WeekMeter`, `MoneyCurve`, `FillMoves`). These draw hand-made SVG/CSS with a once-a-day entrance animation.
- **Reuse:** money figures come from `earnings()` and the overdue list from `insights()`, so they match Money and Insights.

**Tech Stack:** Next.js 16 App Router (server components + `"use client"` components), React 19 `useActionState`, Supabase JS, plain CSS in `app/(studio)/dashboard/shell/shell.css`, Node 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-26-home-fill-your-book-design.md`

## Global Constraints

- No new tables, columns or SQL. No changes to existing server actions or routes.
- One-tap moves may only use:
  - `inviteBack` (`app/(studio)/dashboard/reports/actions.js`; form fields `id`, `booking_id`, `service_id`)
  - `remindBalance` (`app/(studio)/dashboard/money/actions.js`; form fields `id` = booking id, `owed` = cents)
  - the Add opening slide-over (`/dashboard/openings#add-opening`)
  - `ShareCta` (`app/(studio)/dashboard/shell/ShareCta.js`)
  - plain links
- All Home reads run in ONE `Promise.all` (the login comes from `getUser()` in `lib/supabase/user.js`). No extra sequential round trips.
- Money numbers come from `earnings()` in `lib/moneyTab.js`. The card label is "Earned", never "Revenue".
- **Week** = Monday–Sunday containing today in the pro's time zone (the existing `weekRange` in `app/(studio)/dashboard/page.js`).
- **Fill %** = booked minutes ÷ max(offered minutes, booked minutes), capped at 100. Confirmed bookings only; pending-deposit holds don't count.
- **Entrance animation:**
  - about 0.8s total
  - plays once per day per browser (`localStorage` key `home-anim:<YYYY-MM-DD>`, every access wrapped in try/catch)
  - none at all under `prefers-reduced-motion: reduce`
- **Design system:**
  - frosted cards (`var(--glass)`, `var(--glass-line)`, `var(--glass-shadow)`)
  - gold `#a8874d` (text gold `#7d6232` for small text)
  - Cormorant (`var(--font-display)`) for the big figures
  - 44px tap targets, WCAG AA contrast, no sideways scroll at 390px
  - no chart library
- Trade words via `useTemplate()` (client) / `getMyTemplate()` (server): e.g. `words.client`, `words.appointments`.
- Next.js 16: read `node_modules/next/dist/docs/` before writing Next-specific code (AGENTS.md).
- Commits end with:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01WmyYrZCsBz5aStaBrMf7uT`

## Review Focus

1. **A week with openings but no bookings** (a new or quiet pro): the meter shows a real 0% with a bar outline for each day that has openings, not example data. "Share your link" leads the moves. → test in Task 1.
2. **Bookings outside any opening** (booked by the pro directly, with no opening that day): fill must not exceed 100%, and that day's bar is full rather than dividing by zero. → test in Task 1.
3. **Last month empty, this month has money:** the change chip is hidden (null), not "↑ Infinity%". **Both months empty:** the total is $0 with a flat line. → test in Task 1.
4. **The first days of a month vs a longer last month** (e.g. Mar 30 compared with Feb, which has no day 30): the same-days comparison clamps to last month's final day. → test in Task 1.
5. **A move whose client has no email:** Balance owed falls back to "Open Money", and an overdue client without an email is skipped. Never show a button that will just error. → test in Task 1.

---

## File Structure

- Create `lib/homeFill.js`: pure functions `weekFill`, `monthCurve`, `pickMoves` (relative imports only, so `node --test` can load it).
- Create `tests/homeFill.test.mjs`: unit tests (`node --test tests/`).
- Modify `package.json`: add the script `"test": "node --test tests/"`.
- Create `app/(studio)/dashboard/home/useEntrance.js`: the once-a-day animation hook (client).
- Create `app/(studio)/dashboard/home/WeekMeter.js`: the This week card (client).
- Create `app/(studio)/dashboard/home/MoneyCurve.js`: the This month card (client).
- Create `app/(studio)/dashboard/home/FillMoves.js`: the Fill your book cards (client).
- Modify `app/(studio)/dashboard/page.js`:
  - add the reads to the existing `Promise.all`
  - compute through `lib/homeFill.js`
  - render the hero and the moves
  - remove the stats row
  - move today's count, deposits, new clients and waitlist to their new places
- Modify `app/(studio)/dashboard/shell/shell.css`: an `.hf-*` styles section.
- Modify `lib/guides.js`: the `home` guide gets steps for This week, This month and Fill your book.
- Modify `docs/BUILD_LOG.md`: one row.

---

### Task 1: Pure calculations (`lib/homeFill.js`)

**Files:**
- Create: `lib/homeFill.js`, `tests/homeFill.test.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces:
  - `weekFill({ week: {start, end}, today: "YYYY-MM-DD", nowTime: "HH:MM", openings: [{opening_date, start_time, end_time}], bookings: [{booking_date, start_time, end_time, status}] })` returns:
    ```
    { pct: number /* 0–100 integer */,
      bookedCount: number,
      bookedMin: number,
      offeredMin: number,
      openMinLeft: number /* offered minus booked, from now on, never negative */,
      days: [{ date, label /* "Mon" */, bookedMin, offeredMin, bookedCount,
               pct /* 0–100 */, past: bool, isToday: bool, hasOpenings: bool }] /* exactly 7, Mon→Sun */ }
    ```
  - `monthCurve({ thisDays: [{ day: 1.., cents }], lastDays: [{ day, cents }], todayDay: number })` returns:
    ```
    { total, points: [{ day, cum }] /* day 1..todayDay */,
      lastPoints: [{ day, cum }] /* full last month */,
      lastSameDays /* cum of last month at min(todayDay, lastLen) */,
      lastTotal,
      changePct /* integer, or null when lastSameDays === 0 */,
      ahead /* bool */, passedLastMonth /* total > lastTotal && lastTotal > 0 */ }
    ```
  - `pickMoves({ owed: [{ bookingId, clientName, serviceName, owedCents, hasEmail }], overdue: [{ clientId, bookingId, serviceId, name, usualWeeks, sinceWeeks, hasEmail, invitedRecently }], nextWeekOpenTimes: number, thisWeekOpenMinLeft: number, hasServices: bool, hasOpeningsAhead: bool, thinThreshold = 3 })` returns at most 3 of `{ kind: "owed" | "overdue" | "thin" | "share" | "setup-services" | "setup-openings", ... }`:
    - `owed`: `bookingId, owedCents, clientName, serviceName, canEmail`
    - `overdue`: `clientId, bookingId, serviceId, name, usualWeeks, sinceWeeks, more` (the count of other eligible overdue clients)
    - `thin`: `nextWeekOpenTimes`
    - `share`: `thisWeekOpenMinLeft`

- [ ] **Step 1: Write the failing tests** in `tests/homeFill.test.mjs` (`import { test } from "node:test"; import assert from "node:assert/strict"; import { weekFill, monthCurve, pickMoves } from "../lib/homeFill.js";`):
  - `weekFill: basic fill` — week 2026-11-23..29, today 2026-11-26, nowTime "12:00".
    - Openings: Mon 09:00–17:00 and Thu 09:00–13:00 (offered 480 + 240 = 720).
    - Confirmed bookings: Mon 10:00–11:00, Mon 13:00–15:00, Thu 09:00–10:00 (180 min).
    - Assert `pct === 25` (180/720), `bookedCount === 3`, `days.length === 7`, `days[0].label === "Mon"`, `days[0].pct === 38` (Mon: 60 + 120 = 180 of 480 = 37.5, rounded), `days[3].isToday === true`, `days[0].past === true`, `days[5].hasOpenings === false`.
  - `weekFill: openings but no bookings` → `pct === 0`, `days[0].hasOpenings === true`, `openMinLeft > 0`.
  - `weekFill: booking with no opening that day` — Wed booking 10:00–11:00, no Wed opening → `days[2].pct === 100`, overall `pct <= 100`.
  - `weekFill: pending_payment ignored` — a `status: "pending_payment"` booking adds nothing to `bookedMin`.
  - `monthCurve: ahead` — `thisDays` days 1–3 = 1000, 2000, 0 cents; `lastDays` 30 days with day 1 = 1000, day 2 = 1000, day 30 = 5000; `todayDay` 3.
    - Assert `total === 3000`, `points.at(-1).cum === 3000`, `lastSameDays === 2000`, `changePct === 50`, `ahead === true`, `passedLastMonth === false` (`lastTotal` 7000).
  - `monthCurve: last month empty` → `changePct === null`.
  - `monthCurve: both empty` → `total === 0`, `points.every(p => p.cum === 0)`.
  - `monthCurve: clamps to a shorter last month` — `todayDay` 30, `lastDays` length 28 → `lastSameDays === lastTotal`.
  - `pickMoves: priority and cap` — owed (`hasEmail`), two eligible overdue, `nextWeekOpenTimes` 0, open minutes left 300.
    - Assert `kinds` is `["owed", "overdue", "thin"]` and `moves[1].more === 1`.
  - `pickMoves: owed without email` → `canEmail === false`. An overdue client with `hasEmail: false` or `invitedRecently: true` is skipped.
  - `pickMoves: setup` — `hasServices: false` → the first move is `setup-services`, and there are no owed or overdue moves.
  - `pickMoves: share fallback` — nothing else applies → exactly one move of kind `share`.

  Use `Math.round` for every percentage.

- [ ] **Step 2: Run the tests and confirm they fail**
  - Run: `node --test tests/`
  - Expected: FAIL with "Cannot find module" or "does not provide an export named weekFill".

- [ ] **Step 3: Implement the three functions** in `lib/homeFill.js`.
  - Minutes come from `"HH:MM(:SS)"` strings.
  - Day labels are Mon–Sun by index from `week.start`, using date maths in UTC from `YYYY-MM-DD` (no locale).
  - `openMinLeft`: future days count in full; today counts only offered minutes after `nowTime`, minus today's bookings after `nowTime`; never below 0.
  - `pickMoves`:
    - Setup kinds replace owed and overdue when `!hasServices` (`setup-services`) or `!hasOpeningsAhead` (`setup-openings`).
    - `thin` when `nextWeekOpenTimes < thinThreshold`.
    - `share` only fills spare slots and is the fallback, so there is always at least one move.
  - Add `"test": "node --test tests/"` to `package.json` scripts.

- [ ] **Step 4: Run the tests and confirm they pass**
  - Run: `npm test`
  - Expected: all tests pass, 0 failed.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/homeFill.js tests/homeFill.test.mjs package.json
  git commit -m "Home: week fill, month curve and move picking (tested)"
  ```

---

### Task 2: Home server data

**Files:**
- Modify: `app/(studio)/dashboard/page.js` (the `Promise.all` near the top of `HomePage`, and the computations after it)

**Interfaces:**
- Consumes: `weekFill`, `monthCurve`, `pickMoves` (Task 1); `moneyPeriod`, `earnings`, `owedOn` from `@/lib/moneyTab`; `insights` from `@/lib/insights`.
- Produces: three plain objects that Task 4 renders.
  - `week` = the `weekFill` result plus `examples: bool`
  - `month` = the `monthCurve` result plus `{ label /* "November" */, lastLabel /* "October" */, depositsCents, examples: bool }`
  - `moves` = the `pickMoves` result

- [ ] **Step 1: Add these reads to the existing `Promise.all`** (no new awaits outside it):
  - openings from `week.start` to `week.end + 7 days` (`opening_date, start_time, end_time`)
  - confirmed and pending bookings this week (`booking_date, start_time, end_time, status`)
  - bookings and payments for last month's first day through today, with the columns `earnings()` needs (copy `BOOKING_COLS` from `lib/moneyData.js`)
  - owed bookings (`status=confirmed, outcome=completed_owed`) plus balance payments (`payments kind=balance`)
  - the last 365 days of bookings and clients (`id, name, email, invited_back_at`) for `insights()`, mirroring the read in `app/(studio)/dashboard/reports/page.js`
  - **Remove** the reads that only fed the stats row tiles, except the four figures that move (today's count, deposits, new clients, waitlist).

- [ ] **Step 2: Compute the three objects** after the `Promise.all`.
  - **Money:** `earnings()` over `moneyPeriod("month", today)` and `moneyPeriod("month", lastMonthAnchor)`. Map each `series` to `{ day, cents }`, then call `monthCurve`. `depositsCents` = `earnings(this month).depositsCents`.
  - **Overdue:** `insights({...}).overdue` mapped to `pickMoves` input. `usualWeeks` = `Math.round(usual / 7)`; `sinceWeeks` = `Math.round(since / 7)`. `hasEmail` and `invitedRecently` (30 days) come from clients.
  - **Examples, per card (spec "New pros and examples"):**
    - the week uses `exampleData` only when there are no real openings and no real bookings this week
    - the month uses examples only when both months' totals are 0
  - Do not render anything new yet.

- [ ] **Step 3: Verify the build and the server time**
  - Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npx next build`
  - Expected: "Compiled successfully" with no errors.

- [ ] **Step 4: Commit**
  ```bash
  git add "app/(studio)/dashboard/page.js"
  git commit -m "Home: read week, month and move data in the one batch"
  ```

---

### Task 3: Client components and styles

**Files:**
- Create:
  - `app/(studio)/dashboard/home/useEntrance.js`
  - `app/(studio)/dashboard/home/WeekMeter.js`
  - `app/(studio)/dashboard/home/MoneyCurve.js`
  - `app/(studio)/dashboard/home/FillMoves.js`
- Modify: `app/(studio)/dashboard/shell/shell.css` (append an `.hf-*` section)

**Interfaces:**
- Consumes: the Task 2 objects; `inviteBack`, `remindBalance`, `ShareCta`.
- Produces:
  - `useEntrance(dateKey: string) → "play" | "static"`. Returns `"static"` under reduced motion or when `localStorage["home-anim:"+dateKey]` is set, then sets it.
  - `<WeekMeter week calendarHref words />`
  - `<MoneyCurve month moneyHref="/dashboard/money" />`
  - `<FillMoves moves bookingUrl businessName words />`

- [ ] **Step 1: `WeekMeter`**
  - The big serif `pct%` with the label "booked", and seven bars.
    - Bar height = `day.pct`.
    - A dotted stub when `!hasOpenings`.
    - `past` days at 0.45 opacity.
    - Today gets a gold outline and a 1px gold "now" hairline.
  - The line under the bars: `"{bookedCount} booked · {openHoursLeft} hours open"`. Use hours (open minutes left ÷ 60, rounded to 0.5): the spec allows hours, so note that in a code comment.
  - Each bar is a `<button>` with `aria-label="Thu, 3 booked, 2 hours open"`.
    - Hover or focus shows a tooltip.
    - Tap shows the tooltip; a second tap goes to `calendarHref` (`/dashboard/bookings`).
  - At `pct === 100`: the text "Fully booked this week" and a `.hf-shimmer` class that plays once.
  - At `offeredMin === 0`: "No open times this week".
  - When `week.examples` is true, an `<ExampleTag />`.

- [ ] **Step 2: `MoneyCurve`**
  - The serif total (`"$2,483"`) with the label "Earned in {label}".
  - The chip `↑ {changePct}%` (gold) or `↓ {abs}%` (ink), hidden when `changePct === null`.
  - The deposits line, when `depositsCents > 0`: "${x} paid online as deposits".
  - An SVG of 320×120 viewBox:
    - this month as a solid gold path (`#a8874d`, 2px)
    - last month as a dotted ink path at 35% opacity
  - Points are focusable. The tooltip reads "Nov 12 · $1,240 so far ({lastLabel} 12: $1,050)".
  - The win line: if `passedLastMonth` → "Best month yet vs {lastLabel}"; else if `ahead` → "Ahead of {lastLabel}".
  - The whole card links to `moneyHref`.

- [ ] **Step 3: `FillMoves`** — one card per move. Copy (exact; use the trade's words):
  - `owed`: "{money(owedCents)} owed by {clientName}" / "for {serviceName}".
    - Button: "Send reminder", a form posting `id=bookingId` and `owed=owedCents` to `remindBalance` via `useActionState`.
    - When `!canEmail`: the link "Open Money" → `/dashboard/money?tab=owed`.
  - `overdue`: "{name} usually comes every {usualWeeks} weeks. It's been {sinceWeeks}."
    - Button: "Invite back", posting `id`, `booking_id`, `service_id` to `inviteBack`.
    - When `more > 0`, the link "+{more} more in Insights" → `/dashboard/reports?tab=clients`.
  - `thin`: "Next week has {n === 0 ? "no open times yet" : `only ${n} open times`}". Button: "Add opening" → `/dashboard/openings#add-opening`.
  - `share`: "{hours} hours still open this week. Share your link." Button: `<ShareCta url businessName />`.
  - `setup-services`: "Add your {words.services} so clients can book." Link button → `/dashboard/services`.
  - `setup-openings`: "Open some times so clients can book." Link button → `/dashboard/openings#add-opening`.
  - **Result:**
    - the action's `success` text shows with ✓, and the card gets `.is-done` (opacity 0.6)
    - the action's `error` text shows inline in `.message.error`

- [ ] **Step 4: Styles** in `shell.css`:
  - `.hf-hero` grid: 8/4 columns at ≥900px, one column below.
  - `.hf-card` frosted with an inset gold edge: `box-shadow: var(--glass-shadow), inset 0 0 0 1px rgba(168,135,77,.25)`.
  - `.hf-figure`: Cormorant, `clamp(2.6rem, 6vw, 3.6rem)`.
  - `.hf-bars`: seven equal columns with a minimum of 32px each; height 120px.
  - `.hf-moves`: three equal columns at ≥900px.
  - **Entrance** (only when the root has `.is-play`):
    - bars `transform: scaleY(0) → 1` with `transform-origin: bottom`, staggered 60ms
    - the curve's `stroke-dashoffset` animates to 0
    - figures count up in JS via `requestAnimationFrame` over 700ms
  - Everything inside `@media (prefers-reduced-motion: no-preference)`.

- [ ] **Step 5: Verify the build**
  - Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npx next build`
  - Expected: compiles with no errors.

- [ ] **Step 6: Commit**
  ```bash
  git add "app/(studio)/dashboard/home" "app/(studio)/dashboard/shell/shell.css"
  git commit -m "Home: week meter, money curve and Fill your book components"
  ```

---

### Task 4: Wire it into Home, remove the stats row, update the tips

**Files:**
- Modify: `app/(studio)/dashboard/page.js` (the JSX return), `lib/guides.js` (`home` guide)

**Interfaces:**
- Consumes: the Task 2 objects; the Task 3 components.

- [ ] **Step 1: Render, in order:**
  1. `PageHeader`, with the subtitle prefixed by `"{n} {n === 1 ? words.appointment : words.appointments} today · "`
  2. the setup card (unchanged)
  3. `<section className="hf-hero">` containing `WeekMeter` (8 cols) and `MoneyCurve` (4 cols)
  4. `<section className="hf-moves-wrap">` with the heading "Fill your book" and `FillMoves`
  5. the existing Up next / Needs attention `g12`
  6. More and Admin
  - **Delete** the `stat-row` section.
  - Add two lines to the More fold: "New {words.clients} this month: {n}" and "Waiting on your waitlist: {n}", the latter linking to `/dashboard/openings?tab=waitlist`.

- [ ] **Step 2: Update the `home` guide** in `lib/guides.js` with these steps (targets in brackets):
  - [`.hf-week`] "This week": "How full your week is. Tap a day to see it in your calendar."
  - [`.hf-month`] "This month": "What you've earned so far, against last month by the same day."
  - [`.hf-moves-wrap`] "Fill your book": "One-tap moves to fill open times and bring money in."

- [ ] **Step 3: Check locally**
  - Run a build with fake env and `next start`. Load `/` (public) to confirm nothing else broke: `curl -s -o /dev/null -w "%{http_code}" localhost:3456/`.
  - Expected: 200.
  - Logged-in checks happen live in Task 5: this container can't reach Supabase directly.

- [ ] **Step 4: Commit**
  ```bash
  git add "app/(studio)/dashboard/page.js" lib/guides.js
  git commit -m "Home: hero, Fill your book, stats row folded away, tips"
  ```

---

### Task 5: Ship and verify live

**Files:**
- Modify: `docs/BUILD_LOG.md` (one row)

- [ ] **Step 1: Run `npm test` and the full build again.** Expected: pass, then compile.
- [ ] **Step 2: Open the PR and merge**
  - PR from `claude/laughing-edison-eyrf12` to `main`. The body ends with the attribution lines.
  - Wait for Vercel status `success`, then merge.
  - Wait for production (poll `https://www.clientelesuite.com/dashboard` for the `hf-hero` class with the test cookie), plus 45s.
  - Then `git pull origin main && git push`.
- [ ] **Step 3: Live checks with Playwright** on the Ink (`+tattoo`) and Bright Minds (`+tutor`) test accounts, at desktop 1280, tablet 820 and an iPhone 13:
  - The hero is visible without scrolling on the phone.
  - Seven bars.
  - Home's month total equals Money's month "Earned" tile.
  - Tapping a bar shows its tooltip.
  - Every move button works:
    - Invite back → "Sent"/success
    - Send reminder → success or the action's own error
    - Add opening opens the slide-over
    - Share copies the link
  - No sideways scroll.
  - No JS errors.
  - With `reducedMotion: "reduce"`, no animation classes run.
  - On a second load the same day, the end state shows immediately.
- [ ] **Step 4: Restore test data** changed by the move checks via `scripts/sb-sql.sh`: reset `clients.invited_back_at` and `bookings.balance_reminded_at` to their previous values (read them first).
- [ ] **Step 5: Measure**
  - `full.sh after` (scratchpad): Home within 0.05s of the 0.17s baseline.
  - Lighthouse phone (logged in) on `/dashboard`: 95 or higher.
- [ ] **Step 6: Add a BUILD_LOG row** with the results, then commit and push in a follow-up PR (or together with any fixes).
