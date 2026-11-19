// Settings → Holidays. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { HolidaysSection } from "../parts/holidays";

export const metadata = { title: `Holidays · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="holidays">
      <HolidaysSection />
    </SettingsShell>
  );
}
