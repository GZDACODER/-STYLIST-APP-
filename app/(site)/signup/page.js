import Link from "next/link";
import SignupForm from "./SignupForm";
import { BRAND_NAME } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata = { title: `Sign Up · ${BRAND_NAME}` };

export default function SignupPage() {
  return (
    <>
      <h1>Create your business account</h1>
      <p className="muted">
        Free for {TRIAL_DAYS} days with everything included. No card needed.
      </p>
      <div className="card">
        <SignupForm />
      </div>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
