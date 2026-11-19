// Settings section: Business (server component).
import SettingsForm from "../SettingsForm";
import SubmitButton from "@/components/SubmitButton";
import { setShowExamples } from "../actions";
import { me, optional } from "./common";
import ShowTipsAgain from "@/components/guide/ShowTipsAgain";

export async function BusinessSection() {
  const { supabase, user, row } = await me("business_name, timezone");
  if (!user) return null;
  const [firstName, showExamples] = await Promise.all([
    optional(supabase, user.id, "first_name"),
    supabase.from("stylists").select("show_examples").eq("id", user.id).maybeSingle(),
  ]);
  const examplesReady = !showExamples.error;
  const examplesOn = Boolean(showExamples.data?.show_examples);
  return (
    <>
      <section className="card">
        <SettingsForm part="business" businessName={row.business_name} firstName={firstName || ""} timezone={row.timezone} />
      </section>
      {examplesReady && (
        <section className="card" id="examples">
          <h2>Example data</h2>
          <p className="muted">
            {examplesOn
              ? "Example services, clients, bookings, openings, waitlist entries, notes and events show (tagged Example) in any tab where you haven't added your own yet. They're never saved, and clients never see them."
              : "Examples are off. Restore them to see sample services, clients, bookings and more (tagged Example) in tabs where you haven't added your own yet."}
          </p>
          <form action={setShowExamples}>
            <input type="hidden" name="on" value={examplesOn ? "false" : "true"} />
            <SubmitButton className={examplesOn ? "button secondary small" : "button small"} pendingText="Saving...">
              {examplesOn ? "Clear all examples" : "Restore examples"}
            </SubmitButton>
          </form>
        </section>
      )}
      <ShowTipsAgain />
    </>
  );
}
