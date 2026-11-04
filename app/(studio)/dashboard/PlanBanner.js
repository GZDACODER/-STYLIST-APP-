import Link from "next/link";

// A thin banner across the dashboard when the stylist's plan needs them:
// the trial ends within 3 days, a payment failed, or the trial is over.
// Nothing for founding accounts or anyone paying normally.
export default function PlanBanner({ plan }) {
  if (!plan?.ready || plan.comped) return null;

  let text = null;
  if (plan.stripeStatus === "past_due") {
    text = "Your last payment didn't go through. Please update your card so nothing switches off.";
  } else if (!plan.subscribed && plan.inTrial && plan.daysLeft <= 3) {
    text =
      plan.daysLeft <= 1
        ? "Your free trial ends today. Choose a plan to keep everything on."
        : `Your free trial ends in ${plan.daysLeft} days. Choose a plan to keep everything on.`;
  } else if (!plan.subscribed && !plan.inTrial) {
    text = "Your free trial has ended. Choose a plan to switch your add-ons back on.";
  }
  if (!text) return null;

  const action =
    plan.stripeStatus === "past_due" ? (
      <a href="/dashboard/billing/portal">Update card</a>
    ) : (
      <Link href="/dashboard/settings#plan">Choose a plan</Link>
    );

  return (
    <div className="db-plan-banner" role="status">
      <span>{text}</span>
      {action}
    </div>
  );
}
