// "What kind of business?" on the sign-up form (optional). Saved to the
// profile as stylists.business_type. Keep in step with the list in
// supabase/migrations/0022_business_type.sql.
//
// soon: Clientele is built for beauty pros first. These can still sign up
// and use it, but are labelled "coming soon" on the homepage and the sign-up
// form until the features they need (packages, consultations, pet
// profiles...) are built.
export const BUSINESS_TYPES = [
  { value: "hair", label: "Hair" },
  { value: "barber", label: "Barbers" },
  { value: "nails", label: "Nails" },
  { value: "lashes", label: "Lashes" },
  { value: "tattoo", who: "tattoo artists", label: "Tattoo", soon: true },
  { value: "trainer", who: "trainers", label: "Trainers", soon: true },
  { value: "tutor", who: "tutors", label: "Tutors", soon: true },
  { value: "pet_grooming", who: "pet groomers", label: "Pet grooming", soon: true },
  { value: "photographer", who: "photographers", label: "Photographers", soon: true },
  { value: "other", label: "Other" },
];

export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map((t) => t.value);
export const AVAILABLE_TYPES = BUSINESS_TYPES.filter((t) => !t.soon && t.value !== "other");
export const COMING_SOON_TYPES = BUSINESS_TYPES.filter((t) => t.soon);
