import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddClientForm from "./AddClientForm";
import ClientList from "./ClientList";
import InviteForm from "./InviteForm";
import InviteList from "./InviteList";

export const metadata = { title: "Clients · GZ Stylist App" };

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Clients who've had enough appointments become Regulars (see Settings).
  await supabase.rpc("refresh_my_regulars");

  // Invites still open, plus ones used (or made) in the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: clients, error }, { data: stylist }, { data: inviteRows }] = await Promise.all([
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
  ]);
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
            <InviteForm slug={stylist.slug} businessName={stylist.business_name} />
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
        <h2>Your clients</h2>
        <ClientList clients={clients} />
      </section>
    </>
  );
}
