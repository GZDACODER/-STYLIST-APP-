// The Barber template: short fixed-length cuts, quick rebooking, a same-day
// waitlist and smaller deposits.
export const barber = {
  key: "barber",
  label: "Barber",
  blurb: "Fades, lineups, beard work and kids' cuts.",
  vocab: { pro: "barber" },
  modules: { aftercare: false },
  homeCards: ["today", "waitlist", "revenue", "newClients", "deposits"],
  // After a visit, offer to book the same cut again this many weeks out.
  rebookWeeks: 2,
  presets: {
    samples: {
      paymentNote: "e.g. Beard oil",
      giftNote: "e.g. Skin fade, Dec 4",
      owner: "e.g. Marcus Hill",
      specialties: "e.g. Skin fades, Beard trims, Lineups",
      bio: "A few lines about you and your chair.",
      reviews: [
        { rating: 5, comment: "Cleanest fade I've had in years. In and out on time.", reply: "Appreciate you, Dre! See you in two weeks.", name: "Dre W." },
        { rating: 5, comment: "Great lineup and beard trim. Booking in the app is easy.", reply: null, name: "Chris P." },
        { rating: 4, comment: "Sharp cut. Shop was busy so I waited a few minutes.", reply: "Thanks for hanging in there, Jay!", name: "Jay M." },
        { rating: 5, comment: "Took his time with my son's first real haircut. We'll be back.", reply: null, name: "Tony R." },
      ],
      importNotes: ["Every 2 weeks, skin fade #1 on the sides", "Prefers Friday after work", "", "Beard trim with every cut"],
    },
    services: [
      { name: "Skin Fade", price_cents: 3500, duration_minutes: 45, deposit: "$5 deposit", description: "Skin fade with a clean finish and hot towel." },
      { name: "Lineup", price_cents: 1500, duration_minutes: 15, deposit: "No deposit", description: "Edge up and shape the hairline." },
      { name: "Beard Trim & Shape", price_cents: 2000, duration_minutes: 20, deposit: "No deposit", description: "Trim, shape and line the beard, finished with oil." },
      { name: "Kids' Cut", price_cents: 2500, duration_minutes: 30, deposit: "No deposit", description: "For 12 and under." },
    ],
    intake: {
      questions: [
        { label: "How do you usually wear it? (guard number, length on top)", type: "text" },
        { label: "Any skin sensitivity or razor bumps?", type: "text" },
      ],
      // Starter waiver (a template: must be reviewed by a lawyer before launch).
      waiver:
        "I've told my barber about any skin conditions, sensitivities or allergies, including to products, razors or clippers. I understand razor work and line-ups can cause irritation, and I'll say if anything feels wrong during my cut. For color or chemical services, I understand a patch test may be needed first. I agree to the cancellation and no-show policy shown when I booked. I agree that photos of my cut may be taken and shared to show this business's work, unless I ask not to.",
    },
    exampleVisitNote: "Took the top down half an inch; he wants it tighter next time.",
    exampleSharedNote: "Skin fade, #2 on top blended to a 0. Rebook in 2 weeks to keep it sharp.",
    exampleNotes: {
      maya: "Every 2 weeks, #1 on the sides, scissors on top. Likes a hard part.",
      ana: "Found you on Instagram. Wants to try a taper next time.",
      jordan: "Referred by Maya. Sent a private invite link.",
      chris: "Missed their first appointment; ask for a deposit next time.",
    },
    exampleIntake: [
      ["How do you usually wear it? (guard number, length on top)", "#1 on the sides, about 2 inches on top."],
      ["Any skin sensitivity or razor bumps?", "Razor bumps on the neck: clippers only there."],
    ],
  },
};
