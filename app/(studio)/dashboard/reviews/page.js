// Reviews: every rating clients have left after a visit. Written reviews are
// private until the pro chooses to show them on their public profile.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import SubmitButton from "@/components/SubmitButton";
import { ratingSummary, reviewerName, stars } from "@/lib/reviews";
import { setReviewPublic } from "./actions";
import ReplyForm from "./ReplyForm";

export const metadata = { title: `Reviews · ${BRAND_NAME}` };

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ReviewsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const tab = ["new", "public", "all"].includes(show) ? show : "new";
  const [{ data: rows, error }, { data: me }] = await Promise.all([
    supabase
      .from("visit_feedback")
      .select("booking_id, rating, comment, created_at, is_public, reply, hidden, booking:bookings(client_name, service_name, booking_date)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("stylists").select("handle, profile_on").eq("id", user.id).maybeSingle(),
  ]);
  const all = (rows || []).filter((r) => !r.hidden);
  const summary = ratingSummary(all.map((r) => r.rating));
  const written = all.filter((r) => r.comment);
  const toApprove = written.filter((r) => !r.is_public);
  const list = tab === "new" ? toApprove : tab === "public" ? written.filter((r) => r.is_public) : all;

  return (
    <>
      <PageHeader guide="reviews" title="Reviews" subtitle="Choose which reviews show on your public profile, and reply if you like." />
      {error && <p className="message error">Reviews aren&apos;t set up yet (step 58 SQL).</p>}

      <section className="card rv-summary">
        {summary.total ? (
          <>
            <p className="rv-big">
              {summary.average.toFixed(1)} <span className="rv-stars">{stars(summary.average)}</span>
            </p>
            <p className="muted small-text">
              From {summary.total} {summary.total === 1 ? "rating" : "ratings"}. Your average counts every rating, so it
              stays honest; only the written reviews you choose are shown.
            </p>
          </>
        ) : (
          <p className="muted">No ratings yet. Clients are asked for one in the email after each visit.</p>
        )}
        <p className="small-text">
          {me?.handle ? (
            <>
              Your profile: <Link href={`/p/${me.handle}`}>clientelesuite.com/p/{me.handle}</Link>
              {!me.profile_on && " (off)"}
            </>
          ) : (
            <>
              Set up your <Link href="/dashboard/settings/profile">public profile</Link> to show reviews.
            </>
          )}
        </p>
      </section>

      <nav className="cr-tabs" aria-label="Reviews">
        {[
          ["new", `To approve (${toApprove.length})`],
          ["public", `On your profile (${written.filter((r) => r.is_public).length})`],
          ["all", `All ratings (${all.length})`],
        ].map(([k, label]) => (
          <a key={k} href={`/dashboard/reviews?show=${k}`} className={tab === k ? "cr-tab active" : "cr-tab"}>
            {label}
          </a>
        ))}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "new" ? "Nothing to approve" : "Nothing here yet"}
          text={tab === "new" ? "New written reviews wait here until you choose to show them." : "Reviews will show here."}
        />
      ) : (
        <ul className="rq-list">
          {list.map((r) => (
            <li key={r.booking_id} className="card">
              <p className="rq-head">
                <span className="rv-stars">{stars(r.rating)}</span>
                {r.is_public && <span className="badge">On your profile</span>}
              </p>
              <p className="muted small-text">
                {r.booking?.client_name || "A client"} (shown as {reviewerName(r.booking?.client_name)}) · {r.booking?.service_name} ·{" "}
                {day(r.created_at)}
              </p>
              {r.comment ? <p className="rq-idea">{r.comment}</p> : <p className="muted small-text">Stars only, no written review.</p>}
              {r.reply && <p className="small-text rv-reply">Your reply: {r.reply}</p>}
              {r.comment && (
                <div className="rq-actions">
                  <div className="row">
                    <form action={setReviewPublic}>
                      <input type="hidden" name="id" value={r.booking_id} />
                      <input type="hidden" name="on" value={r.is_public ? "false" : "true"} />
                      <SubmitButton className={r.is_public ? "button small secondary" : "button small"} pendingText="Saving...">
                        {r.is_public ? "Hide from profile" : "Show on profile"}
                      </SubmitButton>
                    </form>
                    <ReplyForm id={r.booking_id} reply={r.reply} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
