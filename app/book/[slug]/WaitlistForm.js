"use client";

import { useState, useTransition } from "react";
import { joinWaitlist } from "../actions";
import { WEEKDAYS } from "@/lib/availability";
import { PARTS_OF_DAY } from "@/lib/preferences";
import { formatPhone } from "@/lib/phone";
import VerifyClient from "./VerifyClient";

// Join the waitlist for one service: pick days and times of day, confirm
// your phone number, and we'll email you when a time opens up.
export default function WaitlistForm({
  slug,
  service,
  verified,
  viewerPhone,
  viewerEmail,
  textsAvailable,
  onVerified,
  onClose,
}) {
  const [days, setDays] = useState([]);
  const [times, setTimes] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [textOk, setTextOk] = useState(false);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(null);
  const [pending, startTransition] = useTransition();

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function submit(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlist({
        slug,
        serviceId: service.id,
        name,
        // Texted clients already proved their number, so it's used as is.
        phone: viewerPhone ? formatPhone(viewerPhone) : phone,
        email: viewerPhone ? email : "",
        days,
        times,
        textOk: textsAvailable && textOk,
      });
      if (result.error) setError(result.error);
      else setJoined(result.joined);
    });
  }

  if (joined) {
    return (
      <>
        <p className="message success">
          {joined.updated ? "Your waitlist spot is updated." : "You're on the waitlist!"}{" "}
          {joined.email
            ? `We'll email ${joined.email} as soon as a time you'd like opens up.`
            : "We'll text you as soon as a time you'd like opens up."}{" "}
          First to claim it gets it.
        </p>
        {joined.matching > 0 && (
          <p className="message info">
            Good news:{" "}
            {joined.matching === 1
              ? "a time that matches what you picked is open right now."
              : `${joined.matching} times that match what you picked are open right now.`}{" "}
            Look above to book one.
          </p>
        )}
        <button type="button" className="link-button" onClick={onClose}>
          Done
        </button>
      </>
    );
  }

  return (
    <>
      <p className="muted">
        Tell us when suits you. Leave everything unticked if any time works.
      </p>

      <fieldset className="wish-group">
        <legend>Days</legend>
        <div className="filter-chips">
          {WEEKDAYS.map((d) => (
            <button
              key={d.dow}
              type="button"
              className={days.includes(d.dow) ? "chip active" : "chip"}
              aria-pressed={days.includes(d.dow)}
              onClick={() => toggle(days, setDays, d.dow)}
            >
              {d.short}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="wish-group">
        <legend>Times of day</legend>
        <div className="filter-chips">
          {PARTS_OF_DAY.map((p) => (
            <button
              key={p.value}
              type="button"
              className={times.includes(p.value) ? "chip active" : "chip"}
              aria-pressed={times.includes(p.value)}
              onClick={() => toggle(times, setTimes, p.value)}
            >
              {p.label} <span className="small-text">({p.hint})</span>
            </button>
          ))}
        </div>
      </fieldset>

      {!verified ? (
        <>
          <p className="muted">
            First, confirm your mobile number. We&apos;ll text you a code.
          </p>
          <VerifyClient onVerified={onVerified} />
        </>
      ) : (
        <form onSubmit={submit}>
          <label>
            Your name
            <input
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {viewerPhone ? (
            <>
              <label>
                Email (we&apos;ll email you when a time opens up)
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={!(textsAvailable && textOk)}
                />
              </label>
              <p className="muted small-text">Phone: {formatPhone(viewerPhone)}</p>
            </>
          ) : (
            <>
              <label>
                Phone
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <p className="muted small-text">We&apos;ll email {viewerEmail}.</p>
            </>
          )}
          {textsAvailable && (
            <label className="check-row">
              <input type="checkbox" checked={textOk} onChange={(e) => setTextOk(e.target.checked)} />
              Text me too when a time opens up. Message and data rates may apply. Reply STOP to
              stop.
            </label>
          )}
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Joining..." : "Join the waitlist"}
          </button>
          {error && <p className="message error">{error}</p>}
        </form>
      )}
      <button type="button" className="link-button" onClick={onClose}>
        Never mind
      </button>
    </>
  );
}
