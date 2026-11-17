"use client";

// Settings → Holidays: a switch for each US federal holiday. Off by default.
// Closed holidays take that day off the booking page.
import { useActionState, useEffect, useState } from "react";
import { setHolidayClosed } from "./holidayActions";
import { FEDERAL_HOLIDAYS, nextHolidayDate } from "@/lib/holidays";
import { formatDate } from "@/lib/availability";

function HolidayRow({ holiday, closed: initial, today }) {
  const [state, formAction, pending] = useActionState(setHolidayClosed, null);
  // The last saved answer, and what was just tapped (shown while saving; if
  // saving fails, the saved answer shows again).
  const [confirmed, setConfirmed] = useState(initial);
  const [tapped, setTapped] = useState(initial);
  useEffect(() => {
    if (state?.success) setConfirmed(state.success.startsWith("Closed"));
  }, [state]);
  const next = nextHolidayDate(holiday.key, today);
  const shown = pending ? tapped : confirmed;
  return (
    <li className="holiday-row">
      <form action={formAction} className="holiday-form" onSubmit={() => setTapped(!confirmed)}>
        <input type="hidden" name="holiday_key" value={holiday.key} />
        <input type="hidden" name="closed" value={shown ? "off" : "on"} />
        <span className="holiday-name">
          <strong>{holiday.name}</strong>
          {next && <span className="muted small-text"> · next {formatDate(next)}</span>}
        </span>
        <button
          type="submit"
          className={`holiday-switch${shown ? " on" : ""}`}
          role="switch"
          aria-checked={shown}
          aria-label={`Closed on ${holiday.name}`}
          disabled={pending}
        >
          <span className="holiday-switch-knob" aria-hidden="true" />
          <span className="holiday-switch-text">{shown ? "Closed" : "Open"}</span>
        </button>
      </form>
      {state?.error && <p className="message error small-text">{state.error}</p>}
      {state?.warning && <p className="message warning small-text">{state.warning}</p>}
    </li>
  );
}

// closed: keys of the holidays the business closes on. today: "YYYY-MM-DD".
export default function HolidaySettings({ closed, today }) {
  const set = new Set(closed);
  return (
    <ul className="holiday-list">
      {FEDERAL_HOLIDAYS.map((h) => (
        <HolidayRow key={h.key} holiday={h} closed={set.has(h.key)} today={today} />
      ))}
    </ul>
  );
}
