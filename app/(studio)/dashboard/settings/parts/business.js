// Settings sections: Business, and Help (example data and tips). Server components.
import SettingsForm from "../SettingsForm";
import SubmitButton from "@/components/SubmitButton";
import { setShowExamples } from "../actions";
import { me, optional } from "./common";
import ShowTipsAgain from "@/components/guide/ShowTipsAgain";

export async function BusinessSection() {
  const { supabase, user, row } = await me("business_name, timezone");
  if (!user) return null;
  const firstName = await optional(supabase, user.id, "first_name");
  return (
    <section className="card">
      <SettingsForm part="business" businessName={row.business_name} firstName={firstName || ""} timezone={row.timezone} />
    </section>
  );
}

// Settings → Help: example data and tips (moved from Business).
export async function HelpSection() {
  const { supabase, user } = await me("id");
  if (!user) return null;
  const showExamples = await supabase.from("stylists").select("show_examples").eq("id", user.id).maybeSingle();
  const examplesReady = !showExamples.error;
  const examplesOn = Boolean(showExamples.data?.show_examples);
  return (
    <>
      {examplesReady && (
        <section className="card" id="examples">
          <div className="example-toggle-head">
            <h2>Show example data</h2>
            <span className={examplesOn ? "badge paid" : "badge"}>{examplesOn ? "On" : "Off"}</span>
          </div>
          <p className="muted">
            {examplesOn
              ? "Sample bookings, clients, openings, events, waitlist entries, notes, imports and a sample report show (tagged Example) on any tab where you haven't added your own yet. They're never saved, never emailed or charged, never on your booking page and never in your real numbers."
              : "Examples are off. Turn them on to see sample bookings, clients, a sample report and more (tagged Example) on tabs where you haven't added your own yet."}
          </p>
          <form action={setShowExamples} data-no-savebar>
            <input type="hidden" name="on" value={examplesOn ? "false" : "true"} />
            <SubmitButton className={examplesOn ? "button secondary small" : "button small"} pendingText="Saving...">
              {examplesOn ? "Turn off examples" : "Turn on examples"}
            </SubmitButton>
          </form>
        </section>
      )}
      <ShowTipsAgain />
    </>
  );
}
