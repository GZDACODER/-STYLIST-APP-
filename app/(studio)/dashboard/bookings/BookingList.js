"use client";

// "Upcoming bookings": one slim row per booking under each day (time, name,
// service, price, small badges). Tapping a row opens the details in a
// panel: contact, deposit, and Cancel (or the standing visit controls).
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
import { outcomeLabel as exampleOutcome } from "@/lib/outcomes";
import { useEffect, useState } from "react";
import { clockTime, formatDate } from "@/lib/availability";
import { displayPhone } from "@/lib/phone";
import { formatPrice } from "@/lib/money";
import RegularStar from "@/components/RegularStar";
import Sheet from "@/components/Sheet";
import CancelBookingButton from "./CancelBookingButton";
import StandingVisitControls from "../standing/StandingVisitControls";
import { DepositBadge } from "./badges";
import RefundDepositButton from "./RefundDepositButton";
import Link from "next/link";
import { outcomeLabel } from "@/lib/outcomes";

const STATUS_LABELS = { regular: "Regular", new: "New", blocked: "Blocked" };

export function BookingRow({ booking: b, standing, onOpen }) {
  const status = b.client?.status;
  return (
    <li>
      <button type="button" className={b.example ? "client-row booking-row is-example" : "client-row booking-row"} onClick={onOpen} aria-haspopup="dialog">
        <span className="booking-row-time">
          <strong>{clockTime(b.start_time)}</strong>
          <span>{clockTime(b.end_time)}</span>
        </span>
        <span className="client-row-main">
          <span className="client-row-name">
            <span className="client-row-text">{b.client_name}</span>
            {status === "regular" && <RegularStar label="Regular" size={10} />}
            {status === "blocked" && <span className="badge blocked row-badge">Blocked</span>}
            {b.example && <ExampleTag />}
          </span>
          <span className="client-row-phone">
            {b.service_name} · {formatPrice(b.price_cents)}
          </span>
        </span>
        <span className="booking-row-badges">
          {standing && <span className="badge standing row-badge">Standing</span>}
          {b.moved && <span className="badge row-badge">Moved</span>}
          {b.client?.invited_at && <span className="badge invited row-badge">Invited</span>}
          <span className="row-badge-wrap">
            <DepositBadge booking={b} compact />
          </span>
        </span>
        <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
          <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </li>
  );
}

