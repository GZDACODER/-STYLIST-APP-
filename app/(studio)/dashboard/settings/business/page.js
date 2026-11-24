// Settings → Business (and Email: where client replies go). Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { BusinessSection } from "../parts/business";
import { EmailSection } from "../parts/email";

export const metadata = { title: `Business · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="business">
      <BusinessSection />
      {/* Email (where client replies go) used to be its own section. */}
      <div id="email">
        <EmailSection />
      </div>
    </SettingsShell>
  );
}
