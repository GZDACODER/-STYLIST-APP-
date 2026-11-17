"use client";

// The shared slim-row list: each row shows a name, one or two details, an
// optional badge and a chevron; tapping it opens the details in a panel
// (slides in on iPad, full screen on phones). 20 rows, then Show more.
//
// items: [{ key, title, sub, badge, panel }] — panel is what the details
// panel shows (any content, forms included); without one the row is plain.
// label: the panel's back link ("Calendar", "Services"...).
import { useState } from "react";
import Sheet from "@/components/Sheet";
import ShowMore from "./ShowMore";

export function RowChevron() {
  return (
    <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
      <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RowBody({ item }) {
  return (
    <>
      <span className="client-row-main">
        <span className="client-row-name">
          <span className="client-row-text">{item.title}</span>
        </span>
        {item.sub && <span className="client-row-phone">{item.sub}</span>}
      </span>
      {item.badge && <span className="client-row-next row-badges">{item.badge}</span>}
    </>
  );
}

export default function RowList({ items, label = "Back", noun = "more" }) {
  const [openKey, setOpenKey] = useState(null);
  const open = items.find((i) => i.key === openKey);
  return (
    <>
      <ShowMore className="client-rows" noun={noun}>
        {items.map((item) => (
          <li key={item.key}>
            {item.panel ? (
              <button type="button" className="client-row" onClick={() => setOpenKey(item.key)} aria-haspopup="dialog">
                <RowBody item={item} />
                <RowChevron />
              </button>
            ) : (
              <div className="client-row static-row">
                <RowBody item={item} />
              </div>
            )}
          </li>
        ))}
      </ShowMore>
      {open?.panel && (
        <Sheet key={open.key} label={String(open.title)} backLabel={label} onClose={() => setOpenKey(null)}>
          <div className="client-card">
            <div className="client-top">
              <div className="client-name">{open.title}</div>
              {open.badge}
            </div>
            {open.panel}
          </div>
        </Sheet>
      )}
    </>
  );
}
