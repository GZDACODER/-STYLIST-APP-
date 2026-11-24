"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { setSupportAccess } from "./typeActions";

export default function SupportAccessForm({ on, level }) {
  const [state, action] = useActionState(setSupportAccess, null);
  return (
    <>
      <form action={action} className="stack">
        <fieldset className="support-level">
          <legend>What can the team do?</legend>
          <label className="check-row">
            <input type="radio" name="level" value="view" defaultChecked={level !== "edit"} />
            <span>
              <strong>View only</strong> · they can look at your settings, services, hours and upcoming bookings to help,
              but can&apos;t change anything
            </span>
          </label>
          <label className="check-row">
            <input type="radio" name="level" value="edit" defaultChecked={level === "edit"} />
            <span>
              <strong>View and edit</strong> · they can also fix things for you, like a service&apos;s price or length
            </span>
          </label>
        </fieldset>
        <label>
          {on ? "Change how long" : "Turn on for"}
          <select name="length" defaultValue="24h">
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
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
