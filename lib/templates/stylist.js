// The Stylist template: the app as it has always been. Every other template
// starts from this one and changes only what's different (lib/templates/index.js).
export const stylist = {
  key: "stylist",
  label: "Hair stylist",
  blurb: "Silk presses, cuts, color, braids and styling.",
  // How bookings work: "slot" = a start time and a length. A later template
  // (car rental) can use "day" with an inventory without changing the others.
  bookingUnit: "slot",
  vocab: {
    pro: "stylist",
    client: "client",
    clients: "clients",
    appointment: "appointment",
    appointments: "appointments",
    visit: "visit",
    visits: "visits",
    service: "service",
    services: "services",
    regular: "Regular",
    regulars: "Regulars",
  },
  // Tabs and features shown by default. The pro can turn any of them on or
  // off in Settings > Business type (stylists.modules overrides these).
  modules: {
    regulars: true,
    waitlist: true,
    deposits: true,
    aftercare: true,
    myLook: true,
    bookMyUsual: true,
    standing: true,
    intake: true,
    portfolio: true,
    birthday: true,
    reports: true,
    requests: false,
    bookingPhotos: true,
    projects: false,
    healing: false,
  },
  // Home's at-a-glance cards, in order.
  homeCards: ["today", "revenue", "deposits", "newClients", "waitlist"],
  presets: {
    // Check-in emails after a visit (modules.healing), by day.
    healing: {
      1: { title: "How's everything feeling?", text: "Just checking in after your visit. If anything doesn't feel right, reply to this email and we'll sort it out." },
      3: { title: "A quick check-in", text: "How are you getting on? Follow your aftercare and reply with any questions." },
      14: { title: "Time to plan your next visit?", text: "It's been two weeks. If you'd like to keep things looking their best, book your next visit below.", book: true },
    },
    // Sample text for examples and placeholders (lib/examples sample()).
    samples: {
      paymentNote: "e.g. Edge control, 2 jars",
      giftNote: "e.g. Silk press, Dec 4",
      owner: "e.g. Maya Jones",
      specialties: "e.g. Silk press, Knotless braids, Color",
      bio: "A few lines about you and your work.",
      reviews: [
        { rating: 5, comment: "Best silk press I've had. It lasted all week, even in the humidity!", reply: "Thank you, Leah! See you in two weeks.", name: "Leah K." },
        { rating: 5, comment: "My knotless braids are so neat and light. Worth every minute.", reply: null, name: "Maya J." },
        { rating: 4, comment: "Loved my color. We ran a little behind, but it was worth the wait.", reply: "Thanks for your patience, Ana!", name: "Ana R." },
        { rating: 5, comment: "Booking was so easy and my hair has never looked healthier.", reply: null, name: "Jordan P." },
      ],
      importNotes: ["Every 6 weeks, silk press", "Prefers Saturday mornings", "", "Color consult first"],
    },
    services: [
      { name: "Silk Press", price_cents: 8500, duration_minutes: 90, deposit: "$20 deposit", description: "Wash, deep condition, blow-dry and silk press.", aftercare: "Wrap your hair at night with a silk scarf. Skip the gym and steam for 48 hours to keep it straight." },
      { name: "Trim & Style", price_cents: 5500, duration_minutes: 45, deposit: "No deposit", description: "A dusting of the ends and a finished style." },
      { name: "Color Refresh", price_cents: 14000, duration_minutes: 120, deposit: "25% deposit", description: "Root touch-up or gloss to brighten your color between full appointments.", aftercare: "Wait 48 hours before washing. Use a sulfate-free shampoo and cool water to keep the color bright." },
      { name: "New Client Consultation", price_cents: 0, duration_minutes: 30, deposit: "No deposit", description: "Talk through your hair goals before your first appointment." },
    ],
    intake: {
      questions: [
        { label: "Any allergies or sensitivities?", type: "text" },
        { label: "What's your hair goal for this visit?", type: "text" },
      ],
      // Starter waiver (a template: must be reviewed by a lawyer before launch).
      waiver:
        "I've told my stylist about any allergies, sensitivities, medical conditions or medications that could affect my service. For color, lightening, relaxers, keratin or other chemical services, I understand a patch test may be needed at least 48 hours before, and that skipping it is my choice and my risk. I understand results depend on my hair's history and condition, and that the final result can differ from inspiration photos; results aren't guaranteed. I agree to the cancellation and deposit policy shown when I booked. I agree that photos of my hair may be taken and used to show this business's work, unless I ask in writing for them not to be.",
    },
    // The example clients' notes and intake answers, by example client.
    exampleNotes: {
      maya: "Prefers Tuesday mornings. Sensitive scalp: use the gentle shampoo.",
      ana: "Found you on Instagram. Interested in color next month.",
      jordan: "Referred by Maya. Sent a private invite link.",
      chris: "Missed their first appointment; ask for a deposit next time.",
    },
    exampleIntake: [
      ["Any allergies or sensitivities?", "Sensitive scalp, no fragrance please."],
      ["What's your hair goal for this visit?", "Keep length, smooth finish that lasts a week."],
    ],
  },
};
