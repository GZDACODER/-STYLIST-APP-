"use client";

import { useOptimistic, useState, startTransition } from "react";
import { deleteOpening, setDayVisibility, setOpeningVisibility } from "./actions";
import { clockTime, formatDate } from "@/lib/availability";
import VisibilitySwitch from "@/components/VisibilitySwitch";
import SubmitButton from "@/components/SubmitButton";

// Applies a visibility change to one opening ({ id }) or a whole day ({ date }).
function applyChange(openings, change) {
  return openings.map((o) =>
    (change.id ? o.id === change.id : o.opening_date === change.date)
      ? { ...o, visibility: change.visibility }
      : o
  );
}

export default function OpeningsList({ openings, bookingCounts }) {
  // Show changes straight away while they save in the background.
  const [shown, setOptimistic] = useOptimistic(openings, applyChange);
  const [error, setError] = useState(null);

  function change(changeInfo, save) {
    setError(null);
    startTransition(async () => {
      setOptimistic(changeInfo);
      const result = await save();
      if (result?.error) setError(result.error);
    });
  }

  function confirmRemove(event, count) {
    const extra = count
      ? ` ${count} booking${count > 1 ? "s are" : " is"} already in it and will be kept.`
      : "";
    if (!window.confirm(`Remove this opening?${extra}`)) event.preventDefault();
  }

  if (shown.length === 0) {
    return <p className="muted">No upcoming openings. Post some above so clients can book.</p>;
  }

  // Group by date.
  const days = [];
  for (const o of shown) {
    const last = days[days.length - 1];
    if (last && last.date === o.opening_date) last.openings.push(o);
    else days.push({ date: o.opening_date, openings: [o] });
  }

  return (
    <>
      {error && <p className="message error">Couldn't save: {error}</p>}
      <ul className="day-list">
        {days.map((day) => {
          const kinds = new Set(day.openings.map((o) => o.visibility));
          const dayValue = kinds.size === 1 ? [...kinds][0] : "mixed";
          return (
            <li key={day.date} className="day-group">
              <div className="day-heading">
                <strong>{formatDate(day.date)}</strong>
                {day.openings.length > 1 && (
                  <>
                    <span className="muted small-text">Whole day:</span>
                    <VisibilitySwitch
                      small
                      value={dayValue}
                      label={`Who can book on ${formatDate(day.date)}`}
                      onChange={(visibility) =>
                        change({ date: day.date, visibility }, () =>
                          setDayVisibility(day.date, visibility)
                        )
                      }
                    />
                  </>
                )}
              </div>
              <ul className="opening-list">
                {day.openings.map((o) => {
                  const count = bookingCounts[o.id] || 0;
                  return (
                    <li key={o.id}>
                      <div className="opening-top">
                        <span className="opening-time">
                          {clockTime(o.start_time)} – {clockTime(o.end_time)}
                        </span>
                        {count > 0 && (
                          <span className="badge">
                            {count} booked
                          </span>
                        )}
                        <form action={deleteOpening} onSubmit={(e) => confirmRemove(e, count)}>
                          <input type="hidden" name="id" value={o.id} />
                          <SubmitButton className="link-button danger" pendingText="...">
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                      <VisibilitySwitch
                        value={o.visibility}
                        label={`Who can book ${clockTime(o.start_time)} on ${formatDate(o.opening_date)}`}
                        onChange={(visibility) =>
                          change({ id: o.id, visibility }, () =>
                            setOpeningVisibility(o.id, visibility)
                          )
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}
