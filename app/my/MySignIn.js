"use client";

// Signing in to My Pros: the same email (or text) code as the booking pages.
import { useRouter } from "next/navigation";
import VerifyClient from "../book/[slug]/VerifyClient";

export default function MySignIn({ textCodes }) {
  const router = useRouter();
  return <VerifyClient onVerified={() => router.refresh()} textCodes={textCodes} />;
}
