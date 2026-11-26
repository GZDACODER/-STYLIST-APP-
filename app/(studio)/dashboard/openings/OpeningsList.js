"use client";

// Openings, compact: filter chips (All · Everyone · Regulars only), a week
// strip (‹ Nov 16 – 22 › with Mon–Sun chips: tap a day to show just that
// day), then one slim row per opening:
//   Tue Nov 17 · 9 AM – 5 PM   [Everyone]   ⋯
// The pill switches Everyone ⇄ Regulars only in one tap; blocked time shows
// as a red dot and "4–5 PM blocked" on the row; ⋯ has Edit, Duplicate and
// Remove. Later weeks are collapsed ("Next week · 5 openings ›"). Select
// picks several rows to set Everyone / Regulars only or remove at once.
import { startTransition, useActionState, useEffect, useMemo, useOptimistic, useState } from "react";
import { bulkOpenings, deleteOpening, duplicateOpening, setOpeningVisibility, updateOpening } from "./actions";
import { clockTime, formatDate, parseDateString, toDateString } from "@/lib/availability";
import EmptyState from "@/components/dash/EmptyState";
import Sheet from "@/components/Sheet";
import TimeSelect from "@/components/TimeSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_PLURAL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const AUDIENCE = { everyone: "Everyone", regulars: "Regulars" };
const hhmm = (t) => String(t).slice(0, 5);

