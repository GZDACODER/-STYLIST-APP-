"use client";

// Personal events on the Calendar: the add / edit form and the details
// panel (with Edit and Delete), both shown in a Sheet.
import { useActionState, useEffect, useState } from "react";
import { clockTime, formatDate } from "@/lib/availability";
import { REPEATS, repeatLabel } from "@/lib/calendarEvents";
import ConfirmAction from "@/components/ConfirmAction";
import SubmitButton from "@/components/SubmitButton";
import TimeSelect from "@/components/TimeSelect";
import { deleteEvent, saveEvent } from "./eventActions";

const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

export function eventTimeText(e) {
  return e.start_time ? `${clockTime(e.start_time)} – ${clockTime(e.end_time)}` : "All day";
}

// event: an event to edit, or null to add one on `date`.
// onSaved: called once it's saved and there's nothing to warn about.
export function EventForm({ event, date, onSaved }) {
  const [state, formAction] = useActionState(saveEvent, null);
  const [startsOn, setStartsOn] = useState(event?.starts_on || date);
  const [allDay, setAllDay] = useState(event ? !event.start_time : false);
  const [repeats, setRepeats] = useState(event?.repeats || "none");

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
      <h2>{event ? "Edit event" : "Add event"}</h2>
      {event && <input type="hidden" name="id" value={event.id} />}
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
      <label className="check-row">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
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
      <label>
        Repeats
        <select name="repeats" value={repeats} onChange={(e) => setRepeats(e.target.value)}>
          {REPEATS.map((r) => (
            <option key={r} value={r}>
              {repeatLabel(r, startsOn)}
            </option>
          ))}
        </select>
      </label>
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
      <label>
        Note (optional, only you see this)
        <input name="note" type="text" maxLength={300} defaultValue={event?.note || ""} />
      </label>
      <SubmitButton pendingText="Saving...">{event ? "Save event" : "Add event"}</SubmitButton>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

// date: the day it was opened from (for "Delete this date only").
export function EventDetails({ event: e, date, onEdit }) {
  const repeating = e.repeats !== "none";
  return (
    <div className="client-card event-details">
      <div className="client-top">
        <div className="client-name">{e.title}</div>
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
            {repeatLabel(e.repeats, e.starts_on)}
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
        <button type="button" className="button small secondary" onClick={onEdit}>
          Edit{repeating ? " all dates" : ""}
        </button>
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
