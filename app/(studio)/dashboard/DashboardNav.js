"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTemplate } from "@/components/TemplateContext";

// Thin line icons, drawn for this app (24 x 24, 1.4px strokes).
const ICONS = {
  home: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5v11h13v-11M10 20.5v-5.5h4v5.5" />
    </>
  ),
  today: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.9c1.9.7 3.2 2.4 3.5 5.1" />
    </>
  ),
  requests: (
    <>
      <path d="M3.5 6.5h17v11h-17z" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  openings: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  waitlist: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5c0 4.2 8 4.6 8 8.5s-8 4.3-8 8.5M16 3.5c0 1.6-1.2 2.7-2.6 3.6M8 20.5c0-1.6 1.2-2.7 2.6-3.6" />
    </>
  ),
  notes: (
    <>
      <path d="M6 3.5h9l3 3v14H6z" />
      <path d="M15 3.5v3h3M9 11h6M9 14.5h6M9 18h3.5" />
    </>
  ),
  money: (
    <>
      <rect x="3.5" y="6.5" width="17" height="11" rx="1" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="12" rx="1" />
      <path d="M3.5 12.5h17M12 8.5v12M12 8.5C10 5 6.5 5 7.5 7.5 8.2 9 12 8.5 12 8.5zM12 8.5c2-3.5 5.5-3.5 4.5-1-.7 1.5-4.5 1-4.5 1z" />
    </>
  ),
  reviews: <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z" />,
  reports: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6.5 20.5v-6M11 20.5V9.5M15.5 20.5v-8M20 20.5V5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
      <circle cx="15" cy="6.5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </>
  ),
};

// "also": other pages that live under this item (Services and Working hours
// are reached from Settings).
const ITEMS = [
  { href: "/dashboard", label: "Home", icon: "home", exact: true },
  // In the side menu only: the phone tab bar is full (Home links to it).
  { href: "/dashboard/today", label: "Today", icon: "today", wide: true },
  { href: "/dashboard/requests", label: "Requests", icon: "requests", module: "requests" },
  { href: "/dashboard/bookings", label: "Calendar", icon: "calendar" },
  { href: "/dashboard/clients", label: "Clients", word: "Clients", icon: "clients" },
  { href: "/dashboard/openings", label: "Openings", icon: "openings" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: "waitlist", module: "waitlist" },
  { href: "/dashboard/notes", label: "Notes", icon: "notes", also: ["/dashboard/wrapup"] },
  // In the side menu only: the phone tab bar is full (Home links to it).
  // In the side menu only (phones reach it from Home's money card).
  { href: "/dashboard/money", label: "Money", icon: "money", wide: true },
  { href: "/dashboard/gift-cards", label: "Gift cards", icon: "gift", wide: true },
  // In the side menu only (phones reach it from Settings > Public profile).
  { href: "/dashboard/reviews", label: "Reviews", icon: "reviews", wide: true },
  { href: "/dashboard/reports", label: "Insights", icon: "reports", wide: true, module: "reports" },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "settings",
    also: ["/dashboard/services", "/dashboard/availability", "/dashboard/intake"],
  },
];

function isActive(item, pathname) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also || [])].some((p) => pathname.startsWith(p));
}

export default function DashboardNav() {
  const pathname = usePathname();
  // The pro's template: their word for clients, and tabs they've turned off.
  const { words, modules } = useTemplate();
  const items = ITEMS.filter((i) => !i.module || modules[i.module] !== false).map((i) => (i.word ? { ...i, label: words[i.word] || i.label } : i));

  return (
    <nav className="db-nav" aria-label="Dashboard">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={["db-nav-item", active ? "active" : "", item.wide ? "wide-only" : ""].join(" ").trim()}
            aria-current={active ? "page" : undefined}
          >
            <svg
              className="db-nav-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.icon]}
            </svg>
            <span className="db-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
