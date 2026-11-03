import { redirect } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { BRAND_NAME } from "@/lib/brand";
import DashboardNav from "./DashboardNav";
import "./dashboard.css";

// The same serif as the public booking page.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#0E0E0E" };

// The dashboard's frame: a slim black sidebar (a bottom tab bar on phones
// and iPad portrait) and the page on warm ivory.
export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name")
    .eq("id", user.id)
    .maybeSingle();

  // Clients who verified on a booking page have a login too, but no stylist
  // profile. They don't belong in the dashboard.
  if (!stylist) {
    return (
      <div className={`db ${display.variable}`}>
        <main className="db-main">
          <div className="db-page stack">
            <h1>No stylist account</h1>
            <p className="muted">
              {user.email} isn&apos;t a stylist account. If you&apos;re booking an appointment,
              please use your stylist&apos;s booking link.
            </p>
            <form action={logout}>
              <button type="submit" className="button secondary">
                Log out
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`db ${display.variable}`}>
      <aside className="db-side">
        <div className="db-brand">
          <span className="db-brand-name">{stylist.business_name}</span>
          <span className="db-brand-mark">{BRAND_NAME}</span>
        </div>
        <DashboardNav />
        <div className="db-side-foot">
          <span className="db-side-email">{user.email}</span>
          <form action={logout}>
            <button type="submit" className="db-logout">
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Phones and iPad portrait: a slim bar at the top (the nav moves to the bottom). */}
      <header className="db-topbar">
        <span className="db-brand-name">{stylist.business_name}</span>
        <form action={logout}>
          <button type="submit" className="db-logout">
            Log out
          </button>
        </form>
      </header>

      <main className="db-main">
        <div className="db-page">{children}</div>
      </main>
    </div>
  );
}
