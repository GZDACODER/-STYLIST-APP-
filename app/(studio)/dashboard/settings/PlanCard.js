// Settings: the stylist's plan, what's switched on, and paying with Stripe.
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import ChoosePlanForm from "./ChoosePlanForm";

const PARTS = [
  { feature: "base", plan: PLANS.base },
  { feature: "regulars", plan: PLANS.regulars },
  { feature: "waitlist", plan: PLANS.waitlist },
];

const NOTICES = {
  success: { kind: "success", text: "Thanks! Your plan is being switched on. Refresh in a moment if it still says Paused." },
  cancelled: { kind: "info", text: "Payment cancelled. Nothing was charged." },
  portal_error: { kind: "error", text: "Stripe's billing page didn't open. Please try again in a minute." },
};

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

const daysText = (n) => (n <= 1 ? "less than a day" : `${n} days`);

export default function PlanCard({ plan, billingNotice, canPay }) {
  const notice = NOTICES[billingNotice];

  return (
    <section className="card" id="plan">
      <h2>Your plan</h2>
      {notice && <p className={`message ${notice.kind}`}>{notice.text}</p>}
      {plan.comped ? (
        <p className="muted">Founding account: everything is on, and you&apos;re never billed.</p>
      ) : plan.subscribed ? (
        <p className="muted">
          {plan.stripeStatus === "past_due"
            ? "Your last payment didn't go through. Stripe will try again; please check your card in Manage billing."
            : plan.stripeStatus === "trialing"
              ? `Free trial: ${daysText(plan.daysLeft)} left. Your plan starts on ${day(plan.trialEndsAt)}.`
              : `Paid ${plan.interval === "year" ? "yearly" : "monthly"}. Next renewal ${day(plan.periodEnd)}.`}
        </p>
      ) : plan.inTrial ? (
        <p className="muted">
          <strong>Free trial: {daysText(plan.daysLeft)} left.</strong> Everything is on until{" "}
          {day(plan.trialEndsAt)}, and no card is needed. Choose a plan below to keep it going
          after that.
        </p>
      ) : (
        <p className="muted">
          Your free trial has ended. Choose a plan to switch your add-ons back on. Your bookings
          and clients are all still here.
        </p>
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

      {!plan.comped && plan.hasCustomer && (
        <p>
          <a href="/dashboard/billing/portal" className="button secondary small">
            Manage billing
          </a>
        </p>
      )}

      {!plan.comped && !plan.subscribed && (
        canPay ? (
          <ChoosePlanForm inTrial={plan.inTrial} />
        ) : (
          <p className="message warning">Paying isn&apos;t set up yet (the Stripe keys are missing in Vercel).</p>
        )
      )}
    </section>
  );
}
