// The Control Room's two tabs: Health (is everything running) and Activity
// (what's happening across every pro).
import Link from "next/link";

export default function ControlTabs({ active }) {
  return (
    <nav className="cr-tabs" aria-label="Control Room">
      <Link href="/dashboard/admin/control" className={active === "health" ? "cr-tab active" : "cr-tab"} aria-current={active === "health" ? "page" : undefined}>
        Health
      </Link>
      <Link href="/dashboard/admin/control/activity" className={active === "activity" ? "cr-tab active" : "cr-tab"} aria-current={active === "activity" ? "page" : undefined}>
        Activity
      </Link>
    </nav>
  );
}
