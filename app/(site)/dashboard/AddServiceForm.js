"use client";

import { useActionState } from "react";
import { addService } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function AddServiceForm() {
  const [state, formAction] = useActionState(addService, null);
  // If there was a mistake, keep what the stylist typed so they can fix it.
  const values = state?.values || {};

  return (
    <form action={formAction}>
      <label>
        Service name
        <input
          name="name"
          type="text"
          placeholder="e.g. Women's cut & style"
          maxLength={100}
          defaultValue={values.name}
          required
        />
      </label>
      <div className="row">
        <label>
          Price ($)
          <input
            name="price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="45"
            defaultValue={values.price}
            required
          />
        </label>
        <label>
          Minutes
          <input
            name="duration_minutes"
            type="number"
            inputMode="numeric"
            min="5"
            max="600"
            step="1"
            placeholder="60"
            defaultValue={values.duration_minutes}
            required
          />
        </label>
      </div>
      <SubmitButton pendingText="Adding...">Add service</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
