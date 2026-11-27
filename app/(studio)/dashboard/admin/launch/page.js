// Launch week: every pro's way to their first booking, for the owner
// (ADMIN_EMAILS). Who's stuck, for how long, and a short personal note to
// send from your own email (lib/activation.js). Test accounts hidden unless
// ?all=1.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import { STAGES, STUCK_DAYS } from "@/lib/activation";
import { loadPros, siteBase } from "./data";
import SendNudge from "./SendNudge";

export const metadata = { title: `Launch week (admin) · ${BRAND_NAME}` };

const days = (n) => (n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`);
const ago = (n) => (n == null ? "never" : n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

export default async function LaunchWeekPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { all } = await searchParams;
  const showAll = all === "1";

  const { pros, error } = await loadPros();
  const base = siteBase();
  const hidden = pros.filter((p) => p.test).length;
  const list = (showAll ? pros : pros.filter((p) => !p.test)).sort(
    (a, b) => Number(b.stuck) - Number(a.stuck) || (a.stuck && b.stuck ? b.daysStuck - a.daysStuck : 0) || a.step - b.step || b.createdAt.localeCompare(a.createdAt)
  );
  const counts = STAGES.map((s) => list.filter((p) => p.stage === s.key).length);
  const stuckCount = list.filter((p) => p.stuck).length;

  return (
    <>
      <PageHeader
        guide="admin_launch"
        title="Launch week"
        subtitle={`${list.length} ${list.length === 1 ? "pro" : "pros"} · ${stuckCount} stuck (${STUCK_DAYS}+ days on a step). Send a note from hello@clientelesuite.com, or write your own.`}
        actions={
          <Link href={showAll ? "/dashboard/admin/launch" : "/dashboard/admin/launch?all=1"} className="button small secondary">
            {showAll ? "Hide test accounts" : `Show test accounts (${hidden})`}
          </Link>
        }
      />
      {error && <p className="message error">Couldn&apos;t load everything: {error.message}</p>}

      <section className="lw-funnel" aria-label="Pros at each step">
        {STAGES.map((s, i) => (
          <div key={s.key} className="card lw-step">
            <p className="lw-step-label">{s.label}</p>
            <p className="lw-step-count">{counts[i]}</p>
            <p className="muted small-text">{s.key === "booked" ? "Have a client booking" : `Next: ${s.next}`}</p>
          </div>
        ))}
      </section>

      {list.length === 0 ? (
        <EmptyState title="No pros yet" text="New signups show here with where they are and a note to send them." />
      ) : (
        <ul className="lw-list">
          {list.map((p) => {
            const stage = STAGES[p.step];
            return (
              <li key={p.id} className={`card lw-pro${p.stuck ? " is-stuck" : ""}`}>
                <div className="lw-pro-main">
                  <p className="lw-pro-name">
                    {p.businessName}
                    {p.test && <span className="badge">Test</span>}
                  </p>
                  <p className="muted small-text">
                    {[p.firstName, p.email, p.trade || "no trade"].filter(Boolean).join(" · ")}
                  </p>
                  <ol className="lw-dots" aria-label={`Step ${p.step + 1} of ${STAGES.length}: ${stage.label}`}>
                    {STAGES.map((s, i) => (
                      <li key={s.key} className={i <= p.step ? "on" : ""} title={s.label} />
                    ))}
                  </ol>
                  <p className="small-text">
                    <strong>{stage.label}</strong>
                    {p.stage === "booked"
                      ? ` · ${p.clientBookings} client ${p.clientBookings === 1 ? "booking" : "bookings"}`
                      : ` · ${days(p.daysStuck)} on this step · next: ${stage.next}`}
                  </p>
                  {p.nudged && (
                    <p className="small-text lw-nudged">Nudged {ago(Math.floor((Date.now() - Date.parse(p.nudged.sent_at)) / 86400000))}</p>
                  )}
                  <p className="muted small-text">
                    Signed up {ago(p.signedUpDays)} · last logged in {ago(p.lastSeenDays)} · {p.services} services · {p.openingsAhead} open times ahead
                  </p>
                </div>
                <div className="lw-pro-actions">
                  {p.email && (
                    <SendNudge
                      id={p.id}
                      mailto={p.mailto}
                      subject={p.note.subject}
                      primary={p.stuck}
                      label={p.stage === "booked" ? "Ask how it's going" : "Send nudge"}
                    />
                  )}
                  <a href={`${base}/book/${p.slug}`} target="_blank" rel="noreferrer" className="small-text">
                    Booking page
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
