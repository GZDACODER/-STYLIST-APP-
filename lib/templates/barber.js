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
      waiver: "",
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
