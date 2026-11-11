"use client";

// The Calendar tab: a full month calendar (the default) or the list of
// upcoming bookings. The month view goes 12 months back and 12 ahead; each
// day shows its bookings (time and first name on iPad and computer, a count
// on phones), days off and blocked dates are shaded, and today is gold.
// Tapping a day lists its bookings underneath; tapping one opens it.
import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS, clockTime, formatDate, parseDateString, shortTime, toDateString } from "@/lib/availability";
import Sheet from "@/components/Sheet";
import BookingList, { BookingDetails, BookingRow } from "./BookingList";

const MONTHS_BACK = 12;
const MONTHS_AHEAD = 12;

const firstName = (name) => String(name || "").trim().split(/\s+/)[0];
const monthIndex = (dateText) => {
  const [y, m] = dateText.split("-").map(Number);
  return y * 12 + (m - 1);
};

// bookings: confirmed bookings from 12 months back on, each with `past`.
// days / seriesOf / today: as BookingList takes them.
// hours: { weekday: { is_working, start_time, end_time } }; blocked: { "YYYY-MM-DD": reason }
export default function CalendarView({ bookings, days, seriesOf, today, hours, blocked }) {
  const [view, setView] = useState("month");
  const [month, setMonth] = useState(() => monthIndex(today));
  const [selected, setSelected] = useState(today);
  const [openId, setOpenId] = useState(null);

  const byDate = useMemo(() => {
    const map = {};
    for (const b of bookings) (map[b.booking_date] ||= []).push(b);
    return map;
  }, [bookings]);

  const openBooking = openId ? bookings.find((b) => b.id === openId) : null;
  useEffect(() => {
    if (openId && !openBooking) setOpenId(null);
  }, [openId, openBooking]);

  const thisMonth = monthIndex(today);
  const year = Math.floor(month / 12);
  const monthNum = month % 12;
  const monthStart = new Date(year, monthNum, 1);
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  // Columns start on Monday.
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const hasHours = Object.keys(hours).length > 0;

  function dayKind(dateText) {
    if (blocked[dateText] !== undefined) return "blocked";
    const h = hours[parseDateString(dateText).getDay()];
    if (hasHours && h && !h.is_working) return "off";
    return "";
  }

  function goTo(newMonth) {
    setMonth(newMonth);
    // Keep a day selected in the month on show: today there, else the 1st.
    if (newMonth === thisMonth) setSelected(today);
    else {
      const y = Math.floor(newMonth / 12);
      const m = newMonth % 12;
      setSelected(toDateString(new Date(y, m, 1)));
    }
  }

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(<div key={`b${i}`} className="mc-cell blank" aria-hidden="true" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateText = toDateString(new Date(year, monthNum, d));
    const list = byDate[dateText] || [];
    const kind = dayKind(dateText);
    const classes = ["mc-cell", kind];
    if (dateText < today) classes.push("past");
    if (dateText === today) classes.push("today");
    if (dateText === selected) classes.push("selected");
    const label = `${formatDate(dateText)}: ${
      list.length === 0 ? "no bookings" : list.length === 1 ? "1 booking" : `${list.length} bookings`
    }${kind === "blocked" ? ", blocked" : kind === "off" ? ", day off" : ""}`;
    cells.push(
      <button
        key={dateText}
        type="button"
        className={classes.join(" ")}
        aria-label={label}
        aria-pressed={dateText === selected}
        onClick={() => setSelected(dateText)}
      >
        <span className="mc-num">{d}</span>
        {list.length > 0 && <span className="mc-count">{list.length}</span>}
        <span className="mc-items">
          {list.slice(0, 3).map((b) => (
            <span key={b.id} className="mc-item">
              <b>{shortTime(String(b.start_time).slice(0, 5)).replace(/ /g, "")}</b> {firstName(b.client_name)}
            </span>
          ))}
          {list.length > 3 && <span className="mc-more">+{list.length - 3} more</span>}
          {list.length === 0 && kind === "blocked" && <span className="mc-tag">Blocked</span>}
          {list.length === 0 && kind === "off" && <span className="mc-tag">Off</span>}
        </span>
      </button>
    );
  }

  const dayList = byDate[selected] || [];
  const selKind = dayKind(selected);
  const selHours = hours[parseDateString(selected).getDay()];

  return (
    <>
      <div className="mc-top">
        <div className="segmented notes-mode" role="group" aria-label="Calendar view">
          {[
            { value: "month", label: "Month" },
            { value: "list", label: "List" },
          ].map((v) => (
            <button
              key={v.value}
              type="button"
              className={`segment${view === v.value ? " checked" : ""}`}
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? (
        days.length === 0 ? (
          <p className="muted">No upcoming bookings.</p>
        ) : (
          <BookingList days={days} seriesOf={seriesOf} today={today} />
        )
      ) : (
        <>
          <div className="mc-header">
            <button
              type="button"
              className="button secondary small"
              onClick={() => goTo(month - 1)}
              disabled={month <= thisMonth - MONTHS_BACK}
              aria-label="Previous month"
            >
              ‹
            </button>
            <h3>{monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
            <button
              type="button"
              className="button secondary small"
              onClick={() => goTo(month + 1)}
              disabled={month >= thisMonth + MONTHS_AHEAD}
              aria-label="Next month"
            >
              ›
            </button>
            {month !== thisMonth && (
              <button type="button" className="link-button mc-today" onClick={() => goTo(thisMonth)}>
                Today
              </button>
            )}
          </div>

          <div className="mc-grid">
            {WEEKDAYS.map((w) => (
              <div key={w.dow} className="mc-weekday">
                {w.short}
              </div>
            ))}
            {cells}
          </div>

          <div className="mc-legend">
            <span>
              <i className="mc-swatch today" /> Today
            </span>
            <span>
              <i className="mc-swatch off" /> Day off
            </span>
            <span>
              <i className="mc-swatch blocked" /> Blocked
            </span>
          </div>

          <div className="mc-day">
            <div className="day-heading">
              <strong>{selected === today ? `Today · ${formatDate(selected)}` : formatDate(selected)}</strong>
              <span className="muted small-text">
                {dayList.length === 1 ? "1 booking" : `${dayList.length} bookings`}
              </span>
            </div>
            {selKind === "blocked" && (
              <p className="muted small-text">Blocked{blocked[selected] ? `: ${blocked[selected]}` : ""}</p>
            )}
            {selKind === "off" && <p className="muted small-text">Day off (from your working hours)</p>}
            {!selKind && hasHours && selHours?.is_working && dayList.length === 0 && (
              <p className="muted small-text">
                Working {clockTime(selHours.start_time)} – {clockTime(selHours.end_time)}. No bookings.
              </p>
            )}
            {!selKind && !(hasHours && selHours?.is_working) && dayList.length === 0 && (
              <p className="muted small-text">No bookings.</p>
            )}
            {dayList.length > 0 && (
              <ul className="client-rows">
                {dayList.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    standing={Boolean(seriesOf[b.id])}
                    onOpen={() => setOpenId(b.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {openBooking && (
        <Sheet key={openBooking.id} label={openBooking.client_name} backLabel="Calendar" onClose={() => setOpenId(null)}>
          <BookingDetails booking={openBooking} seriesId={seriesOf[openBooking.id]} today={today} />
        </Sheet>
      )}
    </>
  );
}
