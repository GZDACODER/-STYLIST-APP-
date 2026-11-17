// Settings. Phones: the list of sections. iPad and wider: the list on the
// left and Business on the right. Stripe and checkout send people back here
// with ?stripe= or ?billing=: those open Deposits or Plan & billing.
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { BusinessSection } from "./sections";

export const metadata = { title: `Settings · ${BRAND_NAME}` };

export default async function SettingsPage({ searchParams }) {
  const { stripe, reason, billing } = await searchParams;
  if (billing) redirect(`/dashboard/settings/plan?billing=${encodeURIComponent(billing)}`);
  if (stripe) {
    redirect(
      `/dashboard/settings/deposits?stripe=${encodeURIComponent(stripe)}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`
    );
  }
  return (
    <SettingsShell active="business" root>
      <BusinessSection />
    </SettingsShell>
  );
}
