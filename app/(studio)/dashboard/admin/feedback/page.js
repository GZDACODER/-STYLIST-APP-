// The owner's view of every pro's trial feedback, newest first. Only for
// the logins in ADMIN_EMAILS (Vercel); everyone else gets "not found".
import { getUser } from "@/lib/supabase/user";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import { KEEP_USING, RATINGS } from "../../feedback/questions";

export const metadata = { title: `Feedback (admin) · ${BRAND_NAME}` };

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("trial_feedback")
    .select("id, created_at, rating, keep_using, needs_update, easier, notes, trial_day, stylist:stylists(business_name, slug)")
    .order("created_at", { ascending: false })
    .limit(500);

  const list = rows || [];
  const average = list.length ? (list.reduce((s, r) => s + (r.rating || 0), 0) / list.length).toFixed(1) : null;
  const keep = Object.fromEntries(KEEP_USING.map((k) => [k.value, list.filter((r) => r.keep_using === k.value).length]));

  return (
    <>
      <PageHeader
        title="Trial feedback"
        subtitle={
          list.length
            ? `${list.length} response${list.length === 1 ? "" : "s"} · average ${average}/5 · ${KEEP_USING.map((k) => `${k.label}: ${keep[k.value]}`).join(" · ")}`
            : "Answers from pros in their free trial."
        }
      />
      {error && (
        <p className="message error">
          Couldn&apos;t load feedback: {error.message}. Run supabase/migrations/0043_trial_feedback.sql if you haven&apos;t.
        </p>
      )}
      {!error && list.length === 0 && (
        <EmptyState title="No feedback yet" text="Pros are asked from day 3 of their trial. New answers are also emailed to you." />
      )}
      <ul className="feedback-list">
        {list.map((r) => (
          <li key={r.id} className="card">
            <div className="feedback-head">
              <strong>{r.stylist?.business_name || "A pro"}</strong>
              <span className="badge">{r.rating}/5 · {RATINGS.find((x) => x.value === r.rating)?.label}</span>
            </div>
            <p className="muted small-text">
              {when(r.created_at)}
              {r.trial_day ? ` · trial day ${r.trial_day}` : ""}
              {r.keep_using ? ` · keep using: ${KEEP_USING.find((k) => k.value === r.keep_using)?.label}` : ""}
              {r.stylist?.slug ? ` · /book/${r.stylist.slug}` : ""}
            </p>
            <dl className="booking-facts">
              <div>
                <dt>Needs updating</dt>
                <dd>{r.needs_update || "—"}</dd>
              </div>
              <div>
                <dt>Would make life easier</dt>
                <dd>{r.easier || "—"}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd className="visit-note-text">{r.notes || "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
