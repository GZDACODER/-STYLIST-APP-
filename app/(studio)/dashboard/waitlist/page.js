import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { waitlistConfigured } from "@/lib/waitlist";
import { textsEnabled } from "@/lib/notify";
import { describeWishes } from "@/lib/preferences";
import { formatDate, todayInTimeZone } from "@/lib/availability";
import WaitlistSettingsForm from "./WaitlistSettingsForm";
import PausedNote from "@/components/PausedNote";
import { getMyPlan } from "@/lib/plan";
import WaitingList from "./WaitingList";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Waitlist · ${BRAND_NAME}` };

export default async function WaitlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("timezone, waitlist_enabled, waitlist_regulars_minutes")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) redirect("/dashboard");

  const plan = await getMyPlan(supabase, user.id);

  // Waiting now, plus anyone who left the list in the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: entries, error } = await supabase
    .from("waitlist_entries")
    .select(
      "id, name, phone, email, days, times, text_ok, status, created_at, ended_at, client_status, service:services(name), offers:waitlist_offers(notified_at, booking_id, last_error, notify_attempts)"
    )
    .or(`status.eq.waiting,ended_at.gte."${since}"`)
    .order("created_at");

  if (error) {
    return <p className="message error">Couldn&apos;t load your waitlist: {error.message}</p>;
  }

  const waiting = entries.filter((e) => e.status === "waiting");
  const booked = entries.filter((e) => e.status === "booked");
  // Regulars first, then everyone else, each in the order they joined.
  waiting.sort((a, b) => (b.client_status === "regular") - (a.client_status === "regular"));

  const ready = waitlistConfigured();
  const today = todayInTimeZone(stylist.timezone);
  const dayOf = (iso) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: stylist.timezone }).format(new Date(iso));
  const whenText = (iso) => {
    const day = dayOf(iso);
    const time = new Date(iso).toLocaleTimeString("en-US", {
      timeZone: stylist.timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    return day === today ? `today at ${time}` : `${formatDate(day)} at ${time}`;
  };

  return (
    <>
      <section className="card">
        <h2>Waitlist</h2>
        {!ready && (
          <p className="message warning">
            Email isn&apos;t set up for the app yet, so clients can&apos;t join the waitlist. Add
            the email keys in Vercel (see WAITLIST_SETUP.md).
          </p>
        )}
        <p className="muted">
          When no times work, clients can join your waitlist from your booking page. When a time
          opens up (a cancellation, or new times you post), they&apos;re emailed a &quot;Claim this
          time&quot; link. First to claim it gets it, and deposits still apply.
          {textsEnabled() && " Clients who ask for texts get a text too."}
        </p>
        {!plan.has.waitlist && (
          <PausedNote feature="waitlist">
            The Waitlist add-on isn&apos;t on your plan right now, so clients can&apos;t join and
            nobody is emailed. Everyone already on it is kept.
          </PausedNote>
        )}
        <WaitlistSettingsForm
          enabled={stylist.waitlist_enabled}
          regularsMinutes={stylist.waitlist_regulars_minutes}
          allowed={plan.has.waitlist}
        />
      </section>

      <section className="card">
        <h2>Who&apos;s waiting</h2>
        {waiting.length === 0 && <p className="muted">Nobody is on your waitlist right now.</p>}
        {waiting.length > 0 && (
        <WaitingList
          entries={waiting.map((e) => {
            const told = e.offers.filter((o) => o.notified_at);
            const lastTold = told.map((o) => o.notified_at).sort().pop();
            // Messages that couldn't be sent yet, and why (from Resend or Twilio).
            const stuck = e.offers.filter((o) => !o.notified_at && o.notify_attempts > 0);
            return {
              id: e.id,
              name: e.name,
              phone: e.phone,
              email: e.email,
              textOk: e.text_ok,
              status: e.client_status,
              service: e.service?.name || "A service",
              wishes: describeWishes(e.days, e.times),
              joined: whenText(e.created_at),
              toldCount: told.length,
              lastTold: lastTold ? whenText(lastTold) : null,
              stuckCount: stuck.length,
              stuckError: stuck[0]?.last_error || null,
            };
          })}
        />
        )}
      </section>

      {booked.length > 0 && (
        <section className="card">
          <h2>Booked since joining</h2>
          <p className="muted small-text">
            Waitlisted clients who got a time in the last 30 days.
          </p>
          <ul className="service-list">
            {booked.map((e) => (
              <li key={e.id}>
                <div>
                  <div className="service-name">{e.name}</div>
                  <div className="muted">
                    {e.service?.name} · booked {whenText(e.ended_at)}
                  </div>
                </div>
                <span className="badge paid">Booked</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
