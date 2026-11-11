"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Thin line icons, drawn for this app (24 x 24, 1.4px strokes).
const ICONS = {
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
  { href: "/dashboard", label: "Today", icon: "today", exact: true },
  { href: "/dashboard/bookings", label: "Calendar", icon: "calendar" },
  { href: "/dashboard/clients", label: "Clients", icon: "clients" },
  { href: "/dashboard/openings", label: "Openings", icon: "openings" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: "waitlist" },
  { href: "/dashboard/notes", label: "Notes", icon: "notes", also: ["/dashboard/wrapup"] },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "settings",
    also: ["/dashboard/services", "/dashboard/availability"],
  },
];

function isActive(item, pathname) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also || [])].some((p) => pathname.startsWith(p));
}

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="db-nav" aria-label="Dashboard">
      {ITEMS.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "db-nav-item active" : "db-nav-item"}
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
