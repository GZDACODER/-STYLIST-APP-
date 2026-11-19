"use client";

// The client's home with one pro (/client/<pro ID>): Regular status,
// feedback on their last visit, upcoming visits (add to calendar, running
// late, reschedule, cancel), Book my usual, My look, aftercare tips and
// birthday. Data from client_home (step 46 SQL).
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MyBookings from "@/app/book/[slug]/MyBookings";
import PageGuide from "@/components/guide/PageGuide";
import RegularStar from "@/components/RegularStar";
import { formatDate } from "@/lib/availability";
import { clientSignOut, leaveFeedback, runningLate, saveBirthday } from "../actions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

function RegularCard({ home }) {
  const isRegular = home.status === "regular";
  const left = Math.max(0, (home.regular_after || 0) - (home.visits || 0));
  const perks = [
    "First pick of new openings, and times kept just for Regulars",
    home.waitlist_on ? "You hear first when a cancellation frees up a time" : null,
    home.regular_perks ? home.regular_perks : null,
  ].filter(Boolean);
  return (
    <section className={isRegular ? "card cl-regular is-regular" : "card cl-regular"} data-guide="regular">
      {isRegular ? (
        <>
          <p className="cl-badge">
            <RegularStar label={null} size={14} /> You&apos;re a Regular
          </p>
          <ul className="cl-perks">
            {perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : home.regular_after > 0 ? (
        <>
          <p className="cl-badge is-quiet">
            {left === 0
              ? "You'll be a Regular after your next visit is wrapped up"
              : `${left} more ${left === 1 ? "visit" : "visits"} to become a Regular`}
          </p>
          <div className="cl-progress" aria-hidden="true">
            <span style={{ width: `${Math.min(100, ((home.visits || 0) / home.regular_after) * 100)}%` }} />
          </div>
          <p className="muted small-text">Regulars get: {perks.join(" · ")}.</p>
        </>
      ) : (
        <p className="muted small-text">{home.business_name} chooses their Regulars. Regulars get: {perks.join(" · ")}.</p>
      )}
    </section>
  );
}

function Feedback({ code, due }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  if (done) {
    return (
      <section className="card">
        <p className="message success" role="status">
          Thank you. Only your pro sees this.
        </p>
      </section>
    );
  }
  const send = (r, c) =>
    startTransition(async () => {
      const res = await leaveFeedback(code, due.booking_id, r, c);
      if (res.error) setError(res.error);
      else if (c !== undefined) setDone(true);
    });
  return (
    <section className="card" data-guide="feedback">
      <h2>How was your {due.service_name}?</h2>
      <p className="muted small-text">{formatDate(due.date)} · only your pro sees this</p>
      <div className="cl-stars" role="group" aria-label="Rate your visit">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= rating ? "cl-star on" : "cl-star"}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={n === rating}
            onClick={() => {
              setRating(n);
              send(n);
            }}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            send(rating, comment);
          }}
        >
          <label>
            Anything to add? (optional)
            <textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="submit" className="button small" disabled={pending}>
            {pending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

function RunningLate({ code, booking }) {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="cl-late" data-guide="late">
      <span className="small-text">Running late?</span>
      {[5, 10, 15].map((m) => (
        <button
          key={m}
          type="button"
          className="chip"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await runningLate(code, booking.id, m);
              if (res.error) setError(res.error);
              else setSent(m);
            })
          }
        >
          {m === 15 ? "15+ min" : `${m} min`}
        </button>
      ))}
      {sent && (
        <p className="message success small-text" role="status">
          Sent. They know you&apos;re about {sent === 15 ? "15+" : sent} minutes away.
        </p>
      )}
      {error && <p className="message error small-text">{error}</p>}
    </div>
  );
}

