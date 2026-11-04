"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveWaitlist } from "../../actions";

// "Leave the waitlist": a quiet link that asks first, on the page, like the
// booking page's Cancel: "Stay on the waitlist" (black) / "Yes, leave".
export default function LeaveWaitlist({ token }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function leave() {
    setError(null);
    startTransition(async () => {
      const result = await leaveWaitlist(token);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      {asking ? (
        <div className="cancel-confirm leave-confirm" role="group" aria-label="Leave the waitlist?">
          <p>Leave the waitlist?</p>
          <p className="cancel-note">You won&apos;t hear about new times any more.</p>
          <div className="cancel-actions">
            <button
              type="button"
              className="button small"
              onClick={() => setAsking(false)}
              disabled={pending}
              autoFocus
            >
              Stay on the waitlist
            </button>
            <button type="button" className="button secondary small" onClick={leave} disabled={pending}>
              {pending ? "Leaving..." : "Yes, leave"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="link-button cancel-link leave-link"
          onClick={() => setAsking(true)}
        >
          Leave the waitlist
        </button>
      )}
      {error && <p className="message error">{error}</p>}
    </>
  );
}
