// Settings → Support access: off by default. While it's on, the Clientele
// team may help on this account; every change they make is logged here.
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";
import SupportAccessForm from "../SupportAccessForm";
import { DataSection } from "../parts/data";

export const metadata = { title: `Privacy & support · ${BRAND_NAME}` };

const when = (iso, zone) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: zone });

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: access, error: accessError }, { data: log }] = await Promise.all([
    supabase.from("support_access").select("until, level").eq("stylist_id", user.id).maybeSingle(),
    supabase.from("support_log").select("created_at, actor, action, detail").eq("stylist_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const { data: me } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  const zone = me?.timezone || "America/Chicago";
  const until = access?.until && new Date(access.until) > new Date() ? access.until : null;
  const forever = until && new Date(until).getFullYear() - new Date().getFullYear() > 5;

  return (
    <SettingsShell active="support" subtitle="Off unless you turn it on.">
      <section className="card">
        <h2>Support access</h2>
        <p>
          The Clientele team and the Assistant never change your settings, business type or data without your
          permission. If you&apos;d like us to help on your account, turn this on for a while. You can turn it off any
          time, and every change made while it&apos;s on is listed below.
        </p>
        {accessError ? (
          <p className="message error">Support access isn&apos;t set up yet (step 51 SQL).</p>
        ) : (
          <>
            <p className={until ? "message success" : "message info"}>
              {until
                ? `On (${access.level === "edit" ? "view and edit" : "view only"}) ${forever ? "until you turn it off" : `until ${when(until, zone)}`}.`
                : "Off. Nobody from Clientele can see or change anything on your account."}
            </p>
            <SupportAccessForm on={Boolean(until)} level={access?.level} />
            <p className="muted small-text">
              Every time the team opens your account or changes something, it&apos;s listed below and on your{" "}
              <a href="/dashboard/activity">Activity</a> page, and we email you.
            </p>
          </>
        )}
      </section>
      <section className="card">
        <h2>What support has done</h2>
        {(log || []).length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="cr-checks">
            {log.map((l, i) => (
              <li key={i}>
                <span>
                  <strong>{l.action}</strong>
                  {l.detail ? <span className="muted small-text"> · {l.detail}</span> : null}
                  <br />
                  <span className="muted small-text">
                    {when(l.created_at, zone)} · {l.actor}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div id="data">
        <DataSection />
      </div>
    </SettingsShell>
  );
}
