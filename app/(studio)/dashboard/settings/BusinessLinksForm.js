"use client";

import { useActionState } from "react";
import { saveBusinessLinks } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// Optional Instagram and Location links in the booking page's top bar.
export default function BusinessLinksForm({ instagram, location }) {
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
      <p className="muted small-text">
        Your address, or a Google or Apple Maps link. Instagram and Location show as links at the top
        of your booking page. Leave them empty to hide them.
      </p>
      <SubmitButton pendingText="Saving...">Save links</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
