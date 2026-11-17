import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Forgot Password · ${BRAND_NAME}` };

export default async function ForgotPasswordPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <>
      <h1>Forgot your password?</h1>
      {error === "link" && (
        // The emailed link didn't work: expired, used already, or opened in a
        // different browser from the one that asked for it.
        <p className="message error">
          That reset link has expired or was already used. Please ask for a new one below, and
          open it on the same phone or computer you ask from.
        </p>
      )}
      <p className="muted">Enter the email you log in with and we&apos;ll send you a link to choose a new password.</p>
      <div className="card">
        <ForgotPasswordForm />
      </div>
      <p>
        Remembered it? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
