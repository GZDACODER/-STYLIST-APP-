"use client";

import { useEffect, useState } from "react";
import { WEEKDAYS, formatDate, shortTime, toDateString } from "@/lib/availability";

// How many months ahead the stylist can look.
const MONTHS_AHEAD = 12;

// hours: { 0: { is_working, start_time, end_time }, ... }
// blocked: [{ blocked_on: "2026-11-03", reason: "Vacation" }, ...]
export default function AvailabilityCalendar({ hours, blocked }) {
  // "Today" comes from the stylist's device, so we wait until the page
  // is open in the browser before drawing the calendar.
  const [today, setToday] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => setToday(new Date()), []);

  if (!today) return <div className="calendar-placeholder" />;

  const blockedByDate = Object.fromEntries(blocked.map((b) => [b.blocked_on, b]));
  const hasHours = Object.keys(hours).length > 0;
  const todayText = toDateString(today);

  const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  // Columns start on Monday: Monday = 0 ... Sunday = 6.
  const leadingBlanks = (monthStart.getDay() + 6) % 7;

  function describe(dateText, date) {
    if (dateText < todayText) return { kind: "past" };
    if (blockedByDate[dateText]) return { kind: "blocked", reason: blockedByDate[dateText].reason };
    const day = hours[date.getDay()];
    if (!day) return { kind: "unset" };
    if (!day.is_working) return { kind: "off" };
    return { kind: "working", start: day.start_time, end: day.end_time };
  }

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(<div key={`blank-${i}`} className="cal-cell blank" />);
  }
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
    const dateText = toDateString(date);
    const info = describe(dateText, date);
    const classes = ["cal-cell", info.kind];
    if (dateText === todayText) classes.push("today");
    if (dateText === selected) classes.push("selected");

    cells.push(
      <button
        key={dateText}
        type="button"
        className={classes.join(" ")}
        onClick={() => setSelected(dateText === selected ? null : dateText)}
        disabled={info.kind === "past"}
      >
        <span className="cal-num">{dayNum}</span>
        {info.kind === "working" && (
          <span className="cal-label">
            {shortTime(info.start)}
            <br />
            {shortTime(info.end)}
          </span>
        )}
        {info.kind === "off" && <span className="cal-label">Off</span>}
        {info.kind === "blocked" && <span className="cal-label">Blocked</span>}
      </button>
    );
  }

  let details = null;
  if (selected) {
    const [y, m, d] = selected.split("-").map(Number);
    const info = describe(selected, new Date(y, m - 1, d));
    let text = "";
    if (info.kind === "working") text = `Working ${shortTime(info.start)} – ${shortTime(info.end)}`;
    if (info.kind === "off") text = "Day off (from your weekly hours)";
    if (info.kind === "blocked") text = info.reason ? `Blocked: ${info.reason}` : "Blocked";
    if (info.kind === "unset") text = "No hours set for this day yet";
    details = (
      <p className="cal-details">
        <strong>{formatDate(selected)}</strong>
        <br />
        {text}
      </p>
    );
  }

  return (
    <div>
      <div className="cal-header">
        <button
          type="button"
          className="button secondary small"
          onClick={() => {
            setMonthOffset(monthOffset - 1);
            setSelected(null);
          }}
          disabled={monthOffset === 0}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3>
          {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button
          type="button"
          className="button secondary small"
          onClick={() => {
            setMonthOffset(monthOffset + 1);
            setSelected(null);
          }}
          disabled={monthOffset === MONTHS_AHEAD}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {!hasHours && (
        <p className="message info">Save your weekly hours below to see them here.</p>
      )}

      <div className="cal-grid">
        {WEEKDAYS.map((day) => (
          <div key={day.dow} className="cal-weekday">
            {day.short}
          </div>
        ))}
        {cells}
      </div>

      {details}

      <div className="cal-legend">
        <span><i className="swatch working" /> Working</span>
        <span><i className="swatch off" /> Day off</span>
        <span><i className="swatch blocked" /> Blocked</span>
      </div>
    </div>
  );
}
