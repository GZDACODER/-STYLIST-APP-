// Settings → Regulars. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { RegularsSection } from "../parts/regulars";

export const metadata = { title: `Regulars · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="regulars">
      <RegularsSection />
    </SettingsShell>
  );
}
