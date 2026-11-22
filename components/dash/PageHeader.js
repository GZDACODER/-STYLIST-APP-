// The same header on every dashboard tab: a small line above (optional), the
// page title, a short line below (optional), and the tab's main button(s) on
// the right (they drop under the title on phones).
// guide: the first-visit tips for this page (lib/guides.js); adds the "?"
// that replays them.
import PageGuide from "@/components/guide/PageGuide";

// hero: the dark, gold-lit header (Home).
export default function PageHeader({ eyebrow, title, subtitle, actions, guide, hero = false }) {
  return (
    <header className={hero ? "db-pagehead is-hero" : "db-pagehead"}>
      <div className="db-pagehead-text">
        {eyebrow && <p className="db-date">{eyebrow}</p>}
        <h1>
          {title}
          {guide && <PageGuide guideKey={guide} className="gd-help-title" />}
        </h1>
        {subtitle && <p className="muted small-text db-pagehead-sub">{subtitle}</p>}
      </div>
      {actions && <div className="db-pagehead-actions">{actions}</div>}
    </header>
  );
}
