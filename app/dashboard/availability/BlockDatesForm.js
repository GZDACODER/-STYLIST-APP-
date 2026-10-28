"use client";

import { useActionState, useEffect, useState } from "react";
import { blockDates } from "./actions";
import { toDateString } from "@/lib/availability";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function BlockDatesForm() {
  const [state, formAction] = useActionState(blockDates, null);
  // If there was a mistake, keep what the stylist typed so they can fix it.
  const values = state?.values || {};
  // Worked out in the browser so it's the stylist's own "today", not the server's.
  const [today, setToday] = useState(undefined);
  useEffect(() => setToday(toDateString(new Date())), []);

  return (
    <form action={formAction}>
      <label>
        Date
        <input
          name="start_date"
          type="date"
          min={today}
          defaultValue={values.start_date}
          required
        />
      </label>
      <label>
        Until (optional, for several days in a row)
        <input name="end_date" type="date" min={today} defaultValue={values.end_date} />
      </label>
      <label>
        Note (optional, only you see this)
        <input
          name="reason"
          type="text"
          placeholder="e.g. Vacation"
          maxLength={100}
          defaultValue={values.reason}
        />
      </label>
      <SubmitButton pendingText="Blocking...">Block date(s)</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
