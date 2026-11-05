"use client";

// On a Regular's client card: their standing appointments, and the
// "Set standing appointment" form.
import { useActionState, useEffect, useRef, useState } from "react";
import { createStanding, endStanding } from "./actions";
import { WEEKDAYS, parseDateString } from "@/lib/availability";
import { repeatLine, shortDay } from "./describe";
import TimeSelect from "@/components/TimeSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ConfirmAction from "@/components/ConfirmAction";
import PausedNote from "@/components/PausedNote";

const WEEK_CHOICES = Array.from({ length: 11 }, (_, i) => i + 2);

export default function StandingSection({ client, standing, isRegular }) {
  const { services, series, regularsOn, depositsOn, today } = standing;
  const mine = series.filter((s) => s.client_id === client.id);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createStanding, null);
  const [startDate, setStartDate] = useState(today);
  const [weekday, setWeekday] = useState(() => String(parseDateString(today).getDay()));
  const form = useRef(null);

  useEffect(() => {
    if (state?.savedAt) {
      setOpen(false);
      form.current?.reset();
    }
  }, [state?.savedAt]);

  // Picking a start date also picks its day of the week (it can be changed).
  function pickStart(value) {
    setStartDate(value);
    if (value) setWeekday(String(parseDateString(value).getDay()));
  }

  return (
    <div className="standing-section">
      {mine.map((s) => (
        <div key={s.id} className="standing-series">
          <div>
            <span className="badge standing">Standing</span>{" "}
            <strong>{s.service?.name || "Service"}</strong>
          </div>
          <div className="muted small-text">
            {repeatLine(s)} · from {shortDay(s.first_date)}
            {s.end_date ? ` to ${shortDay(s.end_date)}` : ""} ·{" "}
            {s.deposit_mode === "each" ? "Deposit each time" : "No deposit"}
          </div>
          {(!regularsOn || !isRegular) && (
            <div className="muted small-text">
              Paused:{" "}
              {regularsOn
                ? `${client.name} isn't a Regular right now`
                : "Regulars First isn't on your plan"}
              , so no new visits are booked.
            </div>
          )}
          <ConfirmAction
            label="End series"
            question={`End ${client.name}'s standing ${s.service?.name || "appointment"}?`}
            note={`No more visits are booked, and the upcoming ones are cancelled. ${client.name} isn't told automatically, so let them know. Paid deposits aren't refunded automatically.`}
            keepLabel="Keep it"
            confirmLabel="Yes, end it"
            pendingText="Ending..."
            action={endStanding}
            fields={{ series_id: s.id }}
          />
        </div>
      ))}

      {state?.success && !open && <p className="message success">{state.success}</p>}

      {regularsOn && isRegular && !open && (
        <button type="button" className="button secondary small" onClick={() => setOpen(true)}>
          Set standing appointment
        </button>
      )}

      {!regularsOn && isRegular && mine.length === 0 && (
        <PausedNote feature="regulars">
          Standing appointments come with Regulars First, which isn&apos;t on your plan right now.
        </PausedNote>
      )}

      {regularsOn && !isRegular && mine.length === 0 && (
        <p className="muted small-text">
          Standing appointments are for Regulars. Tap Regular above to set one up.
        </p>
      )}

      {regularsOn && isRegular && open && (
        <form action={formAction} ref={form} className="standing-form">
          <input type="hidden" name="client_id" value={client.id} />
          <h3>Standing appointment for {client.name}</h3>
          <p className="muted small-text">
            The same time every few weeks. The next 3 months are booked straight away, so
            nobody else can take those times, and it keeps rolling forward.
          </p>

          {services.length === 0 ? (
            <p className="message error">
              Add a service first (<a href="/dashboard/services">Services</a>).
            </p>
          ) : (
            <label>
              Service
              <select name="service_id" required defaultValue={services[0].id}>
                {services.map((sv) => (
                  <option key={sv.id} value={sv.id}>
                    {sv.name} ({sv.duration_minutes} min)
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Repeat
            <select name="interval_weeks" defaultValue="4">
              {WEEK_CHOICES.map((n) => (
                <option key={n} value={n}>
                  Every {n} weeks
                </option>
              ))}
            </select>
          </label>

          <div className="standing-row">
            <label>
              Day
              <select name="weekday" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAYS.map((d) => (
                  <option key={d.dow} value={d.dow}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time
              <TimeSelect name="time" defaultValue="10:00" />
            </label>
          </div>

          <div className="standing-row">
            <label>
              Start date
              <input
                type="date"
                name="start_date"
                min={today}
                value={startDate}
                onChange={(e) => pickStart(e.target.value)}
                required
              />
            </label>
            <label>
              End date (optional)
              <input type="date" name="end_date" min={startDate || today} />
            </label>
          </div>

          <fieldset className="standing-deposit">
            <legend>Deposit</legend>
            <label className="check-row">
              <input type="radio" name="deposit_mode" value="none" defaultChecked /> No deposit for
              these visits
            </label>
            <label className="check-row">
              <input type="radio" name="deposit_mode" value="each" disabled={!depositsOn} /> Charge
              the deposit each time
            </label>
            <p className="muted small-text">
              {depositsOn
                ? "With a deposit, they get a “Pay your deposit” link by email. If it's still unpaid 48 hours before, the visit stays booked and is flagged on your Today page."
                : "Deposits are off (Settings → Deposits), so these visits have no deposit."}
            </p>
          </fieldset>

          {!client.email && (
            <p className="muted small-text">
              {client.name} has no email on their card, so they won&apos;t get confirmation or
              reminder emails. Tap Edit above to add one.
            </p>
          )}

          <div className="row">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton pendingText="Booking visits...">Set standing appointment</SubmitButton>
          </div>
          <FormMessage state={state?.error ? state : null} />
        </form>
      )}
    </div>
  );
}

