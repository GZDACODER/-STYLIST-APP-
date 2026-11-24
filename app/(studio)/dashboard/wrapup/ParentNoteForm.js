"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import { saveParentNote } from "./parentNoteActions";

// The two buttons send their own name/value ("send"), so one form does both.
export default function ParentNoteForm({ bookingId, note, guardian, sentAt }) {
  const [state, action, pending] = useActionState(saveParentNote, null);
  return (
    <details className="look-editor" open={!note}>
      <summary>
        Note for {guardian?.name || "the parent"} {sentAt || state?.sent ? "· sent" : note ? "· saved" : ""}
      </summary>
      <form action={action} className="stack">
        <input type="hidden" name="id" value={bookingId} />
        <textarea name="note" rows={3} maxLength={1500} defaultValue={note || ""} placeholder="What you worked on, how they did, and what to practise before next time." />
        {!guardian?.email && <p className="muted small-text">Add a parent&apos;s email on the student&apos;s card to email this.</p>}
        <div className="row wrap">
          {guardian?.email && (
            <button type="submit" name="send" value="true" className="button small" disabled={pending}>
              {pending ? "Sending..." : sentAt ? "Send again" : "Save and email parent"}
            </button>
          )}
          <button type="submit" name="send" value="false" className="button small secondary" disabled={pending}>
            Save only
          </button>
        </div>
        <FormMessage state={state} />
      </form>
    </details>
  );
}
