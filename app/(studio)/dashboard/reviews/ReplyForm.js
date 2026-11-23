"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveReply } from "./actions";

export default function ReplyForm({ id, reply }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveReply, null);
  if (!open)
    return (
      <button type="button" className="link-button small-text" onClick={() => setOpen(true)}>
        {reply ? "Edit your reply" : "Reply publicly"}
      </button>
    );
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <label>
        Your public reply
        <textarea name="reply" rows={3} maxLength={1000} defaultValue={reply || ""} placeholder="e.g. Thank you! See you next time." />
      </label>
      <p className="muted small-text">Shows under the review on your profile. Leave it empty to remove it.</p>
      <div className="row">
        <SubmitButton className="button small" pendingText="Saving...">
          Save reply
        </SubmitButton>
        <button type="button" className="link-button small-text" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
