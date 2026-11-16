"use client";

// Moving a booking to another time: pick a date and time (the booking page's
// own picker look, same service length), then confirm "old time -> new time".
// Used in "Your upcoming appointments" and on the email link's page.
// loadSlots(): { slots } or { error, code }. move(date, time): { moved } or { error, code }.
import { useEffect, useState, useTransition } from "react";
import { clockTime, formatDate, parseDateString } from "@/lib/availability";
import RegularStar from "@/components/RegularStar";

const FIRST_DATES = 12;

// Reasons the client can't move it online: they should contact the business.
const CONTACT_CODES = ["too_close", "too_many", "not_found", "blocked"];

export default function ReschedulePicker({ booking, businessName, zoneNote, loadSlots, move, onDone, onClose }) {
  const [slots, setSlots] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [moved, setMoved] = useState(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const result = await loadSlots();
    if (result.error) setLoadError(result);
    else setSlots(result.slots);
  }

  useEffect(() => {
    let ignore = false;
    loadSlots().then((result) => {
      if (ignore) return;
      if (result.error) setLoadError(result);
      else setSlots(result.slots);
    });
    return () => {
      ignore = true;
    };
    // loadSlots is stable for one booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oldWhen = `${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await move(date, time);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        if (result.code === "slot_unavailable") {
          setTime(null);
          await refresh();
        } else if (CONTACT_CODES.includes(result.code)) {
          setLoadError(result);
        }
        return;
      }
      setMoved(result.moved);
      onDone?.(result.moved);
    });
  }

  if (moved) {
    return (
      <div className="reschedule">
        <p className="message success">
          Moved! Your {booking.service_name} is now {formatDate(moved.booking_date)} at{" "}
          {clockTime(moved.start_time)}. We&apos;ve emailed you the new time.
        </p>
        {onClose && (
          <button type="button" className="button small" onClick={onClose}>
            Done
          </button>
        )}
      </div>
    );
  }

  if (loadError) {
    const contact = CONTACT_CODES.includes(loadError.code);
    return (
      <div className="reschedule">
        <p className="message warning">
          {loadError.error}
          {contact && ` Please contact ${businessName} to change this booking.`}
        </p>
        {onClose && (
          <button type="button" className="button secondary small" onClick={onClose}>
            Back
          </button>
        )}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="reschedule" role="group" aria-label="Confirm the new time">
        <p className="reschedule-title">Move your {booking.service_name}?</p>
        <div className="reschedule-change">
          <span className="reschedule-old">{oldWhen}</span>
          <span aria-hidden="true">→</span>
          <strong>
            {formatDate(date)} at {clockTime(time)}
          </strong>
        </div>
        <p className="muted small-text">
          Your deposit, if you paid one, stays with this booking. Nothing new is charged.
        </p>
        <div className="cancel-actions">
          <button type="button" className="button secondary small" onClick={() => setConfirming(false)} disabled={pending}>
            Back
          </button>
          <button type="button" className="button small" onClick={confirm} disabled={pending}>
            {pending ? "Moving..." : "Yes, move it"}
          </button>
        </div>
      </div>
    );
  }

  // Dates with at least one open time, in order.
  const dates = [];
  for (const s of slots || []) {
    const last = dates[dates.length - 1];
    if (last && last.date === s.slot_date) {
      if (s.visibility === "regulars") last.early = true;
    } else {
      dates.push({ date: s.slot_date, early: s.visibility === "regulars" });
    }
  }
  const visibleDates = showAllDates ? dates : dates.slice(0, FIRST_DATES);
  const times = (slots || []).filter((s) => s.slot_date === date);

  return (
    <div className="reschedule">
      <p className="reschedule-title">
        Move your {booking.service_name} from {oldWhen}
      </p>
      {zoneNote && <p className="muted small-text">{zoneNote}</p>}
      {error && <p className="message error">{error}</p>}
      {!slots && <p className="muted">Loading open times...</p>}
      {slots && dates.length === 0 && (
        <p className="muted">
          No other open times right now. Please check back soon, or contact {businessName}.
        </p>
      )}

      {dates.length > 0 && (
        <div className="date-grid">
          {visibleDates.map((d) => {
            const day = parseDateString(d.date);
            return (
              <button
                key={d.date}
                type="button"
                className={d.date === date ? "date-choice selected" : "date-choice"}
                aria-pressed={d.date === date}
                onClick={() => {
                  setDate(d.date);
                  setTime(null);
                }}
              >
                <span className="date-weekday">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                  {d.early && (
                    <span className="early-star">
                      <RegularStar label="Has Regulars-only times" size={9} />
                    </span>
                  )}
                </span>
                <strong className="date-day">{day.getDate()}</strong>
                <span className="date-month">{day.toLocaleDateString("en-US", { month: "short" })}</span>
              </button>
            );
          })}
        </div>
      )}
      {dates.length > FIRST_DATES && !showAllDates && (
        <button type="button" className="link-button" onClick={() => setShowAllDates(true)}>
          More dates
        </button>
      )}

      {date && (
        <>
          <h3 className="list-title">{formatDate(date)}</h3>
          {times.some((s) => s.visibility === "regulars") && (
            <p className="bk-key">
              <RegularStar label={null} /> Regulars only
            </p>
          )}
          <div className="time-grid">
            {times.map((s) => (
              <button
                key={s.slot_time}
                type="button"
                className={["time-choice", s.visibility === "regulars" ? "early" : "", s.slot_time === time ? "selected" : ""].join(" ")}
                aria-pressed={s.slot_time === time}
                onClick={() => setTime(s.slot_time)}
              >
                {clockTime(s.slot_time)}
                {s.visibility === "regulars" && <RegularStar />}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cancel-actions">
        {onClose && (
          <button type="button" className="button secondary small" onClick={onClose} disabled={pending}>
            Keep current time
          </button>
        )}
        <button
          type="button"
          className="button small"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={!date || !time}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
