// Example data for new pros (step 37 SQL: stylists.show_examples). Drawn by
// the dashboard only: nothing here is ever saved, so examples can't reach the
// booking page, invite links, the waitlist, emails, texts, Stripe, stats,
// limits or Regular counts. Every item has `example: true` and an id starting
// "example-", and each tab shows its examples only until the pro has real
// data there. Dates are worked out from "today" in the pro's time zone.
//
// Fake contact details only: 555-01xx numbers and example.com emails.

function shift(today, days) {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
// The next date on or after `from` that falls on weekday `dow` (0 = Sunday).
function nextWeekday(from, dow) {
  const n = (dow - weekday(from) + 7) % 7;
  return shift(from, n);
}

export const EXAMPLE_PREFIX = "example-";
export const isExampleId = (id) => String(id || "").startsWith(EXAMPLE_PREFIX);

export const EXAMPLE_SERVICES = [
  {
    id: "example-service-1",
    name: "Silk Press",
    price_cents: 8500,
    duration_minutes: 90,
    deposit: "$20 deposit",
    description: "Wash, deep condition, blow-dry and silk press.",
  },
  {
    id: "example-service-2",
    name: "Trim & Style",
    price_cents: 5500,
    duration_minutes: 45,
    deposit: "No deposit",
    description: "A dusting of the ends and a finished style.",
  },
  {
    id: "example-service-3",
    name: "Color Refresh",
    price_cents: 14000,
    duration_minutes: 120,
    deposit: "25% deposit",
    description: "Root touch-up or gloss to brighten your color between full appointments.",
  },
  {
    id: "example-service-4",
    name: "New Client Consultation",
    price_cents: 0,
    duration_minutes: 30,
    deposit: "No deposit",
    description: "Talk through your hair goals before your first appointment.",
  },
].map((s) => ({ ...s, example: true }));

export function exampleData(today) {
  const nextSat = nextWeekday(shift(today, 1), 6);
  const clients = [
    {
      id: "example-client-maya",
      name: "Maya Jones",
      phone: "+15550100123",
      email: "maya@example.com",
      status: "regular",
      visits: 6,
      notes: "Prefers Tuesday mornings. Sensitive scalp: use the gentle shampoo.",
      invited_at: null,
      intake: {
        answers: [
          ["Any allergies or sensitivities?", "Sensitive scalp, no fragrance please."],
          ["What's your hair goal for this visit?", "Keep length, smooth finish that lasts a week."],
        ],
        signed: "Maya Jones",
      },
    },
    {
      id: "example-client-ana",
      name: "Ana Ruiz",
      phone: "+15550100145",
      email: "ana@example.com",
      status: "new",
      visits: 1,
      notes: "Found you on Instagram. Interested in color next month.",
      invited_at: null,
    },
    {
      id: "example-client-jordan",
      name: "Jordan Lee",
      phone: "+15550100167",
      email: "jordan@example.com",
      status: "new",
      visits: 0,
      notes: "Referred by Maya. Sent a private invite link.",
      invited_at: shift(today, -2),
    },
    {
      id: "example-client-chris",
      name: "Chris Patel",
      phone: "+15550100189",
      email: "chris@example.com",
      status: "new",
      visits: 1,
      notes: "Missed their first appointment; ask for a deposit next time.",
      invited_at: null,
    },
  ].map((c) => ({ ...c, example: true }));

  const b = (id, client, service, days, start, end, extra) => ({
    id: `example-booking-${id}`,
    example: true,
    booking_date: shift(today, days),
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    client_name: client.name,
    client_email: client.email,
    client_phone: client.phone,
    client: { status: client.status },
    service_name: service.name,
    price_cents: service.price_cents,
    status: "confirmed",
    deposit_cents: 0,
    deposit_status: "none",
    outcome: null,
    visit_note: null,
    owed_cents: null,
    ...extra,
  });
  const [maya, ana, jordan, chris] = clients;
  const [silk, trim, color] = EXAMPLE_SERVICES;
  const bookings = [
    b("today1", ana, trim, 0, "11:00", "11:45", { label: "Today" }),
    b("today2", maya, silk, 0, "14:00", "15:30", { deposit_cents: 2000, deposit_status: "paid", label: "Today · deposit paid" }),
    b("upcoming", maya, silk, 2, "10:00", "11:30", { deposit_cents: 2000, deposit_status: "paid", label: "Upcoming · deposit paid" }),
    b("upcoming2", ana, color, 4, "14:00", "16:00", { deposit_cents: 3500, deposit_status: "unpaid", label: "Upcoming · deposit due" }),
    b("paid", maya, silk, -7, "10:00", "11:30", {
      outcome: "completed_paid",
      visit_note: "Used the new heat protectant; she loved the finish.",
      label: "Completed · paid in full",
    }),
    b("owed", ana, trim, -3, "13:00", "13:45", {
      outcome: "completed_owed",
      owed_cents: 1500,
      visit_note: "Paid $40 cash, $15 still owed.",
      label: "Completed · balance owed",
    }),
    b("noshow", chris, trim, -1, "16:00", "16:45", { outcome: "no_show", visit_note: "No call, no show.", label: "No-show" }),
    b("cancelled", ana, trim, 6, "11:00", "11:45", { status: "cancelled", label: "Cancelled by the client" }),
    b("late", maya, color, 1, "09:00", "11:00", {
      status: "cancelled",
      deposit_cents: 3500,
      deposit_status: "paid",
      late: true,
      label: "Late cancel · deposit kept",
    }),
  ];
  const upcoming = bookings.filter((x) => x.status === "confirmed" && x.booking_date >= today);
  const past = bookings.filter((x) => x.status === "confirmed" && x.booking_date < today);
  const cancelled = bookings.filter((x) => x.status === "cancelled");

  // Weekdays 9–5 for the next two weeks, plus a Regulars-only Saturday.
  const openings = [];
  for (let i = 0; i < 14; i++) {
    const date = shift(today, i);
    const dow = weekday(date);
    if (dow >= 1 && dow <= 5) {
      openings.push({ id: `example-opening-${i}`, opening_date: date, start_time: "09:00:00", end_time: "17:00:00", visibility: "everyone", example: true });
    }
  }
  openings.push({ id: "example-opening-sat", opening_date: nextSat, start_time: "09:00:00", end_time: "13:00:00", visibility: "regulars", example: true });
  openings.sort((x, y) => (x.opening_date + x.start_time).localeCompare(y.opening_date + y.start_time));

  // A cancelled Regulars booking whose time stays Regulars-only.
  const holds = [
    { id: "example-hold-1", hold_date: shift(today, 5), start_time: "11:00:00", end_time: "12:30:00", example: true },
  ];

  // A regular first: regulars hear about openings before everyone else.
  const waitlist = [
    {
      id: "example-wait-2",
      name: "Leah Kim",
      phone: "+15550100223",
      email: "leah@example.com",
      status: "regular",
      service: "Trim & Style",
      wishes: "Weekdays · Evenings (after 5 PM)",
      joined: `${shift(today, -4)}`,
      toldCount: 0,
      stuckCount: 0,
      example: true,
    },
    {
      id: "example-wait-1",
      name: "Priya Shah",
      phone: "+15550100201",
      email: "priya@example.com",
      status: "new",
      service: "Silk Press",
      wishes: "Saturdays · Mornings",
      joined: "yesterday",
      toldCount: 1,
      lastTold: "today",
      stuckCount: 0,
      example: true,
    },
  ];

  const tue = nextWeekday(today, 2);
  const events = [
    {
      id: "example-event-pickup",
      title: "School pickup",
      starts_on: tue,
      start_time: "16:00:00",
      end_time: "17:00:00",
      repeats: "weekly",
      repeat_until: null,
      repeat_days: [2],
      skipped_dates: [],
      blocks_bookings: true,
      color: "green",
      note: "Example: repeats every Tuesday at 4 PM with Block bookings on, so clients can't book then.",
      example: true,
    },
    {
      id: "example-event-game",
      title: "Kid's basketball game",
      starts_on: nextSat,
      start_time: "17:00:00",
      end_time: "19:00:00",
      repeats: "none",
      repeat_until: null,
      repeat_days: [],
      skipped_dates: [],
      blocks_bookings: false,
      color: "blue",
      note: "Example: a personal event. It's on your calendar, and clients can still book around it.",
      example: true,
    },
  ];

  const invites = [{ id: "example-invite-1", name: "Jordan Lee", phone: "+15550100167", invite_state: "open", example: true }];

  const intake = {
    questions: [
      { id: "example-q1", label: "Any allergies or sensitivities?", type: "text", required: true },
      { id: "example-q2", label: "What's your hair goal for this visit?", type: "text", required: false },
    ],
    waiver:
      "I understand that chemical services carry some risk, that I've shared any allergies, and that results depend on my hair's condition.",
  };

  return { clients, bookings, upcoming, past, cancelled, openings, holds, waitlist, events, invites, intake, services: EXAMPLE_SERVICES };
}

// Whether to show examples: the account's switch (step 37 SQL), false before
// that SQL is run.
export async function examplesOn(supabase, userId) {
  const { data, error } = await supabase.from("stylists").select("show_examples").eq("id", userId).maybeSingle();
  return !error && Boolean(data?.show_examples);
}

// Home's "at a glance" cards for a pro with nothing booked yet.
export const EXAMPLE_HOME_STATS = { todays: 2, weekRevenueCents: 25500, depositsCents: 5500, newClients: 3, waiting: 2 };

// Clients → Import: what a list from another app (a Booksy-style CSV) looks
// like once it's read. Fake names and 555-01xx numbers.
export const EXAMPLE_IMPORT = {
  fileName: "booksy-clients-export.csv",
  rows: [
    { name: "Tasha Williams", phone: "(555) 010-0311", email: "tasha@example.com", status: "regular", note: "Every 6 weeks, silk press" },
    { name: "Bri Johnson", phone: "(555) 010-0322", email: "", status: "regular", note: "Prefers Saturday mornings" },
    { name: "Kim Nguyen", phone: "(555) 010-0333", email: "kim@example.com", status: "new", note: "" },
    { name: "Dana Brooks", phone: "", email: "dana@example.com", status: "new", note: "Color consult first" },
  ],
};

// Reports for a pro with no bookings yet: a sample book of visits over the
// period being looked at (and the one before, for the comparisons), worked
// out by the same code as real reports. Never saved.
export function exampleReportData(from, to, today) {
  const people = [
    { id: "example-r-maya", name: "Maya Jones", status: "regular" },
    { id: "example-r-leah", name: "Leah Kim", status: "regular" },
    { id: "example-r-tasha", name: "Tasha Williams", status: "regular" },
    { id: "example-r-ana", name: "Ana Ruiz", status: "new" },
    { id: "example-r-chris", name: "Chris Patel", status: "new" },
    { id: "example-r-priya", name: "Priya Shah", status: "new" },
  ];
  const services = [
    [8500, 2000],
    [4500, 0],
    [12000, 3500],
  ];
  // Who books most: regulars come back more often.
  const order = [0, 1, 3, 0, 2, 1, 4, 0, 5, 2, 1, 0, 3, 2, 0, 1];
  const bookings = [];
  const last = to < today ? to : today;
  let n = 0;
  for (let d = from; d <= last; d = shift(d, 1)) {
    const dow = weekday(d);
    if (dow === 0 || dow === 1) continue; // closed Sunday, Monday
    for (const hour of n % 3 === 0 ? ["10:00", "14:00"] : ["11:00"]) {
      const who = people[order[n % order.length]];
      const [price, deposit] = services[n % services.length];
      const past = d < today;
      let outcome = past ? "completed_paid" : null;
      if (past && n % 11 === 7) outcome = "no_show";
      if (past && n % 13 === 5) outcome = "completed_owed";
      const cancelled = n % 17 === 9;
      bookings.push({
        id: `example-r-${n}`,
        booking_date: d,
        start_time: `${hour}:00`,
        status: cancelled ? "cancelled" : "confirmed",
        price_cents: price,
        deposit_cents: deposit,
        deposit_status: deposit ? "paid" : "none",
        deposit_paid_at: deposit ? `${shift(d, -3)}T18:00:00Z` : null,
        outcome: cancelled ? null : outcome,
        owed_cents: outcome === "completed_owed" ? 1500 : null,
        reschedule_count: n % 19 === 4 ? 1 : 0,
        client_id: who.id,
        example: true,
      });
      n += 1;
    }
  }
  const clients = people.map((p, i) => ({ ...p, created_at: `${shift(from, i * 4)}T12:00:00Z`, example: true }));
  return { bookings, clients };
}
