// The owner's list of recent errors (see lib/errorAlerts.js), newest first.
// Only for logins in ADMIN_EMAILS.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Errors (admin) · ${BRAND_NAME}` };

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    : "—";

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  const { data: rows, error } = await createAdminClient()
    .from("error_alerts")
    .select("signature, source, message, detail, path, count, first_seen, last_seen")
    .order("last_seen", { ascending: false })
    .limit(100);
  const list = rows || [];
  const day = Date.now() - 24 * 60 * 60 * 1000;
  const today = list.filter((r) => new Date(r.last_seen).getTime() > day).length;

  return (
    <>
      <PageHeader
        title="Errors"
        subtitle={list.length ? `${today} in the last 24 hours · last 90 days kept` : "Problems on the site, emailed to you as they happen."}
      />
      {error && (
        <p className="message error">
          Couldn&apos;t load errors: {error.message}. Run supabase/migrations/0046_error_alerts.sql if you haven&apos;t.
        </p>
      )}
      {!error && list.length === 0 && <EmptyState title="No errors" text="Nothing has broken. When something does, it shows here and you're emailed." />}
      <ul className="feedback-list">
        {list.map((r) => (
          <li key={r.signature} className="card">
            <div className="feedback-head">
              <strong>{r.source}</strong>
              <span className="badge">{r.count === 1 ? "Once" : `${r.count} times`}</span>
            </div>
            <p>{r.message}</p>
            <p className="muted small-text">
              {r.path ? `${r.path} · ` : ""}last {when(r.last_seen)}
              {r.count > 1 ? ` · first ${when(r.first_seen)}` : ""} (Central time)
            </p>
            {r.detail && (
              <details>
                <summary>Details</summary>
                <pre className="error-detail">{r.detail}</pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
