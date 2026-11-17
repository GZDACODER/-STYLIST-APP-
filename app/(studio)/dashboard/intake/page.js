// Settings -> Intake form & waiver.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import IntakeBuilder from "./IntakeBuilder";
import SettingsShell from "@/components/dash/SettingsShell";

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

  return (
    <SettingsShell
      active="forms"
      subtitle={`Intake form & waiver: a few questions and a waiver for new clients, for the services you choose. Answers show on their client card.${
        form ? ` Version ${form.version}.` : ""
      }`}
    >
      <IntakeBuilder questions={form?.questions || []} waiverText={form?.waiver_text || ""} services={services || []} />
    </SettingsShell>
  );
}
