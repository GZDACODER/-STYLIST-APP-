"use client";

import { useFormStatus } from "react-dom";

// A button that shows "Please wait..." while its form is sending.
export default function SubmitButton({ children, pendingText = "Please wait...", className = "button", disabled = false }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
