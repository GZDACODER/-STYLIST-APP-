"use client";

import { removeWaitlistEntry } from "./actions";
import ConfirmAction from "@/components/ConfirmAction";

// "Remove from waitlist": a quiet link that asks first, on the page.
export default function RemoveEntryButton({ id, name }) {
  return (
    <ConfirmAction
      label="Remove from waitlist"
      question={`Take ${name} off the waitlist?`}
      note="They won't hear about new times."
      keepLabel="Keep on waitlist"
      confirmLabel="Yes, remove"
      pendingText="Removing..."
      action={removeWaitlistEntry}
      fields={{ id }}
    />
  );
}
