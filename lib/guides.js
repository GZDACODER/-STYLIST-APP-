// First-visit tips: a short guide the first time someone opens a page or
// reaches a step. All the words are here, so they're easy to change.
//
// Each guide: a key (saved as "seen" once it's been shown), who it's for
// ("pro" or "client"), and 2-4 steps. Each step has a title, text (under 25
// words) and an optional target: CSS selectors for the button or area to
// highlight, the first one found on screen wins. No target, or nothing found:
// the card shows in the middle of the screen instead.
//
// Pro guides start on their page (PageHeader's `guide`); client guides start
// when that part of the booking page shows. The "?" next to a page title
// replays its guide. Settings → Business → "Show tips again" resets them all.

export const GUIDES = {
  // ---------- Pros (dashboard) ----------
  home: {
    who: "pro",
    title: "Home",
    steps: [
      {
        title: "Welcome to your Home",
        text: "This is your day at a glance: what's booked, what needs you, and quick ways to add things.",
      },
      {
        target: [".home-setup"],
        title: "Finish setting up",
        text: "Work down this list. Each step opens the right page. It disappears once everything is done.",
      },
      {
        target: [".home-grid .card"],
        title: "Up next",
        text: "Your next appointments. Rows marked Example are samples, and they disappear once real bookings arrive.",
      },
      {
        target: [".home-actions"],
        title: "Quick actions",
        text: "Add an opening, an event or a client, and share your booking link, all from here.",
      },
    ],
  },

  services: {
    who: "pro",
    title: "Services",
    steps: [
      {
        title: "Your services",
        text: "These are what clients can book: a name, a price and how long it takes.",
      },
      {
        target: ["#add-service", "form"],
        title: "Add a service",
        text: "Type the name, price and minutes, then tap Add service. It shows on your booking page straight away.",
      },
      {
        target: [".db-pagehead"],
        title: "Deposits come later",
        text: "Want a deposit for a service? Connect Stripe in Settings → Deposits, then set an amount per service.",
      },
    ],
  },

  availability: {
    who: "pro",
    title: "Hours & days off",
    steps: [
      {
        title: "Your working week",
        text: "Set the hours you work each day. Clients only see times inside these hours.",
      },
      {
        target: [".hours-list", "form"],
        title: "Tick your days",
        text: "Tick the days you work, choose start and end times, then tap Save working hours.",
      },
      {
        target: [".calendar-card"],
        title: "Days off",
        text: "Block a date here for a day off or vacation. Nobody can book it.",
      },
    ],
  },

  openings: {
    who: "pro",
    title: "Openings",
    steps: [
      {
        title: "Openings are your bookable times",
        text: "Clients can only book times you open here. Open a day, or a whole stretch of days at once.",
      },
      {
        target: ["input[name=start_date]", "#add-opening"],
        title: "Open some times",
        text: "Pick a date (and an end date for several days), use your working hours or custom times, then open them.",
      },
      {
        target: ["[data-guide=visibility]", "#add-opening"],
        title: "Everyone or Regulars only",
        text: "Everyone: anyone with your link can book. Regulars only: hidden from everyone except your verified regulars.",
      },
      {
        target: [".op-toolbar", ".op-rows"],
        title: "See what's open",
        text: "Filter by who can book, browse by week, and tap a row to edit, close or switch it.",
      },
    ],
  },

  clients: {
    who: "pro",
    title: "Clients",
    steps: [
      {
        title: "Everyone who's booked you",
        text: "Clients are added automatically when they book. You can also add someone yourself.",
      },
      {
        target: [".filter-chips", ".search"],
        title: "Find your regulars",
        text: "Search by name, or filter to see just your Regulars. Regulars get first pick of your time.",
      },
      {
        target: [".client-rows"],
        title: "Open a client",
        text: "Tap a client to see their visits, notes, no-shows and balances, or to mark them a Regular.",
      },
      {
        target: ["#invite"],
        title: "Invite links",
        text: "Send a regular a personal invite link. They're verified as your Regular when they use it.",
      },
    ],
  },

  waitlist: {
    who: "pro",
    title: "Waitlist",
    steps: [
      {
        title: "Your waitlist fills cancellations",
        text: "Clients join from your booking page when no time suits them, choosing the days and times they'd like.",
      },
      {
        target: [".card"],
        title: "Who's waiting",
        text: "When a time opens, matching clients are emailed. Regulars hear first; the first to claim it gets it.",
      },
      {
        target: ["#waitlist-settings"],
        title: "Waitlist settings",
        text: "Turn the waitlist on or off and choose how long regulars get before everyone else.",
      },
    ],
  },

  calendar: {
    who: "pro",
    title: "Calendar",
    steps: [
      {
        title: "Your whole book",
        text: "Every booking by month, or as a list. Tap a day to see what's on it.",
      },
      {
        target: [".segmented", ".mc-header"],
        title: "Month or list",
        text: "Switch between the month calendar and a list of upcoming bookings. Tap any booking for its details.",
      },
      {
        target: ['a[href="/dashboard/bookings?add=event"]', ".db-pagehead-actions"],
        title: "Personal events",
        text: "Add your own events, like a school run or a class. Turn on Block bookings so clients can't book then.",
      },
      {
        target: [".mc-grid"],
        title: "Reading the calendar",
        text: "Numbers are bookings. Shaded days are off or blocked. Coloured dots are your events.",
      },
    ],
  },

  wrapup: {
    who: "pro",
    title: "Wrap up visits",
    steps: [
      {
        title: "Close out each day",
        text: "After visits, mark each one: kept, no-show, or someone else came. It takes a minute.",
      },
      {
        target: [".wrapup-visit", ".day-list"],
        title: "Mark a visit",
        text: "Choose how it went and add a balance if they still owe you. Owed balances stay flagged until paid.",
      },
      {
        title: "Daily reminder email",
        text: "You'll get a short email at the end of the day with the visits to wrap up.",
      },
    ],
  },

  notes: {
    who: "pro",
    title: "Notes",
    steps: [
      {
        title: "Your visit notes",
        text: "Formulas, preferences, anything to remember. Notes are saved on each visit and on the client.",
      },
      {
        target: [".segmented", ".card"],
        title: "By client or by day",
        text: "Browse notes by client or by day, and open one to add or edit.",
      },
    ],
  },

  deposits: {
    who: "pro",
    title: "Deposits",
    steps: [
      {
        title: "Deposits stop no-shows",
        text: "Clients pay a deposit when they book, straight into your own Stripe account.",
      },
      {
        target: [".stripe-status", ".card .button"],
        title: "Connect Stripe",
        text: "Connect Stripe once. It asks for your details and bank, and takes about ten minutes.",
      },
      {
        target: [".card"],
        title: "Amounts and your policy",
        text: "Set a dollar amount or percent per service, and write the cancellation policy clients agree to.",
      },
    ],
  },

  intake: {
    who: "pro",
    title: "Forms",
    steps: [
      {
        title: "Intake forms and waivers",
        text: "Ask new clients a few questions, or have them sign a waiver, before their first visit.",
      },
      {
        target: [".card"],
        title: "Your questions",
        text: "Add questions and waiver text, then choose which services need the form.",
      },
      {
        title: "Where you'll see answers",
        text: "Answers appear on the client and the booking. Bookings missing a form are flagged on Home.",
      },
    ],
  },

  reports: {
    who: "pro",
    title: "Reports",
    steps: [
      {
        title: "How business is going",
        text: "Revenue, visits, no-shows and deposits for any period, compared with the period before.",
      },
      {
        target: [".rp-periods"],
        title: "Pick a period",
        text: "This month, last month, this year and more. Numbers come straight from your bookings.",
      },
      {
        target: [".rp-top"],
        title: "Your top regulars",
        text: "The regulars who came most this period. They're the clients worth looking after.",
      },
    ],
  },

  plan: {
    who: "pro",
    title: "Plan & billing",
    steps: [
      {
        title: "Your plan",
        text: "Everything is included during your free trial. Pick a plan here before it ends to keep going.",
      },
      {
        target: [".card"],
        title: "Team and add-ons",
        text: "Add team members, or the Assistant add-on. Change or cancel any time.",
      },
    ],
  },

  assistant: {
    who: "pro",
    title: "Assistant",
    // Shown inside the Assistant chat (a panel), so it may start while it's open.
    allowIn: ".aw-panel",
    steps: [
      {
        title: "Ask in plain words",
        text: "Ask about your schedule or tell it what to change. It reads your real bookings and events.",
      },
      {
        target: [".aw-chips", ".aw-examples"],
        title: "Try an example",
        text: "Tap an example to send it, like “Who's booked tomorrow?” or “Block off Friday afternoon”.",
      },
      {
        target: ["#aw-text", ".aw-input"],
        title: "Nothing changes without you",
        text: "For changes, it shows exactly what it'll do. Nothing happens until you tap Confirm.",
      },
    ],
  },

  // ---------- Clients (booking pages) ----------
  book: {
    who: "client",
    title: "Booking",
    steps: [
      {
        title: "Book in a minute",
        text: "Pick a service, choose a time, then add your details. That's it.",
      },
      {
        target: [".choice-list"],
        title: "Choose a service",
        text: "Tap the service you'd like. You'll see its price, how long it takes and any deposit.",
      },
      {
        title: "Pick a day and time",
        text: "Open times appear next. Nothing suits? Join the waitlist and you'll be emailed when a time opens.",
      },
    ],
  },

  verify: {
    who: "client",
    title: "Confirm your email",
    steps: [
      {
        target: ["input[name=code]"],
        title: "Check your email",
        text: "We've emailed you a code. Type it here to confirm it's you. Check spam if it's slow.",
      },
      {
        title: "Only once",
        text: "After this, this phone remembers you, so next time you can book straight away.",
      },
    ],
  },

  waitlist_join: {
    who: "client",
    title: "Waitlist",
    steps: [
      {
        target: [".chip"],
        title: "When suits you?",
        text: "Tap the days and times of day that work. Leave them all unticked if any time works.",
      },
      {
        title: "We'll email you",
        text: "When a matching time opens, you'll get an email. The first person to claim it gets it.",
      },
    ],
  },

  deposit: {
    who: "client",
    title: "Deposit",
    steps: [
      {
        target: ["[data-guide=deposit-note]"],
        title: "A deposit holds your time",
        text: "This booking needs a deposit. The rest is paid at your appointment.",
      },
      {
        target: ["[data-guide=deposit-pay]"],
        title: "Pay securely",
        text: "You'll pay on Stripe by card, Apple Pay or Google Pay. Your time is booked once it's paid.",
      },
    ],
  },

  my_bookings: {
    who: "client",
    title: "Your appointments",
    steps: [
      {
        target: ["[data-guide=my-bookings]"],
        title: "Your appointments",
        text: "Your upcoming visits with this business are here. Reschedule or cancel them yourself.",
      },
      {
        title: "Every pro in one place",
        text: "My Pros lists all your appointments with every business you book on Clientele.",
      },
    ],
  },
};

export const GUIDE_KEYS = Object.keys(GUIDES);
export const isGuideKey = (key) => typeof key === "string" && Object.hasOwn(GUIDES, key);

// Which guide each Settings section's page starts (see SettingsShell).
export const SETTINGS_GUIDES = {
  services: "services",
  hours: "availability",
  deposits: "deposits",
  forms: "intake",
  plan: "plan",
};
