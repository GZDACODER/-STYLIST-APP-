import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { deleteService } from "./actions";
import AddServiceForm from "./AddServiceForm";
import SubmitButton from "@/components/SubmitButton";

export const metadata = { title: "Dashboard · Regulars First" };

function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .order("created_at", { ascending: true });

  return (
    <>
      <div className="header">
        <div>
          <h1>{stylist?.business_name || "Your dashboard"}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="button secondary small">
            Log out
          </button>
        </form>
      </div>

      <section className="card">
        <h2>Add a service</h2>
        <AddServiceForm />
      </section>

      <section className="card">
        <h2>Your services</h2>
        {error && <p className="message error">Couldn't load services: {error.message}</p>}
        {!error && services.length === 0 && (
          <p className="muted">No services yet. Add your first one above.</p>
        )}
        {!error && services.length > 0 && (
          <ul className="service-list">
            {services.map((service) => (
              <li key={service.id}>
                <div>
                  <div className="service-name">{service.name}</div>
                  <div className="muted">
                    {formatPrice(service.price_cents)} · {formatDuration(service.duration_minutes)}
                  </div>
                </div>
                <form action={deleteService}>
                  <input type="hidden" name="id" value={service.id} />
                  <SubmitButton className="button secondary small" pendingText="...">
                    Delete
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
