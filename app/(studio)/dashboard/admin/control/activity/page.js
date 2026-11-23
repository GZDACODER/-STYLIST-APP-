// The Control Room's Activity tab: what's happening across every pro.
// Money, the sign-up funnel, pros who could use a nudge, every pro in one
// table, and a live feed. Clients appear only as counts and first names.
// Data from ops_activity() (supabase/migrations/0053_control_room_activity.sql).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails, isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import { clockTime } from "@/lib/availability";
import PageHeader from "@/components/dash/PageHeader";
import ControlTabs from "../ControlTabs";

export const metadata = { title: `Activity · Control Room · ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const TEST_EMAIL = /\+(claude|run\d*|client)@/i;
const TEST_NAME = /^(claude .*studio|launch test studio)$/i;
// Accounts that aren't working pros (friends looking around the site), by
// Pro ID: kept out of the numbers like test accounts, marked "Viewer".
const VIEWER_CODES = new Set(["CL-PX3Q"]); // Fast Money Media LLC

function ago(iso) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const shortDate = (d) =>
  new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const money = (cents) => formatPrice(Math.round(cents)).replace(/\.00$/, "");

// What a pro pays each month (yearly plans spread over 12 months).
function monthly(p) {
  if (!p.paying || !["active", "past_due", "trialing"].includes(p.stripe_status || "")) return 0;
  const per = (plan) => (p.interval === "year" ? plan.yearlyCents / 12 : plan.monthlyCents);
  return per(PLANS.allin) + (p.team_members || 0) * per(PLANS.team) + (p.assistant ? per(PLANS.assistant) : 0);
}

function planLabel(p) {
  if (p.comped) return { text: "Founding", tone: "ok" };
  if (p.paying && p.stripe_status === "past_due") return { text: "Payment failed", tone: "fail" };
  if (p.paying) return { text: p.interval === "year" ? "Paying · yearly" : "Paying", tone: "ok" };
  if (p.trial_ends_at && new Date(p.trial_ends_at) > new Date()) {
    const days = Math.ceil((new Date(p.trial_ends_at) - Date.now()) / DAY);
    return { text: `Trial · ${days}d left`, tone: days <= 3 ? "warn" : "ok" };
  }
  return { text: "Trial over", tone: "fail" };
}

function setupSteps(p) {
  return [
    { done: p.services > 0, label: "Services" },
    { done: p.hours > 0, label: "Hours" },
    { done: p.stripe, label: "Stripe" },
    { done: p.cover, label: "Cover photo" },
    { done: p.bookings_total > 0, label: "First booking" },
  ];
}

// Pros who could use a message from you, and why.
function nudges(p) {
  const age = (Date.now() - new Date(p.created_at).getTime()) / DAY;
  const out = [];
  if (p.services === 0 && age > 2) out.push("signed up but hasn't added services");
  else if (p.services > 0 && p.hours > 0 && p.bookings_total === 0 && age > 7) out.push("set up but no bookings yet: maybe help them share their link");
  if (p.last_sign_in && Date.now() - new Date(p.last_sign_in).getTime() > 14 * DAY) out.push(`hasn't logged in for ${Math.round((Date.now() - new Date(p.last_sign_in).getTime()) / DAY)} days`);
  const plan = planLabel(p);
  if (plan.tone === "warn") out.push(`trial ends soon (${plan.text.replace("Trial · ", "")}) and not paying yet`);
  if (plan.text === "Payment failed") out.push("their payment failed");
  return out;
}

function feedLine(e) {
  const when = e.date ? `${shortDate(e.date)}${e.time ? ` at ${clockTime(e.time)}` : ""}` : "";
  switch (e.kind) {
    case "signup":
      return <><strong>{e.pro}</strong> signed up</>;
    case "booking":
      return (
        <>
          {e.client || "A client"} booked <strong>{e.service}</strong> with {e.pro} for {when}
          {e.deposit > 0 ? ` · ${money(e.deposit)} deposit paid` : ""}
        </>
      );
    case "cancelled":
      return <>{e.client || "A client"}&apos;s {e.service} with {e.pro} ({when}) was cancelled</>;
    case "waitlist":
      return <>Waitlist match: a client claimed {e.pro}&apos;s opening on {when}</>;
    default:
      return e.kind;
  }
}

