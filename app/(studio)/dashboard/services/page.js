import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteService } from "./actions";
import AddServiceForm from "./AddServiceForm";
import SubmitButton from "@/components/SubmitButton";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Services · ${BRAND_NAME}` };

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

export default async function ServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .order("created_at", { ascending: true });

  return (
    <SettingsShell active="services" subtitle="What clients can book on your booking page.">
      <section className="card">
        <h2>Your services</h2>
        {error && <p className="message error">Couldn't load services: {error.message}</p>}
        {!error && services.length === 0 && (
          <EmptyState title="No services yet" text="Add your first one below so clients can book." />
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

      <section className="card" id="add-service">
        <h2>Add a service</h2>
        <AddServiceForm />
      </section>
    </SettingsShell>
  );
}
