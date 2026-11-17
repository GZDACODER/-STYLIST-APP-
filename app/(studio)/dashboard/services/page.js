import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteService } from "./actions";
import AddServiceForm from "./AddServiceForm";
import SubmitButton from "@/components/SubmitButton";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import EmptyState from "@/components/dash/EmptyState";
import RowList from "@/components/dash/RowList";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
import { EXAMPLE_SERVICES, examplesOn } from "@/lib/examples";

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
  const showExamples = await examplesOn(supabase, user.id);

  return (
    <SettingsShell active="services" subtitle="What clients can book on your booking page.">
      <section className="card">
        <h2>Your services</h2>
        {error && <p className="message error">Couldn't load services: {error.message}</p>}
        {!error && services.length === 0 && !showExamples && (
          <EmptyState title="No services yet" text="Add your first one below so clients can book." />
        )}
        {!error && services.length === 0 && showExamples && (
          <>
            <p className="examples-note">Here are some examples. Add your first service below and they&apos;ll go away.</p>
            <RowList
              label="Services"
              items={EXAMPLE_SERVICES.map((s) => ({
                key: s.id,
                example: true,
                title: s.name,
                sub: `${s.price_cents ? formatPrice(s.price_cents) : "Free"} · ${formatDuration(s.duration_minutes)} · ${s.deposit}`,
                badge: <ExampleTag />,
                fullPanel: (
                  <ExampleCard
                    title={s.name}
                    facts={[
                      ["Price", s.price_cents ? formatPrice(s.price_cents) : "Free"],
                      ["Length", formatDuration(s.duration_minutes)],
                      ["Deposit", s.deposit],
                      ["Description", s.description],
                    ]}
                    addHref="/dashboard/services#add-service"
                    addLabel="+ Add your own service"
                  />
                ),
              }))}
            />
          </>
        )}
        {!error && services.length > 0 && (
          <RowList
            label="Services"
            items={services.map((service) => ({
              key: service.id,
              title: service.name,
              sub: `${formatPrice(service.price_cents)} · ${formatDuration(service.duration_minutes)}`,
              panel: (
                <>
                  <dl className="booking-facts">
                    <div>
                      <dt>Price</dt>
                      <dd>{formatPrice(service.price_cents)}</dd>
                    </div>
                    <div>
                      <dt>Length</dt>
                      <dd>{formatDuration(service.duration_minutes)}</dd>
                    </div>
                  </dl>
                  <p className="muted small-text">
                    Deposits for this service are set in <a href="/dashboard/settings/deposits">Deposits</a>.
                  </p>
                  <form action={deleteService}>
                    <input type="hidden" name="id" value={service.id} />
                    <SubmitButton className="button secondary small" pendingText="Deleting...">
                      Delete service
                    </SubmitButton>
                  </form>
                </>
              ),
            }))}
          />
        )}
      </section>

      <section className="card" id="add-service">
        <h2>Add a service</h2>
        <AddServiceForm />
      </section>
    </SettingsShell>
  );
}
