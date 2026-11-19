"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { book, getIntake, getMyDetails, getSlots, signOutBooking, submitIntake } from "../actions";
import { clockTime, formatDate, parseDateString, timeZoneLabel } from "@/lib/availability";
import { displayPhone, formatPhone } from "@/lib/phone";
import VerifyClient from "./VerifyClient";
import { maskEmail } from "@/lib/maskEmail";
import WaitlistForm from "./WaitlistForm";
import { loadDetails, saveDetails } from "@/lib/clientDetails";
import IntakeFields from "./IntakeFields";
import MyBookings from "./MyBookings";
import RegularStar from "@/components/RegularStar";

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

export default function BookingFlow({
  page,
  invite,
  paymentCancelled,
  waitlistReady,
  textsAvailable,
  textCodes,
  initialServiceId = null,
}) {
  const router = useRouter();
  const {
    business_name,
    slug,
    timezone,
    cancellation_policy: policy,
    viewer_status,
    viewer_email,
    viewer_phone,
    services,
    waitlist_enabled,
    regulars_only: regularsOnly,
    access,
    invite: inviteInfo,
  } = page;
  const verified = viewer_status !== "anonymous";
  // How they confirmed: their phone number (by text) or their email.
  const viewerLabel = viewer_phone ? formatPhone(viewer_phone) : maskEmail(viewer_email);
  // What clients confirm with a code: their phone (text codes on) or email.
  const confirmWhat = textCodes ? "phone number" : "email";
  // "Regulars only" mode: only Regulars (and clients with an invite link) can book.
  const locked = regularsOnly && access !== "regular" && access !== "invited";
  // The waitlist needs email set up for the app, and the stylist to have it on.
  // In "Regulars only" mode it's just for Regulars.
  const canWaitlist =
    waitlist_enabled && waitlistReady && (!regularsOnly || access === "regular");

  // "Book again" from My Pros (?service=...): that service is picked, and
  // the first day with open times is picked once they load.
  const [serviceId, setServiceId] = useState(() =>
    initialServiceId && !locked && services.some((s) => s.id === initialServiceId) ? initialServiceId : null
  );
  const pickFirstDate = useRef(Boolean(serviceId));
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Filled in from last time on this phone (lib/clientDetails).
  const who = verified ? viewer_email || viewer_phone : null;
  useEffect(() => {
    const saved = loadDetails(who);
    if (saved.name) setName((n) => n || saved.name);
    if (saved.phone) setPhone((v) => v || saved.phone);
    if (saved.email) setEmail((v) => v || saved.email);
  }, [who]);
  const [redirecting, setRedirecting] = useState(false);
  const [bookError, setBookError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  // Bumped to reload open times and "Your upcoming appointments".
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();
  // The intake form for the chosen service, if this client still needs it.
  const [intake, setIntake] = useState(null);
  const [intakeValue, setIntakeValue] = useState({ answers: {}, signedName: "", agreed: false });

  const service = services.find((s) => s.id === serviceId);
  const deposit = service?.deposit_cents || 0;

  // Load open times when a service is picked, and again after the visitor
  // verifies (regulars may see more times).
  useEffect(() => {
    if (!serviceId) return;
    let ignore = false;
    setSlots(null);
    setSlotsError(null);
    getSlots(slug, serviceId, invite).then((result) => {
      if (ignore) return;
      if (result.error) setSlotsError(result.error);
      else setSlots(result.slots);
    });
    return () => {
      ignore = true;
    };
  }, [slug, serviceId, invite, viewer_status, viewer_email, viewer_phone, reloadKey]);

  // Does this service need the intake form (and does this client still need
  // to fill it in)? Checked again after they confirm who they are.
  useEffect(() => {
    if (!serviceId || !verified) {
      setIntake(null);
      return;
    }
    let ignore = false;
    getIntake(slug, serviceId).then((result) => {
      if (!ignore) setIntake(result?.needed ? result : null);
    });
    return () => {
      ignore = true;
    };
  }, [slug, serviceId, verified, viewer_email, viewer_phone]);

  // Arrived from "Book again": pick the first day with open times.
  useEffect(() => {
    if (!pickFirstDate.current || !slots) return;
    pickFirstDate.current = false;
    if (slots.length && !date) setDate(slots[0].slot_date);
    // Straight to the times, past the service list.
    setTimeout(() => document.getElementById("bk-times")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [slots, date]);

  // Returning clients: their name and phone from last time.
  useEffect(() => {
    if (!verified) return;
    let ignore = false;
    getMyDetails(slug).then((d) => {
      if (ignore || !d) return;
      if (d.name) setName((n) => n || d.name);
      if (d.phone) setPhone((p) => p || displayPhone(d.phone));
    });
    return () => {
      ignore = true;
    };
  }, [slug, verified, viewer_email, viewer_phone]);

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
    setAgreed(false);
    setShowWaitlist(false);
  }

  function submitBooking(event) {
    event.preventDefault();
    setBookError(null);
    startTransition(async () => {
      if (intake?.needed) {
        const saved = await submitIntake(slug, serviceId, intakeValue.answers, intakeValue.signedName);
        if (saved.error) {
          setBookError(saved.error);
          return;
        }
        setIntake(null);
      }
      const result = await book({
        slug,
        serviceId,
        date,
        time,
        name,
        // Texted clients already proved their number, so it's used as is.
        phone: viewer_phone ? formatPhone(viewer_phone) : phone,
        email: viewer_phone ? email : "",
        invite,
      });
      if (result.error) {
        setBookError(result.error);
        if (result.code === "slot_unavailable") {
          const fresh = await getSlots(slug, serviceId, invite);
          if (fresh.slots) setSlots(fresh.slots);
          setTime(null);
        }
        return;
      }
      if (result.checkoutUrl) {
        saveDetails(who, { name, phone, email });
        // Off to Stripe to pay the deposit. The time is held meanwhile.
        setRedirecting(true);
        window.location.assign(result.checkoutUrl);
        return;
      }
      saveDetails(who, { name, phone, email });
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
    setReloadKey((k) => k + 1);
  }

  const zoneNote = `Times are in ${timeZoneLabel(timezone)} time.`;

  // ---------- Booked! ----------
  if (confirmation) {
    return (
      <section className="card confirmation">
        <h2>You&apos;re booked.</h2>
        <p>
          <strong>{confirmation.service_name}</strong> with {confirmation.business_name}
          <br />
          {formatDate(confirmation.booking_date)}
          <br />
          {clockTime(confirmation.start_time)} – {clockTime(confirmation.end_time)}
        </p>
        <p className="muted small-text">
          {zoneNote} To cancel, come back to this page. To change it, please contact{" "}
          {business_name} directly.
        </p>
        <button type="button" className="button secondary" onClick={bookAnother}>
          Book another appointment
        </button>
        <p className="muted small-text bk-mypros-note">
          All your appointments, with every pro you book on Clientele, are in{" "}
          <Link href="/my">My Pros</Link>. Add it to your home screen to book again in a couple of taps.
        </p>
      </section>
    );
  }

  // ---------- Blocked ----------
  if (viewer_status === "blocked") {
    return (
      <section className="card">
        <p>
          Online booking isn&apos;t available for {viewerLabel}. Please contact {business_name}{" "}
          directly.
        </p>
        <button type="button" className="link-button" onClick={notMe} disabled={pending}>
          {textCodes ? "Not you? Use a different number" : "Not you? Use a different email"}
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
      {paymentCancelled && (
        <p className="message warning">
          The deposit wasn&apos;t paid, so that time wasn&apos;t booked. You can pick a time again.
        </p>
      )}

      {/* ---------- Invite link ---------- */}
      {inviteInfo?.state === "open" && access === "invited" && (
        <p className="message success">
          {inviteInfo.name ? `Hi ${inviteInfo.name}! ` : ""}You&apos;re invited to book with{" "}
          {business_name}. This link works for one booking.
        </p>
      )}
      {inviteInfo && inviteInfo.state !== "open" && access !== "regular" && (
        <p className="message warning">
          {inviteInfo.state === "used"
            ? "This invite link has already been used to book."
            : inviteInfo.state === "busy"
              ? "Someone is booking with this invite link right now. Try again in half an hour."
              : inviteInfo.state === "invalid"
                ? "This invite link doesn't work. Check you have the whole link."
                : "This invite link has expired."}{" "}
          Please contact {business_name} for a new one.
        </p>
      )}

      {/* ---------- Who's booking ---------- */}
      {viewer_status === "regular" && (
        <p className="message regular">
          <RegularStar label={null} size={13} /> Welcome back. As a Regular, you also see the
          times kept for Regulars, marked with the gold star.{" "}
          <button type="button" className="link-button" onClick={notMe} disabled={pending}>
            Not {viewerLabel}?
          </button>{" "}
          · <Link href="/my">My Pros</Link>
        </p>
      )}
      {(viewer_status === "new" || viewer_status === "unknown") && (
        <p className="message info">
          Booking as {viewerLabel}.{" "}
          <button type="button" className="link-button" onClick={notMe} disabled={pending}>
            Not you?
          </button>{" "}
          · <Link href="/my">My Pros</Link>
        </p>
      )}
      {verified && (
        <MyBookings
          slug={slug}
          businessName={business_name}
          policy={policy}
          zoneNote={zoneNote}
          refreshKey={`${viewer_status}-${viewerLabel}-${reloadKey}`}
          onCancelled={() => setReloadKey((k) => k + 1)}
        />
      )}
      {/* ---------- Regulars only ---------- */}
      {locked && (
        <section className="card">
          <h2>
            <RegularStar label={null} size={16} /> Online booking is for Regulars
          </h2>
          {verified ? (
            <p className="muted">
              Right now, {business_name} takes online bookings from regulars only. Please contact{" "}
              {business_name} directly to book.
            </p>
          ) : (
            <>
              <p className="muted">
                Right now, {business_name} takes online bookings from regulars only. If you&apos;re
                a regular, confirm your {confirmWhat} to see your times.
              </p>
              <VerifyClient onVerified={refreshAfterLogin} textCodes={textCodes} />
            </>
          )}
        </section>
      )}

      {!verified && !time && !showWaitlist && !locked && access !== "invited" && (
        <section className="card">
          {showVerify ? (
            <>
              <h2>Confirm your {confirmWhat}</h2>
              <p className="muted">
                <RegularStar label={null} /> Regulars see extra times once they confirm.
              </p>
              <VerifyClient onVerified={refreshAfterLogin} textCodes={textCodes} />
            </>
          ) : (
            <p className="regular-prompt">
              <RegularStar label={null} /> Already a Regular?{" "}
              <button type="button" className="link-button" onClick={() => setShowVerify(true)}>
                Confirm your {confirmWhat} to see all your times
              </button>
            </p>
          )}
        </section>
      )}

      {/* ---------- 1. Service ---------- */}
      {!locked && (
        <section className="card">
          <h2>
            <span className="bk-num">01</span>Service
          </h2>
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
                <span className="choice-price">{formatPrice(s.price_cents)}</span>
                <span className="choice-meta">
                  {formatMinutes(s.duration_minutes)}
                  {s.deposit_cents > 0 && ` · ${formatPrice(s.deposit_cents)} deposit`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 2. Time ---------- */}
      {service && !locked && (
        <section className="card" id="bk-times">
          <h2>
            <span className="bk-num">02</span>Date &amp; time
          </h2>
          <p className="muted small-text">{zoneNote}</p>
          {!slots && !slotsError && <p className="muted">Loading open times...</p>}
          {slotsError && <p className="message error">{slotsError}</p>}
          {slots && dates.length === 0 && (
            <p className="muted">
              No open times right now.{" "}
              {canWaitlist
                ? "Join the waitlist below and we'll tell you when one opens up."
                : "Please check back soon."}
              {!verified &&
                ` If you're a regular, confirm your ${confirmWhat} above to see more times.`}
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
                    <span className="date-weekday">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                      {d.early && (
                        <span className="early-star">
                          <RegularStar label="Has Regulars-only times" size={9} />
                        </span>
                      )}
                    </span>
                    <strong className="date-day">{day.getDate()}</strong>
                    <span className="date-month">
                      {day.toLocaleDateString("en-US", { month: "short" })}
                    </span>
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
              {times.some((s) => s.visibility === "regulars") && (
                <p className="bk-key">
                  <RegularStar label={null} /> Regulars only
                </p>
              )}
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
                    {s.visibility === "regulars" && <RegularStar />}
                  </button>
                ))}
              </div>
            </>
          )}

          {canWaitlist && slots && !showWaitlist && (
            <div className="waitlist-prompt">
              <p>{dates.length ? "None of these times work?" : "Want to hear when a time opens up?"}</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setShowWaitlist(true);
                  setTime(null);
                }}
              >
                Join the waitlist
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---------- Waitlist ---------- */}
      {service && !locked && showWaitlist && (
        <section className="card">
          <h2>
            <span className="bk-num">—</span>Waitlist
          </h2>
          <p className="bk-lede">{service.name}</p>
          <WaitlistForm
            slug={slug}
            service={service}
            verified={verified}
            viewerPhone={viewer_phone}
            viewerEmail={viewer_email}
            textsAvailable={textsAvailable}
            textCodes={textCodes}
            onVerified={refreshAfterLogin}
            onClose={() => setShowWaitlist(false)}
          />
        </section>
      )}

      {/* ---------- 3. Details ---------- */}
      {service && !locked && date && time && !showWaitlist && (
        <section className="card">
          <h2>
            <span className="bk-num">03</span>Your details
          </h2>
          <p className="summary">
            <strong>{service.name}</strong>
            <br />
            {formatDate(date)} at {clockTime(time)}
          </p>

          {!verified ? (
            <>
              <p className="muted">
                {textCodes
                  ? "To book, confirm your mobile number. We'll text you a code."
                  : "To book, confirm your email. We'll email you a code."}
              </p>
              <VerifyClient onVerified={refreshAfterLogin} textCodes={textCodes} />
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
              {viewer_phone ? (
                <>
                  <label>
                    Email (optional, for your receipt)
                    <input
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <p className="muted small-text">Phone: {viewerLabel}</p>
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
                  <p className="muted small-text">
                    Your mobile number is how {business_name} knows it&apos;s you. Email:{" "}
                    {maskEmail(viewer_email)}
                  </p>
                </>
              )}

              {intake?.needed && (
                <IntakeFields intake={intake} businessName={business_name} value={intakeValue} onChange={setIntakeValue} />
              )}

              {policy && (
                <div className="policy">
                  <h3>Cancellation policy</h3>
                  <p>{policy}</p>
                </div>
              )}

              {deposit > 0 ? (
                <>
                  <p className="message info">
                    A {formatPrice(deposit)} deposit is due now to book.
                    {service.price_cents > deposit &&
                      ` The other ${formatPrice(service.price_cents - deposit)} is paid at your appointment.`}{" "}
                    You&apos;ll pay securely on Stripe by card, or with Apple Pay or Google Pay
                    on phones that have it. If you don&apos;t pay, the time isn&apos;t booked.
                  </p>
                  {policy && (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        required
                      />
                      I&apos;ve read and agree to the cancellation policy
                    </label>
                  )}
                  <button type="submit" className="button" disabled={pending || redirecting}>
                    {pending || redirecting
                      ? "Opening payment..."
                      : `Pay ${formatPrice(deposit)} deposit`}
                  </button>
                </>
              ) : (
                <button type="submit" className="button" disabled={pending}>
                  {pending ? "Booking..." : "Book appointment"}
                </button>
              )}
              {bookError && <p className="message error">{bookError}</p>}
            </form>
          )}
        </section>
      )}
    </>
  );
}
