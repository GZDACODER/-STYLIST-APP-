// "What kind of business?" on the sign-up form (optional). Saved to the
// profile as stylists.business_type. Keep in step with the list in
// supabase/migrations/0022_business_type.sql.
export const BUSINESS_TYPES = [
  { value: "hair", label: "Hair" },
  { value: "barber", label: "Barbers" },
  { value: "nails", label: "Nails" },
  { value: "lashes", label: "Lashes" },
  { value: "tattoo", label: "Tattoo" },
  { value: "trainer", label: "Trainers" },
  { value: "tutor", label: "Tutors" },
  { value: "pet_grooming", label: "Pet grooming" },
  { value: "photographer", label: "Photographers" },
  { value: "other", label: "Other" },
];

export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map((t) => t.value);
