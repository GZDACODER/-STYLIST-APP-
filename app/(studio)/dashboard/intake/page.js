// Settings -> Intake form & waiver.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import IntakeBuilder from "./IntakeBuilder";

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
      <section className="card">
        <h2>Intake form &amp; waiver</h2>
        <p className="message warning">
          Run supabase/migrations/0033_intake.sql in Supabase to turn on intake forms, then refresh
          this page.
        </p>
        <Link href="/dashboard/settings">Back to Settings</Link>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Intake form &amp; waiver</h2>
        <p className="muted">
          Ask new clients a few questions and have them sign a waiver when they book the services you
          choose. Their answers show on their client card. ·{" "}
          <Link href="/dashboard/settings">Back to Settings</Link>
        </p>
        {form && <p className="muted small-text">Version {form.version}</p>}
      </section>
      <IntakeBuilder questions={form?.questions || []} waiverText={form?.waiver_text || ""} services={services || []} />
    </>
  );
}
