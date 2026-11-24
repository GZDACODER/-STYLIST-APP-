// The Tutor template: students (with an optional parent or guardian),
// subjects, weekly sessions and no beauty features. (Packages, progress
// notes and online/in-person subjects come in a later update.)
export const tutor = {
  key: "tutor",
  label: "Tutor",
  blurb: "Lessons, test prep and homework help, online or in person.",
  vocab: {
    pro: "tutor",
    client: "student",
    clients: "students",
    appointment: "session",
    appointments: "sessions",
    visit: "session",
    visits: "sessions",
    service: "subject",
    services: "subjects",
  },
  modules: { myLook: false, aftercare: false, portfolio: false, deposits: false, birthday: false, bookingPhotos: false },
  homeCards: ["today", "newClients", "revenue", "waitlist", "deposits"],
  presets: {
    samples: {
      paymentNote: "e.g. Workbook",
      giftNote: "e.g. Math session, Dec 4",
      owner: "e.g. Ms. Taylor",
      specialties: "e.g. Algebra, Reading, SAT prep",
      bio: "A few lines about how you teach and who you help.",
      reviews: [
        { rating: 5, comment: "My daughter's algebra grade went from a C to an A. She actually likes math now.", reply: "She did all the hard work! Proud of her.", name: "Leah K." },
        { rating: 5, comment: "Patient, organized and always on time. Reading has really improved.", reply: null, name: "Maya J." },
        { rating: 4, comment: "Great SAT prep. Wish we'd started sooner!", reply: "Thanks, Ana. Best of luck on test day!", name: "Ana R." },
        { rating: 5, comment: "Session notes after each lesson keep us in the loop. Highly recommend.", reply: null, name: "Jordan P." },
      ],
      importNotes: ["Weekly algebra, Tuesdays", "Prefers after school", "", "Starting SAT prep in spring"],
    },
    services: [
      { name: "Math (grades 6-12)", price_cents: 6000, duration_minutes: 60, deposit: "No deposit", description: "Pre-algebra through calculus, homework help and test prep." },
      { name: "Reading & Writing", price_cents: 5500, duration_minutes: 60, deposit: "No deposit", description: "Reading comprehension, essays and grammar." },
      { name: "SAT/ACT Prep", price_cents: 8000, duration_minutes: 90, deposit: "No deposit", description: "Practice tests, strategy and review." },
      { name: "Free Assessment", price_cents: 0, duration_minutes: 30, deposit: "No deposit", description: "Meet, see where the student is and set goals." },
    ],
    intake: {
      questions: [
        { label: "Student's grade or level", type: "text" },
        { label: "Parent or guardian name and phone (if the student is under 18)", type: "text" },
        { label: "What would you like help with?", type: "long" },
        { label: "Online or in person?", type: "choice", options: ["Online", "In person", "Either"] },
      ],
      // Starter waiver (a template: must be reviewed by a lawyer before launch).
      waiver:
        "I agree to the session, package and cancellation policy shown when I booked. Sessions cancelled with less than 24 hours' notice may be charged or counted as used. For online sessions, I'll join from a quiet place with a working camera and microphone, and I understand sessions aren't recorded without everyone's agreement. If the student is under 18, I'm their parent or legal guardian and I consent to these sessions, and I'll be reachable during them. Progress notes and updates may be emailed to the parent or guardian.",
    },
    exampleVisitNote: "Worked through quadratic equations; solid on factoring, needs practice with the quadratic formula.",
    exampleSharedNote: "Great session! Practice problems 1-15 on page 84 before next week.",
    exampleNotes: {
      maya: "Grade 10, algebra 2. Weekly on Tuesdays. Mom (Lisa) gets session updates.",
      ana: "Found you on Instagram. SAT in March; aiming for 1350.",
      jordan: "Referred by Maya. Sent a private invite link.",
      chris: "Missed the first session; parent reminded about the 24-hour policy.",
    },
    exampleIntake: [
      ["Student's grade or level", "Grade 10."],
      ["What would you like help with?", "Algebra 2 homework and the unit test on Friday."],
    ],
  },
};
