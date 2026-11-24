// Settings > Booking rules (step 66 SQL): notice, how far ahead, breaks,
// start times and a daily limit. Used by the booking page and at booking.
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";
import { getMyTemplate } from "@/lib/templates/server";
import RulesForm from "../RulesForm";

export const metadata = { title: `Booking rules · ${BRAND_NAME}` };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: r, error } = await supabase
    .from("stylists")
    .select("min_notice_minutes, max_days_ahead, buffer_minutes, slot_step_minutes, daily_limit")
    .eq("id", user.id)
    .maybeSingle();
  const { words } = await getMyTemplate();
  return (
    <SettingsShell active="rules" subtitle="How and when clients can book you.">
      <section className="card">
        <h2>Booking rules</h2>
        {error || !r ? <p className="message error">Booking rules aren&apos;t set up yet (step 66 SQL).</p> : <RulesForm r={r} words={words} />}
      </section>
    </SettingsShell>
  );
}
