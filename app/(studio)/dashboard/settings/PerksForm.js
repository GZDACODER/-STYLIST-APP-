"use client";

// Settings → Regulars: perks shown to clients on their "Your visits" page,
// and the birthday treat emailed on their birthday.
import { useActionState } from "react";
import { savePerks } from "../clientFeatureActions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function PerksForm({ regularPerks, birthdayPerk }) {
  const [state, action] = useActionState(savePerks, null);
  return (
    <form action={action} className="stack">
      <label>
        An extra perk for Regulars (optional)
        <input
          name="regular_perks"
          maxLength={300}
          defaultValue={regularPerks}
          placeholder="e.g. A free deep condition every 5th visit"
        />
      </label>
      <p className="muted small-text">
        Clients see this with the built-in perks (first pick of openings, first to hear about cancellations) when they
        sign in.
      </p>
      <label>
        Birthday treat (optional)
        <input name="birthday_perk" maxLength={300} defaultValue={birthdayPerk} placeholder="e.g. 15% off any visit in your birthday month" />
      </label>
      <p className="muted small-text">
        Emailed to clients on their birthday if they&apos;ve added it. Leave empty to send nothing.
      </p>
      <SubmitButton className="button small" pendingText="Saving...">
        Save perks
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
