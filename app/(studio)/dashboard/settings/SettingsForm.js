"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";
import TimeZoneSelect from "@/components/TimeZoneSelect";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function SettingsForm({ businessName, slug, timezone, tagline }) {
  const [state, formAction] = useActionState(saveSettings, null);

  return (
    <form action={formAction}>
      <label>
        Business name
        <input name="business_name" type="text" maxLength={100} defaultValue={businessName} required />
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
        A short line shown at the top of your booking page. Leave it empty to show &quot;Reserve
        your appointment&quot; instead.
      </p>
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
        Time zone
        <TimeZoneSelect name="timezone" defaultValue={timezone} />
      </label>
      <p className="muted small-text">
        Your openings, bookings and booking page all use this time zone.
      </p>
      <SubmitButton pendingText="Saving...">Save settings</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
