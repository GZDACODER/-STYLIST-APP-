"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { supportEditService, supportEditTagline } from "./actions";

export function ServiceForm({ stylistId, s }) {
  const [state, action] = useActionState(supportEditService, null);
  return (
    <form action={action} className="mn-grid">
      <input type="hidden" name="stylist_id" value={stylistId} />
      <input type="hidden" name="id" value={s.id} />
      <label>
        Name
        <input name="name" defaultValue={s.name} maxLength={100} />
      </label>
      <label>
        Price ($)
        <input name="price" inputMode="decimal" defaultValue={(s.price_cents / 100).toFixed(2)} />
      </label>
      <label>
        Minutes
        <input name="minutes" type="number" min={5} max={960} step={5} defaultValue={s.duration_minutes} />
      </label>
      <SubmitButton className="button small" pendingText="Saving...">
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function TaglineForm({ stylistId, tagline }) {
  const [state, action] = useActionState(supportEditTagline, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="stylist_id" value={stylistId} />
      <label>
        Booking page tagline
        <input name="tagline" defaultValue={tagline || ""} maxLength={120} />
      </label>
      <SubmitButton className="button small" pendingText="Saving...">
        Save tagline
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
