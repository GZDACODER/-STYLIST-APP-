import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";
import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: `New Password · ${BRAND_NAME}` };

// Opened from the "reset your password" email (via /auth/confirm, which
// logs them in first).
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <p className="au-kicker">Your account</p>
        <h1>Choose a new password</h1>
        <p className="message error">
          This reset link has expired or was already used. Please{" "}
          <Link href="/forgot-password">ask for a new one</Link>.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Choose a new password</h1>
      <p className="muted">For {user.email}. You&apos;ll stay logged in after saving it.</p>
      <div className="card">
        <ResetPasswordForm />
      </div>
    </>
  );
}
