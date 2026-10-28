import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings · GZ Stylist App" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name, slug, timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) redirect("/dashboard");

  return (
    <section className="card">
      <h2>Settings</h2>
      <SettingsForm
        businessName={stylist.business_name}
        slug={stylist.slug}
        timezone={stylist.timezone}
      />
    </section>
  );
}
