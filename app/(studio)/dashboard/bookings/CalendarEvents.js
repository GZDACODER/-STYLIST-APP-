"use client";

// Personal events on the Calendar: the add / edit form and the details
// panel (with Edit and Delete), both shown in a Sheet.
import { useActionState, useEffect, useState } from "react";
import { clockTime, formatDate } from "@/lib/availability";
import { COLORS, REPEATS, WEEKDAY_SHORT, colorOf, monthlyChoices, repeatLabel, weekdayOf } from "@/lib/calendarEvents";
import ConfirmAction from "@/components/ConfirmAction";
import SubmitButton from "@/components/SubmitButton";
import TimeSelect from "@/components/TimeSelect";
import { deleteEvent, saveEvent } from "./eventActions";

const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
// Monday first, like the calendar.
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const repeatOpts = (e) => ({ days: e?.repeat_days || [], mode: e?.monthly_mode || "date" });

const SCOPE_TITLES = {
  one: "Edit this date",
  following: "Edit this and following dates",
  all: "Edit event",
};

export function eventTimeText(e) {
  return e.start_time ? `${clockTime(e.start_time)} – ${clockTime(e.end_time)}` : "All day";
}

// event: an event to edit, or null to add one on `date`.
// scope (editing a repeating event): "one" (just `date`), "following"
// (`date` and later) or "all". onSaved: called once it's saved and there's
// nothing to warn about.
export function EventForm({ event, date, scope = "all", onSaved }) {
  const [state, formAction] = useActionState(saveEvent, null);
  const repeatingEvent = event && event.repeats !== "none";
  const partOfSeries = repeatingEvent && scope !== "all";
  const [startsOn, setStartsOn] = useState(partOfSeries ? date : event?.starts_on || date);
  const [allDay, setAllDay] = useState(event ? !event.start_time : false);
  const [repeats, setRepeats] = useState(scope === "one" ? "none" : event?.repeats || "none");
  const [color, setColor] = useState(event?.color || "gray");
  const [days, setDays] = useState(() =>
    event?.repeat_days?.length ? event.repeat_days : [weekdayOf(event?.starts_on || date)]
  );
  const [monthlyMode, setMonthlyMode] = useState(event?.monthly_mode || "date");
  const monthly = monthlyChoices(startsOn);
  const modeValue = monthly.some(([m]) => m === monthlyMode) ? monthlyMode : "date";
  const toggleDay = (d) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));

  // Close straight away unless there's a clash to read.
  useEffect(() => {
    if (state?.savedAt && !state.warning) onSaved();
  }, [state?.savedAt, state?.warning, onSaved]);

  if (state?.warning) {
    return (
      <div className="event-form">
        <p className="message success">{state.success}</p>
        <p className="message warning">{state.warning}</p>
        <button type="button" className="button" onClick={onSaved}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="event-form">
      <h2>{event ? (repeatingEvent ? SCOPE_TITLES[scope] : "Edit event") : "Add event"}</h2>
      {event && <input type="hidden" name="id" value={event.id} />}
      {repeatingEvent && (
        <>
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="occurrence" value={date} />
        </>
      )}
      {partOfSeries && (
        <p className="muted small-text">
          {scope === "one"
            ? `Changes only ${formatDate(date)}. The other dates stay as they are.`
            : `Changes ${formatDate(date)} and every date after it. Earlier dates stay as they are.`}
        </p>
      )}
      <label>
        What
        <input
          name="title"
          type="text"
          maxLength={80}
          placeholder="e.g. Maya's practice, Mom's birthday"
          defaultValue={event?.title}
          required
          autoFocus={!event}
        />
      </label>
      <label>
        Date
        <input
          name="starts_on"
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          required
        />
      </label>
      {/* Always sent, "on" or "off", so a timed event can never be saved as all day. */}
      <input type="hidden" name="all_day" value={allDay ? "on" : "off"} />
      <label className="check-row">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>
      {!allDay && (
        <div className="standing-row">
          <label>
            From
            <TimeSelect name="start_time" defaultValue={hhmm(event?.start_time) || "16:00"} />
          </label>
          <label>
            To
            <TimeSelect name="end_time" defaultValue={hhmm(event?.end_time) || "17:00"} />
          </label>
        </div>
      )}
      {scope === "one" ? (
        <input type="hidden" name="repeats" value="none" />
      ) : (
        <label>
          Repeats
          <select name="repeats" value={repeats} onChange={(e) => setRepeats(e.target.value)}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {r === "weekly" ? "Every week" : r === "biweekly" ? "Every 2 weeks" : r === "monthly" ? "Every month" : repeatLabel(r, startsOn)}
              </option>
            ))}
          </select>
        </label>
      )}
      {(repeats === "weekly" || repeats === "biweekly") && (
        <fieldset className="event-days">
          <legend>On</legend>
          <input type="hidden" name="repeat_days_shown" value="1" />
          <div className="event-days-row">
            {WEEK.map((d) => (
              <label key={d} className={days.includes(d) ? "event-day checked" : "event-day"}>
                <input type="checkbox" name="repeat_days" value={d} checked={days.includes(d)} onChange={() => toggleDay(d)} />
                {WEEKDAY_SHORT[d]}
              </label>
            ))}
          </div>
          <p className="muted small-text">{repeatLabel(repeats, startsOn, { days })}</p>
        </fieldset>
      )}
      {repeats === "monthly" && (
        <label>
          Each month
          <select name="monthly_mode" value={modeValue} onChange={(e) => setMonthlyMode(e.target.value)}>
            {monthly.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {repeats !== "none" && (
        <label>
          Until (optional)
          <input name="repeat_until" type="date" min={startsOn} defaultValue={event?.repeat_until || ""} />
        </label>
      )}
      <label className="check-row">
        <input type="checkbox" name="blocks_bookings" defaultChecked={event?.blocks_bookings ?? false} />
        <span>
          <strong>Block bookings.</strong>{" "}
          <span className="muted">
            Clients can&apos;t book {allDay ? "that day" : "during this time"} from your booking page.
            Bookings already made stay.
          </span>
        </span>
      </label>
      <fieldset className="event-colors">
        <legend>Colour</legend>
        <div className="event-colors-row">
          {Object.entries(COLORS).map(([key, [label, hex]]) => (
            <label key={key} className={color === key ? "event-swatch checked" : "event-swatch"} title={label}>
              <input type="radio" name="color" value={key} checked={color === key} onChange={() => setColor(key)} />
              <span style={{ background: hex }} aria-hidden="true" />
              <span className="visually-hidden">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Note (optional, only you see this)
        <input name="note" type="text" maxLength={300} defaultValue={event?.note || ""} />
      </label>
      <SubmitButton pendingText="Saving...">{event ? "Save event" : "Add event"}</SubmitButton>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

// date: the day it was opened from (for "this date" / "this and following").
// onEdit(scope): "one", "following" or "all".
export function EventDetails({ event: e, date, onEdit }) {
  const repeating = e.repeats !== "none";
  const laterDate = repeating && date > e.starts_on;
  return (
    <div className="client-card event-details">
      <div className="client-top">
        <div className="client-name">
          <span className="event-dot" style={{ background: colorOf(e) }} aria-hidden="true" /> {e.title}
        </div>
        {e.blocks_bookings && <span className="badge event-block">Bookings blocked</span>}
      </div>
      <dl className="booking-facts">
        <div>
          <dt>When</dt>
          <dd>
            {formatDate(date)}
            <br />
            {eventTimeText(e)}
          </dd>
        </div>
        <div>
          <dt>Repeats</dt>
          <dd>
            {repeatLabel(e.repeats, e.starts_on, repeatOpts(e))}
            {repeating && e.repeat_until && `, until ${formatDate(e.repeat_until)}`}
          </dd>
        </div>
        {e.note && (
          <div>
            <dt>Note</dt>
            <dd>{e.note}</dd>
          </div>
        )}
      </dl>
      <p className="muted small-text">
        {e.blocks_bookings
          ? "Clients can't book this time from your booking page."
          : "Just a reminder for you. Clients can still book this time."}
      </p>
      <div className="event-actions">
        {repeating ? (
          <>
            <button type="button" className="button small secondary" onClick={() => onEdit("one")}>
              Edit this date
            </button>
            {laterDate && (
              <button type="button" className="button small secondary" onClick={() => onEdit("following")}>
                Edit this and following
              </button>
            )}
            <button type="button" className="button small secondary" onClick={() => onEdit("all")}>
              Edit all dates
            </button>
          </>
        ) : (
          <button type="button" className="button small secondary" onClick={() => onEdit("all")}>
            Edit
          </button>
        )}
      </div>
      <div className="event-actions">
        {repeating && (
          <ConfirmAction
            label="Delete this date only"
            question={`Remove ${e.title} on ${formatDate(date)}?`}
            note="The other dates stay."
            keepLabel="Keep it"
            confirmLabel="Yes, remove"
            pendingText="Removing..."
            action={deleteEvent}
            fields={{ id: e.id, scope: "one", date }}
          />
        )}
        {laterDate && (
          <ConfirmAction
            label="Delete this and following"
            question={`Remove ${e.title} from ${formatDate(date)} on?`}
            note="Earlier dates stay."
            keepLabel="Keep them"
            confirmLabel="Yes, remove"
            pendingText="Removing..."
            action={deleteEvent}
            fields={{ id: e.id, scope: "following", date }}
          />
        )}
        <ConfirmAction
          label={repeating ? "Delete all dates" : "Delete event"}
          question={repeating ? `Delete every date of ${e.title}?` : `Delete ${e.title}?`}
          note={e.blocks_bookings ? "That time opens up on your booking page again." : undefined}
          keepLabel="Keep it"
          confirmLabel="Yes, delete"
          pendingText="Deleting..."
          action={deleteEvent}
          fields={{ id: e.id, scope: "all" }}
        />
      </div>
    </div>
  );
}
