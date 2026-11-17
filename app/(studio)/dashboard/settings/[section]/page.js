// One Settings section: /dashboard/settings/business, /booking-page,
// /holidays, /regulars, /deposits, /plan, /email. (Services, Hours and
// Forms live at their older addresses.)
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import {
  BookingPageSection,
  BusinessSection,
  DepositsSection,
  EmailSection,
  HolidaysSection,
  PlanSection,
  RegularsSection,
} from "../sections";
import { SETTINGS_SECTIONS } from "@/lib/settingsSections";

const PAGES = {
  business: { key: "business", render: () => <BusinessSection /> },
  "booking-page": { key: "booking", render: () => <BookingPageSection /> },
  holidays: { key: "holidays", render: () => <HolidaysSection /> },
  regulars: { key: "regulars", render: () => <RegularsSection /> },
  deposits: { key: "deposits", render: (q) => <DepositsSection stripeParam={q.stripe} reason={q.reason} /> },
  plan: { key: "plan", render: (q) => <PlanSection billing={q.billing} /> },
  email: { key: "email", render: () => <EmailSection /> },
};

export async function generateMetadata({ params }) {
  const page = PAGES[(await params).section];
  const label = SETTINGS_SECTIONS.find((s) => s.key === page?.key)?.label || "Settings";
  return { title: `${label} · ${BRAND_NAME}` };
}

export default async function SettingsSectionPage({ params, searchParams }) {
  const page = PAGES[(await params).section];
  if (!page) notFound();
  return <SettingsShell active={page.key}>{page.render(await searchParams)}</SettingsShell>;
}
