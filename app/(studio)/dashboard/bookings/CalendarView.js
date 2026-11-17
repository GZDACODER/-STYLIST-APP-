"use client";

// The Calendar tab: a full month calendar (the default) or the list of
// upcoming bookings. The month view goes 12 months back and 12 ahead; each
// day shows its bookings (time and first name on iPad and computer, a count
// on phones), days off and blocked dates are shaded, and today is gold.
// Holidays and the stylist's own events (birthdays, practices...) show too.
// Tapping a day lists its holidays, events and bookings underneath; tapping
// one opens it, and "Add event" adds one on that day.
import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS, clockTime, formatDate, parseDateString, shortTime, toDateString } from "@/lib/availability";
import Sheet from "@/components/Sheet";
import BookingList, { BookingDetails, BookingRow } from "./BookingList";
import { EventDetails, EventForm } from "./CalendarEvents";
import { colorOf, eventOccursOn, eventsOn } from "@/lib/calendarEvents";
import { holidaysOn } from "@/lib/holidays";
import { HolidayDayControls } from "../settings/HolidaySettings";

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
// events: the stylist's calendar_events rows (null before the step 29 SQL is run).
// closedHolidays: keys of the federal holidays the business closes on.
// openAdd: open "Add event" straight away (the page header's + Add event).
export default function CalendarView({ bookings, days, seriesOf, today, hours, blocked, events, closedHolidays = [], openAdd = false }) {
  const closedSet = new Set(closedHolidays);
  // A federal holiday the business is closed on: every year (Settings), or
  // just this date (a blocked date saved as "Closed – Thanksgiving").
  const closedOn = (dateText) =>
    holidaysOn(dateText).find(
      (h) => h.key && (closedSet.has(h.key) || blocked[dateText] === `Closed – ${h.name}`)
    );
  const [view, setView] = useState("month");
  const [month, setMonth] = useState(() => monthIndex(today));
  const [selected, setSelected] = useState(today);
  const [openId, setOpenId] = useState(null);
  // The event panel: { mode: "add" } or { mode: "view" | "edit", id }.
  const [eventSheet, setEventSheet] = useState(() => (openAdd && events ? { mode: "add" } : null));
  const eventList = events || [];
  const openEvent = eventSheet?.id ? eventList.find((e) => e.id === eventSheet.id) : null;

  const byDate = useMemo(() => {
    const map = {};
    for (const b of bookings) (map[b.booking_date] ||= []).push(b);
    return map;
  }, [bookings]);

  const openBooking = openId ? bookings.find((b) => b.id === openId) : null;
  useEffect(() => {
    if (openId && !openBooking) setOpenId(null);
  }, [openId, openBooking]);
  // The open event was deleted (or just this date of it): close its panel.
  const eventGone =
    Boolean(eventSheet?.id) &&
    (!openEvent || (eventSheet.mode === "view" && !eventOccursOn(openEvent, selected)));
  useEffect(() => {
    if (eventGone) setEventSheet(null);
  }, [eventGone]);

  const thisMonth = monthIndex(today);
  const year = Math.floor(month / 12);
  const monthNum = month % 12;
  const monthStart = new Date(year, monthNum, 1);
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  // Columns start on Monday.
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const hasHours = Object.keys(hours).length > 0;

  function dayKind(dateText) {
    // Closed for a holiday: shaded like a day off.
    if (closedOn(dateText)) return "off";
    if (blocked[dateText] !== undefined) return "blocked";
    const h = hours[parseDateString(dateText).getDay()];
    if (hasHours && h && !h.is_working) return "off";
    return "";
  }

  function closeEventSheet() {
    setEventSheet(null);
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
    const dayEvents = eventsOn(eventList, dateText);
    const holidays = holidaysOn(dateText);
    const kind = dayKind(dateText);
    const classes = ["mc-cell", kind];
    if (dateText < today) classes.push("past");
    if (dateText === today) classes.push("today");
    if (dateText === selected) classes.push("selected");
    const label = `${formatDate(dateText)}: ${
      list.length === 0 ? "no bookings" : list.length === 1 ? "1 booking" : `${list.length} bookings`
    }${kind === "blocked" ? ", blocked" : kind === "off" ? ", day off" : ""}${
      holidays.length ? `, ${holidays.map((h) => h.name).join(", ")}` : ""
    }${dayEvents.length ? `, ${dayEvents.length === 1 ? "1 event" : `${dayEvents.length} events`}` : ""}`;
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
        {(dayEvents.length > 0 || holidays.length > 0) && (
          <span className="mc-dots" aria-hidden="true">
            {holidays.length > 0 && <i className="mc-dot holiday" />}
            {dayEvents.length > 0 && (
              <i
                className={`mc-dot event${dayEvents.some((e) => e.blocks_bookings) ? " blocks" : ""}`}
                style={dayEvents.some((e) => e.blocks_bookings) ? undefined : { background: colorOf(dayEvents[0]) }}
              />
            )}
          </span>
        )}
        <span className="mc-items">
          {closedOn(dateText) ? (
            <span className="mc-tag mc-closed">Closed – {closedOn(dateText).name}</span>
          ) : (
            holidays.slice(0, 1).map((h) => (
              <span key={h.name} className={`mc-holiday${h.federal ? " federal" : ""}`}>
                {h.name}
              </span>
            ))
          )}
          {dayEvents.slice(0, 2).map((e) => (
            <span key={e.id} className={`mc-event${e.blocks_bookings ? " blocks" : ""}`} style={{ borderLeftColor: colorOf(e) }}>
              {e.start_time && <b>{shortTime(String(e.start_time).slice(0, 5)).replace(/ /g, "")}</b>} {e.title}
            </span>
          ))}
          {dayEvents.length > 2 && <span className="mc-more">+{dayEvents.length - 2} more</span>}
          {list.slice(0, 3).map((b) => (
            <span key={b.id} className="mc-item">
              <b>{shortTime(String(b.start_time).slice(0, 5)).replace(/ /g, "")}</b> {firstName(b.client_name)}
            </span>
          ))}
          {list.length > 3 && <span className="mc-more">+{list.length - 3} more</span>}
          {list.length === 0 && kind === "blocked" && <span className="mc-tag">Blocked</span>}
          {list.length === 0 && kind === "off" && !closedOn(dateText) && <span className="mc-tag">Off</span>}
        </span>
      </button>
    );
  }

  const dayList = byDate[selected] || [];
  const selEvents = eventsOn(eventList, selected);
  const selHolidays = holidaysOn(selected);
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
            <span>
              <i className="mc-dot holiday" /> Holiday
            </span>
            <span>
              <i className="mc-dot event" /> Your event
            </span>
            <span>
              <i className="mc-dot event blocks" /> Bookings blocked
            </span>
          </div>

          <div className="mc-day">
            <div className="day-heading">
              <strong>{selected === today ? `Today · ${formatDate(selected)}` : formatDate(selected)}</strong>
              <span className="muted small-text">
                {dayList.length === 1 ? "1 booking" : `${dayList.length} bookings`}
              </span>
            </div>
            {selHolidays.map((h) => (
              <div key={h.name}>
                <p className="mc-day-holiday">
                  {closedOn(selected)?.key === h.key ? `Closed – ${h.name}` : h.name}
                  {h.federal && <span className="muted small-text"> · Federal holiday</span>}
                  {closedOn(selected)?.key === h.key && <span className="muted small-text"> · no bookings this day</span>}
                </p>
                {h.key && events && (
                  <HolidayDayControls
                    key={`${selected}-${h.key}-${closedSet.has(h.key)}-${blocked[selected] || ""}`}
                    holiday={h}
                    date={selected}
                    closedThisDate={blocked[selected] === `Closed – ${h.name}`}
                    closedEveryYear={closedSet.has(h.key)}
                  />
                )}
              </div>
            ))}
            {selEvents.length > 0 && (
              <ul className="client-rows event-rows">
                {selEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="client-row booking-row event-row"
                      style={{ boxShadow: `inset 3px 0 0 ${colorOf(e)}` }}
                      onClick={() => setEventSheet({ mode: "view", id: e.id })}
                      aria-haspopup="dialog"
                    >
                      <span className="booking-row-time">
                        <strong>{e.start_time ? clockTime(e.start_time) : "All day"}</strong>
                        {e.start_time && <span>{clockTime(e.end_time)}</span>}
                      </span>
                      <span className="client-row-main">
                        <span className="client-row-name">
                          <span className="client-row-text">{e.title}</span>
                        </span>
                        <span className="client-row-phone">
                          {e.repeats !== "none" ? "Repeats · " : ""}
                          {e.blocks_bookings ? "Bookings blocked" : "Reminder"}
                        </span>
                      </span>
                      <span className="booking-row-badges">
                        {e.blocks_bookings && <span className="badge event-block row-badge">Blocked</span>}
                      </span>
                      <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
                        <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selKind === "blocked" && (
              <p className="muted small-text">Blocked{blocked[selected] ? `: ${blocked[selected]}` : ""}</p>
            )}
            {selKind === "off" && !closedOn(selected) && <p className="muted small-text">Day off (from your working hours)</p>}
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
            {events ? (
              <button type="button" className="button small secondary mc-add-event" onClick={() => setEventSheet({ mode: "add" })}>
                + Add event
              </button>
            ) : (
              <p className="muted small-text">
                To add your own events (birthdays, practices) here, run step 29 of the setup
                (supabase/migrations/0034_calendar_events.sql) in Supabase.
              </p>
            )}
          </div>
        </>
      )}

      {openBooking && (
        <Sheet key={openBooking.id} label={openBooking.client_name} backLabel="Calendar" onClose={() => setOpenId(null)}>
          <BookingDetails booking={openBooking} seriesId={seriesOf[openBooking.id]} today={today} />
        </Sheet>
      )}

      {eventSheet && (eventSheet.mode === "add" || openEvent) && (
        <Sheet
          key={`${eventSheet.mode}-${eventSheet.scope || ""}-${eventSheet.id || selected}`}
          label={openEvent ? openEvent.title : "Add event"}
          backLabel="Calendar"
          onClose={() => setEventSheet(null)}
        >
          {eventSheet.mode === "view" ? (
            <EventDetails
              event={openEvent}
              date={selected}
              onEdit={(scope) => setEventSheet({ mode: "edit", id: openEvent.id, scope })}
            />
          ) : (
            <div className="client-card">
              <EventForm
                event={eventSheet.mode === "edit" ? openEvent : null}
                date={selected}
                scope={eventSheet.scope || "all"}
                onSaved={closeEventSheet}
              />
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
