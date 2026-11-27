"use client";

import { useActionState } from "react";
import { saveBusinessLinks } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// Optional links and contact details for the booking page: Instagram and
// Location in the top bar; everything in its Contact section at the bottom.
export default function BusinessLinksForm({ instagram, location, tiktok = "", facebook = "", website = "", phone = "", email = "", showMap = false }) {
  const [state, formAction] = useActionState(saveBusinessLinks, null);

  return (
    <form action={formAction}>
      <label>
        Instagram (optional)
        <input
          name="instagram"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={80}
          defaultValue={instagram ? `@${instagram}` : ""}
          placeholder="@cutsbysam"
        />
      </label>
      <label>
        Location (optional)
        <input
          name="location"
          type="text"
          maxLength={200}
          defaultValue={location}
          placeholder="1234 N Milwaukee Ave, Chicago, IL"
        />
      </label>
      <label className="check-row">
        <input type="checkbox" name="show_map" defaultChecked={showMap} />
        <span>Show a map of this address on my booking page</span>
      </label>
      <p className="muted small-text">
        Your address, or a Google or Apple Maps link. Working from home? Put just your area (like &quot;Wicker Park,
        Chicago&quot;) and leave the map off.
      </p>
      <label>
        TikTok (optional)
        <input name="tiktok" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={80} defaultValue={tiktok ? `@${tiktok.replace(/^@/, "")}` : ""} placeholder="@yourname" />
      </label>
      <label>
        Facebook (optional)
        <input name="facebook" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} defaultValue={facebook ? `facebook.com/${facebook}` : ""} placeholder="facebook.com/yourpage" />
      </label>
      <label>
        Website (optional)
        <input name="website" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} defaultValue={website} placeholder="yourwebsite.com" />
      </label>
      <label>
        Phone for clients (optional)
        <input name="contact_phone" type="tel" maxLength={25} defaultValue={phone} placeholder="(312) 555-0142" />
      </label>
      <label>
        Email for clients (optional)
        <input name="contact_email" type="email" maxLength={200} defaultValue={email} placeholder="you@example.com" />
      </label>
      <p className="muted small-text">
        These show in a Contact section at the bottom of your booking page. Your phone and email only appear after a client taps
        See contact details. Leave anything empty to hide it.
      </p>
      <SubmitButton pendingText="Saving...">Save links</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