// Monday of the week holding `date`.
function mondayOf(date) {
  const d = parseDateString(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateString(d);
}
function addDays(date, n) {
  const d = parseDateString(date);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}
const monthDay = (date) => parseDateString(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// "Nov 16 – 22", or "Nov 30 – Dec 6".
function weekLabel(monday) {
  const sunday = addDays(monday, 6);
  return monday.slice(0, 7) === sunday.slice(0, 7)
    ? `${monthDay(monday)} – ${Number(sunday.slice(8))}`
    : `${monthDay(monday)} – ${monthDay(sunday)}`;
}
const rowDate = (date) => `${DAY[parseDateString(date).getDay()]} ${monthDay(date)}`;
const shortTime = (t) => clockTime(t).replace(":00", "");
const range = (o) => `${shortTime(o.start_time)} – ${shortTime(o.end_time)}`;

function applyChange(openings, change) {
  const ids = new Set(change.ids);
  if (change.remove) return openings.filter((o) => !ids.has(o.id));
  return openings.map((o) => (ids.has(o.id) ? { ...o, visibility: change.visibility } : o));
}

// blockedBy: { openingId: [{ short: "4–5 PM blocked", full: "Maya's practice: ..." }] }
// examples: example openings (lib/examples.js), shown only while there are
// no real ones; they can be looked at but not changed.
export default function OpeningsList({ openings, bookingCounts, blockedBy = {}, regularsAllowed = true, today, examples = [] }) {
  const exampleMode = openings.length === 0 && examples.length > 0;
  const [shown, setOptimistic] = useOptimistic(exampleMode ? examples : openings, applyChange);
  const [error, setError] = useState(null);
  const [audience, setAudience] = useState("all");
  const firstWeek = mondayOf(today);
  const [week, setWeek] = useState(firstWeek);
  const [day, setDay] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  // The panel: { mode: "edit" | "duplicate" | "remove" | "blocked", id }.
  const [sheet, setSheet] = useState(null);

  function save(changeInfo, run) {
    setError(null);
    startTransition(async () => {
      setOptimistic(changeInfo);
      const result = await run();
      if (result?.error) setError(result.error);
    });
  }

  const filtered = useMemo(
    () => shown.filter((o) => audience === "all" || o.visibility === audience),
    [shown, audience]
  );
  const counts = {
    all: shown.length,
    everyone: shown.filter((o) => o.visibility === "everyone").length,
    regulars: shown.filter((o) => o.visibility === "regulars").length,
  };

  // This week's openings, and later weeks grouped (collapsed).
  const weekEnd = addDays(week, 6);
  const thisWeek = filtered.filter((o) => o.opening_date >= week && o.opening_date <= weekEnd);
  const visible = day ? thisWeek.filter((o) => o.opening_date === day) : thisWeek;
  const laterWeeks = [];
  if (!day) {
    for (const o of filtered.filter((x) => x.opening_date > weekEnd)) {
      const monday = mondayOf(o.opening_date);
      const last = laterWeeks[laterWeeks.length - 1];
      if (last && last.monday === monday) last.openings.push(o);
      else laterWeeks.push({ monday, openings: [o] });
    }
  }
  const lastWeek = shown.length ? mondayOf(shown[shown.length - 1].opening_date) : firstWeek;

  const sheetOpening = sheet ? shown.find((o) => o.id === sheet.id) : null;
  useEffect(() => {
    if (sheet && !sheetOpening) setSheet(null);
  }, [sheet, sheetOpening]);

  function togglePick(id) {
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function bulk(op) {
    const ids = [...picked];
    if (!ids.length) return;
    save(op === "remove" ? { ids, remove: true } : { ids, visibility: op }, () => bulkOpenings(ids, op));
    setPicked(new Set());
    setSelecting(false);
  }

  if (shown.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title="No upcoming openings"
        text="Open some times so clients can book."
        action={
          <a href="#add-opening" className="button small">
            + Add opening
          </a>
        }
      />
    );
  }

  const row = (o) => {
    const count = bookingCounts[o.id] || 0;
    const blocked = blockedBy[o.id] || [];
    const regularsOnlyLocked = !regularsAllowed && o.visibility === "everyone";
    if (o.example) {
      return (
        <li key={o.id} className="op-row is-example">
          <button type="button" className="op-main op-example-open" onClick={() => setSheet({ mode: "example", id: o.id })}>
            <span className="op-when">
              <strong>{rowDate(o.opening_date)}</strong> · {range(o)}
            </span>
          </button>
          <span className={`op-pill ${o.visibility}`}>
            {o.visibility === "regulars" && <span aria-hidden="true">★ </span>}
            {AUDIENCE[o.visibility]}
          </span>
          <ExampleTag />
        </li>
      );
    }
    return (
      <li key={o.id} className={picked.has(o.id) ? "op-row picked" : "op-row"}>
        {selecting && (
          <input
            type="checkbox"
            className="op-check"
            checked={picked.has(o.id)}
            onChange={() => togglePick(o.id)}
            aria-label={`Select ${rowDate(o.opening_date)} ${range(o)}`}
          />
        )}
        <span className="op-main" onClick={selecting ? () => togglePick(o.id) : undefined}>
          <span className="op-when">
            <strong>{rowDate(o.opening_date)}</strong> · {range(o)}
          </span>
          {(count > 0 || blocked.length > 0) && (
            <span className="op-meta">
              {count > 0 && <span>{count} booked</span>}
              {blocked.length > 0 && (
                <button type="button" className="op-blocked" onClick={() => setSheet({ mode: "blocked", id: o.id })}>
                  <span className="op-dot" aria-hidden="true" />
                  {blocked.map((b) => b.short).join(", ")}
                </button>
              )}
            </span>
          )}
        </span>
        <button
          type="button"
          className={`op-pill ${o.visibility}`}
          disabled={selecting || regularsOnlyLocked}
          title={regularsOnlyLocked ? "Regulars only needs an active plan" : "Tap to switch who can book"}
          aria-label={`Who can book: ${AUDIENCE[o.visibility]}. Tap to switch.`}
          onClick={() => {
            const visibility = o.visibility === "everyone" ? "regulars" : "everyone";
            save({ ids: [o.id], visibility }, () => setOpeningVisibility(o.id, visibility));
          }}
        >
          {o.visibility === "regulars" && <span aria-hidden="true">★ </span>}
          {AUDIENCE[o.visibility]}
        </button>
        {!selecting && (
          <details className="op-menu">
            <summary aria-label={`More for ${rowDate(o.opening_date)} ${range(o)}`}>⋯</summary>
            <div className="op-menu-list">
              <button type="button" onClick={(e) => { e.currentTarget.closest("details").open = false; setSheet({ mode: "edit", id: o.id }); }}>
                Edit
              </button>
              <button type="button" onClick={(e) => { e.currentTarget.closest("details").open = false; setSheet({ mode: "duplicate", id: o.id }); }}>
                Duplicate
              </button>
              <button type="button" className="danger" onClick={(e) => { e.currentTarget.closest("details").open = false; setSheet({ mode: "remove", id: o.id }); }}>
                Remove
              </button>
            </div>
          </details>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="op-toolbar">
        <div className="filter-chips" role="group" aria-label="Who can book">
          {[
            ["all", "All"],
            ["everyone", "Everyone"],
            ["regulars", "Regulars only"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={audience === value ? "chip active" : "chip"}
              aria-pressed={audience === value}
              onClick={() => setAudience(value)}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>
        {!exampleMode && (
        <button
          type="button"
          className="button secondary small"
          onClick={() => {
            setSelecting((on) => !on);
            setPicked(new Set());
          }}
        >
          {selecting ? "Done" : "Select"}
        </button>
        )}
      </div>

      {selecting && (
        <div className="op-bulk" role="group" aria-label="Change selected openings">
          <span>
            <strong>{picked.size}</strong> selected
          </span>
          <button type="button" className="button secondary small" disabled={!picked.size} onClick={() => bulk("everyone")}>
            Everyone
          </button>
          <button
            type="button"
            className="button secondary small"
            disabled={!picked.size || !regularsAllowed}
            onClick={() => bulk("regulars")}
          >
            Regulars only
          </button>
          <button type="button" className="button secondary small op-danger" disabled={!picked.size} onClick={() => bulk("remove")}>
            Remove
          </button>
          <button
            type="button"
            className="link-button small-text"
            onClick={() => setPicked(new Set(visible.map((o) => o.id)))}
          >
            Select all shown
          </button>
        </div>
      )}

      {error && <p className="message error">Couldn&apos;t save: {error}</p>}
      {exampleMode && (
        <p className="examples-note">
          These are example openings. Open your own times below and they&apos;ll go away.
        </p>
      )}

      <div className="op-week">
        <div className="op-week-head">
          <button
            type="button"
            className="op-arrow"
            aria-label="Previous week"
            disabled={week <= firstWeek}
            onClick={() => {
              setWeek(addDays(week, -7));
              setDay(null);
            }}
          >
            ‹
          </button>
          <strong>{week === firstWeek ? `This week · ${weekLabel(week)}` : weekLabel(week)}</strong>
          <button
            type="button"
            className="op-arrow"
            aria-label="Next week"
            disabled={week >= lastWeek}
            onClick={() => {
              setWeek(addDays(week, 7));
              setDay(null);
            }}
          >
            ›
          </button>
        </div>
        <div className="op-days" role="group" aria-label="Show one day">
          {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((date) => {
            const n = thisWeek.filter((o) => o.opening_date === date).length;
            return (
              <button
                key={date}
                type="button"
                className={["op-day", day === date ? "active" : "", n ? "has" : "", date < today ? "past" : ""].join(" ")}
                aria-pressed={day === date}
                onClick={() => setDay(day === date ? null : date)}
              >
                <span>{DAY[parseDateString(date).getDay()]}</span>
                <strong>{Number(date.slice(8))}</strong>
                <i aria-hidden="true">{n ? "•" : ""}</i>
              </button>
            );
          })}
        </div>
        {day && (
          <button type="button" className="link-button small-text" onClick={() => setDay(null)}>
            Show the whole week
          </button>
        )}
      </div>

      {visible.length ? (
        <ul className="op-rows">{visible.map(row)}</ul>
      ) : (
        <p className="muted op-none">{day ? `Nothing open on ${formatDate(day)}.` : "Nothing open this week."}</p>
      )}

      {laterWeeks.map((w) => (
        <details key={w.monday} className="op-later">
          <summary>
            <span>
              <strong>{w.monday === addDays(firstWeek, 7) ? "Next week" : weekLabel(w.monday)}</strong> ·{" "}
              {w.openings.length === 1 ? "1 opening" : `${w.openings.length} openings`}
            </span>
            <span className="db-chevron" aria-hidden="true" />
          </summary>
          <ul className="op-rows">{w.openings.map(row)}</ul>
        </details>
      ))}

      {sheetOpening?.example && (
        <Sheet key={sheetOpening.id} label={rowDate(sheetOpening.opening_date)} backLabel="Openings" onClose={() => setSheet(null)}>
          <ExampleCard
            title={`${rowDate(sheetOpening.opening_date)} · ${range(sheetOpening)}`}
            facts={[
              ["Who can book", sheetOpening.visibility === "regulars" ? "Regulars only (hidden from everyone else)" : "Everyone"],
              ["How it works", "Clients pick a time inside this opening on your booking page. Tap the tag on a real opening to switch who can book."],
            ]}
            addHref="/dashboard/openings#add-opening"
            addLabel="+ Add your own opening"
          />
        </Sheet>
      )}
      {sheetOpening && !sheetOpening.example && (
        <Sheet
          key={`${sheet.mode}-${sheetOpening.id}`}
          label={`${rowDate(sheetOpening.opening_date)} ${range(sheetOpening)}`}
          backLabel="Openings"
          onClose={() => setSheet(null)}
        >
          <div className="client-card">
            <div className="client-top">
              <div className="client-name">
                {rowDate(sheetOpening.opening_date)} · {range(sheetOpening)}
              </div>
              <span className={`op-pill ${sheetOpening.visibility}`}>{AUDIENCE[sheetOpening.visibility]}</span>
            </div>
            {sheet.mode === "blocked" && (
              <ul className="op-blocked-list">
                {(blockedBy[sheetOpening.id] || []).map((b) => (
                  <li key={b.full}>
                    <span className="op-dot" aria-hidden="true" /> {b.full}
                  </li>
                ))}
              </ul>
            )}
            {sheet.mode === "edit" && <EditForm opening={sheetOpening} onDone={() => setSheet(null)} />}
            {sheet.mode === "duplicate" && <DuplicateForm opening={sheetOpening} today={today} onDone={() => setSheet(null)} />}
            {sheet.mode === "remove" && (
              <form
                action={async (formData) => {
                  save({ ids: [sheetOpening.id], remove: true }, () => deleteOpening(formData));
                  setSheet(null);
                }}
              >
                <input type="hidden" name="id" value={sheetOpening.id} />
                <p className="muted">
                  {bookingCounts[sheetOpening.id]
                    ? `${bookingCounts[sheetOpening.id]} booking${bookingCounts[sheetOpening.id] > 1 ? "s are" : " is"} already in it and will be kept.`
                    : "Clients won't be able to book it any more."}
                </p>
                <SubmitButton className="button small" pendingText="Removing...">
                  Yes, remove
                </SubmitButton>
              </form>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

function EditForm({ opening, onDone }) {
  const [state, formAction] = useActionState(updateOpening, null);
  useEffect(() => {
    if (state?.savedAt) onDone();
  }, [state?.savedAt, onDone]);
  return (
    <form action={formAction} className="op-form">
      <input type="hidden" name="id" value={opening.id} />
      <label>
        Date
        <input type="date" name="date" defaultValue={opening.opening_date} required />
      </label>
      <div className="standing-row">
        <label>
          From
          <TimeSelect name="from" defaultValue={hhmm(opening.start_time)} />
        </label>
        <label>
          To
          <TimeSelect name="to" defaultValue={hhmm(opening.end_time)} />
        </label>
      </div>
      <p className="muted small-text">Bookings already in it stay booked.</p>
      <SubmitButton pendingText="Saving...">Save opening</SubmitButton>
      <FormMessage state={state?.error ? state : null} />
    </form>
  );
}

function DuplicateForm({ opening, today, onDone }) {
  const [state, formAction] = useActionState(duplicateOpening, null);
  const next = addDays(opening.opening_date, 7);
  return (
    <form action={formAction} className="op-form">
      <input type="hidden" name="id" value={opening.id} />
      <p className="muted small-text">
        Copies {range(opening)} ({AUDIENCE[opening.visibility]}) to another date.
      </p>
      <label>
        Date
        <input type="date" name="date" min={today} defaultValue={next < today ? today : next} required />
      </label>
      <label>
        Until (optional, to copy to several days)
        <input type="date" name="until" min={today} />
      </label>
      <label className="check-row">
        <input type="checkbox" name="same_weekday" defaultChecked />
        <span>Only {DAYS_PLURAL[parseDateString(opening.opening_date).getDay()]}</span>
      </label>
      <SubmitButton pendingText="Copying...">Duplicate</SubmitButton>
      <FormMessage state={state} />
      {state?.success && (
        <button type="button" className="button secondary small" onClick={onDone}>
          Done
        </button>
      )}
    </form>
  );
}
