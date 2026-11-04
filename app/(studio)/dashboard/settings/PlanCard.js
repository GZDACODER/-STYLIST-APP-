// Settings: which plan the stylist is on and what's switched on. Read-only
// for now; paying and changing plans come with Stripe (billing part 2).
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";

const PARTS = [
  { feature: "base", plan: PLANS.base },
  { feature: "regulars", plan: PLANS.regulars },
  { feature: "waitlist", plan: PLANS.waitlist },
];

export default function PlanCard({ plan }) {
  const trialEnds = plan.trialEndsAt
    ? new Date(plan.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  return (
    <section className="card">
      <h2>Your plan</h2>
      {plan.comped ? (
        <p className="muted">Founding account: everything is on, and you&apos;re never billed.</p>
      ) : plan.inTrial ? (
        <p className="muted">Free trial: everything is on until {trialEnds}. No card needed.</p>
      ) : (
        <p className="muted">Paying for a plan is coming soon.</p>
      )}
      <ul className="service-list plan-list">
        {PARTS.map(({ feature, plan: part }) => (
          <li key={feature}>
            <div>
              <div className="service-name">{part.name}</div>
              <div className="muted small-text">
                {part.description} {formatPrice(part.monthlyCents)}/mo
              </div>
            </div>
            <span className={plan.has[feature] ? "badge paid" : "badge"}>
              {plan.has[feature] ? "On" : "Paused"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
