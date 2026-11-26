// The same "nothing here yet" everywhere, in the redesign's style: a small
// gold icon, one line (the title, then what to do about it) and at most one
// action. icon: inbox (default), calendar, clock, star, people, search,
// gift, heart, list, activity, check.
const ICONS = {
  inbox: <path d="M4 13.5 6.5 5h11l2.5 8.5v5H4zM4 13.5h4.5l1 2h5l1-2H20" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M15.5 6a3 3 0 0 1 0 5.6M17 14.2c2 .6 3.2 2.3 3.5 4.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M3.5 9h17M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" />
    </>
  ),
  heart: <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" />,
  list: <path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  activity: <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export default function EmptyState({ title, text, action, icon = "inbox" }) {
  // "No clients yet. Clients appear here when they book." reads as one line.
  const lead = title && !/[.!?]$/.test(title) ? `${title}.` : title;
  return (
    <div className="db-empty empty-state">
      <span className="empty-mini-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon] || ICONS.inbox}
        </svg>
      </span>
      <p className="empty-state-line">
        <strong className="db-empty-title">{lead}</strong>
        {text && <> {text}</>}
      </p>
      {action && <div className="db-empty-action">{action}</div>}
    </div>
  );
}
