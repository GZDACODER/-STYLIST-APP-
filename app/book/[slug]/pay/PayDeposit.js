"use client";

// Opens Stripe's payment page for a standing visit's deposit.
import { useState, useTransition } from "react";
import { payVisitDeposit } from "../../actions";

export default function PayDeposit({ token, label }) {
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function pay() {
    setError(null);
    startTransition(async () => {
      const result = await payVisitDeposit(token);
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else setError(result.error || "Something went wrong. Please try again.");
    });
  }

  return (
    <>
      <button type="button" className="button" onClick={pay} disabled={pending}>
        {pending ? "Opening payment page..." : label}
      </button>
      {error && <p className="message error">{error}</p>}
    </>
  );
}
