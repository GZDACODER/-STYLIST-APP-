// Settings → Booking page. Each section is its own page, so it loads only its
// own code (see components/dash/SettingsShell).
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { BookingPageSection } from "../parts/booking";

export const metadata = { title: `Booking page · ${BRAND_NAME}` };

export default function Page() {
  return (
    <SettingsShell active="booking">
      <BookingPageSection />
    </SettingsShell>
  );
}
