"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutBooking } from "../book/actions";

export default function SignOut({ label = "Sign out" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutBooking();
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
