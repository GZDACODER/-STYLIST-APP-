// The Settings sections, in groups (Business, Booking, App, Account, Help):
// Settings shows them as a list (left on iPad, its own screen on phones). Services, Hours and Forms keep their
// older addresses so existing links and emails still work.
export const SETTINGS_SECTIONS = [
  { group: "Business", key: "business", label: "Business", note: "Name, time zone, where client replies go", href: "/dashboard/settings/business" },
  { group: "Business", key: "type", label: "Business type", note: "Your trade, its words and features", href: "/dashboard/settings/type" },
  { group: "Business", key: "hours", label: "Hours & days off", note: "Your week, blocked dates and holidays", href: "/dashboard/availability" },
  { group: "Booking", key: "booking", label: "Booking page", note: "Link, tagline, photos, rescheduling", href: "/dashboard/settings/booking-page" },
  { group: "Booking", key: "profile", label: "Public profile", note: "Your page clients can find and share", href: "/dashboard/settings/profile" },
  { group: "Booking", key: "services", label: "Services", note: "What clients can book, and prices", href: "/dashboard/services" },
  { group: "Booking", key: "rules", label: "Booking rules", note: "Notice, how far ahead, breaks, daily limit", href: "/dashboard/settings/rules" },
  { group: "Booking", key: "regulars", label: "Regulars", note: "Regulars only, and who becomes one", href: "/dashboard/settings/regulars" },
  { group: "Booking", key: "deposits", label: "Deposits", note: "Stripe, deposits and your policy", href: "/dashboard/settings/deposits" },
  { group: "Booking", key: "forms", label: "Forms", note: "Intake form & waiver", href: "/dashboard/intake" },
  { group: "App", key: "calendar", label: "Calendar sync", note: "Bookings in Google or iPhone Calendar", href: "/dashboard/settings/calendar" },
  { group: "App", key: "notifications", label: "Notifications", note: "Which emails you get", href: "/dashboard/settings/notifications" },
  { group: "Account", key: "plan", label: "Plan & billing", note: "Your plan, team, add-ons, agreements", href: "/dashboard/settings/plan" },
  { group: "Account", key: "support", label: "Privacy & support", note: "Download your data, support access, activity", href: "/dashboard/settings/support" },
  { group: "Help", key: "help", label: "Example data & tips", note: "Show sample data, see page tips again", href: "/dashboard/settings/help" },
];

// The sections in their groups, in order: [["Business", [...]], ...].
export const SETTINGS_GROUPS = SETTINGS_SECTIONS.reduce((groups, s) => {
  const last = groups[groups.length - 1];
  if (last && last[0] === s.group) last[1].push(s);
  else groups.push([s.group, [s]]);
  return groups;
}, []);

export const sectionByKey = (key) => SETTINGS_SECTIONS.find((s) => s.key === key);
