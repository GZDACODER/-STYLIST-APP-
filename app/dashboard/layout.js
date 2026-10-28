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

  return (
    <>
      <div className="header">
        <div>
          <h1>{stylist?.business_name || "Your dashboard"}</h1>
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
