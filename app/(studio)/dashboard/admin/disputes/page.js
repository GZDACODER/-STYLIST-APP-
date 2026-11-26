// The owner's list of deposit disputes (chargebacks), newest first, with the
// evidence Clientele has for each. Only for logins in ADMIN_EMAILS.
import { getUser } from "@/lib/supabase/user";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { formatPrice } from "@/lib/money";
import { OPEN_STATUSES, evidenceRows, reasonText, statusText } from "@/lib/disputes";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Disputes (admin) · ${BRAND_NAME}` };

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function AdminDisputesPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("deposit_disputes")
    .select(
      "id, amount_cents, reason, status, evidence_due_by, created_at, booking:bookings(client_name, client_email, client_phone, service_name, booking_date, start_time, status, outcome, deposit_paid_at, cancellation_policy, created_at), stylist:stylists(business_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const list = rows || [];
  const open = list.filter((d) => OPEN_STATUSES.includes(d.status));

  return (
    <>
      <PageHeader
        title="Disputes"
        subtitle={list.length ? `${open.length} open · ${list.length} total` : "Deposit chargebacks from clients' banks."}
        actions={
          <a href="https://dashboard.stripe.com/disputes" className="button secondary small" target="_blank" rel="noreferrer">
            Open Stripe disputes
          </a>
        }
      />
      {error && (
        <p className="message error">
          Couldn&apos;t load disputes: {error.message}. Run supabase/migrations/0044_disputes.sql if you haven&apos;t.
        </p>
      )}
      {!error && list.length === 0 && <EmptyState title="No disputes" text="When a client disputes a deposit, it shows here and you're emailed." />}
      <ul className="feedback-list">
        {list.map((d) => (
          <li key={d.id} className="card">
            <div className="feedback-head">
              <strong>
                {formatPrice(d.amount_cents)} · {d.stylist?.business_name || "Unknown pro"}
              </strong>
              <span className={OPEN_STATUSES.includes(d.status) ? "badge unpaid" : d.status === "won" ? "badge paid" : "badge blocked"}>
                {statusText(d.status)}
              </span>
            </div>
            <p className="muted small-text">
              {reasonText(d.reason)} · opened {day(d.created_at)}
              {OPEN_STATUSES.includes(d.status) && d.evidence_due_by ? ` · respond by ${day(d.evidence_due_by)}` : ""} ·{" "}
              <a href={`https://dashboard.stripe.com/disputes/${d.id}`} target="_blank" rel="noreferrer">
                {d.id}
              </a>
            </p>
            <details>
              <summary>Evidence from Clientele</summary>
              <dl className="booking-facts">
                {evidenceRows(d.booking, d.stylist?.business_name).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="visit-note-text">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
