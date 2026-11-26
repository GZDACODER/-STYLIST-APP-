// Settings > Notifications (step 66 SQL): which emails the pro gets.
import { getUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";
import { NOTIFY_KINDS } from "@/lib/waitlist";
import NotifyForm from "../NotifyForm";

export const metadata = { title: `Notifications · ${BRAND_NAME}` };

export default async function Page() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  const { data: s, error } = await supabase.from("stylists").select("notify").eq("id", user.id).maybeSingle();
  return (
    <SettingsShell active="notifications" subtitle="Choose which emails you get. Text alerts come later.">
      <section className="card">
        <h2>Emails to you</h2>
        {error ? <p className="message error">Notifications aren&apos;t set up yet (step 66 SQL).</p> : <NotifyForm kinds={NOTIFY_KINDS} notify={s?.notify || {}} />}
      </section>
    </SettingsShell>
  );
}
