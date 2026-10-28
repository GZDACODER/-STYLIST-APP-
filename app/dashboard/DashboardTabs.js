"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/openings", label: "Openings" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard", label: "Services" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={pathname === tab.href ? "tab active" : "tab"}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
