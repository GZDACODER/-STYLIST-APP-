# Landing Live Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's hero screenshots with a live, playable Home (week meter, money curve, three demo moves) for a sample studio that follows the visitor's trade.

**Architecture:**
- **Pure demo model** (`lib/landingDemo.js`, relative imports only, unit-tested): builds a fixed sample studio for a trade and applies moves. It reuses `weekFill`/`monthCurve` from `lib/homeFill.js` for the numbers.
- **Client component** `LiveHome`: holds that state and renders the existing `WeekMeter` and `MoneyCurve` (given small, backwards-compatible options) plus a demo-only `DemoMoves`.
- **Trade sync:** the hero's trade selector and the page's TradeSwitcher stay in sync through a window event.

**Tech Stack:** Next.js 16 App Router, React 19 client components, plain CSS, Node 22 test runner (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-26-landing-live-home-design.md`

## Global Constraints

- Lighthouse phone on `/` ≥ 95 performance, accessibility 100. No new dependencies.
- The logged-in Home behaves and looks exactly as now: new component options default to today's behaviour.
- Nothing is sent or saved: the demo is local state only. Every result says "(sample)". The studio is tagged "Sample studio".
- The sample is a fixed fixture: week Mon 2026-11-16 … Sun 2026-11-22, today **Wed 2026-11-18**, `nowTime` "12:00".
  - The month label comes from the server as a prop, so the server and the browser render the same thing.
- Examples match the trade: services come only from that trade's template presets (paid ones). Silk press never appears outside hair stylist.
- Trades: `stylist` (template `hair`, the default), `barber`, `tattoo`, `tutor`. Words come from each template (`client`, `clients`, `appointment`, `appointments`).
- Reduced motion: state changes are instant, with no shimmer and no fill sequence.
- 44px tap targets, no sideways scroll at 390px, `aria-live` status for each result.
- Next.js 16: read `node_modules/next/dist/docs/` before Next-specific code (AGENTS.md).
- Commits end with:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01WmyYrZCsBz5aStaBrMf7uT`

## Review Focus

1. **Moves in any order:** after Share your link, the week is 100%. Invite back after the week is full books "next week" (money only, week unchanged). → tests in Task 1.
2. **Double tap:** a second `applyMove` of the same kind changes nothing. → test in Task 1.
3. **Switching trade mid-demo:** it resets every move and shows only that trade's services and names. No "Silk" outside the stylist sample. → test in Task 1.
4. **Play again:** it returns exactly the starting numbers (same `pct`, same total). → test in Task 1.
5. **A trade whose cheapest preset is free** (consultations at $0): sample bookings and owed amounts use paid services only, so no "$0 owed". → test in Task 1.

---

## File Structure

- Create `lib/landingDemo.js`: `sampleStudio`, `applyMove`, `demoView`, `DEMO_NAMES`.
- Create `tests/landingDemo.test.mjs`.
- Create `app/(studio)/dashboard/home/homeFill.css`: the `.hf-*` rules moved out of `shell.css`, de-scoped from `.db`, with variable fallbacks. Both `WeekMeter.js` and `MoneyCurve.js` import it.
- Modify `app/(studio)/dashboard/home/WeekMeter.js`, `MoneyCurve.js` and `useEntrance.js`: add the new options.
- Modify `app/(studio)/dashboard/shell/shell.css`: remove the moved `.hf-*` rules (the dashboard gets them from the import).
- Create `app/(home)/LiveHome.js` (client): demo state, the trade selector, and the frosted window.
- Create `app/(home)/DemoMoves.js` (client): the three demo move cards.
- Create `app/(home)/tradeSync.js`: `TRADE_EVENT = "clientele:trade"`, `announceTrade(key)`, and `useTradeSync(initialKey, onChange)`.
- Modify `app/(home)/TradeSwitcher.js`: announce on change and follow announcements.
- Modify `app/(home)/page.js`:
  - build `demoTrades` from the templates
  - the hero renders `LiveHome` and the hint line
  - remove `DeskShot` and `PhoneShot` from the hero
- Modify `app/(home)/landing.css`: hero layout for the live window; remove the hero phone/desk rules.
- Delete `public/home/dash-home.webp` (nothing else uses it).
- Modify `docs/BUILD_LOG.md`.

---

### Task 1: Demo model (`lib/landingDemo.js`)

**Files:** Create `lib/landingDemo.js`, `tests/landingDemo.test.mjs`

**Interfaces:**
- Consumes: `weekFill`, `monthCurve` from `./homeFill.js` (relative import).
- Produces:
  - `DEMO_NAMES`: `{ stylist: { owed: "Maya", overdue: "Tasha" }, barber: { owed: "Marcus", overdue: "Devon" }, tattoo: { owed: "Rosa", overdue: "Jess" }, tutor: { owed: "Sam", overdue: "Ava" } }`
  - `sampleStudio(trade: { key, words: { client, clients, appointment, appointments }, services: [{ name, priceCents, minutes }] })` returns state:
    ```
    { trade, openings: [{opening_date,start_time,end_time}], bookings: [{booking_date,start_time,end_time,status:"confirmed",service,priceCents}],
      thisDays: [{day,cents}] /* 30 */, lastDays: [{day,cents}] /* 31 */,
      owed: { name, service, cents }, overdue: { name, service, minutes, cents, usualWeeks: 4, sinceWeeks: 6 },
      done: { remind: null|string, invite: null|string, share: null|string } }
    ```
  - `applyMove(state, kind: "remind" | "invite" | "share")` returns `{ state, announce: string }`. It is pure, and a second call for the same kind returns the same state with `announce: ""`.
  - `demoView(state)` returns `{ week /* weekFill(...) + examples:false */, month /* monthCurve(...) + { depositsCents: 0, examples: false } */ }`, using the fixture week and today from Global Constraints with `todayDay` 18.

- [ ] **Step 1: Write the failing tests** in `tests/landingDemo.test.mjs`. Use a `trade(key, services)` helper. The stylist services are `[{Silk Press 8500/90}, {Trim & Style 5500/45}, {Consultation 0/30}]`; the tutor ones are `[{Math 6000/60}, {Free Assessment 0/30}]`.
  - `starting week is about 64% booked` → `demoView(s).week.pct` is between 60 and 68. `days[2].isToday === true`; `days[6].hasOpenings === false` (Sunday closed).
  - `starting month is ahead of last month` → `month.total` is between 200000 and 230000 cents, and `month.changePct` is between 8 and 16.
  - `share fills the week` → after `applyMove(s, "share")`: `week.pct === 100`, `month.total > before`, `done.share` contains "(sample)".
  - `remind adds the owed amount to this month` → `month.total === before + s.owed.cents`.
  - `invite books the first open slot` → `bookedCount` goes up by 1 and the announce text contains the overdue name and a weekday name.
  - `invite after share books next week` → `week.pct` stays 100, the money rises, and the announce text contains "next week".
  - `double tap does nothing` → `applyMove` twice with "remind": the total rises once, and the second `announce === ""`.
  - `play again is the same start` → a fresh `sampleStudio(t)` equals the original `demoView` (`pct` and `total`).
  - `tutor sample uses tutor services and words only` → no booking `service` contains "Silk"; `owed.service !== "Free Assessment"`; `owed.cents > 0`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL with "Cannot find module …/lib/landingDemo.js".
- [ ] **Step 3: Implement** with only the trade's paid services, rotated across days.
  - **Openings:** Mon–Fri 09:00–17:00, Sat 10:00–14:00, none on Sun.
  - **Bookings:** chosen so the start is 60–68%. Mon and Tue are well booked; Wed–Fri have specific free gaps; Sat is light.
  - **Money:** `thisDays` = a believable daily pattern summing to ~$2,140 by day 18 (e.g. weekday totals from paid prices); `lastDays` ≈ 12% lower to day 18.
  - **Share:** books the remaining open time (from Wed 12:00 on) with the trade's services, adding their prices to day 18.
  - **Invite:** the first free slot from Wed 12:00 on that fits `overdue.minutes`, else "next week" (money only).
  - **Remind:** adds `owed.cents` to day 18.
  - **Announce texts** (trade words):
    - "{owed.name} paid {money} (sample)."
    - "{overdue.name} booked {Weekday} at {time} (sample)." / "{overdue.name} booked next week (sample)."
    - "Your link filled the week (sample). Fully booked."
- [ ] **Step 4: Run `npm test`.** Expected: all pass (22 existing + the new ones).
- [ ] **Step 5: Commit** `lib/landingDemo.js tests/landingDemo.test.mjs` with the message "Landing: sample studio model for the live Home (tested)".

---

### Task 2: Make the Home pieces work on the landing page

**Files:**
- Create: `app/(studio)/dashboard/home/homeFill.css`
- Modify: `WeekMeter.js`, `MoneyCurve.js`, `useEntrance.js` (same folder), `app/(studio)/dashboard/shell/shell.css`

**Interfaces:**
- Produces (all additive; the defaults equal today's behaviour):
  - `<WeekMeter week today calendarHref={string | null} />`: `calendarHref={null}` → a tap only shows the tooltip, never navigates, and the tooltip text drops "Tap again to open your calendar".
  - `<WeekMeter tag={ReactNode} />` and `<MoneyCurve tag={ReactNode} />`: when given, shown in the card head instead of `ExampleTag` / the "Money →" link.
  - `<MoneyCurve moneyHref={string | null} />`: `null` → no link.
  - `useEntrance(dateKey, { everyVisit = false } = {})`: `everyVisit` → "play" on every mount unless reduced motion (no storage).
  - `useCountUp(target, play)`: when only `target` changes after mount, it counts from the previous value to the new one (not from 0).
  - `.hf-bar-fill` gets `transition: height 0.6s` (under `prefers-reduced-motion: no-preference`).

- [ ] **Step 1: Move the CSS.**
  - Cut the "Home Fill your book" `.hf-*` section from `shell.css` into `homeFill.css`.
  - Drop the `.db ` prefixes. Keep fallbacks: `var(--muted, #6b655b)`, `var(--ink, #12100d)`, `var(--glass, rgba(255,252,246,.72))`, `var(--glass-line, rgba(14,13,11,.09))`, `var(--glass-shadow, 0 10px 30px -14px rgba(14,13,11,.18))`, `var(--font-display)`.
  - `.hf-card` needs its own padding (30px) and radius (14px), because `.db .card` is absent on the landing page.
  - Import it in `WeekMeter.js` and `MoneyCurve.js` (`import "./homeFill.css";`).
- [ ] **Step 2: Add the props and hook options** listed under Interfaces.
- [ ] **Step 3: Verify the dashboard is unchanged.**
  - Run `npm test`, then the build: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npx next build`.
  - Expected: tests pass, and "Compiled successfully".
  - The visual check of the dashboard Home happens live in Task 5.
- [ ] **Step 4: Commit** with the message "Home pieces: options to run outside the app, shared styles".

---

### Task 3: `LiveHome`, `DemoMoves`, trade sync

**Files:**
- Create: `app/(home)/LiveHome.js`, `app/(home)/DemoMoves.js`, `app/(home)/tradeSync.js`
- Modify: `app/(home)/TradeSwitcher.js`

**Interfaces:**
- Consumes: Task 1 (`sampleStudio`, `applyMove`, `demoView`); Task 2 component options.
- Produces:
  - `<LiveHome trades={[{ key, label, words, services }]} monthLabel="November" lastMonthLabel="October" />`
  - `tradeSync.js`:
    - `TRADE_EVENT = "clientele:trade"`
    - `announceTrade(key)` dispatches `new CustomEvent(TRADE_EVENT, { detail: key })`
    - `useTradeSync(onChange)` subscribes, ignoring its own announcements via `detail` equality
  - `<DemoMoves state onMove={(kind) => void} words />`

- [ ] **Step 1: `LiveHome`**
  - State: the trade key (default "stylist"), plus `sampleStudio(trade)`, recomputed on trade change.
  - Renders:
    - a frosted window (reuse the `.ln-desk` frame with the bar text "clientelesuite.com/dashboard")
    - the `.hf-hero` grid containing `WeekMeter` (`calendarHref={null}`, tag "Sample studio") and `MoneyCurve` (`moneyHref={null}`, `month.label = monthLabel`)
    - `DemoMoves`
    - a footer with trade pills (`role="radiogroup"`, 44px) and "Play again" (shown once any move is done)
    - a visually-hidden `aria-live="polite"` status holding the last `announce`
  - Once all three moves are done, show "That's your week in Clientele." with `<TrialCta small />` (it reads "Start free trial").
  - On a trade change from the pills: `announceTrade(key)`. Listen with `useTradeSync`.
  - `useEntrance(…, { everyVisit: true })`, via a `today` prop of "2026-11-18".
- [ ] **Step 2: `DemoMoves`:** three cards in the Home move style (reuse the `.hf-move` classes).
  - Remind: title "{money} owed by {name}", text "for a {service}", button "Send reminder".
  - Invite: "{name} usually comes every 4 weeks. It's been 6.", button "Invite back".
  - Share: "{hours} hours still open this week.", button "Share your link".
  - After a tap, the button becomes "✓ {done text}".
  - **Share sequence:** unless reduced motion, apply the bookings one at a time about 250ms apart. Under reduced motion, apply at once. Use `setTimeout` chains cleared on unmount and on trade change. Implementation: call `applyMove(…, "share")` per step, or compute the final state and reveal the bookings progressively. The final state must equal `applyMove(start, "share")`.
- [ ] **Step 3: `TradeSwitcher`:** call `announceTrade(trades[n].key)` on click, and `useTradeSync` to `setI` when the hero changes the trade.
- [ ] **Step 4: Verify.** Run `npm test` and the build. Expected: tests pass, and it compiles.
- [ ] **Step 5: Commit** with the message "Landing: live Home demo and trade sync".

---

### Task 4: Hero wiring and styles

**Files:** Modify `app/(home)/page.js`, `app/(home)/landing.css`; delete `public/home/dash-home.webp`

- [ ] **Step 1: In `page.js`, build `demoTrades`** from the existing `TRADES` loop:
  - `services` = the template preset services with `price_cents > 0`, mapped to `{ name, priceCents: price_cents, minutes: duration_minutes }`
  - `words` = `{ client, clients, appointment, appointments }`
  - Compute `monthLabel` and `lastMonthLabel` from `new Date()` in UTC.
- [ ] **Step 2: Replace the hero visual** (`.ln-hero-visual` children) with `<LiveHome trades={demoTrades} monthLabel lastMonthLabel />`.
  - Under `.ln-cta-row`, add `<p className="ln-fine ln-try">Tap a move to try it here.</p>`.
  - Remove the `DeskShot` import if it's unused.
  - Delete `public/home/dash-home.webp` after checking: `grep -rn "dash-home\"" app lib` → no results.
- [ ] **Step 3: `landing.css`**
  - Remove `.ln-hero-desk`, `.ln-hero-phone` and their media rules.
  - `.ln-hero-visual` is full width on phones.
  - On desktop, the hero grid stays 5/7.
  - Inside the window, `.hf-hero` is one column below 1100px, and the moves are one column below 700px.
  - The window's max width is 760px.
- [ ] **Step 4: Verify locally.**
  - Build with fake env, then run `next start -p 3456`.
  - Run a Playwright check at 1440 and on an iPhone 13:
    - the hero shows `.hf-week`, `.hf-month` and 3 `.hf-move` cards
    - tapping Share fills the week to "Fully booked"
    - picking Tutor in the hero switches the services (no "Silk")
    - the TradeSwitcher below shows Tutor selected
    - no sideways scroll, no JS errors
  - Run local Lighthouse on phone: ≥ 90 locally (the live target ≥ 95 is checked in Task 5).
- [ ] **Step 5: Commit** with the message "Landing: live playable Home in the hero".

---

### Task 5: Review, ship, verify live

- [ ] **Step 1:** Run the final whole-branch review: a fresh reviewer on the most capable model, given this plan, the spec and this Review Focus. Fix Critical and Important findings test-first.
- [ ] **Step 2: Ship.**
  - PR → Vercel success → merge → production check (the `/` HTML contains `hf-week`) → wait 45s → `git pull origin main && git push`.
- [ ] **Step 3: Live checks**
  - The Task 4 Step 4 Playwright checks, against production.
  - The logged-in Home (tattoo account) is unchanged: `.hf-week` visible, bar tap navigation works, the "Money →" link is present.
  - Lighthouse on `/`: phone ≥ 95 performance and 100 accessibility; desktop 100.
- [ ] **Step 4:** Add a BUILD_LOG row with the results, then commit and push.
