"use client";

// The pro app's frame (owner's redesign spec, Nov 24):
//   - 1024px and up: a fixed dark left nav, grouped (Daily, People,
//     Business), a folded "More" group, Settings pinned at the bottom above
//     the account email and Log out. The logo goes Home.
//   - 768-1023px: the same nav as a drawer, from a menu button.
//   - Under 768px: a bottom tab bar (Today, Calendar, Clients, Money, More),
//     a top bar with the logo and search, and a "+" for quick actions.
//   - Quick actions (Cmd/Ctrl+K, or search): add things and jump to pages.
// No page addresses changed: pages not in the main groups stay reachable
// from "More", quick actions and links on related pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTemplate } from "@/components/TemplateContext";
import { ICONS as BASE_ICONS } from "../DashboardNav";
import { quickClients } from "./actions";
import { shareBookingLink } from "./share";
import ShareMenu from "@/components/share/ShareMenu";

const ICONS = {
  ...BASE_ICONS,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  activity: <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />,
  share: (
    <>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6" />
    </>
  ),
  followers: (
    <>
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
};

// "Ask the assistant" (only when the Assistant is on): in the "+" menu and
// quick actions. On phones it replaces the floating Assistant button.
const ASSISTANT_ACTION = { assistant: true, href: "#assistant", label: "Ask the assistant", icon: "sparkle", fab: true };

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg className={`sh-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// The main groups, exactly as specified. `also`: pages that light this item.
const GROUPS = [
  {
    label: "Daily",
    items: [
      { href: "/dashboard/today", label: "Today", icon: "today", also: ["/dashboard/wrapup", "/dashboard/requests"] },
      { href: "/dashboard/bookings", label: "Calendar", icon: "calendar" },
      { href: "/dashboard/openings", label: "Openings", icon: "openings", also: ["/dashboard/waitlist"] },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/clients", label: "Clients", word: "Clients", icon: "clients", also: ["/dashboard/notes", "/dashboard/projects", "/dashboard/packages"] },
      { href: "/dashboard/reviews", label: "Reviews", icon: "reviews", also: ["/dashboard/followers"] },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/dashboard/money", label: "Money", icon: "money", also: ["/dashboard/gift-cards"] },
      { href: "/dashboard/reports", label: "Insights", icon: "reports", module: "reports" },
    ],
  },
];

// Everything else, still at the same addresses.
const MORE = [
  { href: "/dashboard", label: "Home", icon: "home", exact: true },
  { href: "/dashboard/requests", label: "Requests", icon: "requests", module: "requests" },
  { href: "/dashboard/openings?tab=waitlist", label: "Waitlist", icon: "waitlist", module: "waitlist" },
  { href: "/dashboard/wrapup", label: "Wrap up visits", icon: "notes" },
  { href: "/dashboard/projects", label: "Projects", icon: "projects", module: "projects" },
  { href: "/dashboard/packages", label: "Packages", icon: "gift", module: "packages" },
  { href: "/dashboard/money?tab=gifts", label: "Gift cards", icon: "gift" },
  { href: "/dashboard/followers", label: "Following you", icon: "followers" },
  { href: "/dashboard/activity", label: "Activity", icon: "activity" },
  { href: "/dashboard/share", label: "Share kit", icon: "share" },
];

// The owner's admin pages (ADMIN_EMAILS only; the pages check too).
const ADMIN = [
  { href: "/dashboard/admin/control/activity", label: "Overview", icon: "reports" },
  { href: "/dashboard/admin/briefings", label: "Briefings", icon: "sparkle" },
  { href: "/dashboard/admin/pros", label: "Pros", icon: "clients" },
  { href: "/dashboard/admin/money", label: "Money", icon: "money" },
  { href: "/dashboard/admin/announce", label: "Email all pros", icon: "share" },
  { href: "/dashboard/admin/launch", label: "Launch week", icon: "sparkle" },
  { href: "/dashboard/admin/control", label: "Site health", icon: "activity", exact: true },
  { href: "/dashboard/admin/help", label: "Help requests", icon: "followers" },
  { href: "/dashboard/admin/control/support", label: "Support access", icon: "followers" },
  { href: "/dashboard/admin/control/reviews", label: "Reported reviews", icon: "reviews" },
  { href: "/dashboard/admin/feedback", label: "Trial feedback", icon: "notes" },
  { href: "/dashboard/admin/disputes", label: "Disputes", icon: "money" },
  { href: "/dashboard/admin/errors", label: "Errors", icon: "settings" },
];

const SETTINGS = { href: "/dashboard/settings", label: "Settings", icon: "settings", also: ["/dashboard/services", "/dashboard/availability", "/dashboard/intake"] };

// Quick actions. `fab`: also on the phone's "+" button. `share`: shares
// the booking link instead of going somewhere.
const ACTIONS = [
  { href: "/dashboard/openings#add-opening", label: "Add opening", icon: "openings", fab: true },
  { href: "/dashboard/bookings?add=event", label: "Add event", icon: "calendar", fab: true },
  { href: "/dashboard/clients#add-client", label: "Add client", word: "aClient", icon: "clients", fab: true },
  { href: "/dashboard/money#record", label: "Record payment", icon: "money", fab: true },
  { share: true, href: "#share", label: "Share booking link", icon: "share" },
  { href: "/dashboard/share", label: "Share kit (QR code and story)", icon: "share" },
  { href: "/dashboard/money?tab=gifts#redeem", label: "Redeem gift card", icon: "gift" },
];

function isActive(item, pathname) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function NavLink({ item, pathname, onClick }) {
  const active = isActive(item, pathname);
  return (
    <Link href={item.href} className={active ? "sh-link active" : "sh-link"} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function AppShell({ businessName, slug, email, logout, assistant = false, admin = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { words, modules } = useTemplate();
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [quick, setQuick] = useState(null); // null | "all" | "actions"
  const [isMac, setIsMac] = useState(true);

  const on = useCallback((i) => !i.module || modules[i.module] !== false, [modules]);
  const label = useCallback((i) => (i.word ? (i.word === "aClient" ? `Add ${words.client}` : words[i.word]) || i.label : i.label), [words]);
  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: g.items.filter(on).map((i) => ({ ...i, label: label(i) })) })),
    [on, label]
  );
  const more = useMemo(() => MORE.filter(on), [on]);
  const adminItems = admin ? ADMIN : [];
  const adminOpen = pathname.startsWith("/dashboard/admin");
  const moreOpen = more.some((i) => isActive(i, pathname));
  const actions = useMemo(
    () => [...ACTIONS, ...(assistant ? [ASSISTANT_ACTION] : [])].map((a) => ({ ...a, label: label(a) })),
    [label, assistant]
  );

  // Close everything when the page changes.
  useEffect(() => {
    setDrawer(false);
    setSheet(false);
    setQuick(null);
  }, [pathname]);

  // Cmd/Ctrl+K opens quick actions; Esc closes whatever is open.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuick((q) => (q ? null : "all"));
      } else if (e.key === "Escape") {
        setDrawer(false);
        setSheet(false);
        setQuick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bookingUrl = `https://www.clientelesuite.com/book/${slug}`;
  const [toast, setToast] = useState(null);
  const go = async (item) => {
    setQuick(null);
    if (item.assistant) {
      // Opens the Assistant panel (AssistantWidget listens for this).
      window.dispatchEvent(new Event("clientele:assistant"));
      return;
    }
    if (item.share) {
      const r = await shareBookingLink(bookingUrl, businessName);
      if (r === "copied") setToast("Booking link copied");
      else if (r === "failed") setToast(bookingUrl);
      if (r === "copied" || r === "failed") setTimeout(() => setToast(null), 2600);
      return;
    }
    router.push(item.href);
  };

  const navBody = (onClick) => (
    <>
      <Link href="/dashboard" className="sh-brand" onClick={onClick}>
        <span className="sh-brand-name">{businessName}</span>
        <span className="sh-brand-mark">Clientele</span>
      </Link>
      <nav className="sh-groups" aria-label="Main">
        {groups.map((g) => (
          <div key={g.label} className="sh-group">
            <p className="sh-group-label">{g.label}</p>
            {g.items.map((i) => (
              <NavLink key={i.href} item={i} pathname={pathname} onClick={onClick} />
            ))}
          </div>
        ))}
        <details className="sh-group sh-more" open={moreOpen || undefined}>
          <summary className="sh-group-label">
            More <Icon name="chevron" size={12} className="sh-chev" />
          </summary>
          {more.map((i) => (
            <NavLink key={i.href} item={i} pathname={pathname} onClick={onClick} />
          ))}
        </details>
        {adminItems.length > 0 && (
          <details className="sh-group sh-more sh-admin" open={adminOpen || undefined}>
            <summary className="sh-group-label">
              Admin <Icon name="chevron" size={12} className="sh-chev" />
            </summary>
            {adminItems.map((i) => (
              <NavLink key={i.href} item={i} pathname={pathname} onClick={onClick} />
            ))}
          </details>
        )}
      </nav>
      <div className="sh-foot">
        <NavLink item={SETTINGS} pathname={pathname} onClick={onClick} />
        <span className="sh-email">{email}</span>
        <form action={logout}>
          <button type="submit" className="sh-logout">
            Log out
          </button>
        </form>
      </div>
    </>
  );

  const tabs = [
    { href: "/dashboard/today", label: "Today", icon: "today", also: ["/dashboard/wrapup", "/dashboard/requests"] },
    { href: "/dashboard/bookings", label: "Calendar", icon: "calendar" },
    { href: "/dashboard/clients", label: words.Clients || "Clients", icon: "clients", also: ["/dashboard/notes", "/dashboard/projects", "/dashboard/packages"] },
    { href: "/dashboard/money", label: "Money", icon: "money", also: ["/dashboard/gift-cards"] },
  ];
  const sheetMain = [GROUPS[0].items[2], GROUPS[1].items[1], ...GROUPS[2].items.slice(1).filter(on), SETTINGS];
  const moreActive = !tabs.some((t) => isActive(t, pathname));

  return (
    <>
      {/* Wide screens: the nav. Tablets: the same nav as a drawer. */}
      <aside className={drawer ? "sh-side open" : "sh-side"} aria-label="Navigation">
        {navBody(() => setDrawer(false))}
      </aside>
      {drawer && <button type="button" className="sh-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      {/* Tablets and phones: the top bar. */}
      <header className="sh-top">
        <button type="button" className="sh-top-btn sh-menu" aria-label="Open menu" onClick={() => setDrawer(true)}>
          <Icon name="menu" size={22} />
        </button>
        <Link href="/dashboard" className="sh-top-brand">
          {businessName}
        </Link>
        {/* Search pill (with the keyboard hint), or just the icon on phones. */}
        <button type="button" className="sh-pill" onClick={() => setQuick("all")}>
          <Icon name="search" size={16} />
          <span>Search…</span>
          <kbd className="sh-kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        <button type="button" className="sh-top-btn sh-search-icon" aria-label="Search and quick actions" onClick={() => setQuick("all")}>
          <Icon name="search" size={22} />
        </button>
        {/* Every page: share the booking link (phone share sheet, or a menu). */}
        <ShareMenu
          url={bookingUrl}
          businessName={businessName}
          trigger={({ onClick, open }) => (
            <button type="button" className="sh-share" aria-haspopup="menu" aria-expanded={open} onClick={onClick}>
              <Icon name="share" size={17} />
              <span>Share my link</span>
            </button>
          )}
        />
      </header>
      {toast && (
        <p className="sh-toast" role="status">
          {toast}
        </p>
      )}

      {/* Phones: the bottom tab bar and the "+" button. */}
      <nav className="sh-tabs" aria-label="Main">
        {tabs.map((t) => {
          const active = isActive(t, pathname);
          return (
            <Link key={t.href} href={t.href} className={active ? "sh-tab active" : "sh-tab"} aria-current={active ? "page" : undefined}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button type="button" className={moreActive ? "sh-tab active" : "sh-tab"} onClick={() => setSheet(true)} aria-haspopup="dialog">
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </nav>
      <button type="button" className="sh-fab" aria-label="Quick actions" onClick={() => setQuick("actions")}>
        <Icon name="plus" size={26} />
      </button>

      {sheet && (
        <div className="sh-layer" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" className="sh-scrim" aria-label="Close" onClick={() => setSheet(false)} />
          <div className="sh-sheet">
            <span className="sh-handle" aria-hidden="true" />
            <div className="sh-sheet-list">
              {sheetMain.map((i) => (
                <NavLink key={i.href} item={i} pathname={pathname} onClick={() => setSheet(false)} />
              ))}
            </div>
            <p className="sh-group-label sh-sheet-label">Also</p>
            <div className="sh-sheet-list">
              {more.map((i) => (
                <NavLink key={i.href} item={i} pathname={pathname} onClick={() => setSheet(false)} />
              ))}
            </div>
            {adminItems.length > 0 && (
              <>
                <p className="sh-group-label sh-sheet-label">Admin</p>
                <div className="sh-sheet-list">
                  {adminItems.map((i) => (
                    <NavLink key={i.href} item={i} pathname={pathname} onClick={() => setSheet(false)} />
                  ))}
                </div>
              </>
            )}
            <div className="sh-sheet-foot">
              <span className="sh-email">{email}</span>
              <form action={logout}>
                <button type="submit" className="sh-logout">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {quick && (
        <QuickActions
          mode={quick}
          actions={quick === "actions" ? actions.filter((a) => a.fab) : actions}
          pages={quick === "actions" ? [] : [...groups.flatMap((g) => g.items), ...more, SETTINGS, ...adminItems]}
          clientsWord={words.Clients || "Clients"}
          onGo={go}
          onClose={() => setQuick(null)}
        />
      )}
    </>
  );
}

function QuickActions({ mode, actions, pages, clientsWord, onGo, onClose }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [clients, setClients] = useState([]);
  const input = useRef(null);
  // Clients to jump to (loaded when the search opens).
  useEffect(() => {
    if (mode !== "all") return;
    let live = true;
    quickClients().then((c) => live && setClients(c)).catch(() => {});
    return () => {
      live = false;
    };
  }, [mode]);
  const term = q.trim().toLowerCase();
  const match = (x) => x.label.toLowerCase().includes(term);
  const people = term.length >= 1 ? clients.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8) : [];
  const list = [
    ...actions.filter(match).map((a) => ({ ...a, kind: a.share ? "Share" : a.assistant ? "Ask" : "Add" })),
    ...pages.filter(match).map((p) => ({ ...p, kind: "Go to" })),
    ...people.map((c) => ({ href: `/dashboard/clients?client=${c.id}`, label: c.name, icon: "clients", kind: clientsWord })),
  ];
  useEffect(() => {
    if (mode === "all") input.current?.focus();
  }, [mode]);
  useEffect(() => setAt(0), [q]);
  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAt((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAt((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && list[at]) {
      e.preventDefault();
      onGo(list[at]);
    }
  };
  return (
    <div className="sh-layer sh-quick-layer" role="dialog" aria-modal="true" aria-label="Quick actions">
      <button type="button" className="sh-scrim" aria-label="Close" onClick={onClose} />
      <div className={mode === "actions" ? "sh-quick is-actions" : "sh-quick"}>
        <span className="sh-handle" aria-hidden="true" />
        {mode === "all" ? (
          <div className="sh-quick-search">
            <Icon name="search" size={18} />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search pages, or add something…" aria-label="Search" />
            <button type="button" className="sh-top-btn" aria-label="Close" onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          </div>
        ) : (
          <p className="sh-quick-title">Quick actions</p>
        )}
        <ul className="sh-quick-list" role="listbox">
          {list.length === 0 && <li className="sh-quick-empty">Nothing matches “{q}”.</li>}
          {list.map((x, i) => (
            <li key={`${x.kind}${x.href}${x.label}`} role="option" aria-selected={i === at}>
              <button type="button" className={i === at ? "sh-quick-item active" : "sh-quick-item"} onMouseEnter={() => setAt(i)} onClick={() => onGo(x)}>
                <span className="sh-quick-ico">
                  <Icon name={x.kind === "Add" ? "plus" : x.icon} size={16} />
                </span>
                <span className="sh-quick-label">{x.label}</span>
                <span className="sh-quick-kind">{x.kind === "Add" ? "" : x.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
