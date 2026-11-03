"use client";

import { removeWaitlistEntry } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default function RemoveEntryButton({ id, name }) {
  function confirmRemove(event) {
    if (!window.confirm(`Take ${name} off the waitlist? They won't hear about new times.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={removeWaitlistEntry} onSubmit={confirmRemove}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="link-button danger" pendingText="Removing...">
        Remove from waitlist
      </SubmitButton>
    </form>
  );
}
