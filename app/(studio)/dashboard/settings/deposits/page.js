// Settings → Deposits. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { DepositsSection } from "../parts/deposits";

export const metadata = { title: `Deposits · ${BRAND_NAME}` };

export default async function Page({ searchParams }) {
  const q = await searchParams;
  return (
    <SettingsShell active="deposits">
      <DepositsSection stripeParam={q.stripe} reason={q.reason} />
    </SettingsShell>
  );
}