export default async function ActivityPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  const { tests: showTestsParam } = await searchParams;
  const showTests = showTestsParam === "1";
  const { data, error } = await createAdminClient().rpc("ops_activity");
  // Your own account(s) (ADMIN_EMAILS) are for building the site, not a pro
  // using it: kept out of the numbers like test accounts, marked "You".
  const owners = new Set(adminEmails().map((e) => e.toLowerCase()));
  const all = (data?.pros || []).map((p) => {
    const you = owners.has(String(p.email || "").toLowerCase());
    const viewer = VIEWER_CODES.has(p.pro_code);
    return { ...p, you, viewer, test: you || viewer || TEST_EMAIL.test(p.email || "") || TEST_NAME.test(p.business_name || "") };
  });
  const testCount = all.filter((p) => p.test).length;
  const pros = showTests ? all : all.filter((p) => !p.test);
  const testNames = new Set(all.filter((p) => p.test).map((p) => p.business_name));
  const feed = (data?.feed || []).filter((e) => showTests || !testNames.has(e.pro)).slice(0, 30);

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const stripeLive = stripeKey.startsWith("sk_live") || stripeKey.startsWith("rk_live");
  const paying = pros.filter((p) => monthly(p) > 0);
  const mrr = paying.reduce((sum, p) => sum + monthly(p), 0);
  const inTrial = pros.filter((p) => !p.paying && !p.comped && p.trial_ends_at && new Date(p.trial_ends_at) > new Date());
  const endingSoon = inTrial.filter((p) => new Date(p.trial_ends_at) - Date.now() < 7 * DAY);
  const newThisWeek = pros.filter((p) => Date.now() - new Date(p.created_at).getTime() < 7 * DAY).length;

  const funnel = [
    { label: "Signed up", n: pros.length },
    { label: "Added services and hours", n: pros.filter((p) => p.services > 0 && p.hours > 0).length },
    { label: "Got a first booking", n: pros.filter((p) => p.bookings_total > 0).length },
    { label: "Paying (or founding)", n: pros.filter((p) => p.comped || monthly(p) > 0).length },
  ];
  const needs = pros.map((p) => ({ p, why: nudges(p) })).filter((x) => x.why.length);

  return (
    <>
      <PageHeader
        eyebrow="Control Room"
        title="Activity"
        subtitle={`Across every pro · ${showTests ? "including" : "not counting"} yours, viewers and tests (${testCount})`}
        actions={
          testCount > 0 ? (
            <Link href={showTests ? "/dashboard/admin/control/activity" : "/dashboard/admin/control/activity?tests=1"} className="button small secondary">
              {showTests ? "Hide them" : "Show all accounts"}
            </Link>
          ) : null
        }
      />
      <ControlTabs active="activity" />

      {error && <p className="message error">Couldn&apos;t load activity: {error.message}. Run supabase/migrations/0053_control_room_activity.sql.</p>}

      <section className="cr-grid" aria-label="Money">
        <div className="home-card cr-tile">
          <span className="db-label">Paying pros</span>
          <strong className="home-card-value">{paying.length}</strong>
          <span className="muted small-text">
            of {pros.length} · {inTrial.length} in trial · {pros.filter((p) => p.comped).length} founding
          </span>
        </div>
        <div className="home-card cr-tile">
          <span className="db-label">Monthly revenue</span>
          <strong className="home-card-value">{money(mrr)}</strong>
          <span className="muted small-text">
            {stripeLive ? "Estimated from plans · yearly spread over 12 months" : "Stripe is in test mode: test payments, not real money"}
          </span>
        </div>
        <div className="home-card cr-tile">
          <span className="db-label">Deposits, 30 days</span>
          <strong className="home-card-value">{money(data?.deposits_30d || 0)}</strong>
          <span className="muted small-text">
            Paid by clients, all pros · {data?.no_shows_30d || 0} no-shows · {data?.cancelled_30d || 0} cancelled
          </span>
        </div>
        <div className={`home-card cr-tile${endingSoon.length ? " is-warn" : ""}`}>
          <span className="db-label">Trials ending this week</span>
          <strong className="home-card-value">{endingSoon.length}</strong>
          <span className="muted small-text">{newThisWeek} new {newThisWeek === 1 ? "pro" : "pros"} this week</span>
        </div>
      </section>

      <div className="home-grid">
        <section className="card">
          <h2>Funnel</h2>
          <ol className="cr-funnel">
            {funnel.map((f, i) => {
              const pct = funnel[0].n ? Math.round((f.n / funnel[0].n) * 100) : 0;
              return (
                <li key={f.label}>
                  <div className="cr-meter-text">
                    <span>{f.label}</span>
                    <span className="muted small-text">
                      {f.n}
                      {i > 0 ? ` · ${pct}%` : ""}
                    </span>
                  </div>
                  <div className="cr-meter" aria-hidden="true">
                    <span style={{ width: `${Math.max(pct, f.n ? 2 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="muted small-text">The biggest drop between two steps is where pros get stuck.</p>
        </section>

        <section className="card">
          <h2>Could use a nudge</h2>
          {needs.length === 0 ? (
            <p className="muted">Nobody right now. Everyone is set up and active.</p>
          ) : (
            <ul className="cr-list cr-nudges">
              {needs.map(({ p, why }) => (
                <li key={p.id}>
                  <strong>{p.business_name}</strong>
                  {p.email && (
                    <>
                      {" "}
                      · <a href={`mailto:${p.email}`}>email them</a>
                    </>
                  )}
                  <br />
                  <span className="muted small-text">{why.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Every pro</h2>
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Plan</th>
                <th>Setup</th>
                <th>Bookings 7d / 30d</th>
                <th>Coming up</th>
                <th>Clients</th>
                <th>Last login</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {pros.map((p) => {
                const plan = planLabel(p);
                const steps = setupSteps(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <a href={`/book/${p.slug}`} target="_blank" rel="noreferrer">
                        {p.business_name}
                      </a>
                      {p.test && <span className="badge cr-test">{p.you ? "You" : p.viewer ? "Viewer" : "Test"}</span>}
                      <br />
                      <span className="muted small-text">
                        {p.pro_code}
                        {p.business_type ? ` · ${p.business_type}` : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`cr-word ${plan.tone}`}>{plan.text}</span>
                    </td>
                    <td>
                      <span className="cr-steps" title={steps.map((s) => `${s.label}: ${s.done ? "done" : "not yet"}`).join(", ")}>
                        {steps.map((s) => (
                          <span key={s.label} className={s.done ? "cr-step done" : "cr-step"} />
                        ))}
                      </span>
                      <span className="muted small-text"> {steps.filter((s) => s.done).length}/5</span>
                    </td>
                    <td>
                      {p.bookings_7d} / {p.bookings_30d}
                    </td>
                    <td>{p.upcoming}</td>
                    <td>{p.clients}</td>
                    <td className="muted small-text">{ago(p.last_sign_in)}</td>
                    <td className="muted small-text">{shortDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small-text">Setup squares: services, hours, Stripe, cover photo, first booking.</p>
      </section>

      <section className="card">
        <h2>Live feed</h2>
        {feed.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="cr-feed">
            {feed.map((e, i) => (
              <li key={i}>
                <span className={`cr-feed-kind ${e.kind}`}>{e.kind === "signup" ? "New pro" : e.kind === "waitlist" ? "Waitlist" : e.kind === "cancelled" ? "Cancelled" : "Booking"}</span>
                <span className="cr-feed-text">{feedLine(e)}</span>
                <span className="muted small-text cr-feed-when">{ago(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small-text">Clients are shown by first name only. Refresh to update.</p>
      </section>
    </>
  );
}
