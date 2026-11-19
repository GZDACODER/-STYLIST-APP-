// Settings → Calendar sync. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { CalendarSection } from "../parts/calendar";

export const metadata = { title: `Calendar sync · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="calendar">
      <CalendarSection />
    </SettingsShell>
  );
}
