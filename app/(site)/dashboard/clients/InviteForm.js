"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvite } from "./inviteActions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import InviteShare from "./InviteShare";

export default function InviteForm({ slug, businessName }) {
  const [state, formAction] = useActionState(createInvite, null);
  const form = useRef(null);

  // Clear the form once the link is made.
  useEffect(() => {
    if (state?.createdAt) form.current?.reset();
  }, [state?.createdAt]);

  return (
    <>
      <form action={formAction} ref={form}>
        <label>
          Their name
          <input name="name" type="text" maxLength={100} required />
        </label>
        <label>
          Their mobile number (optional)
          <input name="phone" type="tel" inputMode="tel" maxLength={30} placeholder="(555) 123-4567" />
        </label>
        <p className="muted small-text">
          With a number, only that person can use the link, and you can text it straight from here.
        </p>
        <SubmitButton pendingText="Making link...">Make invite link</SubmitButton>
        <FormMessage state={state?.error ? state : null} />
      </form>

      {state?.invite && (
        <div className="message success">
          <p>Invite link for {state.invite.name} is ready. Send it to them:</p>
          <InviteShare
            slug={slug}
            token={state.invite.token}
            name={state.invite.name}
            phone={state.invite.phone}
            businessName={businessName}
          />
        </div>
      )}
    </>
  );
}
