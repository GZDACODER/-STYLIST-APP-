import Link from "next/link";
import SignupForm from "./SignupForm";
import { BRAND_NAME } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata = {
  title: `Sign Up · ${BRAND_NAME}`,
  description: "Start your free 14-day trial of Clientele: online booking, deposits, waivers and a waitlist for independent pros. No card needed.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage({ searchParams }) {
  // From the homepage's "Start free": after signing up, go to Import your services.
  const next = (await searchParams)?.next === "import" ? "import" : "";
  return (
    <>
      <p className="au-kicker">14 days free</p>
      <h1>Create your business account</h1>
      <p className="muted">
        Free for {TRIAL_DAYS} days with everything included. No card needed.
      </p>
      <div className="card">
        <SignupForm after={next} />
      </div>
      <p className="muted small-text">
        By creating an account, you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
