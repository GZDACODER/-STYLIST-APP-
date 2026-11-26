# Launch readiness run — Nov 26

Run live on www.clientelesuite.com, on an iPhone-sized screen, with real
throwaway inboxes and Stripe test mode. Test accounts only.

## What works
| Journey | Result |
|---|---|
| Booking pages (barber, tattoo, tutor, stylist) | Services, days, times, waitlist; no errors, no sideways scroll |
| Client email code | Arrives in about 1 second; the code isn't in the subject |
| Booking (no deposit) | Booked screen + "You're booked" email with manage, reschedule, cancel, calendar links |
| Manage page (from the email, no sign-in) | Shows the visit, deposit, reschedule, cancel, calendar, message |
| Reschedule from the email | Moved on screen; "moved" email to the client and to the pro |
| Cancel from the email | Cancelled on screen; the pro is told |
| Deposit booking | Stripe checkout → booking confirmed and deposit marked paid by the webhook; email shows deposit paid and the balance |
| Unpaid deposit holds | Expire on their own after ~35 minutes and free the time |
| New pro signup | Code/link email in ~1s; the link works on another device; agreement signs; lands on Home |
| New pro setup | Add a service and save hours work |
| Connect Stripe | Opens Stripe's setup page |
| Email log (14 days) | No failed sends; no server errors logged |

## Findings
| # | Severity | What | Fix |
|---|---|---|---|
| 1 | Blocker | Stripe is in test mode on the live site | You: docs/STRIPE_GO_LIVE.md |
| 2 | High | New pros can finish the Home checklist and still have **no bookable times**: times come only from Openings, and "Open times" isn't on the checklist. Likely why a real pro signed up and stalled | Add "Open times clients can book" to the checklist; lead Home with the checklist until the page can take a booking |
| 3 | High | Pros never get the "New booking" email when a client books online (`booked_by` holds the client's id; the code reads any value as "the pro booked it") | Pro-made only when `booked_by` = the pro |
| 4 | Medium | New pro's Home: gold "Share booking link" before any service exists; "2 appointments today" counts examples; sample charts push the checklist far down | Hide share until bookable; don't count examples in the header |
| 5 | Medium | Services start empty: the pro types every service by hand while 4 trade examples are on screen | "Use these" button that adds the examples to edit |
| 6 | Medium | Deposits can be on with no cancellation policy; the cancel page then says "the policy decides" with nothing shown | Default policy text when deposits are on; show it on the cancel page |
| 7 | Medium | A client who cancels gets no email (nothing about their deposit either) | "You cancelled" email with the deposit note |
| 8 | Low | Booked / deposit-paid screens say "come back to this page" / "contact the pro" to change or cancel; the email has links now | Point to the email's manage link |
| 9 | Low | Code email says "Signing up as a stylist?" to every trade; link has `//auth` | "as a pro"; one slash |
| 10 | Low | Tips pop up over the booking page and over the code box for clients | No tips mid-booking for clients |
| 11 | Low | Free services show "$0.00" | Show "Free" |
| 12 | You | Stripe checkout says "Go stylist app"; offers bank/Klarna for short-hold deposits | In the Stripe checklist |

## Not covered here
- Paying a deposit fully in the test browser: Stripe's hCaptcha uses random
  hosts this environment can't allow; the payment itself was confirmed by the
  webhook. Checklist step 7 covers a real-card check.
- Tattoo request/approve and tutor flows were checked earlier (BUILD_LOG Nov 23–24).
