"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { setSupportAccess } from "./typeActions";

export default function SupportAccessForm({ on }) {
  const [state, action] = useActionState(setSupportAccess, null);
  return (
    <>
      <form action={action} className="stack">
        <label>
          {on ? "Change how long" : "Turn on for"}
          <select name="length" defaultValue="24h">
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="always">Until I turn it off</option>
          </select>
        </label>
        <SubmitButton className="button small" pendingText="Saving...">
          {on ? "Update" : "Turn on support access"}
        </SubmitButton>
      </form>
      {on && (
        <form action={action} className="stack support-off">
          <input type="hidden" name="length" value="off" />
          <SubmitButton className="button small secondary" pendingText="Turning off...">
            Turn off now
          </SubmitButton>
        </form>
      )}
      <FormMessage state={state} />
    </>
  );
}
