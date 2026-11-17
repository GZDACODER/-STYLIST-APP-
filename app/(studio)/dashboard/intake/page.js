// Settings -> Intake form & waiver.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import IntakeBuilder from "./IntakeBuilder";
import SettingsShell from "@/components/dash/SettingsShell";
import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleTag } from "@/components/dash/Example";

export const metadata = { title: `Intake form & waiver · ${BRAND_NAME}` };

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: form, error }, { data: services, error: serviceError }] = await Promise.all([
    supabase.from("intake_forms").select("questions, waiver_text, version").maybeSingle(),
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
      ? exampleData(new Date().toISOString().slice(0, 10)).intake
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
            What a new client fills in when they book. Write your own below; this example is never sent to anyone.
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
      <IntakeBuilder questions={form?.questions || []} waiverText={form?.waiver_text || ""} services={services || []} />
    </SettingsShell>
  );
}
