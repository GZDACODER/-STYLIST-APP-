"use client";

// Settings → Calendar sync: add the private calendar link to iPhone Calendar
// or Google Calendar, copy it for Outlook, or reset it.
import { useState, useTransition } from "react";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import { resetCalendarFeed } from "./calendarActions";

export default function CalendarSync({ feedUrl }) {
  const webcal = feedUrl.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    startTransition(async () => {
      const result = await resetCalendarFeed();
      setConfirming(false);
      setMessage(result.error ? { error: result.error } : { ok: "New link made. Add it to your calendar again; the old one has stopped working." });
    });
  }

  return (
    <div className="stack calendar-sync">
      <div className="row wrap calendar-sync-buttons">
        <a href={webcal} className="button">
          Add to iPhone Calendar
        </a>
        <a href={google} className="button secondary" target="_blank" rel="noreferrer">
          Add to Google Calendar
        </a>
        <CopyLinkButton link={feedUrl} label="Copy link" />
      </div>

      <details>
        <summary>How it works</summary>
        <ul className="small-text">
          <li>
            <strong>iPhone:</strong> tap Add to iPhone Calendar, then Subscribe. Bookings show in your Calendar app
            under &ldquo;Clientele&rdquo;.
          </li>
          <li>
            <strong>Google Calendar:</strong> tap Add to Google Calendar on a computer, or on your phone in a browser,
            then Add. It shows on every device signed in to that Google account.
          </li>
          <li>
            <strong>Outlook and others:</strong> tap Copy link, then use &ldquo;Add calendar from internet&rdquo; (or
            &ldquo;Subscribe&rdquo;).
          </li>
          <li>
            Calendars check for changes every few hours (Google can take up to a day), so a brand-new booking may take
            a while to appear. Clientele is always up to date.
          </li>
          <li>It&apos;s one-way: changes you make in that calendar don&apos;t change your bookings.</li>
        </ul>
      </details>

      <p className="muted small-text">
        Keep this link private: anyone with it can see your bookings. Shared it by mistake?{" "}
        {confirming ? (
          <>
            Make a new link? You&apos;ll need to add it to your calendar again.{" "}
            <button type="button" className="link-button" onClick={reset} disabled={pending}>
              {pending ? "Making..." : "Yes, new link"}
            </button>{" "}
            ·{" "}
            <button type="button" className="link-button" onClick={() => setConfirming(false)} disabled={pending}>
              Keep this one
            </button>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirming(true)}>
            Make a new link
          </button>
        )}
      </p>
      {message?.ok && <p className="message success">{message.ok}</p>}
      {message?.error && <p className="message error">{message.error}</p>}
    </div>
  );
}