function Birthday({ code, home }) {
  const [value, setValue] = useState(home.birthday || "");
  const [month, setMonth] = useState(value ? Number(value.slice(0, 2)) : "");
  const [day, setDay] = useState(value ? Number(value.slice(3)) : "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const save = (m, d) =>
    startTransition(async () => {
      setError(null);
      const res = await saveBirthday(code, m, d);
      if (res.error) setError(res.error);
      else {
        setValue(res.birthday || "");
        setSaved(true);
      }
    });
  return (
    <section className="card" data-guide="birthday">
      <h2>Your birthday</h2>
      {home.birthday_perk ? (
        <p className="muted">
          {home.business_name}&apos;s birthday treat: <strong>{home.birthday_perk}</strong>. Add your birthday and
          it&apos;s emailed to you on the day.
        </p>
      ) : (
        <p className="muted">Add your birthday so {home.business_name} can remember it. No year needed.</p>
      )}
      <form
        className="cl-bday"
        onSubmit={(e) => {
          e.preventDefault();
          save(month, day);
        }}
      >
        <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select aria-label="Day" value={day} onChange={(e) => setDay(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button type="submit" className="button small" disabled={pending || !month || !day}>
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
      {value && (
        <p className="muted small-text">
          Saved: {MONTHS[Number(value.slice(0, 2)) - 1]} {Number(value.slice(3))}
          {saved ? " ✓" : ""} ·{" "}
          <button type="button" className="link-button small-text" onClick={() => save("", "")} disabled={pending}>
            Remove
          </button>
        </p>
      )}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

export default function ClientHome({ code, home, upcoming, today, zoneNote, lookPhoto, google }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const first = String(home.client_name || "").trim().split(/\s+/)[0];
  const last = home.last_visit;
  const todays = new Set(upcoming.filter((b) => b.booking_date === today).map((b) => b.id));

  return (
    <div className="cl-home">
      <PageGuide guideKey="client_home" button={false} />
      <header className="cl-head">
        <p className="bk-kicker">
          {home.business_name} · {home.pro_code}
        </p>
        <h1 className="cl-title">
          Hi{first ? ` ${first}` : ""}
          <PageGuide guideKey="client_home" auto={false} className="gd-help-title" />
        </h1>
      </header>

      <RegularCard home={home} />

      {home.feedback_due && <Feedback code={code} due={home.feedback_due} />}

      {upcoming.length > 0 ? (
        <MyBookings
          slug={home.slug}
          businessName={home.business_name}
          policy={home.policy}
          zoneNote={zoneNote}
          title="Your upcoming visits"
          guide={false}
          // The list updates itself and shows "Cancelled: ..."; reloading the
          // page here would replace it before the client sees that.
          extra={(b) => (
            <div className="cl-visit-extra">
              <div className="cl-cal">
                <a href={`/client/${code}/calendar/${b.id}.ics`} className="link-button small-text">
                  Add to Apple / Outlook
                </a>
                {google[b.id] && (
                  <a href={google[b.id]} target="_blank" rel="noreferrer" className="link-button small-text">
                    Add to Google
                  </a>
                )}
              </div>
              {todays.has(b.id) && <RunningLate code={code} booking={b} />}
            </div>
          )}
        />
      ) : (
        <section className="card">
          <h2>Your upcoming visits</h2>
          <p className="muted">Nothing booked right now.</p>
        </section>
      )}

      <section className="card" data-guide="rebook">
        <h2>Book again</h2>
        {last?.service_active ? (
          <>
            <Link href={`/book/${home.slug}?service=${last.service_id}`} className="button">
              Book my usual: {last.service_name}
            </Link>
            <p className="muted small-text">
              {duration(last.minutes)} like last time ({formatDate(last.date)}). You just pick a time.
            </p>
          </>
        ) : (
          <p className="muted">Pick a service and a time on {home.business_name}&apos;s booking page.</p>
        )}
        <Link href={`/book/${home.slug}`} className="link-button">
          Book something else
        </Link>
      </section>

      {home.look && (
        <section className="card cl-look" data-guide="look">
          <h2>My look</h2>
          <p className="muted small-text">
            {home.look.service_name} · {formatDate(home.look.date)}
          </p>
          {lookPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lookPhoto} alt={`Your ${home.look.service_name}`} className="cl-look-photo" />
          )}
          {home.look.note && <p className="cl-look-note">{home.look.note}</p>}
        </section>
      )}

      {last?.aftercare && (
        <section className="card">
          <h2>Aftercare for your {last.service_name}</h2>
          <p className="cl-look-note">{last.aftercare}</p>
        </section>
      )}

      <Birthday code={code} home={home} />

      <p className="muted small-text cl-foot">
        Signed in on this device.{" "}
        <button
          type="button"
          className="link-button small-text"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await clientSignOut();
              router.push(`/client?code=${code}&out=1`);
            })
          }
        >
          Sign out
        </button>
      </p>
    </div>
  );
}
