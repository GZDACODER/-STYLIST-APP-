import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddClientForm from "./AddClientForm";
import ClientList from "./ClientList";
import InviteForm from "./InviteForm";
import PausedNote from "@/components/PausedNote";
import { getMyPlan } from "@/lib/plan";
import InviteList from "./InviteList";
import ImportClients from "./ImportClients";
import { BRAND_NAME } from "@/lib/brand";
import { todayInTimeZone } from "@/lib/availability";

export const metadata = { title: `Clients · ${BRAND_NAME}` };

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Clients who've had enough appointments become Regulars (see Settings).
  await supabase.rpc("refresh_my_regulars");

  const plan = await getMyPlan(supabase, user.id);

  // Invites still open, plus ones used (or made) in the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: clients, error },
    { data: stylist },
    { data: inviteRows },
    { data: services },
    { data: series },
    { data: depositRow },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, phone, email, notes, status, auto_regular, completed_visits, invited_at")
      .order("name", { ascending: true }),
    supabase
      .from("stylists")
      .select("slug, business_name, regulars_only")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("client_invites")
      .select(
        "id, token, name, phone, created_at, expires_at, invite_state, bookings(service_name, booking_date, start_time, status)"
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, duration_minutes").order("created_at"),
    // Standing appointments (empty until the step 16 SQL is run).
    supabase
      .from("standing_series")
      .select(
        "id, client_id, interval_weeks, weekday, start_time, first_date, end_date, deposit_mode, service:services(name)"
      )
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("stylists")
      .select("timezone, deposits_enabled, stripe_charges_enabled")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const standing = {
    services: services || [],
    series: series || [],
    regularsOn: plan.has.regulars,
    depositsOn: Boolean(depositRow?.deposits_enabled && depositRow?.stripe_charges_enabled),
    today: todayInTimeZone(depositRow?.timezone || "America/Chicago"),
  };
  const invites = (inviteRows || []).filter(
    (i) => i.invite_state === "open" || i.invite_state === "used"
  );

  if (error) {
    return <p className="message error">Couldn't load your clients: {error.message}</p>;
  }

  return (
    <>
      <section className="card">
        {/* Starts open for a new stylist; tucked away once they have clients. */}
        <details className="add-client" open={clients.length === 0}>
          <summary>
            <h2>Add a client</h2>
          </summary>
          <p className="muted">
            Regulars will get first pick of your openings. Blocked clients won't be able to book.
            Add their mobile number so the booking page recognizes them.
          </p>
          <AddClientForm />
        </details>
      </section>

      <section className="card">
        <details className="add-client">
          <summary>
            <h2>Import clients</h2>
          </summary>
          <ImportClients />
        </details>
      </section>

      {stylist && (
        <section className="card">
          <details className="add-client" open={stylist.regulars_only}>
            <summary>
              <h2>Invite a new client</h2>
            </summary>
            <p className="muted">
              Make a private link for one new client and text it to them. It lets just that person
              book one appointment from your &quot;Everyone&quot; times, even when Settings is on{" "}
              &quot;Regulars only&quot;. Links work for 30 days. Once they&apos;ve booked, they
              show below as Invited.
            </p>
            {plan.has.regulars ? (
              <InviteForm slug={stylist.slug} businessName={stylist.business_name} />
            ) : (
              <PausedNote feature="regulars">
                Invite links come with Regulars First, which isn&apos;t on your plan right now.
              </PausedNote>
            )}
            {invites.length > 0 && (
              <>
                <h3 className="list-title">Your invites</h3>
                <InviteList
                  invites={invites}
                  slug={stylist.slug}
                  businessName={stylist.business_name}
                />
              </>
            )}
          </details>
        </section>
      )}

      <section className="card">
        <div className="clients-head">
          <h2>Your clients</h2>
          {clients.length > 0 && (
            // A plain link: the browser downloads the CSV file.
            <a href="/dashboard/clients/export" className="button secondary small" download>
              Export clients
            </a>
          )}
        </div>
        <ClientList clients={clients} standing={standing} />
      </section>
    </>
  );
}
