"use client";

import { useActionState, useEffect, useState } from "react";
import { postOpenings } from "./actions";
import { WEEKDAYS, formatDate, isValidDateString, parseDateString, toDateString } from "@/lib/availability";
import TimeSelect from "@/components/TimeSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// Same limit as the server.
const MAX_DAYS = 60;

// The chosen dates that fall on one of the stylist's days off.
function findDaysOff(start, end, daysOff) {
  if (!isValidDateString(start)) return [];
  const last = isValidDateString(end) && end > start ? end : start;
  const found = [];
  let count = 0;
  for (let d = parseDateString(start); toDateString(d) <= last && count < MAX_DAYS; d.setDate(d.getDate() + 1)) {
    if (daysOff.includes(d.getDay())) found.push(toDateString(d));
    count++;
  }
  return found;
}

// daysOff: weekdays the stylist doesn't work, e.g. [0, 3] for Sunday and Wednesday.
export default function PostOpeningsForm({ today, daysOff }) {
  const [state, formAction] = useActionState(postOpenings, null);
  const [mode, setMode] = useState("hours");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [includeDaysOff, setIncludeDaysOff] = useState(false);

  // Clear the form after a successful post.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state?.success) {
      setStart("");
      setEnd("");
      setIncludeDaysOff(false);
      setFormKey((k) => k + 1);
    }
  }, [state]);

  const offDates = findDaysOff(start, end, daysOff);
  const offNames = WEEKDAYS.filter((d) => daysOff.includes(d.dow)).map((d) => d.name);
  const listed = offDates.slice(0, 4).map(formatDate).join("; ");
  const more = offDates.length > 4 ? ` and ${offDates.length - 4} more` : "";
  const dayWord = offDates.length === 1 ? "day" : "days";

  return (
    <form action={formAction} key={formKey}>
      <label>
        Date
        <input
          name="start_date"
          type="date"
          min={today}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
      </label>
      <label>
        Until (optional, to open several days)
        <input
          name="end_date"
          type="date"
          min={start || today}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>

      <fieldset className="field">
        <legend>Times</legend>
        <div className="segmented">
          <label className="segment new">
            <input
              type="radio"
              name="times"
              value="hours"
              checked={mode === "hours"}
              onChange={() => setMode("hours")}
            />
            <span>My working hours</span>
          </label>
          <label className="segment new">
            <input
              type="radio"
              name="times"
              value="custom"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
            />
            <span>Custom times</span>
          </label>
        </div>
      </fieldset>

      {mode === "custom" && (
        <div className="time-range">
          <TimeSelect name="from" aria-label="Start time" defaultValue="09:00" />
          <span className="muted">to</span>
          <TimeSelect name="to" aria-label="End time" defaultValue="17:00" />
        </div>
      )}

      {offDates.length > 0 && (
        <div className="message warning">
          <p>
            <strong>
              ⚠ {offDates.length === 1 ? "This is a day off" : `${offDates.length} of these are days off`}
            </strong>{" "}
            ({offNames.join(", ")}): {listed}
            {more}.
          </p>
          {mode === "hours" ? (
            <p>
              {offDates.length === 1 ? "It" : "They"} will be skipped, because you have no working
              hours on {offDates.length === 1 ? "that day" : "those days"}. To open{" "}
              {offDates.length === 1 ? "it" : "them"}, choose Custom times.
            </p>
          ) : (
            <label className="check-row">
              <input
                type="checkbox"
                name="include_days_off"
                checked={includeDaysOff}
                onChange={(e) => setIncludeDaysOff(e.target.checked)}
              />
              <span>
                Yes, open my {dayWord} off too. (If you leave this unticked, {offDates.length === 1 ? "it" : "they"}{" "}
                will be skipped.)
              </span>
            </label>
          )}
        </div>
      )}

      <fieldset className="field">
        <legend>Who can book</legend>
        <div className="segmented">
          <label className="segment everyone">
            <input type="radio" name="visibility" value="everyone" defaultChecked />
            <span>Everyone</span>
          </label>
          <label className="segment regulars">
            <input type="radio" name="visibility" value="regulars" />
            <span>Regulars only</span>
          </label>
        </div>
      </fieldset>

      <SubmitButton pendingText="Opening...">Open for booking</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
