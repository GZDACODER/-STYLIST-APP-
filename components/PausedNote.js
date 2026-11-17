import Link from "next/link";

// Shown where a feature's controls are when the account has no plan (the
// trial ended and nothing is paid): "Your plan is paused... Choose a plan".
// feature is kept for the callers; every feature comes with the one plan.
// eslint-disable-next-line no-unused-vars
export default function PausedNote({ feature, children }) {
  return (
    <p className="message paused-note">
      {children || <>Your plan is paused, so this is switched off.</>}{" "}
      <Link href="/dashboard/settings/plan">Choose a plan</Link>
    </p>
  );
}
