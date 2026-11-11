"use client";

// "Upcoming bookings": one slim row per booking under each day (time, name,
// service, price, small badges). Tapping a row opens the details in a
// panel: contact, deposit, and Cancel (or the standing visit controls).
import { useEffect, useState } from "react";
import { clockTime, formatDate } from "@/lib/availability";
import { displayPhone } from "@/lib/phone";
import { formatPrice } from "@/lib/money";
import RegularStar from "@/components/RegularStar";
import Sheet from "@/components/Sheet";
import CancelBookingButton from "./CancelBookingButton";
import StandingVisitControls from "../standing/StandingVisitControls";
import { DepositBadge } from "./badges";

const STATUS_LABELS = { regular: "Regular", new: "New", blocked: "Blocked" };

function BookingRow({ booking: b, standing, onOpen }) {
  const status = b.client?.status;
  return (
    <li>
      <button type="button" className="client-row booking-row" onClick={onOpen} aria-haspopup="dialog">
        <span className="booking-row-time">
          <strong>{clockTime(b.start_time)}</strong>
          <span>{clockTime(b.end_time)}</span>
        </span>
        <span className="client-row-main">
          <span className="client-row-name">
            <span className="client-row-text">{b.client_name}</span>
            {status === "regular" && <RegularStar label="Regular" size={10} />}
            {status === "blocked" && <span className="badge blocked row-badge">Blocked</span>}
          </span>
          <span className="client-row-phone">
            {b.service_name} · {formatPrice(b.price_cents)}
          </span>
        </span>
        <span className="booking-row-badges">
          {standing && <span className="badge standing row-badge">Standing</span>}
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

function BookingDetails({ booking: b, seriesId, today }) {
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
        <div>
          <dt>Deposit</dt>
          <dd>
            <DepositBadge booking={b} />
          </dd>
        </div>
      </dl>

      <div className="client-contact">
        <a href={`tel:${b.client_phone}`}>{displayPhone(b.client_phone)}</a>
        {b.client_email && <a href={`mailto:${b.client_email}`}>{b.client_email}</a>}
      </div>

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
