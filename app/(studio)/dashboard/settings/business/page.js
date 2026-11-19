// Settings → Business. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { BusinessSection } from "../parts/business";

export const metadata = { title: `Business · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="business">
      <BusinessSection />
    </SettingsShell>
  );
}
