// "What kind of business?" on the sign-up form (optional). Saved to the
// profile as stylists.business_type. Keep in step with the list in
// supabase/migrations/0022_business_type.sql.
//
// soon: Clientele is built for beauty pros first. These can still sign up
// and use it, but are labelled "coming soon" on the homepage and the sign-up
// form until the features they need (packages, consultations, pet
// profiles...) are built.
export const BUSINESS_TYPES = [
  { value: "hair", label: "Hair stylists" },
  { value: "barber", label: "Barbers" },
  { value: "tattoo", label: "Tattoo artists" },
  { value: "tutor", label: "Tutors" },
  // Saved on older accounts; they use the Hair stylist template.
  { value: "nails", label: "Nails", soon: true },
  { value: "lashes", label: "Lashes & brows", soon: true },
  { value: "makeup", label: "Makeup", soon: true, notSaved: true },
  { value: "massage", label: "Massage & esthetics", soon: true, notSaved: true },
  { value: "cleaning", label: "Cleaning", soon: true, notSaved: true },
  { value: "landscaping", label: "Landscaping", soon: true, notSaved: true },
  { value: "car_rental", label: "Car rental", soon: true, notSaved: true },
  { value: "trainer", label: "Trainers", hidden: true },
  { value: "pet_grooming", label: "Pet grooming", hidden: true },
  { value: "photographer", label: "Photographers", hidden: true },
  { value: "other", label: "Other", hidden: true },
];

export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.filter((t) => !t.notSaved).map((t) => t.value);
export const AVAILABLE_TYPES = BUSINESS_TYPES.filter((t) => !t.soon && !t.hidden);
export const COMING_SOON_TYPES = BUSINESS_TYPES.filter((t) => t.soon && !t.hidden);
