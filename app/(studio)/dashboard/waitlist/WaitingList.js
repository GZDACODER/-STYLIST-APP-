"use client";

// "Who's waiting": one slim row per waitlisted client (name, service and
// the days and times they'd like, how many times they've been told).
// Tapping a row opens the details in a panel: contact, wishes, and Remove.
// Rows with emails that couldn't be sent get a red mark so they stand out.
import { useEffect, useState } from "react";
import { displayPhone } from "@/lib/phone";
import RegularStar from "@/components/RegularStar";
import Sheet from "@/components/Sheet";
import RemoveEntryButton from "./RemoveEntryButton";

const STATUS_LABELS = { regular: "Regular", new: "New", blocked: "Blocked" };

// entries: [{ id, name, phone, email, textOk, status, service, wishes,
//   joined, toldCount, lastTold, stuckCount, stuckError }]
// (the dates are already written out in the business's time zone)
export default function WaitingList({ entries }) {
  const [openId, setOpenId] = useState(null);
  const open = openId ? entries.find((e) => e.id === openId) : null;

  // Removed from the list: close the panel.
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  return (
    <>
      <ul className="client-rows">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="client-row"
              onClick={() => setOpenId(e.id)}
              aria-haspopup="dialog"
            >
              <span className="client-row-main">
                <span className="client-row-name">
                  <span className="client-row-text">{e.name}</span>
                  {e.status === "regular" && <RegularStar label="Regular" size={10} />}
                  {e.status === "blocked" && <span className="badge blocked row-badge">Blocked</span>}
                  {e.stuckCount > 0 && <span className="badge blocked row-badge">Email problem</span>}
                </span>
                <span className="client-row-phone">
                  {e.service} · {e.wishes}
                </span>
              </span>
              <span className={e.toldCount ? "client-row-next" : "client-row-next none"}>
                {e.toldCount ? (
                  <>
                    <span className="client-row-next-label">Told</span>
                    {e.toldCount === 1 ? "1 time" : `${e.toldCount} times`}
                  </>
                ) : (
                  "Not told yet"
                )}
              </span>
              <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
                <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Sheet key={open.id} label={open.name} backLabel="Waitlist" onClose={() => setOpenId(null)}>
          <div className="client-card">
            <div className="client-top">
              <div className="client-name">{open.name}</div>
              {STATUS_LABELS[open.status] && (
                <span className={`badge ${open.status}`}>
                  {open.status === "regular" && (
                    <>
                      <RegularStar label={null} />{" "}
                    </>
                  )}
                  {STATUS_LABELS[open.status]}
                </span>
              )}
            </div>

            <dl className="booking-facts">
              <div>
                <dt>Wants</dt>
                <dd>{open.service}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>{open.wishes}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{open.joined}</dd>
              </div>
              <div>
                <dt>Told</dt>
                <dd>
                  {open.toldCount
                    ? `About ${open.toldCount} ${open.toldCount === 1 ? "time" : "times"}, last ${open.lastTold}`
                    : "Not told about any times yet"}
                </dd>
              </div>
            </dl>

            {open.stuckCount > 0 && (
              <p className="message error small-text">
                Couldn&apos;t email {open.name} about {open.stuckCount}{" "}
                {open.stuckCount === 1 ? "time" : "times"} yet. Trying again every 15 minutes.
                {open.stuckError && <> Reason: {open.stuckError}</>}
              </p>
            )}

            <div className="client-contact">
              <a href={`tel:${open.phone}`}>{displayPhone(open.phone)}</a>
              {open.email && <a href={`mailto:${open.email}`}>{open.email}</a>}
              {open.textOk && <span className="muted small-text">Wants texts</span>}
            </div>

            <div className="client-delete">
              <RemoveEntryButton id={open.id} name={open.name} />
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
