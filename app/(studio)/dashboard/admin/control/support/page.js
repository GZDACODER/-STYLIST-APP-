// Control Room > Support: pros who have support access on right now. Only
// these can be opened; each visit and change is logged and emailed to them.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import ControlTabs from "../ControlTabs";

export const metadata = { title: `Support · Control Room · ${BRAND_NAME}` };

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function SupportList() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { data: rows, error } = await createAdminClient()
    .from("support_access")
    .select("stylist_id, level, until, stylist:stylists(business_name, pro_code, business_type)")
    .gt("until", new Date().toISOString())
    .order("until");

  return (
    <>
      <PageHeader title="Control Room" subtitle="Accounts whose owners have turned on support access." />
      <ControlTabs active="support" />
      {error && <p className="message error">Support access isn&apos;t set up yet (step 64 SQL).</p>}
      {!error && !rows?.length && (
        <p className="muted">Nobody has support access on. A pro turns it on in Settings › Support access when they want help.</p>
      )}
      <ul className="rq-list">
        {(rows || []).map((r) => (
          <li key={r.stylist_id} className="card">
            <p className="rq-head">
              <span>{r.stylist?.business_name}</span>
              <span className="badge">{r.level === "edit" ? "View and edit" : "View only"}</span>
            </p>
            <p className="muted small-text">
              {r.stylist?.pro_code} · until {when(r.until)} (Central)
            </p>
            <Link className="button small" href={`/dashboard/admin/control/support/${r.stylist_id}`}>
              Open account
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
