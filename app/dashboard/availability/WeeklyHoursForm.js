"use client";

import { useActionState, useState, startTransition } from "react";
import { saveHours } from "./actions";
import { WEEKDAYS, DEFAULT_HOURS } from "@/lib/availability";
import FormMessage from "@/components/FormMessage";

// savedHours looks like { 1: { is_working, start_time, end_time }, ... }
export default function WeeklyHoursForm({ savedHours }) {
  const hasSaved = Object.keys(savedHours).length > 0;

  const [hours, setHours] = useState(() => {
    const initial = {};
    for (const day of WEEKDAYS) {
      const saved = savedHours[day.dow];
      // Before anything is saved, suggest Mon–Fri as working days.
      const isWeekday = day.dow >= 1 && day.dow <= 5;
      initial[day.dow] = {
        is_working: saved ? saved.is_working : !hasSaved && isWeekday,
        // A day off has no saved times; offer 9–5 if they switch it back on.
        start_time: saved?.start_time || DEFAULT_HOURS.start_time,
        end_time: saved?.end_time || DEFAULT_HOURS.end_time,
      };
    }
    return initial;
  });

  const [state, formAction, pending] = useActionState(saveHours, null);

  function update(dow, field, value) {
    setHours((current) => ({ ...current, [dow]: { ...current[dow], [field]: value } }));
  }

  // Submitting this way keeps what's on screen (a plain form action would reset it).
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      {!hasSaved && (
        <p className="message info">
          These are suggested hours. Change anything, then tap Save.
        </p>
      )}
      <ul className="hours-list">
        {WEEKDAYS.map((day) => {
          const h = hours[day.dow];
          return (
            <li key={day.dow}>
              <label className="day-toggle">
                <input
                  type="checkbox"
                  name={`working_${day.dow}`}
                  checked={h.is_working}
                  onChange={(e) => update(day.dow, "is_working", e.target.checked)}
                />
                <span>{day.name}</span>
              </label>
              {h.is_working ? (
                <div className="time-range">
                  <input
                    type="time"
                    name={`start_${day.dow}`}
                    aria-label={`${day.name} start time`}
                    value={h.start_time}
                    onChange={(e) => update(day.dow, "start_time", e.target.value)}
                    required
                  />
                  <span className="muted">to</span>
                  <input
                    type="time"
                    name={`end_${day.dow}`}
                    aria-label={`${day.name} end time`}
                    value={h.end_time}
                    onChange={(e) => update(day.dow, "end_time", e.target.value)}
                    required
                  />
                </div>
              ) : (
                <span className="muted day-off-label">Day off</span>
              )}
            </li>
          );
        })}
      </ul>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving..." : "Save working hours"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
