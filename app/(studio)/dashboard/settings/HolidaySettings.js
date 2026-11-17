"use client";

// Holidays: a switch for each US federal holiday (Settings → Working hours),
// and the two switches shown when a holiday is tapped on the Calendar.
// Off by default. Closed holidays take that day off the booking page.
import { useActionState, useEffect, useState } from "react";
import { setHolidayClosed, setHolidayDateClosed } from "./holidayActions";
import { FEDERAL_HOLIDAYS, nextHolidayDate } from "@/lib/holidays";
import { formatDate } from "@/lib/availability";

// One Open/Closed switch. action: a server action taking `closed` ("on"/"off")
// plus `fields`. Shows the tapped state while saving, then the saved one.
export function HolidaySwitch({ action, fields, on: initial, label, detail, ariaLabel, locked = false }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [confirmed, setConfirmed] = useState(initial);
  const [tapped, setTapped] = useState(initial);
  useEffect(() => {
    if (state?.success) setConfirmed(state.success.startsWith("Closed"));
  }, [state]);
  useEffect(() => setConfirmed(initial), [initial]);
  const shown = pending ? tapped : confirmed;
  return (
    <div className="holiday-row">
      <form action={formAction} className="holiday-form" onSubmit={() => setTapped(!confirmed)}>
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="closed" value={shown ? "off" : "on"} />
        <span className="holiday-name">
          <strong>{label}</strong>
          {detail && <span className="muted small-text"> · {detail}</span>}
        </span>
        <button
          type="submit"
          className={`holiday-switch${shown ? " on" : ""}`}
          role="switch"
          aria-checked={shown}
          aria-label={ariaLabel || label}
          disabled={pending || locked}
        >
          <span className="holiday-switch-knob" aria-hidden="true" />
          <span className="holiday-switch-text">{shown ? "Closed" : "Open"}</span>
        </button>
      </form>
      {state?.error && <p className="message error small-text">{state.error}</p>}
      {state?.warning && <p className="message warning small-text">{state.warning}</p>}
    </div>
  );
}

// Settings → Working hours → Holidays: every federal holiday, closed every year or not.
// closed: keys of the holidays the business closes on. today: "YYYY-MM-DD".
export default function HolidaySettings({ closed, today }) {
  const set = new Set(closed);
  return (
    <ul className="holiday-list">
      {FEDERAL_HOLIDAYS.map((h) => {
        const next = nextHolidayDate(h.key, today);
        return (
          <li key={h.key}>
            <HolidaySwitch
              action={setHolidayClosed}
              fields={{ holiday_key: h.key }}
              on={set.has(h.key)}
              label={h.name}
              detail={next ? `every year · next ${formatDate(next)}` : "every year"}
              ariaLabel={`Closed every year on ${h.name}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

// Calendar: a holiday was tapped. "Closed this holiday" (just this date) and
// "Close every year".
export function HolidayDayControls({ holiday, date, closedThisDate, closedEveryYear }) {
  return (
    <div className="holiday-day">
      <HolidaySwitch
        action={setHolidayDateClosed}
        fields={{ holiday_key: holiday.key, date }}
        on={closedThisDate || closedEveryYear}
        locked={closedEveryYear}
        label="Closed this holiday"
        detail={closedEveryYear ? "you close every year (switch below)" : formatDate(date)}
        ariaLabel={`Closed on ${holiday.name}, ${formatDate(date)}`}
      />
      <HolidaySwitch
        action={setHolidayClosed}
        fields={{ holiday_key: holiday.key }}
        on={closedEveryYear}
        label="Close every year"
        detail={`every ${holiday.name}`}
        ariaLabel={`Closed every year on ${holiday.name}`}
      />
    </div>
  );
}
