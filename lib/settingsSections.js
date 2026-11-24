// The Settings sections, in order: Settings shows them as a list (left on
// iPad, its own screen on phones). Services, Hours and Forms keep their
// older addresses so existing links and emails still work.
export const SETTINGS_SECTIONS = [
  { key: "business", label: "Business", note: "Name, time zone, where client replies go", href: "/dashboard/settings/business" },
  { key: "type", label: "Business type", note: "Your trade, its words and features", href: "/dashboard/settings/type" },
  { key: "booking", label: "Booking page", note: "Link, tagline, photos, rescheduling", href: "/dashboard/settings/booking-page" },
  { key: "profile", label: "Public profile", note: "Your page clients can find and share", href: "/dashboard/settings/profile" },
  { key: "services", label: "Services", note: "What clients can book, and prices", href: "/dashboard/services" },
  { key: "hours", label: "Hours & days off", note: "Your week, blocked dates and holidays", href: "/dashboard/availability" },
  { key: "rules", label: "Booking rules", note: "Notice, how far ahead, breaks, daily limit", href: "/dashboard/settings/rules" },
  { key: "regulars", label: "Regulars", note: "Regulars only, and who becomes one", href: "/dashboard/settings/regulars" },
  { key: "deposits", label: "Deposits", note: "Stripe, deposits and your policy", href: "/dashboard/settings/deposits" },
  { key: "calendar", label: "Calendar sync", note: "Bookings in Google or iPhone Calendar", href: "/dashboard/settings/calendar" },
  { key: "forms", label: "Forms", note: "Intake form & waiver", href: "/dashboard/intake" },
  { key: "notifications", label: "Notifications", note: "Which emails you get", href: "/dashboard/settings/notifications" },
  { key: "plan", label: "Plan & billing", note: "Your plan, team, add-ons, agreements", href: "/dashboard/settings/plan" },
  { key: "support", label: "Privacy & support", note: "Download your data, support access, activity", href: "/dashboard/settings/support" },
];

export const sectionByKey = (key) => SETTINGS_SECTIONS.find((s) => s.key === key);
