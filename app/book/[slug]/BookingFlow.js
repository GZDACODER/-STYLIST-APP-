"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { book, getSlots, signOutBooking } from "../actions";
import { clockTime, formatDate, parseDateString, timeZoneLabel } from "@/lib/availability";
import VerifyEmail from "./VerifyEmail";

// How many dates to show before "More dates".
const FIRST_DATES = 12;

function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

export default function BookingFlow({ page }) {
  const router = useRouter();
  const { business_name, slug, timezone, viewer_status, viewer_email, services } = page;
  const verified = viewer_status !== "anonymous";

  const [serviceId, setServiceId] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookError, setBookError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [pending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId);

  // Load open times when a service is picked, and again after the visitor
  // verifies (regulars may see more times).
  useEffect(() => {
    if (!serviceId) return;
    let ignore = false;
    setSlots(null);
    setSlotsError(null);
    getSlots(slug, serviceId).then((result) => {
      if (ignore) return;
      if (result.error) setSlotsError(result.error);
      else setSlots(result.slots);
    });
    return () => {
      ignore = true;
    };
  }, [slug, serviceId, viewer_status, viewer_email]);

  // If the chosen time disappeared after a reload, clear it.
  useEffect(() => {
    if (!slots || !time) return;
    const stillThere = slots.some((s) => s.slot_date === date && s.slot_time === time);
    if (!stillThere) setTime(null);
  }, [slots, date, time]);

  function refreshAfterLogin() {
    setShowVerify(false);
    router.refresh();
  }

  function notMe() {
    startTransition(async () => {
      await signOutBooking();
      router.refresh();
    });
  }

  function chooseService(id) {
    setServiceId(id);
    setDate(null);
    setTime(null);
    setShowAllDates(false);
    setBookError(null);
  }

  function submitBooking(event) {
    event.preventDefault();
    setBookError(null);
    startTransition(async () => {
      const result = await book({ slug, serviceId, date, time, name, phone });
      if (result.error) {
        setBookError(result.error);
        if (result.code === "slot_unavailable") {
          const fresh = await getSlots(slug, serviceId);
          if (fresh.slots) setSlots(fresh.slots);
          setTime(null);
        }
        return;
      }
      setConfirmation(result.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function bookAnother() {
    setConfirmation(null);
    setServiceId(null);
    setDate(null);
    setTime(null);
    setSlots(null);
  }

  const zoneNote = `Times are in ${timeZoneLabel(timezone)} time.`;

  // ---------- Booked! ----------
  if (confirmation) {
    return (
      <section className="card confirmation">
        <h2>You&apos;re booked!</h2>
        <p>
          <strong>{confirmation.service_name}</strong> with {confirmation.business_name}
          <br />
          {formatDate(confirmation.booking_date)}
          <br />
          {clockTime(confirmation.start_time)} – {clockTime(confirmation.end_time)}
        </p>
        <p className="muted small-text">
          {zoneNote} To change or cancel, please contact {business_name} directly.
        </p>
        <button type="button" className="button secondary" onClick={bookAnother}>
          Book another appointment
        </button>
      </section>
    );
  }

  // ---------- Blocked ----------
  if (viewer_status === "blocked") {
    return (
      <section className="card">
        <p>
          Online booking isn&apos;t available for {viewer_email}. Please contact {business_name}{" "}
          directly.
        </p>
        <button type="button" className="link-button" onClick={notMe} disabled={pending}>
          Not you? Use a different email
        </button>
      </section>
    );
  }

  // Dates that have at least one open time, in order.
  const dates = [];
  for (const s of slots || []) {
    const last = dates[dates.length - 1];
    if (last && last.date === s.slot_date) {
      if (s.visibility === "regulars") last.early = true;
    } else {
      dates.push({ date: s.slot_date, early: s.visibility === "regulars" });
    }
  }
  const visibleDates = showAllDates ? dates : dates.slice(0, FIRST_DATES);
  const times = (slots || []).filter((s) => s.slot_date === date);

  return (
    <>
      {/* ---------- Who's booking ---------- */}
      {viewer_status === "regular" && (
        <p className="message success">
          Welcome back! As a regular, you can see times saved just for regulars (marked ★).{" "}
          <button type="button" className="link-button" onClick={notMe} disabled={pending}>
            Not {viewer_email}?
          </button>
        </p>
      )}
      {(viewer_status === "new" || viewer_status === "unknown") && (
        <p className="message info">
          Booking as {viewer_email}.{" "}
          <button type="button" className="link-button" onClick={notMe} disabled={pending}>
            Not you?
          </button>
        </p>
      )}
      {!verified && !time && (
        <section className="card">
          {showVerify ? (
            <>
              <h2>Confirm your email</h2>
              <p className="muted">Regulars see extra times once they confirm.</p>
              <VerifyEmail onVerified={refreshAfterLogin} />
            </>
          ) : (
            <p className="regular-prompt">
              Already a regular?{" "}
              <button type="button" className="link-button" onClick={() => setShowVerify(true)}>
                Confirm your email to see all your times
              </button>
            </p>
          )}
        </section>
      )}

      {/* ---------- 1. Service ---------- */}
      <section className="card">
        <h2>1. Choose a service</h2>
        {services.length === 0 && <p className="muted">No services are listed yet.</p>}
        <div className="choice-list">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === serviceId ? "choice selected" : "choice"}
              aria-pressed={s.id === serviceId}
              onClick={() => chooseService(s.id)}
            >
              <span className="service-name">{s.name}</span>
              <span className="muted">
                {formatMinutes(s.duration_minutes)} · {formatPrice(s.price_cents)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- 2. Time ---------- */}
      {service && (
        <section className="card">
          <h2>2. Choose a time</h2>
          <p className="muted small-text">{zoneNote}</p>
          {!slots && !slotsError && <p className="muted">Loading open times...</p>}
          {slotsError && <p className="message error">{slotsError}</p>}
          {slots && dates.length === 0 && (
            <p className="muted">
              No open times right now. Please check back soon.
              {!verified && " If you're a regular, confirm your email above to see more times."}
            </p>
          )}

          {dates.length > 0 && (
            <div className="date-grid">
              {visibleDates.map((d) => {
                const day = parseDateString(d.date);
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={d.date === date ? "date-choice selected" : "date-choice"}
                    aria-pressed={d.date === date}
                    onClick={() => {
                      setDate(d.date);
                      setTime(null);
                    }}
                  >
                    <span className="small-text">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <strong>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
                    {d.early && <span className="early-star" aria-label="Has regulars-only times">★</span>}
                  </button>
                );
              })}
            </div>
          )}
          {dates.length > FIRST_DATES && !showAllDates && (
            <button type="button" className="link-button" onClick={() => setShowAllDates(true)}>
              More dates
            </button>
          )}

          {date && (
            <>
              <h3 className="list-title">{formatDate(date)}</h3>
              <div className="time-grid">
                {times.map((s) => (
                  <button
                    key={s.slot_time}
                    type="button"
                    className={[
                      "time-choice",
                      s.visibility === "regulars" ? "early" : "",
                      s.slot_time === time ? "selected" : "",
                    ].join(" ")}
                    aria-pressed={s.slot_time === time}
                    onClick={() => setTime(s.slot_time)}
                  >
                    {clockTime(s.slot_time)}
                    {s.visibility === "regulars" && <span aria-label="Regulars only"> ★</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------- 3. Details ---------- */}
      {service && date && time && (
        <section className="card">
          <h2>3. Your details</h2>
          <p className="summary">
            <strong>{service.name}</strong>
            <br />
            {formatDate(date)} at {clockTime(time)}
          </p>

          {!verified ? (
            <>
              <p className="muted">To book, confirm your email. We&apos;ll send you a code.</p>
              <VerifyEmail onVerified={refreshAfterLogin} />
            </>
          ) : (
            <form onSubmit={submitBooking}>
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
              <p className="muted small-text">Email: {viewer_email}</p>
              <button type="submit" className="button" disabled={pending}>
                {pending ? "Booking..." : "Book appointment"}
              </button>
              {bookError && <p className="message error">{bookError}</p>}
            </form>
          )}
        </section>
      )}
    </>
  );
}
