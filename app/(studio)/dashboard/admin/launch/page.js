// Launch week: every pro's way to their first booking, for the owner
// (ADMIN_EMAILS). Who's stuck, for how long, and a short personal note to
// send from your own email (lib/activation.js). Test accounts hidden unless
// ?all=1.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { publicSiteUrl } from "@/lib/siteUrl";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import { STAGES, STUCK_DAYS, activation, looksLikeTest, nudge } from "@/lib/activation";

export const metadata = { title: `Launch week (admin) · ${BRAND_NAME}` };

const days = (n) => (n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`);
const ago = (n) => (n == null ? "never" : n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);
const latest = (a, b) => (!a || (b && b > a) ? b : a);
const earliest = (a, b) => (!a || (b && b < a) ? b : a);

export default async function LaunchWeekPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { all } = await searchParams;
  const showAll = all === "1";

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [stylists, services, openings, bookings, users] = await Promise.all([
    admin.from("stylists").select("id, slug, business_name, first_name, business_type, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("services").select("stylist_id, created_at").limit(10000),
    admin.from("openings").select("stylist_id, created_at").gte("opening_date", today).limit(20000),
    // Bookings clients made themselves (booked_by is their own account).
    admin.from("bookings").select("stylist_id, booked_by, created_at").not("booked_by", "is", null).neq("status", "expired").limit(20000),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const error = stylists.error || services.error || openings.error || bookings.error || users.error;

  const by = {};
  const row = (id) => (by[id] ||= { services: 0, servicesAt: null, openingsAhead: 0, openingsAt: null, clientBookings: 0, firstBookingAt: null });
  for (const s of services.data || []) { const r = row(s.stylist_id); r.services += 1; r.servicesAt = latest(r.servicesAt, s.created_at); }
  for (const o of openings.data || []) { const r = row(o.stylist_id); r.openingsAhead += 1; r.openingsAt = latest(r.openingsAt, o.created_at); }
  for (const b of bookings.data || []) {
    if (b.booked_by === b.stylist_id) continue;
    const r = row(b.stylist_id); r.clientBookings += 1; r.firstBookingAt = earliest(r.firstBookingAt, b.created_at);
  }
  const userById = new Map((users.data?.users || []).map((u) => [u.id, u]));
  const base = publicSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.clientelesuite.com");
  const now = Date.now();

  const pros = (stylists.data || []).map((s) => {
    const u = userById.get(s.id);
    const p = {
      ...row(s.id),
      id: s.id,
      email: u?.email || "",
      lastSignInAt: u?.last_sign_in_at || null,
      firstName: String(s.first_name || "").trim(),
      businessName: s.business_name,
      slug: s.slug,
      trade: s.business_type,
      createdAt: s.created_at,
    };
    const a = activation(p, now);
    const note = nudge(p, a.stage, base);
    return { ...p, ...a, test: looksLikeTest(p), mailto: `mailto:${p.email}?subject=${encodeURIComponent(note.subject)}&body=${encodeURIComponent(note.body)}` };
  });
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
        subtitle={`${list.length} ${list.length === 1 ? "pro" : "pros"} · ${stuckCount} stuck (${STUCK_DAYS}+ days on a step). Tap a note to send it from your own email.`}
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
                  <p className="muted small-text">
                    Signed up {ago(p.signedUpDays)} · last logged in {ago(p.lastSeenDays)} · {p.services} services · {p.openingsAhead} open times ahead
                  </p>
                </div>
                <div className="lw-pro-actions">
                  {p.email && (
                    <a href={p.mailto} className={`button small${p.stuck ? "" : " secondary"}`}>
                      {p.stage === "booked" ? "Ask how it's going" : "Email a nudge"}
                    </a>
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
