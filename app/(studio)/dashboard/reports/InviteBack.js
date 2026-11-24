"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { inviteBack } from "./actions";

export default function InviteBack({ id, bookingId, serviceId, invitedRecently }) {
  const [state, action] = useActionState(inviteBack, null);
  if (state?.success) return <p className="small-text muted">{state.success}</p>;
  if (invitedRecently) return <p className="small-text muted">Invited back recently</p>;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id || ""} />
      <input type="hidden" name="booking_id" value={bookingId || ""} />
      <input type="hidden" name="service_id" value={serviceId || ""} />
      <SubmitButton className="button small secondary" pendingText="Sending...">
        Invite back
      </SubmitButton>
      {state?.error && <p className="small-text message error">{state.error}</p>}
    </form>
  );
}
