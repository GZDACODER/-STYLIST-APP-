// How a visit went, marked by the business after it (Wrap up visits).
// Matches bookings.outcome in supabase/migrations/0023_visit_outcomes.sql.
export const OUTCOMES = [
  { value: "completed_paid", label: "Completed, paid in full", short: "Paid in full" },
  { value: "completed_owed", label: "Completed, balance owed", short: "Balance owed" },
  { value: "no_show", label: "No-show", short: "No-show" },
  { value: "replaced", label: "Someone else came", short: "Someone else came" },
];

export const OUTCOME_VALUES = OUTCOMES.map((o) => o.value);
export const outcomeLabel = (value) => OUTCOMES.find((o) => o.value === value)?.short || "";
