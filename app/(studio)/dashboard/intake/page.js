// Settings -> Intake form & waiver.
import { getUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import IntakeBuilder from "./IntakeBuilder";
import SettingsShell from "@/components/dash/SettingsShell";
import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleTag } from "@/components/dash/Example";
import { getMyTemplate } from "@/lib/templates/server";
import Words from "@/components/Words";

export const metadata = { title: `Intake form & waiver · ${BRAND_NAME}` };

export default async function IntakePage() {
  // The starter waiver for the pro's business type (lib/templates).
  const tplForWaiver = await getMyTemplate();
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ data: form, error }, { data: services, error: serviceError }] = await Promise.all([
    supabase.from("intake_forms").select("questions, waiver_text, version, waiver_frequency, waiver_timing").maybeSingle(),
    supabase.from("services").select("id, name, intake_required").order("created_at"),
  ]);

  if (error || serviceError) {
    return (
      <SettingsShell active="forms">
        <p className="message warning">
          Run supabase/migrations/0033_intake.sql in Supabase to turn on intake forms, then refresh
          this page.
        </p>
      </SettingsShell>
    );
  }

  const example =
    !(form?.questions || []).length && !form?.waiver_text && (await examplesOn(supabase, user.id))
      ? exampleData(new Date().toISOString().slice(0, 10), await getMyTemplate()).intake
      : null;

  return (
    <SettingsShell
      active="forms"
      subtitle={`Intake form & waiver: a few questions and a waiver for new clients, for the services you choose. Answers show on their client card.${
        form ? ` Version ${form.version}.` : ""
      }`}
    >
      {example && (
        <section className="card is-example">
          <h2>
            Example form <ExampleTag />
          </h2>
          <p className="muted small-text">
            <Words>What a new client fills in when they book. Write your own below; this example is never sent to anyone.</Words>
          </p>
          <ol className="example-questions">
            {example.questions.map((q) => (
              <li key={q.id}>
                {q.label}
                {q.required ? " (required)" : ""}
              </li>
            ))}
          </ol>
          <p className="muted small-text">
            <strong>Waiver:</strong> {example.waiver} Client ticks &quot;I agree&quot; and types their name.
          </p>
          <p className="muted small-text">
            Example answers show on Maya Jones&apos;s card in Clients.
          </p>
        </section>
      )}
      <IntakeBuilder
        questions={form?.questions || []}
        waiverText={form?.waiver_text || ""}
        services={services || []}
        frequency={form?.waiver_frequency || "first"}
        timing={form?.waiver_timing || "booking"}
        starterWaiver={tplForWaiver.presets.intake.waiver || ""}
        typeLabel={tplForWaiver.label}
      />
    </SettingsShell>
  );
}
