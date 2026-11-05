"use client";

// On the Calendar, under a standing visit: Move this date, Skip this date,
// or End series (instead of "Cancel booking").
import { useActionState, useEffect, useState } from "react";
import { endStanding, moveStandingVisit, skipStandingVisit } from "./actions";
import { clockTime } from "@/lib/availability";
import { shortDay } from "./describe";
import ConfirmAction from "@/components/ConfirmAction";
import TimeSelect from "@/components/TimeSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function StandingVisitControls({ booking, seriesId, today, depositPaid }) {
  const [moving, setMoving] = useState(false);
  const [state, formAction] = useActionState(moveStandingVisit, null);
  const when = `${shortDay(booking.booking_date)} at ${clockTime(booking.start_time)}`;

  useEffect(() => {
    if (state?.savedAt) setMoving(false);
  }, [state?.savedAt]);

  if (moving) {
    return (
      <form action={formAction} className="standing-move">
        <input type="hidden" name="id" value={booking.id} />
        <p className="confirm-question">Move {booking.client_name}&apos;s visit on {when} to:</p>
        <div className="standing-row">
          <label>
            Date
            <input type="date" name="date" min={today} defaultValue={booking.booking_date} required />
          </label>
          <label>
            Time
            <TimeSelect name="time" defaultValue={booking.start_time.slice(0, 5)} />
          </label>
        </div>
        <p className="muted small-text">
          Only this visit moves. They get an email with the new time.
        </p>
        <div className="confirm-actions">
          <button type="button" className="button small secondary" onClick={() => setMoving(false)}>
            Cancel
          </button>
          <SubmitButton className="button small" pendingText="Moving...">
            Move visit
          </SubmitButton>
        </div>
        <FormMessage state={state?.error ? state : null} />
      </form>
    );
  }

  return (
    <div className="standing-controls">
      {state?.success && <p className="message success">{state.success}</p>}
      <button type="button" className="link-button quiet-link" onClick={() => setMoving(true)}>
        Move this date
      </button>
      <ConfirmAction
        label="Skip this date"
        question={`Skip ${booking.client_name}'s visit on ${when}?`}
        note={
          `Only this date is skipped; the rest of the series stays. The time isn't offered to anyone else (post an opening if you want it booked). ${booking.client_name} isn't told automatically, so let them know.` +
          (depositPaid ? " Their deposit isn't refunded automatically." : "")
        }
        keepLabel="Keep visit"
        confirmLabel="Yes, skip it"
        pendingText="Skipping..."
        action={skipStandingVisit}
        fields={{ id: booking.id }}
      />
      <ConfirmAction
        label="End series"
        question={`End ${booking.client_name}'s standing appointment?`}
        note={`No more visits are booked, and every upcoming one (including this date) is cancelled. ${booking.client_name} isn't told automatically, so let them know.`}
        keepLabel="Keep it"
        confirmLabel="Yes, end it"
        pendingText="Ending..."
        action={endStanding}
        fields={{ series_id: seriesId }}
      />
    </div>
  );
}
