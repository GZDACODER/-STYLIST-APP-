import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddClientForm from "./AddClientForm";
import ClientList from "./ClientList";
import InviteForm from "./InviteForm";
import PausedNote from "@/components/PausedNote";
import { getMyPlan } from "@/lib/plan";
import InviteList from "./InviteList";
import ImportClients from "./ImportClients";
import PageHeader from "@/components/dash/PageHeader";
import { exampleData, examplesOn } from "@/lib/examples";
import RowList from "@/components/dash/RowList";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
import { BRAND_NAME } from "@/lib/brand";
import { todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";

export const metadata = { title: `Clients · ${BRAND_NAME}` };

export default async function ClientsPage({ searchParams }) {
  const { add } = await searchParams;
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
      .select(
        "id, name, phone, email, notes, status, auto_regular, completed_visits, invited_at, created_at"
      )
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
  const timeZone = depositRow?.timezone || "America/Chicago";

  // Each client's next appointment, for the slim rows in the list.
  const today = todayInTimeZone(timeZone);
  const { data: upcomingRows } = await supabase
    .from("bookings")
    .select("client_id, booking_date, start_time, service_name")
    .eq("status", "confirmed")
    .not("client_id", "is", null)
    .gte("booking_date", today)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(2000);
  const now = nowLocal(timeZone);
  const nextVisits = {};
  const upcomingCounts = {};
  for (const b of upcomingRows || []) {
    if (`${b.booking_date}T${String(b.start_time).slice(0, 5)}` < now) continue;
    upcomingCounts[b.client_id] = (upcomingCounts[b.client_id] || 0) + 1;
    nextVisits[b.client_id] ??= {
      date: b.booking_date,
      time: String(b.start_time).slice(0, 5),
      service: b.service_name,
    };
  }

  // Example clients for a new pro (shown until they have real ones).
  const examples = clients.length === 0 && (await examplesOn(supabase, user.id)) ? exampleData(todayInTimeZone(timeZone)).clients : [];
  for (const e of examples) {
    const next = exampleData(todayInTimeZone(timeZone)).upcoming.find((b) => b.client_name === e.name);
    if (next) nextVisits[e.id] = { date: next.booking_date, time: next.start_time.slice(0, 5), service: next.service_name };
  }

  const standing = {
    services: services || [],
    series: series || [],
    regularsOn: plan.has.regulars,
    depositsOn: Boolean(depositRow?.deposits_enabled && depositRow?.stripe_charges_enabled),
    today,
  };
  const invites = (inviteRows || []).filter(
    (i) => i.invite_state === "open" || i.invite_state === "used"
  );

  if (error) {
    return <p className="message error">Couldn't load your clients: {error.message}</p>;
  }

  const addOpen = add === "client" || (clients.length === 0 && examples.length === 0);
  const addClient = (
    <section className="card" id="add-client">
      {/* Open for a new stylist or from "+ Add client"; tucked away otherwise. */}
      <details className="add-client" open={addOpen}>
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
  );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} ${clients.length === 1 ? "client" : "clients"}`}
        actions={
          <>
            {clients.length > 0 && (
              // A plain link: the browser downloads the CSV file.
              <a href="/dashboard/clients/export" className="button secondary small" download>
                Export
              </a>
            )}
            {stylist && (
              <a href="/dashboard/clients?add=invite#invite" className="button secondary small">
                Invite
              </a>
            )}
            <a href="/dashboard/clients?add=client#add-client" className="button small">
              + Add client
            </a>
          </>
        }
      />

      {addOpen && addClient}

      <section className="card">
        <ClientList
          clients={clients}
          standing={standing}
          nextVisits={nextVisits}
          examples={examples}
          upcomingCounts={upcomingCounts}
        />
      </section>

      {!addOpen && addClient}

      <section className="card">
        <details className="add-client">
          <summary>
            <h2>Import clients</h2>
          </summary>
          <ImportClients />
        </details>
      </section>

      {stylist && (
        <section className="card" id="invite">
          <details className="add-client" open={add === "invite" || stylist.regulars_only}>
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
                Your plan is paused, so new invite links can&apos;t be made.
              </PausedNote>
            )}
            {invites.length === 0 && examples.length > 0 && (
              <>
                <h3 className="list-title">Your invites</h3>
                <RowList
                  label="Clients"
                  items={[
                    {
                      key: "example-invite-1",
                      example: true,
                      title: "Jordan Lee",
                      sub: "(555) 010-0167 · Link not used yet · works for 30 days",
                      badge: <ExampleTag />,
                      fullPanel: (
                        <ExampleCard
                          title="Invite for Jordan Lee"
                          facts={[
                            ["Link", `/book/${stylist.slug}?invite=…`],
                            ["Works for", "One booking from your Everyone times, within 30 days"],
                            ["Status", "Sent, not used yet"],
                          ]}
                          addHref="/dashboard/clients?add=invite#invite"
                          addLabel="Make a real invite link"
                        />
                      ),
                    },
                  ]}
                />
              </>
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
    </>
  );
}
