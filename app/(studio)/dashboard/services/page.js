import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteService } from "./actions";
import AddServiceForm from "./AddServiceForm";
import AftercareForm from "./AftercareForm";
import SubmitButton from "@/components/SubmitButton";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import EmptyState from "@/components/dash/EmptyState";
import RowList from "@/components/dash/RowList";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
import { exampleServices, examplesOn } from "@/lib/examples";
import { getMyTemplate } from "@/lib/templates/server";
import { setRequestFirst } from "../requests/actions";

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
  // Aftercare tips are off for some business types (tutors), or by the pro.
  const myModules = (await getMyTemplate()).modules;
  const aftercareOn = myModules.aftercare;
  const requestsOn = myModules.requests;
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
  // Aftercare tips (step 46 SQL); the form shows once it's run.
  const { data: aftercareRows, error: aftercareError } = await supabase.from("services").select("id, aftercare");
  // "Ask for a request first" (step 56 SQL).
  const { data: rfRows, error: rfError } = requestsOn
    ? await supabase.from("services").select("id, request_first")
    : { data: null, error: true };
  const requestFirstOf = rfError ? null : Object.fromEntries((rfRows || []).map((r) => [r.id, Boolean(r.request_first)]));
  const aftercareOf = aftercareError ? null : Object.fromEntries((aftercareRows || []).map((r) => [r.id, r.aftercare || ""]));

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
              items={exampleServices(await getMyTemplate()).map((s) => ({
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
                      ["Aftercare tips", s.aftercare],
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
              sub: `${formatPrice(service.price_cents)} · ${formatDuration(service.duration_minutes)}${requestFirstOf?.[service.id] ? " · Request first" : ""}`,
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
                  {requestFirstOf && (
                    <form action={setRequestFirst} className="rq-toggle">
                      <input type="hidden" name="id" value={service.id} />
                      <input type="hidden" name="on" value={requestFirstOf[service.id] ? "false" : "true"} />
                      <p className="small-text">
                        <strong>Ask for a request first:</strong> {requestFirstOf[service.id] ? "On" : "Off"}.{" "}
                        <span className="muted">
                          {requestFirstOf[service.id]
                            ? "Clients send their idea and photos; you approve before they can book."
                            : "Clients book this straight away."}
                        </span>
                      </p>
                      <SubmitButton className="button secondary small" pendingText="Saving...">
                        {requestFirstOf[service.id] ? "Let clients book directly" : "Ask for a request first"}
                      </SubmitButton>
                    </form>
                  )}
                  {aftercareOn && aftercareOf && <AftercareForm id={service.id} aftercare={aftercareOf[service.id] || ""} />}
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
