// The Settings sections, in order: Settings shows them as a list (left on
// iPad, its own screen on phones). Services, Hours and Forms keep their
// older addresses so existing links and emails still work.
export const SETTINGS_SECTIONS = [
  { key: "business", label: "Business", note: "Name, your first name, time zone", href: "/dashboard/settings/business" },
  { key: "type", label: "Business type", note: "Your trade, its words and features", href: "/dashboard/settings/type" },
  { key: "booking", label: "Booking page", note: "Link, tagline, photos, rescheduling", href: "/dashboard/settings/booking-page" },
  { key: "services", label: "Services", note: "What clients can book, and prices", href: "/dashboard/services" },
  { key: "hours", label: "Hours & days off", note: "Your week and blocked dates", href: "/dashboard/availability" },
  { key: "holidays", label: "Holidays", note: "Close on federal holidays", href: "/dashboard/settings/holidays" },
  { key: "regulars", label: "Regulars", note: "Regulars only, and who becomes one", href: "/dashboard/settings/regulars" },
  { key: "deposits", label: "Deposits", note: "Stripe, deposits and your policy", href: "/dashboard/settings/deposits" },
  { key: "calendar", label: "Calendar sync", note: "Bookings in Google or iPhone Calendar", href: "/dashboard/settings/calendar" },
  { key: "forms", label: "Forms", note: "Intake form & waiver", href: "/dashboard/intake" },
  { key: "plan", label: "Plan & billing", note: "Your plan, team members, add-ons", href: "/dashboard/settings/plan" },
  { key: "email", label: "Email", note: "Where client replies go", href: "/dashboard/settings/email" },
  { key: "support", label: "Support access", note: "Let the Clientele team help on your account", href: "/dashboard/settings/support" },
];

export const sectionByKey = (key) => SETTINGS_SECTIONS.find((s) => s.key === key);
