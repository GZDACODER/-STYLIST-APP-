// Following you: clients who asked for opening alerts from the pro's public
// profile (step 60 SQL). Alerts go out automatically when new times open.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Following you · ${BRAND_NAME}` };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function wantsText(f, serviceName) {
  if (f.wants === "times") {
    const days = [...(f.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY[d]);
    return [days.join(", "), (f.parts || []).join(", ")].filter(Boolean).join(" · ") || "Any opening";
  }
  if (f.wants === "services") return (f.service_ids || []).map(serviceName).filter(Boolean).join(", ") || "Any opening";
  return "Any opening";
}

export default async function FollowersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: rows, error }, { data: services }, { data: me }] = await Promise.all([
    supabase
      .from("profile_followers")
      .select("id, name, email, phone, wants, days, parts, service_ids, verified_at, unsubscribed_at, last_alert_at, alerts_sent, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("services").select("id, name"),
    supabase.from("stylists").select("handle, profile_on, waitlist_regulars_minutes").eq("id", user.id).maybeSingle(),
  ]);
  const nameOf = Object.fromEntries((services || []).map((s) => [s.id, s.name]));
  const active = (rows || []).filter((f) => f.verified_at && !f.unsubscribed_at);

  return (
    <>
      <PageHeader guide="followers" title="Following you" subtitle="Clients who asked to hear when you have openings." />
      {error && <p className="message error">Opening alerts aren&apos;t set up yet (step 60 SQL).</p>}
      <section className="card">
        <p className="rv-big">{active.length}</p>
        <p className="muted small-text">
          {active.length === 1 ? "person is" : "people are"} following you. When you post openings or a time frees up,
          they get an email for the times they want. Regulars get it first, then everyone else{" "}
          {me?.waitlist_regulars_minutes ? `${me.waitlist_regulars_minutes} minutes later` : "right after"} (your head start
          in <Link href="/dashboard/settings/regulars">Regulars</Link>). Nobody gets more than one alert every few hours.
        </p>
        {!me?.profile_on && (
          <p className="small-text">
            Clients follow you from your <Link href="/dashboard/settings/profile">public profile</Link>, which is off right now.
          </p>
        )}
      </section>
      {active.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No followers yet"
          text="Share your profile link: clients tap 'Notify me of openings' to follow you."
          action={
            <Link href="/dashboard/share" className="button small secondary">
              Open Share kit
            </Link>
          }
        />
      ) : (
        <ul className="rq-list">
          {active.map((f) => (
            <li key={f.id} className="card">
              <p className="rq-head">
                <strong>{f.name}</strong>
                <span className="badge">{wantsText(f, (id) => nameOf[id])}</span>
              </p>
              <p className="muted small-text">
                <a href={`mailto:${f.email}`}>{f.email}</a>
                {f.phone ? ` · ${f.phone}` : ""} · following since {day(f.created_at)}
                {f.alerts_sent ? ` · ${f.alerts_sent} ${f.alerts_sent === 1 ? "alert" : "alerts"} sent` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
