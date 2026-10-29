"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveWaitlist } from "../../actions";

export default function LeaveWaitlist({ token }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function leave() {
    if (!window.confirm("Leave the waitlist? You won't hear about new times any more.")) return;
    setError(null);
    startTransition(async () => {
      const result = await leaveWaitlist(token);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="link-button danger" onClick={leave} disabled={pending}>
        {pending ? "Leaving..." : "Leave the waitlist"}
      </button>
      {error && <p className="message error">{error}</p>}
    </>
  );
}
