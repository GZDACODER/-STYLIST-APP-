import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import DashboardTabs from "./DashboardTabs";

// Shared header and tabs for every page under /dashboard.
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
      <div className="stack">
        <h1>No stylist account</h1>
        <p className="muted">
          {user.email} isn't a stylist account. If you're booking an appointment, please use
          your stylist's booking link.
        </p>
        <form action={logout}>
          <button type="submit" className="button secondary">
            Log out
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <div>
          <h1>{stylist.business_name}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="button secondary small">
            Log out
          </button>
        </form>
      </div>
      <DashboardTabs />
      {children}
    </>
  );
}
