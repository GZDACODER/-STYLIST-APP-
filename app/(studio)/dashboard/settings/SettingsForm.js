"use client";

// One form for the profile fields, shown in parts: Business (name, first
// name, time zone), Booking page (link, tagline) and Email (reply email).
// Only the fields shown are sent, and only those are saved.
import { useActionState } from "react";
import { saveSettings } from "./actions";
import TimeZoneSelect from "@/components/TimeZoneSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function SettingsForm({ part = "business", businessName, firstName, slug, timezone, tagline, replyEmail, loginEmail }) {
  const [state, formAction] = useActionState(saveSettings, null);

  return (
    <form action={formAction}>
      {part === "business" && (
        <>
          <label>
            Business name
            <input name="business_name" type="text" maxLength={100} defaultValue={businessName} required />
          </label>
          <label>
            Your first name (optional)
            <input name="first_name" type="text" autoComplete="given-name" maxLength={50} defaultValue={firstName} />
          </label>
          <p className="muted small-text">Used to greet you on your dashboard. Clients don&apos;t see it.</p>
          <label>
            Time zone
            <TimeZoneSelect name="timezone" defaultValue={timezone} />
          </label>
          <p className="muted small-text">Your openings, bookings and booking page all use this time zone.</p>
        </>
      )}

      {part === "booking" && (
        <>
          <label>
            Booking link
            <div className="prefixed">
              <span>/book/</span>
              <input
                name="slug"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={40}
                defaultValue={slug}
                required
              />
            </div>
          </label>
          <label>
            Tagline (optional)
            <input
              name="tagline"
              type="text"
              maxLength={120}
              defaultValue={tagline}
              placeholder="Colour and precision cutting in Logan Square"
            />
          </label>
          <p className="muted small-text">
            A short line shown at the top of your booking page. Leave it empty to show &quot;Reserve your
            appointment&quot; instead.
          </p>
        </>
      )}

      {part === "email" && (
        <>
          <label>
            Email for client replies (optional)
            <input
              name="reply_email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={replyEmail}
              placeholder={loginEmail}
            />
          </label>
          <p className="muted small-text">
            Client emails come from hello@clientelesuite.com. When a client replies, it goes here. Leave it empty
            to use your login email{loginEmail ? ` (${loginEmail})` : ""}.
          </p>
        </>
      )}

      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
