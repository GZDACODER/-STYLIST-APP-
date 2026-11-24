// Activity: what happened on the account, newest first. What clients did
// from their email links (cancelled, rescheduled, running late, requests,
// waivers) and everything done with support access (and turning it on/off).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Activity · ${BRAND_NAME}` };

const CLIENT_ACTION = {
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  running_late: "Running late",
  calendar: "Added it to their calendar",
  waiver_signed: "Signed their waiver",
  requested: "Sent a request",
};

export default async function ActivityPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const tab = ["all", "clients", "support"].includes(show) ? show : "all";
  const [{ data: me }, { data: support }, { data: clients }, { data: access }] = await Promise.all([
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.from("support_log").select("created_at, actor, action, detail, level").eq("stylist_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("client_activity").select("created_at, client_name, action, detail").eq("stylist_id", user.id).neq("action", "calendar").order("created_at", { ascending: false }).limit(200),
    supabase.from("support_access").select("until, level").eq("stylist_id", user.id).maybeSingle(),
  ]);
  const zone = me?.timezone || "America/Chicago";
  const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: zone });
  const rows = [
    ...(tab !== "clients" ? (support || []).map((l) => ({ at: l.created_at, who: l.actor, what: l.action, detail: l.detail, kind: l.actor === "You" ? "you" : "support" })) : []),
    ...(tab !== "support" ? (clients || []).map((c) => ({ at: c.created_at, who: c.client_name, what: CLIENT_ACTION[c.action] || c.action, detail: c.detail, kind: "client" })) : []),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const on = access?.until && new Date(access.until) > new Date();

  return (
    <>
      <PageHeader guide="activity" title="Activity" subtitle="What clients did from their links, and everything Clientele support did on your account." />
      <p className={on ? "message success" : "message info"}>
        Support access is {on ? `on (${access.level === "edit" ? "view and edit" : "view only"}) until ${when(access.until)}` : "off"}.{" "}
        <Link href="/dashboard/settings/support">{on ? "Change or turn off" : "Settings"}</Link>
      </p>
      <nav className="cr-tabs" aria-label="Activity">
        {[
          ["all", "All"],
          ["clients", "Clients"],
          ["support", "Support"],
        ].map(([k, l]) => (
          <a key={k} href={`/dashboard/activity?show=${k}`} className={tab === k ? "cr-tab active" : "cr-tab"}>
            {l}
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" text="When clients cancel, reschedule or say they're running late, or support helps on your account, it shows here." />
      ) : (
        <ul className="rq-list">
          {rows.map((r, i) => (
            <li key={i} className="mn-row">
              <p className="rq-head">
                <span>
                  <strong>{r.who}</strong> · {r.what}
                </span>
                <span className={r.kind === "support" ? "badge unpaid" : "badge"}>{r.kind === "support" ? "Support" : r.kind === "you" ? "You" : "Client"}</span>
              </p>
              <p className="muted small-text">
                {when(r.at)}
                {r.detail ? ` · ${r.detail}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
