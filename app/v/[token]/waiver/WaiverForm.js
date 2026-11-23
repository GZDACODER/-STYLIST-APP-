"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import IntakeFields from "@/app/book/[slug]/IntakeFields";
import { signWaiverByLink } from "./actions";

export default function WaiverForm({ token, intake, businessName }) {
  const [value, setValue] = useState({ answers: {}, signedName: "", agreed: false });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="stack">
        <p className="message success" role="status">
          Signed. Thank you! A PDF copy is on its way to your email.
        </p>
        <Link href={`/v/${token}`} className="button">
          Back to my appointment
        </Link>
      </div>
    );
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (String(intake.waiver_text || "").trim() && !value.signature) {
          setError("Please sign in the box.");
          return;
        }
        start(async () => {
          const r = await signWaiverByLink(token, value);
          if (r.error) setError(r.error);
          else setDone(true);
        });
      }}
    >
      <IntakeFields intake={intake} businessName={businessName} value={value} onChange={setValue} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving..." : "Sign and send"}
      </button>
      {error && <p className="message error">{error}</p>}
    </form>
  );
}