export function BookingDetails({ booking: b, seriesId, today }) {
  // Example bookings (lib/examples.js): read-only, no Cancel or Refund.
  if (b.example) {
    return (
      <ExampleCard
        title={b.client_name}
        facts={[
          ["What", `${b.service_name} · ${formatPrice(b.price_cents)}`],
          ["When", `${formatDate(b.booking_date)}, ${clockTime(b.start_time)} – ${clockTime(b.end_time)}`],
          ["Status", b.label],
          ["Deposit", b.deposit_cents ? `${formatPrice(b.deposit_cents)} ${b.deposit_status === "paid" ? "paid" : "due"}` : "None"],
          ["How it went", b.outcome ? exampleOutcome(b.outcome) : null],
          ["Note", b.visit_note],
        ]}
        addHref="/dashboard/openings#add-opening"
        addLabel="Open times so clients can book"
      />
    );
  }
  const status = b.client?.status;
  return (
    <div className="client-card booking-details">
      <div className="client-top">
        <div className="client-name">{b.client_name}</div>
        <span className="badge-row">
          {status && (
            <span className={`badge ${status}`}>
              {status === "regular" && (
                <>
                  <RegularStar label={null} />{" "}
                </>
              )}
              {STATUS_LABELS[status]}
            </span>
          )}
          {seriesId && <span className="badge standing">Standing</span>}
          {b.client?.invited_at && <span className="badge invited">Invited</span>}
        </span>
      </div>

      {b.moved && (
        <p className="message info small-text">
          Rescheduled by client
          {b.moved.originally ? ` · originally ${b.moved.originally}` : ""}
          {b.moved.count > 1 ? ` · moved ${b.moved.count} times` : ""}
        </p>
      )}

      <dl className="booking-facts">
        <div>
          <dt>When</dt>
          <dd>
            {b.booking_date === today ? "Today · " : ""}
            {formatDate(b.booking_date)}
            <br />
            {clockTime(b.start_time)} – {clockTime(b.end_time)}
          </dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>
            {b.service_name} · {formatPrice(b.price_cents)}
          </dd>
        </div>
        {b.intake && (
          <div>
            <dt>Intake form</dt>
            <dd>
              {b.intake.onFile ? (
                <span className="badge paid">On file</span>
              ) : (
                <span className="badge unpaid">Missing</span>
              )}
              {!b.intake.onFile && <span className="muted small-text"> They&apos;ll need to fill it in.</span>}
            </dd>
          </div>
        )}
        <div>
          <dt>Deposit</dt>
          <dd>
            <DepositBadge booking={b} />
            {b.deposit_status === "paid" && b.deposit_cents > 0 && (
              <div className="refund-row">
                <RefundDepositButton
                  id={b.id}
                  clientName={b.client_name}
                  depositCents={b.deposit_cents}
                  stillBooked
                />
              </div>
            )}
          </dd>
        </div>
      </dl>

      <div className="client-contact">
        <a href={`tel:${b.client_phone}`}>{displayPhone(b.client_phone)}</a>
        {b.client_email && <a href={`mailto:${b.client_email}`}>{b.client_email}</a>}
      </div>

      {b.past ? (
        <div className="booking-past">
          <p className="muted small-text">
            {b.outcome ? `How it went: ${outcomeLabel(b.outcome)}` : "Not marked yet."}
            {b.outcome === "completed_owed" && b.owed_cents != null && ` · ${formatPrice(b.owed_cents)} owed`}
          </p>
          {b.visit_note && <p className="visit-note-text">{b.visit_note}</p>}
          <Link href="/dashboard/notes" className="link-button quiet-link">
            {b.outcome ? "Notes" : "Mark it in Notes"}
          </Link>
        </div>
      ) : (
      <div className="client-delete">
        {seriesId ? (
          <StandingVisitControls
            booking={b}
            seriesId={seriesId}
            today={today}
            depositPaid={b.deposit_status === "paid"}
          />
        ) : (
          <CancelBookingButton
            id={b.id}
            clientName={b.client_name}
            serviceName={b.service_name}
            date={b.booking_date}
            startTime={b.start_time}
            depositPaid={b.deposit_status === "paid"}
          />
        )}
      </div>
      )}
    </div>
  );
}

// days: [{ date, bookings }]. seriesOf: { bookingId: seriesId }.
export default function BookingList({ days, seriesOf, today }) {
  const [openId, setOpenId] = useState(null);
  const openBooking = openId ? days.flatMap((d) => d.bookings).find((b) => b.id === openId) : null;

  // The open booking was cancelled (or its series ended): close the panel.
  useEffect(() => {
    if (openId && !openBooking) setOpenId(null);
  }, [openId, openBooking]);

  return (
    <>
      <ul className="day-list">
        {days.map((day) => (
          <li key={day.date} className="day-group">
            <div className="day-heading">
              <strong>{day.date === today ? `Today · ${formatDate(day.date)}` : formatDate(day.date)}</strong>
              <span className="muted small-text">
                {day.bookings.length === 1 ? "1 booking" : `${day.bookings.length} bookings`}
              </span>
            </div>
            <ul className="client-rows">
              {day.bookings.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  standing={Boolean(seriesOf[b.id])}
                  onOpen={() => setOpenId(b.id)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {openBooking && (
        <Sheet key={openBooking.id} label={openBooking.client_name} backLabel="Calendar" onClose={() => setOpenId(null)}>
          <BookingDetails booking={openBooking} seriesId={seriesOf[openBooking.id]} today={today} />
        </Sheet>
      )}
    </>
  );
}
