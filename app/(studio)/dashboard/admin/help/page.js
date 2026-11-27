// Admin > Help requests: pros who turned on help mode (Settings → Support).
// Open one to work in their whole dashboard, exactly as they see it, until
// their hour runs out or they end it. Owner only (ADMIN_EMAILS).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { helpState } from "@/lib/helpMode";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Help requests (admin) · ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

const time = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const NOTE = {
  done: "You're back in your account. They've been emailed a list of what changed.",
  ended: "That help session ended (the pro ended it or the hour ran out), so you're back in your account.",
  closed: "That help session has already ended.",
  busy: "Finish the account you're in first (Back to my account), then open this one.",
  failed: "Couldn't open their account. Please try again.",
};

export default async function HelpRequestsPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { note } = await searchParams;
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("help_sessions")
    .select("id, stylist_id, created_at, expires_at, entered_at, ended_at, ended_by, stylists(business_name, slug)")
    .order("created_at", { ascending: false })
    .limit(30);
  const now = Date.now();
  const open = (rows || []).filter((r) => helpState(r, now) === "open");
  const past = (rows || []).filter((r) => helpState(r, now) !== "open");

  return (
    <>
      <PageHeader
        guide="admin_help"
        eyebrow="Admin"
        title="Help requests"
        subtitle="Pros who turned on help mode. Open their dashboard, fix things, then tap Finish to come back. Every change is logged and emailed to them."
      />
      {NOTE[note] && <p className={`message ${note === "failed" || note === "busy" ? "error" : "info"}`}>{NOTE[note]}</p>}
      {error && <p className="message error">Couldn&apos;t load help requests: {error.message}</p>}

      <section className="card">
        <h2>Open now</h2>
        {open.length === 0 ? (
          <EmptyState title="Nobody's waiting" text="When a pro turns on help mode, they show here and you get an email." />
        ) : (
          <ul className="ap-log">
            {open.map((r) => (
              <li key={r.id} className="hm-row">
                <span>
                  <strong>{r.stylists?.business_name || "A pro"}</strong>
                  <span className="muted small-text"> · asked {time(r.created_at)} · open until {time(r.expires_at)}{r.entered_at ? " · you've been in" : ""}</span>
                </span>
                <a href={`/dashboard/admin/help/${r.id}/enter`} className="button small">
                  Open their account
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Recent</h2>
        {past.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="ap-log">
            {past.map((r) => (
              <li key={r.id}>
                <span className="ap-log-when">{time(r.created_at)}</span> {r.stylists?.business_name || "A pro"} ·{" "}
                {r.ended_by === "pro" ? "ended by them" : r.ended_by === "support" ? "you finished" : "hour ran out"}
                {r.entered_at ? "" : " · not opened"}{" "}
                <Link href={`/dashboard/admin/pros/${r.stylist_id}`} className="small-text">Pro page</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
