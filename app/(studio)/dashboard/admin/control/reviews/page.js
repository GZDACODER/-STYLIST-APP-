// Control Room > Reviews: reviews people have reported on public profiles.
// Hiding one takes it off the profile and out of the pro's average.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { REPORT_REASONS, stars } from "@/lib/reviews";
import PageHeader from "@/components/dash/PageHeader";
import SubmitButton from "@/components/SubmitButton";
import ControlTabs from "../ControlTabs";
import { decideReport } from "./actions";

export const metadata = { title: `Reviews · Control Room · ${BRAND_NAME}` };

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const REASON = Object.fromEntries(REPORT_REASONS);

export default async function ReviewReports({ searchParams }) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { show } = await searchParams;
  const past = show === "past";
  const admin = createAdminClient();
  let q = admin
    .from("review_reports")
    .select("id, booking_id, reason, details, reporter, status, created_at, decided_at, stylist:stylists(business_name, handle), review:visit_feedback(rating, comment, reply, hidden, booking:bookings(client_name, service_name))")
    .order("created_at", { ascending: false })
    .limit(100);
  q = past ? q.neq("status", "open") : q.eq("status", "open");
  const { data: rows, error } = await q;

  return (
    <>
      <PageHeader title="Control Room" subtitle="Reported reviews on public profiles." />
      <ControlTabs active="reviews" />
      <nav className="cr-tabs" aria-label="Reports">
        <a href="/dashboard/admin/control/reviews" className={!past ? "cr-tab active" : "cr-tab"}>
          Open
        </a>
        <a href="/dashboard/admin/control/reviews?show=past" className={past ? "cr-tab active" : "cr-tab"}>
          Decided
        </a>
      </nav>
      {error && <p className="message error">Review reports aren&apos;t set up yet (step 58 SQL).</p>}
      {!error && !rows?.length && <p className="muted">{past ? "No decided reports yet." : "No open reports. Nothing to do."}</p>}
      <ul className="rq-list">
        {(rows || []).map((r) => (
          <li key={r.id} className="card">
            <p className="rq-head">
              <span>{r.stylist?.business_name}</span>
              <span className="badge">{past ? (r.status === "hidden" ? "Hidden" : "Kept") : REASON[r.reason]?.split(" ")[1] || r.reason}</span>
            </p>
            <p className="muted small-text">
              Reported {when(r.created_at)} · {REASON[r.reason]}
              {r.reporter ? ` · by ${r.reporter}` : ""}
              {r.stylist?.handle && (
                <>
                  {" · "}
                  <a href={`/p/${r.stylist.handle}#reviews`} target="_blank" rel="noreferrer">
                    Profile
                  </a>
                </>
              )}
            </p>
            {r.details && <p className="small-text">“{r.details}”</p>}
            <p className="rq-idea">
              <span className="rv-stars">{stars(r.review?.rating || 0)}</span> {r.review?.booking?.client_name} · {r.review?.booking?.service_name}
              <br />
              {r.review?.comment}
            </p>
            {!past && (
              <div className="rq-actions">
                <div className="row">
                  <form action={decideReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="hide" />
                    <SubmitButton className="button small" pendingText="Hiding...">
                      Hide review
                    </SubmitButton>
                  </form>
                  <form action={decideReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="keep" />
                    <SubmitButton className="button small secondary" pendingText="Saving...">
                      Keep it
                    </SubmitButton>
                  </form>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
