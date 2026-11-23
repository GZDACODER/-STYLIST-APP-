// The Tattoo artist template: consultations and sessions, a deposit on every
// session, a consent waiver with an age check, and healing aftercare.
// (Projects, design reference uploads and the day 1/3/14 healing emails come
// in the next update.)
export const tattoo = {
  key: "tattoo",
  label: "Tattoo artist",
  blurb: "Custom pieces, flash, consultations and multi-session work.",
  vocab: { pro: "artist", appointment: "session", appointments: "sessions", visit: "session", visits: "sessions" },
  modules: { myLook: false, bookMyUsual: false, standing: false },
  homeCards: ["today", "deposits", "revenue", "newClients", "waitlist"],
  presets: {
    services: [
      { name: "Consultation", price_cents: 0, duration_minutes: 30, deposit: "No deposit", description: "Talk through your idea, placement and size, and get a quote." },
      { name: "Small Tattoo (up to 3 in)", price_cents: 15000, duration_minutes: 90, deposit: "$50 deposit", description: "Fine line or simple flash, up to about 3 inches." },
      { name: "Half-Day Session", price_cents: 50000, duration_minutes: 240, deposit: "$100 deposit", description: "Four hours on a larger custom piece.", aftercare: "Leave the wrap on for 2 to 4 hours, then wash gently with fragrance-free soap and pat dry. Apply a thin layer of unscented lotion 2 to 3 times a day. No swimming, baths or direct sun for 2 weeks, and don't pick or scratch." },
      { name: "Full-Day Session", price_cents: 90000, duration_minutes: 420, deposit: "$150 deposit", description: "A full day on a large piece or sleeve.", aftercare: "Leave the wrap on for 2 to 4 hours, then wash gently with fragrance-free soap and pat dry. Apply a thin layer of unscented lotion 2 to 3 times a day. No swimming, baths or direct sun for 2 weeks, and don't pick or scratch." },
    ],
    intake: {
      questions: [
        { label: "Date of birth", type: "text", required: true },
        { label: "I'm 18 or older and will bring photo ID", type: "yesno", required: true },
        { label: "Placement (where on the body)", type: "text", required: true },
        { label: "Approximate size", type: "text" },
        { label: "Describe your idea", type: "long" },
        { label: "Any allergies, skin conditions, blood thinners or medical conditions?", type: "long" },
      ],
      // Starter waiver (a template: must be reviewed by a lawyer before launch).
      waiver:
        "I am 18 or older and will show valid photo ID at my appointment. I am not under the influence of alcohol or drugs. I've told my artist about any medical conditions, medications (including blood thinners), allergies, skin conditions or pregnancy. I understand a tattoo is permanent, that I've approved the design, spelling and placement, and that results vary with my skin and how I care for it while it heals. I understand the risks, including infection, allergic reaction and scarring, and I'll follow the aftercare instructions I'm given. I understand my deposit is non-refundable, counts toward the final price, and may be kept if I cancel late, miss my appointment or arrive without ID. Custom designs belong to the artist. Photos of my tattoo may be used to show the artist's work unless I ask not to.",
    },
    exampleVisitNote: "Session 2 of 4: lining done, shading started on the upper arm. Took breaks well.",
    exampleSharedNote: "Lining is done. Keep it clean and moisturized; we start shading at the next session.",
    exampleNotes: {
      maya: "Sleeve in progress: session 3 of 4 next. Healing well, tends to bruise on the inner arm.",
      ana: "Found you on Instagram. Wants a fine-line botanical piece on the forearm.",
      jordan: "Referred by Maya. Booked a consultation for a back piece.",
      chris: "Missed their first session; deposit kept per policy.",
    },
    exampleIntake: [
      ["Placement (where on the body)", "Left forearm, inner side."],
      ["Describe your idea", "Fine-line peonies wrapping around, about 5 inches."],
    ],
  },
};
