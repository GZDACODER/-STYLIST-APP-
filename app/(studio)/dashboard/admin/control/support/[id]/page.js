// Control Room > Support > one account: what the pro has set up, so the team
// can help. Only while the pro's support access is on; opening it is logged
// and emailed to them (once an hour), and edit tools show only with "edit".
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { formatPrice } from "@/lib/money";
import { clockTime, formatDate, todayInTimeZone } from "@/lib/availability";
import { logSupport, supportState } from "@/lib/support";
import PageHeader from "@/components/dash/PageHeader";
import ControlTabs from "../../ControlTabs";
import { ServiceForm, TaglineForm } from "../SupportForms";

export const metadata = { title: `Support · Control Room · ${BRAND_NAME}`, robots: { index: false } };
export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SupportAccount({ params }) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const access = await supportState(id);
  if (!access)
    return (
      <>
        <PageHeader title="Control Room" />
        <ControlTabs active="support" />
        <p className="message info">Support access is off for this account, so it can&apos;t be opened.</p>
        <Link href="/dashboard/admin/control/support">Back</Link>
      </>
    );
  const admin = createAdminClient();
  const { data: s } = await admin.from("stylists").select("business_name, first_name, pro_code, slug, handle, business_type, timezone, tagline, profile_on, regulars_only, deposits_enabled, stripe_charges_enabled").eq("id", id).maybeSingle();
  if (!s) notFound();
  await logSupport({ stylistId: id, action: "Opened your account", detail: access.level === "edit" ? "View and edit access" : "View-only access", level: "view" });
  const today = todayInTimeZone(s.timezone || "America/Chicago");
  const [{ data: services }, { data: hours }, { data: upcoming }, { data: log }] = await Promise.all([
    admin.from("services").select("id, name, price_cents, duration_minutes, request_first").eq("stylist_id", id).order("created_at"),
    admin.from("working_hours").select("weekday, is_working, start_time, end_time").eq("stylist_id", id).order("weekday"),
    admin.from("bookings").select("booking_date, start_time, service_name, client_name, status").eq("stylist_id", id).eq("status", "confirmed").gte("booking_date", today).order("booking_date").order("start_time").limit(10),
    admin.from("support_log").select("created_at, actor, action, detail").eq("stylist_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  const edit = access.level === "edit";

  return (
    <>
      <PageHeader title={s.business_name} subtitle={`Support view · ${edit ? "view and edit" : "view only"} · logged and emailed to the pro`} />
      <ControlTabs active="support" />
      <section className="card">
        <h2>Account</h2>
        <dl className="mn-lines">
          {[
            ["Owner", s.first_name || "–"],
            ["Pro ID", s.pro_code],
            ["Type", s.business_type || "hair"],
            ["Time zone", s.timezone],
            ["Regulars-only", s.regulars_only ? "On" : "Off"],
            ["Deposits", s.deposits_enabled ? (s.stripe_charges_enabled ? "On (Stripe ready)" : "On (Stripe not ready)") : "Off"],
            ["Public profile", s.profile_on ? `On (/p/${s.handle})` : "Off"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="small-text">
          <a href={`/book/${s.slug}`} target="_blank" rel="noreferrer">
            Open their booking page
          </a>
        </p>
        {edit && <TaglineForm stylistId={id} tagline={s.tagline} />}
      </section>

      <section className="card">
        <h2>Services</h2>
        {(services || []).length === 0 && <p className="muted small-text">No services.</p>}
        <ul className="rq-list">
          {(services || []).map((sv) => (
            <li key={sv.id} className="mn-row">
              {edit ? (
                <ServiceForm stylistId={id} s={sv} />
              ) : (
                <p className="rq-head">
                  <span>{sv.name}</span>
                  <span>
                    {formatPrice(sv.price_cents)} · {sv.duration_minutes} min{sv.request_first ? " · request first" : ""}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Hours</h2>
        <dl className="mn-lines">
          {(hours || []).map((h) => (
            <div key={h.weekday}>
              <dt>{DAYS[h.weekday]}</dt>
              <dd>{h.is_working ? `${clockTime(h.start_time)} – ${clockTime(h.end_time)}` : "Off"}</dd>
            </div>
          ))}
        </dl>
        {!hours?.length && <p className="muted small-text">No weekly hours (openings only).</p>}
      </section>

      <section className="card">
        <h2>Next bookings</h2>
        {(upcoming || []).length === 0 ? (
          <p className="muted small-text">None.</p>
        ) : (
          <ul className="cr-checks">
            {upcoming.map((b, i) => (
              <li key={i}>
                <span>
                  {formatDate(b.booking_date)} {clockTime(b.start_time)} · {b.service_name} · {String(b.client_name || "").split(" ")[0]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Support log (what the pro sees)</h2>
        <ul className="cr-checks">
          {(log || []).map((l, i) => (
            <li key={i}>
              <span>
                <strong>{l.action}</strong>
                {l.detail ? <span className="muted small-text"> · {l.detail}</span> : null}
                <br />
                <span className="muted small-text">
                  {new Date(l.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} · {l.actor}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
