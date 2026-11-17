// Settings' frame. iPad and wider: the section list on the left, the section
// on the right. Phones: /dashboard/settings is just the list (root); a
// section shows a back arrow to it instead of the list.
import Link from "next/link";
import { SETTINGS_SECTIONS, sectionByKey } from "@/lib/settingsSections";
import PageHeader from "./PageHeader";

export default function SettingsShell({ active, root = false, subtitle, actions, children }) {
  const section = sectionByKey(active);
  return (
    <div className={root ? "settings-shell is-root" : "settings-shell"}>
      <nav className="settings-nav" aria-label="Settings sections">
        <h1 className="settings-nav-title">Settings</h1>
        <ul>
          {SETTINGS_SECTIONS.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className={s.key === active ? "settings-nav-link active" : "settings-nav-link"}
                aria-current={s.key === active ? "page" : undefined}
              >
                <span className="settings-nav-label">{s.label}</span>
                <span className="settings-nav-note">{s.note}</span>
                <span className="db-row-chevron" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="settings-content">
        <Link href="/dashboard/settings" className="settings-back">
          ‹ Settings
        </Link>
        <PageHeader title={section?.label || "Settings"} subtitle={subtitle} actions={actions} />
        {children}
      </div>
    </div>
  );
}
