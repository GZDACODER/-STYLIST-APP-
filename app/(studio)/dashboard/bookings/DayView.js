"use client";

// The Calendar's Day view: one day as a timeline. Times down the left, each
// booking and event as a block sized to its length, side by side when they
// overlap, your working hours lit and the rest shaded, and a gold line at the
// time now. All-day things (holidays, closed days, blocked days, all-day
// events) sit in a strip above. Tap a block to open it.
import { useEffect, useMemo, useState } from "react";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { colorOf } from "@/lib/calendarEvents";
import RegularStar from "@/components/RegularStar";
import { ExampleTag } from "@/components/dash/Example";

const PX_PER_MIN = 1.1; // 66px an hour
const mins = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};
const hourLabel = (h) => (h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);

// Side-by-side lanes for blocks that overlap in time.
function layout(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const it of cluster) {
      let lane = lanes.findIndex((end) => end <= it.start);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(it.end);
      } else lanes[lane] = it.end;
      it.lane = lane;
    }
    for (const it of cluster) out.push({ ...it, lanes: lanes.length });
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

function nowMinutes(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export default function DayView({
  date,
  today,
  timeZone,
  bookings,
  events,
  workHours,
  allDay,
  onOpenBooking,
  onOpenEvent,
  onPrev,
  onNext,
  onToday,
  onAddEvent,
  loading = false,
}) {
  const isToday = date === today;
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!isToday || !timeZone) return;
    const tick = () => setNow(nowMinutes(timeZone));
    tick();
    const t = setInterval(tick, 60 * 1000);
    return () => clearInterval(t);
  }, [isToday, timeZone]);

  const working = workHours?.is_working ? { start: mins(workHours.start_time), end: mins(workHours.end_time) } : null;

  const items = useMemo(() => {
    const list = [
      ...bookings.map((b) => ({ kind: "booking", id: b.id, start: mins(b.start_time), end: Math.max(mins(b.end_time), mins(b.start_time) + 15), b })),
      ...events.filter((e) => e.start_time).map((e) => ({ kind: "event", id: e.id, start: mins(e.start_time), end: Math.max(mins(e.end_time), mins(e.start_time) + 15), e })),
    ];
    return layout(list);
  }, [bookings, events]);

  // The hours shown: the working day (or 9–5), stretched to fit everything.
  const first = Math.min(working?.start ?? 9 * 60, ...items.map((i) => i.start), isToday && now != null ? now : Infinity);
  const last = Math.max(working?.end ?? 17 * 60, ...items.map((i) => i.end), isToday && now != null ? now + 30 : 0);
  const startHour = Math.max(0, Math.floor(first / 60) - (first % 60 === 0 && first > 0 ? 1 : 0));
  const endHour = Math.min(24, Math.ceil(last / 60) + 1);
  const top = (m) => (m - startHour * 60) * PX_PER_MIN;
  const height = (endHour - startHour) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const allDayEvents = events.filter((e) => !e.start_time);
  const bookedCount = bookings.length;
  const revenue = bookings.reduce((sum, b) => sum + (b.price_cents || 0), 0);

  return (
    <div className="dv">
      <div className="dv-head">
        <button type="button" className="dv-nav" onClick={onPrev} aria-label="Previous day">
          ‹
        </button>
        <div className="dv-date">
          <span className="dv-weekday">{isToday ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}</span>
          <strong>{formatDate(date).replace(/^\w+, /, "")}</strong>
        </div>
        <button type="button" className="dv-nav" onClick={onNext} aria-label="Next day">
          ›
        </button>
        {!isToday && (
          <button type="button" className="link-button dv-today" onClick={onToday}>
            Today
          </button>
        )}
        {loading && (
          <span className="muted small-text" role="status">
            Loading…
          </span>
        )}
      </div>

      <div className="dv-summary">
        <span>
          <strong>{bookedCount}</strong> {bookedCount === 1 ? "booking" : "bookings"}
        </span>
        {revenue > 0 && (
          <span>
            <strong>{formatPrice(revenue).replace(/\.00$/, "")}</strong> booked
          </span>
        )}
        <span>{working ? `Working ${clockTime(workHours.start_time)} – ${clockTime(workHours.end_time)}` : "Not a working day"}</span>
      </div>

      {(allDay.length > 0 || allDayEvents.length > 0) && (
        <div className="dv-allday">
          {allDay.map((a) => (
            <span key={a.label} className={`dv-chip ${a.tone || ""}`}>
              {a.label}
            </span>
          ))}
          {allDayEvents.map((e) => (
            <button key={e.id} type="button" className="dv-chip event" style={{ "--ev": colorOf(e) }} onClick={() => onOpenEvent(e)}>
              {e.title}
              {e.example && <ExampleTag />}
            </button>
          ))}
        </div>
      )}

      <div className="dv-grid" style={{ height }}>
        {/* Off-hours shading */}
        {working ? (
          <>
            {working.start > startHour * 60 && <div className="dv-off" style={{ top: 0, height: top(working.start) }} />}
            {working.end < endHour * 60 && <div className="dv-off" style={{ top: top(working.end), bottom: 0 }} />}
          </>
        ) : (
          <div className="dv-off" style={{ top: 0, bottom: 0 }} />
        )}

        {hours.map((h) => (
          <div key={h} className="dv-hour" style={{ top: top(h * 60) }}>
            <span>{h < 24 ? hourLabel(h) : ""}</span>
          </div>
        ))}

        <div className="dv-lane">
          {items.map((it) => {
            const style = {
              top: top(it.start) + 1,
              height: Math.max(26, (it.end - it.start) * PX_PER_MIN - 3),
              left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`,
              width: `calc(${100 / it.lanes}% - 4px)`,
            };
            if (it.kind === "event") {
              const e = it.e;
              return (
                <button
                  key={`e-${it.id}`}
                  type="button"
                  className={`dv-block dv-event${e.blocks_bookings ? " blocks" : ""}`}
                  style={{ ...style, "--ev": colorOf(e) }}
                  onClick={() => onOpenEvent(e)}
                >
                  <span className="dv-title">{e.title}</span>
                  <span className="dv-meta">
                    {clockTime(e.start_time)} – {clockTime(e.end_time)}
                    {e.blocks_bookings ? " · Bookings blocked" : ""}
                  </span>
                  {e.example && <ExampleTag />}
                </button>
              );
            }
            const b = it.b;
            const compact = (it.end - it.start) * PX_PER_MIN < 64;
            const past = b.past || (isToday && now != null && it.end <= now) || date < today;
            return (
              <button
                key={`b-${it.id}`}
                type="button"
                className={`dv-block dv-booking${past ? " past" : ""}${b.client?.status === "regular" ? " regular" : ""}${compact ? " compact" : ""}`}
                style={style}
                onClick={() => onOpenBooking(b)}
              >
                <span className="dv-title">
                  {b.client_name}
                  {b.client?.status === "regular" && <RegularStar label={null} size={10} />}
                </span>
                <span className="dv-meta">
                  {clockTime(b.start_time)}
                  {compact ? "" : ` – ${clockTime(b.end_time)}`} · {b.service_name}
                </span>
                <span className="dv-tags">
                  {b.deposit_status === "paid" && b.deposit_cents > 0 && <span className="dv-tag paid">Deposit paid</span>}
                  {b.outcome === "no_show" && <span className="dv-tag warn">No-show</span>}
                  {b.outcome === "completed_owed" && <span className="dv-tag warn">Balance owed</span>}
                  {b.example && <ExampleTag />}
                </span>
              </button>
            );
          })}
        </div>

        {isToday && now != null && now >= startHour * 60 && now <= endHour * 60 && (
          <div className="dv-now" style={{ top: top(now) }} aria-label={`Now, ${clockTime(`${Math.floor(now / 60)}:${now % 60}`)}`}>
            <span />
          </div>
        )}
      </div>

      {items.length === 0 && allDay.length === 0 && (
        <p className="dv-empty muted">Nothing booked. {working ? "Your day is open." : ""}</p>
      )}
      {onAddEvent && (
        <button type="button" className="button small secondary dv-add" onClick={onAddEvent}>
          + Add event
        </button>
      )}
    </div>
  );
}
