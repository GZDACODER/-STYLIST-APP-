import Link from "next/link";
import { PLANS } from "@/lib/plans";

// Shown where a paused add-on's controls are: "Regulars First isn't on your
// plan right now. Add Regulars First". feature: "regulars" or "waitlist".
export default function PausedNote({ feature, children }) {
  const plan = PLANS[feature];
  return (
    <p className="message paused-note">
      {children || <>{plan.name} isn&apos;t on your plan right now, so this is switched off.</>}{" "}
      <Link href="/dashboard/settings#plan">Add {plan.name}</Link>
    </p>
  );
}
