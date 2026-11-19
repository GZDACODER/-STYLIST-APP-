// Settings → Email. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { EmailSection } from "../parts/email";

export const metadata = { title: `Email · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="email">
      <EmailSection />
    </SettingsShell>
  );
}
