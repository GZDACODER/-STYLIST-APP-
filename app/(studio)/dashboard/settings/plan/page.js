// Settings → Plan & billing. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { PlanSection } from "../parts/plan";
import { AgreementsSection } from "../parts/agreements";

export const metadata = { title: `Plan & billing · ${BRAND_NAME}` };

export default async function Page({ searchParams }) {
  const q = await searchParams;
  return (
    <SettingsShell active="plan">
      <PlanSection billing={q.billing} />
      {/* Agreements used to be its own section. */}
      <div id="agreements">
        <AgreementsSection />
      </div>
    </SettingsShell>
  );
}
