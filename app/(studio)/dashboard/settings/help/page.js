// Settings → Example data & tips (the Help group): show sample data, and
// see each page's tips again.
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { HelpSection } from "../parts/business";

export const metadata = { title: `Example data & tips · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="help">
      <HelpSection />
    </SettingsShell>
  );
}
