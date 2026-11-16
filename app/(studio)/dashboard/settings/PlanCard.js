// Settings: the stylist's plan (All-in), team members, and paying with Stripe.
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import ChoosePlanForm from "./ChoosePlanForm";
import TeamMembersForm from "./TeamMembersForm";

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
  const yearly = plan.interval === "year";
  const per = yearly ? "/yr" : "/mo";
  const planCents = yearly ? PLANS.allin.yearlyCents : PLANS.allin.monthlyCents;
  const seatCents = yearly ? PLANS.team.yearlyCents : PLANS.team.monthlyCents;
  const on = plan.has.base;

  return (
    <section className="card" id="plan">
      <h2>Plan &amp; billing</h2>
      {notice && <p className={`message ${notice.kind}`}>{notice.text}</p>}

      <div className="plan-line">
        <div>
          <strong>
            {PLANS.allin.name} · {formatPrice(PLANS.allin.monthlyCents)}/mo
          </strong>
          <span className="muted small-text"> or {formatPrice(PLANS.allin.yearlyCents)}/yr</span>
          <p className="muted small-text">{PLANS.allin.description}</p>
        </div>
        <span className={on ? "badge paid" : "badge"}>{on ? "On" : "Paused"}</span>
      </div>

      {plan.comped ? (
        <p className="muted">Founding account: everything is on, and you&apos;re never billed.</p>
      ) : plan.subscribed ? (
        <>
          <p className="muted">
            {plan.stripeStatus === "past_due"
              ? "Your last payment didn't go through. Stripe will try again; please check your card in Manage billing."
              : plan.stripeStatus === "trialing"
                ? `Free trial: ${daysText(plan.daysLeft)} left. Your plan starts on ${day(plan.trialEndsAt)}.`
                : `Paid ${yearly ? "yearly" : "monthly"}. Next renewal ${day(plan.periodEnd)}.`}
          </p>
          <dl className="plan-sum">
            <div>
              <dt>{PLANS.allin.name}</dt>
              <dd>
                {formatPrice(planCents)}
                {per}
              </dd>
            </div>
            <div>
              <dt>
                Team members × {plan.teamMembers}
              </dt>
              <dd>
                {formatPrice(plan.teamMembers * seatCents)}
                {per}
              </dd>
            </div>
            <div className="plan-sum-total">
              <dt>Total</dt>
              <dd>
                {formatPrice(planCents + plan.teamMembers * seatCents)}
                {per}
              </dd>
            </div>
          </dl>
          <p className="muted small-text">
            If you signed up on an earlier plan, Stripe keeps your original price; Manage billing shows it.
          </p>
          {canPay && <TeamMembersForm key={plan.teamMembers} count={plan.teamMembers} yearly={yearly} />}
        </>
      ) : plan.inTrial ? (
        <p className="muted">
          <strong>Free trial: {daysText(plan.daysLeft)} left.</strong> Everything is on until{" "}
          {day(plan.trialEndsAt)}, and no card is needed. Choose your plan below to keep it going
          after that.
        </p>
      ) : (
        <p className="muted">
          Your free trial has ended. Choose your plan to switch everything back on. Your bookings
          and clients are all still here.
        </p>
      )}

      {!plan.comped && plan.hasCustomer && (
        <p>
          <a href="/dashboard/billing/portal" className="button secondary small">
            Manage billing
          </a>
        </p>
      )}

      {!plan.comped && !plan.subscribed &&
        (canPay ? (
          <ChoosePlanForm inTrial={plan.inTrial} />
        ) : (
          <p className="message warning">Paying isn&apos;t set up yet (the Stripe keys are missing in Vercel).</p>
        ))}

      <p className="muted small-text">
        Team members are {formatPrice(PLANS.team.monthlyCents)}/mo ({formatPrice(PLANS.team.yearlyCents)}/yr)
        each, half the price of the plan.
      </p>
    </section>
  );
}
