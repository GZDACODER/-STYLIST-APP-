import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddClientForm from "./AddClientForm";
import ClientList from "./ClientList";

export const metadata = { title: "Clients · GZ Stylist App" };

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Clients who've had enough appointments become Regulars (see Settings).
  await supabase.rpc("refresh_my_regulars");

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, notes, status, auto_regular, completed_visits")
    .order("name", { ascending: true });

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
        <h2>Your clients</h2>
        <ClientList clients={clients} />
      </section>
    </>
  );
}
