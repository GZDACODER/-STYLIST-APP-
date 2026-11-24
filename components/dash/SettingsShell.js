// Settings' frame. iPad and wider: the grouped section list on the left, the
// section on the right, and a sticky Save bar while a form has unsaved changes. Phones: /dashboard/settings is just the list (root); a
// section shows a back arrow to it instead of the list.
import Link from "next/link";
import { SETTINGS_GROUPS, sectionByKey } from "@/lib/settingsSections";
import SaveBar from "./SaveBar";
import { SETTINGS_GUIDES } from "@/lib/guides";
import PageHeader from "./PageHeader";
import Words from "@/components/Words";

export default function SettingsShell({ active, root = false, subtitle, actions, children }) {
  const section = sectionByKey(active);
  return (
    <div className={root ? "settings-shell is-root" : "settings-shell"}>
      <nav className="settings-nav" aria-label="Settings sections">
        <h1 className="settings-nav-title">Settings</h1>
        <div className="settings-nav-groups">
          {SETTINGS_GROUPS.map(([group, sections]) => (
            <div key={group} className={group === "Help" ? "settings-nav-group is-help" : "settings-nav-group"}>
              <h2 className="settings-nav-group-title">{group}</h2>
              <ul>
                {sections.map((s) => (
                  <li key={s.key}>
                    <Link
                      href={s.href}
                      className={s.key === active ? "settings-nav-link active" : "settings-nav-link"}
                      aria-current={s.key === active ? "page" : undefined}
                    >
                      <span className="settings-nav-label"><Words>{s.label}</Words></span>
                      <span className="settings-nav-note"><Words>{s.note}</Words></span>
                      <span className="db-row-chevron" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="settings-content">
        <Link href="/dashboard/settings" className="settings-back">
          ‹ Settings
        </Link>
        <PageHeader title={section?.label || "Settings"} subtitle={subtitle} actions={actions} guide={SETTINGS_GUIDES[active]} />
        {children}
        <SaveBar />
      </div>
    </div>
  );
}
