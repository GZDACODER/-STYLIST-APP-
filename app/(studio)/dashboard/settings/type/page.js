// Settings → Business type: switch type, and turn features on or off.
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";
import { templateFor, TEMPLATES, templateKeyFor } from "@/lib/templates";
import { ModuleSwitches, TypePicker } from "../TypeSettings";

export const metadata = { title: `Business type · ${BRAND_NAME}` };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let { data: row, error } = await supabase.from("stylists").select("business_type, modules").eq("id", user.id).maybeSingle();
  if (error) ({ data: row } = await supabase.from("stylists").select("business_type").eq("id", user.id).maybeSingle());
  const type = row?.business_type || "hair";
  const tpl = templateFor(type, row?.modules);
  const defaults = TEMPLATES[templateKeyFor(type)].modules;
  // The card that's selected: the saved type, or "hair" for older values.
  const current = ["hair", "barber", "tattoo", "tutor"].includes(type) ? type : "hair";

  return (
    <SettingsShell active="type" subtitle={`You're set up as: ${tpl.label}.`}>
      <section className="card">
        <h2>Your business type</h2>
        <p className="muted">
          Sets the words you and your clients see, your example data, the starting intake form and which features show.
        </p>
        <TypePicker current={current} />
      </section>
      <section className="card">
        <h2>Features</h2>
        <p className="muted">Turn any feature on or off. Turning one off hides it; nothing is deleted.</p>
        <ModuleSwitches modules={tpl.modules} defaults={defaults} />
      </section>
    </SettingsShell>
  );
}
